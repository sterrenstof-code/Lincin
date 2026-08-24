import { Text, View } from "react-native";

import { feed, FEED_BORDER, feedType, space } from "@/lib/design/type";

/**
 * De kop van een rubriek: een nummer, een woord, een lijn.
 *
 * Hiervoor stond er een klein rood kopje boven elke rubriek. Dat leest als
 * een voetnoot bij de inhoud eronder, terwijl het de inhoudsopgave van de
 * uitgave hoort te zijn: je moet in één oogopslag zien hoeveel rubrieken er
 * zijn en waar je bent.
 *
 * Daartussenin is het een volle gekleurde balk geweest. Die deed het werk
 * wel, maar bracht een tweede palet mee een pagina op die het met lavendel,
 * inkt en één rood afkan — en dan is de balk het luidste wat er staat
 * terwijl de vondsten eronder het onderwerp zijn. Wat overblijft is wat het
 * altijd al moest zijn: het nummer, het woord, en de lijn die het van de
 * inhoud scheidt. Geen vlak, geen kleur.
 */
export function SectionBand({ index, label }: { index: number; label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: space.md,
        paddingBottom: space.sm,
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: feed.ink,
      }}
    >
      <Text style={[feedType.label, { fontSize: 12, color: feed.inkDim }]}>
        {String(index + 1).padStart(2, "0")}
      </Text>
      <Text
        style={[
          feedType.label,
          {
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 0.6,
            color: feed.ink,
            flex: 1,
          },
        ]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
