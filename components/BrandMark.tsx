import { Text } from "react-native";

import { creamOnDark, feedType } from "@/lib/design/type";

/**
 * Het woordmerk in de balk — NATIVE variant.
 *
 * De halftoon van de webversie leunt op `background-clip: text`: een
 * stippenpatroon dat binnen de letters wordt afgeknipt. Dat bestaat in
 * react-native niet, en het namaken zou betekenen dat je de letters als
 * beeld meelevert — een PNG per snit, per stand, per schermdichtheid, voor
 * één woord in een balk.
 *
 * Dus draagt native hetzelfde woord zonder raster. Het is dezelfde
 * afspraak als bij de fonts (§3): web krijgt de volledige uitvoering,
 * native de leesbare. Wie de twee naast elkaar legt ziet een verschil in
 * textuur, niet in wat er staat.
 */
export function BrandMark({ animated: _animated }: { animated?: boolean }) {
  return (
    <Text
      style={[
        feedType.label,
        {
          fontSize: 15,
          fontWeight: "900",
          letterSpacing: 1.2,
          color: creamOnDark.DEFAULT,
        },
      ]}
    >
      LINCIN
    </Text>
  );
}
