import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Een concept per bijdrage of gesprek (HANDOFF okt 2026, "Schrijfbalk"):
 * wat je half schreef, staat er nog als je terugkomt — ook na een andere
 * pagina of een herstart. Leeg is weg.
 *
 * In het geheugen voor meteen, en op het toestel voor later. Niet op de
 * server: een concept is van dit toestel, net als het toetsenbord.
 */
const memory = new Map<string, string>();
const PREFIX = "lincin.draft.";

export function useDraft(key: string | null): [string, (v: string | ((d: string) => string)) => void, () => void] {
  const [value, setValue] = useState(() => (key ? memory.get(key) ?? "" : ""));
  const keyRef = useRef(key);
  keyRef.current = key;

  // Eerst het geheugen, dan het toestel (native leest altijd async).
  useEffect(() => {
    if (!key) return;
    setValue(memory.get(key) ?? "");
    if (memory.has(key)) return;
    let alive = true;
    AsyncStorage.getItem(PREFIX + key)
      .then((raw) => {
        if (alive && raw && keyRef.current === key && !memory.has(key)) {
          memory.set(key, raw);
          setValue(raw);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  const set = useCallback((v: string | ((d: string) => string)) => {
    setValue((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      const k = keyRef.current;
      if (k) {
        if (next) memory.set(k, next);
        else memory.delete(k);
        (next ? AsyncStorage.setItem(PREFIX + k, next) : AsyncStorage.removeItem(PREFIX + k)).catch(() => {});
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => set(""), [set]);
  return [value, set, clear];
}

/** Bij uitloggen: concepten horen bij wie ze schreef, niet bij het toestel. */
export async function clearDrafts(): Promise<void> {
  memory.clear();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // niets te wissen
  }
}
