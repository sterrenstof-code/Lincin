import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";

import { EventsModern, type EventTileData } from "@/components/lincin/modern/EventsModern";
import { EventsMagazine } from "@/components/lincin/magazine/Pages";
import { useEventRsvps, type EventRsvp, type RsvpStatus } from "@/lib/api/event-rsvps";
import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { getProfiles } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { useScheme, useThemeSpec } from "@/lib/design/theme";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { displayName, hhmm } from "@/lib/lincin/model";
import { DesktopEvents } from "@/components/lincin/desktop/DesktopEvents";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";
import { useToast } from "@/lib/toast";

/**
 * Events (README §06; mobile-app.dc.html, `start: events`).
 *
 * Per event de dag in de kleur van wie uitnodigt, wie en wanneer, de
 * titel, de plek en wie er komt, en "Ik kom" / "Misschien" (0072,
 * `event_rsvps`): een tik zet je antwoord, nog een tik wist het. Wat nu
 * bezig is staat bovenaan; wat voorbij is eronder, zonder antwoordknoppen.
 * Een tik op het event zelf opent het; de host kan van hieruit de code
 * delen.
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
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();

  const events = useQuery({
    queryKey: ["events", myUserId],
    queryFn: () => listMyEvents(myUserId),
    refetchOnWindowFocus: true,
  });
  const data = useMemo(() => events.data ?? [], [events.data]);
  const ids = useMemo(() => data.map((e) => e.id), [data]);
  // Dezelfde haak als DesktopEvents en de eventpagina: optimistisch, met rollback.
  const onRsvpError = useCallback((err: unknown) => toast.error(err instanceof Error ? err.message : t.failed), [toast, t.failed]);
  const rsvp = useEventRsvps(ids, myUserId, onRsvpError);

  // Namen voor "wie nodigt uit" en "wie komt": de hosts en wie antwoordde.
  const peopleIds = useMemo(
    () => Array.from(new Set([...data.map((e) => e.host_user_id), ...rsvp.rsvps.map((r) => r.user_id)])),
    [data, rsvp.rsvps],
  );
  const people = useQuery({ queryKey: ["profiles", peopleIds], queryFn: () => getProfiles(peopleIds), enabled: peopleIds.length > 0, staleTime: 60_000 });
  const nameOf = useMemo(() => {
    const m = new Map((people.data ?? []).map((p) => [p.id, displayName(p)]));
    return (id: string) => (id === myUserId ? t.me.toLowerCase() : m.get(id) ?? "linc");
  }, [people.data, myUserId, t.me]);
  const byEvent = useMemo(() => {
    const m = new Map<string, EventRsvp[]>();
    for (const r of rsvp.rsvps) m.set(r.event_id, [...(m.get(r.event_id) ?? []), r]);
    return m;
  }, [rsvp.rsvps]);

  const now = Date.now();
  const active = data.filter((e) => e.is_active);
  const upcoming = data
    .filter((e) => !e.is_active && new Date(e.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = data
    .filter((e) => !e.is_active && new Date(e.ends_at).getTime() <= now)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const tile = (e: EventWithMeta, live: boolean, isPast: boolean) =>
    tileData(e, {
      t,
      lang,
      router,
      live,
      past: isPast,
      host: e.is_host ? t.me : nameOf(e.host_user_id),
      going: (byEvent.get(e.id) ?? []).filter((r) => r.status === "yes").map((r) => nameOf(r.user_id)),
      mine: rsvp.mine(e.id),
      onAnswer: (s) => rsvp.answer(e.id, s),
    });
  const waiting = data.reduce((n, e) => n + (e.is_host ? e.pending_requests_count : 0), 0);
  const state = events.isLoading ? t.loading : events.isError ? t.failed : null;

  if (spec.layout === "spread") {
    return (
      <EventsMagazine
        events={[...active, ...upcoming].map((e) => tile(e, e.is_active, false))}
        past={past.map((e) => tile(e, false, true))}
        planned={upcoming.length + active.length}
        waiting={waiting}
        scheme={scheme}
        t={t}
        state={state}
        onPlanNew={() => router.push("/event-create")}
      />
    );
  }

  return (
    <EventsModern
      events={[...active, ...upcoming].map((e) => tile(e, e.is_active, false))}
      past={past.map((e) => tile(e, false, true))}
      planned={upcoming.length + active.length}
      liveCount={active.length}
      waiting={waiting}
      scheme={scheme}
      t={t}
      state={state}
      onPlanNew={() => router.push("/event-create")}
    />
  );
}

/**
 * De afgeleide waarden van één event: de datum uit elkaar, wie hem maakt,
 * wanneer hij loopt, je antwoord en de knoppen. `EventsMagazine` (spread)
 * en `EventsModern` (bento) lezen allebei hieruit, zodat de twee vormen
 * dezelfde gegevens tonen.
 */
function tileData(
  e: EventWithMeta,
  o: {
    t: ReturnType<typeof useT>;
    lang: Lang;
    router: ReturnType<typeof useRouter>;
    live: boolean;
    past: boolean;
    host: string;
    going: string[];
    mine: RsvpStatus | null;
    onAnswer: (s: RsvpStatus | null) => void;
  },
): EventTileData {
  const { t, lang, router, live, past } = o;
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(LOCALE[lang], { weekday: "short" }).replace(".", "");
  const when = sameDay
    ? `${day} ${hhmm(e.starts_at)}`
    : `${day} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" }).replace(".", "")}`;
  // Zoals het prototype: "Marken · jij, Noor, Sem". Wie "ik kom" zei, en
  // zolang niemand antwoordde het aantal lincs. De plek (0073); voor oudere
  // events de eerste regel van de beschrijving.
  const who = o.going.length ? o.going.join(", ") : `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`;
  const place = e.place?.trim() || (e.description ?? "").split("\n")[0].trim();
  const open = () => router.push(`/event/${e.id}` as never);
  return {
    key: e.id,
    hostId: e.host_user_id,
    day: String(start.getDate()).padStart(2, "0"),
    month: start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", ""),
    by: o.host,
    when,
    title: e.name,
    sub: `${place ? `${place} · ` : ""}${who}${e.contributions_count ? ` · ${e.contributions_count} foto's` : ""}`,
    live,
    waiting: e.is_host ? e.pending_requests_count : 0,
    past,
    onOpen: open,
    mine: o.mine,
    // Op een voorbij event valt niets meer te antwoorden.
    onAnswer: past ? undefined : o.onAnswer,
    // "Deel code" opende `/event-link` — dat is "link toevoegen" aan het
    // event, niet de uitnodiging. De code met QR staat op `/event-qr`.
    actions: e.is_host && !past ? [{ label: t.shareEventCode, onPress: () => router.push(`/event-qr/${e.id}` as never) }] : [],
  };
}
