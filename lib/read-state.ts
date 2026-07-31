import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

/**
 * Bijhouden welke vondsten je al gezien hebt, zodat de feed ze kan
 * uitgrijzen.
 *
 * ---------------------------------------------------------------
 * WAAROM LOKAAL EN NIET IN DE DATABASE
 * ---------------------------------------------------------------
 * "Gelezen" is een eigenschap van dit toestel, niet van de vondst. Zou het
 * op de server staan, dan is het een leesbevestiging: dan weet de deler
 * wanneer jij zijn vondst hebt bekeken. Dat is precies het soort teller dat
 * dit product niet wil hebben — het maakt van delen een prestatie met
 * publiek. Lokaal opslaan geeft je hetzelfde nut (zien wat nieuw is) zonder
 * dat iemand anders het kan aflezen.
 *
 * Praktisch gevolg: op een tweede toestel begin je opnieuw. Dat is de
 * juiste ruil.
 *
 * `@react-native-async-storage/async-storage` zat al in het project (de
 * Supabase-client gebruikt hem voor de auth-sessie op native), dus dit
 * kost geen nieuwe dependency. Op web valt hij terug op localStorage.
 */

const KEY = "lincin.seen-posts.v1";
/**
 * Bovengrens op wat we bewaren. Zonder grens groeit de sleutel eindeloos;
 * met een grens vergeten we het oudste, en dat is precies wat je wil —
 * een vondst van een jaar geleden hoeft niet meer als "gelezen" te tellen.
 */
const MAX = 500;

/** In-memory spiegel, zodat de feed niet per tegel de opslag hoeft te lezen. */
let cache: string[] | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

async function load(): Promise<string[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Kapotte of onleesbare opslag mag de feed nooit tegenhouden.
    cache = [];
  }
  return cache;
}

function notify() {
  const set = new Set(cache ?? []);
  listeners.forEach((fn) => fn(set));
}

/** Markeer een vondst als gezien. Nieuwste vooraan, oudste valt eraf. */
export async function markSeen(id: string): Promise<void> {
  const list = await load();
  if (list[0] === id) return;
  const next = [id, ...list.filter((x) => x !== id)].slice(0, MAX);
  cache = next;
  notify();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Niet kunnen bewaren is vervelend maar niet fataal: de in-memory
    // spiegel klopt nog voor deze sessie.
  }
}

/** Wis de hele leesgeschiedenis. */
export async function clearSeen(): Promise<void> {
  cache = [];
  notify();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* zie hierboven */
  }
}

/**
 * De set met geziene id's, die meebeweegt als er iets bijkomt.
 *
 * Geeft een lege set terug tot de opslag geladen is — dan is er even niets
 * uitgegrijsd, wat beter is dan de feed laten wachten op een leesactie.
 */
export function useSeenPosts(): {
  seen: Set<string>;
  isSeen: (id: string) => boolean;
} {
  const [seen, setSeen] = useState<Set<string>>(() => new Set(cache ?? []));

  useEffect(() => {
    let alive = true;
    load().then((list) => {
      if (alive) setSeen(new Set(list));
    });
    listeners.add(setSeen);
    return () => {
      alive = false;
      listeners.delete(setSeen);
    };
  }, []);

  const isSeen = useCallback((id: string) => seen.has(id), [seen]);
  return { seen, isSeen };
}
