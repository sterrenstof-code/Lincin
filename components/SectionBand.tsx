import { Text, View } from "react-native";

import { bandFor, FEED_BORDER, feed, feedType, space } from "@/lib/design/type";

/**
 * De kop van een rubriek: een volle band met een nummer en een woord.
 *
 * Hiervoor stond er een klein rood kopje boven elke rubriek. Dat leest als
 * een voetnoot bij de inhoud eronder, terwijl het de inhoudsopgave van de
 * uitgave hoort te zijn: je moet in één oogopslag zien hoeveel rubrieken er
 * zijn en waar je bent. Eén band, één nummer, één woord — verder niets.
 *
 * De kleur komt uit de plek in de rij (`bandFor`), niet uit de betekenis
 * van de rubriek: het is een register, geen codering die je moet leren.
 */
export function SectionBand({ index, label }: { index: number; label: string }) {
  const tone = bandFor(index);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        backgroundColor: tone.fill,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
    >
      <Text style={[feedType.label, { fontSize: 11, color: tone.on, opacity: 0.7 }]}>
        {String(index + 1).padStart(2, "0")}
      </Text>
      <Text
        style={[
          feedType.tile,
          { fontSize: 17, lineHeight: 21, fontWeight: "800", color: tone.on, flex: 1 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
