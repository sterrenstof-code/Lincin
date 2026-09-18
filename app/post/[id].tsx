import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen, TopRow } from "@/components/lincin/Chrome";
import { ComposeBar, ReactBox } from "@/components/lincin/ComposeBar";
import { Media } from "@/components/lincin/Media";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
import { useFeedCard } from "@/components/lincin/feed/useFeed";
import { BackChip, BORDER, Body, Box, GAP, GUTTER, Head, Initial, Mono, Serif, VerticalLabel, line } from "@/components/lincin/ui";
import {
  addEntityComment,
  listEntityComments,
  subscribeToEntityComments,
} from "@/lib/api/entity-comments";
import { deletePost, getPost, type PostWithAuthor } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, friendColor, hueFor, useHueChoices, useScheme } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { displayName, fromPost, hhmm } from "@/lib/lincin/model";
import { useMeasure } from "@/lib/lincin/measure";
import { useCommentReactions, usePostReactions } from "@/lib/lincin/reactions";
import { CommentReactions } from "@/components/lincin/CommentReactions";
import { CommentRow } from "@/components/lincin/CommentRow";
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
 * plannen valt, `PRIVAAT BERICHT`, en de comments. Onderaan de balk met
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
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  // Ingebed komt het id als prop; als scherm uit de route.
  const id = idProp ?? String(raw ?? "");
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
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
  const comments = useQuery({
    queryKey: ["entity-comments", "post", id],
    queryFn: () => listEntityComments("post", id),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    markSeen(id);
    const ch = subscribeToEntityComments("post", id, () => comments.refetch());
    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const p = post.data ?? null;
  const card = useMemo(() => (p ? fromPost(p) : null), [p]);
  /** "№ 07": hetzelfde nummer als in de feed, ook bij een rechtstreekse URL. */
  const { number } = useFeedCard(id);
  usePageTitle(card?.title ?? null);
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const hue = hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);
  const reactions = usePostReactions(useMemo(() => (id ? [id] : []), [id]), myUserId);
  const grouped = reactions.grouped(id);
  const mine = useMemo(() => new Set(grouped.filter((g) => g.mine).map((g) => g.emoji)), [grouped]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  const commentIds = useMemo(() => (comments.data ?? []).map((c) => c.id), [comments.data]);
  const commentReactions = useCommentReactions(commentIds, myUserId);
  /** Welke comment zijn ☺-kiezer open heeft — één tegelijk. */
  const [pickOpen, setPickOpen] = useState<string | null>(null);

  async function send(imageUri?: string) {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body && !imageUri) return;
    setSending(true);
    try {
      await addEntityComment({ entityType: "post", entityId: id, userId: myUserId, body, ownerId: p.user_id, imageUri });
      setDraft("");
      setBoxOpen(false);
      await comments.refetch();
      invalidatePostCaches(qc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSending(false);
    }
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
  const zoom = p && card ? { number, author: authorName, kind: card.kind, time: hhmm(p.created_at), title: card.title } : undefined;

  return (
    <LincinScreen
      tab="feed"
      tint={p ? fc.fill : null}
      counter={t.post}
      embedded={embedded}
      header={
        <TopRow
          left={<BackChip label={`← ${t.back}`} onPress={() => safeBack(router, "/feed")} />}
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, gap: GAP }} showsVerticalScrollIndicator={false}>
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
              {/* Een foto zoals Instagram: rand tot rand over het scherm, de
                  hoogte uit zijn eigen verhouding (4:5–1.91:1). */}
              {photo ? (
                <View style={{ marginHorizontal: -GUTTER, marginBottom: -GAP }}>
                  <Media
                    media={card.media}
                    height={MEDIA_H}
                    hue={hue}
                    postId={p.id}
                    myUserId={myUserId}
                    size="page"
                    photoFit="ratio"
                    zoom={zoom}
                  />
                </View>
              ) : null}
              <Box>
                {/* beeld met kleurstrook — de andere soorten */}
                {photo ? null : (
                <View
                  ref={mediaRef}
                  onLayout={onMediaLayout}
                  // Een tekst staat er helemaal, zo lang als hij is; de rest op 300.
                  style={{ flexDirection: "row", ...(fullText ? { minHeight: MEDIA_H } : { height: MEDIA_H }) }}
                >
                  <View
                    style={{
                      width: STRIP_W,
                      backgroundColor: fc.fill,
                      borderRightWidth: BORDER,
                      borderRightColor: line(),
                      overflow: "hidden",
                    }}
                  >
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
                      <Media
                        media={card.media}
                        height={MEDIA_H}
                        hue={hue}
                        postId={p.id}
                        myUserId={myUserId}
                        size="page"
                        zoom={zoom}
                      />
                    )}
                  </View>
                </View>
                )}
                {/* tekst — of, bij je eigen bijdrage, het bewerkvak */}
                <View style={{ padding: 14, gap: 10, borderTopWidth: photo ? 0 : BORDER, borderTopColor: line() }}>
                  {editing ? (
                    <EditPost post={p} onDone={() => setEditing(false)} />
                  ) : (
                  <>
                  <Head variant="postTitle">{card.title}</Head>
                  {card.caption ? <Serif variant="quoteLarge">{card.caption}</Serif> : null}
                  {p.body_text && card.media.kind !== "tekst" && p.body_text.trim() !== (p.caption ?? "").trim() ? (
                    <Body small tone="dim">
                      {p.body_text}
                    </Body>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${authorName}, ${t.viewProfile}`}
                    onPress={() => p.author?.username && openProfileAnywhere(p.author.username)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}
                  >
                    <Initial letter={authorName.slice(0, 1).toUpperCase()} size={28} bg={fc.fill} fg={fc.ink} border={false} fontSize={12} />
                    <Text style={[lincinType.meta, { textTransform: "none", textDecorationLine: "underline", color: color("ink") }]}>
                      {authorName}
                    </Text>
                    <Mono variant="meta" tone="dim" style={{ textTransform: "none" }}>
                      · {t.viewProfile}
                    </Mono>
                  </Pressable>
                  </>
                  )}
                </View>
              </Box>

              {/* De actierij staat lós onder de kaart (prototype §02): reacties
                  van 34 zonder kader, dan ◷ EVENT en PRIVAAT BERICHT. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  {grouped.map((g) => (
                    <Pressable
                      key={g.emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.emoji} ${g.count}`}
                      accessibilityState={{ selected: g.mine }}
                      onPress={() => reactions.toggle(id, g.emoji)}
                      style={{
                        height: 34,
                        paddingHorizontal: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: g.mine ? color("ink") : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 13, lineHeight: 16, color: g.mine ? color("paper") : color("ink") }}>{g.emoji}</Text>
                      <Text style={[lincinType.monoBody, { fontSize: 13, lineHeight: 16, color: g.mine ? color("paper") : color("ink") }]}>{g.count}</Text>
                    </Pressable>
                  ))}
                  <View style={{ flex: 1 }} />
                  {canEvent ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push("/event-create")}
                      style={{
                        height: 34,
                        paddingHorizontal: 10,
                        borderWidth: 1.5,
                        borderStyle: "dashed",
                        borderColor: line(),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Mono variant="action">◷ {t.event}</Mono>
                    </Pressable>
                  ) : null}
                  {!own ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setSheet({
                          friendId: p.user_id,
                          friendName: authorName,
                          quote: card.caption || card.title,
                          postId: p.id,
                          postTitle: card.title,
                        })
                      }
                      style={{ height: 34, paddingHorizontal: 11, backgroundColor: color("ink"), alignItems: "center", justifyContent: "center" }}
                    >
                      <Mono variant="monoBody" tone="paper">
                        {t.privateMsg}
                      </Mono>
                    </Pressable>
                  ) : null}
              </View>

              {/* comments */}
              <Mono variant="micro" tone="dim" style={{ marginTop: 6 }}>
                {t.comments} · {comments.data?.length ?? p.comment_count ?? 0}
              </Mono>
              {(comments.data ?? []).map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  myUserId={myUserId}
                  reactions={
                    <CommentReactions
                      reactions={commentReactions.grouped(c.id)}
                      onToggle={(emoji) => commentReactions.toggle(c.id, emoji)}
                      open={pickOpen === c.id}
                      onOpenChange={(o) => setPickOpen(o ? c.id : null)}
                    />
                  }
                />
              ))}
            </>
          )}
        </ScrollView>

        <ComposeBar
          value={draft}
          onChange={setDraft}
          onSend={() => send()}
          placeholder={t.writeComment}
          boxOpen={boxOpen}
          onToggleBox={() => setBoxOpen((v) => !v)}
          sending={sending}
          above={
            boxOpen ? (
              <ReactBox
                onClose={() => setBoxOpen(false)}
                onEmoji={(e) => reactions.toggle(id, e)}
                onImage={(uri) => send(uri)}
                active={mine}
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}
