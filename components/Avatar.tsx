import { Image } from "expo-image";
import { Text, View } from "react-native";

/**
 * Initial-circle avatar. Used everywhere a user is shown.
 * Als `lastSeenAt` meegegeven wordt, toont een activiteitsdot:
 *   groen  = actief < 5 min geleden
 *   grijs  = actief < 30 min geleden
 */
export type AvatarSize = "xs" | "sm" | "md" | "lg" | "hero";

const SIZE: Record<AvatarSize, { box: string; text: string; px: number; dot: number }> = {
  xs:   { box: "w-6 h-6",   text: "text-[9px]", px: 24, dot: 6  },
  sm:   { box: "w-9 h-9",   text: "text-sm",    px: 36, dot: 8  },
  md:   { box: "w-11 h-11", text: "text-base",  px: 44, dot: 10 },
  lg:   { box: "w-14 h-14", text: "text-lg",    px: 56, dot: 12 },
  hero: { box: "w-20 h-20", text: "text-2xl",   px: 80, dot: 14 },
};

function activityStatus(lastSeenAt?: string | null): "online" | "recent" | null {
  if (!lastSeenAt) return null;
  const mins = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
  if (mins < 5) return "online";
  if (mins < 30) return "recent";
  return null;
}

export function Avatar({
  name,
  avatarUrl,
  size = "md",
  tint = "warm",
  lastSeenAt,
}: {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: AvatarSize;
  tint?: "warm" | "soft" | "light";
  lastSeenAt?: string | null;
}) {
  const s = SIZE[size];
  const bg =
    tint === "warm" ? "bg-paper-warm" : tint === "light" ? "bg-paper-light" : "bg-paper-soft";

  const status = activityStatus(lastSeenAt);
  const dotColor = status === "online" ? "#22C55E" : "#9CA3AF"; // green-500 / gray-400

  const inner = avatarUrl ? (
    <View className={`${s.box} rounded-full overflow-hidden`}>
      <Image
        source={{ uri: avatarUrl, cacheKey: avatarUrl.split("?")[0] }}
        cachePolicy="disk"
        style={{ width: s.px, height: s.px }}
        contentFit="cover"
      />
    </View>
  ) : (
    <View className={`${s.box} ${bg} rounded-full items-center justify-center`}>
      <Text className={`${s.text} text-ink font-bold`}>
        {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );

  if (!status) return inner;

  return (
    <View style={{ position: "relative" }}>
      {inner}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: s.dot,
          height: s.dot,
          borderRadius: s.dot / 2,
          backgroundColor: dotColor,
          borderWidth: 1.5,
          borderColor: "#F5E8D3",
        }}
      />
    </View>
  );
}
