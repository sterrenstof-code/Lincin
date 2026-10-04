import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";

import { Carousel, Dashes } from "@/components/lincin/Carousel";
import { EmojiSuggestions, ReplyStrip, useComposeSuggest, useMultilineInput } from "@/components/lincin/ComposeBar";
import { EditPost } from "@/components/lincin/EditPost";
import { useFeedCard } from "@/components/lincin/feed/useFeed";
import { isLightboxOpen, openLightbox } from "@/components/lincin/Lightbox";
import { Media, useDoubleTap } from "@/components/lincin/Media";
import { MentionSuggestions } from "@/components/lincin/MentionSuggest";
import { CommentList, SortToggle } from "@/components/lincin/post/Comments";
import { ActionRow, EmojiDrawer, LikedBy, LikesPanel } from "@/components/lincin/post/Reactions";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
import type { EntityComment } from "@/lib/api/entity-comments";
import { deletePost, getPost, type PostWithAuthor } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { ON_DARK, OMSLAG, RASTER, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { useComments } from "@/lib/lincin/comments";
import { COMMENTS_W } from "@/lib/lincin/desktop";
import { useDraft } from "@/lib/lincin/drafts";
import { usePostLikes } from "@/lib/lincin/likes";
import { displayName, fromPost, hhmm, timeLabel } from "@/lib/lincin/model";
import { useMeasure } from "@/lib/lincin/measure";
import { useImageRatio } from "@/lib/lincin/ratio";
import { safeBack, useBackTarget } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

import { Black, SerifLink, lh } from "../magazine/Omslag";
import { CloseBox, DesktopShell, MonoLink, TopBar } from "./Shell";

/**
 * Een bijdrage op desktop (desktop-*-home.dc.html, BIJDRAGE; handoff 23 sep).
 *
 * Een pagina die scrolt: links het beeld (620) met daaronder titel, bijschrift, tekst en de reacties; rechts een
 * kolom van 440 met de comments en een invoer onderaan.
 *
 *   magazine  "← Feed" als pil op het beeld, de rug van 5, een serif-titel
 *             van 80; de comments op het tweede vlak, de invoer een lijn.
 *   modern    een ronde terugknop op het beeld; alles tegels, de comments
 *             als kleine tegels, de invoer een pil.
 *
 * Een album heeft pijlen en streepjes; een tik opent de lichtbak. Escape
 * sluit (tenzij de lichtbak openstaat).
 */

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
  const { c: highlight } = useLocalSearchParams<{ c?: string }>();
  useEffect(() => {
    if (id) markSeen(id);
  }, [id]);

  const p = post.data ?? null;
  const card = useMemo(() => (p ? fromPost(p) : null), [p]);
  const { number } = useFeedCard(id);
  usePageTitle(card?.title ?? null);
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  // De kleur die de maker koos, anders zijn eigen kleur.
  const hue = card?.swatch ?? hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);
  // Likes, emoji en reacties (Bijdrage Voorbeeld; desktop-magazine-home).
  const likes = usePostLikes(id || undefined, myUserId);
  const m = useComments({ entityType: "post", entityId: id || undefined, myUserId, ownerId: post.data?.user_id });
  const [panel, setPanel] = useState(false);
  const [replyTo, setReplyTo] = useState<EntityComment | null>(null);
  const inputRef = useRef<TextInput>(null);
  const doubleTap = useDoubleTap(() => likes.like());

  const [draft, setDraft, clearDraft] = useDraft(id ? `post:${id}` : null);
  const emoji = useComposeSuggest(draft, setDraft);
  // Magazine en modern 44: de hoogte van één regel invoer.
  const inputMinH = 44;
  const field = useMultilineInput({ value: draft, onSend: () => void send(), suggest: emoji, minH: inputMinH });
  const [boxOpen, setBoxOpen] = useState(false);
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
      if (e.key !== "Escape" || isLightboxOpen() || sheet) return;
      // In een invoerveld is Escape van het veld: een comment bewerken
      // annuleert ermee, en dat mocht niet ook de bijdrage sluiten.
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  function send() {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body) return;
    m.send({ body, parentId: replyTo?.id ?? null });
    clearDraft();
    setReplyTo(null);
    invalidatePostCaches(qc);
  }

  function reply(c: EntityComment) {
    const author = c.user_id === myUserId ? null : m.authorOf(c);
    setReplyTo(c);
    // Een antwoord op een antwoord begint met @naam (HANDOFF).
    if (c.parent_id && author?.username && !draft.includes(`@${author.username}`)) setDraft((d) => `@${author.username} ${d}`);
    m.setOpen(c.parent_id ?? c.id, true);
    inputRef.current?.focus();
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
  const stageH = 620;
  const meta = `№ ${number ?? "—"} · ${authorName} · ${card.kind} · ${timeLabel(p.created_at, t, lang)}`;
  const privTarget = (): PrivateTarget => ({ friendId: p.user_id, friendName: authorName, quote: card.caption || card.title, postId: p.id, postTitle: card.title });
  const lbl = (size: number, c: string, spacing = size * 0.16): TextStyle =>
    mag
      ? { ...sans(700), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: size * 0.1, textTransform: "uppercase", color: c }
      : { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: spacing, textTransform: "uppercase", color: c };
  const tile = { borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill"), overflow: "hidden" as const };

  const arrow = (glyph: string, d: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={d < 0 ? "Vorige foto" : "Volgende foto"}
      onPress={() => setSlide((i) => (i + d + n) % n)}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(10,10,9,.45)", alignItems: "center", justifyContent: "center" }}
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
  const stageBg = photos ? color("paper2") : fc.fill;
  const stageInk = photos ? ink : fc.ink;
  const stageView = (
    <View
      style={[
        { height: stageH, overflow: "hidden", backgroundColor: stageBg },
        modern ? { borderRadius: RASTER.tileRadius } : null,
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
                // Dubbelklik = like; een enkele klik opent de lichtbak.
                doubleTap(() =>
                  openLightbox({ uris: photos.uris, cacheKeys: photos.cacheKeys, index, number, author: authorName, kind: card.kind, time: hhmm(p.created_at), title: card.title }),
                )
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
        // Geen foto: de tekst groot op het vlak, of het medium zelf (poll, muziek, link…).
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: 96, paddingBottom: 40, paddingLeft: mag ? 80 : 72, paddingRight: 48 }}>
          {card.media.kind === "tekst" ? (
            (() => {
              // Groot als citaat zolang het kort is; een lange tekst is om te
              // lézen, dus kleiner, rechtop en met meer regelafstand. 56 over
              // tien regels was een affiche, geen brief.
              const len = card.media.text.length;
              const size = len <= 90 ? (mag ? 56 : 44) : len <= 260 ? (mag ? 36 : 32) : 22;
              const long = len > 260;
              return (
                <Text
                  selectable
                  style={[
                    mag ? serif(!long) : modern ? sans(400) : serif(),
                    { maxWidth: long ? 720 : mag ? 860 : 820, fontSize: size, lineHeight: Math.round(size * (long ? 1.45 : 1.08)), letterSpacing: modern && !long ? -1.3 : 0, color: stageInk },
                  ]}
                >
                  {card.media.text}
                </Text>
              );
            })()
          ) : (
            <View style={[{ maxWidth: 720, overflow: "hidden", backgroundColor: color("paper") }, modern ? { borderRadius: 14 } : { borderWidth: spec.border, borderColor: ink }]}>
              <Media media={card.media} height={Math.min(300, stage.h - 80)} hue={hue} postId={p.id} myUserId={myUserId} size="page" />
            </View>
          )}
        </ScrollView>
      ) : null}

      {/* magazine: de rug van 5 */}
      {mag ? <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: fc.fill }} /> : null}
      {mag ? (
        // De omslag: een inktvlak van 40 met "← Editie", en rechts het rode nummer.
        <>
          <Pressable
            accessibilityRole="button"
            onPress={back.go}
            style={{ position: "absolute", top: 20, left: 24, height: 40, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#16160F" }}
          >
            <Text style={lbl(11, "#F7F4EE")}>←</Text>
            <Text style={lbl(11, "#F7F4EE")}>{back.label}</Text>
          </Pressable>
          {number ? (
            <View style={{ pointerEvents: "none", position: "absolute", top: 20, right: 24 }}>
              <Black size={40} f={0.8} ls={-0.04}>
                № {number}
              </Black>
            </View>
          ) : null}
        </>
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

  // ---- de reacties op de bijdrage (desktop-magazine-home): hart, ☺, wie,
  // en rechts "Privé aan X". De lade en het paneel staan inline eronder. ----
  const privateLink = own ? null : mag ? (
    <SerifLink size={22} italic onPress={() => setSheet(privTarget())}>
      {t.omPrivateTo} {authorName}
    </SerifLink>
  ) : (
    <Pressable accessibilityRole="button" onPress={() => setSheet(privTarget())} style={{ height: 44, paddingHorizontal: 20, borderRadius: 999, justifyContent: "center", backgroundColor: ink }}>
      <Text style={lbl(10, color("paper"), 1.2)}>
        {t.privateMsg} · {authorName}
      </Text>
    </Pressable>
  );
  const reactRow = (
    <View style={{ gap: 12, marginTop: 6 }}>
      <ActionRow likes={likes} commentCount={m.total} drawerOpen={boxOpen} onDrawer={() => setBoxOpen((v) => !v)} onComments={() => inputRef.current?.focus()} right={privateLink} />
      {boxOpen ? (
        <View style={{ maxWidth: 6 * 64 + 54 }}>
          <EmojiDrawer mine={likes.mine} onPick={likes.toggle} onClose={() => setBoxOpen(false)} cell={56} />
        </View>
      ) : null}
      <LikedBy likes={likes} onOpen={() => setPanel((v) => !v)} size={24} />
      <LikesPanel likes={likes} visible={panel} onClose={() => setPanel(false)} inline />
    </View>
  );

  // ---- titel, zin, tekst ----
  const textBlock = (
    <View
      style={[
        { gap: mag ? 16 : 14 },
        mag ? { paddingTop: 30, paddingRight: 32, paddingBottom: 34, paddingLeft: 27, borderLeftWidth: 5, borderLeftColor: fc.fill } : null,
        modern ? { ...tile, paddingVertical: 28, paddingHorizontal: 30 } : null,
      ]}
    >
      {mag ? (
        <Text style={lbl(11, ink)}>
          {authorName} · {card.kind} · {timeLabel(p.created_at, t, lang)}
        </Text>
      ) : (
        <Text style={lbl(9, dim)}>{meta}</Text>
      )}
      {editing ? (
        <View style={{ maxWidth: 720 }}>
          <EditPost post={p} onDone={() => setEditing(false)} />
        </View>
      ) : (
        <>
          <Text
            style={[
              mag ? serif(true) : sans(400),
              mag ? { fontSize: 88, lineHeight: lh(88, 0.9), letterSpacing: -1.76, color: ink } : { fontSize: 56, lineHeight: 57, letterSpacing: -2.24, color: ink },
            ]}
          >
            {card.title}
          </Text>
          {card.caption ? (
            <Text
              style={[
                sans(400),
                { maxWidth: 760, fontSize: 20, lineHeight: modern ? 28 : 29, color: modern ? dim : ink },
              ]}
            >
              {card.caption}
            </Text>
          ) : null}
          {card.body && card.body !== card.caption ? (
            <Text selectable style={[mag ? serif() : sans(), { maxWidth: 640, fontSize: modern ? 20 : mag ? 21 : 15, lineHeight: modern ? 28 : mag ? 29 : 23, color: mag ? color("inkSoft") : dim }]}>
              {card.body}
            </Text>
          ) : null}
        </>
      )}
      {reactRow}
      {p.author?.username ? (
        <View style={{ flexDirection: "row" }}>
          <MonoLink label={`${t.profileOf} ${authorName} →`} active onPress={() => router.push(`/user/${p.author!.username}` as never)} />
        </View>
      ) : null}
    </View>
  );

  // ---- de comments ----
  const count = m.total;
  const replyName = replyTo ? (replyTo.user_id === myUserId ? t.me : displayName(m.authorOf(replyTo))) : "";
  const commentsColumn = (
    <View
      style={[
        { width: COMMENTS_W, minHeight: 900 },
        mag ? { backgroundColor: color("paper2") } : null,
        modern ? tile : null,
      ]}
    >
      <View
        style={[
          { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
          mag ? { paddingTop: 26, paddingHorizontal: 28, paddingBottom: 18, borderBottomWidth: OMSLAG.rule, borderBottomColor: ink } : { paddingVertical: 22, paddingHorizontal: 24 },
        ]}
      >
        {mag ? (
          <Black size={40} f={0.9} ls={-0.04}>
            {t.omComments}
          </Black>
        ) : (
          <Text style={[sans(500), { fontSize: 22, lineHeight: 26, letterSpacing: -0.44, color: ink }]}>{t.comments}</Text>
        )}
        <Text style={lbl(mag ? 11 : 9, mag ? ink : dim)}>{count}</Text>
      </View>
      <View style={{ paddingHorizontal: mag ? 28 : 24, paddingTop: 12 }}>
        <SortToggle m={m} />
        <CommentList m={m} myUserId={myUserId} variant="desktop" onReply={reply} highlightId={typeof highlight === "string" ? highlight : null} />
      </View>
      {count === 0 && !m.isLoading && m.pendingFor(null).length === 0 ? (
        <Text style={[mag ? serif(true) : sans(400), { padding: mag ? 28 : 24, paddingTop: modern ? 0 : 24, fontSize: modern ? 16 : 21, lineHeight: mag ? 27 : 24, color: dim }]}>
          {t.firstComment}
        </Text>
      ) : null}
      <View style={{ marginTop: "auto" }}>
        {replyTo ? <ReplyStrip label={t.replyTo} name={replyName} onCancel={() => setReplyTo(null)} /> : null}
        <EmojiSuggestions list={emoji.list} onPick={emoji.apply} round pad={20} />
        <MentionSuggestions list={emoji.mention.list} onPick={emoji.mention.apply} round pad={20} />
        <View
          style={[
            { flexDirection: "row", alignItems: "center" },
            mag ? { gap: 12, paddingTop: 18, paddingHorizontal: 28, paddingBottom: 24, borderTopWidth: OMSLAG.rule, borderTopColor: ink } : null,
            modern ? { margin: 10, minHeight: 56, paddingVertical: 6, alignItems: "flex-end", gap: 8, paddingLeft: 20, paddingRight: 6, borderRadius: field.height > inputMinH ? 28 : 999, backgroundColor: color("paper") } : null,
          ]}
        >
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={emoji.onChangeText}
            onKeyPress={field.onKeyPress}
            multiline
            onContentSizeChange={field.onContentSizeChange}
            scrollEnabled={field.scrollEnabled}
            placeholder={replyTo ? t.replyPh.replace("{name}", replyName) : t.writeBack}
            placeholderTextColor={dim}
            style={[
              mag ? serif(true) : sans(),
              {
                flex: 1,
                minWidth: 0,
                height: field.height,
                overflow: field.overflow,
                fontSize: mag ? 20 : 14,
                lineHeight: mag ? 26 : 18,
                paddingVertical: (inputMinH - (mag ? 26 : 18)) / 2,
                textAlignVertical: "top",
                color: ink,
              },
              mag ? { borderBottomWidth: 1, borderBottomColor: ink } : null,
              Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.comment}
            onPress={send}
            disabled={!draft.trim()}
            style={{
              width: 44,
              height: 44,
              alignSelf: "auto",
              borderRadius: mag ? 0 : 22,
              // Grijs tot er iets te sturen is, dan rood (HANDOFF "Schrijfbalk").
              backgroundColor: draft.trim() ? color("red") : color("ink", "pillSoft"),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: mag ? 18 : 17, lineHeight: 20, color: mag ? OMSLAG.onImage : color("paper") }}>↑</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <DesktopShell active="feed" tint={fc.fill} tabTint={fc.fill}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {own ? <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 24, paddingVertical: 10 }}>{ownActions}</View> : null}
        <View style={[{ flexDirection: "row", alignItems: "stretch" }, mag ? { gap: 6, padding: 6 } : null, modern ? { gap: 6 } : null]}>
          <View style={[{ flex: 1, minWidth: 0 }, { gap: 6 }]}>
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

/** `@keyframes rise` uit het prototype: 16px omhoog en in beeld. */
const RISE = [{ "0%": { opacity: 0, transform: [{ translateY: 16 }] }, "100%": { opacity: 1, transform: [{ translateY: 0 }] } }];

