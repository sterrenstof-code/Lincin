import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageProps } from "expo-image";
import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Skeleton } from "@/components/Skeleton";
import { feed } from "@/lib/design/type";

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
  fallbackColor = feed.inkDim,
  iconSize = 32,
  containerStyle,
  skeleton = true,
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
  /**
   * Een kloppend vlak zolang de foto onderweg is. Uit te zetten voor beeld
   * dat al een eigen wachtstand heeft.
   */
  skeleton?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
    <>
      {/*
          Zolang de foto onderweg is staat er een pulserend vlak op zijn
          plek. Niet uit cosmetica: zonder dat is er een gat in de bladspiegel
          dat pas dichtgaat als de foto binnen is, en op een trage lijn leest
          dat als een pagina die stuk is. Het vlak ligt eróver en niet
          eronder, zodat het exact de maat van het beeld heeft, wat de
          aanroeper die maat ook geeft.
      */}
      <Image
        {...rest}
        source={{ uri, cacheKey: cacheKey ?? uri }}
        cachePolicy="disk"
        onError={() => setErrored(true)}
        onLoadEnd={() => setLoaded(true)}
      />
      {skeleton && !loaded ? (
        <Skeleton
          className="bg-paper-warm"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
    </>
  );
}
