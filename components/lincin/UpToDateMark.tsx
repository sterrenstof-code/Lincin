import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { color, useThemeSpec } from "@/lib/design/theme";
import { useT } from "@/lib/i18n";

/**
 * Niets nieuw: een vinkje in plaats van een zin. "Je bent bij. Alles
 * hieronder heb je al gezien." stond op de plek waar nieuwe bijdragen
 * horen, en las als nog iets om te lezen. Een teken zegt hetzelfde zonder
 * aandacht te vragen.
 *
 *   magazine  een haarlijncirkel
 *   modern    een zacht rondje van het papier
 *
 * De zin blijft staan als label, voor wie hem niet ziet.
 */
export function UpToDateMark({ size = 56 }: { size?: number }) {
  const t = useT();
  const th = useThemeSpec().id;
  const ink = color("ink", "inkDim");
  const check = "M16 28.5 L24.5 37 L40 20";
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${t.upToDateDot} ${t.allSeenBelow}`}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 }}
    >
      <Svg width={size} height={size} viewBox="0 0 56 56">
        {th === "magazine" ? (
          <Circle cx={28} cy={28} r={27} fill="none" stroke={ink} strokeWidth={1} />
        ) : (
          <Circle cx={28} cy={28} r={28} fill={color("paper")} />
        )}
        <Path d={check} fill="none" stroke={ink} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
