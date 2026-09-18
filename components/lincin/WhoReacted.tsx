import type { StyleProp, TextStyle } from "react-native";

import { Mono } from "./ui";

/**
 * De voorvertoning onder een rij reacties: "❤️😂 Jij, Johanna en 2 anderen"
 * (zie `useReactionWho` in lib/lincin/reactors.ts). Niets als er niets is.
 */
export function WhoReacted({ line, color, style }: { line: string; color?: string; style?: StyleProp<TextStyle> }) {
  if (!line) return null;
  return (
    <Mono variant="tiny" tone={color ? undefined : "dim"} color={color} numberOfLines={1} style={[{ textTransform: "none", letterSpacing: 0 }, style]}>
      {line}
    </Mono>
  );
}
