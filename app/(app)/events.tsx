import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { EventsModern, type EventTileData } from "@/components/lincin/modern/EventsModern";
import { EventsMagazine } from "@/components/lincin/magazine/Pages";
import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { useScheme, useThemeSpec } from "@/lib/design/theme";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { hhmm } from "@/lib/lincin/model";
import { DesktopEvents } from "@/components/lincin/desktop/DesktopEvents";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";

/**
 * Events (README §06).
 *
 * "Wat er komt": kaarten van minstens 150 hoog met links een datumvlak in
 * de kleur van de gastheer (dag groot, maand mono), rechts wie en wanneer,
 * de titel in serif, de plek en het gezelschap, en de knoppen. Wat nu
 * bezig is staat bovenaan met een zuur etiket; wat voorbij is eronder.
 *
 * Het ontwerp heeft `IK KOM` / `MISSCHIEN`. De backend kent geen rsvp —
 * je bent lid of niet — dus de knoppen zijn hier `OPEN →` en, voor de
 * gastheer, `DEEL CODE`. Komt er een rsvp-tabel, dan komen die twee terug.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export default function EventsScreen() {
  usePageTitle("Events");
  const desktop = useIsDesktop();
  if (desktop) return <DesktopEvents />;
  return <EventsMobile />;
}

function EventsMobile() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();

  const events = useQuery({
    queryKey: ["events", myUserId],
    queryFn: () => listMyEvents(myUserId),
    refetchOnWindowFocus: true,
  });
  const data = events.data ?? [];
  const now = Date.now();
  const active = data.filter((e) => e.is_active);
  const upcoming = data
    .filter((e) => !e.is_active && new Date(e.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = data
    .filter((e) => !e.is_active && new Date(e.ends_at).getTime() <= now)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  if (spec.layout === "spread") {
    const toSpread = (e: EventTileData) => ({ ...e, actions: e.actions.map((a) => ({ label: a.label, onPress: a.onPress })) });
    return (
      <EventsMagazine
        events={[...active, ...upcoming].map((e) => toSpread(tileData(e, t, lang, scheme, router, e.is_active, false)))}
        past={past.map((e) => toSpread(tileData(e, t, lang, scheme, router, false, true)))}
        planned={upcoming.length + active.length}
        waiting={data.reduce((n, e) => n + (e.is_host ? e.pending_requests_count : 0), 0)}
        scheme={scheme}
        t={t}
        state={events.isLoading ? t.loading : events.isError ? t.failed : null}
        onPlanNew={() => router.push("/event-create")}
      />
    );
  }

  return (
    <EventsModern
      events={[...active, ...upcoming].map((e) => tileData(e, t, lang, scheme, router, e.is_active, false))}
      past={past.map((e) => tileData(e, t, lang, scheme, router, false, true))}
      planned={upcoming.length + active.length}
      liveCount={active.length}
      scheme={scheme}
      t={t}
      state={events.isLoading ? t.loading : events.isError ? t.failed : null}
      onPlanNew={() => router.push("/event-create")}
    />
  );
}

/**
 * De afgeleide waarden van één event: de datum uit elkaar, wie hem maakt,
 * wanneer hij loopt, en de knoppen eronder. `EventsMagazine` (spread) en
 * `EventsModern` (bento) lezen allebei hieruit, zodat de twee vormen
 * dezelfde gegevens tonen.
 */
function tileData(
  e: EventWithMeta,
  t: ReturnType<typeof useT>,
  lang: Lang,
  scheme: ReturnType<typeof useScheme>,
  router: ReturnType<typeof useRouter>,
  live: boolean,
  past: boolean,
): EventTileData {
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(LOCALE[lang], { weekday: "short" });
  const when = sameDay
    ? `${day} ${hhmm(e.starts_at)}`
    : `${day} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" })}`;
  const who = `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`;
  return {
    key: e.id,
    hostId: e.host_user_id,
    day: String(start.getDate()).padStart(2, "0"),
    month: start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", ""),
    by: e.is_host ? t.me : "linc",
    when,
    title: e.name,
    sub: `${e.description ? `${e.description.split("\n")[0]} · ` : ""}${who}${e.contributions_count ? ` · ${e.contributions_count} foto's` : ""}`,
    live,
    waiting: e.is_host ? e.pending_requests_count : 0,
    past,
    actions: [
      { label: "Open →", fill: true, onPress: () => router.push(`/event/${e.id}` as never) },
      ...(e.is_host && !past ? [{ label: "Deel code", onPress: () => router.push(`/event-link/${e.id}` as never) }] : []),
    ],
  };
}
