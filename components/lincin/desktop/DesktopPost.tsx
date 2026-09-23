import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle, type ViewStyle } from "react-native";

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
import { EmojiSuggestions, useEmojiSuggest } from "@/components/lincin/ComposeBar";
import { ON_DARK, RASTER, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { COMMENTS_W } from "@/lib/lincin/desktop";
import { displayName, fromPost, hhmm, timeLabel } from "@/lib/lincin/model";
import { useMeasure } from "@/lib/lincin/measure";
import { useImageRatio } from "@/lib/lincin/ratio";
import { useCommentReactions, usePostReactions } from "@/lib/lincin/reactions";
import { useReactionWho } from "@/lib/lincin/reactors";
import { safeBack, useBackTarget } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

import { CloseBox, DesktopShell, MonoLink, TopBar } from "./Shell";

/**
 * Een bijdrage op desktop (desktop-*-home.dc.html, BIJDRAGE; handoff 23 sep).
 *
 * Een pagina die scrolt: links het beeld (560 kleur, 600 magazine, 620
 * modern) met daaronder titel, bijschrift, tekst en de reacties; rechts een
 * kolom van 440 met de comments en een invoer onderaan.
 *
 *   kleur     een balk van 56 met "← Feed", de regel over de bijdrage en ×;
 *             de kleurrug van 34 met soort en tijd; Bericht als inktvlak.
 *   magazine  "← Feed" als pil op het beeld, de rug van 5, een serif-titel
 *             van 80; de comments op het tweede vlak, de invoer een lijn.
 *   modern    een ronde terugknop op het beeld; alles tegels, de comments
 *             als kleine tegels, de invoer een pil.
 *
 * Een album heeft pijlen en streepjes; een tik opent de lichtbak. Escape
 * sluit (tenzij de lichtbak openstaat).
 */

/** Het reactievak van de bijdrage (prototype `emojiGrid`). */
const POST_EMOJI = ["🔥", "❤️", "😂", "😮", "🥹", "👏", "🌊", "✨"];
const ON_IMAGE = ON_DARK;

export function DesktopPost({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
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
  const emoji = useEmojiSuggest(draft, setDraft);
  const [sending, setSending] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  const [slide, setSlide] = useState(0);
  const { ref: stageRef, size: stage, onLayout: onStageLayout } = useMeasure();
  const [editing, setEditing] = useState(false);

  const close = () => safeBack(router, "/feed");
  const back = useBackTarget(router, "/feed");

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

  if (!p || !card) {
    return (
      <DesktopShell active="feed">
        <TopBar left={<MonoLink label={`← ${back.label}`} active onPress={back.go} />} right={<CloseBox label={t.cancel} onPress={close} />} />
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim, padding: 24 }]}>
          {post.isLoading ? t.loading : t.failed}
        </Text>
      </DesktopShell>
    );
  }

  const th = spec.id;
  const modern = th === "modern";
  const mag = th === "magazine";
  const kleur = th === "kleur";
  const stageH = kleur ? 560 : mag ? 600 : 620;
  const meta = `№ ${number ?? "—"} · ${authorName} · ${card.kind} · ${timeLabel(p.created_at, t, lang)}`;
  const privTarget = (): PrivateTarget => ({ friendId: p.user_id, friendName: authorName, quote: card.caption || card.title, postId: p.id, postTitle: card.title });
  const lbl = (size: number, c: string, spacing = size * 0.16): TextStyle =>
    mag
      ? { ...sans(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: size * 0.2, textTransform: "uppercase", color: c }
      : { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: spacing, textTransform: "uppercase", color: c };
  const tile = { borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill"), overflow: "hidden" as const };

  const arrow = (glyph: string, d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d < 0 ? "Vorige foto" : "Volgende foto"}
      onPress={() => setSlide((i) => (i + d + n) % n)}
      style={{ width: 44, height: 44, borderRadius: kleur ? 0 : 22, borderWidth: kleur ? 1.5 : 0, borderColor: "rgba(242,239,232,.7)", backgroundColor: "rgba(10,10,9,.45)", alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 18, lineHeight: 22, color: ON_IMAGE }}>{glyph}</Text>
    </Pressable>
  );

  // ---- eigen bijdrage: bewerken en verwijderen ----
  const ownActions = own ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      {multi ? <MonoLink label={`${two(slide + 1)} / ${two(n)}`} on={false} /> : null}
      {!editing ? <MonoLink label={t.editPost} active onPress={() => setEditing(true)} /> : null}
      <MonoLink label="Verwijder" tone={color("red")} active onPress={remove} />
    </View>
  ) : multi ? (
    <MonoLink label={`${two(slide + 1)} / ${two(n)}`} on={false} />
  ) : null;

  // ---- het beeld ----
  const stageBg = photos ? color("paper2") : kleur ? color("paper2") : fc.fill;
  const stageInk = photos || kleur ? ink : fc.ink;
  const stageView = (
    <View
      style={[
        { height: stageH, overflow: "hidden", backgroundColor: stageBg },
        modern ? { borderRadius: RASTER.tileRadius } : null,
        kleur ? { borderBottomWidth: spec.border, borderBottomColor: ink } : null,
        Platform.OS === "web" ? ({ animationKeyframes: RISE, animationDuration: "300ms", animationTimingFunction: "cubic-bezier(.2,.7,.2,1)" } as object) : null,
      ]}
      ref={stageRef}
      onLayout={onStageLayout}
    >
      {stage.h > 0 && photos ? (
        <>
          {/* De hele foto in zijn eigen verhouding, zo groot als het vlak toelaat. */}
          <View style={{ position: "absolute", left: (stage.w - frame.w) / 2, top: (stage.h - frame.h) / 2, width: frame.w, height: frame.h, overflow: "hidden" }}>
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
              <View style={{ pointerEvents: "box-none", position: "absolute", left: kleur ? 52 : 18, right: 18, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                {arrow("‹", -1)}
                {arrow("›", 1)}
              </View>
              <Dashes n={n} active={slide} bottom={14} gap={6} activeW={20} restW={7} />
            </>
          ) : null}
        </>
      ) : stage.h > 0 ? (
        // Geen foto: de tekst groot op het vlak, of het medium zelf (poll, muziek, link…).
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 40, paddingLeft: kleur ? 34 + 48 : mag ? 80 : 72, paddingRight: 48 }}>
          {card.media.kind === "tekst" ? (
            <Text selectable style={[mag ? serif(true) : modern ? sans(400) : serif(), { maxWidth: 820, fontSize: mag ? 48 : 44, lineHeight: mag ? 53 : 49, letterSpacing: modern ? -1.3 : 0, color: stageInk }]}>
              {card.media.text}
            </Text>
          ) : (
            <View style={[{ maxWidth: 720, overflow: "hidden", backgroundColor: color("paper") }, modern ? { borderRadius: 14 } : { borderWidth: spec.border, borderColor: ink }]}>
              <Media media={card.media} height={Math.min(300, stage.h - 80)} hue={hue} postId={p.id} myUserId={myUserId} size="page" />
            </View>
          )}
        </ScrollView>
      ) : null}

      {/* kleur: de kleurrug van 34 met soort en tijd; magazine: de rug van 5 */}
      {kleur ? (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 34, backgroundColor: fc.fill, borderRightWidth: spec.border, borderRightColor: ink, alignItems: "center", justifyContent: "flex-end", paddingBottom: 14 }}>
          <Vertical text={`${card.kind} · ${timeLabel(p.created_at, t, lang)}`} color={fc.ink} length={stageH - 40} />
        </View>
      ) : null}
      {mag ? <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: fc.fill }} /> : null}
      {mag ? (
        <Pressable
          accessibilityRole="button"
          onPress={back.go}
          style={{ position: "absolute", top: 20, left: 28, height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: "center", backgroundColor: "rgba(16,16,12,.55)" }}
        >
          <Text style={lbl(10, "#F7F4EE")}>← {back.label}</Text>
        </Pressable>
      ) : null}
      {modern ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={back.label}
          onPress={back.go}
          style={{ position: "absolute", top: 18, left: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: ink, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 16, lineHeight: 19, color: color("paper") }}>‹</Text>
        </Pressable>
      ) : null}
    </View>
  );

  // ---- de reacties op de bijdrage ----
  const reactChip = (on: boolean): ViewStyle =>
    modern
      ? { height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? ink : color("paper") }
      : mag
        ? { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: on ? ink : color("ink", "postRule"), backgroundColor: on ? ink : "transparent" }
        : { height: 34, paddingHorizontal: 10, borderWidth: spec.border, borderColor: ink, backgroundColor: on ? ink : "transparent" };
  const reactRow = (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
      {grouped.map((r) => (
        <Pressable
          key={r.emoji}
          accessibilityRole="button"
          {...who.chip(r)}
          accessibilityState={{ selected: r.mine }}
          onPress={() => reactions.toggle(id, r.emoji)}
          style={[reactChip(r.mine), { flexDirection: "row", alignItems: "center", gap: 6 }]}
        >
          <Text style={[kleur ? mono(600) : sans(500), { fontSize: modern ? 13 : 12, lineHeight: 16, color: r.mine ? color("paper") : ink }]}>
            {r.emoji} {r.count}
          </Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reageer"
        accessibilityState={{ expanded: boxOpen }}
        onPress={() => setBoxOpen((v) => !v)}
        style={[reactChip(boxOpen), { justifyContent: "center" }, kleur ? { borderStyle: "dashed" } : null]}
      >
        <Text style={[mono(600), { fontSize: 15, lineHeight: 18, color: boxOpen ? color("paper") : ink }]}>☺ +</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {own ? null : kleur ? (
        <Pressable accessibilityRole="button" onPress={() => setSheet(privTarget())} style={{ height: 40, paddingHorizontal: 16, justifyContent: "center", backgroundColor: ink }}>
          <Text style={lbl(11, color("paper"), 0.88)}>
            {t.privateMsg} · {authorName}
          </Text>
        </Pressable>
      ) : mag ? (
        <Pressable accessibilityRole="button" onPress={() => setSheet(privTarget())}>
          <Text style={[serif(), { fontSize: 19, lineHeight: 24, color: ink, textDecorationLine: "underline" }]}>
            {t.privateMsg} · {authorName}
          </Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setSheet(privTarget())} style={{ height: 44, paddingHorizontal: 20, borderRadius: 999, justifyContent: "center", backgroundColor: ink }}>
          <Text style={lbl(10, color("paper"), 1.2)}>
            {t.privateMsg} · {authorName}
          </Text>
        </Pressable>
      )}
    </View>
  );

  // ---- titel, zin, tekst ----
  const textBlock = (
    <View
      style={[
        { gap: kleur ? 14 : mag ? 16 : 14 },
        kleur ? { paddingTop: 28, paddingRight: 32, paddingBottom: 32, paddingLeft: 66 } : null,
        mag ? { paddingTop: 30, paddingRight: 32, paddingBottom: 34, paddingLeft: 27, borderLeftWidth: 5, borderLeftColor: fc.fill } : null,
        modern ? { ...tile, paddingVertical: 28, paddingHorizontal: 30 } : null,
      ]}
    >
      {kleur ? null : <Text style={lbl(mag ? 10 : 9, dim)}>{meta}</Text>}
      {editing ? (
        <View style={{ maxWidth: 720 }}>
          <EditPost post={p} onDone={() => setEditing(false)} />
        </View>
      ) : (
        <>
          <Text
            style={[
              kleur ? head() : mag ? serif() : sans(400),
              kleur
                ? { fontSize: 64, lineHeight: 56, letterSpacing: -0.64, color: ink }
                : mag
                  ? { fontSize: 80, lineHeight: 74, letterSpacing: -2.4, color: ink }
                  : { fontSize: 56, lineHeight: 57, letterSpacing: -2.24, color: ink },
            ]}
          >
            {card.title}
          </Text>
          {card.caption ? (
            <Text
              style={[
                modern ? sans(400) : serif(mag),
                { maxWidth: 760, fontSize: modern ? 20 : 24, lineHeight: modern ? 28 : mag ? 32 : 29, color: modern ? dim : ink },
              ]}
            >
              {card.caption}
            </Text>
          ) : null}
          {card.body && card.body !== card.caption ? (
            <Text selectable style={[sans(), { maxWidth: 640, fontSize: modern ? 20 : 15, lineHeight: modern ? 28 : 23, color: dim }]}>
              {card.body}
            </Text>
          ) : null}
        </>
      )}
      {reactRow}
      <WhoReacted line={who.line} />
      {boxOpen ? (
        <View style={{ flexDirection: "row", gap: 4, padding: 4, alignSelf: "flex-start", ...(kleur ? { borderWidth: 1.5, borderColor: ink } : { borderRadius: 999, backgroundColor: color("ink", "postRule") }) }}>
          {POST_EMOJI.map((e) => {
            const on = grouped.some((g) => g.emoji === e && g.mine);
            return (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={e}
                accessibilityState={{ selected: on }}
                onPress={() => reactions.toggle(id, e)}
                style={{ width: 34, height: 34, borderRadius: kleur ? 0 : 17, alignItems: "center", justifyContent: "center", backgroundColor: on ? (kleur ? color("acid") : ink) : kleur ? color("paper") : "transparent" }}
              >
                <Text style={{ fontSize: 18, lineHeight: 22 }}>{e}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {p.author?.username ? (
        <View style={{ flexDirection: "row" }}>
          <MonoLink label={`${t.profileOf} ${authorName} →`} active onPress={() => router.push(`/user/${p.author!.username}` as never)} />
        </View>
      ) : null}
    </View>
  );

  // ---- de comments ----
  const count = comments.data?.length ?? p.comment_count ?? 0;
  const commentsColumn = (
    <View
      style={[
        { width: COMMENTS_W, minHeight: kleur ? 780 : 900 },
        kleur ? { borderLeftWidth: 0 } : null,
        mag ? { backgroundColor: color("paper2") } : null,
        modern ? tile : null,
      ]}
    >
      {kleur ? (
        <View style={{ paddingTop: 20, paddingHorizontal: 24, paddingBottom: 14, borderBottomWidth: spec.border, borderBottomColor: ink }}>
          <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase", color: ink }]}>
            {t.comments} · {count}
          </Text>
        </View>
      ) : (
        <View
          style={[
            { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
            mag ? { paddingTop: 26, paddingHorizontal: 28, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: rule } : { paddingVertical: 22, paddingHorizontal: 24 },
          ]}
        >
          <Text style={[mag ? serif() : sans(500), { fontSize: mag ? 32 : 22, lineHeight: mag ? 32 : 26, letterSpacing: mag ? 0 : -0.44, color: ink }]}>{t.comments}</Text>
          <Text style={lbl(9, dim)}>{count}</Text>
        </View>
      )}
      <View style={modern ? { gap: 6, paddingHorizontal: 10 } : null}>
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
      </View>
      {count === 0 && !comments.isLoading ? (
        <Text style={[mag || kleur ? serif(true) : sans(400), { padding: modern ? 24 : mag ? 28 : 24, paddingTop: modern ? 0 : 24, fontSize: modern ? 16 : mag ? 20 : 18, lineHeight: 24, color: dim }]}>
          {t.firstComment}
        </Text>
      ) : null}
      <View style={{ marginTop: "auto" }}>
        <EmojiSuggestions list={emoji.list} onPick={emoji.apply} round={!kleur} pad={20} />
        <View
          style={[
            { flexDirection: "row", alignItems: "center" },
            kleur ? { height: 48, borderTopWidth: spec.border, borderTopColor: ink } : null,
            mag ? { gap: 12, paddingTop: 18, paddingHorizontal: 28, paddingBottom: 24, borderTopWidth: 1, borderTopColor: rule } : null,
            modern ? { margin: 10, height: 56, gap: 8, paddingLeft: 20, paddingRight: 6, borderRadius: 999, backgroundColor: color("paper") } : null,
          ]}
        >
          {kleur ? (
            <View style={{ width: 48, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRightWidth: spec.border, borderRightColor: ink }}>
              <Text style={{ fontSize: 18, lineHeight: 22, color: ink }}>☺</Text>
            </View>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={emoji.onChangeText}
            onKeyPress={emoji.onKeyPress}
            onSubmitEditing={send}
            blurOnSubmit={false}
            placeholder={mag || modern ? t.writeBack : t.writeComment}
            placeholderTextColor={dim}
            style={[
              mag ? serif(true) : sans(),
              { flex: 1, minWidth: 0, alignSelf: "stretch", fontSize: mag ? 19 : 14, color: ink },
              kleur ? { paddingHorizontal: 14 } : null,
              mag ? { height: 44, borderBottomWidth: 1, borderBottomColor: ink } : null,
              Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.comment}
            onPress={send}
            disabled={sending || !draft.trim()}
            style={{
              width: kleur ? 48 : 44,
              height: kleur ? undefined : 44,
              alignSelf: kleur ? "stretch" : "auto",
              borderRadius: kleur ? 0 : 22,
              backgroundColor: ink,
              alignItems: "center",
              justifyContent: "center",
              opacity: sending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 17, lineHeight: 20, color: color("paper") }}>↑</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <DesktopShell active="feed" tint={fc.fill} tabTint={fc.fill}>
      {kleur ? (
        // Kleur: een balk van 56 met "← Per vriend", de regel over de bijdrage en ×.
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 32, borderBottomWidth: spec.border, borderBottomColor: ink }}>
          <Pressable accessibilityRole="button" onPress={back.go} style={{ height: 34, paddingHorizontal: 12, justifyContent: "center", borderWidth: spec.border, borderColor: ink }}>
            <Text style={[mono(600), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase", color: ink }]}>← {back.label}</Text>
          </Pressable>
          <Text numberOfLines={1} style={[lbl(10, dim, 1), { flexShrink: 1 }]}>
            {t.post} {meta}
          </Text>
          <View style={{ flex: 1 }} />
          {ownActions}
          <Pressable accessibilityRole="button" accessibilityLabel={t.cancel} onPress={close} style={{ width: 34, height: 34, borderWidth: spec.border, borderColor: ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, lineHeight: 19, color: ink }}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {!kleur && own ? <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 24, paddingVertical: 10 }}>{ownActions}</View> : null}
        <View style={[{ flexDirection: "row", alignItems: "stretch" }, mag ? { gap: 6, padding: 6 } : null, modern ? { gap: 6 } : null]}>
          <View style={[{ flex: 1, minWidth: 0 }, kleur ? { borderRightWidth: spec.border, borderRightColor: ink } : { gap: 6 }]}>
            {stageView}
            {textBlock}
          </View>
          {commentsColumn}
        </View>
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

/** Een regel die van onder naar boven leest, in de kleurrug. */
function Vertical({ text, color: c, length }: { text: string; color: string; length: number }) {
  const style: TextStyle = { ...mono(600), fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: c };
  if (Platform.OS === "web") {
    return (
      <Text numberOfLines={1} style={[style, { maxHeight: length, writingMode: "vertical-rl", transform: [{ rotate: "180deg" }] } as TextStyle]}>
        {text}
      </Text>
    );
  }
  return (
    <View style={{ width: 14, height: length, alignItems: "center", justifyContent: "flex-end" }}>
      <Text numberOfLines={1} style={[style, { width: length, transform: [{ rotate: "-90deg" }] }]}>
        {text}
      </Text>
    </View>
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
  const th = useThemeSpec().id;
  const modern = th === "modern";
  const mag = th === "magazine";
  // Een naam opent een profiel — ook "Jij" het jouwe.
  const toProfile = c.author?.username ? () => router.push(`/user/${c.author!.username}` as never) : undefined;
  const size = modern ? 40 : mag ? 32 : 30;
  const when = timeLabel(c.created_at, t, lang);
  return (
    <View
      style={[
        { flexDirection: "row", gap: modern ? 12 : mag ? 14 : 12 },
        modern
          ? { padding: 14, borderRadius: 14, backgroundColor: color("paper") }
          : { paddingVertical: mag ? 18 : 16, paddingHorizontal: mag ? 28 : 24, borderBottomWidth: 1, borderBottomColor: color("ink", "postRule") },
      ]}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={name}
        onPress={toProfile}
        disabled={!toProfile}
        style={{
          width: size,
          height: size,
          borderRadius: modern ? 12 : size / 2,
          backgroundColor: mag ? "transparent" : fc.fill,
          borderWidth: mag ? 1 : 0,
          borderColor: fc.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[mag ? serif() : sans(700), { fontSize: mag ? 17 : modern ? 14 : 12, lineHeight: mag ? 20 : 16, color: mag ? fc.fill : fc.ink }]}>
          {name.slice(0, 1).toUpperCase()}
        </Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {mag || modern ? (
          <Text numberOfLines={1} onPress={toProfile} style={[mag ? sans(500) : mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: mag ? 1.8 : 1.44, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
            {name} · {when}
          </Text>
        ) : (
          <Text numberOfLines={1} onPress={toProfile} style={[mono(600), { fontSize: 12, lineHeight: 15, color: color("ink") }]}>
            {name} <Text style={[mono(500), { color: color("ink", "inkDim") }]}>· {when}</Text>
          </Text>
        )}
        {c.image_url ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t.gifNote}, ${name}`}
            onPress={() => openCommentImage(c, name)}
            style={[
              { width: 160, height: 110, marginTop: 4, backgroundColor: color("paper2"), overflow: "hidden" },
              th === "kleur" ? { borderWidth: 1.5, borderColor: color("ink") } : { borderRadius: 12 },
              Platform.OS === "web" ? ({ cursor: "zoom-in" } as object) : null,
            ]}
          >
            <SafeImage uri={c.image_url} cacheKey={c.image_path ?? undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          </Pressable>
        ) : null}
        {c.body ? (
          <Text style={[mag ? serif() : sans(), { fontSize: mag ? 20 : 15, lineHeight: mag ? 26 : 21, color: color("ink") }]}>{c.body}</Text>
        ) : null}
        <CommentReactions reactions={reactions} onToggle={onToggle} open={open} onOpenChange={onOpenChange} />
      </View>
    </View>
  );
}
