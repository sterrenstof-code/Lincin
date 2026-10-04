import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { supabase } from "./supabase/client";

/**
 * Bijhouden wat je al gezien hebt, zodat de feed weet wat nieuw is.
 *
 * Nieuw is wat er gedeeld werd sinds je hier de vorige keer was — ook als
 * je het toen niet opende. Wie de site bezocht, heeft gezien wat er toen
 * stond. Daarnaast telt alles wat je opende als gezien (`markSeen`).
 *
 * ---------------------------------------------------------------
 * LOKAAL ÉN OP DE SERVER, VAN JOU ALLEEN
 * ---------------------------------------------------------------
 * "Gelezen" mag nooit een leesbevestiging worden: de deler hoort niet te
 * weten wanneer jij zijn vondst bekeek. Daarom stond het tot okt 2026
 * alleen op het toestel — met als prijs dat je op een tweede toestel
 * opnieuw begon.
 *
 * Nu staat het ook op de server (0083: `item_seen`, `reading_state`), maar
 * alleen leesbaar voor jezelf; dat dwingen de policies af. Het toestel
 * blijft eerst: het werkt meteen en zonder verbinding, en de server vult
 * aan wat een ander toestel al zag. Samenvoegen gaat altijd richting
 * "gezien" — nooit wordt iets weer nieuw.
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

/** Zo vaak gaat "nu hier" naar de server — minder vaak dan naar het toestel. */
const SERVER_BEAT_MS = 5 * 60_000;
let lastServerBeat = 0;

async function myUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** "Ik ben hier" naar de server; de functie schuift alleen vooruit (0083). */
function pushBeat(force = false) {
  if (!force && lastBeat - lastServerBeat < SERVER_BEAT_MS) return;
  lastServerBeat = lastBeat;
  myUserId().then((uid) => {
    if (!uid) return;
    supabase.rpc("touch_reading_state", { p_at: new Date(lastBeat).toISOString() }).then(
      () => {},
      () => {},
    );
  });
}

function beat(force = false) {
  lastBeat = Date.now();
  AsyncStorage.setItem(LAST_KEY, String(lastBeat)).catch(() => {});
  pushBeat(force);
}

function setSince(ms: number) {
  since = ms;
  sinceListeners.forEach((fn) => fn(ms));
}

/** Eén keer per app: de vorige keer lezen, en vanaf nu bijhouden dat je hier bent. */
function start() {
  if (started) return;
  started = true;
  // Het vorige bezoek van dít toestel meteen, en daarna dat van je andere
  // toestellen als dat later was. Lezen gebeurt vóór de eerste "nu hier",
  // anders zou de server dit bezoek zelf als vorige keer teruggeven.
  const local = AsyncStorage.getItem(LAST_KEY)
    .then((raw) => (raw ? Number(raw) || 0 : 0))
    .catch(() => 0);
  local.then(setSince);
  Promise.all([local, serverLastActive()])
    .then(([l, server]) => {
      if (server > l && (since ?? 0) < server) setSince(server);
    })
    .finally(() => beat(true));
  setInterval(() => {
    if (AppState.currentState === "active") beat();
  }, BEAT_MS);
  AppState.addEventListener("change", (state) => {
    if (state !== "active") {
      beat(true);
      return;
    }
    // Terug na een tijd weg: een nieuw bezoek, met de vorige keer als grens.
    if (Date.now() - lastBeat > AWAY_MS) setSince(lastBeat);
    beat();
  });
}

async function serverLastActive(): Promise<number> {
  const uid = await myUserId();
  if (!uid) return 0;
  const { data } = await supabase.from("reading_state").select("last_active_at").eq("user_id", uid).maybeSingle();
  return data?.last_active_at ? new Date(data.last_active_at).getTime() : 0;
}

/** In-memory spiegel, zodat de feed niet per tegel de opslag hoeft te lezen. */
let cache: string[] | null = null;
const listeners = new Set<(ids: Set<string>) => void>();

let merged = false;

async function load(): Promise<string[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    // Kapotte of onleesbare opslag mag de feed nooit tegenhouden.
    cache = [];
  }
  if (!merged) {
    merged = true;
    mergeFromServer();
  }
  return cache;
}

/**
 * Wat je andere toestellen al zagen erbij. Eén keer per sessie, op de
 * achtergrond: de feed wacht er niet op.
 */
async function mergeFromServer() {
  const uid = await myUserId();
  if (!uid) return;
  const { data, error } = await supabase
    .from("item_seen")
    .select("item_id")
    .eq("user_id", uid)
    .order("seen_at", { ascending: false })
    .limit(MAX);
  if (error || !data?.length) return;
  const local = cache ?? [];
  const have = new Set(local);
  const extra = data.map((r) => r.item_id as string).filter((id) => !have.has(id));
  if (extra.length === 0) return;
  cache = [...local, ...extra].slice(0, MAX);
  notify();
  AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
}

function notify() {
  const set = new Set(cache ?? []);
  listeners.forEach((fn) => fn(set));
}

/** Markeer een vondst als gezien. Nieuwste vooraan, oudste valt eraf. */
export async function markSeen(id: string): Promise<void> {
  const list = await load();
  if (list[0] === id) return;
  // Naar de server ook, voor je andere toestellen. Van jou alleen (0083).
  myUserId().then((uid) => {
    if (!uid) return;
    supabase
      .from("item_seen")
      .upsert({ user_id: uid, item_id: id, seen_at: new Date().toISOString() })
      .then(
        () => {},
        () => {},
      );
  });
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
  /** Is de vorige keer al gelezen? Daarvóór telt alles even als gezien. */
  ready: boolean;
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
  return { seen, isSeen, ready: sinceMs !== null };
}
