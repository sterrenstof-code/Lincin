import { Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { color } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { Bento, DashRule, SEAM, Tile, TileMeta, TitleTile } from "./Bento";

/**
 * Jij, in modern (prototype `JIJ · MODERN`).
 *
 * Vier tegels over twee kolommen: je naam met je avatar, de drie
 * getallen naast elkaar, je laatste bijdragen als een schuivende strip
 * van 128 × 160, en de lijst met Instellingen, Meldingen, Lincs en je
 * QR-code — met GESTIPPELDE scheidingen tussen de regels.
 */

export type StatData = { n: string; label: string };
export type LinkRowData = { label: string; right: string; red?: boolean; onPress: () => void };

export function YouModern({
  first,
  last,
  avatar,
  stats,
  latest,
  links,
  t,
}: {
  first: string;
  last: string;
  /** De avatar rechts in de titeltegel: een foto of een gekleurde initiaal. */
  avatar: React.ReactNode;
  stats: StatData[];
  /** De strip met je laatste bijdragen; elk een eigen tegel van 128 × 160. */
  latest: { key: string; onPress: () => void; children: React.ReactNode }[];
  links: LinkRowData[];
  t: Dict;
}) {
  return (
    <LincinScreen tab="you" counter={t.tabYou}>
      <Bento>
        <TitleTile
          align="center"
          title={
            <Text style={{ ...sans(400), fontSize: 30, lineHeight: 31.5, letterSpacing: -0.9, color: color("ink") }}>
              {first}
              {last ? "\n" : ""}
              {last ? <Text style={{ color: color("ink", "inkDim") }}>{last}</Text> : null}
            </Text>
          }
        >
          <View style={{ flexShrink: 0 }}>{avatar}</View>
        </TitleTile>

        <Tile span={2} pad={20} style={{ flexDirection: "row" }}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={{ ...sans(500), fontSize: 26, lineHeight: 26, letterSpacing: -0.52, color: color("ink") }}>
                {s.n}
              </Text>
              <TileMeta numberOfLines={2}>{s.label}</TileMeta>
            </View>
          ))}
        </Tile>

        <Tile span={2} pad={20} style={{ gap: 16 }}>
          <TileMeta>{t.yourLatest}</TileMeta>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ gap: SEAM, paddingHorizontal: 20 }}
          >
            {latest.map((m) => (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                onPress={m.onPress}
                style={({ pressed }) => ({
                  flexShrink: 0,
                  width: 128,
                  height: 160,
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: color("paper2"),
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                {m.children}
              </Pressable>
            ))}
          </ScrollView>
        </Tile>

        <Tile span={2} pad={0} style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 8 }}>
          {links.map((l, i) => (
            <View key={l.label}>
              {i ? <DashRule /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${l.label} ${l.right}`}
                onPress={l.onPress}
                style={({ pressed }) => ({
                  height: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ ...sans(500), fontSize: 15, lineHeight: 18, letterSpacing: -0.15, color: color("ink") }}>
                  {l.label}
                </Text>
                <Text
                  style={{
                    ...mono(500),
                    fontSize: 10,
                    lineHeight: 13,
                    letterSpacing: 1.4,
                    color: l.red ? color("red") : color("ink", "inkDim"),
                  }}
                >
                  {l.right}
                </Text>
              </Pressable>
            </View>
          ))}
        </Tile>
      </Bento>
    </LincinScreen>
  );
}
