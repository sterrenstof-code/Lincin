import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { getLang, setLang, subscribeLang, type Lang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";

/**
 * De voorkeuren van één gebruiker (HANDOFF 23 sep §Vaste gedragsregels).
 *
 *   tint         het blad kleurt mee met de vriend in beeld
 *   pushNew      een melding bij nieuwe bijdragen
 *   quiet        stil tussen 23:00 en 08:00
 *   visible      lincs zien mijn bijdragen
 *   openDefault  vrienden in de feed staan standaard open (uit: ingeklapt)
 *   feedView     editie | friends | time; leeg = de standaard van het toestel
 *   openFriends  per vriend (of groep) je eigen keuze: open of dicht
 *
 * Lokaal gecachet per gebruiker (AsyncStorage) zodat de app meteen goed
 * opent, en bewaard in `user_prefs` (0070) zodat een tweede toestel
 * dezelfde keuzes kent. De taal reist mee in dezelfde rij.
 *
 * Wie wint: de database, tenzij je in deze sessie zelf al iets veranderde
 * vóór hij antwoordde — dezelfde regel als bij het thema.
 */
export type FeedView = "editie" | "friends" | "time";

export type Prefs = {
  tint: boolean;
  pushNew: boolean;
  quiet: boolean;
  visible: boolean;
  openDefault: boolean;
  feedView: FeedView | null;
  openFriends: Record<string, boolean>;
};

/** De schakelaars van Instellingen: alleen de booleans. */
export type TogglePref = "tint" | "pushNew" | "quiet" | "visible" | "openDefault";

const DEFAULTS: Prefs = {
  tint: true,
  pushNew: true,
  quiet: false,
  visible: true,
  openDefault: false,
  feedView: null,
  openFriends: {},
};

const cache = new Map<string, Prefs>();
const touched = new Set<string>();
const listeners = new Set<() => void>();

function key(userId: string) {
  return `lincin.prefs.${userId}`;
}

function clean(raw: unknown): Partial<Prefs> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Prefs> = {};
  for (const k of ["tint", "pushNew", "quiet", "visible", "openDefault"] as const) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  if (r.feedView === "editie" || r.feedView === "friends" || r.feedView === "time") out.feedView = r.feedView;
  if (r.openFriends && typeof r.openFriends === "object") out.openFriends = r.openFriends as Record<string, boolean>;
  return out;
}

function emit() {
  for (const fn of listeners) fn();
}

const loading = new Map<string, Promise<void>>();

function load(userId: string): Promise<void> {
  const hit = loading.get(userId);
  if (hit) return hit;
  const p = (async () => {
    // 1. de lokale kopie, plus de weergave van vóór 0070
    let value: Prefs = { ...DEFAULTS };
    try {
      const raw = await AsyncStorage.getItem(key(userId));
      if (raw) value = { ...value, ...clean(JSON.parse(raw)) };
      if (!value.feedView) {
        const old = await AsyncStorage.getItem(`lincin.feed.view.${userId}`);
        if (old === "friends" || old === "time") value.feedView = old;
      }
    } catch {
      // onleesbare opslag: de standaard
    }
    if (!touched.has(userId)) {
      cache.set(userId, value);
      emit();
    }
    // 2. de database
    const { data } = await supabase.from("user_prefs").select("prefs").eq("user_id", userId).maybeSingle();
    if (data?.prefs && !touched.has(userId)) {
      const remote = data.prefs as Record<string, unknown>;
      cache.set(userId, { ...(cache.get(userId) ?? DEFAULTS), ...clean(remote) });
      AsyncStorage.setItem(key(userId), JSON.stringify(cache.get(userId))).catch(() => {});
      const l = remote.lang;
      if (l === "nl" || l === "en" || l === "de") setLang(l as Lang, { quiet: true });
      emit();
    }
  })().catch(() => {});
  loading.set(userId, p);
  return p;
}

// ---- schrijven: lokaal meteen, naar de database even later ----
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function persist(userId: string) {
  const value = cache.get(userId) ?? DEFAULTS;
  AsyncStorage.setItem(key(userId), JSON.stringify(value)).catch(() => {});
  const old = timers.get(userId);
  if (old) clearTimeout(old);
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      supabase
        .from("user_prefs")
        .upsert({ user_id: userId, prefs: { ...value, lang: getLang() }, updated_at: new Date().toISOString() })
        .then(() => {}, () => {});
    }, 600),
  );
}

export function setPref<K extends keyof Prefs>(userId: string, name: K, value: Prefs[K]) {
  touched.add(userId);
  cache.set(userId, { ...(cache.get(userId) ?? DEFAULTS), [name]: value });
  emit();
  persist(userId);
}

/** Eén vriend open- of dichtklappen; de keuze blijft staan. */
export function setFriendOpen(userId: string, friendKey: string, open: boolean) {
  const cur = cache.get(userId) ?? DEFAULTS;
  setPref(userId, "openFriends", { ...cur.openFriends, [friendKey]: open });
}

/** Meerdere vrienden tegelijk ("Alles openen" / "Alles inklappen"). */
export function setFriendsOpen(userId: string, friendKeys: string[], open: boolean) {
  const cur = cache.get(userId) ?? DEFAULTS;
  const next = { ...cur.openFriends };
  for (const k of friendKeys) next[k] = open;
  setPref(userId, "openFriends", next);
}

/** Staat deze vriend open? Je eigen keuze, anders de standaard (ingeklapt). */
export function isFriendOpen(prefs: Prefs, friendKey: string): boolean {
  return prefs.openFriends[friendKey] ?? prefs.openDefault;
}

/**
 * Houdt de taal in de rij bij: wie in Instellingen van taal wisselt,
 * schrijft hem meteen mee. Eén keer aanroepen zodra er een sessie is.
 */
export function syncUserPrefs(userId: string): () => void {
  load(userId);
  return subscribeLang(() => {
    touched.add(userId);
    persist(userId);
  });
}

export function usePrefs(userId: string): Prefs {
  const [prefs, setPrefs] = useState<Prefs>(() => cache.get(userId) ?? DEFAULTS);
  useEffect(() => {
    const fn = () => setPrefs(cache.get(userId) ?? DEFAULTS);
    listeners.add(fn);
    load(userId).then(fn);
    fn();
    return () => {
      listeners.delete(fn);
    };
  }, [userId]);
  return prefs;
}
