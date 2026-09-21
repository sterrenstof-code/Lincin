import { Platform } from "react-native";

/**
 * De scrollrand (WIJZIGINGEN-2.2 §5).
 *
 * Elke hoofdscroller krijgt bovenaan een maskerfade van 18 px, zodat de
 * inhoud oplost onder de kopregel in plaats van er hard tegenaan te lopen.
 * In het prototype is dat de klasse `.vfade`:
 *
 *   mask-image: linear-gradient(180deg, transparent 0, #000 18px)
 *
 * Web krijgt precies dat. Native kent geen maskers zonder een extra
 * pakket, en daar blijft de rand dus weg — een gradient in papierkleur
 * eroverheen zou op een getint of gehaasd blad juist een zichtbare streep
 * zijn, en dat is erger dan geen fade.
 *
 * Zet hem op de scroller zelf, naast de eigen stijl:
 *
 *   <ScrollView style={[{ flex: 1 }, vfade()]} …>
 */

export const FADE = 18;

const MASK = `linear-gradient(180deg, transparent 0, #000 ${FADE}px)`;

export function vfade(): object | null {
  if (Platform.OS !== "web") return null;
  return { maskImage: MASK, WebkitMaskImage: MASK } as object;
}
