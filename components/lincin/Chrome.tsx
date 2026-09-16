import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listMyChats } from "@/lib/api/chats";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/provider";
import { color, pageTint, useScheme } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { scrollActiveToTop } from "@/lib/scroll-top";

import { BORDER, GUTTER, SquareBtn } from "./ui";

/**
 * De omlijsting van élk v2-scherm (README §Global chrome).
 *
 *   KOP      "Lincin" links; rechts een teller, ◉ meldingen, + nieuw.
 *            Niet op schermen die hun eigen bovenrij hebben (gesprek,
 *            bladzijde, profiel, instellingen, meldingen, nieuw).
 *   BLAD     het papier, getint met de kleur van wie in beeld is.
 *   VOET     vier tabbladen in één kader: Feed · Gesprekken · Events · Jij.
 *
 * De voet staat hier en niet in de tabnavigator: een gesprek en een
 * bladzijde zijn stack-schermen en horen hem óók te hebben, met het
 * juiste tabblad aan.
 */

export type Tab = "feed" | "chats" | "events" | "you";

const TAB_HREF: Record<Tab, string> = {
  feed: "/feed",
  chats: "/chats",
  events: "/events",
  you: "/profile",
};

/** Hoe breed het blad op een groot scherm mag worden. */
const COLUMN_MAX = 640;

/** Wat er ligt: ongelezen gesprekken en meldingen. */
export function useUnread(): { chats: number; notifications: number } {
  const { session } = useAuth();
  const myId = session?.user.id ?? "anon";
  const chats = useQuery({
    queryKey: ["chats", myId],
    queryFn: () => listMyChats(myId),
    enabled: !!session,
    staleTime: 30_000,
  });
  const notes = useQuery({
    queryKey: ["notifications-unread", myId],
    queryFn: () => countUnreadNotifications(myId),
    enabled: !!session,
    staleTime: 30_000,
  });
  return {
    chats: (chats.data ?? []).reduce((n, c) => n + (c.unread_count ?? 0), 0),
    notifications: notes.data ?? 0,
  };
}

export function LincinScreen({
  tab,
  tint,
  counter,
  header = "default",
  children,
}: {
  tab: Tab;
  /** De vriendkleur (hex) van wie in beeld is; het blad kleurt mee. */
  tint?: string | null;
  /** Rechts in de kop, mono en gedempt: `01 / 05` of de schermnaam. */
  counter?: string;
  header?: "default" | "none" | ReactNode;
  children: ReactNode;
}) {
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bg = tint ? pageTint(tint, scheme) : color("paper");
  const wide = width > COLUMN_MAX + 40;

  return (
    <View
      style={[
        { flex: 1, backgroundColor: bg, paddingTop: insets.top },
        Platform.OS === "web"
          ? ({ transitionProperty: "background-color", transitionDuration: "700ms", transitionTimingFunction: "ease" } as object)
          : null,
      ]}
    >
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: wide ? COLUMN_MAX : undefined,
          alignSelf: "center",
        }}
      >
        {header === "default" ? <Header counter={counter} /> : header === "none" ? null : header}
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
        <FooterTabs active={tab} bottomInset={Math.max(insets.bottom, 16)} />
      </View>
    </View>
  );
}

/** "Lincin" · teller · ◉ · + */
export function Header({ counter }: { counter?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const unread = useUnread();
  const onNotes = pathname.startsWith("/notifications");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 6,
        paddingHorizontal: GUTTER,
      }}
    >
      <Pressable accessibilityRole="link" onPress={() => router.push("/feed")} hitSlop={8}>
        <Text style={[lincinType.meta, { fontFamily: lincinType.action.fontFamily, color: color("ink") }]}>Lincin</Text>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {counter ? (
          <Text style={[lincinType.meta, { color: color("ink", "inkDim"), marginRight: 4 }]}>{counter}</Text>
        ) : null}
        <SquareBtn
          glyph="◉"
          fontSize={14}
          fill={onNotes}
          badge={unread.notifications > 0}
          onPress={() => router.push("/notifications")}
          accessibilityLabel={unread.notifications > 0 ? `Meldingen, ${unread.notifications} nieuw` : "Meldingen"}
        />
        <SquareBtn
          glyph="+"
          fontSize={18}
          fill
          onPress={() => router.push("/post-compose")}
          accessibilityLabel="Nieuwe bijdrage"
        />
      </View>
    </View>
  );
}

/** ◫ Feed · ◌ Gesprekken · ◷ Events · ◍ Jij */
export function FooterTabs({ active, bottomInset = 34 }: { active: Tab; bottomInset?: number }) {
  const router = useRouter();
  const t = useT();
  const unread = useUnread();
  const tabs: { id: Tab; label: string; glyph: string; dot: boolean }[] = [
    { id: "feed", label: t.tabFeed, glyph: "◫", dot: false },
    { id: "chats", label: t.tabChats, glyph: "◌", dot: unread.chats > 0 && active !== "chats" },
    { id: "events", label: t.tabEvents, glyph: "◷", dot: false },
    { id: "you", label: t.tabYou, glyph: "◍", dot: false },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        marginTop: 10,
        marginHorizontal: GUTTER,
        marginBottom: bottomInset,
        borderWidth: BORDER,
        borderColor: color("ink"),
        backgroundColor: color("paper"),
      }}
    >
      {tabs.map((tab, i) => {
        const on = tab.id === active;
        const fg = on ? color("paper") : color("ink");
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.dot ? `${tab.label}, ${unread.chats} ${t.unread}` : tab.label}
            onPress={() => {
              if (on) scrollActiveToTop();
              else router.push(TAB_HREF[tab.id] as never);
            }}
            style={{
              flex: 1,
              height: 60,
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              backgroundColor: on ? color("ink") : "transparent",
              borderLeftWidth: i ? BORDER : 0,
              borderLeftColor: color("ink"),
            }}
          >
            <Text style={[lincinType.meta, { fontSize: 16, lineHeight: 18, letterSpacing: 0, textTransform: "none", color: fg }]}>
              {tab.glyph}
            </Text>
            <Text style={[lincinType.tab, { color: fg }]} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.dot ? (
              <View style={{ position: "absolute", top: 8, right: 12, width: 7, height: 7, backgroundColor: color("red") }} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** De bovenrij van een blad zonder kop: `← Terug` en een titel of label. */
export function TopRow({
  left,
  right,
  center,
}: {
  left: ReactNode;
  right?: ReactNode;
  center?: ReactNode;
}) {
  return (
    <View
      style={{
        marginTop: 8,
        marginHorizontal: GUTTER,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        {left}
        {center}
      </View>
      {right}
    </View>
  );
}
