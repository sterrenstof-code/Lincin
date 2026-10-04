import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { AvatarPhoto } from "@/components/lincin/AvatarPhoto";
import { BottomSheet } from "@/components/lincin/BottomSheet";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { DRAWER_EMOJI, LIKE, type PostLikes, type Reactor } from "@/lib/lincin/likes";
import { displayName } from "@/lib/lincin/model";

/**
 * De reacties op een bijdrage (Bijdrage Voorbeeld 1a, 1c; HANDOFF "Likes &
 * emoji-reacties"):
 *
 *   ActionRow   ♥ aantal · 💬 aantal · ☺ · rechts "Bericht"
 *   EmojiDrawer zes vaste emoji + Meer; jouw emoji op het getinte vlak
 *   LikedBy     drie avatars, "Geliked door jou en 5 anderen", Alles
 *   LikesPanel  iedereen die reageerde: van onder (telefoon) of inline
 *               (desktop); jij bovenaan, dan op recentheid
 *
 * Magazine is het eindbeeld; modern krijgt dezelfde bouw met zijn eigen
 * kleuren en rondingen.
 */

const isWeb = Platform.OS === "web";
const pointer = isWeb ? ({ cursor: "pointer" } as ViewStyle) : null;

/** Meer emoji, voor "Meer" in de lade. */
const MORE_EMOJI = [
  "❤️", "🥹", "🔥", "👏", "😂", "🎉", "😍", "🥰", "😮", "😢", "😭", "😅", "🙏", "💪", "👀", "✨",
  "🌊", "🌅", "☕", "🍻", "🥂", "🎂", "🌸", "🌿", "🏠", "🚲", "✈️", "📸", "🎧", "🎶", "💯", "👍",
  "🤍", "🧡", "💛", "💚", "💙", "💜", "🤯", "🫶", "🙌", "😎", "🤔", "😴", "🤗", "😬", "🥳", "🐶",
];

export function HeartIcon({ on, size = 26, ink }: { on: boolean; size?: number; ink: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 20.5s-7.5-4.6-9.4-9.3C1.4 8.2 3.3 4.8 6.7 4.6c2.1-.1 3.7 1.1 5.3 3 1.6-1.9 3.2-3.1 5.3-3 3.4.2 5.3 3.6 4.1 6.6-1.9 4.7-9.4 9.3-9.4 9.3z"
        fill={on ? color("red") : "none"}
        stroke={on ? color("red") : ink}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BubbleIcon({ size = 24, ink }: { size?: number; ink: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z" fill="none" stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Een avatar: de foto, anders de initiaal op de eigen kleur. */
export function PersonDot({ id, name, url, size, ring }: { id: string; name: string; url?: string | null; size: number; ring?: string }) {
  const scheme = useScheme();
  useHueChoices();
  const fc = friendColor(hueFor(id), scheme);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: "hidden",
        backgroundColor: fc.fill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      <Text style={[sans(700), { fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.5), color: fc.ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
      <AvatarPhoto url={url} size={size} />
    </View>
  );
}

/** Een getal of zinnetje met {n} erin. */
export function fill(s: string, n: number | string): string {
  return s.replace("{n}", String(n));
}

export function ActionRow({
  likes,
  commentCount,
  drawerOpen,
  onDrawer,
  onComments,
  right,
}: {
  likes: PostLikes;
  commentCount: number;
  drawerOpen: boolean;
  onDrawer: () => void;
  onComments?: () => void;
  /** Rechts: "Bericht", of "Privé aan Noor" op desktop. */
  right?: ReactNode;
}) {
  const t = useT();
  const ink = color("ink");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 22, minHeight: 44 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${likes.liked ? t.unlikeA11y : t.likeA11y}, ${likes.count}`}
        accessibilityState={{ selected: likes.liked }}
        onPress={() => likes.toggle(LIKE)}
        hitSlop={8}
        style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, pointer]}
      >
        <HeartIcon on={likes.liked} ink={ink} />
        <Text style={[sans(700), { fontSize: 13, lineHeight: 16, color: ink }]}>{likes.count}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.comments}, ${commentCount}`}
        onPress={onComments}
        disabled={!onComments}
        hitSlop={8}
        style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, pointer]}
      >
        <BubbleIcon ink={ink} />
        <Text style={[sans(700), { fontSize: 13, lineHeight: 16, color: ink }]}>{commentCount}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emoji"
        accessibilityState={{ expanded: drawerOpen }}
        onPress={onDrawer}
        hitSlop={7}
        style={[
          {
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: drawerOpen ? ink : "transparent",
            borderWidth: drawerOpen ? 0 : 1,
            borderColor: ink,
          },
          pointer,
        ]}
      >
        <Text style={{ fontSize: 15, lineHeight: 18, color: drawerOpen ? color("paper") : ink }}>☺</Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** "BERICHT": 10px, .12em, onderstreept. */
export function UnderlinedAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={pointer}>
      <Text style={[sans(700), { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", textDecorationLine: "underline", color: color("ink") }, { textUnderlineOffset: 3 } as object]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * De lade: zes cellen in een kader van 1 inkt, en "Meer". Een tik zet de
 * emoji aan of uit en sluit de lade (prototype).
 */
export function EmojiDrawer({ mine, onPick, onClose, cell = 52 }: { mine: Set<string>; onPick: (e: string) => void; onClose?: () => void; cell?: number }) {
  const t = useT();
  const modern = useThemeSpec().id === "modern";
  const [more, setMore] = useState(false);
  const pick = (e: string) => {
    onPick(e);
    setMore(false);
    onClose?.();
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", height: cell, borderWidth: 1, borderColor: color("ink"), borderRadius: modern ? 14 : 0, overflow: "hidden" }}>
        {DRAWER_EMOJI.map((e, i) => (
          <Pressable
            key={e}
            accessibilityRole="button"
            accessibilityLabel={e}
            accessibilityState={{ selected: mine.has(e) }}
            onPress={() => pick(e)}
            style={[
              { flex: 1, alignItems: "center", justifyContent: "center", borderLeftWidth: i ? 1 : 0, borderLeftColor: color("ink", "postRule"), backgroundColor: mine.has(e) ? color("tint") : "transparent" },
              pointer,
            ]}
          >
            <Text style={{ fontSize: 24, lineHeight: 30 }}>{e}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.moreEmoji}
          accessibilityState={{ expanded: more }}
          onPress={() => setMore((v) => !v)}
          style={[{ width: 52, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: color("ink", "postRule"), backgroundColor: more ? color("tint") : "transparent" }, pointer]}
        >
          <Text style={[sans(700), { fontSize: 8, lineHeight: 11, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{t.moreEmoji}</Text>
        </Pressable>
      </View>
      {more ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: color("ink", "postRule"), borderRadius: modern ? 14 : 0 }}>
          {MORE_EMOJI.map((e) => (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={e}
              onPress={() => pick(e)}
              style={[{ width: "12.5%", height: 44, alignItems: "center", justifyContent: "center", backgroundColor: mine.has(e) ? color("tint") : "transparent" }, pointer]}
            >
              <Text style={{ fontSize: 22, lineHeight: 28 }}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** "Geliked door jou en 5 anderen": de zin, de stapel avatars, en "Alles". */
export function LikedBy({ likes, onOpen, size = 22 }: { likes: PostLikes; onOpen: () => void; size?: number }) {
  const t = useT();
  if (likes.count === 0) return null;
  const first = likes.reactors[0];
  const firstName = first.me ? t.likedYou : first.profile ? displayName(first.profile) : "…";
  const others = likes.count - 1;
  // De stapel: hoogstens drie, de meest recente eerst (HANDOFF).
  const stack = [...likes.reactors].sort((a, b) => (a.latest < b.latest ? 1 : -1)).slice(0, 3);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.likedBy} ${firstName}${others ? ` ${others === 1 ? t.andOneOther : fill(t.andNOthers, others)}` : ""}`}
      onPress={onOpen}
      style={[{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 }, pointer]}
    >
      <View style={{ flexDirection: "row" }}>
        {stack.map((r, i) => (
          <View key={r.userId} style={{ marginLeft: i ? -7 : 0, zIndex: 3 - i }}>
            <PersonDot id={r.userId} name={r.profile ? displayName(r.profile) : "?"} url={r.profile?.avatar_url} size={size} ring={color("paper")} />
          </View>
        ))}
      </View>
      <Text numberOfLines={1} style={[sans(400), { flex: 1, fontSize: size > 22 ? 15 : 13, lineHeight: 18, color: color("ink") }]}>
        {t.likedBy} <Text style={sans(700)}>{firstName}</Text>
        {others ? ` ${others === 1 ? t.andOneOther : fill(t.andNOthers, others)}` : ""}
      </Text>
      <UnderlinedAction label={t.seeAll} onPress={onOpen} />
    </Pressable>
  );
}

function ReactorRow({ r }: { r: Reactor }) {
  const t = useT();
  const name = r.me ? t.me : r.profile ? displayName(r.profile) : "…";
  const sub = r.me ? t.me : r.profile?.username ? `@${r.profile.username}` : "";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color("ink", "postRule") }}>
      <PersonDot id={r.userId} name={name} url={r.profile?.avatar_url} size={38} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={[sans(700), { fontSize: 13, lineHeight: 16, color: color("ink") }]}>
          {name}
        </Text>
        {sub ? (
          <Text numberOfLines={1} style={[sans(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 20, lineHeight: 26 }}>{r.emojis.join("")}</Text>
    </View>
  );
}

/**
 * "Vond dit leuk · 6". Op de telefoon schuift hij van onder over de pagina
 * (een sluier eronder, tik erop sluit); op desktop staat hij inline onder
 * de knoppen.
 */
export function LikesPanel({
  likes,
  visible,
  onClose,
  inline = false,
}: {
  /** Alleen wie en hoeveel: ook bruikbaar voor de likes op een reactie. */
  likes: Pick<PostLikes, "reactors" | "count">;
  visible: boolean;
  onClose: () => void;
  inline?: boolean;
}) {
  const t = useT();
  const head = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 }}>
      <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink") }]}>
        {t.likesTitle} · {likes.count}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t.closeC} onPress={onClose} hitSlop={12} style={pointer}>
        <Text style={[sans(700), { fontSize: inline ? 10 : 16, lineHeight: 18, letterSpacing: inline ? 1.2 : 0, textTransform: "uppercase", color: color("ink") }]}>
          {inline ? `${t.closeC} ×` : "×"}
        </Text>
      </Pressable>
    </View>
  );
  const list = likes.reactors.map((r) => <ReactorRow key={r.userId} r={r} />);
  if (inline) {
    if (!visible) return null;
    return (
      <View style={{ maxWidth: 420, borderTopWidth: 2, borderTopColor: color("ink"), paddingHorizontal: 0 }}>
        {head}
        {list}
      </View>
    );
  }
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 24, flexShrink: 1 }}>
        {head}
        <ScrollView>{list}</ScrollView>
      </View>
    </BottomSheet>
  );
}

