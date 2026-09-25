import { Pressable, Text, View } from "react-native";

import { ON_DARK, RASTER, color, useThemeSpec } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

/**
 * Een rode band bovenaan Gesprekken: "5 nieuwe berichten in 2 gesprekken".
 *
 * Het aantal ongelezen stond alleen als kleine grijze mono in de kop
 * ("0 ongelezen"), en in de rij als een klein cijfer — berichten werden
 * gemist. Deze band staat er alleen als er iets ongelezen is, dus als hij
 * er staat betekent hij iets. Tikken opent het eerste ongelezen gesprek.
 */
export function UnreadBanner({
  messages,
  chats,
  onPress,
  style,
}: {
  messages: number;
  chats: number;
  onPress: () => void;
  style?: object | null;
}) {
  const t = useT();
  const spec = useThemeSpec();
  if (messages <= 0) return null;
  const what = `${messages} ${messages === 1 ? t.newMsg : t.newMsgs}`;
  const where = chats === 1 ? t.inOneChat : t.inNChats.replace("{n}", String(chats));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${what} ${where}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          backgroundColor: color("red"),
          opacity: pressed ? 0.85 : 1,
        },
        spec.id === "modern" ? { borderRadius: RASTER.tileRadius } : null,
        style,
      ]}
    >
      <View style={{ minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: 999, backgroundColor: ON_DARK, alignItems: "center", justifyContent: "center" }}>
        <Text style={[sans(800), { fontSize: 15, lineHeight: 18, color: color("red") }]}>{messages > 99 ? "99+" : messages}</Text>
      </View>
      <Text numberOfLines={1} style={[sans(700), { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 19, color: ON_DARK }]}>
        {what} <Text style={[sans(400), { color: ON_DARK }]}>{where}</Text>
      </Text>
      <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: "uppercase", color: ON_DARK }]}>{t.readNow}</Text>
    </Pressable>
  );
}
