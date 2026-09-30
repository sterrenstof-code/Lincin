import { Image } from "expo-image";
import { useState } from "react";

import { IMG, resizedPublicUrl, stableCacheKey } from "@/lib/media";

/**
 * De foto van een persoon of groep, over de initiaal heen.
 *
 * Zet hem als laatste kind in het vakje dat de initiaal draagt; hij vult
 * dat vakje helemaal (het vakje zelf zorgt met `overflow: "hidden"` voor de
 * vorm). Geen foto, of een foto die niet laadt: dan tekent hij niets en
 * blijft de initiaal eronder gewoon staan — dezelfde terugval als `Avatar`.
 */
export function AvatarPhoto({ url, size }: { url: string | null | undefined; size: number }) {
  const [errored, setErrored] = useState(false);
  const src = resizedPublicUrl(url, IMG.avatar(size));
  if (!src || errored) return null;
  return (
    <Image
      source={{ uri: src, cacheKey: stableCacheKey(url, IMG.avatar(size)) }}
      cachePolicy="disk"
      contentFit="cover"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      onError={() => setErrored(true)}
      accessibilityIgnoresInvertColors
    />
  );
}
