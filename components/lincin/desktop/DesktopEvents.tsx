import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useScheme } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { PANEL_W, RAIL_W } from "@/lib/lincin/desktop";
import { hhmm } from "@/lib/lincin/model";

import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * Events op desktop (Lincin Desktop.dc.html, EVENTS): een raster van
 * kaarten van minstens 340 breed met haarlijnen ertussen. Links de dag in
 * serif 56 onder een kleurblokje, rechts wie · wanneer, de titel in serif
 * 28, plek · gezelschap, en onderaan de handelingen als mono-links.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const MIN = 340;

export function DesktopEvents() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const { width } = useWindowDimensions();
  const mainW = width - RAIL_W - PANEL_W;
  const cols = Math.max(1, Math.floor(mainW / MIN));
  const cardW = (mainW - (cols - 1)) / cols;

  const events = useQuery({ queryKey: ["events", myUserId], queryFn: () => listMyEvents(myUserId), refetchOnWindowFocus: true });
  const data = events.data ?? [];
  const now = Date.now();
  const active = data.filter((e) => e.is_active);
  const upcoming = data.filter((e) => !e.is_active && new Date(e.starts_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = data.filter((e) => !e.is_active && new Date(e.ends_at).getTime() <= now).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const waiting = data.reduce((n, e) => n + (e.is_host ? e.pending_requests_count : 0), 0);

  return (
    <DesktopShell active="events">
      <DesktopTitle
        right={
          <>
            <MonoLink label={`${upcoming.length + active.length} ${t.planned}${waiting ? ` · ${waiting} ${t.waitsForYou}` : ""}`} on={false} />
            <MonoLink label={`${t.planNew} →`} active onPress={() => router.push("/event-create")} />
          </>
        }
      >
        {t.eventsA} <Text style={serif(true)}>{t.eventsB}</Text>
      </DesktopTitle>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, backgroundColor: color("ink", "postRule"), borderBottomWidth: 1, borderBottomColor: color("ink") }}>
          {[...active, ...upcoming, ...past].map((e) => (
            <Card key={e.id} event={e} width={cardW} past={!e.is_active && new Date(e.ends_at).getTime() <= now} />
          ))}
        </View>
        {events.isLoading ? (
          <Text style={[mono(500), { fontSize: 10, color: color("ink", "inkDim"), padding: 48, textTransform: "uppercase", letterSpacing: 0.8 }]}>{t.loading}</Text>
        ) : null}
      </ScrollView>
    </DesktopShell>
  );
}

function Card({ event: e, width, past }: { event: EventWithMeta; width: number; past: boolean }) {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(hueFor(e.host_user_id), scheme);
  const start = new Date(e.starts_at);
  const end = new Date(e.ends_at);
  const sameDay = start.toDateString() === end.toDateString();
  const day = start.toLocaleDateString(LOCALE[lang], { weekday: "short" });
  const when = sameDay ? `${day} ${hhmm(e.starts_at)}` : `${day} — ${end.toLocaleDateString(LOCALE[lang], { weekday: "short" })}`;
  const who = `${e.members_count} ${e.members_count === 1 ? "linc" : "lincs"}`;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  return (
    <Pressable
      accessibilityLabel={e.name}
      onPress={() => router.push(`/event/${e.id}` as never)}
      style={{ width, backgroundColor: color("paper"), flexDirection: "row", gap: 22, paddingTop: 24, paddingHorizontal: 28, paddingBottom: 20, minHeight: 190, opacity: past ? 0.6 : 1 }}
    >
      <View style={{ width: 72, gap: 6 }}>
        <View style={{ width: 10, height: 10, backgroundColor: fc.fill }} />
        <Text style={[serif(), { fontSize: 56, lineHeight: 48, letterSpacing: -1.68, color: ink }]}>{String(start.getDate()).padStart(2, "0")}</Text>
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: dim }]}>
          {start.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "")}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>
            {e.is_host ? t.me : "linc"}
            {e.is_active ? `  ·  nu bezig` : ""}
          </Text>
          <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>{when}</Text>
        </View>
        <Text numberOfLines={2} style={[serif(), { fontSize: 28, lineHeight: 28.5, letterSpacing: -0.42, color: ink }]}>
          {e.name}
        </Text>
        <Text numberOfLines={1} style={[sans(), { fontSize: 14, lineHeight: 20, color: dim }]}>
          {e.description ? `${e.description.split("\n")[0]} · ` : ""}
          {who}
        </Text>
        <View style={{ flexDirection: "row", gap: 16, marginTop: "auto", paddingTop: 12, borderTopWidth: 1, borderTopColor: rule }}>
          <MonoLink label="Open →" active onPress={() => router.push(`/event/${e.id}` as never)} />
          {e.is_host && !past ? <MonoLink label="Deel code" on={false} active onPress={() => router.push(`/event-link/${e.id}` as never)} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
