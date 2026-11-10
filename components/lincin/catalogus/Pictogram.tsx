import Svg, { Path } from "react-native-svg";

/**
 * De pictogrammen van catalogus. Getekend, geen emoji (ontwerp 3e): het
 * hartje, de ballon voor reacties, afspelen en pauze.
 */

const HART = "M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z";
const BALLON = "M4 5.5h16v11H9.5L5.5 20v-3.5H4z";

export function Hart({ maat = 24, kleur, vol = false, vulling }: { maat?: number; kleur: string; vol?: boolean; vulling?: string }) {
  const k = vol && vulling ? vulling : kleur;
  return (
    <Svg width={maat} height={maat} viewBox="0 0 24 24" fill={vol ? k : "none"} stroke={k} strokeWidth={1.8} strokeLinejoin="round">
      <Path d={HART} />
    </Svg>
  );
}

export function Ballon({ maat = 24, kleur }: { maat?: number; kleur: string }) {
  return (
    <Svg width={maat} height={maat} viewBox="0 0 24 24" fill="none" stroke={kleur} strokeWidth={1.8} strokeLinejoin="round">
      <Path d={BALLON} />
    </Svg>
  );
}

export function Speel({ maat = 14, kleur }: { maat?: number; kleur: string }) {
  return (
    <Svg width={maat} height={maat} viewBox="0 0 14 14">
      <Path d="M3 1.5v11l9-5.5z" fill={kleur} />
    </Svg>
  );
}

export function Pauze({ maat = 14, kleur }: { maat?: number; kleur: string }) {
  return (
    <Svg width={maat} height={maat} viewBox="0 0 14 14">
      <Path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill={kleur} />
    </Svg>
  );
}
