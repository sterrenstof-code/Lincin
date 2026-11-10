import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { KAARTJE_REGEL, kaartjeTekst, useCat } from "./stijl";

/**
 * Het kaartje (ontwerp 3e, "Het principe"): twee kolommen, label links en
 * waarde rechts, 9 px kapitaal. Bijschrift onder een voorwerp, kop van een
 * pagina, formulier en instellingenregel.
 *
 * De labelkolom is zo breed als het langste label, met 10 px tussenruimte;
 * de waarde loopt af met een beletselteken. Elke regel is precies één
 * kaartjesregel hoog, ook als de waarde leeg is, zodat label en waarde op
 * één lijn blijven.
 */
export type Regel = { label: string; waarde: string };

export function Kaartje({
  regels,
  style,
  testID = "kaartje",
}: {
  regels: Regel[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useCat();
  return (
    <View testID={testID} style={[{ flexDirection: "row", columnGap: 10, flexShrink: 1, minWidth: 0 }, style]}>
      <View style={{ flexShrink: 0 }}>
        {regels.map((r, i) => (
          <Text key={i} style={[kaartjeTekst, { color: c.label, height: KAARTJE_REGEL }]}>
            {r.label}
          </Text>
        ))}
      </View>
      <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: "auto", minWidth: 0 }}>
        {regels.map((r, i) => (
          <Text key={i} numberOfLines={1} style={[kaartjeTekst, { color: c.inkt, height: KAARTJE_REGEL }]}>
            {r.waarde}
          </Text>
        ))}
      </View>
    </View>
  );
}
