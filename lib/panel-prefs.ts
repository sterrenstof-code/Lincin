import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Wat je open of dicht liet staan, en dat het zo blijft.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ONTHOUDEN WORDT
 * ---------------------------------------------------------------
 * Een paneel dat je elke keer opnieuw dichtklapt is geen keuze maar een
 * handeling: je doet hetzelfde werk bij elke vondst die je opent. De drie
 * panelen op de detailpagina — de reactiekolom, de reactielijst en een
 * lange tekst — kun je hier dus één keer zetten en dan staan ze zo.
 *
 * De vorm is die van `lib/feed-prefs.ts`: een waarde, een setje
 * luisteraars, `useSyncExternalStore`. Ook de reden om het per gebruiker
 * te bewaren is dezelfde — één toestel kan meerdere accounts zien, en dan
 * erft de volgende jouw dichtgeklapte kolom zonder te weten waarom.
 *
 * Wat er níet in staat is per vondst. "Deze ene tekst helemaal uitgeklapt"
 * is een handeling van dit moment; "lange teksten mag je me meteen
 * helemaal laten zien" is een voorkeur. Alleen het tweede hoort hier.
 */

export type PanelKey =
  /** De kolom met reacties naast een vondst, op een breed scherm. */
  | "aside"
  /** De lijst met reacties zelf. */
  | "comments"
  /** Een lange tekst: in zijn geheel, of eerst het begin. */
  | "longText";

/** Dicht is `true`. De standaard is dus: alles staat open. */
export type PanelPrefs = Record<PanelKey, boolean>;

const DEFAULTS: PanelPrefs = { aside: false, comments: false, longText: true };

const KEYS: PanelKey[] = ["aside", "comments", "longText"];

function keyFor(userId: string) {
  return `lincin.panel-prefs.v1.${userId}`;
}

function parse(raw: string | null): PanelPrefs {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<PanelPrefs>;
    const next = { ...DEFAULTS };
    for (const key of KEYS) {
      if (typeof parsed[key] === "boolean") next[key] = parsed[key] as boolean;
    }
    return next;
  } catch {
    // Kapotte opslag mag een pagina nooit tegenhouden.
    return DEFAULTS;
  }
}

let owner: string | null = null;
let prefs: PanelPrefs = DEFAULTS;
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): PanelPrefs {
  return prefs;
}

function adopt(userId: string) {
  if (userId === owner) return;
  owner = userId;
  loaded = false;
  prefs = DEFAULTS;
  emit();

  AsyncStorage.getItem(keyFor(userId))
    .then((raw) => {
      if (owner !== userId) return;
      prefs = parse(raw);
      loaded = true;
      emit();
    })
    .catch(() => {
      if (owner !== userId) return;
      loaded = true;
    });
}

/** Een paneel open- of dichtzetten. Onthoudt het meteen. */
export function setPanelCollapsed(key: PanelKey, collapsed: boolean) {
  if (prefs[key] === collapsed) return;
  prefs = { ...prefs, [key]: collapsed };
  emit();
  if (!loaded || !owner) return;
  AsyncStorage.setItem(keyFor(owner), JSON.stringify(prefs)).catch(() => {
    // Niet kunnen bewaren is vervelend, niet fataal: deze sessie klopt.
  });
}

export function togglePanel(key: PanelKey) {
  setPanelCollapsed(key, !prefs[key]);
}

/** Staan de panelen van deze gebruiker open of dicht? */
export function usePanelPrefs(userId: string | undefined): PanelPrefs {
  useEffect(() => {
    if (userId) adopt(userId);
  }, [userId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
