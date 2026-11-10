import { useSyncExternalStore } from "react";
import { Platform, useWindowDimensions } from "react-native";

import { useThemeSpec } from "@/lib/design/theme";

import { BREED_VANAF } from "../stijl";
import { WEERGAVEN, type Weergave } from "./typen";

/**
 * De gekozen weergave van de feed op desktop (briefing §3).
 *
 * Per gebruiker, op dit toestel, net als het thema catalogus zelf (dat kent de
 * database nog niet: CATALOGUS-VERSLAG §3). Synchroon gelezen uit
 * `localStorage`, zodat het eerste beeld al de juiste weergave heeft.
 * Standaard `wand`.
 */

const STANDAARD: Weergave = "wand";
const sleutel = (gebruiker: string) => `lincin.weergave.${gebruiker}`;
const luisteraars = new Set<() => void>();
const geheugen = new Map<string, Weergave>();

function lees(gebruiker: string): Weergave {
  const vast = geheugen.get(gebruiker);
  if (vast) return vast;
  let w: Weergave = STANDAARD;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(sleutel(gebruiker)) : null;
    if (raw && (WEERGAVEN as string[]).includes(raw)) w = raw as Weergave;
  } catch {
    // geen opslag: de standaard
  }
  geheugen.set(gebruiker, w);
  return w;
}

export function kiesWeergave(gebruiker: string, w: Weergave) {
  geheugen.set(gebruiker, w);
  try {
    localStorage.setItem(sleutel(gebruiker), w);
  } catch {
    // alleen voor deze sessie
  }
  for (const f of luisteraars) f();
}

function abonneer(f: () => void) {
  luisteraars.add(f);
  return () => {
    luisteraars.delete(f);
  };
}

export function useWeergave(gebruiker: string): Weergave {
  return useSyncExternalStore(abonneer, () => lees(gebruiker), () => STANDAARD);
}

/**
 * Catalogus heeft vanaf 1024 breed een desktopvorm, alleen op web. Op een
 * tablet (native) blijft de telefoonvorm in de kolom (app/_layout.tsx).
 */
export function useCatalogusDesktop(): boolean {
  const { width } = useWindowDimensions();
  const catalogus = useThemeSpec().layout === "catalogus";
  return Platform.OS === "web" && catalogus && width >= BREED_VANAF;
}

/** De routes die op desktop een eigen vorm hebben; de rest blijft in de kolom. */
export function heeftDesktopVorm(pad: string): boolean {
  return /^\/(feed|chats|events|profile)\/?$/.test(pad) || /^\/(post|chat)\/[^/]+\/?$/.test(pad) || pad.startsWith("/dev/catalogus-desktop/");
}
