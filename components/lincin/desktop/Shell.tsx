import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View, type TextStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { SafeImage } from "@/components/SafeImage";
import { listUnifiedFeed } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { OMSLAG, RASTER, color, friendColor, hueFor, inkOn, pageTint, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { FONT, capf, head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { displayName, groupByFriend, timeLabel, toCardPost, type CardPost } from "@/lib/lincin/model";
import { setFriendOpen, setPref } from "@/lib/lincin/prefs";
import { useUnread, type Tab } from "@/lib/lincin/unread";
import { Black, Label as OLabel, RedButton, RedDot, RoundGlyph, Ser, SerifLink, Wordmark, useOmslag } from "../magazine/Omslag";
import { useSeenPosts } from "@/lib/read-state";

/**
 * Desktop (handoff 23 sep, desktop-{kleur,magazine,modern}-*.dc.html):
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Lincin · datum │ 01 Feed │ 02 Gesprekken │ … │  ◉  + │ J    │  balk
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ de pagina, hoogstens 1440 breed                              │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Eén balk bovenaan in plaats van de rail links. Elk thema tekent hem zelf:
 *
 *   kleur     64 hoog, inktlijn eronder; genummerde vakken van 148 in
 *             Archivo 900 smal; het actieve vak inkt, of de vriendkleur
 *             zodra er een bijdrage open staat.
 *   magazine  72 hoog, haarlijn; vier tabs in Instrument Serif die van
 *             onder staan, de actieve cursief op inkt of vriendkleur.
 *   modern    losse tegels op de kleurhaze: merk en klok, de vrienden als
 *             ronde chips, een pil met een schuivend inktvlak, ◉ en +.
 *
 * Taal, thema en licht/donker staan niet meer in de balk maar onder Jij
 * (Instellingen), zoals in het prototype. Meldingen: de ◉ rechts.
 */

type ShellMode = "rest" | "feed" | "full";

const TAB_HREF: Record<Tab, string> = { feed: "/feed", chats: "/chats", events: "/events", you: "/profile" };

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const DESKTOP_TINT = { light: 0.26, dark: 0.14 };
const SEAM = RASTER.seam;
/** De breedte van het blad in het prototype; breder schermen centreren. */
const PAGE_MAX = 1440;

/** De lijn onder een kop of naast een paneel: inkt, of de haarlijn in modern. */
export function edgeColor(round: boolean): string {
  return round ? color("ink", "postRule") : color("ink");
}

const tileStyle = () => ({
  borderRadius: RASTER.tileRadius,
  backgroundColor: color("tile", "tileFill"),
  ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)" } as object) : null),
});

/** De kleurhaze van modern (desktop-modern-home `pageBg`), alleen op web. */
function modernHaze(bloom: string, next: string): object | null {
  if (Platform.OS !== "web") return null;
  return {
    backgroundImage: [
      `radial-gradient(70% 60% at 8% -6%, color-mix(in oklch, ${bloom} 40%, transparent) 0%, transparent 62%)`,
      `radial-gradient(52% 44% at 104% 10%, color-mix(in oklch, ${bloom} 26%, transparent) 0%, transparent 66%)`,
      `radial-gradient(80% 50% at 46% 104%, color-mix(in oklch, ${next} 30%, transparent) 0%, transparent 68%)`,
    ].join(","),
  } as object;
}

export function DesktopShell({
  active,
  tint,
  tabTint = null,
  hideMark = false,
  navExtra = null,
  children,
}: {
  active: Tab;
  /** Oud: rail in rust, smal of met gesprekken. De balk kent maar één vorm. */
  mode?: ShellMode;
  /**
   * De vriendkleur (hex) van wie in beeld is. Kleur legt hem als licht van
   * boven op het blad (26% op papier, uitdovend); modern als kleurhaze.
   */
  tint?: string | null;
  /** Het actieve tabblad in de kleur van de vriend: een open bijdrage. Anders inkt. */
  tabTint?: string | null;
  /** Oud (magazine 2.2): de balk liet het woordmerk weg. De omslag houdt het altijd. */
  hideMark?: boolean;
  /** Magazine: rechts in de balk, vóór ✳ — de weergaven van de feed. */
  navExtra?: ReactNode;
  children: ReactNode;
}) {
  const spec = useThemeSpec();
  const scheme = useScheme();
  const round = spec.id === "modern";
  const bloom = tint ?? friendColor("blue", scheme).fill;
  const lit = tint && spec.tint ? pageTint(tint, scheme, DESKTOP_TINT) : null;
  return (
    <View
      style={[
        { flex: 1, minHeight: 0, backgroundColor: color("paper") },
        round ? modernHaze(bloom, friendColor("ochre", scheme).fill) : null,
        lit
          ? Platform.OS === "web"
            ? ({ backgroundImage: `linear-gradient(180deg, ${lit} 0px, ${lit} 120px, ${color("paper")} 900px)` } as object)
            : { backgroundColor: lit }
          : null,
        Platform.OS === "web" ? ({ transitionProperty: "background-color", transitionDuration: "700ms", transitionTimingFunction: "ease" } as object) : null,
      ]}
    >
      <View style={[{ flex: 1, minHeight: 0, width: "100%", maxWidth: PAGE_MAX, alignSelf: "center" }, round ? { padding: SEAM, gap: SEAM } : null]}>
        {spec.id === "magazine" ? (
          <NavMagazine active={active} extra={navExtra} />
        ) : round ? (
          <NavModern active={active} />
        ) : (
          <NavKleur active={active} tint={tabTint} />
        )}
        <View style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>{children}</View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// Wat alle drie de balken lezen
// ---------------------------------------------------------------

type NavItem = { id: Tab; num: string; label: string; badge: boolean; href: string; on: boolean };

function useNav(active: Tab): NavItem[] {
  const t = useT();
  const unread = useUnread();
  const pathname = usePathname();
  const onNotes = pathname.startsWith("/notifications");
  return [
    { id: "feed", num: "01", label: t.tabFeed, badge: false, href: TAB_HREF.feed, on: !onNotes && active === "feed" },
    { id: "chats", num: "02", label: t.tabChats, badge: active !== "chats" && unread.chats > 0, href: TAB_HREF.chats, on: active === "chats" },
    { id: "events", num: "03", label: t.tabEvents, badge: false, href: TAB_HREF.events, on: active === "events" },
    { id: "you", num: "04", label: t.tabYou, badge: active !== "you" && unread.friendRequests > 0, href: TAB_HREF.you, on: !onNotes && active === "you" },
  ];
}

/** De feed als kaarten, en wat je daarvan nog niet zag. Dezelfde vraag als de feed. */
function useFeedSummary() {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const t = useT();
  const { isSeen } = useSeenPosts();
  useHueChoices();
  const feed = useQuery({ queryKey: ["unified-feed", myUserId], queryFn: () => listUnifiedFeed(myUserId), enabled: !!myUserId, staleTime: 30_000 });
  return useMemo(() => {
    const cards = (feed.data ?? []).map((i) => toCardPost(i, t)).filter((c): c is CardPost => !!c && c.authorId !== myUserId);
    const fresh = cards.filter((c) => !isSeen(c.id, c.createdAt));
    const groups = groupByFriend(cards).map((g) => ({ ...g, fresh: g.posts.filter((p) => !isSeen(p.id, p.createdAt)).length }));
    const newest = cards.reduce<string | null>((m, c) => (!m || c.createdAt > m ? c.createdAt : m), null);
    return { cards, fresh: fresh.length, groups, newest };
  }, [feed.data, t, myUserId, isSeen]);
}

function useDateLine(): string {
  const lang = useLang();
  const now = new Date();
  return `${now.toLocaleDateString(LOCALE[lang], { weekday: "short" }).replace(".", "")} ${now.getDate()} ${now
    .toLocaleDateString(LOCALE[lang], { month: "short" })
    .replace(".", "")}`;
}

/** Jij: je initiaal in je eigen kleur, of je foto. */
function useMe() {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const profile = useQuery({ queryKey: ["profile", myUserId], queryFn: () => getProfile(myUserId), enabled: !!session });
  const name = displayName(profile.data ?? { username: session?.user.email ?? "" });
  return { myUserId, name, avatar: profile.data?.avatar_url ?? null, hue: hueFor(myUserId) };
}

function MeButton({ size }: { size: number }) {
  const router = useRouter();
  const scheme = useScheme();
  const t = useT();
  const me = useMe();
  const fc = friendColor(me.hue, scheme);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t.settings}
      onPress={() => router.push("/settings")}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: fc.fill, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
    >
      {me.avatar ? (
        <SafeImage uri={me.avatar} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Text style={[sans(700), { fontSize: 15, lineHeight: 18, color: fc.ink }]}>{me.name.slice(0, 1).toUpperCase()}</Text>
      )}
    </Pressable>
  );
}

const webPointer = Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null;

// ---------------------------------------------------------------
// KLEUR
// ---------------------------------------------------------------

function NavKleur({ active, tint }: { active: Tab; tint: string | null }) {
  const t = useT();
  const router = useRouter();
  const spec = useThemeSpec();
  const { width } = useWindowDimensions();
  const nav = useNav(active);
  const unread = useUnread();
  const { fresh } = useFeedSummary();
  const date = useDateLine();
  const ink = color("ink");
  const rule = color("ink", "postRule");
  const narrow = width < 1240;
  return (
    <View
      style={{
        height: 64,
        flexDirection: "row",
        alignItems: "stretch",
        borderBottomWidth: spec.border,
        borderBottomColor: ink,
        backgroundColor: color("paper"),
      }}
    >
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/feed")}
        style={{ width: narrow ? 180 : 220, paddingHorizontal: narrow ? 24 : 32, justifyContent: "center", gap: 3, borderRightWidth: 1, borderRightColor: rule }}
      >
        <Text style={[serif(), { fontSize: 28, lineHeight: 28, color: ink }]}>Lincin</Text>
        <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
          {date}
          {fresh ? ` · ${fresh} ${t.new}` : ""}
        </Text>
      </Pressable>
      {nav.map((n) => {
        const bg = n.on ? (tint ?? ink) : "transparent";
        const fg = n.on ? (tint ? inkOn(tint) : color("paper")) : color("ink", "inkDim");
        return (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            accessibilityState={{ selected: n.on }}
            onPress={() => router.push(n.href as never)}
            style={{ width: narrow ? 124 : 148, paddingHorizontal: 16, justifyContent: "center", gap: 3, borderRightWidth: 1, borderRightColor: rule, backgroundColor: bg }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.72, color: fg }]}>{n.num}</Text>
              {n.badge ? <View style={{ width: 6, height: 6, backgroundColor: color("red") }} /> : null}
            </View>
            <Text numberOfLines={1} style={[headKleur(), { fontSize: 15, lineHeight: 15, color: fg }]}>
              {n.label}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: narrow ? 20 : 32 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t.notifications}
          onPress={() => router.push("/notifications")}
          style={{ width: 40, height: 40, borderWidth: spec.border, borderColor: ink, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 15, lineHeight: 18, color: ink }}>◉</Text>
          {unread.notifications ? <View style={{ position: "absolute", top: -4, right: -4, width: 9, height: 9, backgroundColor: color("red") }} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.newPost}
          onPress={() => router.push("/post-compose")}
          style={{ height: 40, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: ink }}
        >
          {narrow ? null : (
            <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: color("paper") }]}>{t.newPost}</Text>
          )}
          <Text style={{ fontSize: 18, lineHeight: 20, color: color("paper") }}>+</Text>
        </Pressable>
        <View style={{ marginLeft: 6 }}>
          <MeButton size={40} />
        </View>
      </View>
    </View>
  );
}

/** Archivo 900 smal, kapitaal — de tabletters van kleur, los van het thema. */
function headKleur(): TextStyle {
  return Platform.OS === "web"
    ? ({ ...head(), fontFamily: FONT.head, fontWeight: "900", textTransform: "uppercase" } as TextStyle)
    : { ...head(), fontFamily: FONT.head, textTransform: "uppercase" };
}

// ---------------------------------------------------------------
// MAGAZINE
// ---------------------------------------------------------------

function NavMagazine({ active, extra }: { active: Tab; extra: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const nav = useNav(active);
  const unread = useUnread();
  const o = useOmslag();
  return (
    <View
      style={{
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 32,
        paddingLeft: 40,
        paddingRight: 6,
        backgroundColor: o.paper,
        borderBottomWidth: OMSLAG.rule,
        borderBottomColor: o.ink,
        zIndex: 30,
      }}
    >
      <Pressable accessibilityRole="link" accessibilityLabel="Lincin" onPress={() => router.push("/feed")} style={webPointer}>
        <Wordmark size={28} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: 28 }}>
        {nav.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            accessibilityState={{ selected: n.on }}
            onPress={() => router.push(n.href as never)}
            hitSlop={{ top: 16, bottom: 16, left: 8, right: 8 }}
            style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, webPointer]}
          >
            <OLabel size={12} ls={0.08} color={n.on ? o.red : o.ink}>
              {n.label}
            </OLabel>
            {n.badge ? <RedDot size={6} /> : null}
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      {extra}
      <View style={{ marginLeft: extra ? 12 : 0 }}>
        <RoundGlyph
          glyph="✳"
          size={36}
          fontSize={17}
          badge={unread.notifications > 0}
          onPress={() => router.push("/notifications")}
          label={unread.notifications > 0 ? `${t.notifications}, ${unread.notifications} ${t.new}` : t.notifications}
        />
      </View>
      <RedButton label={t.newPost} onPress={() => router.push("/post-compose")} />
    </View>
  );
}

// ---------------------------------------------------------------
// MODERN
// ---------------------------------------------------------------

function NavModern({ active }: { active: Tab }) {
  const t = useT();
  const router = useRouter();
  const scheme = useScheme();
  const { width } = useWindowDimensions();
  const nav = useNav(active);
  const unread = useUnread();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const { cards, groups, newest } = useFeedSummary();
  const date = useDateLine();
  const lang = useLang();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const idx = Math.max(0, nav.findIndex((n) => n.on));
  const pillW = width < 1240 ? 400 : 520;
  const [pillInner, setPillInner] = useState(0);
  const openFriend = (key: string) => {
    if (myUserId) {
      setPref(myUserId, "feedView", "friends");
      setFriendOpen(myUserId, key, true);
    }
    router.push("/feed");
  };
  return (
    <View style={{ height: 64, flexDirection: "row", gap: SEAM }}>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/feed")}
        style={[tileStyle(), { width: width < 1240 ? 210 : 260, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
      >
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 2, textTransform: "uppercase", color: ink }]}>Lincin</Text>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 13.5, letterSpacing: 1.26, color: dim, textAlign: "right" }]}>
          {date}
          {newest ? ` · ${timeLabel(newest, t, lang)}` : ""}
          {"\n"}
          {cards.length} lincs · {groups.length} {t.friends}
        </Text>
      </Pressable>
      <View style={[tileStyle(), { flex: 1, minWidth: 0, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" }]}>
        {groups.map((g) => {
          const fc = friendColor(g.hue, scheme);
          const on = g.fresh > 0;
          return (
            <Pressable
              key={g.key}
              accessibilityRole="button"
              accessibilityLabel={on ? `${g.name}, ${g.fresh} ${t.new}` : g.name}
              onPress={() => openFriend(g.key)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingRight: on ? 14 : 0, opacity: on ? 1 : 0.6 }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: on ? fc.fill : "transparent",
                  borderWidth: 1,
                  borderColor: color("ink", on ? "pill" : "pillSoft"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[sans(500), { fontSize: 13, lineHeight: 16, color: on ? fc.ink : dim }]}>{g.initial}</Text>
                {on ? (
                  <View style={{ position: "absolute", top: -2, right: -2, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 999, backgroundColor: ink, alignItems: "center", justifyContent: "center" }}>
                    <Text style={[mono(600), { fontSize: 9, lineHeight: 11, color: color("paper") }]}>{g.fresh}</Text>
                  </View>
                ) : null}
              </View>
              {on ? (
                <Text numberOfLines={1} style={[sans(500), { fontSize: 13, lineHeight: 16, letterSpacing: -0.13, color: ink }]}>
                  {g.name}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View
        onLayout={(e) => setPillInner(e.nativeEvent.layout.width - 12)}
        style={[
          { width: pillW, padding: 5, borderRadius: 999, borderWidth: 1, borderColor: color("ink", "cardEdge"), backgroundColor: color("paper", "glass") },
          { borderColor: color("ink", "postRule") },
          Platform.OS === "web" ? ({ backdropFilter: "blur(18px)" } as object) : null,
        ]}
      >
        {pillInner ? (
          <View
            style={[
              { position: "absolute", top: 5, bottom: 5, left: 5 + (pillInner / 4) * idx, width: pillInner / 4, borderRadius: 999, backgroundColor: ink },
              Platform.OS === "web" ? ({ transitionProperty: "left", transitionDuration: "300ms" } as object) : null,
            ]}
          />
        ) : null}
        <View style={{ flex: 1, flexDirection: "row" }}>
          {nav.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="link"
              accessibilityState={{ selected: n.on }}
              onPress={() => router.push(n.href as never)}
              style={[{ flex: 1, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, webPointer]}
            >
              <Text numberOfLines={1} style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: n.on ? color("paper") : ink }]}>
                {n.label}
              </Text>
              {n.badge ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color("red") }} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t.notifications}
        onPress={() => router.push("/notifications")}
        style={[tileStyle(), { width: 56, alignItems: "center", justifyContent: "center" }]}
      >
        <Svg width={17} height={17} viewBox="0 0 16 16" fill="none">
          <Circle cx={8} cy={6.6} r={4.3} stroke={ink} strokeWidth={1.3} />
          <Path d="M3.4 12.2h9.2" stroke={ink} strokeWidth={1.3} strokeLinecap="round" />
        </Svg>
        {unread.notifications ? <View style={{ position: "absolute", top: 16, right: 16, width: 7, height: 7, borderRadius: 4, backgroundColor: color("red") }} /> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.newPost}
        onPress={() => router.push("/post-compose")}
        style={{ width: 56, borderRadius: RASTER.tileRadius, backgroundColor: ink, alignItems: "center", justifyContent: "center" }}
      >
        <Svg width={18} height={18} viewBox="0 0 16 16" fill="none">
          <Path d="M8 2.4v11.2M2.4 8h11.2" stroke={color("paper")} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------
// Bouwstenen van de hoofdkolom
// ---------------------------------------------------------------

/**
 * De kop van een hoofdpagina (desktop-*-pages.dc.html `head`): nummer,
 * titel, een regel meta en hoogstens één handeling.
 *
 *   kleur     104 hoog, "02" in mono naast GESPREKKEN in Archivo 900 smal 64,
 *             meta en een gekaderde knop rechts, inktlijn eronder.
 *   magazine  "02 · meta" boven een serif van 88, de handeling als
 *             onderstreepte serif, een haarlijn in inkt eronder.
 *   modern    een tegel: rood stipje en meta, Archivo 400 64, een inktpil.
 */
export function PageHead({ num, title, sub, action }: { num: string; title: string; sub?: string; action?: { label: string; onPress: () => void } }) {
  const spec = useThemeSpec();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  if (spec.id === "magazine") return <PageHeadMagazine num={num} title={title} sub={sub} action={action} />;
  if (spec.id === "modern") {
    return (
      <View style={[tileStyle(), { paddingTop: 26, paddingHorizontal: 26, paddingBottom: 22, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }]}>
        <View style={{ gap: 12, flexShrink: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color("red") }} />
            <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.44, textTransform: "uppercase", color: dim }]}>{sub || num}</Text>
          </View>
          <Text numberOfLines={1} style={[sans(400), { fontSize: 64, lineHeight: 64, letterSpacing: -2.9, color: ink }]}>
            {title}
          </Text>
        </View>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} style={{ height: 44, paddingHorizontal: 20, borderRadius: 999, justifyContent: "center", backgroundColor: ink }}>
            <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: color("paper") }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ height: 104, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingHorizontal: 32, paddingBottom: 18, borderBottomWidth: spec.border, borderBottomColor: ink }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 18, flexShrink: 1 }}>
        <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 0.88, paddingBottom: 8, color: ink }]}>{num}</Text>
        <Text numberOfLines={1} style={[headKleur(), { fontSize: 64, lineHeight: 56, color: ink }]}>
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {sub ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim }]}>{sub}</Text> : null}
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} style={{ height: 40, paddingHorizontal: 16, justifyContent: "center", borderWidth: spec.border, borderColor: ink }}>
            <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: ink }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/**
 * De paginakop van de omslag: de titel rood in Archivo 900, tot 120 en
 * kleiner als hij anders niet naast het nummer past ("Nieuwe bijdrage" op
 * een scherm van 1280); ernaast het nummer en een cursieve ondertitel, een
 * lijn van 2 eronder.
 */
function PageHeadMagazine({ num, title, sub, action }: { num: string; title: string; sub?: string; action?: { label: string; onPress: () => void } }) {
  const ink = color("ink");
  const [w, setW] = useState(0);
  // Archivo 900 is ongeveer .62em per letter; hou 340 over voor nummer en ondertitel.
  const size = w ? Math.max(56, Math.min(120, Math.floor((w - 340) / (Math.max(1, title.length) * 0.62)))) : 120;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - 80)}
      style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingTop: 40, paddingHorizontal: 40, paddingBottom: 26, borderBottomWidth: OMSLAG.rule, borderBottomColor: ink }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 24, flexShrink: 1, minWidth: 0 }}>
        <Black size={size} f={0.78} nowrap>
          {title}
        </Black>
        <View style={{ gap: 6, paddingBottom: 4, flexShrink: 1 }}>
          <OLabel size={12} ls={0.08}>
            № {num}
          </OLabel>
          {sub ? (
            <Ser size={30} italic f={1} numberOfLines={1}>
              {sub}
            </Ser>
          ) : null}
        </View>
      </View>
      {action ? (
        <View style={{ paddingBottom: 8 }}>
          <SerifLink size={21} onPress={action.onPress}>
            {action.label}
          </SerifLink>
        </View>
      ) : null}
    </View>
  );
}

/** De titelrij van feed en events: serif 40 links, mono-links rechts, inktlijn eronder. */
export function DesktopTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const spec = useThemeSpec();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 20,
        paddingTop: 22,
        paddingHorizontal: 24,
        paddingBottom: 14,
        borderBottomWidth: spec.border,
        borderBottomColor: edgeColor(spec.id === "modern"),
      }}
    >
      <Text style={[capf(false, true), { flexShrink: 1, fontSize: 40, lineHeight: 38, letterSpacing: -0.8, color: color("ink") }]}>{children}</Text>
      {right ? <View style={{ flexDirection: "row", gap: 14, paddingBottom: 6, alignItems: "center" }}>{right}</View> : null}
    </View>
  );
}

/** De balk van 56 boven een bijdrage, profiel of nieuwe bijdrage: mono 10 links en rechts. */
export function TopBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  const spec = useThemeSpec();
  return (
    <View
      style={{
        height: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingHorizontal: 22,
        borderBottomWidth: spec.border,
        borderBottomColor: edgeColor(spec.id === "modern"),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 1, minWidth: 0 }}>{left}</View>
      {right ? <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>{right}</View> : null}
    </View>
  );
}

/**
 * Een mono-regel zoals het desktopontwerp ze overal zet: 10px, kapitaal,
 * .1em. `active` onderstreept (een link of de gekozen stand); `on=false`
 * dimt; `tone` geeft een eigen kleur (rood voor ongelezen).
 */
export function MonoLink({
  label,
  on = true,
  active = false,
  tone,
  onPress,
  numberOfLines,
}: {
  label: string;
  on?: boolean;
  active?: boolean;
  tone?: string;
  onPress?: () => void;
  numberOfLines?: number;
}) {
  // Magazine (de omslag): een label in Archivo 700 in plaats van mono.
  const mag = useThemeSpec().id === "magazine";
  const text = (
    <Text
      numberOfLines={numberOfLines}
      style={[
        mag ? sans(700) : mono(500),
        {
          fontSize: mag ? 11 : 10,
          lineHeight: mag ? 14 : 13,
          letterSpacing: mag ? 1.1 : 1,
          textTransform: "uppercase",
          color: tone ?? (on ? color("ink") : color("ink", "inkDim")),
          textDecorationLine: active ? "underline" : "none",
          ...(Platform.OS === "web" ? { textUnderlineOffset: 4 } : {}),
        } as TextStyle,
      ]}
    >
      {label}
    </Text>
  );
  if (!onPress) return text;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexShrink: 1, minWidth: 0 }}>
      {text}
    </Pressable>
  );
}

/** Het vierkantje × van 30 rechts in de balk. */
export function CloseBox({ onPress, label }: { onPress: () => void; label: string }) {
  const spec = useThemeSpec();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 30, height: 30, borderRadius: spec.id === "modern" ? 15 : 0, borderWidth: spec.border, borderColor: edgeColor(spec.id === "modern"), alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 15, lineHeight: 17, color: color("ink") }}>×</Text>
    </Pressable>
  );
}
