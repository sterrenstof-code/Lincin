import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Bijhouden wat je al gezien hebt, zodat de feed weet wat nieuw is.
 *
 * Nieuw is wat er gedeeld werd sinds je hier de vorige keer was — ook als
 * je het toen niet opende. Wie de site bezocht, heeft gezien wat er toen
 * stond. Daarnaast telt alles wat je opende als gezien (`markSeen`).
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

// ---------------------------------------------------------------
// DE VORIGE KEER
// ---------------------------------------------------------------

const LAST_KEY = "lincin.last-active.v1";
/** Zo vaak schrijven we "nu hier" weg terwijl de app open staat. */
const BEAT_MS = 60_000;
/** Wie langer weg was dan dit, begint bij terugkomst een nieuw bezoek. */
const AWAY_MS = 30 * 60_000;

/**
 * Het moment van je vorige bezoek: wat daarvóór gedeeld is, heb je gezien.
 * Blijft vast tijdens een bezoek, zodat nieuw niet verdwijnt terwijl je kijkt.
 * `null` tot de opslag gelezen is; 0 als je hier nooit eerder was.
 */
let since: number | null = null;
let lastBeat = Date.now();
let started = false;
const sinceListeners = new Set<(ms: number) => void>();

function beat() {
  lastBeat = Date.now();
  AsyncStorage.setItem(LAST_KEY, String(lastBeat)).catch(() => {});
}

function setSince(ms: number) {
  since = ms;
  sinceListeners.forEach((fn) => fn(ms));
}

/** Eén keer per app: de vorige keer lezen, en vanaf nu bijhouden dat je hier bent. */
function start() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(LAST_KEY)
    .then((raw) => setSince(raw ? Number(raw) || 0 : 0))
    .catch(() => setSince(0))
    .finally(beat);
  setInterval(() => {
    if (AppState.currentState === "active") beat();
  }, BEAT_MS);
  AppState.addEventListener("change", (state) => {
    if (state !== "active") {
      beat();
      return;
    }
    // Terug na een tijd weg: een nieuw bezoek, met de vorige keer als grens.
    if (Date.now() - lastBeat > AWAY_MS) setSince(lastBeat);
    beat();
  });
}

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

/**
 * Wat je gezien hebt: de geopende id's, en het moment van je vorige bezoek.
 *
 * Tot de opslag gelezen is, is `since` oneindig: dan telt even niets als
 * nieuw, wat beter is dan de feed laten wachten op een leesactie of alles
 * kort als nieuw laten oplichten.
 */
export function useSeenPosts(): {
  seen: Set<string>;
  isSeen: (id: string, createdAt?: string) => boolean;
} {
  const [seen, setSeen] = useState<Set<string>>(() => new Set(cache ?? []));
  const [sinceMs, setSinceMs] = useState<number | null>(since);

  useEffect(() => {
    let alive = true;
    start();
    load().then((list) => {
      if (alive) setSeen(new Set(list));
    });
    listeners.add(setSeen);
    sinceListeners.add(setSinceMs);
    if (since !== null) setSinceMs(since);
    return () => {
      alive = false;
      listeners.delete(setSeen);
      sinceListeners.delete(setSinceMs);
    };
  }, []);

  const isSeen = useCallback(
    (id: string, createdAt?: string) =>
      seen.has(id) || sinceMs === null || (!!createdAt && new Date(createdAt).getTime() <= sinceMs),
    [seen, sinceMs],
  );
  return { seen, isSeen };
}
