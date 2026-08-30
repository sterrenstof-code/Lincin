import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { SHARE_KINDS } from "@/lib/share-kinds";
import { ModalShell } from "@/components/ModalShell";
import { ActivityCard } from "@/components/ActivityCard";
import { CallPlanCard } from "@/components/CallPlanCard";
import { CommentsSection } from "@/components/CommentsSection";
import { IndexGrid } from "@/components/IndexGrid";
import { Meta } from "@/components/Editorial";
import { listMyEvents } from "@/lib/api/events";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { EventCard } from "@/components/EventCard";
import { ActivityBand } from "@/components/ActivityBand";
import { ShareButton } from "@/components/FeedChrome";
import {
  FindHero,
  FindTile,
  tileShapeFor,
  type TileVariant,
} from "@/components/FindBody";
import { MemoryCard } from "@/components/MemoryCard";
import { PollCard } from "@/components/PollCard";
import { PostGrid } from "@/components/PostGrid";
import { PostReactions } from "@/components/PostReactions";
import { QueryError } from "@/components/QueryError";
import { useToast } from "@/lib/toast";
import { SectionBand } from "@/components/SectionBand";
import { SharedListCard } from "@/components/SharedListCard";
import { useAuth } from "@/lib/auth/provider";
import {
  announce,
  announceDeep,
  CONTROL_H,
  creamOnDark,
  feed as feedColor,
  FEED_BORDER,
  FEED_BREAKPOINT,
  feedType,
  flameDeep,
  rule,
  space,
} from "@/lib/design/type";
import { withHeroTransition } from "@/lib/hero-transition";
import { useFeedPrefs, type FeedLayout } from "@/lib/feed-prefs";
import { useSeenPosts } from "@/lib/read-state";
import {
  collectTags,
  deletePost,
  listUnifiedFeed,
  updatePostCaption,
  type FeedItem,
  type FindKind,
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

/** Hoe een rubriek zijn vondsten kiest. */
type SectionRule = "discussed" | "recent" | "visual" | "words" | "album";

/** Hoe een rubriek zijn vondsten toont. */
type SectionLayout = "cover" | "tiles" | "mosaic" | "words";

type SectionDef = {
  key: string;
  label: string;
  rule: SectionRule;
  layout: SectionLayout;
  /** Hoeveel vondsten deze rubriek hoogstens opneemt. */
  limit: number;
};

/**
 * De rubrieken van de thematische stand — vast, in deze volgorde.
 *
 * Vast, want een uitgave met elke keer andere kopjes is geen uitgave: je
 * leert waar je moet kijken doordat het er altijd staat. Een rubriek die
 * niets te tonen heeft valt weg, maar hij verhuist nooit.
 *
 * Boven deze rij staat nog "Nu aan de gang" (lopende events); die komt niet
 * uit de vondsten en heeft daarom geen regel hier.
 */
const SECTIONS: SectionDef[] = [
  // De uitgelichte vondst: die waar het meest mee gedaan is, op de volle
  // plaat met de redactionele opmaak.
  { key: "featured",   label: "Uitgelicht",        rule: "discussed", layout: "cover",  limit: 1 },
  // Een reeks foto's krijgt óók de grote plaat: daar valt doorheen te
  // bladeren, en dat is precies wat een tegel van een halve kolom
  // onmogelijk maakt.
  { key: "album",      label: "Een reeks",         rule: "album",     layout: "cover",  limit: 1 },
  { key: "interacted", label: "Meeste interactie", rule: "discussed", layout: "tiles",  limit: 4 },
  { key: "newest",     label: "Nieuwste",          rule: "recent",    layout: "tiles",  limit: 4 },
  { key: "visual",     label: "Beeld",             rule: "visual",    layout: "mosaic", limit: 5 },
  { key: "words",      label: "In woorden",        rule: "words",     layout: "words",  limit: 3 },
];

/** Soorten die in de beeldrubriek thuishoren. */
const VISUAL_KINDS: FindKind[] = ["image", "video", "music"];
/** Soorten die in de woordenrubriek thuishoren. */
const WORD_KINDS: FindKind[] = ["fragment", "fact", "idea", "note"];

type Slot = { variant: TileVariant; item: FeedItem; index: number };
type Section = { key: string; label: string; layout: SectionLayout; slots: Slot[] };

/**
 * De vorm van een tegel volgt niet meer zijn plaats in de rij maar zijn
 * inhoud — zie `tileShapeFor` in components/FindBody.tsx, met daar de
 * uitleg waarom een vaste beurtrol lege tegels opleverde.
 */

/**
 * Bouwt de rubrieken. Elke vondst komt hoogstens één keer voor: een rubriek
 * neemt wat hij nodig heeft en laat de rest over aan de volgende.
 */
function buildSections(items: FeedItem[]): { sections: Section[]; leftovers: Slot[] } {
  const posts = items.filter(
    (i): i is Extract<FeedItem, { type: "post" }> => i.type === "post"
  );
  const others = items.filter((i) => i.type !== "post");
  const used = new Set<string>();
  let counter = 0;

  const available = () => posts.filter((p) => !used.has(p.id));

  function select(rule: SectionRule, limit: number): typeof posts {
    let pool = available();
    if (rule === "visual") {
      pool = pool.filter(
        (p) => VISUAL_KINDS.includes(p.data.kind ?? "note") || !!p.data.image_url
      );
    } else if (rule === "words") {
      pool = pool.filter((p) => WORD_KINDS.includes(p.data.kind ?? "note"));
    }
    if (rule === "album") {
      // Alleen wat écht een reeks is; één foto is geen album.
      pool = pool.filter((p) => (p.data.album_urls?.length ?? 0) > 1);
    }
    if (rule === "discussed") {
      /**
       * Meest bespróken is niet hetzelfde als meeste reacties eronder: een
       * vondst met tien duimpjes en nul woorden is even goed waar het over
       * gaat. Daarom telt alles mee wat iemand met de vondst gedaan heeft —
       * reacties, emoji en duwen samen, elk met hun eigen gewicht. Zie
       * `INTERACTION_WEIGHTS` in lib/api/posts.ts: een duw weegt het
       * zwaarst, want dat is als enige een oordeel over wie het nóg moet
       * zien — precies de vraag die deze rubriek stelt.
       *
       * Bij gelijke stand wint de nieuwste, zodat een oude vondst met twee
       * reacties niet eeuwig bovenaan blijft staan.
       */
      pool = [...pool].sort((a, b) => {
        const d = (b.data.interaction_count ?? 0) - (a.data.interaction_count ?? 0);
        if (d !== 0) return d;
        return (
          new Date(b.data.created_at).getTime() -
          new Date(a.data.created_at).getTime()
        );
      });
      // Zonder dat iemand iets gedaan heeft, valt er niets uit te lichten.
      pool = pool.filter((p) => (p.data.interaction_count ?? 0) > 0);
    }
    return pool.slice(0, limit);
  }

  const sections: Section[] = [];
  for (const def of SECTIONS) {
    const chosen = select(def.rule, def.limit);
    if (chosen.length === 0) continue;
    const slots: Slot[] = chosen.map((item, i) => {
      used.add(item.id);
      counter += 1;
      const variant: TileVariant =
        def.layout === "cover" ? "cover"
        : def.layout === "mosaic" ? "mosaic"
        : def.layout === "words" ? (i === 0 ? "quote" : "text")
        : tileShapeFor(item.data, i);
      return { variant, item, index: counter };
    });
    sections.push({ key: def.key, label: def.label, layout: def.layout, slots });
  }

  // Wat geen rubriek heeft gevonden, plus alle niet-posts, sluit chronologisch
  // aan. Zo verdwijnt er nooit iets uit de feed doordat het nergens paste.
  const leftovers: Slot[] = [];
  for (const item of items) {
    if (item.type === "post" && used.has(item.id)) continue;
    if (item.type !== "post" && !others.includes(item)) continue;
    counter += 1;
    const variant: TileVariant =
      item.type !== "post" ? "text" : tileShapeFor(item.data, leftovers.length);
    leftovers.push({ variant, item, index: counter });
  }

  return { sections, leftovers };
}

export default function FeedScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { width, height } = useWindowDimensions();
  const wide = width >= FEED_BREAKPOINT;
  // Kolommen van het chronologische overzicht — zie columnsFor.
  const gridColumns = columnsFor(width);
  const [shareOpen, setShareOpen] = useState(false);
  /** Voor de "naar boven"-knop; PageScroll geeft zijn scroller hierin door. */
  const scrollRef = useRef<ScrollView>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  /**
   * De twee leesvoorkeuren:
   *   `order`    `thematic` groepeert in rubrieken (zie SECTIONS),
   *              `chrono` gooit alles op één hoop, nieuwste eerst.
   *   `layout`   `mosaic` laat elke vondst zijn eigen maat houden,
   *              `grid` legt ze in gelijke vierkanten.
   *   `dimSeen`  al bekeken vondsten worden uitgegrijsd.
   *
   * Ordening en weergave zijn twee vragen en dus twee keuzes: chronologisch
   * kán als metselwerk, thematisch kán als raster.
   *
   * Beide zijn een keuze van de lezer en geen instelling die de app voor
   * je maakt — dus onthouden we ze, per gebruiker, op dit toestel. Zie
   * lib/feed-prefs.ts voor waarom dat lokaal blijft.
   */
  const { prefs, setLayout, setOrder, setDimSeen } = useFeedPrefs(myUserId);
  const { layout, order, dimSeen } = prefs;
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

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
    }, [qc, myUserId])
  );

  const tags = useMemo(() => collectTags(feed.data ?? []).slice(0, 12), [feed.data]);

  /**
   * De hero is de meest recente échte vondst. Niet-posts (herinneringen,
   * polls, calls, lijsten, activiteit) slaan we over: die zijn niet gemaakt
   * om op affiche-formaat te staan, en een herinnering staat bovendien altijd
   * bovenaan de lijst, dus die zou de hero permanent bezetten.
   *
   * Geen ranking: `listUnifiedFeed` sorteert al aflopend op `created_at` en
   * wij nemen daar simpelweg de eerste post uit.
   */
  const { hero, sections, leftovers } = useMemo(() => {
    let items = feed.data ?? [];
    if (activeTag) {
      items = items.filter(
        (i) =>
          (i.type === "post" || i.type === "memory") &&
          (i.data.tags ?? []).includes(activeTag)
      );
    }
    const heroIndex = items.findIndex((i) => i.type === "post");
    const rest = heroIndex === -1 ? items : items.filter((_, i) => i !== heroIndex);
    const hero =
      heroIndex === -1
        ? null
        : (items[heroIndex] as Extract<FeedItem, { type: "post" }>);

    /**
     * Chronologisch: geen rubrieken, geen uitgelichte vondst, geen
     * wisselende tegelmaten. Eén raster van gelijke kaarten, nieuwste
     * eerst.
     *
     * De uitgelichte vondst hoort bij de thematische stand — daar kiest de
     * indeling wat groot mag. Hier is de volgorde het enige wat telt, en
     * dan is een kop van 88vh boven de lijst een tweede verhaal over
     * dezelfde inhoud. Zie GridTile voor waarom ook de maat gelijk is.
     */
    if (order === "chrono") {
      const flat: Slot[] = items.map((item, i) => ({
        variant: "grid",
        item,
        index: i + 1,
      }));
      return { hero: null, sections: [] as Section[], leftovers: flat };
    }

    /**
     * In rastervorm is er geen uitgelichte plaat: een affiche van bijna een
     * scherm hoog boven een raster is een tweede verhaal over dezelfde
     * inhoud. De vondst die anders de plaat kreeg, doet dan gewoon mee in
     * de rubrieken — anders zou hij van de pagina verdwijnen.
     */
    if (layout === "grid") {
      return { hero: null, ...buildSections(items) };
    }

    return { hero, ...buildSections(rest) };
  }, [feed.data, activeTag, order, layout]);

  const onRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const empty = !hero && sections.length === 0 && leftovers.length === 0;
  /**
   * Staan er lopende events bovenaan, dan is dat rubriek 01 en schuift de
   * rest een plaats op. De nummering telt wat je ziet, niet wat er in de
   * lijst met definities staat.
   */
  const liveSectionOffset = (liveEvents.data?.length ?? 0) > 0 ? 1 : 0;

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
                <View className="items-center py-24">
                  <ActivityIndicator color={feedColor.ink} />
                </View>
              ) : empty ? (
                <EmptyState activeTag={activeTag} wide={wide} />
              ) : (
                <>
                  {hero ? (
                    <HeroBlock
                      post={hero.data}
                      myUserId={myUserId}
                      wide={wide}
                      minHeight={Math.round(height * (wide ? 0.88 : 0.7))}
                      onChanged={invalidate}
                    />
                  ) : null}

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
                    {/* Ordening + leesstatus. Twee vragen, geen
                        instellingenscherm: dit is iets wat je terwijl je
                        leest wil kunnen omzetten.

                        Hij plakte onder de kop zodra je hem voorbij scrolde.
                        Dat is één plakkend ding te veel op een pagina waar
                        de kop al blijft staan: je kiest je ordening als je
                        begint, niet halverwege, en wat wél mee moet scrollen
                        is de knop om zelf iets te delen. Zie de zijbalk. */}
                    <View style={{ marginBottom: space.xl }}>
                      {/* Eén kader om alle drie de schakelaars.
                          Ze stonden in twee losse doosjes die op een smal
                          scherm onder elkaar vielen: twee kaders, twee
                          hoogtes, en een gat ertussen. Het zijn drie
                          standen van dezelfde vraag — hoe wil je kijken —
                          en dus één kader met cellen erin, net als de
                          tabstrip in de kop. */}
                      {/*
                          Twee vragen, twee groepjes, en eronder in woorden
                          wat er nu aan staat.

                          Vijf tekeningen op één rij lazen als één streepjes-
                          code: je zag wel dat er iets aan of uit stond, maar
                          niet wát. Twee dingen helpen. Ten eerste: uit
                          elkaar zetten wat niet bij elkaar hoort — hoe het
                          eruitziet, hoe het geordend is, en of gelezen
                          vondsten dimmen zijn drie aparte vragen, dus drie
                          aparte kaders. Ten tweede: de regel eronder zegt
                          gewoon wat de stand is. Zo hoeft geen enkele
                          tekening op zichzelf duidelijk te zijn — je leest
                          één keer wat je gekozen hebt, en daarna herken je
                          de vorm.
                      */}
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: space.sm,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            borderWidth: FEED_BORDER,
                            borderColor: feedColor.ink,
                          }}
                        >
                          <LayoutTab
                            kind="mosaic"
                            active={layout === "mosaic"}
                            onPress={() => setLayout("mosaic")}
                          />
                          <LayoutTab
                            kind="grid"
                            active={layout === "grid"}
                            onPress={() => setLayout("grid")}
                            divider
                          />
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            borderWidth: FEED_BORDER,
                            borderColor: feedColor.ink,
                          }}
                        >
                          <LayoutTab
                            kind="thematic"
                            active={order === "thematic"}
                            onPress={() => setOrder("thematic")}
                          />
                          <LayoutTab
                            kind="chrono"
                            active={order === "chrono"}
                            onPress={() => setOrder("chrono")}
                            divider
                          />
                        </View>

                        <View
                          style={{
                            borderWidth: FEED_BORDER,
                            borderColor: feedColor.ink,
                          }}
                        >
                          <LayoutTab
                            kind="dim"
                            active={dimSeen}
                            onPress={() => setDimSeen(!dimSeen)}
                          />
                        </View>
                      </View>

                      <Text
                        style={[
                          feedType.label,
                          { color: feedColor.inkDim, marginTop: space.md },
                        ]}
                        numberOfLines={1}
                      >
                        {[
                          layout === "mosaic" ? "Metselwerk" : "Raster",
                          order === "thematic" ? "in rubrieken" : "nieuwste eerst",
                          dimSeen ? "gelezen gedimd" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>

                    {tags.length > 0 ? (
                      <TagStrip
                        tags={tags}
                        active={activeTag}
                        onPick={(t) => setActiveTag(t === activeTag ? null : t)}
                      />
                    ) : null}

                    {/* Wat er over jóu gebeurd is, vóór de uitgave zelf.
                        Zie components/ActivityBand.tsx voor waarom dit hier
                        staat en niet alleen op /notifications. */}
                    <ActivityBand myUserId={myUserId} items={feed.data} />

                    {order === "thematic" && (liveEvents.data?.length ?? 0) > 0 ? (
                      <SectionFrame index={0} label="Nu aan de gang">
                        <View style={{ padding: space.lg, gap: space.lg }}>
                          {liveEvents.data!.slice(0, 2).map((event, i) => (
                            <EventCard key={event.id} event={event} index={i + 1} />
                          ))}
                        </View>
                      </SectionFrame>
                    ) : null}

                    {sections.map((section, sectionIndex) => (
                      <SectionFrame
                        key={section.key}
                        index={liveSectionOffset + sectionIndex}
                        label={section.label}
                      >
                        {/*
                            In rastervorm krijgt élke rubriek hetzelfde
                            vierkante raster. Anders veranderde er bij het
                            omzetten alleen iets in het laatste blok
                            onderaan, en dan lijkt de knop stuk: je klikt en
                            er gebeurt niets in wat je ziet.
                        */}
                        {layout === "grid" ? (
                          <View style={{ padding: space.sm }}>
                            <FeedBody
                              layout="grid"
                              slots={section.slots}
                              columns={gridColumns}
                              myUserId={myUserId}
                              onChanged={invalidate}
                              dimmed={dimSeen ? seen : null}
                            />
                          </View>
                        ) : section.layout === "mosaic" ? (
                          <MosaicGrid
                            slots={section.slots}
                            wide={wide}
                            myUserId={myUserId}
                            onChanged={invalidate}
                            dimmed={dimSeen ? seen : null}
                          />
                        ) : (
                          <CompactSection
                            slots={section.slots}
                            wide={wide}
                            myUserId={myUserId}
                            onChanged={invalidate}
                            dimmed={dimSeen ? seen : null}
                          />
                        )}
                      </SectionFrame>
                    ))}

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
                    {order === "chrono" && leftovers.length > 0 ? (
                      <SectionFrame index={0} label="Alles, nieuwste eerst">
                        <View style={{ padding: space.sm }}>
                          <FeedBody
                            layout={layout}
                            slots={leftovers}
                            columns={gridColumns}
                            myUserId={myUserId}
                            onChanged={invalidate}
                            dimmed={dimSeen ? seen : null}
                          />
                        </View>
                      </SectionFrame>
                    ) : null}

                    {/*
                        Wat geen rubriek gevonden heeft, in hetzelfde raster
                        als het chronologische overzicht.

                        Het stond in rijen, en daar werd een enkel item de
                        volle breedte van de kolom: een korte liggende foto
                        die een halve pagina besloeg, met een call-kaart
                        eronder van dezelfde breedte. Dit is de staart van
                        de uitgave — van alles wat elders niet paste — en
                        dan is een raster eerlijker dan een reeks banden
                        die elk om evenveel aandacht vragen als de
                        uitgelichte vondst bovenaan.
                    */}
                    {order === "thematic" && leftovers.length > 0 ? (
                      <SectionFrame
                        index={liveSectionOffset + sections.length}
                        label="Verder deze week"
                      >
                        <View style={{ padding: space.sm }}>
                          <FeedBody
                            layout={layout}
                            slots={leftovers}
                            columns={gridColumns}
                            myUserId={myUserId}
                            onChanged={invalidate}
                            dimmed={dimSeen ? seen : null}
                          />
                        </View>
                      </SectionFrame>
                    ) : null}

                    <Colophon />
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
        onPress={() => setShareOpen(true)}
        onToTop={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        lifted={scrolled}
      />

      {/**
        * Hetzelfde lijstje als stap één van het deelscherm, want het ís
        * dezelfde lijst: `SHARE_KINDS`. Hier stonden vier handgeschreven
        * ingangen waarvan er één naar `kind=fragment` wees — een soort die
        * uit de kiezer verdwenen was. Je kreeg dus een ander antwoord op
        * dezelfde vraag, afhankelijk van welke plus je toevallig aantikte.
        * Nu kan dat niet meer uiteenlopen.
        */}
      <ActionSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Wat wil je delen?"
        actions={SHARE_KINDS.map((k) => ({
          label: k.menuLabel,
          icon: k.icon,
          onPress: () => router.push(`/post-compose?kind=${k.id}`),
        }))}
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
  minHeight,
  onChanged,
}: {
  post: PostWithAuthor;
  myUserId: string;
  wide: boolean;
  minHeight: number;
  onChanged: () => void;
}) {
  const router = useRouter();
  const menu = usePostMenu(post, myUserId, onChanged);

  return (
    <View>
      <FindHero
        post={post}
        wide={wide}
        minHeight={minHeight}
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

function CompactSection({
  slots,
  wide,
  myUserId,
  onChanged,
  dimmed,
}: {
  slots: Slot[];
  wide: boolean;
  myUserId: string;
  onChanged: () => void;
  /** Al geziene id's; `null` als dimmen uitstaat. */
  dimmed?: Set<string> | null;
}) {
  const rows = useMemo(() => {
    const out: Slot[][] = [];
    let buffer: Slot[] = [];
    const perRow = wide ? 4 : 2;
    for (const s of slots) {
      const isBand =
        s.item.type !== "post" || s.variant === "cover" || s.variant === "quote";
      if (isBand) {
        if (buffer.length) out.push(buffer);
        buffer = [];
        out.push([s]);
      } else {
        buffer.push(s);
        if (buffer.length === perRow) {
          out.push(buffer);
          buffer = [];
        }
      }
    }
    if (buffer.length) out.push(buffer);
    return out;
  }, [slots, wide]);

  return (
    <View>
      {rows.map((row, ri) => {
        const band = row.length === 1 && (
          row[0].item.type !== "post" ||
          row[0].variant === "cover" ||
          row[0].variant === "quote"
        );

        if (band) {
          return (
            <View
              key={`band-${ri}`}
              style={
                ri === 0
                  ? null
                  : { borderTopWidth: FEED_BORDER, borderTopColor: feedColor.ink }
              }
            >
              <CompactItem
                slot={row[0]}
                wide={wide}
                myUserId={myUserId}
                onChanged={onChanged}
                dimmed={dimmed}
              />
            </View>
          );
        }

        /** Zit er een foto in deze rij? Dan geeft de rij de hoogte. */
        const rowHasImage = row.some(
          (s) => s.variant === "tall" || s.variant === "caption"
        );

        // De tegelrij: scheidingslijnen ertussen, kader van de rubriek.
        return (
          <View
            key={`row-${ri}`}
            style={{
              flexDirection: "row",
              flexWrap: wide ? "nowrap" : "wrap",
              // Geen eigen kader en geen eigen marge meer: de rubriek is het
              // kader, en de rijen erbinnen worden gescheiden door een lijn.
              // Twee kaders om elkaar heen leest als twee dingen.
              ...(ri === 0
                ? null
                : { borderTopWidth: FEED_BORDER, borderTopColor: feedColor.ink }),
            }}
          >
            {row.map((s, ci) => (
              <View
                key={s.item.id}
                style={{
                  /**
                   * De hoogte staat op de cel en niet op de tegel: dan is
                   * elke tegel in de rij even hoog en vult de foto hem
                   * helemaal (zie ImageCell).
                   *
                   * Máár alleen als er een foto in de rij zit. Een rij met
                   * enkel notities kreeg dezelfde 380 pixels, en dan staat
                   * het woord "test" bovenaan een vlak van een halve
                   * pagina. Zonder beeld bepaalt de tekst de hoogte.
                   */
                  ...(rowHasImage ? { height: wide ? 380 : 260 } : null),
                  ...(wide
                    ? { flex: 1 }
                    : { width: "50%" as const }),
                  ...(ci < row.length - 1
                    ? { borderRightWidth: FEED_BORDER, borderRightColor: feedColor.ink }
                    : null),
                }}
              >
                <CompactItem
                  slot={s}
                  wide={wide}
                  myUserId={myUserId}
                  onChanged={onChanged}
                  dimmed={dimmed}
                />
              </View>
            ))}
          </View>
        );
      })}
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
/**
 * De stapel vondsten, in de gekozen weergave.
 *
 * Hier ging het mis: de weergaveknop zette wel `layout`, maar de pagina
 * keek er nergens naar — de ordening bepaalde óók de vorm. Dan lijkt een
 * knop stuk terwijl hij precies doet wat hem gevraagd is. Deze plek is het
 * enige punt waar die keuze uitkomt.
 */
function FeedBody({
  layout,
  slots,
  columns,
  myUserId,
  onChanged,
  dimmed,
}: {
  layout: FeedLayout;
  slots: Slot[];
  columns: number;
  myUserId: string;
  onChanged: () => void;
  dimmed?: Set<string> | null;
}) {
  if (layout === "grid") {
    return (
      <PostGrid
        posts={slots
          .map((slot) =>
            slot.item.type === "post" || slot.item.type === "memory"
              ? slot.item.data
              : null
          )
          .filter((post): post is PostWithAuthor => !!post)}
        emptyLabel="Nog niets gedeeld."
      />
    );
  }

  return (
    <ChronoGrid
      slots={slots}
      columns={columns}
      myUserId={myUserId}
      onChanged={onChanged}
      dimmed={dimmed}
    />
  );
}

/**
 * Het chronologische overzicht: een rooster.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT GEEN METSELWERK MEER IS
 * ---------------------------------------------------------------
 * Hier stond metselwerk: elke tegel hield zijn eigen hoogte en de kolommen
 * werden onafhankelijk van elkaar gevuld. Dat vult mooi uit, maar het kost
 * het enige wat dit overzicht te bieden heeft — de volgorde. Op web deed
 * `column-count` het werk, en die vult kolom voor kolom: de nieuwste vier
 * vondsten stonden ónder elkaar in de linkerkolom in plaats van naast
 * elkaar op de eerste rij. Je las de lijst dus van boven naar beneden en
 * dan pas weer naar rechts, terwijl er "nieuwste eerst" boven staat.
 *
 * Een rooster leest wél zoals je kijkt: van links naar rechts, rij voor
 * rij. Dat het onderin niet meer strak uitvult is de prijs, en die is hier
 * laag — een korte laatste rij houdt zijn lege cellen, dus de lijnen lopen
 * gewoon door.
 *
 * Het rooster is `IndexGrid` uit de rasterlaag (DESIGN.md §4c): cellen
 * zonder kaders, gescheiden door haarlijnen. Die laag lag klaar maar werd
 * nergens gebruikt — zie §8. Nu wel.
 */
function ChronoGrid({
  slots,
  columns,
  myUserId,
  onChanged,
  dimmed,
}: {
  slots: Slot[];
  columns: number;
  myUserId: string;
  onChanged: () => void;
  dimmed?: Set<string> | null;
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
          dimmed={dimmed}
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
  dimmed,
}: {
  slot: Slot;
  wide: boolean;
  myUserId: string;
  onChanged: () => void;
  dimmed?: Set<string> | null;
}) {
  const router = useRouter();
  const { item, variant, index } = slot;
  // Gedimd = al bekeken. Geen aparte kleur maar minder dekking: de tegel
  // blijft leesbaar, hij vraagt alleen geen aandacht meer.
  const isDim = !!dimmed?.has(item.id);
  const dimStyle = isDim ? { opacity: 0.42 } : null;

  if (item.type === "post") {
    return (
      <View style={[{ flex: 1 }, dimStyle]}>
      <PostTile
        post={item.data}
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
    : item.type === "memory" ? "Op deze dag"
    : "Activiteit";

  // Deze kaarten draaien nog op het warme shell/paper-palet en zijn nog niet
  // herstijld — ze staan daarom in een licht paneel met een etiket erboven,
  // net zoals in het vorige feed-ontwerp. Zie DESIGN.md §5.
  // Géén eigen kader: deze kaart staat ín het kader van zijn rubriek, en de
  // rij eromheen trekt de scheidingslijn al. Twee lijnen tegen elkaar aan
  // lezen als een dubbele rand — precies wat er stond.
  return (
    <View
      style={{
        backgroundColor: feedColor.panel,
        padding: space.md,
        ...(dimStyle ?? {}),
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
      {item.type === "activity" && <ActivityCard event={item.data} />}
      {item.type === "memory" && <MemoryCard post={item.data} />}
    </View>
  );
});

function PostTile({
  post,
  variant,
  index,
  wide,
  myUserId,
  onChanged,
  onPress,
}: {
  post: PostWithAuthor;
  variant: TileVariant;
  index: number;
  wide: boolean;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
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
              onChanged();
            },
          },
        ]}
      />

      <ModalShell
        visible={editOpen}
        onClose={() => setEditOpen(false)}
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
          <Pressable
            onPress={async () => {
              setSaving(true);
              try {
                await updatePostCaption(post.id, editCaption);
                setEditOpen(false);
                onChanged();
              } catch {
                // Het venster bleef openstaan met de knop weer actief, en
                // verder niets — niet te onderscheiden van "nog niet gedrukt".
                toast.error("De toelichting kon niet bewaard worden.");
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

function EmptyState({
  activeTag,
  wide,
}: {
  activeTag: string | null;
  wide: boolean;
}) {
  return (
    <View style={{ paddingVertical: 80 }}>
      <Text style={[feedType.heroSmall, { color: feedColor.ink }]}>
        {activeTag ? "Niets onder deze tag." : "Nog niets gedeeld."}
      </Text>
      <Text
        style={[
          feedType.body,
          { color: feedColor.inkDim, marginTop: 10, maxWidth: 460 },
        ]}
      >
        {activeTag
          ? "Probeer een andere tag, of deel zelf de eerste."
          : "Plak een link, tik een zin over uit wat je aan het lezen bent, of voeg vrienden toe."}
      </Text>
    </View>
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

/**
 * Het mozaïek: beelden tegen elkaar aan, met alleen de kaderlijn ertussen.
 *
 * De eerste tegel is dubbel zo hoog als de rest — dat geeft het blok een
 * ankerpunt in plaats van een egaal raster. De hoogtes staan vast in plaats
 * van uit het beeld te komen, want anders bepaalt de beeldverhouding van een
 * willekeurige foto de hele compositie.
 */
function MosaicGrid({
  slots,
  wide,
  myUserId,
  onChanged,
  dimmed,
}: {
  slots: Slot[];
  wide: boolean;
  myUserId: string;
  onChanged: () => void;
  dimmed?: Set<string> | null;
}) {
  if (slots.length === 0) return null;
  const [lead, ...rest] = slots;
  const cellH = wide ? 190 : 150;

  return (
    <View
      style={{
        flexDirection: wide ? "row" : "column",
        // De kier tussen twee cellen ís de lijn: de cellen liggen op dit
        // vlak en laten er 1.5px van zien. Nu een kaart geen eigen vulling
        // meer heeft, moet dat vlak de lijnkleur zijn en niet een vlakkleur.
        backgroundColor: rule.soft,
      }}
    >
      {/* De grote cel links. */}
      <View
        style={{
          height: cellH * 2,
          ...(wide
            ? { flex: 1.2, borderRightWidth: FEED_BORDER, borderRightColor: feedColor.ink }
            : { borderBottomWidth: FEED_BORDER, borderBottomColor: feedColor.ink }),
        }}
      >
        <CompactItem slot={lead} wide={wide} myUserId={myUserId} onChanged={onChanged} dimmed={dimmed} />
      </View>

      {/* De kleinere cellen rechts, twee per rij. */}
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
        {rest.map((slot, i) => (
          <View
            key={slot.item.id}
            style={{
              width: "50%",
              height: cellH,
              borderBottomWidth: i < 2 ? FEED_BORDER : 0,
              borderRightWidth: i % 2 === 0 ? FEED_BORDER : 0,
              borderColor: feedColor.ink,
            }}
          >
            <CompactItem slot={slot} wide={wide} myUserId={myUserId} onChanged={onChanged} dimmed={dimmed} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Eén cel van de ordening-schakelaar. */
/** Wat elke knop doet — ook voor wie de app met een schermlezer gebruikt. */
const LAYOUT_TAB_LABELS: Record<
  "mosaic" | "grid" | "thematic" | "chrono" | "dim",
  string
> = {
  mosaic: "Metselwerk",
  grid: "Raster",
  thematic: "In rubrieken",
  chrono: "Nieuwste eerst",
  dim: "Gelezen dimmen",
};

const LAYOUT_TAB_ICONS = {
  thematic: "albums-outline",
  chrono: "time-outline",
  dim: "eye-off-outline",
} as const;

/**
 * Eén knop in de weergavekeuze: een tekening, geen woord.
 *
 * De tekening ís de uitleg — twee kolommen met blokken van verschillende
 * hoogte tegenover negen gelijke vierkanten. Wie het één keer ziet, weet
 * meteen wat de knop doet, in welke taal hij de app ook leest.
 */
function LayoutTab({
  kind,
  active,
  onPress,
  divider = false,
}: {
  kind: "mosaic" | "grid" | "thematic" | "chrono" | "dim";
  active: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  const tint = active ? feedColor.lav : feedColor.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={LAYOUT_TAB_LABELS[kind]}
      style={{
        // Vaste breedte in plaats van `flex: 1`: deze knoppen staan nu in
        // groepjes van één of twee, en dan hoort een knop niet mee te
        // rekken met de breedte van het scherm.
        width: CONTROL_H + space.md,
        alignItems: "center",
        justifyContent: "center",
        height: CONTROL_H,
        backgroundColor: active ? feedColor.ink : "transparent",
        ...(divider
          ? { borderLeftWidth: FEED_BORDER, borderLeftColor: feedColor.ink }
          : null),
      }}
    >
      {kind === "mosaic" || kind === "grid" ? (
        <LayoutGlyph kind={kind} color={tint} />
      ) : (
        <Ionicons name={LAYOUT_TAB_ICONS[kind]} size={20} color={tint} />
      )}
    </Pressable>
  );
}

/**
 * De tekening zelf, opgebouwd uit vlakjes.
 *
 * Geen icoonlettertype en geen SVG-bestand: dit zijn zes rechthoekjes, en
 * die tekenen we met dezelfde bouwstenen als de rest van het scherm. Zo
 * volgt hij vanzelf de kleur van de knop waar hij in staat.
 */
function LayoutGlyph({ kind, color }: { kind: "mosaic" | "grid"; color: string }) {
  const box = (w: number, h: number, key: string) => (
    <View key={key} style={{ width: w, height: h, backgroundColor: color }} />
  );

  if (kind === "grid") {
    return (
      <View style={{ flexDirection: "row", gap: 2 }}>
        {[0, 1, 2].map((c) => (
          <View key={c} style={{ gap: 2 }}>
            {[0, 1, 2].map((r) => box(6, 6, `${c}-${r}`))}
          </View>
        ))}
      </View>
    );
  }

  // Metselwerk: twee kolommen, blokken van verschillende hoogte.
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      <View style={{ gap: 2 }}>
        {box(9, 12, "a")}
        {box(9, 6, "b")}
      </View>
      <View style={{ gap: 2 }}>
        {box(9, 6, "c")}
        {box(9, 12, "d")}
      </View>
    </View>
  );
}
