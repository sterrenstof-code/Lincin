import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Hoe de thuispagina eruitziet — weergave, ordening en "gelezen dimmen" —
 * onthouden per gebruiker.
 *
 * ---------------------------------------------------------------
 * WAAROM LOKAAL, EN WAAROM TOCH PER GEBRUIKER
 * ---------------------------------------------------------------
 * Net als de leesstatus (`lib/read-state.ts`) is dit een voorkeur van deze
 * lezer op dit toestel, geen gegeven dat op de server hoort: niemand anders
 * heeft er iets aan te weten hoe jij je feed sorteert.
 *
 * De sleutel draagt wél het gebruikers-id, want één toestel kan meerdere
 * accounts zien (een gedeelde laptop, of gewoon uitloggen en met een ander
 * account terugkomen). Zonder dat id erft de volgende gebruiker jouw
 * instelling, en dat leest als een bug.
 *
 * De hook geeft altijd meteen de standaardwaarden terug en vult ze aan
 * zodra de opslag gelezen is. Wachten zou betekenen dat de feed een tel
 * leeg blijft voor iets wat maar drie schakelaars zijn.
 *
 * ---------------------------------------------------------------
 * WAAROM EEN STORE EN GEEN STUK STATE IN DE FEED
 * ---------------------------------------------------------------
 * Dit was `useState` in `useFeedPrefs`, en dus woonde de waarheid in het
 * scherm dat de schakelaars tekende. Dat kon zolang die schakelaars bóven
 * de feed stonden. Ze staan nu in het persoonlijke venster achter je
 * avatar — naast licht/donker, want het is dezelfde soort keuze: hoe de
 * uitgave er voor jóu uitziet — en dat venster hangt in de kop, niet in de
 * feed. Twee plekken, één waarheid, dus staat de waarheid ernaast.
 *
 * Hij is opgebouwd als `lib/design/theme.ts`: een waarde, een setje
 * luisteraars, en `useSyncExternalStore`. Geen zustand-store voor drie
 * booleans, en geen context die de hele boom opnieuw laat tekenen.
 */

/**
 * Hoe de feed eruitziet.
 *
 *   `mosaic`  de uitgave: rubrieken bovenaan, daaronder alles in een
 *             metselwerk waarin elke vondst zijn eigen maat houdt.
 *   `grid`    één strak raster van gelijke vierkanten, nieuwste eerst —
 *             alleen beeld, geen rubrieken.
 *
 * Het waren `thematic` en `chrono`, een keuze over de ordening. Maar wat
 * je in de praktijk kiest is hoe je wil kíjken: bladeren door een uitgave,
 * of alles in één keer overzien. De oude namen worden nog gelezen zodat
 * niemand zijn bewaarde keuze kwijtraakt.
 */
export type FeedLayout = "mosaic" | "grid";

/**
 * Hoe de feed geordend is.
 *
 *   `thematic`  in rubrieken: uitgelicht, een reeks, meeste interactie,
 *               nieuwste — een uitgave met een inhoudsopgave.
 *   `chrono`    alles op één hoop, nieuwste eerst.
 *
 * Los van `layout`, want het zijn twee vragen: hoe is het geordend, en hoe
 * ziet het eruit. Ze stonden ooit in één schakelaar en dat dwong een keuze
 * die niet bestond — chronologisch kán ook als metselwerk, thematisch kán
 * ook als raster.
 */
export type FeedOrder = "thematic" | "chrono";

export type FeedPrefs = {
  layout: FeedLayout;
  order: FeedOrder;
  dimSeen: boolean;
};

const DEFAULTS: FeedPrefs = { layout: "mosaic", order: "thematic", dimSeen: true };

function keyFor(userId: string) {
  return `lincin.feed-prefs.v1.${userId}`;
}

function parse(raw: string | null): FeedPrefs {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedPrefs> & { sort?: string };
    /**
     * `sort` is de oude naam, uit de tijd dat ordening en weergave één
     * schakelaar waren. Wie hem nog opgeslagen heeft, houdt zijn keuze:
     * "chrono" was alles op één hoop in een raster, "thematic" de uitgave.
     */
    const legacyOrder =
      parsed.sort === "chrono" ? "chrono" : parsed.sort === "thematic" ? "thematic" : undefined;
    const legacyLayout = parsed.sort === "chrono" ? "grid" : undefined;

    return {
      layout: (parsed.layout ?? legacyLayout) === "grid" ? "grid" : "mosaic",
      order: (parsed.order ?? legacyOrder) === "chrono" ? "chrono" : "thematic",
      dimSeen: typeof parsed.dimSeen === "boolean" ? parsed.dimSeen : DEFAULTS.dimSeen,
    };
  } catch {
    // Kapotte opslag mag de feed nooit tegenhouden.
    return DEFAULTS;
  }
}

// ---------------------------------------------------------------
// De store
// ---------------------------------------------------------------

let owner: string | null = null;
let prefs: FeedPrefs = DEFAULTS;
/**
 * Pas schrijven ná het lezen. Zonder deze vlag zou een schakelaar die je
 * omzet vóórdat de opslag binnen is de rest van je bewaarde keuze
 * overschrijven met standaardwaarden.
 */
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

/** Wat er nú geldt. Ook buiten React bruikbaar. */
export function getFeedPrefs(): FeedPrefs {
  return prefs;
}

/**
 * De voorkeuren van deze gebruiker binnenhalen.
 *
 * Idempotent: elk scherm dat de voorkeuren leest roept dit aan, en alleen
 * de eerste (of een wissel van account) doet echt iets.
 */
function adopt(userId: string) {
  if (userId === owner) return;
  owner = userId;
  loaded = false;
  prefs = DEFAULTS;
  emit();

  AsyncStorage.getItem(keyFor(userId))
    .then((raw) => {
      // Ondertussen van account gewisseld? Dan is dit antwoord verlopen.
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

function write(next: FeedPrefs) {
  prefs = next;
  emit();
  if (!loaded || !owner) return;
  AsyncStorage.setItem(keyFor(owner), JSON.stringify(next)).catch(() => {
    // Niet kunnen bewaren is vervelend, niet fataal: deze sessie klopt.
  });
}

export function setFeedLayout(layout: FeedLayout) {
  if (layout === prefs.layout) return;
  write({ ...prefs, layout });
}

export function setFeedOrder(order: FeedOrder) {
  if (order === prefs.order) return;
  write({ ...prefs, order });
}

export function setFeedDimSeen(dimSeen: boolean) {
  if (dimSeen === prefs.dimSeen) return;
  write({ ...prefs, dimSeen });
}

/**
 * De voorkeuren van deze gebruiker, en meeluisteren op wijzigingen.
 *
 * Zetten doe je met de losse functies hierboven; die hebben geen component
 * nodig en werken dus ook vanuit het venster in de kop.
 */
export function useFeedPrefs(userId: string): FeedPrefs {
  useEffect(() => {
    adopt(userId);
  }, [userId]);
  return useSyncExternalStore(subscribe, getFeedPrefs, getFeedPrefs);
}
