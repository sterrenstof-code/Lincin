import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type TextInput } from "react-native";

import { LincinScreen, TopRow, vfade } from "@/components/lincin/Chrome";
import { ComposeBar, ReactBox, ReplyStrip } from "@/components/lincin/ComposeBar";
import { ActionRow, EmojiDrawer, HeartBurst, LikedBy, LikesPanel, UnderlinedAction } from "@/components/lincin/post/Reactions";
import { CommentList, CommentScrollProvider, CommentsHead, useCommentScroll } from "@/components/lincin/post/Comments";
import { Media } from "@/components/lincin/Media";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
import { useFeedCard } from "@/components/lincin/feed/useFeed";
import { BORDER, Box, GUTTER, Mono, Serif, VerticalLabel, line } from "@/components/lincin/ui";
import type { EntityComment } from "@/lib/api/entity-comments";
import { deletePost, getPost, type PostWithAuthor } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, friendColor, hueFor, RASTER, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { useComments } from "@/lib/lincin/comments";
import { useDraft } from "@/lib/lincin/drafts";
import { usePostLikes } from "@/lib/lincin/likes";
import { displayName, fromPost, hhmm, timeLabel } from "@/lib/lincin/model";
import { useMeasure } from "@/lib/lincin/measure";
import { EditPost } from "@/components/lincin/EditPost";
import { DesktopPost } from "@/components/lincin/desktop/DesktopPost";
import { openProfile as openProfileAnywhere, useIsDesktop } from "@/lib/lincin/desktop";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

/**
 * De bladzijde van een bijdrage (README §02).
 *
 * `← Terug` en een label bovenaan; dan de kaart: het beeld op 300 met een
 * kleurstrook links, de titel groot, het bijschrift in serif, de tekst,
 * en wie het maakte. Daaronder de reacties, een `◷ EVENT` als er iets te
 * plannen valt, `BERICHT`, en de comments. Onderaan de balk met
 * `☺` (het reactievak), invoer en `↑`.
 */

const MEDIA_H = 300;
const STRIP_W = 34;

/**
 * Op desktop (model 3c/3d) is een bijdrage hetzelfde scherm, maar op volle
 * breedte: `DesktopPost`. Daaronder de telefoonbladzijde, onveranderd.
 */
export default function PostRoute(props: { id?: string; embedded?: boolean } = {}) {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const desktop = useIsDesktop();
  if (desktop && !props.embedded) return <DesktopPost id={props.id ?? String(raw ?? "")} />;
  return <PostScreen {...props} />;
}

export function PostScreen({ id: idProp, embedded = false }: { id?: string; embedded?: boolean } = {}) {
  const { id: raw, c: highlight } = useLocalSearchParams<{ id: string; c?: string }>();
  // Ingebed komt het id als prop; als scherm uit de route.
  const id = idProp ?? String(raw ?? "");
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
    enabled: !!id,
    initialData: () => {
      const feed = qc.getQueryData<{ type: string; data: PostWithAuthor }[]>(["unified-feed", myUserId]);
      return feed?.find((i) => i.type === "post" && i.data.id === id)?.data;
    },
  });
  useEffect(() => {
    if (id) markSeen(id);
  }, [id]);

  const p = post.data ?? null;
  const card = useMemo(() => (p ? fromPost(p) : null), [p]);
  /** "№ 07": hetzelfde nummer als in de feed, ook bij een rechtstreekse URL. */
  const { number } = useFeedCard(id);
  usePageTitle(card?.title ?? null);
  useHueChoices();
  // De kleur die de maker koos, anders zijn eigen kleur.
  const hue = card?.swatch ?? hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);

  // ---- likes, emoji en reacties (Bijdrage Voorbeeld) ----
  const likes = usePostLikes(id || undefined, myUserId);
  const m = useComments({ entityType: "post", entityId: id || undefined, myUserId, ownerId: p?.user_id });
  const [drawer, setDrawer] = useState(false);
  const [panel, setPanel] = useState(false);
  const [burst, setBurst] = useState(0);

  // ---- de schrijfbalk ----
  const [draft, setDraft, clearDraft] = useDraft(id ? `post:${id}` : null);
  const [replyTo, setReplyTo] = useState<EntityComment | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  const inputRef = useRef<TextInput>(null);
  const cs = useCommentScroll();

  function send(imageUri?: string) {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body && !imageUri) return;
    m.send({ body, imageUri: imageUri ?? null, parentId: replyTo?.id ?? null });
    clearDraft();
    setBoxOpen(false);
    setReplyTo(null);
    invalidatePostCaches(qc);
  }

  function reply(c: EntityComment) {
    const author = c.user_id === myUserId ? null : m.authorOf(c);
    setReplyTo(c);
    // Een antwoord op een antwoord begint met @naam (HANDOFF).
    if (c.parent_id && author?.username && !draft.includes(`@${author.username}`)) setDraft((d) => `@${author.username} ${d}`);
    if (c.parent_id) m.setOpen(c.parent_id, true);
    else m.setOpen(c.id, true);
    inputRef.current?.focus();
  }

  async function remove() {
    if (!p) return;
    const ok = await confirm("Bijdrage verwijderen?", "Je vrienden zien hem dan niet meer.", {
      affirmativeLabel: "Verwijder",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost(p);
      invalidatePostCaches(qc);
      safeBack(router, "/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  const photo = card?.media.kind === "foto";
  const [editing, setEditing] = useState(false);
  /** Een tekst krijgt geen vak van 300 maar zijn volle lengte: te lezen tot het eind. */
  const fullText = card?.media.kind === "tekst";
  const { ref: mediaRef, size: mediaSize, onLayout: onMediaLayout } = useMeasure();
  const canEvent = !!p && (/\?/.test(p.caption ?? "") || card?.media.kind === "plek");
  const own = !!p && p.user_id === myUserId;
  const authorName = p ? displayName(p.author) : "";
  const spec = useThemeSpec();
  const modern = spec.id === "modern";
  const tile = modern
    ? ({
        borderWidth: 0,
        borderRadius: RASTER.tileRadius,
        backgroundColor: color("tile", "tileFill"),
        overflow: "hidden",
        ...(Platform.OS === "web" ? { backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } : null),
      } as object)
    : undefined;
  const zoom = p && card ? { number, author: authorName, kind: card.kind, time: hhmm(p.created_at), title: card.title } : undefined;
  const replyName = replyTo ? (replyTo.user_id === myUserId ? t.me : displayName(m.authorOf(replyTo))) : "";
  const onDoubleTap = () => {
    likes.like();
    setBurst((n) => n + 1);
  };

  return (
    <LincinScreen
      tab="feed"
      tint={p ? fc.fill : null}
      counter={t.post}
      embedded={embedded}
      back="/feed"
      header={
        <TopRow
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Mono variant="micro" tone="dim">
                {t.post}
                {number ? ` № ${number}` : card ? ` · ${card.kind}` : ""}
              </Mono>
              {own && !editing ? (
                <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={6}>
                  <Mono variant="micro">{t.editPost}</Mono>
                </Pressable>
              ) : null}
              {own ? (
                <Pressable accessibilityRole="button" onPress={remove} hitSlop={6}>
                  <Mono variant="micro" tone="red">
                    Verwijder
                  </Mono>
                </Pressable>
              ) : null}
            </View>
          }
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={cs.scrollRef} style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <CommentScrollProvider value={cs.scrollTo}>
          <View ref={cs.contentRef} collapsable={false}>
          {post.isLoading && !p ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.loading}
            </Mono>
          ) : !p || !card ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.failed}
            </Mono>
          ) : (
            <>
              {/* Een foto zoals Instagram: rand tot rand, de hoogte uit zijn
                  eigen verhouding. Dubbeltik = like, met een hart dat even
                  oplicht (450 ms). */}
              {photo ? (
                <View>
                  <Media
                    media={card.media}
                    height={MEDIA_H}
                    hue={hue}
                    postId={p.id}
                    myUserId={myUserId}
                    size="page"
                    photoFit="ratio"
                    zoom={zoom}
                    onDoubleTap={onDoubleTap}
                  />
                  <HeartBurst key={burst} show={burst > 0} />
                </View>
              ) : (
                <View style={{ paddingHorizontal: GUTTER, paddingTop: 14 }}>
                  <Box style={tile}>
                    <View
                      ref={mediaRef}
                      onLayout={onMediaLayout}
                      style={{ flexDirection: "row", ...(fullText ? { minHeight: MEDIA_H } : { height: MEDIA_H }) }}
                    >
                      <View style={{ width: STRIP_W, backgroundColor: fc.fill, borderRightWidth: BORDER, borderRightColor: line(), overflow: "hidden" }}>
                        <VerticalLabel
                          text={`${card.kind} · ${hhmm(p.created_at)}`}
                          width={STRIP_W}
                          height={fullText ? Math.max(MEDIA_H, mediaSize.h) : MEDIA_H}
                          color={fc.ink}
                          style={{ letterSpacing: 0.8, textTransform: "uppercase" }}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {fullText ? (
                          <View style={{ flex: 1, backgroundColor: color("paper2"), paddingVertical: 16, paddingHorizontal: 18 }}>
                            <Serif variant="quote" selectable>
                              {card.media.kind === "tekst" ? card.media.text : ""}
                            </Serif>
                          </View>
                        ) : (
                          <Media media={card.media} height={MEDIA_H} hue={hue} postId={p.id} myUserId={myUserId} size="page" zoom={zoom} />
                        )}
                      </View>
                    </View>
                  </Box>
                </View>
              )}

              {/* Het vriendenblok (Bijdrage Voorbeeld 1a): wie en wanneer,
                  de titel, het bijschrift — in de kleur van de bijdrage. */}
              <View
                style={{
                  marginTop: 6,
                  marginHorizontal: 6,
                  padding: 20,
                  gap: 10,
                  backgroundColor: modern ? color("tile", "tileFill") : fc.fill,
                  borderRadius: modern ? RASTER.tileRadius : 0,
                }}
              >
                {editing ? (
                  <EditPost post={p} onDone={() => setEditing(false)} />
                ) : (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`${authorName}, ${t.viewProfile}`}
                        onPress={() => p.author?.username && openProfileAnywhere(p.author.username)}
                        hitSlop={8}
                      >
                        <Text style={[sans(700), { fontSize: 9, lineHeight: 12, letterSpacing: 1.8, textTransform: "uppercase", textDecorationLine: "underline", color: modern ? color("ink") : fc.ink }]}>
                          {authorName}
                        </Text>
                      </Pressable>
                      <Text style={[sans(700), { fontSize: 9, lineHeight: 12, letterSpacing: 1.8, textTransform: "uppercase", color: modern ? color("ink", "inkDim") : fc.ink }]}>
                        {timeLabel(p.created_at, t, lang)}
                      </Text>
                    </View>
                    <Text accessibilityRole="header" style={[modern ? sans(400) : serif(), { fontSize: modern ? 30 : 38, lineHeight: modern ? 33 : 40, letterSpacing: modern ? -1.1 : -0.3, color: modern ? color("ink") : fc.ink }]}>
                      {card.title}
                    </Text>
                    {card.caption ? (
                      <Text style={[serif(true), { fontSize: 18, lineHeight: 23, color: modern ? color("ink", "inkDim") : fc.ink }]}>{card.caption}</Text>
                    ) : null}
                    {p.body_text && card.media.kind !== "tekst" && p.body_text.trim() !== (p.caption ?? "").trim() ? (
                      <Text style={[serif(), { fontSize: 17, lineHeight: 23, color: modern ? color("ink") : fc.ink }]}>{p.body_text}</Text>
                    ) : null}
                  </>
                )}
              </View>

              <View style={{ paddingHorizontal: 24, paddingTop: 12, gap: 10 }}>
                <ActionRow
                  likes={likes}
                  commentCount={m.total}
                  drawerOpen={drawer}
                  onDrawer={() => setDrawer((v) => !v)}
                  onComments={() => inputRef.current?.focus()}
                  right={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                      {canEvent ? <UnderlinedAction label={`◷ ${t.event}`} onPress={() => router.push("/event-create")} /> : null}
                      {!own ? (
                        <UnderlinedAction
                          label={t.privateMsg}
                          onPress={() => setSheet({ friendId: p.user_id, friendName: authorName, quote: card.caption || card.title, postId: p.id, postTitle: card.title })}
                        />
                      ) : null}
                    </View>
                  }
                />
                {drawer ? <EmojiDrawer mine={likes.mine} onPick={likes.toggle} onClose={() => setDrawer(false)} /> : null}
                <LikedBy likes={likes} onOpen={() => setPanel(true)} />
              </View>

              <View style={{ paddingHorizontal: 24, marginTop: 14 }}>
                <CommentsHead m={m} count={m.total} />
                {m.rootCount === 0 && !m.isLoading && m.pendingFor(null).length === 0 ? (
                  <Text style={[serif(true), { paddingVertical: 18, fontSize: 18, lineHeight: 23, color: color("ink", "inkDim") }]}>{t.firstComment}</Text>
                ) : null}
                <CommentList m={m} myUserId={myUserId} onReply={reply} highlightId={typeof highlight === "string" ? highlight : null} />
              </View>
            </>
          )}
          </View>
          </CommentScrollProvider>
        </ScrollView>

        <ComposeBar
          inputRef={inputRef}
          value={draft}
          onChange={setDraft}
          onSend={() => send()}
          placeholder={replyTo ? t.replyPh.replace("{name}", replyName) : t.writeComment}
          boxOpen={boxOpen}
          onToggleBox={() => setBoxOpen((v) => !v)}
          above={
            <>
              {replyTo ? <ReplyStrip label={t.replyTo} name={replyName} onCancel={() => setReplyTo(null)} /> : null}
              {boxOpen ? (
                <ReactBox
                  onClose={() => setBoxOpen(false)}
                  // In de schrijfbalk voegt een emoji toe aan de tekst (HANDOFF).
                  onEmoji={(e) => setDraft((d) => d + e)}
                  onImage={(uri) => send(uri)}
                  active={EMPTY}
                />
              ) : null}
            </>
          }
        />
      </KeyboardAvoidingView>
      <LikesPanel likes={likes} visible={panel} onClose={() => setPanel(false)} />
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

const EMPTY = new Set<string>();

