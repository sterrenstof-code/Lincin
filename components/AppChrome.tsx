import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";

import { useQuery } from "@tanstack/react-query";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { LogoMark } from "@/components/LogoMark";
import { useAuth } from "@/lib/auth/provider";
import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { getProfiles } from "@/lib/api/profiles";
import { chromeTag } from "@/lib/hero-transition";
import { announce, feed, FEED_BORDER, feedType, flame, flameDeep } from "@/lib/design/type";

/**
 * De chrome die boven élke pagina staat.
 *
 * Er zijn **twee standen**, en ze zijn bewust verschillend van vorm — niet
 * dezelfde kop die alleen krimpt:
 *
 *   GROOT     aankondigingsbalk · micro-utilityregel · tabstrip ·
 *             taglinekop · brede woordmerk-plaat
 *   COMPACT   één zwarte balk: klein LINCIN links, de navigatie erín,
 *             en rechts de primaire actie
 *
 * De grote stand hoort bij **de thuispagina** (`/feed`) en nergens anders.
 * Daar is het merk het onderwerp; op elke andere pagina is het onderwerp de
 * pagina zelf, en dan is een affiche van drie rijen boven de inhoud alleen
 * maar ruimte die je van het onderwerp afpakt. Op de feed klapt hij bij het
 * scrollen alsnog dicht naar de compacte balk; alle andere pagina's — de
 * andere tabbladen én de detailpagina's — geven `compact` mee en beginnen
 * én blijven in de balk.
 *
 * Wat hier niet meer **uitgeschreven** staat: alles wat over jou gaat.
 * Meldingen, instellingen, je profiel, iets delen stonden eerder als losse
 * regels en tabs in de kop; ze wonen nu in het persoonlijke blok van de
 * zijbalk (`FeedRail`), en zitten in de balk opgevouwen achter je avatar
 * rechts (`PersonalMenu`). De kop navigeert tussen de rubrieken van de
 * uitgave — die zijn voor iedereen hetzelfde; je meldingen zijn dat niet.
 *
 * De tabs dragen wél een teller, maar alleen waar die eerlijk is: zie
 * `useTabBadges`.
 *
 * Beide standen dragen op web dezelfde `view-transition-name` (zie
 * `chromeTag`). Bij een navigatie morpht de browser de ene kop dus naar de
 * andere, net zoals hij dat met een hero-beeld doet: de grote kop krimpt
 * naar de balk in plaats van eronder weg te vallen.
 *
 * De chrome staat BUITEN de scrollende inhoud van een scherm; zie PageScroll.
 */

/**
 * De bladspiegel loopt tot de schermrand. Er is bewust geen maximum meer:
 * dit ontwerp is een affiche, geen leeskolom, en een cap van 1280 liet op
 * een breed scherm alleen lavendel goot over. Losse tekstblokken houden hun
 * eigen leesmaat via `maxWidth` op de tekst zelf — daar hoort regellengte.
 */
export const PAGE_MAX: number | undefined = undefined;

/** Hoogte van de compacte balk. */
const BAR_H = 58;

/**
 * Hoeveel de kop van boven inneemt zodra hij ingeklapt is: de balk plus
 * de opvulling eromheen (`paddingTop: 10`, `paddingBottom: 8`).
 *
 * De kop is absoluut verankerd en zweeft dus over de inhoud. Alles wat
 * zichzelf óók bovenaan vastzet — een `position: sticky` zijbalk op web —
 * moet daaronder beginnen, anders schuift het eronder weg. Vandaar dat
 * deze maat geëxporteerd wordt in plaats van dat elke pagina hem raadt.
 */
export const CHROME_COMPACT_H = BAR_H + 18;

/** De échte routes uit `app/(app)/_layout.tsx` — geen verzonnen navigatie. */
// `as const satisfies`: de literals blijven behouden (nodig als React-key
// én voor de gegenereerde route-types), en `satisfies` bewaakt dat elke
// href een bestaande route is. Met een kale `Href`-annotatie zou het type
// de object-vorm meenemen, en die kan geen key zijn.
const TABS = [
  { href: "/feed", label: "Feed", icon: "newspaper-outline" },
  { href: "/events", label: "Events", icon: "sparkles-outline" },
  { href: "/chats", label: "Chats", icon: "chatbubble-outline" },
  { href: "/friends", label: "Vrienden", icon: "people-outline" },
  { href: "/profile", label: "Profiel", icon: "person-outline" },
] as const satisfies readonly {
  href: Href;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[];

/**
 * Onder deze breedte krijgt de compacte balk iconen in plaats van woorden.
 *
 * Dit is geen smaakkwestie: de balk is de énige navigatie in de app (de
 * Tabs-navigator tekent bewust geen tweede rij onderaan), en vijf woorden
 * plus het merk plus een actieknop passen op een telefoon niet naast elkaar.
 * Ze werden dan stilletjes weggeknipt door de `overflow: hidden` van de
 * balk — navigatie die er niet is, zonder dat iets dat meldt.
 *
 * De grens ligt lager dan het `wide`-breekpunt (900): op een tablet is er
 * ruimte zat voor de woorden, en woorden lezen beter dan iconen.
 */
const ICON_ONLY_MAX_WIDTH = 560;

// ---------------------------------------------------------------
// Tellers per tabblad
// ---------------------------------------------------------------

/**
 * Hoeveel er op elk tabblad op je ligt te wachten.
 *
 * Alleen tabbladen met een **eerlijke** teller staan hierin. Voor Chats is
 * dat het aantal ongelezen berichten, voor Vrienden het aantal inkomende
 * verzoeken: allebei een concreet ding dat op jou wacht en dat verdwijnt
 * zodra je het bekeken hebt.
 *
 * Feed, Events en Profiel krijgen bewust géén getal. Er is voor die drie
 * geen bron die "nieuw voor jou" betekent — je zou iets moeten verzinnen
 * (posts sinds je laatste bezoek, events die je nog niet opende), en een
 * badge die niet klopt leert je hem te negeren. Komt er later een echte
 * bron, dan is dit de plek: één getal erbij in deze map.
 *
 * De sleutels zijn exact die van `app/(app)/_layout.tsx`, dus react-query
 * dedupliceert; deze hook kost geen extra verzoek per pagina.
 */
function useTabBadges(): Partial<Record<string, number>> {
  const { session } = useAuth();
  const myUserId = session?.user.id;

  const chats = useQuery({
    queryKey: ["chats", myUserId ?? "anon"],
    queryFn: () => listMyChats(myUserId!),
    enabled: !!myUserId,
  });
  const friendships = useQuery({
    queryKey: ["friendships", myUserId ?? "anon"],
    queryFn: () => listMyFriendships(myUserId!),
    enabled: !!myUserId,
  });

  const unreadChats = (chats.data ?? []).reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0
  );
  const incomingRequests = (friendships.data ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === myUserId
  ).length;

  return { "/chats": unreadChats, "/friends": incomingRequests };
}

/**
 * Het getal zelf: een vlamvlak met het aantal erin. Vierkant, zoals al het
 * andere in dit systeem — geen pil.
 */
function TabBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        backgroundColor: flame,
        paddingHorizontal: 4,
        minWidth: 16,
        alignItems: "center",
        justifyContent: "center",
        ...(floating
          ? // Bij iconen is er geen ruimte naast het label, dus hangt hij
            // in de rechterbovenhoek van het icoon.
            { position: "absolute", top: -6, right: -10, paddingVertical: 1 }
          : { marginLeft: 6, paddingVertical: 1 }),
      }}
    >
      <Text style={[feedType.kicker, { color: "#FFFFFF", letterSpacing: 0.2 }]}>
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------
// Scrollpositie → inklapstand
// ---------------------------------------------------------------

/**
 * Levert `progress` (0 = groot, 1 = compact) plus de scroll-props voor de
 * scroller van het scherm.
 *
 * De kop klapt **meteen** in — na een tiental pixels — en gaat pas weer open
 * als je helemaal terug bovenaan bent. De eerdere drempel van 100vh maakte
 * dat je op korte pagina's de compacte stand nooit te zien kreeg.
 *
 * `useNativeDriver` staat uit omdat we hoogtes animeren; dat kan de native
 * driver niet.
 */
export function useChromeScroll() {
  const progress = useRef(new Animated.Value(0)).current;
  const collapsed = useRef(false);
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
 * De oranje balk bovenaan — de énige plek waar het warme oranje
 * (`announce`) nog voorkomt. Alle andere accenten staan in het rood
 * (`flame`). Twee tokennamen, zodat een zoek-vervang op het rood deze balk
 * niet meeneemt.
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
// De compacte balk
// ---------------------------------------------------------------

/**
 * Alles in één zwarte balk: klein LINCIN links, de paginanavigatie erín,
 * rechts de primaire actie.
 *
 * De navigatie staat hier ín de plaat en niet erboven — dat is precies het
 * verschil met de grote stand, waar de tabstrip een eigen lavendel rij is.
 * Zo blijft de compacte kop één ding in plaats van twee gestapelde balkjes.
 */
function CompactBar({
  backLabel,
  onBack,
  actionLabel,
  onAction,
}: {
  backLabel?: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const iconOnly = width < ICON_ONLY_MAX_WIDTH;
  const badges = useTabBadges();

  return (
    <View
      style={{
        height: BAR_H,
        flexDirection: "row",
        alignItems: "stretch",
        backgroundColor: "#17181B",
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        overflow: "hidden",
      }}
    >
      {/* Het merk, klein. */}
      <Pressable
        onPress={() => router.push("/feed")}
        style={{ justifyContent: "center", paddingHorizontal: iconOnly ? 12 : 16 }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: feedType.hero.fontFamily,
            fontWeight: "900",
            fontSize: 19,
            letterSpacing: -0.4,
            color: "#FAF8F5",
            transform: [{ scaleX: 0.84 }],
          }}
        >
          LINCIN
        </Text>
      </Pressable>

      <View style={{ width: FEED_BORDER, backgroundColor: "rgba(250,248,245,0.25)" }} />

      {/* Op een detailpagina vervangt de terug-knop de navigatie. */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16 }}
        >
          <Text style={[feedType.label, { fontSize: 12, color: "#FAF8F5" }]} numberOfLines={1}>
            {`← ${backLabel ?? "Terug"}`}
          </Text>
        </Pressable>
      ) : (
        <View style={{ flex: 1, flexDirection: "row" }}>
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            const badge = badges[tab.href] ?? 0;
            return (
              <Pressable
                key={tab.href}
                onPress={() => {
                  if (!active) router.push(tab.href);
                }}
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  // Op een telefoon deelt de rij de breedte; met vaste
                  // padding viel het laatste tabblad buiten de balk.
                  ...(iconOnly ? { flex: 1 } : { paddingHorizontal: 16 }),
                  // De actieve pagina keert om binnen de zwarte balk.
                  backgroundColor: active ? "#FAF8F5" : "transparent",
                }}
              >
                {iconOnly ? (
                  <View>
                    <Ionicons
                      name={tab.icon}
                      size={19}
                      color={active ? feed.ink : "rgba(250,248,245,0.78)"}
                    />
                    <TabBadge count={badge} floating />
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                      style={[
                        feedType.label,
                        { fontSize: 12, color: active ? feed.ink : "rgba(250,248,245,0.78)" },
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                    <TabBadge count={badge} />
                  </View>
                )}
              </Pressable>
            );
          })}

        </View>
      )}

      <PersonalMenu />

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({
            justifyContent: "center",
            paddingHorizontal: 18,
            backgroundColor: pressed ? flameDeep : "#E63329",
          })}
        >
          <Text style={[feedType.label, { fontSize: 12, fontWeight: "700", color: "#FFFFFF" }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------
// Het persoonlijke blok, als ingang in de balk
// ---------------------------------------------------------------

/**
 * Je avatar rechts in de balk; aantikken opent het persoonlijke blok.
 *
 * Het blok zelf woont in de zijbalk van de feed (`FeedRail`) — daar staat
 * het open en uitgeschreven, want daar is ruimte. Op elke andere pagina is
 * die zijbalk er niet, en dan zou je voor je meldingen eerst terug naar de
 * thuispagina moeten. Deze knop is dezelfde inhoud, opgevouwen tot één
 * avatar: de kop blijft navigatie tussen de rubrieken, en het persoonlijke
 * zit erachter in plaats van ertussen.
 *
 * De stip op de avatar is bewust géén getal. Hoevéél meldingen er liggen
 * is iets voor het blok zelf; hier hoef je alleen te weten óf er iets ligt.
 */
function PersonalMenu() {
  const router = useRouter();
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const [open, setOpen] = useState(false);

  // Dezelfde sleutels als de feed en het (app)-layout gebruiken, dus
  // react-query dedupliceert dit — geen extra verzoek per pagina.
  const me = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: async () => (await getProfiles([myUserId!]))[0] ?? null,
    enabled: !!myUserId,
    staleTime: 5 * 60_000,
  });
  const unread = useQuery({
    queryKey: ["notifications-unread", myUserId],
    queryFn: () => countUnreadNotifications(myUserId!),
    enabled: !!myUserId,
  });

  if (!myUserId) return null;

  const name = me.data?.display_name ?? me.data?.username ?? "Jij";
  const count = unread.data ?? 0;

  return (
    <>
      <View style={{ width: FEED_BORDER, backgroundColor: "rgba(250,248,245,0.25)" }} />
      <Pressable
        onPress={() => setOpen(true)}
        style={{ justifyContent: "center", paddingHorizontal: 12 }}
        accessibilityLabel="Persoonlijk"
      >
        <View>
          <Avatar name={name} avatarUrl={me.data?.avatar_url ?? null} size="sm" />
          {count > 0 ? (
            <View
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 10,
                height: 10,
                backgroundColor: flame,
              }}
            />
          ) : null}
        </View>
      </Pressable>

      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={name}
        actions={[
          {
            label: "Iets delen",
            icon: "add-circle-outline",
            onPress: () => router.push("/post-compose"),
          },
          {
            label: count > 0 ? `Meldingen (${count > 99 ? "99+" : count})` : "Meldingen",
            icon: "notifications-outline",
            onPress: () => router.push("/notifications"),
          },
          {
            label: "Bekijk profiel",
            icon: "person-outline",
            onPress: () => router.push("/profile"),
          },
          {
            label: "Instellingen",
            icon: "settings-outline",
            onPress: () => router.push("/profile-edit"),
          },
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------
// De grote kop
// ---------------------------------------------------------------

function Divider() {
  return <View style={{ height: FEED_BORDER, backgroundColor: feed.ink }} />;
}

function FullHeader({
  wide,
  actionLabel,
  onAction,
}: {
  wide: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const badges = useTabBadges();

  return (
    <View>
      <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>
        {/* Rij A — micro-utility. Hier stond rechts "Instellingen ·
            Meldingen"; dat is persoonlijk en staat nu in het persoonlijke
            blok van de zijbalk, bij je naam en je avatar. Zie FeedRail. */}
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1 }} className="px-3.5 py-2.5">
            <Text style={[feedType.micro, { color: feed.ink, fontSize: 13, fontWeight: "800" }]}>
              Lincin
            </Text>
          </View>
          <View style={{ flex: 1 }} className="px-3.5 py-2.5">
            {wide ? (
              <Text style={[feedType.label, { color: "#3A3540", textAlign: "right" }]}>
                Voor je vrienden.
              </Text>
            ) : null}
          </View>
        </View>

        <Divider />

        {/* Rij B — de tabstrip als eigen rij. */}
        <View style={{ flexDirection: "row" }}>
          {TABS.map((tab, i) => {
            const active = pathname === tab.href;
            const badge = badges[tab.href] ?? 0;
            return (
              <Pressable
                key={tab.href}
                onPress={() => {
                  if (!active) router.push(tab.href);
                }}
                style={{
                  flex: 1,
                  backgroundColor: active ? feed.ink : "transparent",
                  borderRightWidth: FEED_BORDER,
                  borderRightColor: i < TABS.length - 1 ? feed.ink : "transparent",
                }}
                className="py-3 px-2 items-center"
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={[feedType.label, { fontSize: 12, color: active ? feed.lav : feed.ink }]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  <TabBadge count={badge} />
                </View>
              </Pressable>
            );
          })}
          {actionLabel && onAction ? (
            <Pressable
              onPress={onAction}
              style={({ pressed }) => ({
                backgroundColor: pressed ? flameDeep : feed.ink,
                borderLeftWidth: FEED_BORDER,
                borderLeftColor: feed.ink,
                paddingHorizontal: 16,
                justifyContent: "center",
              })}
            >
              <Text style={[feedType.label, { fontSize: 12, color: feed.text }]}>
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Divider />

        {/* Rij C — de taglinekop. */}
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 20,
            paddingBottom: 22,
          }}
        >
          <Text
            style={[
              wide ? feedType.tagline : feedType.taglineSmall,
              { color: feed.ink, maxWidth: 620 },
            ]}
          >
            Ontdekkingen van je vrienden — links, fragmenten, muziek en ideeën.
          </Text>
        </View>
      </View>

      {/* De brede woordmerk-plaat. */}
      <View style={{ marginTop: 12 }}>
        <LogoMark size="plate" />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// Alles samen
// ---------------------------------------------------------------

export function AppChrome({
  wide,
  progress,
  announcement,
  onAnnouncementPress,
  backLabel,
  onBack,
  actionLabel,
  onAction,
  compact = false,
}: {
  wide: boolean;
  progress: Animated.Value;
  announcement?: string | null;
  onAnnouncementPress?: () => void;
  /** Detailpagina: terug-knop i.p.v. de navigatie. */
  backLabel?: string;
  onBack?: () => void;
  /** Primaire actie rechts, bijv. "Iets delen". */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Altijd de compacte balk, ongeacht de scrollstand. Voor detailpagina's:
   * daar hoort het onderwerp bovenaan te staan, niet het merk.
   */
  compact?: boolean;
}) {
  /**
   * De volle breedte, gemeten in plaats van geraden: een Animated-
   * interpolatie kan geen "100%" naar een getal animeren — begin- en
   * eindwaarde moeten hetzelfde type zijn.
   */
  const [fullWidth, setFullWidth] = useState(0);
  /** Hoogte van de grote stand; gemeten zodat de kruisvervaging klopt. */
  const [stackHeight, setStackHeight] = useState(0);

  // In de compacte modus staat alles vast: geen interpolaties, geen
  // gemeten hoogtes die nog moeten binnenkomen.
  if (compact) {
    return (
      <View style={{ paddingHorizontal: wide ? 24 : 16, paddingTop: 10, paddingBottom: 8 }}>
        <View style={{ width: "100%", maxWidth: 900 }}>
          <CompactBar
            backLabel={backLabel}
            onBack={onBack}
            actionLabel={actionLabel}
            onAction={onAction}
          />
        </View>
      </View>
    );
  }

  /** Waar de kop naartoe krimpt: een blok in de linkerbovenhoek. */
  const COMPACT_W = wide ? 900 : 0;
  const targetW = COMPACT_W > 0 && fullWidth > COMPACT_W ? COMPACT_W : fullWidth;
  const shellWidth =
    fullWidth > 0
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [fullWidth, targetW] })
      : undefined;

  const bannerHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const bannerOpacity = progress.interpolate({
    inputRange: [0, 0.4],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // De grote stand vouwt dicht, de balk vouwt open. Ze wisselen elkaar af
  // in plaats van dat de ene in de andere krimpt.
  const stackH = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [stackHeight || 300, 0],
  });
  const stackOpacity = progress.interpolate({
    inputRange: [0, 0.55],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const barH = progress.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_H] });
  const barOpacity = progress.interpolate({
    inputRange: [0.45, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View>
      <Animated.View
        style={{ height: bannerHeight, opacity: bannerOpacity, overflow: "hidden" }}
      >
        <AnnouncementBar message={announcement} onPress={onAnnouncementPress} />
      </Animated.View>

      <Animated.View
        style={{
          width: "100%",
          paddingHorizontal: wide ? 24 : 16,
          paddingTop: 10,
          paddingBottom: 8,
          alignItems: "flex-start",
        }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width - (wide ? 48 : 32);
          setFullWidth((prev) => (w > prev ? w : prev));
        }}
      >
        <Animated.View style={{ width: shellWidth ?? "100%" }}>
          {/* Grote stand */}
          <Animated.View
            style={{ height: stackH, opacity: stackOpacity, overflow: "hidden" }}
          >
            <View
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                setStackHeight((prev) => (h > prev ? h : prev));
              }}
            >
              <FullHeader wide={wide} actionLabel={actionLabel} onAction={onAction} />
            </View>
          </Animated.View>

          {/* Compacte balk */}
          <Animated.View style={{ height: barH, opacity: barOpacity, overflow: "hidden" }}>
            <CompactBar
              backLabel={backLabel}
              onBack={onBack}
              actionLabel={actionLabel}
              onAction={onAction}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------
// De pagina zelf
// ---------------------------------------------------------------

/**
 * De scroller van een heel scherm, met de kop erboven.
 *
 * De kop staat **buiten** de scroller en is absoluut verankerd. Eerder stond
 * hij als eerste kind ín de ScrollView met `stickyHeaderIndices={[0]}`; dat
 * werkt op native, maar op react-native-web 0.21 pakt het niet betrouwbaar
 * en scrolde de kop gewoon weg.
 *
 * De inhoud krijgt bovenaan evenveel opvulling als de kop hoog is. Die
 * hoogte meten we met `onLayout` in plaats van hem te hardcoderen: hij
 * verschilt per breedte, per stand en met het al dan niet tonen van de
 * aankondigingsbalk.
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
  actionLabel,
  onAction,
  compact = false,
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
  backLabel?: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /** Detailpagina: altijd de compacte balk. */
  compact?: boolean;
}) {
  const [headerHeight, setHeaderHeight] = useState(0);
  /**
   * Alleen de kop van het scherm dat je aankijkt draagt de naam van het
   * gedeelde element. Een navigator houdt schermen gemount, en twee
   * elementen met dezelfde `view-transition-name` tegelijk in beeld laat de
   * browser de hele overgang overslaan.
   */
  const focused = useIsFocused();

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
            alignSelf: "stretch",
            ...(gutter ? { paddingHorizontal: wide ? 24 : 16 } : null),
            ...contentStyle,
          }}
        >
          {children}
        </View>
      </ScrollView>

      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, ...chromeTag(focused) }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setHeaderHeight((prev) => (h > prev ? h : prev));
        }}
      >
        <AppChrome
          wide={wide}
          progress={progress}
          announcement={compact ? null : announcement}
          backLabel={backLabel}
          onBack={onBack}
          actionLabel={actionLabel}
          onAction={onAction}
          compact={compact}
        />
      </View>
    </View>
  );
}
