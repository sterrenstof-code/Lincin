import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { usePathname, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";

import { useQuery } from "@tanstack/react-query";

import { ActionSheet } from "@/components/ActionSheet";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Avatar } from "@/components/Avatar";
import { LogoMark } from "@/components/LogoMark";
import { useAuth } from "@/lib/auth/provider";
import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { getProfiles } from "@/lib/api/profiles";
import { chromeTag } from "@/lib/hero-transition";
import {
  announce,
  announceDeep,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  gutter as gutterFor,
  sheetWidth,
  space,
} from "@/lib/design/type";

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
 * Waar de kop precies hangt — sticky ín de scroller op web, absoluut
 * verankerd op native — staat in PageScroll, met de reden erbij.
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
 * De kop blijft bovenaan staan terwijl de pagina eronder doorloopt. Alles
 * wat zichzelf óók bovenaan vastzet — de zijbalk van de feed, de
 * schakelbalk, het beeld van een tweeluik — moet daaronder beginnen,
 * anders schuift het achter de kop weg. Vandaar dat deze maat geëxporteerd
 * wordt in plaats van dat elke pagina hem raadt.
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
/**
 * Vanaf welke *balkbreedte* de tabbladen hun woord mogen dragen.
 *
 * Opgebouwd en niet geraden: vijf labels vragen bij elkaar zo'n 330 punten
 * inclusief hun padding, en het merk, de plus en de avatar samen 153. Dat is
 * 483 om te passen. De drempel ligt honderd hoger, want een omslagpunt hoort
 * niet op het minimum te liggen maar op de eerste breedte waar het er ook
 * goed uitziet — op precies passend staan de woorden tegen hun
 * scheidingslijnen, en dat was de klacht.
 */
const LABELS_NEED_WIDTH = 540;

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
 * Het getal zelf: een vlamvlak met het aantal erin.
 *
 * Drie dingen die niet klopten, en maar één ervan was vorm.
 *
 * KLEUR. Wit op `flame` haalt 4.10:1 in de lichte stand en 4.31:1 in de
 * donkere — allebei onder de 4.5 die tekst van deze maat hoort te halen.
 * Op `flameDeep` is het 6.24:1 en 7.39:1. Een badge die je moet kunnen
 * lézen is het hele punt van een badge.
 *
 * LETTERAFSTAND. Hij erfde `kicker`, en die staat op 1.5 — bedoeld voor
 * kapitalen die moeten ademen. Achter een los cijfer komt die spatie er
 * rechts alsnog bij, waardoor het getal links uit het midden hing. Nu een
 * eigen maat met de afstand op nul.
 *
 * VORM. Een vierkant met een kleine straal in plaats van een scherpe hoek.
 * Geen pil: het blijft een blokje, het is alleen niet meer messcherp op een
 * vlak van 18 bij 18. Bij deze maat is een rechte hoek geen strengheid meer
 * maar ruis.
 */
function TabBadge({ count, floating = false }: { count: number; floating?: boolean }) {
  if (count <= 0) return null;
  const wide = count > 9;
  return (
    <View
      style={{
        backgroundColor: flameDeep,
        height: 18,
        minWidth: 18,
        borderRadius: 5,
        paddingHorizontal: wide ? 5 : 0,
        alignItems: "center",
        justifyContent: "center",
        ...(floating
          ? // Bij iconen is er geen ruimte naast het label, dus hangt hij
            // in de rechterbovenhoek van het icoon.
            { position: "absolute", top: -7, right: -11 }
          : { marginLeft: 7 }),
      }}
    >
      <Text
        style={{
          fontFamily: feedType.kicker.fontFamily,
          fontSize: 11,
          lineHeight: 13,
          fontWeight: "800",
          letterSpacing: 0,
          color: "#FFFFFF",
        }}
      >
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
 * NATIVE klapt met een drempel: voorbij een tiental pixels animeert de kop
 * in één beweging dicht. Dat kan daar, want de kop hangt buiten de scroller
 * en zijn hoogte verandert de bladspiegel niet.
 *
 * WEB kan dat juist níet, en dat was de bug waarbij de kop bij een klein
 * duwtje aan het wiel halverwege bleef staan: daar ligt de kop ín de
 * scroller. Klapte hij dicht, dan werd de pagina driehonderd pixels korter,
 * en dan schuift Chrome de scrollpositie mee om de inhoud stil te houden
 * (scroll anchoring). Die verschuiving zette de teller weer ónder de
 * drempel, de kop ging open, de pagina werd weer langer, en zo bleven de
 * twee elkaar duwen. PageScroll leidt de stand daarom rechtstreeks af uit
 * de scrollpositie: één waarde per positie, dus er valt niets te
 * oscilleren. Zie PageScroll.
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
      // Op web zet PageScroll de stand rechtstreeks uit de scrollpositie —
      // zie daar waarom een drempel met een animatie daar niet kan.
      if (Platform.OS === "web") return;
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
  wide = true,
}: {
  message?: string | null;
  onPress?: () => void;
  /** Voor de bladspiegel; zie hieronder. */
  wide?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (!message || dismissed) return null;

  return (
    <View
      style={{
        /**
         * Ook deze strook staat op de bladspiegel.
         *
         * Hij liep van vensterrand tot vensterrand terwijl de kop eronder
         * bij 1250 ophield — en juist omdat hij fel oranje is, was hij het
         * eerste wat je zag afwijken. Een blad heeft één kolom; een strook
         * die daarbuiten valt hoort bij een andere pagina.
         */
        width: "100%",
        maxWidth: sheetWidth(wide),
        alignSelf: "center",
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
 * De rij tabbladen — één component voor allebei de standen van de kop.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER ÉÉN IS
 * ---------------------------------------------------------------
 * Het waren er twee: `CompactBar` had een rij met een icoon-terugval voor
 * smalle schermen, `FullHeader` had een eigen rij die altijd tekst toonde.
 * Op een telefoon perste die tweede vijf labels in zo'n 380 punten — vijftig
 * per tabblad — en de woorden stonden tegen hun scheidingslijnen.
 *
 * Het venijnige eraan: drie keer achter elkaar is de compacte balk verbeterd
 * terwijl de klacht over de andere ging. Twee rijen die hetzelfde moeten
 * zeggen lopen uiteen, en dan repareer je de verkeerde.
 *
 * ---------------------------------------------------------------
 * WAAROM HIJ ZICHZELF MEET
 * ---------------------------------------------------------------
 * Niet het venster: de kop staat in een kolom die op 1250 wordt afgekapt en
 * heeft marges, dus bij een venster van 1600 is de rij 1218 breed. Een
 * drempel op de venstermaat beslist op een getal dat de rij nooit krijgt, en
 * schuift stilletjes mee met elke wijziging aan de bladspiegel.
 *
 * Zolang de meting nog niet binnen is: iconen. Die passen altijd, dus het
 * ergste geval is één frame met iconen — nooit tekst die buiten de rij valt.
 */
function TabStrip({ tone }: { tone: "dark" | "paper" }) {
  const router = useRouter();
  const pathname = usePathname();
  const badges = useTabBadges();
  const [stripWidth, setStripWidth] = useState(0);
  const iconOnly = stripWidth === 0 || stripWidth < LABELS_NEED_WIDTH;

  const onDark = tone === "dark";
  const idle = onDark ? "rgba(250,248,245,0.78)" : feed.ink;
  const onActive = onDark ? feed.ink : feed.lav;
  const activeBg = onDark ? "#FAF8F5" : feed.ink;

  return (
    <View
      style={{ flex: 1, flexDirection: "row" }}
      onLayout={(e) => setStripWidth(e.nativeEvent.layout.width)}
    >
      {TABS.map((tab, i) => {
        const active = pathname === tab.href;
        const badge = badges[tab.href] ?? 0;
        return (
          <Pressable
            key={tab.href}
            onPress={() => {
              if (!active) router.push(tab.href);
            }}
            accessibilityLabel={tab.label}
            style={{
              // Altijd de breedte delen. Zonder dit sizen de cellen naar hun
              // inhoud en duwen ze elkaar buiten de rij zodra één woord
              // langer is dan verwacht.
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: onDark ? 0 : 12,
              paddingHorizontal: iconOnly ? 0 : 8,
              backgroundColor: active ? activeBg : "transparent",
              ...(onDark
                ? null
                : {
                    borderRightWidth: FEED_BORDER,
                    borderRightColor: i < TABS.length - 1 ? feed.ink : "transparent",
                  }),
            }}
          >
            {iconOnly ? (
              <View>
                <Ionicons name={tab.icon} size={19} color={active ? onActive : idle} />
                <TabBadge count={badge} floating />
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", minWidth: 0 }}>
                <Text
                  style={[
                    feedType.label,
                    { fontSize: 12, color: active ? onActive : idle, flexShrink: 1 },
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
  );
}

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

  /**
   * De balk meet zichzelf, niet het venster.
   *
   * Hier stond `useWindowDimensions()`, en dat is een ander getal dan wat er
   * te verdelen valt: de balk staat in een kolom die op 1250 afgekapt wordt
   * en heeft marges. Bij een venster van 1600 punten is de balk 1218 breed —
   * bijna 400 punten verschil. De drempel besliste dus op een maat die de
   * balk nooit krijgt, en elke verandering aan de bladspiegel verschoof hem
   * stilletjes mee.
   *
   * `onLayout` geeft de werkelijke breedte. Tot de eerste meting binnen is
   * tonen we iconen: die passen altijd, dus een verkeerde eerste render is
   * hoogstens een frame met iconen — nooit tekst die buiten de balk valt.
   */
  const [barWidth, setBarWidth] = useState(0);
  const iconOnly = barWidth === 0 || barWidth < LABELS_NEED_WIDTH;

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
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
      {/**
        * Geen merkcel meer.
        *
        * Het teken linksboven ging naar de feed, en het eerste tabblad ook.
        * Twee cellen naast elkaar die hetzelfde doen is geen keuze maar een
        * aarzeling — je kijkt welke van de twee je moet hebben en er is geen
        * antwoord. De tabbladen zijn de navigatie; het merk had daar niets
        * toe te voegen behalve een cel in een balk die het krap had.
        *
        * Waar het merk wél hoort staat het al: groot, in het zwarte blok
        * bovenaan de feed.
        */}

      {/* Op een detailpagina vervangt de terug-knop de navigatie. */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityLabel={backLabel ?? "Terug"}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            justifyContent: "flex-start",
            paddingHorizontal: iconOnly ? 12 : 16,
          }}
        >
          {/* De pijl als icoon en niet als teken in de tekst: zo blijft hij
              staan wanneer het label wegvalt, en houdt hij zijn maat los van
              de letterhoogte. */}
          <Ionicons name="arrow-back" size={19} color="#FAF8F5" />
          <Text
            style={[feedType.label, { fontSize: 12, color: "#FAF8F5", flexShrink: 1 }]}
            numberOfLines={1}
          >
            {/* Op een smal scherm het korte woord: "Terug naar de feed" duwt
                de actieknop ernaast weg zodra het scherm onder de 400 komt. */}
            {iconOnly ? "Terug" : (backLabel ?? "Terug")}
          </Text>
        </Pressable>
      ) : (
        <TabStrip tone="dark" />
      )}

      {actionLabel && onAction ? (
        <>
          <Cut tone="dark" />
          <Pressable
            onPress={onAction}
            style={({ pressed }) => ({
              justifyContent: "center",
              paddingHorizontal: 18,
              backgroundColor: pressed ? announceDeep : announce,
            })}
          >
            <Text
              style={[feedType.label, { fontSize: 12, fontWeight: "700", color: creamOnDark.DEFAULT }]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        </>
      ) : (
        <AddCell tone="dark" />
      )}

      <PersonalMenu />
    </View>
  );
}

/**
 * De primaire actie, als cel aan het eind van de navigatie.
 *
 * De rubrieken links zijn plekken; deze twee cellen rechts zijn jij en wat
 * jij doet. Ze staan daarom allebei in de oranje: dat is in dit ontwerp de
 * kleur van een knop die iets dóet (DESIGN.md §2), en met twee cellen naast
 * elkaar leest het als één blok in plaats van als twee losse knoppen.
 *
 * De plus verdwijnt zodra een pagina zijn eigen actie meegeeft
 * (`actionLabel` — "Nieuw event", "Nieuwe groep"). Er is er hoogstens één
 * per scherm, anders concurreren twee oranje vlakken om dezelfde vraag.
 */
function AddCell({ tone }: { tone: "dark" | "paper" }) {
  const router = useRouter();
  return (
    <>
      <Cut tone={tone} />
      <Pressable
        onPress={() => router.push("/post-compose")}
        accessibilityLabel="Iets delen"
        style={({ pressed }) => ({
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: space.lg,
          backgroundColor: pressed ? announceDeep : announce,
        })}
      >
        <Ionicons name="add" size={22} color={creamOnDark.DEFAULT} />
      </Pressable>
    </>
  );
}

/**
 * De scheidingslijn tussen twee cellen in de balk.
 *
 * In de zwarte stand kan hij niet de inktlijn van het raster zijn — die
 * zie je niet op zwart — dus is het daar een lichte lijn op een kwart.
 */
function Cut({ tone }: { tone: "dark" | "paper" }) {
  return (
    <View
      style={{
        width: FEED_BORDER,
        backgroundColor: tone === "dark" ? creamOnDark.rule : feed.ink,
      }}
    />
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
function PersonalMenu({ tone = "dark" }: { tone?: "dark" | "paper" }) {
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
      <Cut tone={tone} />
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          justifyContent: "center",
          paddingHorizontal: space.md,
          // Jij bent geen rubriek. De cel staat daarom in dezelfde oranje
          // als de plus ernaast — samen het blok aan het eind van de balk
          // dat over jou gaat in plaats van over de uitgave.
          backgroundColor: pressed ? announceDeep : announce,
        })}
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
                // Inkt en geen flame: rood op oranje zie je niet.
                backgroundColor: feed.ink,
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
        footer={<ThemeSwitch />}
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

  return (
    <View>
      <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>
        {/* De tabstrip is de bovenste rij. Hierboven stond een
            micro-utilityregel met "Lincin" links en "Voor je vrienden."
            rechts; die zei niets dat het woordmerk eronder niet al zegt en
            kostte veertig pixels van een kop die toch al aan de hoge kant
            was. */}
        <View style={{ flexDirection: "row" }}>
          <TabStrip tone="paper" />
          {actionLabel && onAction ? (
            <>
              <Cut tone="paper" />
              <Pressable
                onPress={onAction}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? announceDeep : announce,
                  paddingHorizontal: space.lg,
                  justifyContent: "center",
                })}
              >
                <Text style={[feedType.label, { fontSize: 12, color: creamOnDark.DEFAULT }]}>
                  {actionLabel}
                </Text>
              </Pressable>
            </>
          ) : (
            <AddCell tone="paper" />
          )}

          {/* Jij, aan het eind van de navigatie — in beide standen van de
              kop op dezelfde plek. De zijbalk had hetzelfde blok nog een
              keer; zie feed.tsx voor waarom dat weg is. */}
          <PersonalMenu tone="paper" />
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

/**
 * De kolom waar de kopbalk in staat — op élke pagina dezelfde.
 *
 * Hij hing eerder aan wat de aanroeper toevallig meegaf, en nam daardoor
 * per scherm een andere breedte én positie aan: smal op een vondst, van
 * rand tot rand op de feed. Dat maakt van elke navigatie een sprong, en
 * dan voelt het als losse schermen in plaats van één blad waar de inhoud
 * onder de kop door schuift.
 *
 * Dezelfde maat als `Sheet`, dus de balk staat precies boven de kolom die
 * eronder begint. En geen prop meer: dit is niets waar een pagina iets
 * over te zeggen hoort te hebben.
 */
const CHROME_COLUMN = (wide: boolean) =>
  ({
    width: "100%",
    maxWidth: sheetWidth(wide),
    alignSelf: "center",
  }) as const;

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
   * De kop is één ding dat een navigatie overleeft.
   *
   * Zonder naam zit hij in `root` en wordt hij samen met de hele pagina
   * over-gefade: elke wissel voelt dan als een ander scherm in plaats van
   * als dezelfde pagina waar de inhoud onder de kop door schuift. Met een
   * naam morpht de browser de ene stand naar de andere.
   *
   * `useIsFocused` is geen netheid maar noodzaak: een navigator houdt
   * schermen gemount, en twee elementen met dezelfde naam tegelijk in beeld
   * laat de browser de héle overgang overslaan. Alleen het scherm dat je
   * aankijkt draagt hem. Zie `chromeTag` in lib/hero-transition.web.ts —
   * die stond er al, maar werd nergens aangeroepen, waardoor de keyframes
   * voor `lincin-chrome` in +html.tsx dode letter waren.
   */
  const focused = useIsFocused();
  const chromeMorph = chromeTag(focused);

  /**
   * De volle breedte, gemeten in plaats van geraden: een Animated-
   * interpolatie kan geen "100%" naar een getal animeren — begin- en
   * eindwaarde moeten hetzelfde type zijn.
   *
   * Zonder max: eerder hield deze waarde de gróótste breedte vast die hij
   * ooit gezien had. Maakte je het venster smaller, dan bleef de kop op de
   * oude maat staan en liep de laatste tab buiten beeld.
   */
  const [fullWidth, setFullWidth] = useState(0);
  /** Hoogte van de grote stand; gemeten zodat de kruisvervaging klopt. */
  const [stackHeight, setStackHeight] = useState(0);
  /**
   * Alleen als de balk er echt staat mag hij muisklikken opvangen. Hij ligt
   * over de onderste strook van de grote stand; onzichtbaar moet hij die
   * dus laten passeren.
   */
  const [barActive, setBarActive] = useState(false);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      const next = value > 0.6;
      setBarActive((prev) => (prev === next ? prev : next));
    });
    return () => progress.removeListener(id);
  }, [progress]);

  // In de compacte modus staat alles vast: geen interpolaties, geen
  // gemeten hoogtes die nog moeten binnenkomen.
  if (compact) {
    return (
      <View
        style={{
          paddingHorizontal: gutterFor(wide),
          paddingTop: space.sm,
          paddingBottom: space.sm,
          ...chromeMorph,
        }}
      >
        <View style={CHROME_COLUMN(wide)}>
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

  const barOpacity = progress.interpolate({
    inputRange: [0.55, 1],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // ---------------------------------------------------------------
  // WEB — vaste hoogte, de balk als laag over de onderste strook
  // ---------------------------------------------------------------
  //
  // De kop ligt hier ín de scroller (zie PageScroll). Dan mag zijn hoogte
  // níet meebewegen met de inklapstand: elke pixel die hij krimpt, springt
  // de pagina eronder omhoog, en dat duwt de scrollpositie terug — de lus
  // waarbij de kop halverwege bleef hangen.
  //
  // Dus: de grote stand houdt altijd zijn eigen hoogte en scrolt gewoon weg,
  // zoals elk ander blok op de pagina. De compacte balk ligt als laag op de
  // onderste `CHROME_COMPACT_H` pixels en komt op tijdens het wegscrollen.
  // Precies die strook blijft plakken — PageScroll hangt de kop op met
  // `top: -(hoogte - CHROME_COMPACT_H)`, zodat er onderaan exact de balk
  // overblijft. Geen animatie van hoogtes, geen sprong, niets om tegen te
  // duwen.
  if (Platform.OS === "web") {
    return (
      <View style={chromeMorph}>
        <AnnouncementBar message={announcement} onPress={onAnnouncementPress} wide={wide} />

        <View
          style={{
            width: "100%",
            paddingHorizontal: gutterFor(wide),
            paddingTop: space.sm,
            paddingBottom: space.sm,
            alignItems: "flex-start",
          }}
        >
          <View style={CHROME_COLUMN(wide)}>
            <FullHeader wide={wide} actionLabel={actionLabel} onAction={onAction} />
          </View>
        </View>

        <Animated.View
          pointerEvents={barActive ? "auto" : "none"}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: CHROME_COMPACT_H,
            paddingHorizontal: gutterFor(wide),
            paddingTop: space.sm,
            paddingBottom: space.sm,
            backgroundColor: feed.lav,
            opacity: barOpacity,
          }}
        >
          <View style={CHROME_COLUMN(wide)}>
            <CompactBar
              backLabel={backLabel}
              onBack={onBack}
              actionLabel={actionLabel}
              onAction={onAction}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  // ---------------------------------------------------------------
  // NATIVE — de twee standen vouwen open en dicht
  // ---------------------------------------------------------------
  // Hier hangt de kop buiten de scroller, met opvulling eronder die op de
  // grootste gemeten hoogte blijft staan. Zijn hoogte raakt de bladspiegel
  // dus niet, en kan wél animeren.

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

  return (
    <View style={chromeMorph}>
      <Animated.View
        style={{ height: bannerHeight, opacity: bannerOpacity, overflow: "hidden" }}
      >
        <AnnouncementBar message={announcement} onPress={onAnnouncementPress} wide={wide} />
      </Animated.View>

      <Animated.View
        style={{
          width: "100%",
          paddingHorizontal: gutterFor(wide),
          paddingTop: space.sm,
          paddingBottom: space.sm,
          alignItems: "flex-start",
        }}
        onLayout={(e) => setFullWidth(e.nativeEvent.layout.width - (wide ? 48 : 32))}
      >
        <Animated.View style={[CHROME_COLUMN(wide), { width: shellWidth ?? "100%" }]}>
          {/* Grote stand */}
          <Animated.View
            style={{ height: stackH, opacity: stackOpacity, overflow: "hidden" }}
          >
            <View onLayout={(e) => setStackHeight(e.nativeEvent.layout.height)}>
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
 * ---------------------------------------------------------------
 * TWEE MANIEREN OM DE KOP BOVEN TE HOUDEN
 * ---------------------------------------------------------------
 * WEB      de kop is het eerste kind ín de scroller, met CSS
 *          `position: sticky`.
 * NATIVE   de kop staat buiten de scroller, absoluut verankerd, en de
 *          inhoud krijgt bovenaan evenveel opvulling als hij hoog is.
 *
 * Die opvulling meten we met `onLayout` in plaats van hem te hardcoderen:
 * hij verschilt per breedte, per stand en met het al dan niet tonen van de
 * aankondigingsbalk.
 *
 * Waarom web een eigen weg gaat — twee dingen die de verankerde versie
 * daar stukmaakten:
 *
 *   1. Een absoluut element vangt het muiswiel. De kop is zelf niet
 *      scrollbaar en is géén kind van de scroller, dus een wiel-event
 *      erboven ging nergens heen: met de cursor op de kop kon je de pagina
 *      niet scrollen. Ligt de kop ín de scroller, dan hoort het wiel bij
 *      dezelfde container en werkt het overal.
 *   2. De inhoud schoof zichtbaar achter de kop langs. De kop is een balk
 *      met lucht eromheen; door die lucht zag je de pagina doorlopen. Een
 *      dekkend vlak lost dat op — zie `backgroundColor` hieronder — maar
 *      alleen bij sticky staat de kop ook echt ín de bladspiegel in plaats
 *      van erboven te zweven.
 *
 * Let op: dit is niet `stickyHeaderIndices`. Die prop pakt op
 * react-native-web 0.21 niet betrouwbaar (de kop scrolde gewoon weg); de
 * CSS-eigenschap zelf werkt er prima, en wordt in dit scherm ook al
 * gebruikt voor de zijbalk en de schakelbalk van de feed.
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
  underChrome = false,
  scrollRef,
}: {
  children: React.ReactNode;
  wide: boolean;
  progress: Animated.Value;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  /**
   * Toegang tot de scroller zelf, voor een pagina die hem wil aansturen —
   * bijvoorbeeld een knop die terugspringt naar boven. Optioneel: wie hem
   * niet meegeeft merkt er niets van.
   */
  scrollRef?: React.RefObject<ScrollView | null>;
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
  /**
   * Laat de inhoud ónder de kop door lopen in plaats van eronder te
   * beginnen.
   *
   * Voor een pagina die met een volle plaat begint: die hoort tot de
   * bovenrand van het venster te lopen, met de balk erover, en niet pas
   * onder een strook paginavlak te starten. Zolang je bovenaan staat is
   * het vlak rond de balk daarom doorzichtig; zodra je scrolt komt het
   * op, want dan schuift er tekst onderdoor.
   */
  underChrome?: boolean;
}) {
  const [headerHeight, setHeaderHeight] = useState(0);
  /**
   * Web meet apart, en zonder max: hier moet de hóógte van nu kloppen,
   * want hij bepaalt op welke hoogte de kop blijft plakken.
   */
  const [webHeaderHeight, setWebHeaderHeight] = useState(0);
  /**
   * Alleen de kop van het scherm dat je aankijkt draagt de naam van het
   * gedeelde element. Een navigator houdt schermen gemount, en twee
   * elementen met dezelfde `view-transition-name` tegelijk in beeld laat de
   * browser de hele overgang overslaan.
   */
  const focused = useIsFocused();
  const sticky = Platform.OS === "web";

  /**
   * Hoeveel er weg te scrollen valt voor de kop op zijn balk staat. De
   * stand van de kop is een rechtstreekse functie van de scrollpositie —
   * geen drempel, geen animatie, geen geheugen. Daardoor is er ook niets
   * dat zichzelf kan opjagen: bij elke positie hoort één stand, en scroll
   * anchoring kan hooguit een andere positie kiezen, geen andere lus.
   */
  const collapseRange = Math.max(1, webHeaderHeight - CHROME_COMPACT_H);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (sticky) {
        const y = e.nativeEvent.contentOffset.y;
        progress.setValue(Math.min(1, Math.max(0, y / collapseRange)));
      }
      onScroll(e);
    },
    [sticky, collapseRange, progress, onScroll]
  );

  const chrome = (
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
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: sticky || underChrome ? 0 : headerHeight,
          minHeight: "100%",
        }}
        // Chrome verschuift de scrollpositie uit zichzelf zodra iets bóven
        // de kijkhoogte van maat verandert. Dat is bedoeld als vriendelijk-
        // heid, maar boven in deze scroller hangt een kop die van maat
        // verandert, en dan gaat het tellen tegen zichzelf werken.
        style={sticky ? ({ overflowAnchor: "none" } as any) : undefined}
      >
        {sticky ? (
          <Animated.View
            onLayout={(e) => setWebHeaderHeight(e.nativeEvent.layout.height)}
            style={{
              // Dekkend: een sticky kop blijft staan terwijl de pagina
              // eronder doorloopt, en zonder vlak zie je die inhoud door
              // de lucht rond de balk heen schuiven.
              /**
               * Loopt de inhoud eronder door, dan blijft het vlak rond de
               * balk doorzichtig — ook tijdens het scrollen. Het kwam
               * eerder op zodra je bewoog, en dan schoof er ineens een
               * lavendel strook over de foto die er net nog niet was. De
               * balk zelf is dekkend; dat is genoeg om hem te kunnen lezen.
               */
              backgroundColor: underChrome ? "transparent" : feed.lav,
              // Negatieve `top`: de kop scrolt mee tot alleen zijn onderste
              // strook — de compacte balk — nog boven staat, en blijft daar
              // hangen. Dat is wat een collapsing header hoort te doen, en
              // het gebeurt hier in de opmaak zelf: geen hoogte die
              // animeert, dus ook geen pagina die eronder wegspringt.
              ...({
                position: "sticky",
                top: -Math.max(0, webHeaderHeight - CHROME_COMPACT_H),
                zIndex: 20,
              } as any),
              ...chromeTag(focused),
            }}
          >
            {chrome}
          </Animated.View>
        ) : null}

        {/**
          * De marge staat búiten de bladspiegel, niet erin.
          *
          * Dit was één vak: `maxWidth: sheetWidth` mét `paddingHorizontal`
          * erin. De kop doet het andersom — marge buiten, kolom van 1250
          * daarbinnen (zie CHROME_COLUMN hierboven) — en op een breed scherm
          * scheelde dat precies één gutter: de kop begon 24 punten links van
          * zijn eigen pagina. Dat is de val die DESIGN.md §4b beschrijft, en
          * hij zat in de scroller zelf, dus op élke pagina die hem gebruikt.
          *
          * Nu is de opbouw op beide plekken dezelfde: `gutter()` is de
          * afstand tot de vensterrand, `sheetWidth()` is het blad daarbinnen.
          */}
        <View
          style={{
            width: "100%",
            ...(gutter ? { paddingHorizontal: gutterFor(wide) } : null),
          }}
        >
          <View
            style={{
              width: "100%",
              /**
               * Dezelfde bladspiegel als de kopbalk erboven.
               *
               * Stond op `alignSelf: "stretch"` zonder maximum: de kop hield
               * zich netjes aan 1250, de inhoud eronder liep door tot de
               * vensterrand. Twee maten op één pagina, en dan zweeft die kop
               * er alleen maar boven in plaats van erbij te horen.
               *
               * Het hoort hier en niet in elk scherm apart — negen pagina's
               * gebruiken deze scroller, en negen keer hetzelfde getal
               * overtypen is negen kansen om er één te vergeten.
               */
              maxWidth: sheetWidth(wide),
              alignSelf: "center",
              // Onder de kop door: precies zijn hoogte terug, zodat de plaat
              // aan de bovenrand van het venster begint.
              ...(underChrome && sticky ? { marginTop: -webHeaderHeight } : null),
              ...contentStyle,
            }}
          >
            {children}
          </View>
        </View>
      </ScrollView>

      {sticky ? null : (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: underChrome ? "transparent" : feed.lav,
            ...chromeTag(focused),
          }}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            setHeaderHeight((prev) => (h > prev ? h : prev));
          }}
        >
          {chrome}
        </View>
      )}
    </View>
  );
}
