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
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { ModalShell } from "@/components/ModalShell";
import { ActivityCard } from "@/components/ActivityCard";
import { CallPlanCard } from "@/components/CallPlanCard";
import { CommentsSection } from "@/components/CommentsSection";
import { Meta } from "@/components/Editorial";
import { listMyEvents } from "@/lib/api/events";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { EventCard } from "@/components/EventCard";
import { ShareButton } from "@/components/FeedChrome";
import {
  FindHero,
  FindTile,
  tileShapeFor,
  type TileVariant,
} from "@/components/FindBody";
import { MemoryCard } from "@/components/MemoryCard";
import { PollCard } from "@/components/PollCard";
import { PostReactions } from "@/components/PostReactions";
import { SectionBand } from "@/components/SectionBand";
import { SharedListCard } from "@/components/SharedListCard";
import { useAuth } from "@/lib/auth/provider";
import {
  CONTROL_H,
  feed as feedColor,
  FEED_BORDER,
  FEED_BREAKPOINT,
  feedType,
  space,
} from "@/lib/design/type";
import { withHeroTransition } from "@/lib/hero-transition";
import { useFeedPrefs } from "@/lib/feed-prefs";
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
  const [activeTag, setActiveTag] = useState<string | null>(null);
  /**
   * De twee leesvoorkeuren:
   *   `sort`     `thematic` groepeert in rubrieken (zie SECTIONS),
   *              `chrono` gooit alles op één hoop, nieuwste eerst.
   *   `dimSeen`  al bekeken vondsten worden uitgegrijsd.
   *
   * Beide zijn een keuze van de lezer en geen instelling die de app voor
   * je maakt — dus onthouden we ze, per gebruiker, op dit toestel. Zie
   * lib/feed-prefs.ts voor waarom dat lokaal blijft.
   */
  const { prefs, setSort, setDimSeen } = useFeedPrefs(myUserId);
  const { sort, dimSeen } = prefs;
  const { seen } = useSeenPosts();
  /** Wát je deelt kies je na de plus — zie de zijbalk. */
  const [shareOpen, setShareOpen] = useState(false);
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
    if (sort === "chrono") {
      const flat: Slot[] = items.map((item, i) => ({
        variant: "grid",
        item,
        index: i + 1,
      }));
      return { hero: null, sections: [] as Section[], leftovers: flat };
    }

    return { hero, ...buildSections(rest) };
  }, [feed.data, activeTag, sort]);

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
        wide={wide}
        progress={chrome.progress}
        onScroll={onFeedScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        gutter={false}
        refreshControl={
          <RefreshControl
            refreshing={feed.isFetching && !feed.isLoading}
            onRefresh={onRefresh}
            tintColor={feedColor.ink}
          />
        }
      >
        <View
          style={{
            width: "100%",
            alignSelf: "stretch",
            paddingHorizontal: wide ? 24 : 16,
            paddingTop: 0,
          }}
        >
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
              {feed.isLoading ? (
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

                  <View
                    style={{
                      paddingHorizontal: wide ? 32 : 18,
                      paddingTop: 48,
                      paddingBottom: 80,
                    }}
                  >
                    {/* Ordening + leesstatus. Twee vragen, geen
                        instellingenscherm: dit is iets wat je terwijl je
                        leest wil kunnen omzetten.

                        Hij plakte onder de kop zodra je hem voorbij scrolde.
                        Dat is één plakkend ding te veel op een pagina waar
                        de kop al blijft staan: je kiest je ordening als je
                        begint, niet halverwege, en wat wél mee moet scrollen
                        is de knop om zelf iets te delen. Zie de zijbalk. */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginBottom: space.xl,
                      }}
                    >
                      {/* Eén kader om alle drie de schakelaars.
                          Ze stonden in twee losse doosjes die op een smal
                          scherm onder elkaar vielen: twee kaders, twee
                          hoogtes, en een gat ertussen. Het zijn drie
                          standen van dezelfde vraag — hoe wil je kijken —
                          en dus één kader met cellen erin, net als de
                          tabstrip in de kop. */}
                      <View
                        style={{
                          borderWidth: FEED_BORDER,
                          borderColor: feedColor.ink,
                          alignSelf: "stretch",
                        }}
                      >
                        <View style={{ flexDirection: "row" }}>
                          <SortTab
                            label="Thematisch"
                            active={sort === "thematic"}
                            onPress={() => setSort("thematic")}
                          />
                          <SortTab
                            label="Chronologisch"
                            active={sort === "chrono"}
                            onPress={() => setSort("chrono")}
                            divider
                          />
                          {/* Op een breed scherm past de derde ernaast. */}
                          {wide ? (
                            <SortTab
                              label="Gelezen dimmen"
                              active={dimSeen}
                              onPress={() => setDimSeen(!dimSeen)}
                              divider
                            />
                          ) : null}
                        </View>

                        {/*
                            Op een smal scherm gaat hij naar de volgende
                            regel, over de volle breedte.

                            Als derde cel naast de andere twee brak "Gelezen
                            dimmen" over twee regels terwijl zijn buren er
                            één hadden — dan lijkt die cel voller en dus
                            belangrijker, terwijl het de minst ingrijpende
                            van de drie is. Een eigen regel is eerlijker dan
                            een woord afknijpen.
                        */}
                        {wide ? null : (
                          <View
                            style={{
                              borderTopWidth: FEED_BORDER,
                              borderTopColor: feedColor.ink,
                            }}
                          >
                            <SortTab
                              label="Gelezen dimmen"
                              active={dimSeen}
                              onPress={() => setDimSeen(!dimSeen)}
                            />
                          </View>
                        )}
                      </View>
                    </View>

                    {tags.length > 0 ? (
                      <TagStrip
                        tags={tags}
                        active={activeTag}
                        onPick={(t) => setActiveTag(t === activeTag ? null : t)}
                      />
                    ) : null}

                    {sort === "thematic" && (liveEvents.data?.length ?? 0) > 0 ? (
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
                        {section.layout === "mosaic" ? (
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

                    {sort === "chrono" && leftovers.length > 0 ? (
                      <SectionFrame index={0} label="Alles, nieuwste eerst">
                        {/* Dezelfde kier rondom als tussen de tegels, anders
                            plakt de buitenste rij tegen het kader. */}
                        <View style={{ padding: space.sm }}>
                        <MasonryGrid
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
                    {sort !== "chrono" && leftovers.length > 0 ? (
                      <SectionFrame
                        index={liveSectionOffset + sections.length}
                        label="Verder deze week"
                      >
                        <View style={{ padding: space.sm }}>
                        <MasonryGrid
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
      <FloatingShare onPress={() => setShareOpen(true)} lifted={scrolled} />

      <ActionSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Wat wil je delen?"
        actions={[
          {
            label: "Foto's",
            icon: "images-outline",
            onPress: () => router.push("/post-compose?kind=image"),
          },
          {
            label: "Een link",
            icon: "link-outline",
            onPress: () => router.push("/post-compose?kind=link"),
          },
          {
            label: "Een fragment",
            icon: "text-outline",
            onPress: () => router.push("/post-compose?kind=fragment"),
          },
          {
            label: "Een notitie",
            icon: "create-outline",
            onPress: () => router.push("/post-compose?kind=note"),
          },
        ]}
      />
    </SafeAreaView>
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
            <PostReactions postId={post.id} tone="feed" />
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
function FloatingShare({ onPress, lifted }: { onPress: () => void; lifted: boolean }) {
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
      <ShareButton onPress={onPress} />
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
        borderColor: feedColor.ink,
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
 * Het chronologische overzicht: metselwerk.
 *
 * ---------------------------------------------------------------
 * WAAROM KOLOMMEN EN GEEN RIJEN
 * ---------------------------------------------------------------
 * Hier stond een raster van gelijke cellen. Dat betekent dat élke tegel de
 * hoogte van de hoogste in zijn rij aanneemt, en dus dat elke staande foto
 * werd bijgesneden tot de vorm van zijn buurman. In een overzicht waar de
 * volgorde het enige is dat telt, is de vorm van een foto juist het enige
 * wat de een van de ander onderscheidt — dus houdt elke tegel zijn eigen
 * hoogte en stapelen we ze in kolommen.
 *
 * Wie de kolommen vult, verschilt per platform — zie hieronder.
 */
function MasonryGrid({
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
   * In een kolom bepaalt de tegel zelf zijn hoogte — er is geen rij die
   * hem er een geeft. De vormen uit de rubrieken vullen juist de hoogte
   * die ze krijgen, en zouden hier dus tot niets inklappen. Elke vondst
   * krijgt daarom de rastervorm: beeld op zijn eigen verhouding, tekst
   * eronder. Wat geen vondst is (activiteit, call, lijst) houdt zijn
   * eigen kaart.
   */
  const cells = slots.map((slot) =>
    slot.item.type === "post" ? { ...slot, variant: "grid" as TileVariant } : slot
  );

  /**
   * Op web verdeelt de browser zelf: `column-count` maakt de kolommen even
   * lang, en hij kent de hoogtes wél — hij heeft ze net gemeten. Dat is het
   * verschil met om de beurt verdelen: dat is voorspelbaar maar houdt geen
   * rekening met wat er ín een tegel zit, en dan eindigt de ene kolom een
   * halve pagina eerder dan de andere.
   *
   * `display: block` moet erbij, want react-native-web zet elke View op
   * flex en een flexcontainer kent geen kolommen. `break-inside: avoid`
   * houdt een tegel heel; zonder dat knipt de browser hem halverwege af.
   */
  if (Platform.OS === "web") {
    return (
      <View
        style={
          {
            display: "block",
            columnCount: columns,
            // Een kier van één lijnbreedte was te strak: dan lopen twee
            // donkere tegels in elkaar over en zie je niet meer waar de een
            // ophoudt. Een klein beetje lucht — het paginavlak dat ertussen
            // doorkomt — houdt ze uit elkaar zonder dat het losse kaartjes
            // worden.
            columnGap: space.sm,
          } as any
        }
      >
        {cells.map((slot) => (
          <View
            key={slot.item.id}
            style={{ breakInside: "avoid", marginBottom: space.sm } as any}
          >
            <CompactItem
              slot={slot}
              wide={columns > 1}
              myUserId={myUserId}
              onChanged={onChanged}
              dimmed={dimmed}
            />
          </View>
        ))}
      </View>
    );
  }

  // Native kent `column-count` niet: daar blijft het om de beurt. Dezelfde
  // volgorde, alleen minder strak uitgevuld.
  const buckets: Slot[][] = Array.from({ length: columns }, () => []);
  cells.forEach((slot, i) => buckets[i % columns].push(slot));

  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {buckets.map((bucket, ci) => (
        <View key={ci} style={{ flex: 1, minWidth: 0, gap: space.sm }}>
          {bucket.map((slot) => (
            <CompactItem
              key={slot.item.id}
              slot={slot}
              wide={columns > 1}
              myUserId={myUserId}
              onChanged={onChanged}
              dimmed={dimmed}
            />
          ))}
        </View>
      ))}
    </View>
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
              } catch (e: any) {
                console.warn("updatePostCaption", e?.message ?? e);
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
            <Text style={[feedType.label, { color: feedColor.text }]}>
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
    <View style={{ paddingHorizontal: wide ? 32 : 18, paddingVertical: 80 }}>
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
    <View
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feedColor.ink,
        backgroundColor: feedColor.ink,
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 44,
        alignItems: "center",
      }}
    >
      <Text style={[feedType.cover, { color: feedColor.text }]}>Je bent bij.</Text>
      <Text
        style={[
          feedType.body,
          {
            color: feedColor.textDim,
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
        backgroundColor: feedColor.post,
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
function SortTab({
  label,
  active,
  onPress,
  divider = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        // Gelijke cellen: drie standen van dezelfde vraag horen even breed
        // te zijn, anders leest de langste als de belangrijkste.
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.md,
        height: CONTROL_H,
        backgroundColor: active ? feedColor.ink : "transparent",
        ...(divider
          ? { borderLeftWidth: FEED_BORDER, borderLeftColor: feedColor.ink }
          : null),
      }}
    >
      <Text
        style={[feedType.label, { color: active ? feedColor.lav : feedColor.ink }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
