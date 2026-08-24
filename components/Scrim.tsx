import { View, type StyleProp, type ViewStyle } from "react-native";

import { scrimSteps } from "@/lib/design/type";

/**
 * De sluier onder een foto waar tekst over staat.
 *
 * Geen schaduw — die staan niet in dit systeem — maar een verloop van
 * niets naar bijna-zwart, zodat de naam van de uploader leesbaar is zonder
 * dat er een balk over het beeld ligt.
 *
 * Waarom een stapel vlakken en geen `linear-gradient`: er zit geen
 * gradient-bibliotheek in dit project en react-native kent de eigenschap
 * niet. Twaalf stappen met een kwadratische kromme zijn op een scherm niet
 * van een verloop te onderscheiden; de drie brokken die hier eerst stonden
 * wél — die zag je als drie banden.
 */
export function Scrim({
  height = 160,
  strength = 0.72,
  steps = 12,
  style,
}: {
  /** Hoe hoog de sluier wordt, gemeten van de onderkant. */
  height?: number;
  /** Hoe donker hij onderaan wordt (0–1). */
  strength?: number;
  steps?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const bands = scrimSteps(strength, steps);
  return (
    <View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, right: 0, bottom: 0 }, style]}
    >
      {bands.map((color, i) => (
        <View key={i} style={{ height: height / steps, backgroundColor: color }} />
      ))}
    </View>
  );
}
