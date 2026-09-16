import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Image, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listMyChats } from "@/lib/api/chats";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/provider";
import { color, MODERN_GRADIENT, pageTint, useScheme, useThemeSpec } from "@/lib/design/theme";
import { lincinType, mono } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { scrollActiveToTop } from "@/lib/scroll-top";

import { BORDER, GUTTER, line, RADIUS, SquareBtn } from "./ui";

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
export const COLUMN_MAX = 640;

/**
 * Hoe breed het blad nú is, gegeven de vensterbreedte: het venster zelf,
 * of de kolom als het venster ruim breder is. Wie iets moet verdelen over
 * die breedte (het mozaïek van modern) rekent hiermee in plaats van te
 * meten — een `onLayout` op de ScrollView blijft op web wel eens uit.
 */
export function columnWidth(windowWidth: number): number {
  return windowWidth > COLUMN_MAX + 40 ? COLUMN_MAX : windowWidth;
}

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
  full = false,
  bleed = false,
  children,
}: {
  tab: Tab;
  /** Geen kolom van 640 op een breed scherm — voor wie zelf kolommen legt (het gesprek). */
  full?: boolean;
  /** De vriendkleur (hex) van wie in beeld is; het blad kleurt mee (alleen in kleur). */
  tint?: string | null;
  /** Rechts in de kop, mono en gedempt: `01 / 05` of de schermnaam. */
  counter?: string;
  /**
   * De kop "Lincin · teller · ◉ · +" staat op élk scherm (prototype:
   * `showHeader` is alleen uit voor de magazine-feed). Een scherm met een
   * eigen bovenrij (`← Terug`, een titel) geeft die hier mee; hij komt
   * ónder de kop. `none` laat de kop weg.
   */
  header?: "default" | "none" | ReactNode;
  /** De inhoud loopt onder de statusbalk door (het magazine-hero). */
  bleed?: boolean;
  children: ReactNode;
}) {
  const scheme = useScheme();
  const spec = useThemeSpec();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const bg = spec.gradient ? MODERN_GRADIENT.base : tint && spec.tint ? pageTint(tint, scheme) : color("paper");
  const wide = !full && columnWidth(width) !== width;

  return (
    <View
      style={[
        { flex: 1, backgroundColor: bg, paddingTop: bleed ? 0 : insets.top },
        Platform.OS === "web"
          ? ({ transitionProperty: "background-color", transitionDuration: "700ms", transitionTimingFunction: "ease" } as object)
          : null,
      ]}
    >
      {spec.gradient ? <ModernBackdrop width={width} height={height} /> : null}
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: wide ? COLUMN_MAX : undefined,
          alignSelf: "center",
        }}
      >
        {header === "none" ? null : <Header counter={counter} />}
        {header === "default" || header === "none" ? null : header}
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
        <FooterTabs active={tab} bottomInset={Math.max(insets.bottom, 16)} />
      </View>
    </View>
  );
}

/**
 * Het blad van modern: een radiaal verloop (700×500 op 70%/20%) van
 * #8A3A1E via #3A1A10 naar #1A1210, met een korrel van 3px op 18%
 * erover (HANDOFF §modern). Het verloop is een SVG zodat het op web en
 * native hetzelfde is; de korrel is op web de radial-gradient uit het
 * prototype en op native een herhaalde tegel van dezelfde stippen.
 */
function ModernBackdrop({ width, height }: { width: number; height: number }) {
  const g = MODERN_GRADIENT;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="lincin-modern" cx={width * g.cx} cy={height * g.cy} rx={g.rx} ry={g.ry} gradientUnits="userSpaceOnUse">
            {g.stops.map((s) => (
              <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={g.base} />
        <Ellipse cx={width * g.cx} cy={height * g.cy} rx={g.rx} ry={g.ry} fill="url(#lincin-modern)" />
      </Svg>
      {Platform.OS === "web" ? (
        <View
          style={
            {
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              opacity: 0.18,
              backgroundImage: "radial-gradient(rgba(255,255,255,.7) .6px, transparent .6px)",
              backgroundSize: "3px 3px",
              mixBlendMode: "overlay",
            } as object
          }
        />
      ) : (
        <Image
          source={require("../../assets/images/grain-dots.png")}
          resizeMode="repeat"
          style={{ position: "absolute", left: 0, top: 0, width, height, opacity: 0.18 }}
        />
      )}
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
        <Text style={[lincinType.meta, mono(600), { color: color("ink") }]}>Lincin</Text>
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
  const spec = useThemeSpec();
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
        borderColor: line(),
        borderRadius: RADIUS,
        overflow: "hidden",
        backgroundColor: color("paper"),
      }}
    >
      {tabs.map((tab, i) => {
        const on = tab.id === active;
        // Kleur: het actieve tabblad is een inktvlak. Magazine en modern:
        // inkt-tekst voor het actieve, de rest gedempt (prototype `tabs`).
        const fill = on && spec.tabFill;
        const fg = fill ? color("paper") : on ? color("ink") : spec.tabFill ? color("ink") : color("ink", "inkDim");
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
              backgroundColor: fill ? color("ink") : "transparent",
              borderLeftWidth: i ? BORDER : 0,
              borderLeftColor: line(),
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
