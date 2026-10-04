import { Platform, Pressable, Text, View, type TextStyle } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { color, friendColor, hueFor, type Scheme } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { Bento, Counter, DashedTile, Tile, TileMeta, TitleTile } from "./Bento";

/**
 * Meldingen in modern (prototype `MELDINGEN · MODERN`).
 *
 * Per melding een rij over twee kolommen: een stip van 10 px in de kleur
 * van wie het deed, de zin met de naam vet, de tijd eronder in mono, en
 * rechts een rode stip zolang je hem niet las.
 *
 * Anders dan in kleur krijgt een ongelezen rij géén getint vlak: in een
 * bento-rooster is elke tegel al een vlak, en een tweede tint erbovenop
 * leest als een fout. De rode stip draagt het alleen.
 */

export type NoteRowData = {
  key: string;
  actorId: string | null;
  /** De naam, vet vooraan in de zin. Leeg voor een melding zonder afzender. */
  by: string;
  text: string;
  when: string;
  unread: boolean;
  onPress: () => void;
};

export function NotificationsModern({
  rows,
  unread,
  scheme,
  t,
  state,
  emptyLabel,
  onEmptyPress,
  onMarkAll,
}: {
  rows: NoteRowData[];
  unread: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
  emptyLabel?: string;
  onEmptyPress?: () => void;
  /** "Alles gelezen" — alleen getoond als er iets ongelezen is. */
  onMarkAll?: () => void;
}) {
  return (
    <LincinScreen tab="you" counter={t.notifications} back="/profile">
      <Bento>
        <TitleTile
          title={t.notifications}
          meta={
            // De teller met eronder "Alles gelezen": dezelfde mono-link als
            // de Meldingen-kolom op desktop (desktop-modern-pages, jij).
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <Counter>{`${unread} ${t.new}`}</Counter>
              {unread > 0 && onMarkAll ? (
                <Pressable accessibilityRole="button" onPress={onMarkAll} hitSlop={12} style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null}>
                  <Text style={linkStyle()}>{t.allRead}</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
        {state ? (
          <Tile span={2}>
            <TileMeta>{state}</TileMeta>
          </Tile>
        ) : null}
        {rows.map((n) => {
          const fc = friendColor(hueFor(n.actorId), scheme);
          return (
            <Tile
              key={n.key}
              span={2}
              pad={16}
              onPress={n.onPress}
              accessibilityLabel={`${n.by} ${n.text}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 72 }}
            >
              <View style={{ flexShrink: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: fc.fill }} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text style={{ ...sans(400), fontSize: 14, lineHeight: 19, color: color("ink") }}>
                  {n.by ? <Text style={{ ...sans(600) }}>{n.by} </Text> : null}
                  {n.text}
                </Text>
                <TileMeta>{n.when}</TileMeta>
              </View>
              {n.unread ? (
                <View style={{ flexShrink: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: color("red") }} />
              ) : null}
            </Tile>
          );
        })}
        {!rows.length && !state && emptyLabel && onEmptyPress ? (
          <DashedTile label={emptyLabel} onPress={onEmptyPress} />
        ) : null}
      </Bento>
    </LincinScreen>
  );
}

/**
 * Mono 9px op `.16em`, kapitaal, gedempt en onderstreept — de link van het
 * prototype. Een functie, geen constante: op native levert `color()` de
 * waarde van de stand van nú, en die moet meewisselen met licht/donker.
 */
const linkStyle = (): TextStyle => ({
  ...mono(500),
  fontSize: 9,
  lineHeight: 14,
  letterSpacing: 1.44,
  textTransform: "uppercase",
  color: color("ink", "inkDim"),
  textDecorationLine: "underline",
  textUnderlineOffset: 3,
}) as TextStyle;
