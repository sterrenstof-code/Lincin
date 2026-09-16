import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { listMyFriendships } from "@/lib/api/friends";
import { listUserPosts } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { color, getPreference, setPreference, useScheme, useThemeSpec } from "@/lib/design/theme";
import { lincinType, mono, serif } from "@/lib/design/type";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { PANEL_W, RAIL_W } from "@/lib/lincin/desktop";
import { displayName } from "@/lib/lincin/model";

import { useUnread, type Tab } from "@/lib/lincin/unread";

import { Panel } from "./Panel";

/**
 * De drie kolommen van desktop (Lincin Desktop.dc.html):
 *
 *   ┌───────┬──────────────────────────────┬─────────────┐
 *   │ rail  │ hoofdkolom                   │ paneel      │
 *   │ 220   │ feed / gesprekken / events / │ 400         │
 *   │       │ jij / nieuw                  │ gesprek,    │
 *   │       │                              │ bladzijde,  │
 *   │       │                              │ profiel     │
 *   └───────┴──────────────────────────────┴─────────────┘
 *
 * Op desktop zijn de lijnen 1px (het ontwerp is daar een haarlijnraster),
 * ook in kleur; de rest van de tokens (papier, inkt, accent, koppen) komt
 * uit het thema.
 */

const TAB_HREF: Record<Tab, string> = { feed: "/feed", chats: "/chats", events: "/events", you: "/profile" };
const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export function DesktopShell({ active, children }: { active: Tab; children: ReactNode }) {
  const spec = useThemeSpec();
  const rule = color("ink", "postRule");
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: spec.gradient ? "transparent" : color("paper") }}>
      <Rail active={active} rule={rule} />
      <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</View>
      <View style={{ width: PANEL_W, borderLeftWidth: 1, borderLeftColor: color("ink"), backgroundColor: color("paper"), minHeight: 0 }}>
        <Panel />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// De rail
// ---------------------------------------------------------------

function Rail({ active, rule }: { active: Tab; rule: string }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const unread = useUnread();
  const scheme = useScheme();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const profile = useQuery({ queryKey: ["profile", myUserId], queryFn: () => getProfile(myUserId), enabled: !!session });
  const posts = useQuery({ queryKey: ["posts-by-user", myUserId], queryFn: () => listUserPosts(myUserId, 200), enabled: !!session, staleTime: 60_000 });
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId), enabled: !!session, staleTime: 60_000 });
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;
  const name = displayName(profile.data ?? { username: session?.user.email ?? "" });

  const today = new Date().toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long" });
  const nav: { id: Tab; num: string; label: string; badge: number }[] = [
    { id: "feed", num: "01", label: t.tabFeed, badge: 0 },
    { id: "chats", num: "02", label: t.chats, badge: unread.chats },
    { id: "events", num: "03", label: t.tabEvents, badge: 0 },
    { id: "you", num: "04", label: t.you, badge: unread.notifications },
  ];
  const dim = color("ink", "inkDim");
  const ink = color("ink");
  const stand = getPreference();
  const standLabel = scheme === "dark" ? t.dark : t.light;

  return (
    <View style={{ width: RAIL_W, borderRightWidth: 1, borderRightColor: rule, paddingTop: 34, paddingHorizontal: 28, paddingBottom: 28 }}>
      <Pressable accessibilityRole="link" onPress={() => router.push("/feed")}>
        <Text style={[serif(), { fontSize: 28, lineHeight: 28, letterSpacing: -0.56, color: ink }]}>Lincin</Text>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: dim, marginTop: 6 }]}>
          {today}
          {unread.notifications ? ` · ${unread.notifications} ${t.new}` : ""}
        </Text>
      </Pressable>

      <View style={{ marginTop: 40, gap: 2 }}>
        {nav.map((n) => {
          const on = n.id === active || (n.id === "you" && (pathname.startsWith("/settings") || pathname.startsWith("/notifications")));
          return (
            <Pressable
              key={n.id}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
              onPress={() => router.push(TAB_HREF[n.id] as never)}
              style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: rule }}
            >
              <Text style={[mono(500), { fontSize: 10, lineHeight: 12, color: dim, width: 18 }]}>{n.num}</Text>
              <Text style={[serif(on), { fontSize: 20, lineHeight: 22, color: ink }]}>{n.label}</Text>
              {n.badge > 0 ? (
                <View style={{ marginLeft: "auto", minWidth: 18, height: 18, paddingHorizontal: 5, backgroundColor: color("red"), alignItems: "center", justifyContent: "center" }}>
                  <Text style={[mono(600), { fontSize: 10, lineHeight: 12, color: "#F5F1E8" }]}>{n.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/post-compose")}
        style={{ marginTop: 28, height: 44, borderWidth: 1, borderColor: ink, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 }}
      >
        <Text style={[mono(500), { fontSize: 10, lineHeight: 12, letterSpacing: 1, textTransform: "uppercase", color: ink }]}>{t.newPost}</Text>
        <Text style={{ fontSize: 16, lineHeight: 18, color: ink }}>+</Text>
      </Pressable>

      <View style={{ marginTop: "auto", gap: 14 }}>
        <Text style={[serif(true), { fontSize: 14, lineHeight: 19, color: dim }]}>{t.noAlgo}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["nl", "en", "de"] as Lang[]).map((l) => (
              <Pressable key={l} accessibilityRole="button" onPress={() => setLang(l)}>
                <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase", color: l === lang ? ink : dim, textDecorationLine: l === lang ? "underline" : "none" }]}>
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => setPreference(stand === "dark" || (stand === "system" && scheme === "dark") ? "light" : "dark")}>
            <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase", color: ink, textDecorationLine: "underline" }]}>{standLabel}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/profile")}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: rule }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color("paper2"), borderWidth: 1, borderColor: ink, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {profile.data?.avatar_url ? (
              <SafeImage uri={profile.data.avatar_url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Text style={[lincinType.numeralTiny, { fontSize: 16, lineHeight: 18, color: ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[serif(), { fontSize: 17, lineHeight: 18, color: ink }]}>
              {name}
            </Text>
            <Text numberOfLines={1} style={[mono(500), { fontSize: 10, lineHeight: 13, color: dim }]}>
              {posts.data?.length ?? 0} {t.posts} · {lincs} lincs
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/** De titelrij van een hoofdkolom: serif 52 links, wat er rechts hoort. */
export function DesktopTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 20, paddingTop: 34, paddingHorizontal: 48, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: color("ink") }}>
      <Text style={[serif(), { fontSize: 52, lineHeight: 48, letterSpacing: -1.3, color: color("ink") }]}>{children}</Text>
      {right ? <View style={{ flexDirection: "row", gap: 16, paddingBottom: 8, alignItems: "center" }}>{right}</View> : null}
    </View>
  );
}

/** Een onderstreepte mono-link zoals het desktopontwerp ze overal zet. */
export function MonoLink({ label, on = true, active = false, onPress }: { label: string; on?: boolean; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress}>
      <Text
        style={[
          mono(500),
          {
            fontSize: 10,
            lineHeight: 13,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: on ? color("ink") : color("ink", "inkDim"),
            textDecorationLine: active ? "underline" : "none",
            ...(Platform.OS === "web" ? { textUnderlineOffset: 5 } : {}),
          } as object,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Voor schermen zonder eigen desktopvorm: de telefoonkolom, gecentreerd. */
export function DesktopColumn({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 24 }}>
      <View style={{ width: "100%", maxWidth: 640 }}>{children}</View>
    </ScrollView>
  );
}
