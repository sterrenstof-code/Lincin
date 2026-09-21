import { ON_LIGHT } from "@/lib/design/theme";
import { useId } from "react";
import type { TextStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * De sluier over de grote foto van magazine: inkt langs de randen waar de
 * tekst staat — boven (editie, navigatie), onder (reacties), links (titel,
 * bijschrift) en rechts (op spotlight) — en het midden van de foto vrij.
 *
 * Eerder stond de tekst er in `mix-blend-mode: difference` op. Dat leest
 * op zwart en wit, maar op een warme middentoon (een gele lamp, huid)
 * wordt papier daarmee een modderig blauw dat nauwelijks afsteekt. Papier
 * op een donkere rand leest op elke foto.
 */
export function HeroScrim() {
  // Eén id per sluier: op web staan meerdere schermen tegelijk in het document.
  const id = `scrim-${useId().replace(/[^a-z0-9]/gi, "")}`;
  return (
    <Svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <Defs>
        <LinearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={INK} stopOpacity={0.5} />
          <Stop offset="0.28" stopColor={INK} stopOpacity={0} />
          <Stop offset="0.62" stopColor={INK} stopOpacity={0} />
          <Stop offset="1" stopColor={INK} stopOpacity={0.55} />
        </LinearGradient>
        <LinearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={INK} stopOpacity={0.4} />
          <Stop offset="0.38" stopColor={INK} stopOpacity={0} />
          <Stop offset="0.62" stopColor={INK} stopOpacity={0} />
          <Stop offset="1" stopColor={INK} stopOpacity={0.4} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-v)`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-h)`} />
    </Svg>
  );
}

const INK = ON_LIGHT;

/** Een zachte schaduw onder tekst op de foto, voor een drukke plek waar de sluier niet genoeg is. */
export const ON_IMAGE_SHADE: TextStyle = {
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};
