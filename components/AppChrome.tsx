import { usePathname, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";

import { LogoMark } from "@/components/LogoMark";
import { announce, feed, FEED_BORDER, feedType } from "@/lib/design/type";

/**
 * De chrome die op ÉLK tabblad staat: aankondigingsbalk, gekaderde kop met
 * de tabstrip, en daaronder de woordmerk-plaat.
 *
 * Waarom hier en niet per scherm: feed, events, chats, vrienden en profiel
 * deelden eerst alleen een tabbalk onderin. Nu is de kop de navigatie, dus
 * hij hoort één keer te bestaan en niet vijf keer overgetypt te worden.
 *
 * De chrome staat BUITEN de scrollende inhoud van een scherm. Dat is nodig
 * voor de inklap-animatie: als de plaat gewoon meescrolt is hij al van het
 * scherm af voordat je hem ziet krimpen.
 */

// ---------------------------------------------------------------
// Scrollpositie → inklapstand
// ---------------------------------------------------------------

/**
 * Levert de `progress`-waarde (0 = groot, 1 = compact) plus de scroll-props
 * die je op de scroller van het scherm zet.
 *
 * De kop klapt **meteen** in — al na een tiental pixels — en gaat pas weer
 * open als je helemaal terug bovenaan bent. Dat is bewust anders dan de
 * eerdere 100vh-drempel: die maakte dat je op korte pagina's de compacte
 * stand nooit te zien kreeg, en dat het op lange pagina's voelde alsof er
 * niets gebeurde tot je een heel scherm ver was.
 *
 * `useNativeDriver` staat uit omdat we `height` animeren, en dat kan de
 * native driver niet.
 */
export function useChromeScroll() {
  const progress = useRef(new Animated.Value(0)).current;
  const collapsed = useRef(false);
  /** Voorbij deze scrollafstand is de kop compact. */
  const THRESHOLD = 12;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const next = y > THRESHOLD;
      if (next === collapsed.current) return;
      collapsed.current = next;
      Animated.timing(progress, {
        toValue: next ? 1 : 0,
        duration: 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [progress]
  );

  return { progress, onScroll, scrollEventThrottle: 16 };
}

// ---------------------------------------------------------------
// Aankondigingsbalk
// ---------------------------------------------------------------

/**
 * De oranje balk bovenaan.
 *
 * Dit is de énige plek in de app waar het warme oranje (`announce`,
 * #E66B3F) nog voorkomt. Alle andere accenten — citaatteken, indexcijfer,
 * kickers, lijnwerk — staan in het scherpe rood (`flame`, #E63329). Die
 * twee hebben daarom een eigen tokennaam, zodat een latere zoek-vervang op
 * het rood deze balk niet meeneemt.
 *
 * Er staat bewust een echte, wegklikbare boodschap in plaats van een
 * versielabel — een balk die niets zegt is alleen maar kleur. Geef `message`
 * mee vanuit een scherm, of pas de constante hieronder aan zodra er een
 * echte aankondigingsbron is.
 */
const DEFAULT_ANNOUNCEMENT = "Nieuw: deel een vondst rechtstreeks vanuit een andere app ↗";

export function AnnouncementBar({
  message = DEFAULT_ANNOUNCEMENT,
  onPress,
}: {
  message?: string | null;
  onPress?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (!message || dismissed) return null;

  return (
    <View
      style={{
        backgroundColor: announce,
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 9,
        paddingHorizontal: 12,
      }}
    >
      <Pressable onPress={onPress} style={{ flex: 1 }} disabled={!onPress}>
        <Text
          style={[
            feedType.label,
            {
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 0.35,
              color: "#1A0A05",
              textAlign: "center",
            },
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} hitSlop={10} style={{ paddingLeft: 10 }}>
        <Text style={[feedType.label, { fontSize: 13, fontWeight: "700", color: "#1A0A05" }]}>
          ✕
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------
// De gekaderde kop
// ---------------------------------------------------------------

/** De échte routes uit `app/(app)/_layout.tsx` — geen verzonnen navigatie. */
const TABS: { href: string; label: string }[] = [
  { href: "/feed", label: "Feed" },
  { href: "/events", label: "Events" },
  { href: "/chats", label: "Chats" },
  { href: "/friends", label: "Vrienden" },
  { href: "/profile", label: "Profiel" },
];

/** Horizontale scheiding binnen het kader — zelfde dikte als het kader. */
function Divider() {
  return <View style={{ height: FEED_BORDER, backgroundColor: feed.ink }} />;
}

export function AppHeader({
  wide,
  progress,
  backLabel,
  onBack,
}: {
  wide: boolean;
  /** 0 = groot, 1 = compact. De taglineregel vouwt mee dicht. */
  progress?: Animated.Value;
  backLabel?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const p = progress ?? new Animated.Value(0);

  // Ingeklapt blijft ALLEEN de tabstrip over, plus de woordmerk-plaat in
  // zijn compacte maat. De micro-utilityregel (rij A) en de tagline (rij C)
  // vouwen allebei dicht — dat is wat "heel klein" hier betekent.
  const utilityHeight = p.interpolate({
    inputRange: [0, 1],
    outputRange: [38, 0],
  });
  const utilityOpacity = p.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const taglineHeight = p.interpolate({
    inputRange: [0, 1],
    outputRange: [wide ? 96 : 118, 0],
  });
  const taglineOpacity = p.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>
      {/* Rij A — micro-utility. Vouwt dicht zodra de kop compact wordt. */}
      <Animated.View
        style={{ height: utilityHeight, opacity: utilityOpacity, overflow: "hidden" }}
      >
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1 }} className="px-3.5 py-2.5">
          <Text style={[feedType.micro, { color: feed.ink, fontSize: 13, fontWeight: "800" }]}>
            Lincin
          </Text>
        </View>
        <View style={{ flex: 1 }} className="px-3.5 py-2.5">
          {wide ? (
            <Text style={[feedType.label, { color: "#3A3540", textAlign: "center" }]}>
              Voor je vrienden.
            </Text>
          ) : null}
        </View>
        <View
          style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}
          className="px-3.5 py-2.5"
        >
          <Pressable onPress={() => router.push("/profile-edit")} hitSlop={6}>
            <Text style={[feedType.label, { color: feed.ink }]}>Instellingen</Text>
          </Pressable>
          <Text style={[feedType.label, { color: feed.ink, marginHorizontal: 5 }]}>·</Text>
          {/* `as never`: de gegenereerde typed routes in `.expo/types` zijn
              verouderd en kennen /notifications niet. */}
          <Pressable onPress={() => router.push("/notifications" as never)} hitSlop={6}>
            <Text style={[feedType.label, { color: feed.ink }]}>Meldingen</Text>
          </Pressable>
        </View>
      </View>
      <Divider />
      </Animated.View>

      {/* Rij B — de navigatie. Blijft altijd staan, ook in de compacte
          stand: dit is het enige wat dan nog over is naast de plaat. */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}
          className="py-3"
        >
          <Text style={[feedType.label, { fontSize: 12, color: feed.ink }]}>
            {`← ${backLabel ?? "Terug"}`}
          </Text>
        </Pressable>
      ) : (
      <View style={{ flexDirection: "row" }}>
        {TABS.map((tab, i) => {
          const active = pathname === tab.href;
          return (
            <Pressable
              key={tab.href}
              onPress={() => {
                if (!active) router.push(tab.href as never);
              }}
              style={{
                flex: 1,
                backgroundColor: active ? feed.ink : "transparent",
                ...(i < TABS.length - 1
                  ? { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }
                  : null),
              }}
              className="py-3 px-2 items-center"
            >
              <Text
                style={[feedType.label, { fontSize: 12, color: active ? feed.lav : feed.ink }]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      )}

      {/* Rij C — de tagline. Vouwt dicht zodra de kop compact wordt. */}
      <Animated.View style={{ height: taglineHeight, opacity: taglineOpacity, overflow: "hidden" }}>
        <Divider />
        <View
          style={{
            flexDirection: wide ? "row" : "column",
            justifyContent: "space-between",
            alignItems: wide ? "flex-end" : "flex-start",
            paddingHorizontal: 18,
            paddingTop: 20,
            paddingBottom: 22,
          }}
        >
          <Text
            style={[
              wide ? feedType.tagline : feedType.taglineSmall,
              { color: feed.ink, maxWidth: 520 },
            ]}
          >
            Ontdekkingen van je vrienden — links, fragmenten, muziek en ideeën.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------
// De woordmerk-plaat
// ---------------------------------------------------------------

/**
 * De plaat krimpt van 150px naar 56px. In plaats van de letterzetting te
 * schalen (waarbij het ankerpunt en de korrel gaan zwemmen) kruisvervagen
 * we tussen de twee maten die `LogoMark` al kent. Dat leest als een
 * bedoelde overgang in plaats van als een transform-artefact, en het werkt
 * identiek op web en native.
 */
export function LogoPlate({ progress }: { progress: Animated.Value }) {
  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [150, 56] });
  const plateOpacity = progress.interpolate({
    inputRange: [0, 0.55],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const compactOpacity = progress.interpolate({
    inputRange: [0.45, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <Animated.View style={{ height, marginTop: 12, overflow: "hidden" }}>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: plateOpacity }}
      >
        <LogoMark size="plate" />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: compactOpacity }}
      >
        <LogoMark size="compact" />
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------
// Alles samen
// ---------------------------------------------------------------

/**
 * Zet dit boven de scrollende inhoud van een tabblad, en geef de
 * `onScroll`/`scrollEventThrottle` uit `useChromeScroll()` door aan die
 * ScrollView of FlatList.
 *
 *   const chrome = useChromeScroll();
 *   …
 *   <AppChrome wide={wide} progress={chrome.progress} />
 *   <ScrollView onScroll={chrome.onScroll}
 *               scrollEventThrottle={chrome.scrollEventThrottle}>
 */
export function AppChrome({
  wide,
  progress,
  announcement,
  onAnnouncementPress,
  backLabel,
  onBack,
}: {
  wide: boolean;
  progress: Animated.Value;
  announcement?: string | null;
  onAnnouncementPress?: () => void;
  /**
   * Zet dit op een detailpagina. De tabstrip maakt dan plaats voor een
   * terug-knop, zodat zo'n pagina aanvoelt als een eigen pagina binnen
   * dezelfde site in plaats van als een zesde tabblad.
   */
  backLabel?: string;
  onBack?: () => void;
}) {
  // De aankondigingsbalk vouwt mee dicht: in de compacte stand hoort er
  // zo min mogelijk ruimte op te gaan aan chrome.
  const bannerHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [36, 0],
  });
  const bannerOpacity = progress.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const padTop = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 6] });
  const padBottom = progress.interpolate({ inputRange: [0, 1], outputRange: [4, 6] });

  return (
    <View style={{ backgroundColor: feed.lav }}>
      <Animated.View
        style={{ height: bannerHeight, opacity: bannerOpacity, overflow: "hidden" }}
      >
        <AnnouncementBar message={announcement} onPress={onAnnouncementPress} />
      </Animated.View>
      <Animated.View
        style={{
          paddingHorizontal: wide ? 24 : 16,
          paddingTop: padTop,
          paddingBottom: padBottom,
        }}
      >
        <AppHeader
          wide={wide}
          progress={progress}
          backLabel={backLabel}
          onBack={onBack}
        />
        <LogoPlate progress={progress} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------
// De pagina zelf
// ---------------------------------------------------------------

/** Breedte van de bladspiegel. Geen telefoonkolom van 600px meer. */
export const PAGE_MAX = 1280;

/**
 * De scroller van een heel scherm, met de kop erboven.
 *
 * ---------------------------------------------------------------
 * WAAROM NIET `stickyHeaderIndices`
 * ---------------------------------------------------------------
 * De vorige opzet zette de kop als eerste kind ín de ScrollView met
 * `stickyHeaderIndices={[0]}`. Op native werkt dat, maar op
 * react-native-web 0.21 pakt het niet betrouwbaar: de kop scrolde
 * gewoon mee het beeld uit. Vandaar deze opzet.
 *
 * Nu staat de kop **buiten** de scroller, absoluut bovenaan verankerd.
 * Hij hoort dus niet bij de scrollende inhoud en kan per definitie niet
 * wegscrollen — geen platformafhankelijk gedrag, geen sticky-quirks.
 *
 * De inhoud krijgt bovenaan evenveel opvulling als de kop hoog is. Die
 * hoogte meten we met `onLayout` in plaats van hem te hardcoderen: hij
 * verschilt per breedte, per modus (tabs of terug-knop) en met het al dan
 * niet tonen van de aankondigingsbalk.
 */
export function PageScroll({
  children,
  wide,
  progress,
  onScroll,
  scrollEventThrottle,
  refreshControl,
  announcement,
  contentStyle,
  gutter = true,
  backLabel,
  onBack,
}: {
  children: React.ReactNode;
  wide: boolean;
  progress: Animated.Value;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  announcement?: string | null;
  contentStyle?: ViewStyle;
  /** Zet uit als de inhoud zelf tot de rand moet lopen (volvlak-beeld). */
  gutter?: boolean;
  /** Detailpagina: toon een terug-knop i.p.v. de tabstrip. */
  backLabel?: string;
  onBack?: () => void;
}) {
  // Hoogte van de kop in zijn UITGEKLAPTE stand. We meten één keer en
  // houden de grootste waarde vast: tijdens het inklappen krimpt de kop,
  // en als we die kleinere waarde zouden overnemen springt de inhoud.
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerHeight, minHeight: "100%" }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: PAGE_MAX,
            alignSelf: "center",
            ...(gutter ? { paddingHorizontal: wide ? 24 : 16 } : null),
            ...contentStyle,
          }}
        >
          {children}
        </View>
      </ScrollView>

      {/* De kop. Absoluut verankerd, dus altijd bovenaan het scherm. */}
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setHeaderHeight((prev) => (h > prev ? h : prev));
        }}
      >
        <AppChrome
          wide={wide}
          progress={progress}
          announcement={announcement}
          backLabel={backLabel}
          onBack={onBack}
        />
      </View>
    </View>
  );
}
