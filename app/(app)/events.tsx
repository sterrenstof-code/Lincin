import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { Body, BORDER, Box, Btn, Chip, DashedCard, GAP, GUTTER, Head, Mono, Serif, line } from "@/components/lincin/ui";
import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { friendColor, hueFor, useScheme } from "@/lib/design/theme";
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

  return (
    <LincinScreen tab="events" counter={t.tabEvents}>
      <View style={{ paddingTop: 8, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <Serif variant="pageTitle" style={{ flex: 1 }}>
          {t.eventsA} <Serif variant="pageTitleItalic">{t.eventsB}</Serif>
        </Serif>
        <View style={{ alignItems: "flex-end" }}>
          <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
            {upcoming.length + active.length} {t.planned}
          </Mono>
          {active.length ? (
            <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
              {active.length} nu bezig
            </Mono>
          ) : null}
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, paddingBottom: 20, gap: GAP }}>
        {events.isLoading ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
            {t.loading}
          </Mono>
        ) : events.isError ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
            {t.failed}
          </Mono>
        ) : null}
        {[...active, ...upcoming].map((e) => (
          <EventCard key={e.id} event={e} live={e.is_active} />
        ))}
        <DashedCard onPress={() => router.push("/event-create")}>{t.planNew} →</DashedCard>
        {past.length ? (
          <Mono variant="micro" tone="dim" style={{ marginTop: 8 }}>
            Voorbij
          </Mono>
        ) : null}
        {past.map((e) => (
          <EventCard key={e.id} event={e} past />
        ))}
      </ScrollView>
    </LincinScreen>
  );
}

function EventCard({ event: e, live = false, past = false }: { event: EventWithMeta; live?: boolean; past?: boolean }) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(hueFor(e.host_user_id), scheme);
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(LOCALE[lang], { weekday: "short" });
  const when = sameDay
    ? `${day} ${hhmm(e.starts_at)}`
    : `${day} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" })}`;
  const who = `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`;
  return (
    <Box style={{ flexDirection: "row", minHeight: 150, opacity: past ? 0.6 : 1 }}>
      <View
        style={{
          width: 84,
          backgroundColor: fc.fill,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          borderRightWidth: BORDER,
          borderRightColor: line(),
        }}
      >
        <Head variant="numeral" color={fc.ink}>
          {String(start.getDate()).padStart(2, "0")}
        </Head>
        <Mono variant="micro" color={fc.ink}>
          {start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "")}
        </Mono>
      </View>
      <View style={{ flex: 1, minWidth: 0, padding: 12, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            <Mono variant="micro" tone="dim" numberOfLines={1}>
              {e.is_host ? t.me : "linc"}
            </Mono>
            {live ? <Chip label="nu bezig" tone="acid" /> : null}
            {e.pending_requests_count > 0 && e.is_host ? <Chip label={`${e.pending_requests_count} ${t.waitsForYou}`} tone="red" /> : null}
          </View>
          <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
            {when}
          </Mono>
        </View>
        <Serif variant="eventTitle" numberOfLines={2}>
          {e.name}
        </Serif>
        <Body small tone="dim" numberOfLines={1} style={{ fontSize: 12.5, lineHeight: 17 }}>
          {e.description ? `${e.description.split("\n")[0]} · ` : ""}
          {who}
          {e.contributions_count ? ` · ${e.contributions_count} foto's` : ""}
        </Body>
        <View style={{ flexDirection: "row", gap: 6, marginTop: "auto" }}>
          <Btn label="Open →" fill height={30} onPress={() => router.push(`/event/${e.id}` as never)} />
          {e.is_host && !past ? (
            <Btn label="Deel code" height={30} onPress={() => router.push(`/event-link/${e.id}` as never)} />
          ) : null}
        </View>
      </View>
    </Box>
  );
}
