import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, type TextStyle } from "react-native";

import { listRsvps, setRsvp, type EventRsvp, type RsvpStatus } from "@/lib/api/event-rsvps";
import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { getProfiles } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { RASTER, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { displayName, hhmm } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { DesktopShell, PageHead } from "./Shell";

/**
 * Events op desktop (desktop-*-pages.dc.html, EVENTS; handoff 23 sep).
 *
 * Per event de dag groot in de kleur van wie uitnodigt, wie en wanneer, de
 * titel, de eerste regel van de beschrijving en wie er komt, en rechts
 * "Ik kom" / "Misschien" (0072, `event_rsvps`).
 *
 *   kleur     rijen over de volle breedte: een datumblok van 180 in de
 *             kleur, titel in Archivo 900 smal 48, de twee antwoorden als
 *             vakken onder elkaar.
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
  const qc = useQueryClient();
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const spec = useThemeSpec();
  const scheme = useScheme();
  useHueChoices();

  const events = useQuery({ queryKey: ["events", myUserId], queryFn: () => listMyEvents(myUserId), refetchOnWindowFocus: true });
  const data = useMemo(() => events.data ?? [], [events.data]);
  const ids = useMemo(() => data.map((e) => e.id), [data]);
  const rsvps = useQuery({ queryKey: ["event-rsvps", ids], queryFn: () => listRsvps(ids), enabled: ids.length > 0 });
  const peopleIds = useMemo(
    () => Array.from(new Set([...data.map((e) => e.host_user_id), ...(rsvps.data ?? []).map((r) => r.user_id)])),
    [data, rsvps.data],
  );
  const people = useQuery({ queryKey: ["profiles", peopleIds], queryFn: () => getProfiles(peopleIds), enabled: peopleIds.length > 0, staleTime: 60_000 });
  const nameOf = useMemo(() => {
    const m = new Map((people.data ?? []).map((p) => [p.id, displayName(p)]));
    return (id: string) => (id === myUserId ? t.me.toLowerCase() : m.get(id) ?? "linc");
  }, [people.data, myUserId, t.me]);

  const now = Date.now();
  const rows: Row[] = useMemo(() => {
    const byEvent = new Map<string, EventRsvp[]>();
    for (const r of rsvps.data ?? []) byEvent.set(r.event_id, [...(byEvent.get(r.event_id) ?? []), r]);
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
  }, [data, rsvps.data, nameOf, lang, scheme, myUserId, t]);

  const answer = async (eventId: string, next: RsvpStatus | null) => {
    const key = ["event-rsvps", ids];
    const prev = qc.getQueryData<EventRsvp[]>(key) ?? [];
    const rest = prev.filter((r) => !(r.event_id === eventId && r.user_id === myUserId));
    qc.setQueryData<EventRsvp[]>(key, next ? [...rest, { event_id: eventId, user_id: myUserId, status: next }] : rest);
    try {
      await setRsvp(eventId, myUserId, next);
    } catch (err) {
      qc.setQueryData(key, prev);
      toast.error(err instanceof Error ? err.message : t.failed);
    }
  };

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
    ) : th === "magazine" ? (
      <View style={{ gap: SEAM, padding: SEAM }}>
        {rows.map((r) => (
          <RowMagazine key={r.e.id} r={r} onOpen={() => open(r.e.id)} onAnswer={(s) => answer(r.e.id, s)} />
        ))}
      </View>
    ) : (
      <View>
        {rows.map((r) => (
          <RowKleur key={r.e.id} r={r} onOpen={() => open(r.e.id)} onAnswer={(s) => answer(r.e.id, s)} />
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
// KLEUR
// ---------------------------------------------------------------

function RowKleur({ r, onOpen, onAnswer }: RowProps) {
  const t = useT();
  const spec = useThemeSpec();
  const ink = color("ink");
  const cell = (label: string, s: RsvpStatus, last: boolean) => {
    const on = r.mine === s;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onAnswer(on ? null : s)}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, backgroundColor: on ? ink : "transparent", borderBottomWidth: last ? 0 : spec.border, borderBottomColor: ink }}
      >
        <Text style={[head(), { fontSize: 22, lineHeight: 22, color: on ? color("paper") : s === "maybe" ? color("ink", "inkDim") : ink }]}>{label}</Text>
        <Text style={[head(), { fontSize: 22, lineHeight: 22, color: color("paper") }]}>{on ? "✓" : ""}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", minHeight: 180, borderBottomWidth: spec.border, borderBottomColor: ink, opacity: r.past ? 0.6 : 1 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={r.e.name} onPress={onOpen} style={{ width: 180, backgroundColor: r.fill.fill, borderRightWidth: spec.border, borderRightColor: ink, paddingVertical: 20, paddingHorizontal: 24, justifyContent: "space-between" }}>
        <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase", color: r.fill.ink }]}>{r.month}</Text>
        <Text style={[head(), { fontSize: 104, lineHeight: 84, color: r.fill.ink }]}>{r.day}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={onOpen} style={{ flex: 1, minWidth: 0, paddingVertical: 24, paddingHorizontal: 32, justifyContent: "space-between", gap: 16 }}>
        <Text style={meta(10, color("ink", "inkDim"))}>
          {r.host} {t.invites} · {r.when}
        </Text>
        <Text numberOfLines={2} style={[head(), { fontSize: 48, lineHeight: 43, color: ink }]}>
          {r.e.name}
        </Text>
        <View style={{ flexDirection: "row", gap: 28 }}>
          {r.place ? <Text style={meta(11, ink, 0.66)}>◎ {r.place}</Text> : null}
          <Text style={meta(11, color("ink", "inkDim"), 0.66)}>{r.whoGo}</Text>
        </View>
      </Pressable>
      <View style={{ width: 300, borderLeftWidth: spec.border, borderLeftColor: ink, opacity: r.past ? 0.5 : 1 }} pointerEvents={r.past ? "none" : "auto"}>
        {cell(t.imIn, "yes", false)}
        {cell(t.maybe, "maybe", true)}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// MAGAZINE
// ---------------------------------------------------------------

function RowMagazine({ r, onOpen, onAnswer }: RowProps) {
  const t = useT();
  const ink = color("ink");
  const pill = (label: string, s: RsvpStatus) => {
    const on = r.mine === s;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onAnswer(on ? null : s)}
        style={{ height: 44, borderRadius: 22, borderWidth: 1, borderColor: s === "yes" || on ? ink : color("ink", "postRule"), backgroundColor: on ? ink : "transparent", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}
      >
        <Text style={[sans(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.6, textTransform: "uppercase", color: on ? color("paper") : s === "maybe" ? color("ink", "inkDim") : ink }]}>{label}</Text>
        <Text style={{ fontSize: 12, color: color("paper") }}>{on ? "✓" : ""}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", minHeight: 200, backgroundColor: color("paper2"), borderLeftWidth: 5, borderLeftColor: r.fill.fill, opacity: r.past ? 0.6 : 1 }}>
      <Pressable accessibilityRole="link" accessibilityLabel={r.e.name} onPress={onOpen} style={{ width: 200, paddingVertical: 26, paddingHorizontal: 28, justifyContent: "space-between", borderRightWidth: 1, borderRightColor: color("ink", "postRule") }}>
        <Text style={[sans(500), { fontSize: 10, lineHeight: 13, letterSpacing: 2, textTransform: "uppercase", color: r.fill.fill }]}>{r.month}</Text>
        <Text style={[serif(), { fontSize: 120, lineHeight: 96, letterSpacing: -4.8, color: r.fill.fill }]}>{r.day}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={onOpen} style={{ flex: 1, minWidth: 0, paddingVertical: 26, paddingHorizontal: 32, justifyContent: "space-between", gap: 14 }}>
        <Text style={[sans(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.8, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
          {r.host} {t.invites} · {r.when}
        </Text>
        <Text numberOfLines={2} style={[serif(), { fontSize: 56, lineHeight: 53, letterSpacing: -1.1, color: ink }]}>
          {r.e.name}
        </Text>
        <Text numberOfLines={1} style={[serif(true), { fontSize: 20, lineHeight: 25, color: color("inkSoft") }]}>
          {r.place ? `${r.place} — ` : ""}
          {r.whoGo}
        </Text>
      </Pressable>
      <View style={{ width: 280, paddingVertical: 26, paddingHorizontal: 28, justifyContent: "flex-end", gap: 10 }} pointerEvents={r.past ? "none" : "auto"}>
        {pill(t.imIn, "yes")}
        {pill(t.maybe, "maybe")}
      </View>
    </View>
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
          <Text numberOfLines={2} style={[sans(400), { fontSize: 30, lineHeight: 32, letterSpacing: -1, color: ink }]}>
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
