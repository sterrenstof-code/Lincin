import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, type TextStyle } from "react-native";

import { useEventRsvps, type EventRsvp, type RsvpStatus } from "@/lib/api/event-rsvps";
import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { getProfiles } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { OMSLAG, RASTER, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { displayName, hhmm } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { DesktopShell, PageHead } from "./Shell";
import { Black, Label, Scrim } from "../magazine/Omslag";

/**
 * Events op desktop (desktop-*-pages.dc.html, EVENTS; handoff 23 sep).
 *
 * Per event de dag groot in de kleur van wie uitnodigt, wie en wanneer, de
 * titel, de eerste regel van de beschrijving en wie er komt, en rechts
 * "Ik kom" / "Misschien" (0072, `event_rsvps`).
 *
 *   magazine  vlakken op het tweede papier met een rug van 5; de dag als
 *             serif van 120 in de kleur, de titel serif 56, pillen.
 *   modern    drie tegels per rij: bovenaan het kleurvlak met de dag, dan
 *             titel, plek en twee pillen.
 *
 * Een tik op het event opent het (`/event/[id]`); voorbij events staan
 * achteraan en gedimd.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const SEAM = RASTER.seam;

type Row = {
  e: EventWithMeta;
  day: string;
  month: string;
  when: string;
  host: string;
  place: string;
  whoGo: string;
  mine: RsvpStatus | null;
  past: boolean;
  fill: { fill: string; ink: string };
};

export function DesktopEvents() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const spec = useThemeSpec();
  const scheme = useScheme();
  useHueChoices();

  const events = useQuery({ queryKey: ["events", myUserId], queryFn: () => listMyEvents(myUserId), refetchOnWindowFocus: true });
  const data = useMemo(() => events.data ?? [], [events.data]);
  const ids = useMemo(() => data.map((e) => e.id), [data]);
  const onRsvpError = useCallback((err: unknown) => toast.error(err instanceof Error ? err.message : t.failed), [toast, t.failed]);
  const rsvp = useEventRsvps(ids, myUserId, onRsvpError);
  const peopleIds = useMemo(
    () => Array.from(new Set([...data.map((e) => e.host_user_id), ...rsvp.rsvps.map((r) => r.user_id)])),
    [data, rsvp.rsvps],
  );
  const people = useQuery({ queryKey: ["profiles", peopleIds], queryFn: () => getProfiles(peopleIds), enabled: peopleIds.length > 0, staleTime: 60_000 });
  const nameOf = useMemo(() => {
    const m = new Map((people.data ?? []).map((p) => [p.id, displayName(p)]));
    return (id: string) => (id === myUserId ? t.me.toLowerCase() : m.get(id) ?? "linc");
  }, [people.data, myUserId, t.me]);

  const now = Date.now();
  const rows: Row[] = useMemo(() => {
    const byEvent = new Map<string, EventRsvp[]>();
    for (const r of rsvp.rsvps) byEvent.set(r.event_id, [...(byEvent.get(r.event_id) ?? []), r]);
    const sorted = [...data].sort((a, b) => {
      const pa = new Date(a.ends_at).getTime() <= now;
      const pb = new Date(b.ends_at).getTime() <= now;
      if (pa !== pb) return pa ? 1 : -1;
      return pa ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at);
    });
    return sorted.map((e) => {
      const start = new Date(e.starts_at);
      const end = new Date(e.ends_at);
      const sameDay = start.toDateString() === end.toDateString();
      const wd = start.toLocaleDateString(LOCALE[lang], { weekday: "short" }).replace(".", "");
      const list = byEvent.get(e.id) ?? [];
      const going = list.filter((r) => r.status === "yes").map((r) => nameOf(r.user_id));
      return {
        e,
        day: String(start.getDate()).padStart(2, "0"),
        month: start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", ""),
        when: sameDay ? `${wd} ${hhmm(e.starts_at)}` : `${wd} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" }).replace(".", "")}`,
        host: e.is_host ? t.me : nameOf(e.host_user_id),
        // De plek (0073); voor oudere events de eerste regel van de beschrijving.
        place: e.place?.trim() || (e.description ?? "").split("\n")[0].trim(),
        whoGo: going.length ? going.join(", ") : `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`,
        mine: list.find((r) => r.user_id === myUserId)?.status ?? null,
        past: new Date(e.ends_at).getTime() <= now,
        fill: friendColor(hueFor(e.host_user_id), scheme),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rsvp.rsvps, nameOf, lang, scheme, myUserId, t]);

  const answer = rsvp.answer;

  const upcoming = rows.filter((r) => !r.past);
  const months = upcoming.length ? `${upcoming[0].month} – ${upcoming[upcoming.length - 1].month}` : "";
  const th = spec.id;
  const [gridW, setGridW] = useState(0);
  const open = (id: string) => router.push(`/event/${id}` as never);

  const list =
    th === "modern" ? (
      <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM }}>
        {gridW
          ? rows.map((r) => (
              <TileModern key={r.e.id} r={r} width={(gridW - SEAM * 2) / 3} onOpen={() => open(r.e.id)} onAnswer={(s) => answer(r.e.id, s)} />
            ))
          : null}
      </View>
    ) : (
      <View style={{ gap: SEAM, padding: SEAM }}>
        {rows.map((r) => (
          <RowMagazine key={r.e.id} r={r} onOpen={() => open(r.e.id)} onAnswer={(s) => answer(r.e.id, s)} />
        ))}
      </View>
    );

  return (
    <DesktopShell active="events">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={th === "modern" ? { gap: SEAM } : undefined} showsVerticalScrollIndicator={false}>
        <PageHead
          num="03"
          title={t.eventsTitle}
          sub={`${upcoming.length} ${t.upcomingN}${months ? ` · ${months}` : ""}`}
          action={{ label: t.newEventPlus, onPress: () => router.push("/event-create") }}
        />
        {events.isLoading ? <Text style={[meta(10, color("ink", "inkDim")), { padding: 24 }]}>{t.loading}</Text> : list}
      </ScrollView>
    </DesktopShell>
  );
}

function meta(size: number, c: string, spacing = size * 0.1): TextStyle {
  return { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

type RowProps = { r: Row; onOpen: () => void; onAnswer: (s: RsvpStatus | null) => void };

// ---------------------------------------------------------------
// MAGAZINE
// ---------------------------------------------------------------

function RowMagazine({ r, onOpen }: RowProps) {
  const t = useT();
  const ink = color("ink");
  // De omslag (handoff 24 sep): met een cover vult de foto de kolom van 200
  // en staat de datum wit op een verloop onderaan; zonder cover de dag rood
  // in Archivo 900 van 130 met de maand in de vriendkleur. Geen "Ik kom /
  // Misschien" in magazine — het prototype zet die keuze niet op de lijst;
  // ze staat op de eventpagina.
  const cover = r.e.cover_url;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={r.e.name}
      onPress={onOpen}
      style={{ flexDirection: "row", minHeight: 200, backgroundColor: color("paper2"), borderLeftWidth: 5, borderLeftColor: r.fill.fill, opacity: r.past ? 0.6 : 1 }}
    >
      <View style={{ width: 200, overflow: "hidden", borderRightWidth: 1, borderRightColor: color("ink", "postRule") }}>
        {cover ? (
          <>
            <Image source={{ uri: cover }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={150} />
            <Scrim css="linear-gradient(0deg,rgba(16,16,12,.66),rgba(16,16,12,0))" style={{ left: 0, right: 0, bottom: 0, height: 72 }} />
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingVertical: 14, paddingHorizontal: 20 }}>
              <Label size={10} color={OMSLAG.onImage}>
                {r.day} {r.month}
              </Label>
            </View>
          </>
        ) : (
          <View style={{ flex: 1, paddingVertical: 26, paddingHorizontal: 28, justifyContent: "space-between" }}>
            <Label size={10} color={r.fill.fill}>
              {r.month}
            </Label>
            <Black size={130} f={0.76} nowrap>
              {r.day}
            </Black>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 26, paddingHorizontal: 32, justifyContent: "space-between", gap: 14 }}>
        <Label size={10} color={color("ink", "inkDim")}>
          {r.host} {t.invites} · {r.when}
        </Label>
        <Text numberOfLines={2} style={[serif(), { fontSize: 56, lineHeight: 53, letterSpacing: -1.12, color: ink }]}>
          {r.e.name}
        </Text>
        <Text numberOfLines={1} style={[serif(true), { fontSize: 20, lineHeight: 25, color: color("inkSoft") }]}>
          {r.place ? `${r.place} — ${t.withWho} ` : ""}
          {r.whoGo}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// MODERN
// ---------------------------------------------------------------

function TileModern({ r, width, onOpen, onAnswer }: RowProps & { width: number }) {
  const t = useT();
  const ink = color("ink");
  const pill = (label: string, s: RsvpStatus) => {
    const on = r.mine === s;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onAnswer(on ? null : s)}
        style={{ flex: 1, height: 44, borderRadius: 999, borderWidth: 1, borderColor: color("ink", "postRule"), backgroundColor: on ? ink : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        <Text style={[mono(500), { fontSize: 9.5, lineHeight: 12, letterSpacing: 1.14, textTransform: "uppercase", color: on ? color("paper") : s === "maybe" ? color("ink", "inkDim") : ink }]}>
          {label}
          {on ? " ✓" : ""}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={{ width, borderRadius: RASTER.tileRadius, overflow: "hidden", backgroundColor: color("tile", "tileFill"), opacity: r.past ? 0.6 : 1 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={r.e.name} onPress={onOpen} style={{ height: 240, backgroundColor: r.fill.fill, padding: 22, justifyContent: "space-between" }}>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.44, textTransform: "uppercase", color: r.fill.ink }]}>
          {r.month} · {r.when}
        </Text>
        <Text style={[sans(400), { fontSize: 120, lineHeight: 96, letterSpacing: -7.2, color: r.fill.ink }]}>{r.day}</Text>
      </Pressable>
      <View style={{ flex: 1, paddingTop: 20, paddingHorizontal: 22, paddingBottom: 22, gap: 10 }}>
        <Text style={[mono(500), { fontSize: 8.5, lineHeight: 11, letterSpacing: 1.36, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
          {r.host} {t.invites}
        </Text>
        <Pressable accessibilityRole="link" onPress={onOpen}>
          <Text numberOfLines={2} style={[sans(400), { fontSize: 30, lineHeight: 31.5, letterSpacing: -1.05, color: ink }]}>
            {r.e.name}
          </Text>
        </Pressable>
        <Text numberOfLines={1} style={[sans(400), { fontSize: 15, lineHeight: 20, color: color("ink", "inkDim") }]}>
          {r.place ? `${r.place} · ` : ""}
          {r.whoGo}
        </Text>
        <View style={{ marginTop: "auto", paddingTop: 10, flexDirection: "row", gap: SEAM }} pointerEvents={r.past ? "none" : "auto"}>
          {pill(t.imIn, "yes")}
          {pill(t.maybe, "maybe")}
        </View>
      </View>
    </View>
  );
}
