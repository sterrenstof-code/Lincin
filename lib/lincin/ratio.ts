import { useEffect, useState } from "react";
import { Image } from "react-native";

/**
 * De verhouding van een foto, zoals Instagram hem toont: rand tot rand,
 * de hoogte uit het beeld zelf, maar begrensd tussen 4:5 (staand) en
 * 1.91:1 (liggend). Wat daarbuiten valt wordt aan de lange kant bijgesneden.
 *
 * Gemeten één keer per foto en bewaard per sleutel: een signed URL krijgt
 * bij elke ondertekening een ander token, het opslagpad niet — dus de
 * sleutel is het pad als dat er is (zie lib/media.ts).
 */

export const RATIO_MIN = 4 / 5;
export const RATIO_MAX = 1.91;
/** Zolang de maat onbekend is: vierkant, het midden van het bereik. */
export const RATIO_FALLBACK = 1;

const cache = new Map<string, number>();

export function clampRatio(r: number): number {
  if (!r || !isFinite(r)) return RATIO_FALLBACK;
  return Math.max(RATIO_MIN, Math.min(RATIO_MAX, r));
}

/** Breedte ÷ hoogte van de foto, begrensd; vierkant tot hij gemeten is. */
export function useImageRatio(uri: string | null | undefined, cacheKey?: string): number {
  const key = cacheKey ?? uri ?? "";
  const [ratio, setRatio] = useState(() => cache.get(key) ?? RATIO_FALLBACK);

  useEffect(() => {
    if (!uri) return;
    const hit = cache.get(key);
    if (hit) {
      setRatio(hit);
      return;
    }
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        const r = clampRatio(w / h);
        cache.set(key, r);
        if (alive) setRatio(r);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [uri, key]);

  return ratio;
}
