import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { RASTER, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { capf, mono, sans, serif } from "@/lib/design/type";
import { EventSpread, type EventSpreadData } from "@/components/lincin/magazine/Pages";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { hhmm } from "@/lib/lincin/model";

import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

const SEAM = RASTER.seam;

/**
 * Events op desktop (Lincin Desktop.dc.html, EVENTS): titel serif 40 met
 * "n gepland" rechts, dan een raster van kaarten (minstens 340 breed, 180
 * hoog) met haarlijnen ertussen. Links een kleurblokje van 10, de dag in
 * serif 52 en de maand; rechts wie · wanneer, de titel in serif 26, plek ·
 * gezelschap, en onderaan de handelingen als mono-links.
 *
 * Het ontwerp heeft IK KOM / MISSCHIEN; de backend kent geen rsvp, dus
 * staan hier — zoals op de telefoon — OPEN → en, voor de gastheer, DEEL CODE.
 *
 * Modern: geen haarlijnen maar losse tegels met een ronding van 18 en een
 * naad van 6, zoals de rail ernaast.
 *
 * Magazine: de spreads van de telefoon in een rooster — per event een
 * volvlaks kleurvlak van de gastheer met de metarail, de dag groot in
 * serif, de titel en een cursief onderschrift. Onderaan "Plan iets nieuws"
 * als papieren vlak.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const MIN = 340;

export function DesktopEvents() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const spec = useThemeSpec();
  const round = spec.id === "modern";
  const spread = spec.layout === "spread";
  const lang = useLang();
  const scheme = useScheme();
  const [gridW, setGridW] = useState(0);
  // De naad tussen twee kaarten: een haarlijn van 1, of 6 in modern en magazine (met 6 rondom).
  const seam = round || spread ? SEAM : 1;
  const inner = round || spread ? gridW - 2 * SEAM : gridW;
  const cols = Math.max(1, Math.floor((inner + seam) / (MIN + seam)));
  const cardW = gridW ? (inner - (cols - 1) * seam) / cols : MIN;

  const events = useQuery({ queryKey: ["events", myUserId], queryFn: () => listMyEvents(myUserId), refetchOnWindowFocus: true });
  const data = events.data ?? [];
  const now = Date.now();
  const active = data.filter((e) => e.is_active);
  const upcoming = data.filter((e) => !e.is_active && new Date(e.starts_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = data.filter((e) => !e.is_active && new Date(e.ends_at).getTime() <= now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  return (
    <DesktopShell active="events">
      <DesktopTitle
        right={
          <>
            <MonoLink label={`${upcoming.length + active.length} ${t.planned}`} on={false} />
            <MonoLink label={`${t.planNew} →`} active onPress={() => router.push("/event-create")} />
          </>
        }
      >
        {t.eventsA} <Text style={capf(true, true)}>{t.eventsB}</Text>
      </DesktopTitle>
      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {events.isLoading ? (
            <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: color("ink", "inkDim"), padding: 24, textTransform: "uppercase", letterSpacing: 1 }]}>{t.loading}</Text>
          ) : spread ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: seam, padding: SEAM }}>
              {[...active, ...upcoming, ...past].map((e, i) => (
                <EventSpread
                  key={e.id}
                  e={spreadData(e, !e.is_active && new Date(e.ends_at).getTime() <= now, t, lang, router)}
                  index={i}
                  scheme={scheme}
                  height={220}
                  style={{ width: cardW, marginHorizontal: 0, marginBottom: 0 }}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.planNew}
                onPress={() => router.push("/event-create")}
                style={({ pressed }) => ({ width: cardW, minHeight: 220, backgroundColor: color("paper2"), alignItems: "center", justifyContent: "center", padding: 20, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ ...serif(true), fontSize: 22, lineHeight: 28, color: color("ink", "inkDim") }}>{t.planNew}</Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={[
                { flexDirection: "row", flexWrap: "wrap", gap: seam },
                round ? { padding: SEAM } : { backgroundColor: color("ink", "postRule"), borderBottomWidth: spec.border, borderBottomColor: color("ink") },
              ]}
            >
              {[...active, ...upcoming, ...past].map((e) => (
                <Card key={e.id} event={e} width={cardW} round={round} past={!e.is_active && new Date(e.ends_at).getTime() <= now} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </DesktopShell>
  );
}

/** Magazine: dezelfde gegevens als de spread op de telefoon (`app/(app)/events.tsx`). */
function spreadData(e: EventWithMeta, past: boolean, t: ReturnType<typeof useT>, lang: Lang, router: ReturnType<typeof useRouter>): EventSpreadData {
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(LOCALE[lang], { weekday: "short" });
  const who = `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`;
  return {
    key: e.id,
    hostId: e.host_user_id,
    day: String(start.getDate()).padStart(2, "0"),
    month: start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", ""),
    by: e.is_host ? t.me : "linc",
    when: sameDay ? `${day} ${hhmm(e.starts_at)}` : `${day} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" })}`,
    title: e.name,
    sub: `${e.description ? `${e.description.split("\n")[0]} · ` : ""}${who}`,
    past,
    actions: [
      { label: "Open →", onPress: () => router.push(`/event/${e.id}` as never) },
      ...(e.is_host && !past ? [{ label: "Deel code", onPress: () => router.push(`/event-link/${e.id}` as never) }] : []),
    ],
  };
}

function Card({ event: e, width, round, past }: { event: EventWithMeta; width: number; round: boolean; past: boolean }) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const fc = friendColor(hueFor(e.host_user_id), scheme);
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(LOCALE[lang], { weekday: "short" });
  const when = sameDay ? `${day} ${hhmm(e.starts_at)}` : `${day} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" })}`;
  const who = `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const meta = [mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase" as const, color: dim }];
  return (
    <Pressable
      accessibilityLabel={e.name}
      onPress={() => router.push(`/event/${e.id}` as never)}
      style={{
        width,
        minHeight: 180,
        ...(round ? { borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") } : { backgroundColor: color("paper") }),
        flexDirection: "row", gap: 20, paddingVertical: 22, paddingHorizontal: 24, opacity: past ? 0.6 : 1 }}
    >
      <View style={{ width: 76, gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: round ? 5 : 0, backgroundColor: fc.fill }} />
        <Text style={[capf(false, true), { fontSize: 52, lineHeight: 44, color: ink }]}>{String(start.getDate()).padStart(2, "0")}</Text>
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: dim }]}>
          {start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "")}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={[...meta, { flexShrink: 1 }]}>
            {e.is_host ? t.me : "linc"}
            {e.is_active ? "  ·  nu bezig" : ""}
            {e.is_host && e.pending_requests_count > 0 ? `  ·  ${e.pending_requests_count} ${t.waitsForYou}` : ""}
          </Text>
          <Text style={meta}>{when}</Text>
        </View>
        <Text numberOfLines={2} style={[capf(false, true), { fontSize: 26, lineHeight: 27, color: ink }]}>
          {e.name}
        </Text>
        <Text numberOfLines={1} style={[sans(), { fontSize: 14, lineHeight: 19, color: dim }]}>
          {e.description ? `${e.description.split("\n")[0]} · ` : ""}
          {who}
        </Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: "auto", paddingTop: 12, borderTopWidth: 1, borderTopColor: color("ink", "postRule"), borderStyle: round ? "dashed" : "solid" }}>
          <MonoLink label="Open →" active onPress={() => router.push(`/event/${e.id}` as never)} />
          {e.is_host && !past ? <MonoLink label="Deel code" on={false} active onPress={() => router.push(`/event-link/${e.id}` as never)} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
