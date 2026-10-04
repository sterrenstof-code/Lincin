import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useFeedCard } from "@/components/lincin/feed/useFeed";
import { SafeImage } from "@/components/SafeImage";
import type { PostRef } from "@/lib/api/messages";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";

/**
 * Een gedeelde bijdrage in een gesprek (Gesprek Voorbeeld 1a): een kaart
 * van 260 met een kader van 1 inkt en een rug van 5 in de kleur van de
 * maker — "BIJDRAGE № 01 · NOOR · FOTO", de titel in serif italic, OPEN →,
 * en rechts de foto. Een tik opent de bijdrage.
 *
 * Wat de kaart weet komt uit de feed (`useFeedCard`); staat de bijdrage
 * daar niet meer in, dan alleen de titel uit het bericht zelf.
 */
export function PostRefCard({ postRef, isMine }: { postRef: PostRef; isMine: boolean }) {
  const router = useRouter();
  const scheme = useScheme();
  const modern = useThemeSpec().id === "modern";
  useHueChoices();
  const { card, number } = useFeedCard(postRef.id);
  const hue = card?.swatch ?? (card ? hueFor(card.authorId) : "orange");
  const fc = friendColor(hue, scheme);
  const photo = card?.media.kind === "foto" ? card.media : null;
  const kicker = ["Bijdrage", number ? `№ ${number}` : null, card?.authorName, card?.kind].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Bijdrage: ${card?.title ?? postRef.title}`}
      onPress={() => router.push(`/post/${postRef.id}` as never)}
      style={({ pressed }) => ({
        alignSelf: isMine ? "flex-end" : "flex-start",
        width: 260,
        flexDirection: "row",
        borderWidth: modern ? 0 : 1,
        borderColor: color("ink"),
        borderLeftWidth: 5,
        borderLeftColor: fc.fill,
        borderRadius: modern ? 14 : 0,
        overflow: "hidden",
        backgroundColor: color("paper"),
        opacity: pressed ? 0.85 : 1,
        marginBottom: 4,
      })}
    >
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 12, gap: 6 }}>
        <Text numberOfLines={2} style={[sans(700), { fontSize: 8, lineHeight: 11, letterSpacing: 1.76, textTransform: "uppercase", color: color("ink") }]}>
          {kicker}
        </Text>
        <Text numberOfLines={2} style={[serif(true), { fontSize: 19, lineHeight: 22, color: color("ink") }]}>
          {card?.title ?? postRef.title}
        </Text>
        <Text style={[sans(700), { fontSize: 9, lineHeight: 12, letterSpacing: 1.4, textTransform: "uppercase", color: color("ink") }]}>Open →</Text>
      </View>
      {photo?.uris[0] ? (
        <View style={{ width: 84, alignSelf: "stretch", backgroundColor: color("paper2") }}>
          <SafeImage uri={photo.uris[0]} cacheKey={photo.cacheKeys[0]} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        </View>
      ) : null}
    </Pressable>
  );
}
