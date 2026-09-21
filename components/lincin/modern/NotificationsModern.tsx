import { Text, View } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { color, friendColor, hueFor, type Scheme } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { Bento, DashedTile, Tile, TileMeta, TitleTile } from "./Bento";

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
}: {
  rows: NoteRowData[];
  unread: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
  emptyLabel?: string;
  onEmptyPress?: () => void;
}) {
  return (
    <LincinScreen tab="you" counter={t.notifications} back="/profile">
      <Bento>
        <TitleTile title={t.notifications} meta={`${unread} ${t.new}`} />
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
                  {n.by ? <Text style={{ ...sans(500) }}>{n.by} </Text> : null}
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
