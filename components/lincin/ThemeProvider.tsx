import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { listFriendColors } from "@/lib/api/friend-colors";
import { getProfileTheme, setProfileTheme } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { syncUserPrefs } from "@/lib/lincin/prefs";
import { localThemeChoice, setHueChoices, setTheme, setThemeFromProfile, useTheme, useThemeSpec, type LincinTheme, type ThemeSpec } from "@/lib/design/theme";

/**
 * Het thema van de app: kleur, magazine of modern (2.2 §6).
 *
 * De waarde zelf leeft buiten React, in `lib/design/theme.ts`, zodat
 * `color()`, `lincinType` en `BORDER` hem kunnen lezen zonder context.
 * Deze provider doet twee dingen erbovenop:
 *
 *   1. Zodra er een sessie is, haalt hij `profiles.theme` op. Die geldt
 *      alleen zolang je op dít toestel zelf níets koos — hij is er voor
 *      een tweede toestel dat de app voor het eerst opent.
 *      Hetzelfde voor de kleuren die je zelf aan mensen gaf, alleen wint
 *      daar de database wél: die keuzes staan per persoon en niet per
 *      toestel.
 *   2. `choose()` zet het thema meteen (geen herlaad; de schermen
 *      hertekenen zich, zie `app/_layout.tsx`) en schrijft hem daarna
 *      naar het profiel.
 *
 * In 2.1 zette stap 1 het thema onvoorwaardelijk. Wie in Instellingen
 * wisselde en terugliep naar de feed, zag zijn keuze terugspringen zodra
 * de database antwoordde — de bug uit 2.2 §6. `setThemeFromProfile()`
 * weigert nu zodra er een eigen keuze ligt.
 */

type Value = {
  theme: LincinTheme;
  spec: ThemeSpec;
  choose: (next: LincinTheme) => void;
};

const Ctx = createContext<Value | null>(null);

export function LincinThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const theme = useTheme();
  const spec = useThemeSpec();

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getProfileTheme(userId).then((remote) => {
      if (!alive) return;
      if (remote) setThemeFromProfile(remote);
      else {
        // Leeg profiel (0071): nooit gekozen — tenzij je op dít toestel wél
        // koos. Dan schrijven we die keuze terug, zodat hij niet verloren gaat.
        const local = localThemeChoice();
        if (local) setProfileTheme(userId, local).catch(() => {});
      }
    });
    // Jouw kleur per persoon (0062): de database wint van de lokale kopie.
    listFriendColors(userId).then((choices) => {
      if (alive && choices) setHueChoices(choices);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Je voorkeuren (0070): weergave, open vrienden, taal, schakelaars.
  useEffect(() => (userId ? syncUserPrefs(userId) : undefined), [userId]);

  const choose = useCallback(
    (next: LincinTheme) => {
      setTheme(next);
      if (userId) setProfileTheme(userId, next).catch(() => {});
    },
    [userId],
  );

  const value = useMemo<Value>(() => ({ theme, spec, choose }), [theme, spec, choose]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Het thema, zijn maten, en de knop om te wisselen. */
export function useLincinTheme(): Value {
  const v = useContext(Ctx);
  // Buiten de provider (een blad zonder sessie): lezen kan altijd, kiezen
  // bewaart dan alleen lokaal. De hooks staan vóór de keuze, in vaste volgorde.
  const theme = useTheme();
  const spec = useThemeSpec();
  return v ?? { theme, spec, choose: setTheme };
}
