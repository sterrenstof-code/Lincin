import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * De twee schakelaars boven de feed — ordening en "gelezen dimmen" —
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

export type FeedSort = "thematic" | "chrono";

export type FeedPrefs = {
  sort: FeedSort;
  dimSeen: boolean;
};

const DEFAULTS: FeedPrefs = { sort: "thematic", dimSeen: true };

function keyFor(userId: string) {
  return `lincin.feed-prefs.v1.${userId}`;
}

function parse(raw: string | null): FeedPrefs {
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<FeedPrefs>;
    return {
      sort: parsed.sort === "chrono" ? "chrono" : "thematic",
      dimSeen: typeof parsed.dimSeen === "boolean" ? parsed.dimSeen : DEFAULTS.dimSeen,
    };
  } catch {
    // Kapotte opslag mag de feed nooit tegenhouden.
    return DEFAULTS;
  }
}

export function useFeedPrefs(userId: string): {
  prefs: FeedPrefs;
  setSort: (sort: FeedSort) => void;
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

  const setSort = useCallback(
    (sort: FeedSort) => write({ ...prefs, sort }),
    [prefs, write]
  );
  const setDimSeen = useCallback(
    (dimSeen: boolean) => write({ ...prefs, dimSeen }),
    [prefs, write]
  );

  return { prefs, setSort, setDimSeen };
}
