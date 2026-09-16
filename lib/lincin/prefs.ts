import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * De schakelaars van Instellingen (README §08), per gebruiker bewaard.
 *
 *   tint     het blad kleurt mee met de vriend in beeld
 *   pushNew  een melding bij nieuwe bijdragen
 *   quiet    stil tussen 23:00 en 08:00
 *   visible  lincs zien mijn bijdragen
 *
 * Alleen `tint` verandert nu al iets in de app (de feed leest hem).
 * De andere drie staan klaar voor de backend; ze worden wel onthouden.
 */
export type Prefs = {
  tint: boolean;
  pushNew: boolean;
  quiet: boolean;
  visible: boolean;
};

const DEFAULTS: Prefs = { tint: true, pushNew: true, quiet: false, visible: true };

const cache = new Map<string, Prefs>();
const listeners = new Set<() => void>();

function key(userId: string) {
  return `lincin.prefs.${userId}`;
}

async function load(userId: string): Promise<Prefs> {
  const hit = cache.get(userId);
  if (hit) return hit;
  let value = DEFAULTS;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw) value = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // onleesbare opslag: de standaard
  }
  cache.set(userId, value);
  return value;
}

export function setPref<K extends keyof Prefs>(userId: string, name: K, value: Prefs[K]) {
  const next = { ...(cache.get(userId) ?? DEFAULTS), [name]: value };
  cache.set(userId, next);
  for (const fn of listeners) fn();
  AsyncStorage.setItem(key(userId), JSON.stringify(next)).catch(() => {});
}

export function usePrefs(userId: string): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(() => cache.get(userId) ?? DEFAULTS);
  useEffect(() => {
    let alive = true;
    load(userId).then((p) => {
      if (alive) setPrefs(p);
    });
    const fn = () => setPrefs(cache.get(userId) ?? DEFAULTS);
    listeners.add(fn);
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, [userId]);
  return prefs;
}
