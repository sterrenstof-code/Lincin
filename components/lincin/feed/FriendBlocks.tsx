import { Pressable, View } from "react-native";

import { BORDER, GUTTER, Head, Initial, line, Mono, SquareBtn } from "@/components/lincin/ui";
import { color, friendColor, useScheme, useThemeSpec } from "@/lib/design/theme";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

/**
 * De bouwstenen van "Per vriend" (mobile-kleur-home.dc.html, HANDOFF 23 sep):
 *
 *   SectionHead  "Nieuw" / "Gezien" met een blokje, een haarlijn en meta
 *   FriendBand   de kop van een vriend: initiaal, naam, statusregel, +
 *   SeenRow      een geziene vriend, ingeklapt: één rij in een kader
 *
 * Thema-onafhankelijk: alleen tokens en `spec.bandFilled` verschillen. In
 * kleur is een nieuwe band gevuld met de vriendkleur; in magazine en
 * modern is hij papier met een kleurbalk van 6 links.
 */

export const BAND_H = 56;

/** "2 nieuw · Het licht om 22:19 · Hier stond ik" — status en titels. */
export function statusLine(fresh: CardPost[], all: CardPost[], t: ReturnType<typeof useT>): string {
  const list = fresh.length ? fresh : all;
  const titles = list.map((p) => p.title || p.caption || p.kind).filter(Boolean);
  const head = fresh.length ? `${fresh.length} ${t.new}` : `${t.read} · ${all.length} ${all.length === 1 ? t.post1 : t.posts}`;
  return [head, ...titles].join(" · ");
}

export function SectionHead({
  label,
  meta,
  isNew,
  action,
  onAction,
  style,
}: {
  label: string;
  meta?: string;
  isNew?: boolean;
  action?: string;
  onAction?: () => void;
  style?: object;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 10 }, style]}>
      <View
        style={{
          width: 8,
          height: 8,
          borderWidth: 1.5,
          borderColor: isNew ? color("red") : color("ink", "inkDim"),
          backgroundColor: isNew ? color("red") : "transparent",
        }}
      />
      <Mono variant="micro" tone="ink" style={{ fontWeight: "600", letterSpacing: 1 }}>
        {label}
      </Mono>
      <View style={{ flex: 1, height: 1, backgroundColor: color("ink", "linePaper") }} />
      {meta ? (
        <Mono variant="micro" tone="dim" style={{ letterSpacing: 0.6 }}>
          {meta}
        </Mono>
      ) : null}
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Mono variant="micro" tone="ink" style={{ textDecorationLine: "underline", letterSpacing: 0.8 }}>
            {action}
          </Mono>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FriendBand({
  group: g,
  isNew,
  status,
  open,
  onToggle,
  onProfile,
}: {
  group: FriendGroup;
  isNew: boolean;
  status: string;
  open: boolean;
  onToggle: () => void;
  onProfile: () => void;
}) {
  const t = useT();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const fc = friendColor(g.hue, scheme);
  const filled = isNew && spec.bandFilled;
  const bg = filled ? fc.fill : color("paper");
  const ink = filled ? fc.ink : color("ink");
  return (
    <View
      style={{
        height: BAND_H,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: GUTTER,
        backgroundColor: bg,
        borderTopWidth: BORDER,
        borderBottomWidth: BORDER,
        borderColor: line(),
        borderLeftWidth: filled ? 0 : 6,
        borderLeftColor: fc.fill,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${g.name}, ${t.viewProfile}`}
        onPress={onProfile}
        style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <Initial
          letter={g.initial}
          size={30}
          round={!g.isGroup}
          bg={isNew ? color("paper") : fc.fill}
          fg={isNew ? color("ink") : fc.ink}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Head variant="band" color={ink} numberOfLines={1} style={{ lineHeight: 19 }}>
            {g.name}
          </Head>
          <Mono variant="micro" color={ink} numberOfLines={1} style={{ fontSize: 9, lineHeight: 11, fontWeight: "600", letterSpacing: 0.9 }}>
            {status}
          </Mono>
        </View>
      </Pressable>
      <SquareBtn
        glyph="+"
        size={30}
        fontSize={16}
        onPress={onToggle}
        accessibilityLabel={open ? t.closeAll : t.openAll}
        ink={ink}
        style={{ borderWidth: 1.5, borderColor: ink, backgroundColor: "transparent", transform: [{ rotate: open ? "45deg" : "0deg" }] }}
      />
    </View>
  );
}

/**
 * Een geziene vriend, ingeklapt: "3 bijdragen · titels · 08:20". De rijen
 * delen hun lijnen; `top` sluit het kader boven een rij die na een
 * opengeklapte vriend komt.
 */
export function SeenRow({ group: g, top, onToggle }: { group: FriendGroup; top: boolean; onToggle: () => void }) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(g.hue, scheme);
  const n = g.posts.length;
  const titles = g.posts.map((p) => p.title || p.caption || p.kind).filter(Boolean).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${g.name}, ${t.openAll}`}
      onPress={onToggle}
      style={{
        marginHorizontal: GUTTER,
        height: BAND_H,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        backgroundColor: color("paper"),
        borderLeftWidth: BORDER,
        borderRightWidth: BORDER,
        borderTopWidth: top ? BORDER : 0,
        borderBottomWidth: BORDER,
        borderColor: line(),
      }}
    >
      <Initial letter={g.initial} size={30} round={!g.isGroup} border={false} bg={fc.fill} fg={fc.ink} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Head variant="band" numberOfLines={1} style={{ fontSize: 19, lineHeight: 17 }}>
          {g.name}
        </Head>
        <Mono variant="micro" tone="dim" numberOfLines={1} style={{ fontSize: 9, lineHeight: 11 }}>
          {n} {n === 1 ? t.post1 : t.posts} · {titles} · {timeLabel(g.latest, t, lang)}
        </Mono>
      </View>
      <View style={{ width: 30, height: 30, borderWidth: 1.5, borderColor: color("ink"), alignItems: "center", justifyContent: "center" }}>
        <Mono variant="meta" tone="ink" style={{ fontSize: 16, lineHeight: 18 }}>
          +
        </Mono>
      </View>
    </Pressable>
  );
}
