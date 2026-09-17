import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Image, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, inkOn, MODERN_GRADIENT, pageTint, paperHex, useScheme, useThemeSpec, type Scheme } from "@/lib/design/theme";
import { FONT, lincinType, mono } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { useUnread, type Tab } from "@/lib/lincin/unread";
import { scrollActiveToTop } from "@/lib/scroll-top";

import { DesktopShell } from "./desktop/Shell";

import { BORDER, GUTTER, line, RADIUS, SquareBtn } from "./ui";

/**
 * De omlijsting van élk v2-scherm (README §Global chrome).
 *
 *   KOP      "Lincin" links; rechts een teller, ◉ meldingen, + nieuw.
 *            Niet op schermen die hun eigen bovenrij hebben (gesprek,
 *            bladzijde, profiel, instellingen, meldingen, nieuw).
 *   BLAD     het papier, getint met de kleur van wie in beeld is — als
 *            verloop (2.1): bovenaan de tint, onderaan de volgende vriend
 *            (feed) of het papier (elders).
 *   VOET     "Rubrieken" (2.1): vier genummerde cellen in één kader,
 *            01 Feed · 02 Gesprekken · 03 Events · 04 Jij.
 *
 * De voet staat hier en niet in de tabnavigator: een gesprek en een
 * bladzijde zijn stack-schermen en horen hem óók te hebben, met het
 * juiste tabblad aan.
 */

export type { Tab };
export { useUnread };

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

export function LincinScreen({
  tab,
  tint,
  tintNext = null,
  tabTint,
  counter,
  header = "default",
  full = false,
  bleed = false,
  embedded = false,
  ownDesktop = false,
  children,
}: {
  tab: Tab;
  /** Geen kolom van 640 op een breed scherm — voor wie zelf kolommen legt (het gesprek). */
  full?: boolean;
  /** De vriendkleur (hex) van wie in beeld is; het blad kleurt mee (alleen in kleur). */
  tint?: string | null;
  /**
   * Feed, per vriend: de kleur van de vólgende vriend. Het verloop loopt
   * dan van `tint` naar deze in plaats van naar papier (HANDOFF 2.1).
   */
  tintNext?: string | null;
  /**
   * De vriendkleur van het actieve tabblad (alleen in kleur). Standaard
   * `tint`; een scherm dat wel tint maar geen vriend in beeld heeft
   * (nieuwe bijdrage) geeft `null`.
   */
  tabTint?: string | null;
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
  /** In het desktoppaneel: alleen de inhoud, geen kop, voet of blad. */
  embedded?: boolean;
  /** Dit scherm tekent zijn eigen desktopvorm (de feed): geen omlijsting. */
  ownDesktop?: boolean;
  children: ReactNode;
}) {
  const scheme = useScheme();
  const spec = useThemeSpec();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const desktop = useIsDesktop();
  if (embedded) return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
  if (desktop && !ownDesktop) {
    // Desktop (Lincin Desktop.dc.html): rail, hoofdkolom, paneel. Een scherm
    // zonder eigen desktopvorm staat als kolom van 640 in het midden, mét
    // zijn eigen bovenrij (← Terug) maar zonder de telefoonkop en -voet.
    return (
      <DesktopShell active={tab}>
        <View style={{ flex: 1, minHeight: 0, alignItems: "center" }}>
          <View style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 640, paddingTop: 16 }}>
            {header === "default" || header === "none" ? null : header}
            {children}
          </View>
        </View>
      </DesktopShell>
    );
  }
  const verloop = !spec.gradient && spec.tint && !!tint;
  const bg = spec.gradient ? MODERN_GRADIENT.base : color("paper");
  const wide = !full && columnWidth(width) !== width;
  const activeTint = spec.tint ? (tabTint === undefined ? tint : tabTint) ?? null : null;

  return (
    <View
      style={[
        { flex: 1, backgroundColor: bg, paddingTop: bleed ? 0 : insets.top },
      ]}
    >
      {spec.gradient ? <ModernBackdrop width={width} height={height} /> : null}
      {verloop ? <Verloop tint={tint!} next={tintNext} scheme={scheme} /> : null}
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
        <FooterTabs active={tab} tint={activeTint} bottomInset={Math.max(insets.bottom, 16)} />
      </View>
    </View>
  );
}

/**
 * Het verloop van kleur (HANDOFF 2.1 §Page tint — "verloop").
 *
 * Geen vlakke tint meer maar een verticaal verloop. In de feed: de tint
 * van de vriend in beeld van 0 tot 38%, dan naar de tint van de vólgende
 * vriend op 100% — het blad kijkt vooruit. Elders (gesprek, bladzijde,
 * profiel, nieuw): de tint van 0 tot 30%, dan naar papier.
 *
 * Een CSS-verloop laat zich niet overvloeien, dus de overgang van .7s is
 * een laag die erbovenop invloeit: de vorige blijft eronder liggen tot de
 * nieuwe er helemaal staat.
 */
function Verloop({ tint, next, scheme }: { tint: string; next: string | null; scheme: Scheme }) {
  const top = pageTint(tint, scheme);
  const bottom = next ? pageTint(next, scheme) : paperHex(scheme);
  const hold = next ? 0.38 : 0.3;
  const key = `${top}-${bottom}-${hold}`;
  const [layers, setLayers] = useState<{ key: string; top: string; bottom: string; hold: number }[]>(() => [
    { key, top, bottom, hold },
  ]);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setLayers((l) => {
      if (l[l.length - 1]?.key === key) return l;
      return [l[l.length - 1], { key, top, bottom, hold }].filter(Boolean);
    });
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <View style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      {layers.map((l, i) => (
        <Animated.View
          key={l.key}
          style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity: i === layers.length - 1 && layers.length > 1 ? fade : 1 }}
        >
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              {/* Het id draagt de kleuren: op web staan meerdere schermen tegelijk
                  in het document, en `url(#…)` pakt het eerste met die naam. */}
              <LinearGradient id={gradientId(l.key)} x1="0" y1="0" x2="0" y2="1">
                <Stop offset={0} stopColor={l.top} />
                <Stop offset={l.hold} stopColor={l.top} />
                <Stop offset={1} stopColor={l.bottom} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${gradientId(l.key)})`} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

function gradientId(key: string): string {
  return `verloop-${key.replace(/[^a-z0-9]/gi, "")}`;
}

/**
 * Het blad van modern: een radiaal verloop (700×500 op 70%/20%) van
 * #8A3A1E via #3A1A10 naar #1A1210, met een korrel van 3px op 18%
 * erover (HANDOFF §modern). Het verloop is een SVG zodat het op web en
 * native hetzelfde is; de korrel is op web de radial-gradient uit het
 * prototype en op native een herhaalde tegel van dezelfde stippen.
 */
export function ModernBackdrop({ width, height }: { width: number; height: number }) {
  const g = MODERN_GRADIENT;
  return (
    <View style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden" }}>
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

/**
 * De voet, model "Rubrieken" (HANDOFF 2.1 §Footer tabs).
 *
 * Eén kader, vier gelijke kolommen van 56px met haarlijnen ertussen. Elke
 * cel links uitgelijnd, twee regels: het nummer (mono 500 9px; na `02` een
 * rood blokje van 6px als er iets ongelezen is) boven de naam (de kopletter
 * op 13px; in kleur Archivo 900 op 75% breed, en op 62% voor een naam
 * langer dan acht tekens, zodat "Gesprekken" nooit afbreekt).
 *
 * Het actieve vak is gevuld: in kleur met de vriendkleur van het moment
 * (de vriend in beeld, de gesprekspartner, de maker) en de inkt die daarop
 * hoort; zonder vriend in beeld — en in magazine en modern — met inkt en
 * papier erop. De andere drie zijn gedempt.
 */
export function FooterTabs({
  active,
  tint = null,
  bottomInset = 34,
}: {
  active: Tab;
  /** De vriendkleur van het moment (hex), of `null`. */
  tint?: string | null;
  bottomInset?: number;
}) {
  const router = useRouter();
  const t = useT();
  const unread = useUnread();
  const spec = useThemeSpec();
  const scheme = useScheme();
  const tabs: { id: Tab; label: string; dot: boolean }[] = [
    { id: "feed", label: t.tabFeed, dot: false },
    { id: "chats", label: t.tabChats, dot: unread.chats > 0 && active !== "chats" },
    { id: "events", label: t.tabEvents, dot: false },
    { id: "you", label: t.tabYou, dot: false },
  ];
  const onBg = tint ?? color("ink");
  const onFg = tint ? inkOn(tint, scheme) : color("paper");
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
        const fg = on ? onFg : color("ink", "inkDim");
        const narrow = !spec.serifHeads && tab.label.length > 8;
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
            style={[
              {
                flex: 1,
                minWidth: 0,
                height: 56,
                paddingHorizontal: 10,
                justifyContent: "center",
                gap: 3,
                overflow: "hidden",
                backgroundColor: on ? onBg : "transparent",
                borderLeftWidth: i ? 1 : 0,
                borderLeftColor: color("ink", "postRule"),
              },
              Platform.OS === "web"
                ? ({ transitionProperty: "background-color, color", transitionDuration: "300ms" } as object)
                : null,
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ ...mono(500), fontSize: 9, lineHeight: 10, color: fg }}>{String(i + 1).padStart(2, "0")}</Text>
              {tab.dot ? <View style={{ width: 6, height: 6, backgroundColor: color("red") }} /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                lincinType.cardTitle,
                { fontSize: 13, lineHeight: 14, letterSpacing: spec.serifHeads ? 0 : -0.26, color: fg },
                narrow ? { fontFamily: FONT.headX } : null,
              ]}
            >
              {tab.label}
            </Text>
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
