import { Text, View } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { ON_DARK, color, friendColor, type Hue, type Scheme } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { Bento, Tile, TileMeta, TileTitle, TitleTile } from "./Bento";

/**
 * Gesprekken in modern (prototype `GESPREKKEN · MODERN`).
 *
 * De titeltegel met het aantal ongelezen rechts, daaronder één rij per
 * gesprek over de volle breedte: een gekleurd vierkantje van 52 met de
 * initiaal, de naam met de tijd erachter, de laatste regel eronder, en
 * rechts een rood telbolletje als er iets wacht.
 *
 * De gegevens komen ongewijzigd uit `app/(app)/chats.tsx`; dit is alleen
 * een andere vorm.
 */

export type ChatRowData = {
  key: string;
  name: string;
  initial: string;
  hue: Hue;
  time: string;
  preview: string;
  unread: number;
  onPress: () => void;
  /** Lang drukken / rechtsklikken: gelezen of ongelezen (ChatReadMenu). */
  menu?: object;
};

export function ChatsModern({
  rows,
  unread,
  scheme,
  t,
  footer,
  state,
  banner,
}: {
  rows: ChatRowData[];
  unread: number;
  scheme: Scheme;
  t: Dict;
  /** De gestippelde tegel onderaan: een nieuwe groep. */
  footer?: React.ReactNode;
  /** Laden, mislukt of leeg — één regel in een tegel. */
  state?: string | null;
  /** De rode band met het aantal nieuwe berichten, onder de titel. */
  banner?: React.ReactNode;
}) {
  return (
    <LincinScreen tab="chats" counter={t.tabChats}>
      <Bento>
        <TitleTile title={t.chats} meta={`${unread} ${t.unread}`} />
        {banner ? <View style={{ width: "100%" }}>{banner}</View> : null}
        {state ? (
          <Tile span={2}>
            <TileMeta>{state}</TileMeta>
          </Tile>
        ) : null}
        {rows.map((r) => {
          const fc = friendColor(r.hue, scheme);
          return (
            <Tile
              key={r.key}
              span={2}
              pad={14}
              onPress={r.onPress}
              menu={r.menu}
              accessibilityLabel={r.unread > 0 ? `${r.name}, ${r.unread} ${t.unread}` : r.name}
              style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight: 76 }}
            >
              <View
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: fc.fill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ ...sans(500), fontSize: 17, lineHeight: 20, color: fc.ink }}>{r.initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <TileTitle size={15} numberOfLines={1}>
                    {r.name}
                  </TileTitle>
                  <View style={{ flexShrink: 0 }}>
                    <TileMeta>{r.time}</TileMeta>
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ ...sans(r.unread > 0 ? 600 : 400), fontSize: 13, lineHeight: 17, color: r.unread > 0 ? color("ink") : color("ink", "inkDim") }}
                >
                  {r.preview}
                </Text>
              </View>
              {r.unread > 0 ? (
                <View
                  style={{
                    flexShrink: 0,
                    minWidth: 26,
                    height: 26,
                    paddingHorizontal: 7,
                    borderRadius: 13,
                    backgroundColor: color("red"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ ...mono(600), fontSize: 12, lineHeight: 15, color: ON_DARK }}>{r.unread}</Text>
                </View>
              ) : null}
            </Tile>
          );
        })}
        {footer}
      </Bento>
    </LincinScreen>
  );
}
