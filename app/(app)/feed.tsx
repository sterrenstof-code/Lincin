import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { ModalShell } from "@/components/ModalShell";
import { CallPlanCard } from "@/components/CallPlanCard";
import { CommentsSection } from "@/components/CommentsSection";
import { IndexGrid } from "@/components/IndexGrid";
import { Meta } from "@/components/Editorial";
import { listMyEvents } from "@/lib/api/events";
import { listMyFriendships } from "@/lib/api/friends";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { EmptyState as SharedEmptyState } from "@/components/EmptyState";
import { EventCard } from "@/components/EventCard";
import { ActivityBand } from "@/components/ActivityBand";
import { ShareButton } from "@/components/FeedChrome";
import { FindHero, FindTile, type TileVariant } from "@/components/FindBody";
import { MemoryCard } from "@/components/MemoryCard";
import { PollCard } from "@/components/PollCard";
import { PostReactions } from "@/components/PostReactions";
import { QueryError } from "@/components/QueryError";
import { SkeletonPostCard } from "@/components/Skeleton";
import { SectionBand } from "@/components/SectionBand";
import { SharedListCard } from "@/components/SharedListCard";
import { useAuth } from "@/lib/auth/provider";
import {
  announce,
  announceDeep,
  creamOnDark,
  feed as feedColor,
  FEED_BORDER,
  FEED_BREAKPOINT,
  feedType,
  flame,
  flameDeep,
  rule,
  space,
} from "@/lib/design/type";
import { withHeroTransition } from "@/lib/hero-transition";
import { invalidatePostCaches } from "@/lib/post-cache";
import { useSeenPosts } from "@/lib/read-state";
import { usePageTitle } from "@/lib/page-title";
import {
  collectTags,
  deletePost,
  listUnifiedFeed,
  updatePostCaption,
  type FeedItem,
  type PostWithAuthor,
} from "@/lib/api/posts";

/**
 * De feed als website-uitgave. Zie `feed-v3-merged.html` voor de
 * pixelreferentie en `DESIGN.md` voor het systeem.
 *
 * Een gekaderde kop met de tabstrip, daaronder de woordmerk-plaat, en dan
 * één gedeeld kader met twee zones: een smalle zijbalk (het persoonlijke
 * blok — de navigatie zit al in de kop) en de hoofdkolom. Onder 800px
 * stapelt alles.
 *
 * De hoofdkolom heeft twee standen, en de lezer kiest:
 *
 *   THEMATISCH      een uitgelichte vondst van ~88vh, daaronder rubrieken
 *                   met wisselend grote tegels — het ritme van een uitgave
 *   CHRONOLOGISCH   geen uitgelichte vondst, geen rubrieken: één raster
 *                   van gelijke kaarten, nieuwste eerst
 *
 * Waarom die tweede stand geen kleine variant van de eerste is: zonder
 * redactionele indeling zegt een grote tegel niets meer. Zie GridTile.
 *
 * Wat hier bewust NIET staat, en ook niet moet komen: een algoritme, een
 * bereikteller, sortering of tegelgrootte op basis van reacties. Je vrienden
 * zijn het algoritme.
 *
 * Scope: dit scherm draait op het lavendel/plum-systeem (`feed-*` tokens,
 * Inter, 1.5px kaders). Chat, vrienden, profiel, events en auth staan nog op
 * het warme shell/paper-systeem en worden hier niet aangeraakt.
 */

/**
 * De uitgave loopt tot de schermrand. Geen maximumbreedte: op een breed
 * scherm hoort hier beeld te staan, geen lavendel goot.
 */

/**
 * ---------------------------------------------------------------
 * DE INDELING VAN DE UITGAVE
 * ---------------------------------------------------------------
 * De feed is geen enkele stroom meer maar een reeks **rubrieken**, elk met
 * een eigen selectieregel en een eigen vorm:
 *
 *   UITGELICHT              de meest besproken vondst        cover-band
 *   WAAR OVER GEPRAAT WORDT op aantal reacties               tegelrij
 *   NIEUW                   op tijd, nieuwste eerst          tegelrij
 *   BEELD                   op soort: beeld/video/muziek     mozaïek
 *   IN WOORDEN              op soort: fragment/weetje/idee   citaat + tekst
 *
 * ⚠️  LET OP — dit wijkt af van een eerder vastgelegd productprincipe.
 * Het uitgangspunt lag vast: "geen ranking, geen bereiktellers, je
 * vrienden zijn het algoritme", en verwierp expliciet het idee om posts te
 * schalen op basis van reacties. De eerste twee rubrieken hierboven dóén
 * dat nu wel: ze sorteren op `comment_count`. Dat is een bewuste
 * koerswijziging van Tom (31-07-2026), geen vergissing — maar wie dit later
 * leest moet weten dat het doc en de code hierover uit elkaar liepen.
 *
 * Wat we NIET doen: tellers tonen. Het aantal reacties bepaalt de volgorde
 * binnen een rubriek, maar staat nergens als getal in beeld. Het verschil
 * tussen "hier wordt over gepraat" en "dit heeft 47 likes" is precies het
 * verschil dat dit ontwerp wil bewaren.
 */

/** Eén kaart in het raster. */
type Slot = { variant: TileVariant; item: FeedItem; index: number };

export default function FeedScreen() {
  usePageTitle("Feed");
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const wide = width >= FEED_BREAKPOINT;
  // Kolommen van het chronologische overzicht — zie columnsFor.
  const gridColumns = columnsFor(width);
  /** Voor de "naar boven"-knop; PageScroll geeft zijn scroller hierin door. */
  const scrollRef = useRef<ScrollView>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const { seen } = useSeenPosts();
  /** Wát je deelt kies je na de plus — zie de zijbalk. */
  /** Voorbij de kop gescrold? Dan krimpt de deelknop in de zijbalk. */
  const [scrolled, setScrolled] = useState(false);

  // De kop staat buiten de ScrollView; deze hook koppelt de scrollstand
  // aan de inklap-animatie van de woordmerk-plaat.
  const chrome = useChromeScroll();

  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      chrome.onScroll(e);
      const past = e.nativeEvent.contentOffset.y > 80;
      setScrolled((prev) => (prev === past ? prev : past));
    },
    // `chrome` is stabiel; alleen de handler erbinnen telt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chrome.onScroll]
  );

  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    refetchOnWindowFocus: true,
  });

  /**
   * Wat er nú aan de gang is. Een lopend event is het enige in deze app
   * met een klok erop: het is straks voorbij, en dan is de kans om erbij
   * te zijn ook voorbij. Daarom staat het bovenaan de thematische stand en
   * niet ergens tussen de vondsten van vorige week.
   */
  const liveEvents = useQuery({
    queryKey: ["live-events", myUserId],
    queryFn: async () => (await listMyEvents(myUserId)).filter((e) => e.is_active),
    staleTime: 60_000,
  });

  /**
   * Hoeveel lincs je hebt — alleen om te weten wélke leegte dit is.
   *
   * Een lege feed heeft twee verschillende oorzaken en die vragen om een
   * ander antwoord. Heb je lincs en heeft niemand iets gedeeld, dan is er
   * niets aan de hand en wacht je gewoon. Heb je ze niet, dan is de feed
   * niet leeg maar onmogelijk: er is geen bron. Zonder dit onderscheid
   * stuurde het scherm iedereen naar "deel zelf iets", ook wie in zijn
   * eentje in de app zat.
   *
   * Dezelfde sleutel als op Lincs en op de chatlijst, dus react-query
   * dedupliceert dit met wat daar al draait; het kost geen extra vraag.
   */
  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
    staleTime: 60_000,
  });
  const acceptedFriendCount = (friendships.data ?? []).filter(
    (f) => f.status === "accepted"
  ).length;

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
    }, [qc, myUserId])
  );

  const tags = useMemo(() => collectTags(feed.data ?? []).slice(0, 12), [feed.data]);

  /**
   * Eén raster, nieuwste eerst — en daarboven één uitgelichte vondst.
   *
   * De rubrieken zijn weg. Ze deelden dezelfde vondsten in zes bakjes met
   * elk een eigen tegelmaat, en dat was elke keer opnieuw leren lezen. Nu
   * is er één vorm: gelijke kaarten op volgorde.
   *
   * De uitgelichte vondst is waar je vrienden déze week over praten: de
   * meeste interactie van de laatste zeven dagen (`recent_interaction_count`,
   * zie lib/api/posts.ts), niet ooit — op het totaal blijft één oude vondst
   * maanden staan. Bij gelijke stand wint de nieuwste; de lijst is al zo
   * gesorteerd, dus de eerste met de hoogste stand is die. Is er deze week
   * niets gebeurd, dan is er niets uit te lichten en begint het raster.
   */
  const { featured, slots } = useMemo(() => {
    // Activiteit ("X plaatste een foto") staat in "Voor jou", niet in het
    // raster: naast de foto zelf zegt zo'n kaart hetzelfde nog een keer.
    let items = (feed.data ?? []).filter((i) => i.type !== "activity");
    if (activeTag) {
      items = items.filter(
        (i) =>
          (i.type === "post" || i.type === "memory") &&
          (i.data.tags ?? []).includes(activeTag)
      );
    }
    let featured: Extract<FeedItem, { type: "post" }> | null = null;
    for (const item of items) {
      if (item.type !== "post") continue;
      const score = item.data.recent_interaction_count ?? 0;
      if (score > 0 && score > (featured?.data.recent_interaction_count ?? 0)) {
        featured = item;
      }
    }
    const slots: Slot[] = items
      .filter((item) => item !== featured)
      .map((item, i) => ({ variant: "grid", item, index: i + 1 }));
    return { featured, slots };
  }, [feed.data, activeTag]);

  const onRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const empty = !featured && slots.length === 0;
  /**
   * Staan er lopende events bovenaan, dan is dat rubriek 01 en schuift de
   * rest een plaats op. De nummering telt wat je ziet, niet wat er in de
   * lijst met definities staat.
   */
  const liveSectionOffset = (liveEvents.data?.length ?? 0) > 0 ? 1 : 0;
  const featuredIndex = liveSectionOffset;
  const gridIndex = liveSectionOffset + (featured ? 1 : 0);

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* De kop staat buiten deze scroller en is absoluut verankerd —
          zie PageScroll voor waarom stickyHeaderIndices hier niet volstaat. */}
      <PageScroll
        scrollRef={scrollRef}
        wide={wide}
        progress={chrome.progress}
        onScroll={onFeedScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        // Ook hier de smalle balk.
        //
        // De grote kop was de thuispagina voorbehouden — daar is het merk
        // het onderwerp, overal elders de pagina zelf (§5). Dat klopte
        // zolang de feed het enige was wat je opensloeg. Wat het in de
        // praktijk deed is drie rijen affiche boven de vondsten zetten, en
        // dan is het eerste wat je ziet niet wat je vrienden deelden maar
        // je eigen logo. Eén balk overal is bovendien één ding om te leren
        // in plaats van twee die op elkaar lijken.
        compact
        refreshControl={
          <RefreshControl
            refreshing={feed.isFetching && !feed.isLoading}
            onRefresh={onRefresh}
            tintColor={feedColor.ink}
          />
        }
      >
        {/*
            Geen eigen marge meer.

            Hier stond `paddingHorizontal: gutter(wide)` bínnen de kolom van
            1250 die `PageScroll` tekent, terwijl de kop zijn marge er juist
            búiten heeft. Op een breed scherm begon de woordmerkplaat daardoor
            precies één gutter links van de foto eronder. De scroller doet het
            nu voor elke pagina op dezelfde manier; dit scherm hoeft er niets
            meer over te weten.
        */}
        <View style={{ width: "100%", alignSelf: "stretch", paddingTop: 0 }}>
          {/*
              Eén kader om de hele uitgave.

              Hier zat links een zijbalk met een persoonlijk blok: je naam,
              je avatar, "Bekijk profiel", meldingen en instellingen. Dat
              staat allemaal al in de kop — dezelfde avatar, hetzelfde menu —
              en twee keer dezelfde ingang op één scherm maakt geen van beide
              duidelijker. De kolom is weg; de kop draagt het.
          */}
          {/*
              Geen kader om het geheel.

              Elke rubriek heeft er al een, en een kader om de kaders heen
              zegt niets dat de pagina niet al zegt — het maakt de uitgave
              alleen een doos in een doos. De rubrieken zelf zijn de
              structuur.
          */}
          <View style={{ alignItems: "stretch", marginTop: space.lg }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Een mislukte query viel hier regelrecht door naar `empty`,
                  en dan zei de hoofdpagina van de app "je hebt nog niets
                  gedeeld" terwijl de server simpelweg niet antwoordde. Dat
                  is de ergste plek voor die verwisseling: het is het eerste
                  wat je ziet. Zie components/QueryError.tsx. */}
              {feed.isError ? (
                <QueryError
                  title="De feed kon niet geladen worden"
                  error={feed.error}
                  onRetry={() => feed.refetch()}
                />
              ) : feed.isLoading ? (
                /* Was een schijfje in het midden van een leeg blad. Overal
                   elders in de app tekent het laden de vorm die er komt;
                   hier sprong de pagina van niets naar een volle uitgave. */
                <View style={{ gap: space.section }}>
                  <SkeletonPostCard />
                  <SkeletonPostCard />
                </View>
              ) : (
                <>
                  {/*
                      Geen tweede marge.

                      Hier stond er nog 32 (of 18) bovenop de marge van de
                      pagina, en dus begon alles wat hierin staat — de
                      schakelaars, de rubrieken — een stuk verder naar
                      binnen dan de kop erboven. Vier verschillende
                      insprongen op één scherm. Alles lijnt nu uit op
                      `gutter()`.
                  */}
                  <View style={{ paddingTop: space.section, paddingBottom: 80 }}>
                    {/* De schakelaars stonden hier: weergave, ordening en
                        "gelezen dimmen", vijf tekeningen op een rij met
                        eronder in woorden wat er aanstond.

                        Ze staan nu in het persoonlijke venster achter je
                        avatar, naast licht/donker — zie
                        components/FeedSwitch.tsx voor waarom het een
                        instelling is en geen gereedschap. Wat overblijft
                        is dat de uitgave meteen begint: bovenaan het blad
                        staat de uitgave zelf en niet het bedieningspaneel
                        ervoor. */}

                    {/* Wat er over jóu gebeurd is, vóór de uitgave zelf.
                        Zie components/ActivityBand.tsx voor waarom dit hier
                        staat en niet alleen op /notifications. */}
                    <ActivityBand myUserId={myUserId} items={feed.data} />

                    {/*
                        Ook — en juist — als de uitgave leeg is.

                        De lege stand verving hier eerder de hele pagina, dus
                        wie vandaag zijn eerste dag heeft en toevallig in een
                        lopend event zit, kreeg te zien dat er "nog niets
                        gedeeld" was terwijl het event op dat moment aan de
                        gang was. Dat is het enige in deze app met een klok
                        erop: het is straks voorbij, en dan is de kans om
                        erbij te zijn ook voorbij. Dat mag geen lege lijst
                        elders wegdrukken.

                        Daarom valt de ordening hier weg als de feed leeg is:
                        de chronologische stand kent geen rubrieken, maar een
                        lopend event verstoppen omdat je "nieuwste eerst"
                        aanstaan hebt is geen ordening maar verlies.
                    */}
                    {(liveEvents.data?.length ?? 0) > 0 ? (
                      <SectionFrame index={0} label="Nu aan de gang">
                        <View style={{ padding: space.lg, gap: space.lg }}>
                          {liveEvents.data!.slice(0, 2).map((event, i) => (
                            <EventCard key={event.id} event={event} index={i + 1} />
                          ))}
                        </View>
                      </SectionFrame>
                    ) : null}

                    {empty ? (
                      <EmptyState
                        activeTag={activeTag}
                        hasFriends={acceptedFriendCount > 0}
                        onFindFriends={() => router.push("/(app)/friends")}
                      />
                    ) : null}

                    {/* Waar je vrienden deze week over praten — zie de
                        toelichting bij `featured` hierboven. Geen kader
                        eromheen: de plaat draagt zichzelf, net als eerst
                        bovenaan de pagina. */}
                    {featured ? (
                      <View style={{ marginBottom: space.section }}>
                        <SectionBand index={featuredIndex} label="Deze week het meest besproken" />
                        <HeroBlock
                          post={featured.data}
                          myUserId={myUserId}
                          wide={wide}
                          onChanged={invalidate}
                        />
                      </View>
                    ) : null}

                    {/*
                        Het strakke raster: gelijke vierkanten, nieuwste
                        eerst, alleen beeld.

                        Bewust alleen vondsten. Een stemming, een call of een
                        activiteitsregel is tekst met knoppen erin; die in een
                        vierkant persen levert een afgeknipte kaart op. Wie
                        die wil zien, kijkt in het metselwerk — daar staan ze
                        voluit. Dit raster is voor het overzicht: wat is er
                        gedeeld, en hoe ziet het eruit.
                    */}
                    {/* Vlak boven het raster, want dáár werkt hij op — niet
                        bovenaan de pagina boven "Voor jou" en de plaat.

                        De tagstrook blíjft staan als er niets is, want een
                        lege lijst is hier meestal het gevolg van de tag die
                        aanstaat — en dan is dit de enige knop waarmee je hem
                        weer uitzet. Hem verbergen zou je opsluiten in je
                        eigen filter. */}
                    {tags.length > 0 ? (
                      <TagStrip
                        tags={tags}
                        active={activeTag}
                        onPick={(t) => setActiveTag(t === activeTag ? null : t)}
                      />
                    ) : null}

                    {slots.length > 0 ? (
                      <SectionFrame index={gridIndex} label="Nieuwste eerst">
                        <View style={{ padding: space.sm }}>
                          <FeedBody
                            slots={slots}
                            columns={gridColumns}
                            myUserId={myUserId}
                            onChanged={invalidate}
                            seen={seen}
                          />
                        </View>
                      </SectionFrame>
                    ) : null}

                    {/* "Je bent bij." onder een pagina waar niets stond is
                        geen geruststelling maar een grap. */}
                    {empty ? null : <Colophon />}
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={{ height: wide ? 24 : 16 }} />
        </View>
      </PageScroll>

      {/* De enige knop waarmee je zelf iets toevoegt, en dus de enige die
          altijd bereikbaar hoort te zijn. Hij stond in het persoonlijke
          paneel van de zijbalk, en dat paneel scrolt weg. Nu zweeft hij
          los over de pagina — op elk schermformaat, want het argument is
          op een breed scherm niet anders. */}
      <FloatingShare
        onPress={() => router.push("/post-compose")}
        onToTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        lifted={scrolled}
      />

    </SafeAreaView>
  );
}


/**
 * Hoe vaak deze vondst omhoog geduwd is.
 *
 * Stond alleen op de detailpagina en op een fototegel, dus in de feed — waar
 * je vondsten naast elkaar ziet en juist wil weten waar over gepraat wordt —
 * zag je er niets van. Onder de één blijft hij weg: "nul keer omhoog geduwd"
 * onder elke verse vondst is geen informatie maar ruis, en in de feed staan
 * er tien onder elkaar.
 */
function BoostCount({ count }: { count: number }) {
  if (!count || count < 1) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Ionicons name="arrow-up-circle" size={13} color={flameDeep} />
      <Text style={[feedType.label, { color: flameDeep }]}>
        {count}× omhoog geduwd
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------
// De uitgelichte vondst
// ---------------------------------------------------------------

const HeroBlock = memo(function HeroBlock({
  post,
  myUserId,
  wide,
  onChanged,
}: {
  post: PostWithAuthor;
  myUserId: string;
  wide: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const menu = usePostMenu(post, myUserId, onChanged);

  return (
    <View>
      <FindHero
        post={post}
        wide={wide}
        /* `minHeight` is hier weg: de prop stond in `FindHero` gedeclareerd,
           werd door drie lagen doorgegeven en nergens gelezen. Wat de
           ingeklapte hoogte echt bepaalt is `aspectRatio: 4/5` in
           StickySpread — dus dit getal, berekend uit de vensterhoogte, deed
           al die tijd niets behalve suggereren dat het iets deed. */
        onPress={() => withHeroTransition(() => router.push(`/post/${post.id}`))}
        onMenu={menu.isMine ? menu.open : undefined}
        // De reacties horen in de kolom naast het beeld, niet als losse
        // strook onder het hele tweeluik — zie FindHero.
        footer={
          <>
            {/**
              * Eén inspringing voor wat er met de vondst gedaan is.
              *
              * De duwteller bracht zijn eigen padding mee, de emoji-pillen
              * hun eigen, en de reactieregel weer een andere — drie regels
              * die hetzelfde soort ding zeggen en op drie verschillende
              * plekken begonnen. Nu staan de eerste twee in één blok met één
              * marge en één tussenruimte; de reactieregel eronder heeft zijn
              * eigen lijn en hoort daar los van.
              */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                gap: 10,
                // Een lichte grens boven dit blok. Zonder hem raakten de
                // duwteller en de emoji's de tekst van de vondst zelf, en las
                // het als een staartje van het bericht in plaats van als wat
                // ánderen ermee deden. Haarlijn en geen volle lijn: het is
                // een scheiding binnen één kaart, niet tussen twee kaarten.
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: rule.soft,
              }}
            >
              <BoostCount count={post.boost_count} />
              <PostReactions postId={post.id} tone="feed" />
            </View>
            <CommentsSection
              entityType="post"
              entityId={post.id}
              ownerId={post.user_id}
              initialCount={post.comment_count}
              tone="feed"
            />
          </>
        }
      />
      {menu.element}
    </View>
  );
});

// ---------------------------------------------------------------
// De compacte sectie
// ---------------------------------------------------------------

/**
 * Cover-band en citaatband lopen over de volle breedte; de vier tegels
 * staan in één rij met gedeelde kaders (vier kolommen op desktop, twee
 * daaronder), precies zoals de `.tilerow` in de mockup.
 */
/**
 * De zwevende deelknop.
 *
 * Hij komt op bij het openen van de pagina in plaats van er te staan: een
 * knop die over de inhoud ligt en er zomaar ís, leest als iets dat is
 * blijven hangen. `lifted` is de scrollstand — voorbij de kop wordt hij
 * een tikje kleiner, zodat hij minder van de leeslijst afpakt zonder ooit
 * weg te zijn.
 */
/**
 * De maat van de zwevende knoppen. Eén getal, zodat ze niet uit elkaar
 * kunnen groeien — `ShareButton` heeft zijn eigen standaardmaat en die was
 * een andere dan de knop ernaast.
 */
const FLOATING_SIZE = 56;

function FloatingShare({
  onPress,
  onToTop,
  lifted,
}: {
  onPress: () => void;
  /** Terug naar boven. Verschijnt pas als er iets is om naar terug te gaan. */
  onToTop?: () => void;
  lifted: boolean;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const shrink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  useEffect(() => {
    Animated.timing(shrink, {
      toValue: lifted ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [lifted, shrink]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        right: space.xl,
        bottom: space.xl,
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: shrink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) },
        ],
      }}
    >
      {/**
        * Naar boven, náást de plus en niet erboven.
        *
        * Twee ronde knoppen op elkaar gestapeld leest als één kolom
        * bedieningsknoppen die met de pagina meegroeit; naast elkaar blijft
        * het één groep van twee.
        *
        * Even groot als de plus. Ik had hem kleiner gemaakt om te zeggen dat
        * delen de hoofdzaak is en terugspringen een hulpje — maar twee
        * cirkels van net niet dezelfde maat naast elkaar lezen niet als
        * hiërarchie, ze lezen als een fout. Rangorde zit hier al in de
        * volgorde en in het feit dat de plus er altijd staat en deze niet.
        *
        * Hij verschijnt pas als je gescrold hebt: een knop die je naar boven
        * brengt terwijl je al boven bent is een knop die niets doet, en dan
        * leer je hem negeren.
        */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {lifted && onToTop ? (
          <Pressable
            onPress={onToTop}
            accessibilityLabel="Terug naar boven"
            style={({ pressed }) => ({
              width: FLOATING_SIZE,
              height: FLOATING_SIZE,
              borderRadius: FLOATING_SIZE / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? announceDeep : announce,
            })}
          >
            <Ionicons name="arrow-up" size={Math.round(FLOATING_SIZE * 0.5)} color={creamOnDark.DEFAULT} />
          </Pressable>
        ) : null}
        <ShareButton onPress={onPress} size={FLOATING_SIZE} />
      </View>
    </Animated.View>
  );
}

/**
 * Eén rubriek als blok: een kader met de kop als bovenste rij en de
 * vondsten eronder.
 *
 * Eerder zweefde de kop boven een losse rij tegels die zijn eigen kader
 * had. Twee kaders die niets met elkaar te maken hadden, en een kop die bij
 * geen van beide hoorde. Eén kader zegt: dit hoort bij elkaar, en hier
 * houdt het op.
 */
function SectionFrame({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        marginBottom: space.section,
        borderWidth: FEED_BORDER,
        // Zachter dan de lijnen ín de kaarten. Het kader zegt alleen "dit
        // hoort bij elkaar"; wát er bij elkaar hoort is het onderwerp, en
        // dat verliest het van een zwarte doos eromheen. De kaarten hebben
        // hun eigen structuur gekregen (zie FindBody) en dragen het ritme
        // nu zelf.
        borderColor: rule.soft,
      }}
    >
      <SectionBand index={index} label={label} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------
// Het chronologische overzicht
// ---------------------------------------------------------------


/**
 * Hoeveel kolommen het overzicht krijgt bij deze schermbreedte.
 *
 * Losse drempels en geen formule. De maat die telt is de kaart zelf: onder
 * ongeveer 260px is hij te smal voor een kop van twee regels naast een
 * beeld van 4:3. De drempels liggen daarom hoger dan de schermbreedte doet
 * vermoeden — de zijbalk en de marges gaan er eerst nog af.
 */
function columnsFor(width: number): number {
  if (width >= 1600) return 4;
  if (width >= 1100) return 3;
  if (width >= 640) return 2;
  return 1;
}

/**
 * Alles op volgorde, in gelijke kaarten naast elkaar.
 *
 * Het raster is een simpele rij die omslaat, met percentagebreedtes en de
 * tussenruimte als binnenmarge van de cel. Geen `gap`: dat gedraagt zich
 * op react-native-web anders dan op native, en dit is één regel meer voor
 * een indeling die overal hetzelfde uitpakt.
 */
function FeedBody({
  slots,
  columns,
  myUserId,
  onChanged,
  seen,
}: {
  slots: Slot[];
  columns: number;
  myUserId: string;
  onChanged: () => void;
  seen?: Set<string> | null;
}) {
  return (
    <ChronoGrid
      slots={slots}
      columns={columns}
      myUserId={myUserId}
      onChanged={onChanged}
      seen={seen}
    />
  );
}

function ChronoGrid({
  slots,
  columns,
  myUserId,
  onChanged,
  seen,
}: {
  slots: Slot[];
  columns: number;
  myUserId: string;
  onChanged: () => void;
  seen?: Set<string> | null;
}) {
  /**
   * Elke vondst krijgt de rastervorm: beeld op zijn eigen verhouding, tekst
   * eronder. De vormen uit de rubrieken vullen juist de hoogte die ze
   * krijgen en horen hier niet: dit is één maat voor alles.
   */
  const cells = slots.map((slot) =>
    slot.item.type === "post" ? { ...slot, variant: "grid" as TileVariant } : slot
  );

  return (
    <IndexGrid columns={columns}>
      {cells.map((slot) => (
        <CompactItem
          key={slot.item.id}
          slot={slot}
          wide={columns > 1}
          myUserId={myUserId}
          onChanged={onChanged}
          seen={seen}
        />
      ))}
    </IndexGrid>
  );
}

const CompactItem = memo(function CompactItem({
  slot,
  wide,
  myUserId,
  onChanged,
  seen,
}: {
  slot: Slot;
  wide: boolean;
  myUserId: string;
  onChanged: () => void;
  seen?: Set<string> | null;
}) {
  const router = useRouter();
  const { item, variant, index } = slot;
  // Gedimd = al bekeken. Geen aparte kleur maar minder dekking: de tegel
  // blijft leesbaar, hij vraagt alleen geen aandacht meer.
  // Nieuw voor jou? Dan een stip; gezien is gewoon gezien. Dimmen deed het
  // omgekeerde: het maakte wat je al kende onleesbaar in plaats van wat je
  // nog niet kende zichtbaar.
  const fresh = item.type === "post" && !seen?.has(item.id);

  if (item.type === "post") {
    return (
      <View style={{ flex: 1 }}>
      <PostTile
        post={item.data}
        fresh={fresh}
        variant={variant}
        index={index}
        wide={wide}
        myUserId={myUserId}
        onChanged={onChanged}
        onPress={() =>
          withHeroTransition(() => router.push(`/post/${item.data.id}`))
        }
      />
      </View>
    );
  }

  const label =
    item.type === "poll" ? "Poll"
    : item.type === "call_plan" ? "Call"
    : item.type === "shared_list" ? "Lijst"
    : "Op deze dag";

  // Deze kaarten draaien nog op het warme shell/paper-palet en zijn nog niet
  // herstijld — ze staan daarom in een licht paneel met een etiket erboven,
  // net zoals in het vorige feed-ontwerp. Zie DESIGN.md §5.
  // Géén eigen kader: deze kaart staat ín het kader van zijn rubriek, en de
  // rij eromheen trekt de scheidingslijn al. Twee lijnen tegen elkaar aan
  // lezen als een dubbele rand — precies wat er stond.
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: feedColor.panel,
        padding: space.md,
      }}
    >
      <View style={{ marginBottom: space.sm }}>
        <Meta tone="feed" caps>
          {label}
        </Meta>
      </View>
      {item.type === "poll" && <PollCard poll={item.data} onDeleted={onChanged} />}
      {item.type === "call_plan" && <CallPlanCard plan={item.data} />}
      {item.type === "shared_list" && <SharedListCard list={item.data} />}
      {item.type === "memory" && <MemoryCard post={item.data} />}
    </View>
  );
});

function PostTile({
  post,
  variant,
  index,
  wide,
  fresh,
  myUserId,
  onChanged,
  onPress,
}: {
  post: PostWithAuthor;
  variant: TileVariant;
  index: number;
  wide: boolean;
  fresh?: boolean;
  myUserId: string;
  onChanged: () => void;
  onPress: () => void;
}) {
  const menu = usePostMenu(post, myUserId, onChanged);

  return (
    <View style={{ flex: 1 }}>
      {/* Lang indrukken opent hetzelfde menu als "Delen ↗" op de hero, zodat
          je een eigen vondst ook vanuit een tegel kunt bewerken of wissen. */}
      <Pressable
        onLongPress={menu.isMine ? menu.open : undefined}
        delayLongPress={350}
        style={{ flex: 1 }}
      >
        <FindTile
          post={post}
          variant={variant}
          index={index}
          wide={wide}
          fresh={fresh}
          onPress={onPress}
        />
      </Pressable>
      {menu.element}
    </View>
  );
}

// ---------------------------------------------------------------
// Menu voor een eigen vondst — gedeeld door hero en tegel
// ---------------------------------------------------------------

function usePostMenu(
  post: PostWithAuthor,
  myUserId: string,
  onChanged: () => void
) {
  const qc = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);
  /**
   * De fout hoort in het venster, niet in de strook eronder.
   *
   * De strook ligt in de wortel van de app; dit venster is een `Modal`, en
   * die staat op native in een eigen laag erboven en op web in een portal
   * ná de wortel — met een sluier van 55% ertussen. De melding kwam dus
   * áchter het venster terecht dat er nog stond, en dat is precies de
   * toestand die hij moest opheffen.
   */
  const [editError, setEditError] = useState<string | null>(null);
  const isMine = post.user_id === myUserId;

  const element = isMine ? (
    <>
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Vondst"
        actions={[
          {
            label: "Toelichting bewerken",
            icon: "pencil-outline",
            onPress: () => {
              setMenuOpen(false);
              setEditCaption(post.caption ?? "");
              setEditOpen(true);
            },
          },
          {
            label: "Verwijderen",
            icon: "trash-outline",
            destructive: true,
            onPress: async () => {
              setMenuOpen(false);
              await deletePost(post);
              // Niet alleen deze lijst: de vondst staat ook op profielen
              // en in de strook met interacties. Zie lib/post-cache.ts.
              await invalidatePostCaches(qc);
              onChanged();
            },
          },
        ]}
      />

      <ModalShell
        visible={editOpen}
        onClose={() => {
          setEditError(null);
          setEditOpen(false);
        }}
        title="Toelichting bewerken"
      >
        <View style={{ padding: space.lg }}>
          <TextInput
            value={editCaption}
            onChangeText={setEditCaption}
            placeholder="Schrijf iets…"
            placeholderTextColor={feedColor.inkDim}
            multiline
            autoFocus
            maxLength={1000}
            style={[
              feedType.body,
              {
                color: feedColor.ink,
                minHeight: 96,
                maxHeight: 190,
                borderWidth: FEED_BORDER,
                borderColor: feedColor.ink,
                paddingHorizontal: space.md,
                paddingVertical: space.md,
              },
              Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
            ]}
          />
          {editError ? (
            <View
              style={{
                marginTop: space.md,
                borderLeftWidth: 4,
                borderLeftColor: flame,
                paddingLeft: space.md,
              }}
            >
              <Text style={[feedType.body, { color: feedColor.ink }]}>
                {editError}
              </Text>
            </View>
          ) : null}
          <Pressable
            onPress={async () => {
              setSaving(true);
              setEditError(null);
              try {
                await updatePostCaption(post.id, editCaption);
                setEditOpen(false);
                onChanged();
              } catch {
                // Het venster bleef openstaan met de knop weer actief, en
                // verder niets — niet te onderscheiden van "nog niet gedrukt".
                setEditError(
                  "De toelichting kon niet bewaard worden. Probeer het opnieuw."
                );
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            style={{
              marginTop: space.lg,
              backgroundColor: feedColor.ink,
              paddingVertical: space.lg,
              alignItems: "center",
            }}
          >
            <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
              {saving ? "Bewaren…" : "Bewaren"}
            </Text>
          </Pressable>
        </View>
      </ModalShell>
    </>
  ) : null;

  return { isMine, open: () => setMenuOpen(true), element };
}

// ---------------------------------------------------------------
// Klein spul
// ---------------------------------------------------------------

function TagStrip({
  tags,
  active,
  onPick,
}: {
  tags: string[];
  active: string | null;
  onPick: (tag: string | null) => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 2 }}
      >
        <TagChip label="Alles" active={active === null} onPress={() => onPick(null)} />
        {tags.map((t) => (
          <TagChip key={t} label={t} active={active === t} onPress={() => onPick(t)} />
        ))}
      </ScrollView>
    </View>
  );
}

function TagChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feedColor.ink,
        backgroundColor: active ? feedColor.ink : "transparent",
        marginRight: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text
        style={[feedType.label, { color: active ? feedColor.lav : feedColor.ink }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Wat er staat als de uitgave leeg is.
 *
 * ---------------------------------------------------------------
 * WAAROM HIER MAAR SOMS EEN KNOP STAAT
 * ---------------------------------------------------------------
 * Dit was een doodlopende weg. Er stond "voeg vrienden toe" en er was geen
 * enkele ingang naar Lincs — terwijl een vers account per definitie nul
 * lincs heeft, en de feed dus letterlijk niet kán vullen tot je er iemand
 * bij hebt. Het scherm dat de oorzaak noemde was het enige scherm zonder de
 * knop ernaar.
 *
 * Maar niet altijd een knop. §4 laat één gevuld vlak per scherm toe en dat
 * is de primaire actie; op dit scherm ís die er al — de zwevende oranje
 * plus rechtsonder, en die doet precies "deel zelf iets". Een tweede oranje
 * knop naar dezelfde handeling is exact de fout die de agenda eerder
 * maakte: twee gevulde knoppen, één route, en dan is geen van beide meer
 * de actie.
 *
 * Dus: heb je lincs, dan vertelt deze stand alleen en handelt de plus. Heb
 * je ze niet, dan is de weg die híer ontbreekt een andere dan die de plus
 * biedt, en krijgt hij zijn eigen knop.
 */
function EmptyState({
  activeTag,
  hasFriends,
  onFindFriends,
}: {
  activeTag: string | null;
  hasFriends: boolean;
  onFindFriends: () => void;
}) {
  if (activeTag) {
    return (
      <SharedEmptyState
        title="Niets onder deze tag"
        body="Probeer een andere tag, of deel zelf de eerste."
      />
    );
  }

  if (!hasFriends) {
    return (
      <SharedEmptyState
        title="Je kring is nog leeg"
        body="De feed vult zich met wat je lincs delen — en die heb je er nog niet bij. Voeg iemand toe en het begint te lopen."
        action={{ label: "Zoek je lincs", onPress: onFindFriends }}
      />
    );
  }

  return (
    <SharedEmptyState
      title="Nog niets gedeeld"
      body="Een vondst is alles wat je hier neerzet: een link, een foto, een paar zinnen. De plus rechtsonder is waar dat begint."
    />
  );
}

/** De voet: de uitgave houdt op. Geen oneindige stroom. */
function Colophon() {
  return (
    // Dit was een gevuld zwart blok met crème erop. Twee dingen mis: een
    // pikzwarte doos onderaan een wit blad is het luidste van de pagina
    // terwijl hij alleen zegt dat het op is, en de regel eronder stond op
    // `textDim` — inkt op 58%, wat op zwart neerkomt op onleesbaar. Nu is
    // het wat het hoort te zijn: een lijn en twee regels op het blad.
    <View
      style={{
        borderTopWidth: FEED_BORDER,
        borderTopColor: feedColor.ink,
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 44,
        alignItems: "center",
      }}
    >
      <Text style={[feedType.cover, { color: feedColor.ink }]}>Je bent bij.</Text>
      <Text
        style={[
          feedType.body,
          {
            color: feedColor.inkDim,
            marginTop: 10,
            maxWidth: 380,
            textAlign: "center",
          },
        ]}
      >
        Geen oneindige stroom, geen ranking, geen tellers. Kom straks terug, of
        deel zelf iets.
      </Text>
    </View>
  );
}

