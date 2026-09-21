import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";

import { color, inkOn, useScheme, useThemeSpec, RASTER } from "@/lib/design/theme";
import { FONT, lincinType, mono, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useUnread, type Tab } from "@/lib/lincin/unread";
import { scrollActiveToTop } from "@/lib/scroll-top";

import { BORDER, GUTTER, line } from "../ui";

/**
 * De navigatie. Drie thema's, drie vormen — en in alle drie dezelfde vier
 * rubrieken: 01 Feed · 02 Gesprekken · 03 Events · 04 Jij.
 *
 *   KLEUR      "Rubrieken" (2.1): één kader, vier genummerde cellen van
 *              56 px met haarlijnen ertussen.
 *   MAGAZINE   "Rugstrook", model 1d (2.2 §3): vier losse tegels met een
 *              naad van 6 px, het woord onderaan uitgelijnd.
 *   MODERN     een zwevende pil met een schuiver die naar het actieve vak
 *              glijdt.
 *
 * De voet ligt altijd bóven de inhoud (`zIndex`) en blijft altijd in beeld
 * — 2.2 §5. In modern zweeft hij over de scroller heen; die houdt daarom
 * onderaan 104 px vrij (zie `NAV_CLEARANCE`).
 *
 * De voet staat hier en niet in de tabnavigator: een gesprek en een
 * bladzijde zijn stack-schermen en horen hem óók te hebben, met het juiste
 * tabblad aan.
 */

const TAB_HREF: Record<Tab, string> = {
  feed: "/feed",
  chats: "/chats",
  events: "/events",
  you: "/profile",
};

/** Hoeveel een modern-scroller onderaan vrijhoudt voor de zwevende pil. */
export const NAV_CLEARANCE = 104;

type TabDef = { id: Tab; label: string; dot: boolean };

function useTabs(active: Tab): TabDef[] {
  const t = useT();
  const unread = useUnread();
  return [
    { id: "feed", label: t.tabFeed, dot: false },
    { id: "chats", label: t.tabChats, dot: unread.chats > 0 && active !== "chats" },
    { id: "events", label: t.tabEvents, dot: false },
    { id: "you", label: t.tabYou, dot: false },
  ];
}

/** Naar een rubriek, of terug naar boven als je er al bent. */
function useGo() {
  const router = useRouter();
  return (tab: TabDef, on: boolean) => {
    if (on) scrollActiveToTop();
    else router.push(TAB_HREF[tab.id] as never);
  };
}

function a11y(tab: TabDef, unreadChats: number, unreadWord: string) {
  return tab.dot ? `${tab.label}, ${unreadChats} ${unreadWord}` : tab.label;
}

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
  const spec = useThemeSpec();
  if (spec.nav === "rugstrook") return <FooterRugstrook active={active} tint={tint} bottomInset={bottomInset} />;
  if (spec.nav === "pil") return <FooterPil active={active} bottomInset={bottomInset} />;
  return <FooterRubrieken active={active} tint={tint} bottomInset={bottomInset} />;
}

/**
 * KLEUR — "Rubrieken" (HANDOFF 2.1 §Footer tabs).
 *
 * Eén kader, vier gelijke kolommen van 56px met haarlijnen ertussen. Elke
 * cel links uitgelijnd, twee regels: het nummer (mono 500 9px; na `02` een
 * rood blokje van 6px als er iets ongelezen is) boven de naam (Archivo 900
 * op 75% breed, en op 62% voor een naam langer dan acht tekens, zodat
 * "Gesprekken" nooit afbreekt).
 *
 * Het actieve vak is gevuld met de vriendkleur van het moment (de vriend
 * in beeld, de gesprekspartner, de maker) en de inkt die daarop hoort;
 * zonder vriend in beeld met inkt en papier erop.
 */
function FooterRubrieken({ active, tint, bottomInset }: { active: Tab; tint: string | null; bottomInset: number }) {
  const t = useT();
  const unread = useUnread();
  const scheme = useScheme();
  const tabs = useTabs(active);
  const go = useGo();
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
        overflow: "hidden",
        backgroundColor: color("paper"),
        zIndex: 12,
      }}
    >
      {tabs.map((tab, i) => {
        const on = tab.id === active;
        const fg = on ? onFg : color("ink", "inkDim");
        const narrow = tab.label.length > 8;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a11y(tab, unread.chats, t.unread)}
            onPress={() => go(tab, on)}
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
              <Text style={{ ...mono(500), fontSize: 9, lineHeight: 10, color: fg }}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              {tab.dot ? <View style={{ width: 6, height: 6, backgroundColor: color("red") }} /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                lincinType.cardTitle,
                { fontSize: 13, lineHeight: 14, letterSpacing: -0.26, color: fg },
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

/**
 * MAGAZINE — "Rugstrook", model 1d (2.2 §3).
 *
 * Vier tegels in `repeat(4,1fr)` met een naad van 6 px, padding
 * `6px 6px 28px`, tegelhoogte 58 px. De actieve tegel draagt de kleur van
 * de pagina — de vriendkleur van de bijdrage of het gesprek in beeld, en
 * inkt waar geen vriend in beeld is; de andere drie staan op `paper2`.
 *
 * Het woord staat onderaan uitgelijnd: actief Instrument Serif 17 px
 * cursief, inactief 15 px op 62 % dekking. Achter "Gesprekken" staat een
 * rode stip van 5 px bij ongelezen berichten.
 *
 * De tegel is 58 px hoog en een kwart breed — ruim boven het raakvlak van
 * 44 px dat overal geldt.
 */
function FooterRugstrook({ active, tint, bottomInset }: { active: Tab; tint: string | null; bottomInset: number }) {
  const t = useT();
  const unread = useUnread();
  const scheme = useScheme();
  const tabs = useTabs(active);
  const go = useGo();
  const onBg = tint ?? color("ink");
  const onFg = tint ? inkOn(tint, scheme) : color("paper");
  return (
    <View
      style={{
        flexDirection: "row",
        gap: RASTER.seam,
        paddingTop: RASTER.seam,
        paddingHorizontal: RASTER.seam,
        // 28px in het prototype; op een toestel met een thuisbalk wint die.
        paddingBottom: Math.max(28, bottomInset),
        backgroundColor: color("paper"),
        zIndex: 12,
      }}
    >
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a11y(tab, unread.chats, t.unread)}
            onPress={() => go(tab, on)}
            style={[
              {
                flex: 1,
                minWidth: 0,
                height: 58,
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: 6,
                paddingBottom: 10,
                backgroundColor: on ? onBg : color("paper2"),
                opacity: on ? 1 : 0.62,
              },
              Platform.OS === "web"
                ? ({
                    transitionProperty: "background-color, color, opacity",
                    transitionDuration: "350ms",
                  } as object)
                : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={{
                ...serif(on),
                fontSize: on ? 17 : 15,
                lineHeight: on ? 17 : 15,
                letterSpacing: -0.17,
                color: on ? onFg : color("ink"),
              }}
            >
              {tab.label}
            </Text>
            {tab.dot ? (
              <View
                style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color("red"), marginBottom: 4 }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * MODERN — de zwevende pil.
 *
 * Een pil over de inhoud heen, met een schuiver die in .42s naar het
 * actieve vak glijdt. Omdat hij zweeft houdt de scroller eronder
 * `NAV_CLEARANCE` vrij; de pil zelf ligt op `zIndex: 20`, boven inhoud en
 * korrellaag.
 *
 * De vakken zijn 46 px hoog — kleiner dan 44 is het raakvlak dus nergens,
 * en de pil heeft er nog 5 px padding omheen.
 */
function FooterPil({ active, bottomInset }: { active: Tab; bottomInset: number }) {
  const t = useT();
  const unread = useUnread();
  const tabs = useTabs(active);
  const go = useGo();
  const idx = Math.max(0, tabs.findIndex((tab) => tab.id === active));
  // De schuiver wordt in pixels gerekend, niet in procenten: RN en
  // react-native-web rekenen een procentuele `translateX` niet hetzelfde af,
  // en een gemeten breedte klopt op allebei.
  const [width, setWidth] = useState(0);
  const cell = width > 0 ? (width - 10) / 4 : 0;
  const x = useRef(new Animated.Value(0)).current;
  /** Staat de schuiver al ergens? Pas dáárna is bewegen een overgang. */
  const placed = useRef(false);

  useEffect(() => {
    if (!cell) return;
    const to = 5 + idx * cell;
    // De eerste keer springt hij op zijn plek. Anders glijdt hij bij élke
    // paginalading vanaf links binnen, en dat leest als een wissel die je
    // niet gemaakt hebt.
    if (!placed.current) {
      placed.current = true;
      x.setValue(to);
      return;
    }
    Animated.timing(x, {
      toValue: to,
      duration: 420,
      easing: Easing.bezier(0.22, 0.8, 0.2, 1),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [idx, cell, x]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        bottom: Math.max(26, bottomInset - 8),
        padding: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color("ink", "postRule"),
        // Prototype: `color-mix(in oklch, var(--p) 72%, transparent)` met
        // `backdrop-filter: blur(18px)`. De pil zweeft over de inhoud, dus
        // hij moet die dempen — op .35 las de tekst eronder dwars door de
        // woorden heen.
        backgroundColor: color("paper", "glass"),
        zIndex: 20,
        ...(Platform.OS === "web"
          ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object)
          : null),
      }}
    >
      {/* De schuiver. Ligt onder de woorden en beweegt als enige. */}
      {cell > 0 ? (
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 5,
            bottom: 5,
            width: cell,
            transform: [{ translateX: x }],
            borderRadius: 999,
            backgroundColor: color("ink"),
          }}
        />
      ) : null}
      <View style={{ flexDirection: "row" }}>
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={a11y(tab, unread.chats, t.unread)}
              onPress={() => go(tab, on)}
              style={{
                flex: 1,
                minWidth: 0,
                height: 46,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                overflow: "hidden",
              }}
            >
              <Text
                numberOfLines={1}
                style={[
                  {
                    ...mono(500),
                    fontSize: 9.5,
                    lineHeight: 12,
                    letterSpacing: 1.14, // .12em
                    textTransform: "uppercase",
                    color: on ? color("paper") : color("ink", "inkDim"),
                  },
                  Platform.OS === "web"
                    ? ({ transitionProperty: "color", transitionDuration: "300ms" } as object)
                    : null,
                ]}
              >
                {tab.label}
              </Text>
              {tab.dot ? (
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color("red") }} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
