import { Pressable, Text, View } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { color } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { Bento, DashRule, Tile, TileMeta, TitleTile } from "./Bento";

/**
 * Instellingen in modern.
 *
 * Het prototype tekent dit scherm niet apart uit; het volgt het model van
 * de andere modern-pagina's (2.2 §1: "toegepast op feed, gesprekken,
 * events, jij, meldingen, instellingen"). Eén tegel per groep, met het
 * mono-label van de groep als eerste regel in de tegel en GESTIPPELDE
 * scheidingen tussen de regels — geen kaders.
 *
 * Wat er ín de regels staat blijft wat `app/settings.tsx` altijd al toonde:
 * dezelfde schakelaars, dezelfde keuzerijen, dezelfde handelingen.
 */

export type SettingsGroupData = {
  title: string;
  rows: {
    key: string;
    label: string;
    sub?: string;
    /** De rechterkant: een keuzerij, een schakelaar, of een tekstwaarde. */
    right: React.ReactNode;
    onPress?: () => void;
  }[];
};

export function SettingsModern({
  groups,
  footer,
  t,
}: {
  groups: SettingsGroupData[];
  footer: string;
  t: Dict;
}) {
  return (
    <LincinScreen tab="you" counter={t.settings} back="/profile">
      <Bento>
        <TitleTile title={t.settings} />
        {groups.map((g) => (
          <Tile key={g.title} span={2} pad={0} style={{ paddingTop: 18, paddingHorizontal: 20, paddingBottom: 10 }}>
            <TileMeta>{g.title}</TileMeta>
            {g.rows.map((r, i) => (
              <View key={r.key}>
                <DashRule style={{ marginTop: i ? 0 : 14 }} />
                <Row label={r.label} sub={r.sub} onPress={r.onPress}>
                  {r.right}
                </Row>
              </View>
            ))}
          </Tile>
        ))}
        <Tile span={2} pad={0} style={{ backgroundColor: "transparent", paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text
            style={{
              ...mono(500),
              fontSize: 9,
              lineHeight: 13,
              letterSpacing: 1.44,
              textTransform: "uppercase",
              color: color("ink", "inkDim"),
            }}
          >
            {footer}
          </Text>
        </Tile>
      </Bento>
    </LincinScreen>
  );
}

function Row({
  label,
  sub,
  onPress,
  children,
}: {
  label: string;
  sub?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  const body = (
    <View
      style={{
        minHeight: 56,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ ...sans(500), fontSize: 15, lineHeight: 19, letterSpacing: -0.15, color: color("ink") }}>
          {label}
        </Text>
        {sub ? (
          <Text numberOfLines={1} style={{ ...sans(400), fontSize: 12, lineHeight: 16, color: color("ink", "inkDim") }}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={{ flexShrink: 0 }}>{children}</View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}
