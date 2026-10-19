import { useEffect, useState } from "react";

type Loaded = {
  Analytics: typeof import("@vercel/analytics/react").Analytics;
  SpeedInsights: typeof import("@vercel/speed-insights/react").SpeedInsights;
};

/**
 * Alleen het soort pagina gaat naar Vercel: `/chat/<id>` wordt `/chat/[id]`.
 * Ids, uitnodigingscodes (`/e/…`, `/c/…`), gebruikersnamen en een
 * eventuele `#access_token` na het inloggen horen niet bij een derde.
 */
function redact(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const path = parts.length ? "/" + [parts[0], ...parts.slice(1).map(() => "[id]")].join("/") : "/";
    return `${u.origin}${path}`;
  } catch {
    return "";
  }
}

/**
 * Vercel Analytics — alleen op web. Zie WebAnalytics.tsx voor het waarom.
 *
 * Pas ná de eerste weergave geladen, als de browser even niets te doen
 * heeft: meten mag de pagina die het meet niet vertragen. Er gaat niets
 * verloren — de bezoekteller telt de pagina waarop hij binnenkomt, en de
 * snelheidsmeting leest de cijfers van het laden achteraf uit de browser.
 */
export function WebAnalytics() {
  const [mods, setMods] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.all([import("@vercel/analytics/react"), import("@vercel/speed-insights/react")])
        .then(([a, s]) => {
          if (alive) setMods({ Analytics: a.Analytics, SpeedInsights: s.SpeedInsights });
        })
        .catch(() => {});
    };
    // Safari kent `requestIdleCallback` pas sinds kort; daar een vaste wachttijd.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => {
        alive = false;
        window.cancelIdleCallback(id);
      };
    }
    const t = setTimeout(load, 2000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  if (!mods) return null;
  const { Analytics, SpeedInsights } = mods;
  return (
    <>
      <Analytics beforeSend={(e) => ({ ...e, url: redact(e.url) })} />
      <SpeedInsights beforeSend={(e) => ({ ...e, url: redact(e.url) })} />
    </>
  );
}
