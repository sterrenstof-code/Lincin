import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View, type TextStyle } from "react-native";

import { ModernBackdrop } from "@/components/lincin/Chrome";
import { SafeImage } from "@/components/SafeImage";
import { listMyFriendships } from "@/lib/api/friends";
import { listUnifiedFeed, listUserPosts } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import {
  color,
  MODERN_GRADIENT,
  pageTint,
  setPreference,
  usePreference,
  useScheme,
  useThemeSpec,
  type ThemePreference,
} from "@/lib/design/theme";
import { head, mono, serif } from "@/lib/design/type";
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
 */

export type ShellMode = "rest" | "feed" | "full";

const TAB_HREF: Record<Tab, string> = { feed: "/feed", chats: "/chats", events: "/events", you: "/profile" };
const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
/** De rail wisselt toestel → licht → donker (prototype `cycleStand`). */
const STAND_NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
export const DESKTOP_TINT = { light: 0.26, dark: 0.14 };

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
  const { width, height } = useWindowDimensions();
  const bg = spec.gradient ? MODERN_GRADIENT.base : tint && spec.tint ? pageTint(tint, scheme, DESKTOP_TINT) : color("paper");
  // grid-template-columns: 196px minmax(0,1fr) minmax(240px,300px)
  const chatsW = Math.max(CHATS_MIN, Math.min(CHATS_W, width - RAIL_W - 600));
  return (
    <View
      style={[
        { flex: 1, flexDirection: "row", minHeight: 0, backgroundColor: bg },
        Platform.OS === "web" ? ({ transitionProperty: "background-color", transitionDuration: "700ms", transitionTimingFunction: "ease" } as object) : null,
      ]}
    >
      {spec.gradient ? <ModernBackdrop width={width} height={height} /> : null}
      {mode === "full" ? <RailNarrow active={active} /> : <Rail active={active} />}
      <View style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>{children}</View>
      {mode === "feed" ? (
        <View style={{ width: chatsW, minHeight: 0, borderLeftWidth: spec.border, borderLeftColor: color("ink"), backgroundColor: spec.gradient ? "transparent" : color("paper") }}>
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
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ChatListHead link />
      <ChatList activeId={null} onOpen={(id) => router.push(`/chat/${id}` as never)} />
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18, borderTopWidth: 1, borderTopColor: color("ink", "postRule") }}>
        <Text style={[serif(true), { fontSize: 14, lineHeight: 19.6, color: color("ink", "inkDim") }]}>{t.panelNote}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// De rail
// ---------------------------------------------------------------

type NavItem = { id: Tab; num: string; label: string; badge: number };

function useNav(active: Tab): { nav: NavItem[]; isOn: (id: Tab) => boolean } {
  const t = useT();
  const unread = useUnread();
  const pathname = usePathname();
  const nav: NavItem[] = [
    { id: "feed", num: "01", label: t.tabFeed, badge: 0 },
    { id: "chats", num: "02", label: t.tabChats, badge: active === "chats" ? 0 : unread.chats },
    { id: "events", num: "03", label: t.tabEvents, badge: 0 },
    { id: "you", num: "04", label: t.tabYou, badge: unread.notifications },
  ];
  const isOn = (id: Tab) => id === active || (id === "you" && (pathname.startsWith("/settings") || pathname.startsWith("/notifications")));
  return { nav, isOn };
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
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const { nav, isOn } = useNav(active);
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

  return (
    <View style={{ width: RAIL_W, minHeight: 0, borderRightWidth: spec.border, borderRightColor: ink, paddingVertical: 26, paddingHorizontal: 20 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push("/feed")}>
        <Text style={[serif(), { fontSize: 27, lineHeight: 27, color: ink }]}>Lincin</Text>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: dim, marginTop: 6 }]}>{dateLine}</Text>
      </Pressable>

      <View style={{ marginTop: 30, gap: 2 }}>
        {nav.map((n) => {
          const on = isOn(n.id);
          return (
            <Pressable
              key={n.id}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
              onPress={() => router.push(TAB_HREF[n.id] as never)}
              style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, backgroundColor: on ? ink : "transparent" }}
            >
              <Text numberOfLines={1} style={[mono(600), { flexShrink: 1, fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: on ? color("paper") : dim }]}>
                {n.num} {n.label}
              </Text>
              {n.badge > 0 ? (
                <View style={{ marginLeft: "auto", backgroundColor: color("red"), paddingVertical: 1, paddingHorizontal: 5 }}>
                  <Text style={[mono(600), { fontSize: 9, lineHeight: 12, color: "#F5F1E8" }]}>{n.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/post-compose")}
        style={{ marginTop: 24, height: 42, borderWidth: spec.border, borderColor: ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}
      >
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: ink }]}>{t.newPost}</Text>
        <Text style={{ fontSize: 16, lineHeight: 18, color: ink }}>+</Text>
      </Pressable>

      <View style={{ marginTop: "auto", gap: 12 }}>
        <Text style={[serif(true), { fontSize: 14, lineHeight: 19.6, color: dim }]}>{t.noAlgo}</Text>
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
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/profile")}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: color("ink", "postRule") }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color("paper2"), borderWidth: 1, borderColor: ink, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {profile.data?.avatar_url ? (
              <SafeImage uri={profile.data.avatar_url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text style={[head(), { fontSize: 15, lineHeight: 17, color: ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[serif(), { fontSize: 16, lineHeight: 16, color: ink }]}>
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

/** De smalle rail van 64 op volle breedte: "L", vier genummerde vakjes, en + onderaan. */
function RailNarrow({ active }: { active: Tab }) {
  const t = useT();
  const router = useRouter();
  const spec = useThemeSpec();
  const { nav, isOn } = useNav(active);
  const ink = color("ink");
  return (
    <View style={{ width: RAIL_NARROW, minHeight: 0, borderRightWidth: spec.border, borderRightColor: ink, alignItems: "center", paddingVertical: 18, gap: 14 }}>
      <Pressable accessibilityRole="link" accessibilityLabel="Lincin" onPress={() => router.push("/feed")}>
        <Text style={[serif(), { fontSize: 20, lineHeight: 24, color: ink }]}>L</Text>
      </Pressable>
      {nav.map((n) => {
        const on = isOn(n.id);
        return (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            accessibilityLabel={n.label}
            accessibilityState={{ selected: on }}
            onPress={() => router.push(TAB_HREF[n.id] as never)}
            style={{
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? ink : "transparent",
              borderWidth: on ? spec.border : 1,
              borderColor: on ? ink : color("ink", "postRule"),
            }}
          >
            <Text style={[mono(600), { fontSize: 10, lineHeight: 13, color: on ? color("paper") : color("ink", "inkDim") }]}>{n.num}</Text>
            {n.badge > 0 ? <View style={{ position: "absolute", top: -3, right: -3, width: 6, height: 6, backgroundColor: color("red") }} /> : null}
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.newPost}
        onPress={() => router.push("/post-compose")}
        style={{ marginTop: "auto", width: 34, height: 34, borderWidth: spec.border, borderColor: ink, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: 16, lineHeight: 18, color: ink }}>+</Text>
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
        borderBottomColor: color("ink"),
      }}
    >
      <Text style={[serif(), { flexShrink: 1, fontSize: 40, lineHeight: 38, letterSpacing: -0.8, color: color("ink") }]}>{children}</Text>
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
        borderBottomColor: color("ink"),
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
      style={{ width: 30, height: 30, borderWidth: spec.border, borderColor: color("ink"), alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 15, lineHeight: 17, color: color("ink") }}>×</Text>
    </Pressable>
  );
}
