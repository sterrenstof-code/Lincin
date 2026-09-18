import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Carousel, Dashes } from "@/components/lincin/Carousel";
import { CommentReactions } from "@/components/lincin/CommentReactions";
import { EditPost } from "@/components/lincin/EditPost";
import { useFeedCard } from "@/components/lincin/feed/useFeed";
import { isLightboxOpen, openCommentImage, openLightbox } from "@/components/lincin/Lightbox";
import { Media } from "@/components/lincin/Media";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
import { WhoReacted } from "@/components/lincin/WhoReacted";
import { SafeImage } from "@/components/SafeImage";
import { addEntityComment, listEntityComments, subscribeToEntityComments, type EntityComment } from "@/lib/api/entity-comments";
import { deletePost, getPost, type PostWithAuthor } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { COMMENTS_W } from "@/lib/lincin/desktop";
import { displayName, fromPost, hhmm, timeLabel } from "@/lib/lincin/model";
import { useMeasure } from "@/lib/lincin/measure";
import { useImageRatio } from "@/lib/lincin/ratio";
import { useCommentReactions, usePostReactions } from "@/lib/lincin/reactions";
import { useReactionWho } from "@/lib/lincin/reactors";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

import { CloseBox, DesktopShell, MonoLink, TopBar } from "./Shell";

/**
 * Een bijdrage op volle breedte (Lincin Desktop.dc.html, BIJDRAGE, VOLLE
 * BREEDTE — model 3d).
 *
 * De rail klapt in tot 64, de gesprekken rechts verdwijnen. Bovenaan een
 * balk van 56: `← Feed` en "Bijdrage № 01 · Noor · foto", rechts de teller,
 * PRIVAAT BERICHT en ×. Dan het beeld van rand tot rand, met ‹ › en
 * streepjes bij een album. Onderaan een band van hoogstens 300: links
 * titel, bijschrift, tekst, de reacties met ☺ en "Profiel van … →";
 * rechts een kolom van 420 met de comments — elk met zijn reacties — en
 * een invoer (Enter of ↑). `← Feed`, × of Escape sluit.
 */

/** Het reactievak van de bijdrage (prototype `emojiGrid`). */
const POST_EMOJI = ["🔥", "❤️", "😂", "😮", "🥹", "👏", "🌊", "✨"];
const ON_IMAGE = "#F2EFE8";

export function DesktopPost({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const scheme = useScheme();
  const spec = useThemeSpec();
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
  const comments = useQuery({ queryKey: ["entity-comments", "post", id], queryFn: () => listEntityComments("post", id), enabled: !!id });
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
  const { number } = useFeedCard(id);
  usePageTitle(card?.title ?? null);
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const hue = hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);
  const reactions = usePostReactions(useMemo(() => (id ? [id] : []), [id]), myUserId);
  const grouped = reactions.grouped(id);
  const who = useReactionWho(grouped);
  const commentIds = useMemo(() => (comments.data ?? []).map((c) => c.id), [comments.data]);
  const commentReactions = useCommentReactions(commentIds, myUserId);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  const [slide, setSlide] = useState(0);
  const { ref: stageRef, size: stage, onLayout: onStageLayout } = useMeasure();
  const [editing, setEditing] = useState(false);

  const close = () => safeBack(router, "/feed");

  // Escape sluit — tenzij de lichtbak openstaat; die gaat eerst dicht.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLightboxOpen() && !sheet) close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  async function send() {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await addEntityComment({ entityType: "post", entityId: id, userId: myUserId, body, ownerId: p.user_id });
      setDraft("");
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
    const ok = await confirm("Bijdrage verwijderen?", "Je vrienden zien hem dan niet meer.", { affirmativeLabel: "Verwijder", destructive: true });
    if (!ok) return;
    try {
      await deletePost(p);
      invalidatePostCaches(qc);
      router.replace("/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const own = !!p && p.user_id === myUserId;
  const authorName = p ? displayName(p.author) : "";
  const photos = card?.media.kind === "foto" ? card.media : null;
  const n = photos ? Math.max(1, photos.uris.length) : 1;
  const multi = n > 1;
  const ratio = useImageRatio(photos?.uris[0], photos?.cacheKeys[0]);
  const frame =
    stage.w / ratio <= stage.h
      ? { w: stage.w, h: Math.round(stage.w / ratio) }
      : { w: Math.round(stage.h * ratio), h: stage.h };
  const two = (x: number) => String(x).padStart(2, "0");

  const left = (
    <>
      <MonoLink label={`← ${t.tabFeed}`} active onPress={() => router.navigate("/feed")} />
      <MonoLink
        numberOfLines={1}
        label={`${t.post}${number ? ` № ${number}` : ""}${card ? ` · ${authorName} · ${card.kind}` : ""}`}
      />
    </>
  );
  const right = (
    <>
      {multi ? <MonoLink label={`${two(slide + 1)} / ${two(n)}`} on={false} /> : null}
      {own && !editing ? <MonoLink label={t.editPost} active onPress={() => setEditing(true)} /> : null}
      {own ? <MonoLink label="Verwijder" tone={color("red")} active onPress={remove} /> : null}
      {p && card && !own ? (
        <MonoLink
          label={t.privateMsg}
          active
          onPress={() => setSheet({ friendId: p.user_id, friendName: authorName, quote: card.caption || card.title, postId: p.id, postTitle: card.title })}
        />
      ) : null}
      <CloseBox label={t.cancel} onPress={close} />
    </>
  );

  if (!p || !card) {
    return (
      <DesktopShell active="feed" mode="full">
        <TopBar left={<MonoLink label={`← ${t.tabFeed}`} active onPress={() => router.navigate("/feed")} />} right={<CloseBox label={t.cancel} onPress={close} />} />
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim, padding: 24 }]}>
          {post.isLoading ? t.loading : t.failed}
        </Text>
      </DesktopShell>
    );
  }

  const arrow = (glyph: string, d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d < 0 ? "Vorige foto" : "Volgende foto"}
      onPress={() => setSlide((i) => (i + d + n) % n)}
      style={{ width: 44, height: 44, borderWidth: 1.5, borderColor: "rgba(242,239,232,.7)", backgroundColor: "rgba(10,10,9,.45)", alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 18, lineHeight: 22, color: ON_IMAGE }}>{glyph}</Text>
    </Pressable>
  );

  return (
    <DesktopShell active="feed" mode="full" tint={fc.fill}>
      <TopBar left={left} right={right} />

      {/* het beeld, van rand tot rand */}
      <View
        style={[{ flex: 1, minHeight: 0, overflow: "hidden" }, Platform.OS === "web" ? ({ animationKeyframes: RISE, animationDuration: "300ms", animationTimingFunction: "cubic-bezier(.2,.7,.2,1)" } as object) : null]}
        ref={stageRef}
        onLayout={onStageLayout}
      >
        {stage.h > 0 && photos ? (
          <>
            {/* Instagram op desktop: de hele foto in zijn eigen verhouding,
                zo groot als het venster toelaat, in het midden. */}
            <View style={{ position: "absolute", left: (stage.w - frame.w) / 2, top: (stage.h - frame.h) / 2, width: frame.w, height: frame.h }}>
            <Carousel
                uris={photos.uris}
                cacheKeys={photos.cacheKeys}
                height={frame.h}
                size="page"
                video={photos.video}
                bare
                index={slide}
                onIndex={setSlide}
                onZoom={(index) =>
                  openLightbox({ uris: photos.uris, cacheKeys: photos.cacheKeys, index, number, author: authorName, kind: card.kind, time: hhmm(p.created_at), title: card.title })
                }
              />
            </View>
            {multi ? (
              <>
                <View style={{ pointerEvents: "box-none", position: "absolute", left: 18, right: 18, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  {arrow("‹", -1)}
                  {arrow("›", 1)}
                </View>
                <Dashes n={n} active={slide} bottom={14} gap={6} activeW={20} restW={7} />
              </>
            ) : null}
          </>
        ) : stage.h > 0 ? (
          // Geen foto: een affiche in de kleur van de maker, met de titel
          // groot. Een tekst staat er helemaal onder, te lezen tot het eind
          // (het vlak scrolt); poll, muziek, link houden hun eigen medium.
          <ScrollView
            style={{ flex: 1, backgroundColor: fc.fill }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 }}
          >
            <View style={{ width: Math.min(720, stage.w - 48), gap: 20 }}>
              <Text style={[head(), { fontSize: 64, lineHeight: 60, letterSpacing: spec.serifHeads ? 0 : -0.64, color: fc.ink }]}>{card.title}</Text>
              {card.media.kind === "tekst" ? (
                <View style={{ borderWidth: spec.border, borderColor: ink, backgroundColor: color("paper"), paddingVertical: 22, paddingHorizontal: 26 }}>
                  <Text selectable style={[serif(), { fontSize: 20, lineHeight: 30, color: ink }]}>
                    {card.media.text}
                  </Text>
                </View>
              ) : (
                <View style={{ borderWidth: spec.border, borderColor: ink, backgroundColor: color("paper"), overflow: "hidden" }}>
                  <Media media={card.media} height={Math.min(260, stage.h - 110)} hue={hue} postId={p.id} myUserId={myUserId} size="page" />
                </View>
              )}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {/* de band onderaan: tekst en reacties links, comments rechts */}
      <View style={{ maxHeight: editing ? 560 : 300, flexDirection: "row", alignItems: "stretch", borderTopWidth: spec.border, borderTopColor: ink, backgroundColor: color("paper") }}>
        <ScrollView style={{ flex: 1, minWidth: 0 }} contentContainerStyle={{ flexGrow: 1, paddingTop: 16, paddingHorizontal: 22, paddingBottom: 18, gap: 8 }} showsVerticalScrollIndicator={false}>
          {editing ? (
            // Je eigen bijdrage bewerken: titel, zin, tekst (EditPost).
            <View style={{ maxWidth: 720 }}>
              <EditPost post={p} onDone={() => setEditing(false)} />
            </View>
          ) : (
            <>
              {photos ? (
                <Text style={[head(), { fontSize: 34, lineHeight: 31, letterSpacing: spec.serifHeads ? 0 : -0.34, color: ink }]}>{card.title}</Text>
              ) : null}
              {card.caption ? <Text style={[serif(), { fontSize: 19, lineHeight: 24, color: ink }]}>{card.caption}</Text> : null}
              {card.body && card.body !== card.caption ? <Text style={[sans(), { fontSize: 13.5, lineHeight: 20, color: dim, maxWidth: 640 }]}>{card.body}</Text> : null}
            </>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: "auto", paddingTop: 4 }}>
            {grouped.map((r) => (
              <Pressable
                key={r.emoji}
                accessibilityRole="button"
                {...who.chip(r)}
                accessibilityState={{ selected: r.mine }}
                onPress={() => reactions.toggle(id, r.emoji)}
                style={{ height: 34, justifyContent: "center", borderWidth: 1.5, borderColor: ink, backgroundColor: r.mine ? ink : "transparent", paddingHorizontal: 10 }}
              >
                <Text style={[mono(600), { fontSize: 12, lineHeight: 15, color: r.mine ? color("paper") : ink }]}>
                  {r.emoji} {r.count}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reageer"
              accessibilityState={{ expanded: boxOpen }}
              onPress={() => setBoxOpen((v) => !v)}
              // Zo groot als de reacties ernaast, in inkt: goed te zien.
              style={{ height: 34, justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: ink, backgroundColor: boxOpen ? ink : "transparent", paddingHorizontal: 12 }}
            >
              <Text style={[mono(600), { fontSize: 15, lineHeight: 18, color: boxOpen ? color("paper") : ink }]}>☺ +</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {p.author?.username ? (
              <MonoLink label={`${t.profileOf} ${authorName} →`} active onPress={() => router.push(`/user/${p.author!.username}` as never)} />
            ) : null}
          </View>
          <WhoReacted line={who.line} />
          {boxOpen ? (
            <View style={{ flexDirection: "row", gap: 4, borderWidth: 1.5, borderColor: ink, padding: 4, alignSelf: "flex-start" }}>
              {POST_EMOJI.map((e) => {
                const on = grouped.some((g) => g.emoji === e && g.mine);
                return (
                  <Pressable
                    key={e}
                    accessibilityRole="button"
                    accessibilityLabel={e}
                    accessibilityState={{ selected: on }}
                    onPress={() => reactions.toggle(id, e)}
                    style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: on ? color("acid") : color("paper") }}
                  >
                    <Text style={{ fontSize: 18, lineHeight: 22 }}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </ScrollView>

        <View style={{ width: COMMENTS_W, minHeight: 0, borderLeftWidth: 1, borderLeftColor: rule }}>
          <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 8 }]}>
            {t.comments} · {comments.data?.length ?? p.comment_count ?? 0}
          </Text>
          <ScrollView style={{ flexGrow: 0, flexShrink: 1, minHeight: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {(comments.data ?? []).map((c) => (
              <Comment
                key={c.id}
                comment={c}
                myUserId={myUserId}
                reactions={commentReactions.grouped(c.id)}
                onToggle={(emoji) => commentReactions.toggle(c.id, emoji)}
                open={pickOpen === c.id}
                onOpenChange={(o) => setPickOpen(o ? c.id : null)}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 18, borderTopWidth: 1, borderTopColor: rule, marginTop: "auto" }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={send}
              blurOnSubmit={false}
              placeholder={t.writeComment}
              placeholderTextColor={dim}
              style={[
                sans(),
                { flex: 1, minWidth: 0, height: 40, borderWidth: 1.5, borderColor: ink, paddingHorizontal: 12, fontSize: 14, color: ink },
                Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null,
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.comment}
              onPress={send}
              disabled={sending || !draft.trim()}
              style={{ width: 40, height: 40, backgroundColor: ink, alignItems: "center", justifyContent: "center", opacity: sending ? 0.6 : 1 }}
            >
              <Text style={{ fontSize: 16, lineHeight: 20, color: color("paper") }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

/** `@keyframes rise` uit het prototype: 16px omhoog en in beeld. */
const RISE = [{ "0%": { opacity: 0, transform: [{ translateY: 16 }] }, "100%": { opacity: 1, transform: [{ translateY: 0 }] } }];

function Comment({
  comment: c,
  myUserId,
  reactions,
  onToggle,
  open,
  onOpenChange,
}: {
  comment: EntityComment;
  myUserId: string;
  reactions: ReturnType<ReturnType<typeof useCommentReactions>["grouped"]>;
  onToggle: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const own = c.user_id === myUserId;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const fc = own ? { fill: color("ink"), ink: color("paper") } : friendColor(hueFor(c.user_id), scheme);
  const name = own ? t.me : displayName(c.author);
  const router = useRouter();
  // Een naam opent een profiel — ook "Jij" het jouwe.
  const toProfile = c.author?.username ? () => router.push(`/user/${c.author!.username}` as never) : undefined;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={name}
        onPress={toProfile}
        disabled={!toProfile}
        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={[head(), { fontSize: 11, lineHeight: 13, color: fc.ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} onPress={toProfile} style={[mono(600), { fontSize: 11, lineHeight: 14, color: color("ink"), flexShrink: 1 }]}>
            {name}
          </Text>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 14, color: color("ink", "inkDim") }]}>{timeLabel(c.created_at, t, lang)}</Text>
        </View>
        {c.image_url ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t.gifNote}, ${name}`}
            onPress={() => openCommentImage(c, name)}
            style={[
              { width: 160, height: 110, marginTop: 4, borderWidth: 1.5, borderColor: color("ink"), backgroundColor: color("paper2") },
              Platform.OS === "web" ? ({ cursor: "zoom-in" } as object) : null,
            ]}
          >
            <SafeImage uri={c.image_url} cacheKey={c.image_path ?? undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          </Pressable>
        ) : null}
        {c.body ? <Text style={[sans(), { fontSize: 14, lineHeight: 19.6, marginTop: 2, color: color("ink") }]}>{c.body}</Text> : null}
        <CommentReactions reactions={reactions} onToggle={onToggle} open={open} onOpenChange={onOpenChange} />
      </View>
    </View>
  );
}
