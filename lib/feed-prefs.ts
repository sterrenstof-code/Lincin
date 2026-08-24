import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * De twee schakelaars boven de feed — weergave en "gelezen dimmen" —
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
 * leeg blijft voor iets wat maar twee knopjes zijn.
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

export function useFeedPrefs(userId: string): {
  prefs: FeedPrefs;
  setLayout: (layout: FeedLayout) => void;
  setOrder: (order: FeedOrder) => void;
  setDimSeen: (dimSeen: boolean) => void;
} {
  const [prefs, setPrefs] = useState<FeedPrefs>(DEFAULTS);
  /**
   * Pas schrijven ná het lezen. Zonder deze vlag zou de eerste render de
   * standaardwaarden meteen terugschrijven en daarmee de bewaarde keuze
   * overschrijven voordat hij binnen is.
   */
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    loaded.current = false;
    AsyncStorage.getItem(keyFor(userId))
      .then((raw) => {
        if (!alive) return;
        setPrefs(parse(raw));
        loaded.current = true;
      })
      .catch(() => {
        if (!alive) return;
        loaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const write = useCallback(
    (next: FeedPrefs) => {
      setPrefs(next);
      if (!loaded.current) return;
      AsyncStorage.setItem(keyFor(userId), JSON.stringify(next)).catch(() => {
        // Niet kunnen bewaren is vervelend, niet fataal: deze sessie klopt.
      });
    },
    [userId]
  );

  const setLayout = useCallback(
    (layout: FeedLayout) => write({ ...prefs, layout }),
    [prefs, write]
  );
  const setOrder = useCallback(
    (order: FeedOrder) => write({ ...prefs, order }),
    [prefs, write]
  );
  const setDimSeen = useCallback(
    (dimSeen: boolean) => write({ ...prefs, dimSeen }),
    [prefs, write]
  );

  return { prefs, setLayout, setOrder, setDimSeen };
}
