import { Pressable, Text, View } from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { color, friendColor, hueFor, type Scheme } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import type { RsvpStatus } from "@/lib/api/event-rsvps";
import type { Dict } from "@/lib/i18n";

import { Bento, Counter, DashRule, DashedTile, Tile, TileMeta, TitleTile } from "./Bento";

/**
 * Events in modern (prototype `EVENTS · MODERN`).
 *
 * Per event één tegel over twee kolommen: een gekleurd datumvierkant van
 * 58 met de dag groot en de maand in mono, daarnaast de maker en het
 * tijdstip boven de titel. Onder een GESTIPPELDE scheiding de plek en het
 * gezelschap, met rechts de pillen "Ik kom" / "Misschien" (0072): jouw
 * keuze gevuld in inkt, nog een tik wist hem. De tegel zelf opent het
 * event; "Deel code" (alleen de host) staat als link naast de maker, want
 * een derde pil laat geen plaats meer voor de plek.
 */

export type EventTileData = {
  key: string;
  hostId: string;
  day: string;
  month: string;
  by: string;
  when: string;
  title: string;
  sub: string;
  live: boolean;
  waiting: number;
  past: boolean;
  /** Het event openen: een tik op de tegel. */
  onOpen: () => void;
  /** Jouw antwoord, of `null` als je nog niets zei. */
  mine: RsvpStatus | null;
  /** Antwoorden; ontbreekt op een voorbij event. `null` wist je antwoord. */
  onAnswer?: (s: RsvpStatus | null) => void;
  /** Bijkomende acties (de host: "Deel code"). */
  actions: { label: string; onPress: () => void; fill?: boolean }[];
};

export function EventsModern({
  events,
  past,
  planned,
  liveCount,
  waiting,
  scheme,
  t,
  state,
  onPlanNew,
}: {
  events: EventTileData[];
  past: EventTileData[];
  planned: number;
  liveCount: number;
  /** Toegangsverzoeken bij jouw events: "1 wacht op jou" in de teller, zoals het prototype. */
  waiting: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
  onPlanNew: () => void;
}) {
  return (
    <LincinScreen tab="events" counter={t.tabEvents}>
      <Bento>
        <TitleTile
          title={`${t.eventsA} ${t.eventsB}`}
          meta={
            <Counter>
              {planned} {t.planned}
              {waiting > 0 ? `\n${waiting} ${t.waitsForYou}` : ""}
              {liveCount > 0 ? `\n${liveCount} ${t.nowLive}` : ""}
            </Counter>
          }
        />
        {state ? (
          <Tile span={2}>
            <TileMeta>{state}</TileMeta>
          </Tile>
        ) : null}
        {events.map((e) => (
          <EventTile key={e.key} e={e} scheme={scheme} t={t} />
        ))}
        <DashedTile label={`${t.planNew} →`} onPress={onPlanNew} />
        {past.length ? (
          <Tile span={2} pad={0} style={{ backgroundColor: "transparent", paddingTop: 10, paddingHorizontal: 20 }}>
            <TileMeta>{t.eventPast}</TileMeta>
          </Tile>
        ) : null}
        {past.map((e) => (
          <EventTile key={e.key} e={e} scheme={scheme} t={t} />
        ))}
      </Bento>
    </LincinScreen>
  );
}

function EventTile({ e, scheme, t }: { e: EventTileData; scheme: Scheme; t: Dict }) {
  const fc = friendColor(hueFor(e.hostId), scheme);
  return (
    <Tile span={2} onPress={e.onOpen} accessibilityLabel={e.title} style={{ gap: 16, opacity: e.past ? 0.6 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            flexShrink: 0,
            width: 58,
            height: 58,
            borderRadius: 16,
            backgroundColor: fc.fill,
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Text style={{ ...sans(500), fontSize: 21, lineHeight: 21, letterSpacing: -0.42, color: fc.ink }}>{e.day}</Text>
          <Text
            style={{ ...mono(500), fontSize: 8, lineHeight: 10, letterSpacing: 1.12, textTransform: "uppercase", color: fc.ink }}
          >
            {e.month}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <TileMeta>
              {e.by} · {e.when}
            </TileMeta>
            {e.live ? <Pill label={t.nowLive} tone={color("ink")} fg={color("paper")} /> : null}
            {e.waiting > 0 ? (
              <Pill label={`${e.waiting} ${t.waitsForYou}`} tone={color("red")} fg={color("paper")} />
            ) : null}
            {e.actions.map((a) => (
              <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} hitSlop={14}>
                <Text style={{ ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 1.44, textTransform: "uppercase", color: color("ink"), textDecorationLine: "underline" }}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text
            numberOfLines={2}
            style={{ ...sans(500), fontSize: 18, lineHeight: 21, letterSpacing: -0.36, color: color("ink") }}
          >
            {e.title}
          </Text>
        </View>
      </View>
      <DashRule style={{ paddingTop: 14 }} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -2 }}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, minWidth: 0, ...sans(400), fontSize: 12.5, lineHeight: 16, color: color("ink", "inkDim") }}
        >
          {e.sub}
        </Text>
        {e.onAnswer ? (
          <View style={{ flexShrink: 0, flexDirection: "row", gap: 6 }}>
            {(["yes", "maybe"] as const).map((s) => {
              const on = e.mine === s;
              return (
                <ActionPill
                  key={s}
                  label={s === "yes" ? t.imIn : t.maybe}
                  selected={on}
                  onPress={() => e.onAnswer?.(on ? null : s)}
                  fill={on}
                />
              );
            })}
          </View>
        ) : null}
      </View>
    </Tile>
  );
}

function Pill({ label, tone, fg }: { label: string; tone: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tone }}>
      <Text style={{ ...mono(500), fontSize: 8.5, lineHeight: 11, letterSpacing: 1.02, textTransform: "uppercase", color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/** Een knop van 44 hoog, zoals het prototype ze in modern zet: gevuld in inkt als hij aan staat. */
function ActionPill({ label, onPress, fill = false, selected }: { label: string; onPress: () => void; fill?: boolean; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: fill ? color("ink") : color("ink", "dash"),
        backgroundColor: fill ? color("ink") : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          ...mono(500),
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: fill ? color("paper") : color("ink"),
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
