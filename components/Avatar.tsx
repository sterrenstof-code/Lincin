import { Text, View } from "react-native";

/**
 * Initial-circle avatar. Used everywhere a user is shown.
 * Size variants map to the spacing scale in DESIGN.md.
 */
export type AvatarSize = "sm" | "md" | "lg" | "hero";

const SIZE: Record<AvatarSize, { box: string; text: string }> = {
  sm: { box: "w-9 h-9", text: "text-sm" },
  md: { box: "w-11 h-11", text: "text-base" },
  lg: { box: "w-14 h-14", text: "text-lg" },
  hero: { box: "w-20 h-20", text: "text-2xl" },
};

export function Avatar({
  name,
  size = "md",
  tint = "warm",
}: {
  name: string | null | undefined;
  size?: AvatarSize;
  tint?: "warm" | "soft" | "light";
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const s = SIZE[size];
  const bg =
    tint === "warm"
      ? "bg-paper-warm"
      : tint === "light"
        ? "bg-paper-light"
        : "bg-paper-soft";
  return (
    <View className={`${s.box} ${bg} rounded-full items-center justify-center`}>
      <Text className={`${s.text} text-ink font-bold`}>{initial}</Text>
    </View>
  );
}
