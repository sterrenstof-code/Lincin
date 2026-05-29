import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageProps } from "expo-image";
import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Image-wrapper die bij broken URL, lege source of laad-fout terugvalt op
 * een placeholder met icoon. Voorkomt witte/zwarte gaten in de UI wanneer
 * signed URLs expireren of het netwerk faalt.
 *
 * `cacheKey` — stabiele sleutel voor de schijfcache (bijv. `image_path`).
 * Omdat Supabase signed URLs bij elke fetch veranderen maar de inhoud
 * hetzelfde blijft, gebruiken we `cacheKey` om de cache-hit te garanderen
 * ongeacht de URL. Zonder `cacheKey` herlaadt expo-image elke navigatie.
 */
export function SafeImage({
  uri,
  cacheKey,
  fallbackIcon = "image-outline",
  fallbackBg = "bg-paper-warm",
  fallbackColor = "#5A4F40",
  iconSize = 32,
  containerStyle,
  ...rest
}: Omit<ImageProps, "source"> & {
  uri: string | null | undefined;
  /** Stabiele cache-sleutel los van de URL, bijv. de storage path. */
  cacheKey?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackBg?: string;
  fallbackColor?: string;
  iconSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [errored, setErrored] = useState(false);

  if (!uri || errored) {
    return (
      <View
        style={[rest.style as any, containerStyle]}
        className={`${fallbackBg} items-center justify-center`}
      >
        <Ionicons name={fallbackIcon} color={fallbackColor} size={iconSize} />
      </View>
    );
  }

  return (
    <Image
      {...rest}
      source={{ uri, cacheKey: cacheKey ?? uri }}
      cachePolicy="disk"
      onError={() => setErrored(true)}
    />
  );
}
