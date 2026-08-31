import { Platform, Pressable, Text, View } from "react-native";

import {
  applyInlineMarker,
  applyLinePrefix,
  insertRule,
  type EditResult,
  type Selection,
} from "@/lib/richtext";
import { feed, FEED_BORDER, feedType, flameDeep, space } from "@/lib/design/type";

/**
 * De opmaakbalk boven een tekstveld.
 *
 * Vijf knoppen, en dat is met opzet het maximum: vet, cursief, citaat,
 * opsomming, scheidingslijn. Alles wat een schrijver aan een fragment kan
 * toevoegen zonder het ontwerp van de app te overschrijven staat erin, en
 * er staat niets in dat dat wél zou doen.
 *
 * ---------------------------------------------------------------
 * WAAROM ONMOUSEDOWN EN NIET ONPRESS
 * ---------------------------------------------------------------
 * Een tik op een knop haalt op web de aandacht weg bij het tekstveld, en
 * dáármee verdwijnt de selectie waar de knop iets mee moest doen. Het is
 * de klassieke val van elke opmaakbalk. `onMouseDown` afbreken houdt de
 * cursor staan waar hij stond; op native speelt het niet, want daar
 * verliest een Pressable de focus van een TextInput niet.
 */
export function FormatBar({
  value,
  selection,
  onChange,
}: {
  value: string;
  /** De huidige selectie, bijgehouden via `onSelectionChange` op het veld. */
  selection: Selection;
  /** Nieuwe tekst plus waar de cursor daarna hoort te staan. */
  onChange: (next: EditResult) => void;
}) {
  const buttons: {
    key: string;
    label: string;
    hint: string;
    style?: object;
    run: () => EditResult;
  }[] = [
    {
      key: "bold",
      label: "B",
      hint: "Vet",
      style: { fontWeight: "800" as const },
      run: () => applyInlineMarker(value, selection, "**"),
    },
    {
      key: "italic",
      label: "I",
      hint: "Cursief",
      style: { fontStyle: "italic" as const, fontWeight: "500" as const },
      run: () => applyInlineMarker(value, selection, "*"),
    },
    {
      key: "quote",
      label: "“",
      hint: "Citaat",
      run: () => applyLinePrefix(value, selection, "> "),
    },
    {
      key: "list",
      label: "•",
      hint: "Opsomming",
      style: { fontSize: 19 },
      run: () => applyLinePrefix(value, selection, "- "),
    },
    {
      key: "ordered",
      label: "1.",
      hint: "Genummerde opsomming",
      run: () => applyLinePrefix(value, selection, "1. "),
    },
    {
      key: "rule",
      label: "—",
      hint: "Scheidingslijn",
      run: () => insertRule(value, selection),
    },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: feed.ink,
        marginTop: space.sm,
      }}
    >
      {/* Geen hitSlop op deze knoppen: ze staan zonder tussenruimte tegen
          elkaar (alleen een lijn ertussen), dus elke slop legt de ene knop
          over de andere — de rechterrand van B zou cursief maken. */}
      {buttons.map((button, i) => (
        <Pressable
          key={button.key}
          accessibilityLabel={button.hint}
          accessibilityRole="button"
          onPress={() => onChange(button.run())}
          // Zie de kop van dit bestand: hiermee blijft de selectie staan.
          {...(Platform.OS === "web"
            ? { onMouseDown: (e: any) => e.preventDefault() }
            : null)}
          style={({ pressed }) => ({
            width: 44,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? feed.panel : "transparent",
            ...(i === 0
              ? null
              : { borderLeftWidth: FEED_BORDER, borderLeftColor: feed.ink }),
          })}
        >
          <Text
            style={[
              feedType.body,
              { fontSize: 15, lineHeight: 20, color: feed.ink },
              button.style,
            ]}
          >
            {button.label}
          </Text>
        </Pressable>
      ))}

      <View style={{ flex: 1, justifyContent: "center", paddingLeft: space.md }}>
        <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.5 }]}>
          OPMAAK
        </Text>
      </View>
    </View>
  );
}
