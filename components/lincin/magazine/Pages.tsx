import { Platform, Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { LincinScreen, vfade } from "@/components/lincin/Chrome";
import type { RsvpStatus } from "@/lib/api/event-rsvps";
import { color, friendColor, hueFor, type Hue, type Scheme } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import type { Dict } from "@/lib/i18n";

import { MagazineHead, Spread, SpreadCaption, SpreadKicker, SpreadTitle } from "./Spread";
// Meldingen: rijen met de bouwstenen van de omslag.
import { AvatarPhoto } from "@/components/lincin/AvatarPhoto";
import { OMSLAG } from "@/lib/design/theme";
import { Black, Label, LabelLink, RedDot } from "./Omslag";

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
  /** Lang drukken / rechtsklikken: gelezen of ongelezen (ChatReadMenu). */
  menu?: object;
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
              menu={c.menu}
              accessibilityLabel={c.unread > 0 ? `${c.name}, ${c.unread} ${t.unread}` : c.name}
              media={
                c.unread > 0 ? (
                  // Het aantal op een vlak papier (mobile-app.dc.html); de
                  // rode stip bij de naam zegt dat er iets nieuw is.
                  <View style={{ flex: 1, backgroundColor: color("paper"), alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ ...serif(), fontSize: 26, lineHeight: 30, color: color("ink") }}>{c.unread}</Text>
                  </View>
                ) : undefined
              }
              mediaWidth={52}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {/* Ongelezen: een rode stip vóór de naam (HANDOFF). */}
                {c.unread > 0 ? <View accessibilityElementsHidden style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color("red") }} /> : null}
                {/* Ongelezen: de naam vet. Instrument Serif heeft één
                    gewicht, dus web laat de browser hem verdikken en native
                    een haarlijn-schaduw in dezelfde inkt. */}
                <SpreadTitle ink={fc.ink} numberOfLines={2} style={[{ flexShrink: 1 }, c.unread > 0 ? unreadName(fc.ink) : null]}>
                  {c.name}
                </SpreadTitle>
              </View>
              <SpreadCaption ink={fc.ink} size={15} numberOfLines={2} style={c.unread > 0 ? { ...sans(700), fontSize: 14 } : undefined}>
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
  /** Het event openen: een tik op het vlak. */
  onOpen?: () => void;
  /** Jouw antwoord (0072), of `null` als je nog niets zei. */
  mine?: RsvpStatus | null;
  /** "Ik kom" / "Misschien"; ontbreekt op een voorbij event. `null` wist je antwoord. */
  onAnswer?: (s: RsvpStatus | null) => void;
  /** Bijkomende acties, onderstreept (de host: "Deel code"). */
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
          <EventSpread key={e.key} e={e} index={i} scheme={scheme} t={t} />
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
          <EventSpread key={e.key} e={e} index={i} scheme={scheme} t={t} />
        ))}
      </Page>
    </LincinScreen>
  );
}

/**
 * Eén event als spread. Desktop legt ze in een rooster met een vaste hoogte en breedte.
 *
 * Onderaan "Ik kom" / "Misschien" in de vorm van de omslag: vierkant, een
 * lijn van 1 in de inkt van het vlak. Jouw keuze vult zich — "Ik kom" in
 * het rood van de primaire actie met wit, "Misschien" in de inkt van het
 * vlak — en nog een tik wist hem. Het mobiele prototype zet geen knoppen
 * op de spread; de keuze hoort wél bij elk event (HANDOFF: RSVP onthouden).
 */
export function EventSpread({
  e,
  index,
  scheme,
  t,
  height,
  style,
}: {
  e: EventSpreadData;
  index: number;
  scheme: Scheme;
  t: Dict;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const fc = friendColor(hueFor(e.hostId), scheme);
  return (
    <Spread
      index={index}
      page="events"
      fill={fc.fill}
      ink={fc.ink}
      rail={`${e.by} · ${e.when}`}
      height={height}
      onPress={e.onOpen}
      accessibilityLabel={e.title}
      style={[{ opacity: e.past ? 0.6 : 1 }, style]}
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
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        {e.onAnswer ? (
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["yes", "maybe"] as const).map((s) => (
              <RsvpSquare key={s} s={s} on={e.mine === s} fc={fc} label={s === "yes" ? t.imIn : t.maybe} onPress={() => e.onAnswer?.(e.mine === s ? null : s)} />
            ))}
          </View>
        ) : null}
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

function RsvpSquare({
  s,
  on,
  fc,
  label,
  onPress,
}: {
  s: RsvpStatus;
  on: boolean;
  fc: { fill: string; ink: string };
  label: string;
  onPress: () => void;
}) {
  const bg = on ? (s === "yes" ? color("red") : fc.ink) : "transparent";
  const fg = on ? (s === "yes" ? OMSLAG.onImage : fc.fill) : fc.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 44,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: on ? bg : fc.ink,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ ...sans(700), fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: fg }}>
        {label}
        {on ? " ✓" : ""}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// MELDINGEN — rijen met een rug (mobile-app.dc.html, isMeldingenMag)
// ---------------------------------------------------------------

export type NoteSpreadData = {
  key: string;
  actorId: string | null;
  /** De foto van wie het deed; zonder foto blijft de initiaal staan. */
  avatarUrl?: string | null;
  by: string;
  text: string;
  when: string;
  no: string;
  unread?: boolean;
  onPress: () => void;
};

/**
 * Meldingen in magazine.
 *
 * Geen volvlaks kleurvlak per melding meer: het prototype zet ze als een
 * lijst onder een lijn van 2 inkt, elke rij met een rug van 5 in de kleur
 * van wie het deed, een ronde initiaal (of foto), naam en tijd als label,
 * de zin in serif en een rode stip zolang je hem niet las. Veertig
 * meldingen als posters waren veertig schermen scrollen; als rijen lees je
 * ze in één blik.
 */
export function NotificationsMagazine({
  rows,
  unread,
  scheme,
  t,
  state,
  onMarkAll,
}: {
  rows: NoteSpreadData[];
  unread: number;
  scheme: Scheme;
  t: Dict;
  state?: string | null;
  /** "Markeer als gelezen" — alleen getoond als er iets ongelezen is. */
  onMarkAll?: () => void;
}) {
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  return (
    <LincinScreen tab="you" counter={t.notifications} back="/profile">
      <Page>
        {/* De kop van MagazineHead, maar met de actie rechts op de regel
            van de teller — zoals de Meldingen-kolom op desktop. */}
        <View style={{ paddingTop: 14, paddingHorizontal: 24, paddingBottom: 20, gap: 8 }}>
          <Label size={8.5} weight={500} ls={0.2} color={dim}>
            {`${t.edition} · ${t.notifications}`}
          </Label>
          <Black size={50} f={0.84} ls={-0.055}>
            {t.notifications}
          </Black>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ ...serif(true), fontSize: 17, lineHeight: 23, color: dim }}>{`${unread} ${t.new}`}</Text>
            {unread > 0 && onMarkAll ? (
              <LabelLink size={10} onPress={onMarkAll}>
                {t.markAllRead}
              </LabelLink>
            ) : null}
          </View>
        </View>
        {state ? <Note>{state}</Note> : null}
        {rows.length ? (
          <View style={{ marginTop: 4, marginHorizontal: 24, borderTopWidth: OMSLAG.rule, borderTopColor: ink, marginBottom: 24 }}>
            {rows.map((n) => (
              <NoteRow key={n.key} n={n} scheme={scheme} />
            ))}
          </View>
        ) : null}
      </Page>
    </LincinScreen>
  );
}

/** Eén melding: rug · initiaal · naam en tijd · de zin · rode stip. */
function NoteRow({ n, scheme }: { n: NoteSpreadData; scheme: Scheme }) {
  const fc = friendColor(hueFor(n.actorId), scheme);
  const dim = color("ink", "inkDim");
  // Een melding zonder afzender (bug_resolved) krijgt het teken van de omslag.
  const initial = n.by ? n.by.trim().slice(0, 1).toUpperCase() : "✳";
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${n.by} ${n.text}, ${n.when}`}
      onPress={n.onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 14,
        paddingLeft: 12,
        borderLeftWidth: OMSLAG.spine,
        borderLeftColor: fc.fill,
        borderBottomWidth: OMSLAG.hairline,
        borderBottomColor: color("ink", "postRule"),
        // Ongelezen: de tweede papiertint (--p2), zoals het prototype.
        backgroundColor: n.unread || pressed ? color("paper2") : "transparent",
      })}
    >
      <View
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: 15,
          overflow: "hidden",
          backgroundColor: fc.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ ...sans(700), fontSize: 12, lineHeight: 15, color: fc.ink }}>{initial}</Text>
        <AvatarPhoto url={n.avatarUrl} size={30} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          {n.by ? (
            <Text numberOfLines={1} style={{ ...sans(700), fontSize: 12, lineHeight: 16, color: color("ink"), flexShrink: 1 }}>
              {n.by}
            </Text>
          ) : (
            <View />
          )}
          <Label size={10} weight={500} color={dim} style={{ flexShrink: 0 }}>
            {n.when}
          </Label>
        </View>
        <Text style={{ ...serif(), fontSize: 18, lineHeight: 22.5, color: color("ink") }}>{n.text}</Text>
      </View>
      {/* Altijd een vakje van 8 rechts, zodat gelezen en ongelezen rijen
          even breed tekst hebben en niet verspringen na een tik. */}
      <View style={{ flexShrink: 0, width: 8, marginTop: 6, marginRight: 4 }}>
        {n.unread ? <RedDot size={8} /> : null}
      </View>
    </Pressable>
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

function unreadName(ink: string): TextStyle {
  return Platform.OS === "web"
    ? { fontWeight: "700" }
    : { textShadowColor: ink, textShadowOffset: { width: 0.5, height: 0 }, textShadowRadius: 0.5 };
}
