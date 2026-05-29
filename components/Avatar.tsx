import { Image } from "expo-image";
import { Text, View } from "react-native";

/**
 * Initial-circle avatar. Used everywhere a user is shown.
 * Size variants map to the spacing scale in DESIGN.md.
 * Als `avatarUrl` meegegeven wordt, toont het de foto in plaats van initialen.
 */
export type AvatarSize = "sm" | "md" | "lg" | "hero";

const SIZE: Record<AvatarSize, { box: string; text: string; px: number }> = {
  sm:   { box: "w-9 h-9",   text: "text-sm",   px: 36 },
  md:   { box: "w-11 h-11", text: "text-base",  px: 44 },
  lg:   { box: "w-14 h-14", text: "text-lg",    px: 56 },
  hero: { box: "w-20 h-20", text: "text-2xl",   px: 80 },
};

export function Avatar({
  name,
  avatarUrl,
  size = "md",
  tint = "warm",
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: AvatarSize;
  tint?: "warm" | "soft" | "light";
}) {
  const s = SIZE[size];
  const bg =
    tint === "warm"
      ? "bg-paper-warm"
      : tint === "light"
        ? "bg-paper-light"
        : "bg-paper-soft";

  if (avatarUrl) {
    return (
      <View className={`${s.box} rounded-full overflow-hidden`}>
        <Image
          source={{ uri: avatarUrl, cacheKey: avatarUrl.split("?")[0] }}
          cachePolicy="disk"
          style={{ width: s.px, height: s.px }}
          contentFit="cover"
        />
      </View>
    );
  }

  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <View className={`${s.box} ${bg} rounded-full items-center justify-center`}>
      <Text className={`${s.text} text-ink font-bold`}>{initial}</Text>
    </View>
  );
}
