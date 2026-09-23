import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View, type TextStyle } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { listMyFriendships } from "@/lib/api/friends";
import { listUnifiedFeed, listUserPosts } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { ON_DARK, RASTER, THEMES, color, pageTint, setPreference, type LincinTheme, type ThemePreference, usePreference, useScheme, useThemeSpec } from "@/lib/design/theme";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { capf, head, mono } from "@/lib/design/type";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { CHATS_MIN, CHATS_W, RAIL_NARROW, RAIL_W } from "@/lib/lincin/desktop";
import { displayName, toCardPost } from "@/lib/lincin/model";
import { useUnread, type Tab } from "@/lib/lincin/unread";
import { useSeenPosts } from "@/lib/read-state";

import { ChatList, ChatListHead } from "./ChatList";

/**
 * Desktop, model 3c (Lincin Desktop.dc.html):
 *
 *   feed        ┌──────┬─────────────────────────────┬──────────┐
 *               │ rail │ feed                        │ gesprek- │
 *               │ 196  │                             │ ken 300  │
 *               └──────┴─────────────────────────────┴──────────┘
 *   rust        rail 196 · hoofdkolom (profiel, events, jij, nieuw)
 *   volle       ┌──┬─────────────────────────────────────────────┐
 *   breedte     │64│ bijdrage of gesprek over het hele venster   │
 *               └──┴─────────────────────────────────────────────┘
 *
 * Lijnen zijn de kaderdikte van het thema (1.5 in kleur). Het blad kleurt
 * in kleur mee met wie in beeld is — vlak, niet als verloop: 26% van de
 * vriendkleur op papier, 14% in donker.
 *
 * Modern heeft geen inktlijnen: de rail en de gesprekken zijn losse tegels
 * met een ronding van 18 en een naad van 6 rondom, de navigatie pillen.
 */

type ShellMode = "rest" | "feed" | "full";

const TAB_HREF: Record<Tab, string> = { feed: "/feed", chats: "/chats", events: "/events", you: "/profile" };
/** Het woord bij een thema, in de taal die nu geldt. */
function themeLabel(th: LincinTheme, t: ReturnType<typeof useT>): string {
  return th === "kleur" ? t.themeKleur : th === "magazine" ? t.themeMagazine : t.themeModern;
}

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
/** De rail wisselt toestel → licht → donker (prototype `cycleStand`). */
const STAND_NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const DESKTOP_TINT = { light: 0.26, dark: 0.14 };
const SEAM = RASTER.seam;

/** Modern tekent tegels en pillen; kleur en magazine kaders en inktlijnen. */
function useRound(): boolean {
  return useThemeSpec().id === "modern";
}

/** De lijn onder een kop of naast een paneel: inkt, of de haarlijn in modern. */
export function edgeColor(round: boolean): string {
  return round ? color("ink", "postRule") : color("ink");
}

/** Een tegel van de rail in modern. */
const bubble = () => ({ borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") });

export function DesktopShell({
  active,
  mode = "rest",
  tint,
  children,
}: {
  active: Tab;
  mode?: ShellMode;
  /** De vriendkleur (hex) van wie in beeld is; alleen kleur tint mee. */
  tint?: string | null;
  children: ReactNode;
}) {
  const spec = useThemeSpec();
  const scheme = useScheme();
  const { width } = useWindowDimensions();
  const bg = tint && spec.tint ? pageTint(tint, scheme, DESKTOP_TINT) : color("paper");
  // grid-template-columns: 196px minmax(0,1fr) minmax(240px,300px)
  const chatsW = Math.max(CHATS_MIN, Math.min(CHATS_W, width - RAIL_W - 600));
  const round = spec.id === "modern";
  return (
    <View
      style={[
        { flex: 1, flexDirection: "row", minHeight: 0, backgroundColor: bg },
        round ? { padding: SEAM, gap: SEAM } : null,
        Platform.OS === "web" ? ({ transitionProperty: "background-color", transitionDuration: "700ms", transitionTimingFunction: "ease" } as object) : null,
      ]}
    >
      {mode === "full" ? <RailNarrow active={active} /> : <Rail active={active} />}
      <View style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>{children}</View>
      {mode === "feed" ? (
        <View
          style={[
            { width: chatsW, minHeight: 0 },
            round ? { ...bubble(), overflow: "hidden" } : { borderLeftWidth: spec.border, borderLeftColor: color("ink"), backgroundColor: color("paper") },
          ]}
        >
          <ChatsPanel />
        </View>
      ) : null}
    </View>
  );
}

/** Rechts van de feed: de gesprekken, en de noot dat een gesprek volle breedte opent. */
function ChatsPanel() {
  const t = useT();
  const router = useRouter();
  const round = useRound();
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ChatListHead link />
      <ChatList activeId={null} onOpen={(id) => router.push(`/chat/${id}` as never)} />
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18, borderTopWidth: 1, borderTopColor: color("ink", "postRule"), borderStyle: round ? "dashed" : "solid" }}>
        <Text style={[capf(true, true), { fontSize: 14, lineHeight: 19.6, color: color("ink", "inkDim") }]}>{t.panelNote}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// De rail
// ---------------------------------------------------------------

type NavItem = { id: Tab | "notifications"; num: string; label: string; badge: number; href: string; on: boolean };

/**
 * De vier tabbladen en, als vijfde, de meldingen. Die krijgen een eigen
 * plek met hun eigen teller: stond de teller op "Jij", dan zag je een 1
 * zonder te weten waar hij naartoe wees. Op de telefoon is dat de ◉ in de kop.
 *
 * "Jij" draagt daarnaast wél één getal, en precies één: het aantal mensen
 * dat je linc wil zijn. Dat is geen melding — die soort bestaat niet — en
 * het woont onder Jij → Mijn lincs, dus het wijst maar naar één plek en
 * blijft daarmee te lezen.
 */
function useNav(active: Tab): NavItem[] {
  const t = useT();
  const unread = useUnread();
  const pathname = usePathname();
  const onNotes = pathname.startsWith("/notifications");
  return [
    { id: "feed", num: "01", label: t.tabFeed, badge: 0, href: TAB_HREF.feed, on: active === "feed" },
    { id: "chats", num: "02", label: t.tabChats, badge: active === "chats" ? 0 : unread.chats, href: TAB_HREF.chats, on: active === "chats" },
    { id: "events", num: "03", label: t.tabEvents, badge: 0, href: TAB_HREF.events, on: active === "events" },
    { id: "you", num: "04", label: t.tabYou, badge: active === "you" ? 0 : unread.friendRequests, href: TAB_HREF.you, on: !onNotes && (active === "you" || pathname.startsWith("/settings")) },
    { id: "notifications", num: "05", label: t.notifications, badge: onNotes ? 0 : unread.notifications, href: "/notifications", on: onNotes },
  ];
}

/** Hoeveel bijdragen van vrienden je nog niet zag — "wo 16 sep · 4 nieuw". */
function useFreshCount(): number {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const t = useT();
  const { seen } = useSeenPosts();
  const feed = useQuery({ queryKey: ["unified-feed", myUserId], queryFn: () => listUnifiedFeed(myUserId), enabled: !!myUserId, staleTime: 30_000 });
  return useMemo(
    () => (feed.data ?? []).map((i) => toCardPost(i, t)).filter((c) => !!c && c.authorId !== myUserId && !seen.has(c.id)).length,
    [feed.data, t, myUserId, seen],
  );
}

function Rail({ active }: { active: Tab }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const scheme = useScheme();
  const pref = usePreference();
  const spec = useThemeSpec();
  const lincin = useLincinTheme();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const nav = useNav(active);
  const fresh = useFreshCount();
  const profile = useQuery({ queryKey: ["profile", myUserId], queryFn: () => getProfile(myUserId), enabled: !!session });
  const posts = useQuery({ queryKey: ["posts-by-user", myUserId], queryFn: () => listUserPosts(myUserId, 200), enabled: !!session, staleTime: 60_000 });
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId), enabled: !!session, staleTime: 60_000 });
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;
  const name = displayName(profile.data ?? { username: session?.user.email ?? "" });

  const now = new Date();
  const dateLine = `${now.toLocaleDateString(LOCALE[lang], { weekday: "short" }).replace(".", "")} ${now.getDate()} ${now
    .toLocaleDateString(LOCALE[lang], { month: "short" })
    .replace(".", "")}${fresh ? ` · ${fresh} ${t.new}` : ""}`;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const standLabel = pref === "system" ? t.device : scheme === "dark" ? t.dark : t.light;
  const round = spec.id === "modern";
  /** In modern: drie tegels onder elkaar (merk, navigatie, jij). */
  const tile = round ? { ...bubble(), padding: 16 } : null;

  return (
    <View
      style={[
        { width: RAIL_W, minHeight: 0 },
        round ? { gap: SEAM } : { borderRightWidth: spec.border, borderRightColor: ink, paddingVertical: 26, paddingHorizontal: 20 },
      ]}
    >
      <Pressable accessibilityRole="link" onPress={() => router.push("/feed")} style={tile}>
        <Text style={[capf(false, true), { fontSize: 27, lineHeight: 27, color: ink }]}>Lincin</Text>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: dim, marginTop: 6 }]}>{dateLine}</Text>
      </Pressable>

      <View style={round ? { ...tile, padding: 8 } : null}>
      <View style={{ marginTop: round ? 0 : 30, gap: 2 }}>
        {nav.map((n) => {
          const on = n.on;
          return (
            <Pressable
              key={n.id}
              accessibilityRole="link"
              accessibilityLabel={n.badge > 0 ? `${n.label}, ${n.badge} ${t.new}` : n.label}
              accessibilityState={{ selected: on }}
              onPress={() => router.push(n.href as never)}
              style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: round ? 14 : 10, borderRadius: round ? 999 : 0, backgroundColor: on ? ink : "transparent" }}
            >
              <Text numberOfLines={1} style={[mono(600), { flexShrink: 1, fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: on ? color("paper") : dim }]}>
                {n.num} {n.label}
              </Text>
              {n.badge > 0 ? (
                <View style={{ marginLeft: "auto", backgroundColor: color("red"), paddingVertical: 1, paddingHorizontal: 5, borderRadius: round ? 999 : 0 }}>
                  <Text style={[mono(600), { fontSize: 9, lineHeight: 12, color: ON_DARK }]}>{n.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/post-compose")}
        style={[
          { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
          round
            ? { marginTop: 10, borderRadius: 999, backgroundColor: color("ink", "postRule"), paddingLeft: 16, paddingRight: 6 }
            : { marginTop: 24, borderWidth: spec.border, borderColor: ink, paddingHorizontal: 12 },
        ]}
      >
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: ink }]}>{t.newPost}</Text>
        {round ? (
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: ink, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, lineHeight: 18, color: color("paper") }}>+</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 16, lineHeight: 18, color: ink }}>+</Text>
        )}
      </Pressable>
      </View>

      <View style={[{ marginTop: "auto", gap: 12 }, tile]}>
        <Text style={[capf(true, true), { fontSize: 14, lineHeight: 19.6, color: dim }]}>{t.noAlgo}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["nl", "en", "de"] as Lang[]).map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: l === lang }} onPress={() => setLang(l)}>
                <Text style={[railLink(l === lang ? ink : dim), { textDecorationLine: l === lang ? "underline" : "none" }]}>{l}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t.lightDark} onPress={() => setPreference(STAND_NEXT[pref])}>
            <Text style={[railLink(ink), { textDecorationLine: "underline" }]}>{standLabel}</Text>
          </Pressable>
        </View>
        {/* De themaschakelaar, onder taal en licht/donker (2.2 §9). Op de
            telefoon staat hij in Instellingen; desktop heeft dat scherm
            niet, dus hij hoort hier. */}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {THEMES.map((th) => {
            const on = lincin.theme === th;
            return (
              <Pressable
                key={th}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t.theme}: ${themeLabel(th, t)}`}
                onPress={() => lincin.choose(th)}
              >
                <Text style={[railLink(on ? ink : dim), { textDecorationLine: on ? "underline" : "none" }]}>
                  {themeLabel(th, t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="link"
          // Je naam opent je profiel, zoals bij een vriend.
          onPress={() => router.push((profile.data?.username ? `/user/${profile.data.username}` : "/profile") as never)}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: color("ink", "postRule"), borderStyle: round ? "dashed" : "solid" }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color("paper2"), borderWidth: 1, borderColor: edgeColor(round), overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {profile.data?.avatar_url ? (
              <SafeImage uri={profile.data.avatar_url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text style={[head(), { fontSize: 15, lineHeight: 17, color: ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[capf(false, true), { fontSize: 16, lineHeight: 16, color: ink }]}>
              {name}
            </Text>
            <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, color: dim }]}>
              {posts.data?.length ?? 0} {t.posts} · {lincs} lincs
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const railLink = (c: string): TextStyle => ({
  ...mono(500),
  fontSize: 10,
  lineHeight: 13,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: c,
  ...(Platform.OS === "web" ? ({ textUnderlineOffset: 4 } as object) : null),
});

/** De smalle rail van 64 op volle breedte: "L", vijf genummerde vakjes, en + onderaan. */
function RailNarrow({ active }: { active: Tab }) {
  const t = useT();
  const router = useRouter();
  const spec = useThemeSpec();
  const nav = useNav(active);
  const ink = color("ink");
  const round = spec.id === "modern";
  return (
    <View
      style={[
        { width: RAIL_NARROW, minHeight: 0, alignItems: "center", paddingVertical: 18, gap: 14 },
        round ? bubble() : { borderRightWidth: spec.border, borderRightColor: ink },
      ]}
    >
      <Pressable accessibilityRole="link" accessibilityLabel="Lincin" onPress={() => router.push("/feed")}>
        <Text style={[capf(false, true), { fontSize: 20, lineHeight: 24, color: ink }]}>L</Text>
      </Pressable>
      {nav.map((n) => {
        const on = n.on;
        return (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            accessibilityLabel={n.badge > 0 ? `${n.label}, ${n.badge} ${t.new}` : n.label}
            accessibilityState={{ selected: on }}
            onPress={() => router.push(n.href as never)}
            style={{
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: round ? 17 : 0,
              backgroundColor: on ? ink : "transparent",
              borderWidth: on ? spec.border : 1,
              borderColor: on ? ink : color("ink", "postRule"),
            }}
          >
            <Text style={[mono(600), { fontSize: 10, lineHeight: 13, color: on ? color("paper") : color("ink", "inkDim") }]}>{n.num}</Text>
            {n.badge > 0 ? <View style={{ position: "absolute", top: -3, right: -3, width: 6, height: 6, borderRadius: round ? 3 : 0, backgroundColor: color("red") }} /> : null}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.newPost}
        onPress={() => router.push("/post-compose")}
        style={[
          { marginTop: "auto", width: 34, height: 34, alignItems: "center", justifyContent: "center" },
          round ? { borderRadius: 17, backgroundColor: ink } : { borderWidth: spec.border, borderColor: ink },
        ]}
      >
        <Text style={{ fontSize: 16, lineHeight: 18, color: round ? color("paper") : ink }}>+</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------
// Bouwstenen van de hoofdkolom
// ---------------------------------------------------------------

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
  const text = (
    <Text
      numberOfLines={numberOfLines}
      style={[
        mono(500),
        {
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 1,
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
