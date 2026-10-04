import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { getPreference, setPreferenceFromServer, subscribePreferenceChoice, type ThemePreference } from "@/lib/design/theme";
import { getLang, setLang, subscribeLang, type Lang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase/client";

/**
 * De voorkeuren van één gebruiker (HANDOFF 23 sep §Vaste gedragsregels).
 *
 *   tint         (vervallen met kleur — blijft bewaard, doet niets meer)
 *   pushNew      een melding bij nieuwe bijdragen
 *   quiet        stil tussen 22:00 en 07:00
 *   visible      lincs zien mijn bijdragen — staat niet meer in Instellingen:
 *               geen RLS-regel of query leest hem, dus de schakelaar loog.
 *               De sleutel blijft zodat bewaarde rijen geldig blijven.
 *   scheme       system | light | dark — licht of donker, per gebruiker; het
 *               lokale `lincin.theme` blijft de kopie voor het eerste beeld
 *   openDefault  vrienden in de feed staan standaard open (uit: ingeklapt)
 *   feedView     editie | friends | time; leeg = de standaard van het toestel
 *   commentSort  newest | oldest — de volgorde van reacties (Bijdrage Voorbeeld)
 *   openFriends  per vriend (of groep) je eigen keuze: open of dicht
 *   push         per soort melding aan/uit (berichten, likes, reacties,
 *               vermeldingen); ontbreekt = aan. `send-push` leest hem.
 *   tz           de tijdzone van je laatst gebruikte toestel, zodat "stil
 *               tussen 22:00 en 07:00" jouw nacht is en niet die van Brussel
 *   edition      het editienummer: de hoeveelste dag dat je Lincin opent
 *               ("Editie wo 23 sep · № 38"), met de dag van de laatste
 *
 * Lokaal gecachet per gebruiker (AsyncStorage) zodat de app meteen goed
 * opent, en bewaard in `user_prefs` (0070) zodat een tweede toestel
 * dezelfde keuzes kent. De taal reist mee in dezelfde rij.
 *
 * Wie wint: de database, tenzij je in deze sessie zelf al iets veranderde
 * vóór hij antwoordde — dezelfde regel als bij het thema.
 */
export type FeedView = "editie" | "friends" | "time";

/** De volgorde van reacties onder een bijdrage (Bijdrage Voorbeeld). */
export type CommentSort = "newest" | "oldest";

export type Prefs = {
  tint: boolean;
  pushNew: boolean;
  quiet: boolean;
  visible: boolean;
  openDefault: boolean;
  feedView: FeedView | null;
  /** Reacties: nieuwste eerst (de standaard) of oudste eerst. */
  commentSort: CommentSort;
  openFriends: Record<string, boolean>;
  edition: { n: number; day: string } | null;
  /** Licht of donker (of het toestel volgen), meegenomen naar een tweede toestel. */
  scheme: ThemePreference;
  /** Pushmeldingen per soort; ontbreekt een soort, dan staat hij aan. */
  push: Partial<Record<PushKind, boolean>>;
  /** IANA-tijdzone, bv. "Europe/Brussels", voor de stille uren. */
  tz: string | null;
};

/** De soorten pushmelding die je apart kunt uitzetten (`send-push` §categoryOf). */
export type PushKind = "messages" | "likes" | "comments" | "mentions";
export const PUSH_KINDS: PushKind[] = ["messages", "likes", "comments", "mentions"];

/** De schakelaars van Instellingen: alleen de booleans. */
export type TogglePref = "tint" | "pushNew" | "quiet" | "visible" | "openDefault";

const DEFAULTS: Prefs = {
  tint: true,
  pushNew: true,
  quiet: false,
  visible: true,
  openDefault: false,
  feedView: null,
  commentSort: "newest",
  openFriends: {},
  edition: null,
  scheme: "system",
  push: {},
  tz: null,
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
  if (r.commentSort === "newest" || r.commentSort === "oldest") out.commentSort = r.commentSort;
  if (r.scheme === "system" || r.scheme === "light" || r.scheme === "dark") out.scheme = r.scheme;
  if (r.openFriends && typeof r.openFriends === "object") out.openFriends = r.openFriends as Record<string, boolean>;
  if (r.push && typeof r.push === "object") {
    const push: Partial<Record<PushKind, boolean>> = {};
    for (const k of PUSH_KINDS) {
      const v = (r.push as Record<string, unknown>)[k];
      if (typeof v === "boolean") push[k] = v;
    }
    out.push = push;
  }
  if (typeof r.tz === "string" && r.tz) out.tz = r.tz;
  const e = r.edition as { n?: unknown; day?: unknown } | undefined;
  if (e && typeof e.n === "number" && typeof e.day === "string") out.edition = { n: e.n, day: e.day };
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
    // De stand is wat dit toestel nu toont (`lincin.theme`), niet de kopie
    // hierboven: zo overschrijft een rij van vóór `scheme` die keuze niet met
    // "system".
    value.scheme = getPreference();
    if (!touched.has(userId)) {
      cache.set(userId, value);
      emit();
    }
    // 2. de database
    const { data } = await supabase.from("user_prefs").select("prefs").eq("user_id", userId).maybeSingle();
    // Licht/donker apart: `theme.ts` weigert hem zelf als je in deze sessie
    // al koos, ook als je intussen alleen iets ánders aanraakte.
    const remoteScheme = data?.prefs ? clean(data.prefs).scheme : undefined;
    if (remoteScheme && setPreferenceFromServer(remoteScheme) && touched.has(userId)) {
      cache.set(userId, { ...(cache.get(userId) ?? DEFAULTS), scheme: remoteScheme });
      emit();
    }
    if (data?.prefs && !touched.has(userId)) {
      const remote = data.prefs as Record<string, unknown>;
      // `scheme` volgt wat er nu echt staat: de serverwaarde, of je eigen
      // keuze als `theme.ts` die van de server weigerde.
      cache.set(userId, { ...(cache.get(userId) ?? DEFAULTS), ...clean(remote), scheme: getPreference() });
      AsyncStorage.setItem(key(userId), JSON.stringify(cache.get(userId))).catch(() => {});
      const l = remote.lang;
      if (l === "nl" || l === "en" || l === "de") setLang(l as Lang, { quiet: true });
      emit();
    }
    bumpEdition(userId);
    keepTimezone(userId);
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

/** De dag van vandaag op dit toestel, als "2026-09-23". */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Een nieuwe dag is een nieuwe editie. Pas nadat de database antwoordde,
 * zodat een tweede toestel verder telt in plaats van opnieuw bij 1 begint.
 */
function bumpEdition(userId: string) {
  const cur = cache.get(userId) ?? DEFAULTS;
  const day = today();
  if (cur.edition?.day === day) return;
  cache.set(userId, { ...cur, edition: { n: (cur.edition?.n ?? 0) + 1, day } });
  emit();
  persist(userId);
}

/** De tijdzone van dit toestel, of null als het platform hem niet kent. */
function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Bewaar de tijdzone van dit toestel als hij anders is dan de bewaarde. */
function keepTimezone(userId: string) {
  const tz = deviceTimezone();
  const cur = cache.get(userId) ?? DEFAULTS;
  if (!tz || cur.tz === tz) return;
  cache.set(userId, { ...cur, tz });
  emit();
  persist(userId);
}

/** Eén soort pushmelding aan of uit. */
export function setPushPref(userId: string, kind: PushKind, on: boolean) {
  const cur = cache.get(userId) ?? DEFAULTS;
  setPref(userId, "push", { ...cur.push, [kind]: on });
}

/** Staat deze soort pushmelding aan? Ontbreekt hij, dan ja. */
export function pushOn(prefs: Prefs, kind: PushKind): boolean {
  return prefs.push[kind] !== false;
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
 * Houdt de taal en licht/donker in de rij bij: wie in Instellingen
 * wisselt, schrijft ze meteen mee. Eén keer aanroepen zodra er een sessie is.
 */
export function syncUserPrefs(userId: string): () => void {
  load(userId);
  const offLang = subscribeLang(() => {
    touched.add(userId);
    persist(userId);
  });
  // Licht/donker: elke eigen keuze (Instellingen, of de schakelaar elders)
  // gaat mee naar `user_prefs`, zodat een tweede toestel hem kent.
  const offScheme = subscribePreferenceChoice((next) => setPref(userId, "scheme", next));
  return () => {
    offLang();
    offScheme();
  };
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
