import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

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

/** Vercel Analytics — alleen op web. Zie WebAnalytics.tsx voor het waarom. */
export function WebAnalytics() {
  return (
    <>
      <Analytics beforeSend={(e) => ({ ...e, url: redact(e.url) })} />
      <SpeedInsights beforeSend={(e) => ({ ...e, url: redact(e.url) })} />
    </>
  );
}
