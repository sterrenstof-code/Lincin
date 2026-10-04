import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { ActionSheet } from "@/components/ActionSheet";
import { CommentText } from "@/components/lincin/CommentEdit";
import { openCommentImage } from "@/components/lincin/Lightbox";
import { MentionsText } from "@/components/MentionsText";
import { SafeImage } from "@/components/SafeImage";
import type { EntityComment } from "@/lib/api/entity-comments";
import { getProfiles } from "@/lib/api/profiles";
import { confirm } from "@/lib/confirm";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec, OMSLAG } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import type { CommentsModel, PendingComment } from "@/lib/lincin/comments";
import { displayName, relTime } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { HeartIcon, LikesPanel, PersonDot, fill } from "./Reactions";

/**
 * De reacties (Bijdrage Voorbeeld 1a, 1b, 1d; HANDOFF "Reacties" en
 * "Gesprekken binnen één reactie").
 *
 * Telefoon: avatar 32, naam links en tijd rechts, de tekst in serif 18,
 * dan één actieregel — hart + aantal · Antwoord · rechts "N antwoorden ▾".
 * Desktop: de naam vet vóór de tekst, de tijd en de likes eronder, het
 * hart in een eigen kolom rechts.
 *
 * Een gesprek klapt uit als getint blok onder de reactie, met een rug van
 * 3 in de kleur van wie de reactie schreef. Vasthouden (telefoon) of ⋯
 * (desktop): je eigen reactie bewerken of verwijderen; die van een ander
 * rapporteren of verbergen — en wie de bijdrage maakte, mag hem ook
 * verwijderen.
 */

const isWeb = Platform.OS === "web";
const pointer = isWeb ? ({ cursor: "pointer" } as ViewStyle) : null;
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;

/** Hoogstens drie emoji en verder niets: dan staan ze groter (HANDOFF). */
function emojiOnly(text: string): boolean {
  const s = text.trim();
  if (!s || !EMOJI_ONLY.test(s)) return false;
  const count = Array.from(s.replace(/\s|‍|️/g, "")).length;
  return count <= 3;
}

type Variant = "mobile" | "desktop";

/** Alleen Nieuwste / Oudste, voor wie zijn eigen kop al heeft (desktop). */
export function SortToggle({ m }: { m: CommentsModel }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingBottom: 4 }}>
      <SortTabs m={m} />
    </View>
  );
}

function SortTabs({ m }: { m: CommentsModel }) {
  const t = useT();
  const opt = (v: "newest" | "oldest", label: string) => {
    const on = m.sort === v;
    return (
      <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => m.setSort(v)} hitSlop={8} style={pointer}>
        <Text
          style={[
            sans(700),
            { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: on ? color("ink") : color("ink", "inkDim") },
            on ? ({ textDecorationLine: "underline", textUnderlineOffset: 3 } as TextStyle) : null,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 14 }}>
      {opt("newest", t.newest)}
      {opt("oldest", t.oldest)}
    </View>
  );
}

export function CommentsHead({ m, count }: { m: CommentsModel; count: number }) {
  const t = useT();
  return (
    <View style={{ borderTopWidth: 2, borderTopColor: color("ink"), paddingTop: 14, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={[sans(700), { fontSize: 10, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase", color: color("ink") }]}>
        {t.comments} · {count}
      </Text>
      <SortTabs m={m} />
    </View>
  );
}

export function CommentList({
  m,
  myUserId,
  variant = "mobile",
  onReply,
  highlightId,
}: {
  m: CommentsModel;
  myUserId: string;
  variant?: Variant;
  /** "Antwoord": zet de schrijfbalk in antwoord-stand. */
  onReply: (c: EntityComment) => void;
  /** Binnengekomen via een melding: deze reactie even oplichten. */
  highlightId?: string | null;
}) {
  const t = useT();
  // Komt de gemarkeerde reactie in een draad, dan gaat die draad open.
  useEffect(() => {
    if (!highlightId) return;
    const c = m.find(highlightId);
    if (c?.parent_id) m.setOpen(c.parent_id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, m.find(highlightId ?? "")?.id]);

  const pendingRoots = m.pendingFor(null);
  return (
    <View>
      {m.sort === "newest" ? pendingRoots.slice().reverse().map((p) => <PendingItem key={p.tempId} p={p} m={m} variant={variant} />) : null}
      {m.roots.map((c) => (
        <Thread key={c.id} c={c} m={m} myUserId={myUserId} variant={variant} onReply={onReply} highlightId={highlightId} />
      ))}
      {m.sort === "oldest" ? pendingRoots.map((p) => <PendingItem key={p.tempId} p={p} m={m} variant={variant} />) : null}
      {m.hasMore ? (
        <Pressable accessibilityRole="button" onPress={m.loadMore} style={[{ paddingVertical: 16, alignItems: "flex-start" }, pointer]}>
          <Text style={[sans(700), { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink") }]}>
            {t.moreComments} · {m.moreCount} ↓
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Thread({
  c,
  m,
  myUserId,
  variant,
  onReply,
  highlightId,
}: {
  c: EntityComment;
  m: CommentsModel;
  myUserId: string;
  variant: Variant;
  onReply: (c: EntityComment) => void;
  highlightId?: string | null;
}) {
  const t = useT();
  const scheme = useScheme();
  const modern = useThemeSpec().id === "modern";
  useHueChoices();
  const replies = m.repliesOf(c.id);
  const pending = m.pendingFor(c.id);
  const open = m.isOpen(c.id);
  const n = replies.length;
  const spine = friendColor(hueFor(c.user_id), scheme).fill;
  const toggle = () => m.setOpen(c.id, !open);
  const repliesLabel = open ? `${t.hideReplies} ▴` : `${n === 1 ? t.oneReply : fill(t.nReplies, n)} ▾`;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: color("ink", "postRule") }}>
      <Item c={c} m={m} myUserId={myUserId} variant={variant} onReply={onReply} highlight={highlightId === c.id} repliesLabel={variant === "mobile" && n > 0 ? repliesLabel : undefined} onToggleReplies={toggle} />
      {variant === "desktop" && n > 0 ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={toggle} style={[{ flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 44, marginBottom: 12 }, pointer]}>
          <View style={{ width: 24, height: 1, backgroundColor: color("ink", "inkDim") }} />
          <Text style={[sans(700), { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
            {open ? t.hideRepliesLong : n === 1 ? t.showOneReply : fill(t.showNReplies, n)}
          </Text>
        </Pressable>
      ) : null}
      {(open && n > 0) || pending.length ? (
        <View
          style={{
            marginTop: variant === "mobile" ? 0 : 0,
            marginBottom: 14,
            marginLeft: variant === "mobile" ? 44 : 44,
            backgroundColor: color("tint"),
            borderLeftWidth: OMSLAG.threadSpine,
            borderLeftColor: spine,
            borderRadius: modern ? 12 : 0,
            paddingTop: 12,
            paddingRight: 12,
            paddingBottom: 12,
            paddingLeft: 14,
            gap: 14,
          }}
        >
          {open ? replies.map((r) => <Item key={r.id} c={r} m={m} myUserId={myUserId} variant={variant} onReply={onReply} highlight={highlightId === r.id} small />) : null}
          {pending.map((p) => (
            <PendingItem key={p.tempId} p={p} m={m} variant={variant} small />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Item({
  c,
  m,
  myUserId,
  variant,
  onReply,
  highlight,
  small = false,
  repliesLabel,
  onToggleReplies,
}: {
  c: EntityComment;
  m: CommentsModel;
  myUserId: string;
  variant: Variant;
  onReply: (c: EntityComment) => void;
  highlight?: boolean;
  small?: boolean;
  repliesLabel?: string;
  onToggleReplies?: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const own = c.user_id === myUserId;
  const author = m.authorOf(c);
  const name = own ? t.me : displayName(author);
  const likes = m.likesOf(c.id);
  const [menu, setMenu] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lit, setLit] = useState(false);
  const ref = useRef<View>(null);

  // Binnen via een melding: 1,5 s zacht gemarkeerd, en in beeld.
  useEffect(() => {
    if (!highlight) return;
    setLit(true);
    if (isWeb) (ref.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const id = setTimeout(() => setLit(false), 1500);
    return () => clearTimeout(id);
  }, [highlight]);

  const time = relTime(c.created_at, t, lang);
  const bodySize = variant === "desktop" ? (small ? 18 : 21) : small ? 17 : 18;
  const big = emojiOnly(c.body);
  const textStyle: TextStyle = { ...serif(), fontSize: big ? bodySize * 1.8 : bodySize, lineHeight: Math.round((big ? bodySize * 1.8 : bodySize) * 1.3), color: color("ink") };
  const meta: TextStyle = { ...sans(700), fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink", "inkDim") };
  const avatar = small ? (variant === "desktop" ? 22 : 24) : 32;

  const actions = [
    ...(own ? [{ label: t.editC, icon: "create-outline" as const, onPress: () => setEditing(true) }] : []),
    ...(m.canDelete(c)
      ? [
          {
            label: t.deleteC,
            icon: "trash-outline" as const,
            destructive: true,
            onPress: async () => {
              const ok = await confirm(t.deleteCQ, c.parent_id ? "" : t.deleteCSub, { affirmativeLabel: t.deleteC, destructive: true });
              if (!ok) return;
              try {
                await m.remove(c.id);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t.failed);
              }
            },
          },
        ]
      : []),
    ...(!own
      ? [
          {
            label: t.reportC,
            icon: "flag-outline" as const,
            onPress: async () => {
              try {
                await m.report(c.id);
                toast.show(t.reportedC);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t.failed);
              }
            },
          },
          { label: t.hideC, icon: "eye-off-outline" as const, onPress: () => m.hide(c.id) },
        ]
      : []),
  ];

  const heart = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${likes.liked ? t.unlikeA11y : t.likeA11y}, ${likes.count}`}
      accessibilityState={{ selected: likes.liked }}
      onPress={() => m.toggleLike(c.id)}
      hitSlop={14}
      style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, pointer]}
    >
      <HeartIcon on={likes.liked} size={small ? 13 : 14} ink={color("ink", "inkDim")} />
    </Pressable>
  );
  // Het aantal opent wie het was (zoals "Geliked door" bij een bijdrage).
  const likeCount = likes.count ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t.likesTitle}: ${likes.count}`} onPress={() => setWhoOpen(true)} hitSlop={10} style={pointer}>
      <Text style={[meta, { textDecorationLine: "underline" }]}>
        {variant === "mobile" ? likes.count : likes.count === 1 ? t.oneLike : fill(t.nLikes, likes.count)}
      </Text>
    </Pressable>
  ) : null;

  const reply = (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t.replyTo} ${name}`} onPress={() => onReply(c)} hitSlop={12} style={pointer}>
      <Text style={meta}>{t.replyC}</Text>
    </Pressable>
  );

  const image = c.image_url ? (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`${t.gifNote}, ${name}`}
      onPress={() => openCommentImage(c, name)}
      style={[{ width: 170, height: 118, marginTop: 4, backgroundColor: color("paper2"), overflow: "hidden" }, isWeb ? ({ cursor: "zoom-in" } as object) : null]}
    >
      <SafeImage uri={c.image_url} cacheKey={c.image_path ?? undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      <View style={{ position: "absolute", left: 6, bottom: 6, backgroundColor: color("ink"), paddingHorizontal: 5, paddingVertical: 2 }}>
        <Text style={[sans(700), { fontSize: 8, lineHeight: 10, letterSpacing: 1, textTransform: "uppercase", color: color("paper") }]}>{t.gifNote}</Text>
      </View>
    </Pressable>
  ) : null;

  const body = (
    <CommentText
      comment={c}
      own={own}
      textStyle={textStyle}
      editing={editing}
      onEditingChange={setEditing}
      body={<MentionsText text={c.body} style={textStyle} />}
    />
  );

  const edited = c.edited_at ? ` · ${t.edited}` : "";

  return (
    <Pressable
      ref={ref}
      // Vasthouden opent het menu — ook in de browser op een telefoon, waar
      // de meeste mensen Lincin gebruiken. Desktop heeft daarnaast de ⋯.
      onLongPress={actions.length ? () => setMenu(true) : undefined}
      delayLongPress={350}
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: small ? 0 : 16,
        backgroundColor: lit ? color("tint") : "transparent",
        ...(isWeb ? ({ transitionProperty: "background-color", transitionDuration: "600ms" } as object) : null),
      }}
    >
      <PersonDot id={c.user_id} name={name} url={author?.avatar_url} size={avatar} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {variant === "mobile" ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <Text numberOfLines={1} style={[sans(700), { flexShrink: 1, fontSize: 12, lineHeight: 16, color: color("ink") }]}>
                {name}
              </Text>
              <Text style={[sans(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
                {time}
                {edited}
              </Text>
            </View>
            {image}
            {body}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {heart}
                {likeCount}
              </View>
              {reply}
              <View style={{ flex: 1 }} />
              {repliesLabel ? (
                <Pressable accessibilityRole="button" onPress={onToggleReplies} hitSlop={12} style={pointer}>
                  <Text style={meta}>{repliesLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            {image}
            {editing ? (
              body
            ) : (
              <Text style={textStyle}>
                <Text style={[sans(700), { fontSize: small ? 13 : 14, color: color("ink") }]}>{name} </Text>
                <MentionsText text={c.body} style={textStyle} />
              </Text>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
              <Text style={meta}>
                {time}
                {edited} ·
              </Text>
              {likeCount ? (
                <>
                  {likeCount}
                  <Text style={meta}>·</Text>
                </>
              ) : null}
              {reply}
              {actions.length ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Meer" onPress={() => setMenu(true)} hitSlop={10} style={pointer}>
                  <Text style={meta}>⋯</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </View>
      {variant === "desktop" ? <View style={{ width: 20, paddingTop: 4, alignItems: "center" }}>{heart}</View> : null}
      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={actions} />
      {whoOpen ? <CommentLikers likers={m.likersOf(c.id)} myUserId={myUserId} onClose={() => setWhoOpen(false)} /> : null}
    </Pressable>
  );
}

function PendingItem({ p, m, variant, small = false }: { p: PendingComment; m: CommentsModel; variant: Variant; small?: boolean }) {
  const t = useT();
  const failed = p.status === "failed";
  const size = variant === "desktop" ? (small ? 18 : 21) : small ? 17 : 18;
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: small ? 0 : 16, opacity: failed ? 1 : 0.6 }}>
      <View style={{ width: small ? 24 : 32 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[serif(), { fontSize: size, lineHeight: Math.round(size * 1.3), color: color("ink") }]}>{p.body || "GIF"}</Text>
        {failed ? (
          <Pressable accessibilityRole="button" onPress={() => m.retry(p.tempId)} hitSlop={10} style={pointer}>
            <Text style={[sans(700), { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: color("red") }]}>
              {t.notSent} · {t.retry}
            </Text>
          </Pressable>
        ) : (
          <Text style={[sans(500), { fontSize: 10, lineHeight: 14, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{t.sendingC}</Text>
        )}
      </View>
    </View>
  );
}

/** Wie op een reactie reageerde: hetzelfde paneel als bij een bijdrage, jij bovenaan. */
function CommentLikers({ likers, myUserId, onClose }: { likers: { userId: string; emojis: string[]; latest: string }[]; myUserId: string; onClose: () => void }) {
  const ids = likers.map((l) => l.userId);
  const profiles = useQuery({ queryKey: ["profiles", ...ids.slice().sort()], queryFn: () => getProfiles(ids), enabled: ids.length > 0, staleTime: 60_000 });
  const reactors = likers
    .map((l) => ({ ...l, me: l.userId === myUserId, profile: profiles.data?.find((p) => p.id === l.userId) ?? null }))
    .sort((a, b) => (a.me !== b.me ? (a.me ? -1 : 1) : a.latest < b.latest ? 1 : -1));
  return <LikesPanel likes={{ reactors, count: reactors.length }} visible onClose={onClose} />;
}
