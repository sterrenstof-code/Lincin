import { Text, View } from "react-native";

import { ON_DARK, color } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";

/**
 * Het aantal naast een rubriek in de navigatie: een rood blokje met een
 * cijfer, zoals Telegram. Dit was een stip van 6 — die zei dát er iets lag,
 * niet hoeveel, en werd over het hoofd gezien.
 */
export function CountBadge({ count, round = true }: { count: number; round?: boolean }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: round ? 9 : 0,
        backgroundColor: color("red"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[sans(800), { fontSize: 11, lineHeight: 13, letterSpacing: 0, color: ON_DARK }]}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}
