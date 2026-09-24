import { Text, type StyleProp, type TextStyle } from "react-native";

import { color as themeColor, useThemeSpec } from "@/lib/design/theme";
import { serif } from "@/lib/design/type";

import { Mono } from "./ui";

/**
 * De voorvertoning onder een rij reacties: "❤️😂 Jij, Johanna en 2 anderen"
 * (zie `useReactionWho` in lib/lincin/reactors.ts). Niets als er niets is.
 */
export function WhoReacted({ line, color, style }: { line: string; color?: string; style?: StyleProp<TextStyle> }) {
  const mag = useThemeSpec().id === "magazine";
  if (!line) return null;
  // Magazine (de omslag): cursieve serif in plaats van mono.
  if (mag)
    return (
      <Text numberOfLines={1} style={[serif(true), { fontSize: 15, lineHeight: 19, color: color ?? themeColor("ink", "inkDim") }, style]}>
        {line}
      </Text>
    );
  return (
    <Mono variant="tiny" tone={color ? undefined : "dim"} color={color} numberOfLines={1} style={[{ textTransform: "none", letterSpacing: 0 }, style]}>
      {line}
    </Mono>
  );
}
