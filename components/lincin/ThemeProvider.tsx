import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";

import { getProfileTheme, setProfileTheme } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { getTheme, setTheme, useTheme, useThemeSpec, type LincinTheme, type ThemeSpec } from "@/lib/design/theme";

/**
 * Het thema van de app: kleur of magazine (HANDOFF.md §Themes).
 *
 * De waarde zelf leeft buiten React, in `lib/design/theme.ts`, zodat
 * `color()`, `lincinType` en `BORDER` hem kunnen lezen zonder context.
 * Deze provider doet twee dingen erbovenop:
 *
 *   1. Zodra er een sessie is, haalt hij `profiles.theme` op en past die
 *      toe als hij afwijkt van wat lokaal bewaard was — het profiel wint,
 *      want dat is wat een tweede toestel ook ziet.
 *   2. `choose()` zet het thema meteen (geen herlaad; de schermen
 *      hertekenen zich, zie `app/_layout.tsx`) en schrijft hem daarna
 *      naar het profiel.
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
      if (alive && remote && remote !== getTheme()) setTheme(remote);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

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
