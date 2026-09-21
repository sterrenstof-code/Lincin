import { Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen, vfade } from "@/components/lincin/Chrome";
import { color, friendColor, hueFor, type Hue, type Scheme } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { MagazineHead, Spread, SpreadCaption, SpreadKicker, SpreadTitle } from "./Spread";

/**
 * De subpagina's van magazine als poster-spreads (WIJZIGINGEN-2.2 §2).
 *
 * Gesprekken, events, meldingen en jij volgen hetzelfde model als de feed:
 * een kolofonkop, dan per item een volvlaks kleurvlak met een naad van 6,
 * een verticale metarail die per item van kant wisselt, een serif-kop en
 * een cursief onderschrift. De hoogtes verschillen per pagina, en elk derde
 * item is het hoge.
 *
 * Alle inkt op een kleurvlak is de inkt van díe vriendkleur — nooit de
 * globale inkt (§5, contrast).
 */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={[{ flex: 1 }, vfade()]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

// ---------------------------------------------------------------
// GESPREKKEN — 146 / 182
// ---------------------------------------------------------------

export type ChatSpreadData = {
  key: string;
  name: string;
  hue: Hue;
  time: string;
  preview: string;
  unread: number;
  onPress: () => void;
};

export function ChatsMagazine({
  rows,
  unread,
  scheme,
  t,
  state,
  footer,
}: {
  rows: ChatSpreadData[];
  unread: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
  footer?: React.ReactNode;
}) {
  return (
    <LincinScreen tab="chats" counter={t.tabChats}>
      <Page>
        <MagazineHead kicker={`${t.edition} · ${t.chats}`} title={t.chats} sub={`${unread} ${t.unread}`} />
        {state ? <Note>{state}</Note> : null}
        {rows.map((c, i) => {
          const fc = friendColor(c.hue, scheme);
          return (
            <Spread
              key={c.key}
              index={i}
              page="chats"
              fill={fc.fill}
              ink={fc.ink}
              rail={c.time}
              onPress={c.onPress}
              accessibilityLabel={c.unread > 0 ? `${c.name}, ${c.unread} ${t.unread}` : c.name}
              media={
                c.unread > 0 ? (
                  <View style={{ flex: 1, backgroundColor: color("paper"), alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ ...serif(), fontSize: 26, lineHeight: 30, color: fc.fill }}>{c.unread}</Text>
                  </View>
                ) : undefined
              }
              mediaWidth={52}
            >
              <SpreadTitle ink={fc.ink} numberOfLines={2}>
                {c.name}
              </SpreadTitle>
              <SpreadCaption ink={fc.ink} size={15} numberOfLines={2}>
                {c.preview}
              </SpreadCaption>
            </Spread>
          );
        })}
        {footer}
      </Page>
    </LincinScreen>
  );
}

// ---------------------------------------------------------------
// EVENTS — 212 / 258
// ---------------------------------------------------------------

export type EventSpreadData = {
  key: string;
  hostId: string;
  day: string;
  month: string;
  by: string;
  when: string;
  title: string;
  sub: string;
  past: boolean;
  actions: { label: string; onPress: () => void }[];
};

export function EventsMagazine({
  events,
  past,
  planned,
  waiting,
  scheme,
  t,
  state,
  onPlanNew,
}: {
  events: EventSpreadData[];
  past: EventSpreadData[];
  planned: number;
  waiting: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
  onPlanNew: () => void;
}) {
  return (
    <LincinScreen tab="events" counter={t.tabEvents}>
      <Page>
        <MagazineHead
          kicker={`${t.edition} · ${t.eventsA}`}
          title={`${t.eventsA}\n${t.eventsB}`}
          sub={`${planned} ${t.planned}${waiting ? ` · ${waiting} ${t.waitsForYou}` : ""}`}
        />
        {state ? <Note>{state}</Note> : null}
        {events.map((e, i) => (
          <EventSpread key={e.key} e={e} index={i} scheme={scheme} />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.planNew}
          onPress={onPlanNew}
          style={({ pressed }) => ({
            marginHorizontal: 6,
            marginBottom: 6,
            paddingVertical: 30,
            paddingHorizontal: 20,
            minHeight: 44,
            backgroundColor: color("paper2"),
            alignItems: "center",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ ...serif(true), fontSize: 19, lineHeight: 24, color: color("ink", "inkDim") }}>{t.planNew}</Text>
        </Pressable>
        {past.map((e, i) => (
          <EventSpread key={e.key} e={e} index={i} scheme={scheme} />
        ))}
      </Page>
    </LincinScreen>
  );
}

function EventSpread({ e, index, scheme }: { e: EventSpreadData; index: number; scheme: Scheme }) {
  const fc = friendColor(hueFor(e.hostId), scheme);
  return (
    <Spread
      index={index}
      page="events"
      fill={fc.fill}
      ink={fc.ink}
      rail={`${e.by} · ${e.when}`}
      style={{ opacity: e.past ? 0.6 : 1 }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ ...serif(), fontSize: 40, lineHeight: 36, letterSpacing: -1.2, color: fc.ink }}>{e.day}</Text>
        <SpreadKicker ink={fc.ink}>{e.month}</SpreadKicker>
      </View>
      <SpreadTitle ink={fc.ink} size={29} numberOfLines={2}>
        {e.title}
      </SpreadTitle>
      <SpreadCaption ink={fc.ink} numberOfLines={1}>
        {e.sub}
      </SpreadCaption>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        {e.actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            onPress={a.onPress}
            style={{ paddingVertical: 14, marginVertical: -14 }}
          >
            <Text
              style={{
                ...sans(500),
                fontSize: 9,
                lineHeight: 12,
                letterSpacing: 1.44,
                textTransform: "uppercase",
                color: fc.ink,
                textDecorationLine: "underline",
              }}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Spread>
  );
}

// ---------------------------------------------------------------
// MELDINGEN — 126 / 158
// ---------------------------------------------------------------

export type NoteSpreadData = {
  key: string;
  actorId: string | null;
  by: string;
  text: string;
  when: string;
  no: string;
  onPress: () => void;
};

export function NotificationsMagazine({
  rows,
  unread,
  scheme,
  t,
  state,
}: {
  rows: NoteSpreadData[];
  unread: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
}) {
  return (
    <LincinScreen tab="you" counter={t.notifications} back="/profile">
      <Page>
        <MagazineHead
          kicker={`${t.edition} · ${t.notifications}`}
          title={t.notifications}
          sub={`${unread} ${t.new}`}
        />
        {state ? <Note>{state}</Note> : null}
        {rows.map((n, i) => {
          const fc = friendColor(hueFor(n.actorId), scheme);
          return (
            <Spread
              key={n.key}
              index={i}
              page="notes"
              fill={fc.fill}
              ink={fc.ink}
              rail={`№ ${n.no} · ${n.when}`}
              onPress={n.onPress}
              accessibilityLabel={`${n.by} ${n.text}`}
            >
              {n.by ? <SpreadKicker ink={fc.ink}>{n.by}</SpreadKicker> : null}
              <SpreadTitle ink={fc.ink} size={24} numberOfLines={3}>
                {n.text}
              </SpreadTitle>
            </Spread>
          );
        })}
      </Page>
    </LincinScreen>
  );
}

// ---------------------------------------------------------------
// JIJ
// ---------------------------------------------------------------

export function YouMagazine({
  first,
  last,
  sub,
  hue,
  latest,
  links,
  scheme,
  t,
}: {
  first: string;
  last: string;
  sub: string;
  hue: Hue;
  latest: { key: string; onPress: () => void; children: React.ReactNode }[];
  links: { label: string; right: string; red?: boolean; onPress: () => void }[];
  scheme: Scheme;
  t: Dict;
}) {
  const fc = friendColor(hue, scheme);
  return (
    <LincinScreen tab="you" counter={t.tabYou}>
      <Page>
        <MagazineHead kicker={`${t.edition} · ${t.scrProfile}`} title={`${first}${last ? `\n${last}` : ""}`} sub={sub} />
        {/* Je laatste bijdragen: één kleurvlak met de rail, en daarin een
            strip die horizontaal schuift. */}
        <View style={{ marginHorizontal: 6, marginBottom: 6, minHeight: 196, flexDirection: "row", backgroundColor: fc.fill }}>
          <View style={{ flexShrink: 0, width: 26, alignItems: "center", justifyContent: "center" }}>
            <Text
              numberOfLines={1}
              style={{
                ...sans(500),
                fontSize: 8,
                lineHeight: 11,
                letterSpacing: 1.92,
                textTransform: "uppercase",
                color: fc.ink,
                width: 196,
                textAlign: "center",
                transform: [{ rotate: "90deg" }],
              }}
            >
              {t.yourLatest}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 14, paddingRight: 14 }}
          >
            {latest.map((m) => (
              <Pressable
                key={m.key}
                accessibilityRole="button"
                onPress={m.onPress}
                style={({ pressed }) => ({
                  flexShrink: 0,
                  width: 124,
                  backgroundColor: color("paper"),
                  overflow: "hidden",
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                {m.children}
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ marginHorizontal: 6, marginBottom: 6, backgroundColor: color("paper2") }}>
          {links.map((l, i) => (
            <Pressable
              key={l.label}
              accessibilityRole="button"
              accessibilityLabel={`${l.label} ${l.right}`}
              onPress={l.onPress}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                minHeight: 44,
                paddingVertical: 20,
                paddingHorizontal: 18,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: color("ink", "postRule"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ ...serif(), fontSize: 26, lineHeight: 26, color: color("ink") }}>{l.label}</Text>
              <Text
                style={{
                  ...sans(500),
                  fontSize: 9,
                  lineHeight: 12,
                  letterSpacing: 1.62,
                  textTransform: "uppercase",
                  color: l.red ? fc.fill : color("ink", "inkDim"),
                }}
              >
                {l.right}
              </Text>
            </Pressable>
          ))}
        </View>
      </Page>
    </LincinScreen>
  );
}

/** Eén regel in de bladspiegel: laden, mislukt, of niets gevonden. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        ...serif(true),
        fontSize: 17,
        lineHeight: 23,
        color: color("ink", "inkDim"),
        textAlign: "center",
        paddingVertical: 30,
        paddingHorizontal: 24,
      }}
    >
      {children}
    </Text>
  );
}
