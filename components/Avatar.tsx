import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";

import { feed } from "@/lib/design/type";
import { IMG, resizedPublicUrl, stableCacheKey } from "@/lib/media";

/**
 * Initial-circle avatar. Used everywhere a user is shown.
 * Als `lastSeenAt` meegegeven wordt, toont een activiteitsmarkering.
 *
 * ---------------------------------------------------------------
 * TWEE DINGEN DIE HIER EERDER MISGINGEN
 * ---------------------------------------------------------------
 * **De foto viel weg zonder terugval.** Dit onderdeel zette `expo-image`
 * rechtstreeks neer, zonder `onError`. Een verlopen signed URL of een
 * pad dat niet meer bestaat liet dus een lege cirkel achter — terwijl de
 * initialen die eronder hadden moeten staan hier al berekend worden. Nu
 * valt hij terug, precies zoals `SafeImage` dat voor gewoon beeld doet.
 *
 * **De stand stond in kleur alleen.** Groen tegenover grijs, allebei als
 * hex uitgeschreven (§7 kent geen hex inline), en verder niets. Wie het
 * kleurverschil niet ziet — een schermlezer, of iemand die rood-groen
 * niet onderscheidt — kreeg twee identieke stippen. Nu verschillen ze óók
 * van vorm: nu actief is een gevulde schijf, recent actief een open ring.
 * Vorm draagt de betekenis, kleur bevestigt hem.
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
  const [errored, setErrored] = useState(false);
  const bg =
    tint === "warm" ? "bg-paper-warm" : tint === "light" ? "bg-paper-light" : "bg-paper-soft";

  const status = activityStatus(lastSeenAt);

  // De avatar staat als volledige foto in de bucket — vaak megabytes voor
  // een cirkel van veertig pixels. We vragen hem op de maat op waarop hij
  // getoond wordt; zie lib/media.ts.
  const src = resizedPublicUrl(avatarUrl, IMG.avatar(s.px));

  const inner = src && !errored ? (
    <View className={`${s.box} rounded-full overflow-hidden`}>
      <Image
        source={{ uri: src, cacheKey: stableCacheKey(avatarUrl, IMG.avatar(s.px)) }}
        cachePolicy="disk"
        style={{ width: s.px, height: s.px }}
        contentFit="cover"
        onError={() => setErrored(true)}
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

  const online = status === "online";

  return (
    <View style={{ position: "relative" }}>
      {inner}
      <View
        accessibilityRole="text"
        accessibilityLabel={online ? "Nu actief" : "Recent actief"}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: s.dot,
          height: s.dot,
          borderRadius: s.dot / 2,
          // Gevuld tegenover open — zie de kop van dit bestand. De ring
          // eromheen is het paginavlak, zodat de stip loskomt van de foto
          // eronder in béide standen.
          backgroundColor: online ? feed.teal : feed.lav,
          borderWidth: online ? 1.5 : 2,
          borderColor: online ? feed.lav : feed.inkDim,
        }}
      />
    </View>
  );
}
