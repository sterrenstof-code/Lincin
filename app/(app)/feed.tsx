import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { ActivityCard } from "@/components/ActivityCard";
import { CallPlanCard } from "@/components/CallPlanCard";
import { CommentsSection } from "@/components/CommentsSection";
import { Meta } from "@/components/Editorial";
import { CHROME_COMPACT_H, PageScroll, useChromeScroll } from "@/components/AppChrome";
import { FeedRail, Frame } from "@/components/FeedChrome";
import { FindHero, FindTile, type TileVariant } from "@/components/FindBody";
import { MemoryCard } from "@/components/MemoryCard";
import { PollCard } from "@/components/PollCard";
import { PostReactions } from "@/components/PostReactions";
import { SharedListCard } from "@/components/SharedListCard";
import { useAuth } from "@/lib/auth/provider";
import {
  feed as feedColor,
  FEED_BORDER,
  FEED_BREAKPOINT,
  feedType,
  flameDeep,
} from "@/lib/design/type";
import { withHeroTransition } from "@/lib/hero-transition";
import { useFeedPrefs } from "@/lib/feed-prefs";
import { useSeenPosts } from "@/lib/read-state";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { getProfiles } from "@/lib/api/profiles";
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
 * één gedeeld kader met twee zones: een smalle zijbalk (alleen "iets delen"
 * plus wie je bent — de navigatie zit al in de kop) en de hoofdkolom met een
 * uitgelichte vondst van ~88vh, gevolgd door de compacte sectie met
 * wisselend grote tegels. Onder 800px stapelt alles.
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
type SectionRule = "discussed" | "recent" | "visual" | "words";

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

const SECTIONS: SectionDef[] = [
  { key: "featured",  label: "Uitgelicht",              rule: "discussed", layout: "cover",  limit: 1 },
  { key: "discussed", label: "Waar over gepraat wordt", rule: "discussed", layout: "tiles",  limit: 4 },
  { key: "recent",    label: "Nieuw deze week",         rule: "recent",    layout: "tiles",  limit: 4 },
  { key: "visual",    label: "Beeld",                   rule: "visual",    layout: "mosaic", limit: 5 },
  { key: "words",     label: "In woorden",              rule: "words",     layout: "words",  limit: 3 },
];

/** Soorten die in de beeldrubriek thuishoren. */
const VISUAL_KINDS: FindKind[] = ["image", "video", "music"];
/** Soorten die in de woordenrubriek thuishoren. */
const WORD_KINDS: FindKind[] = ["fragment", "fact", "idea", "note"];

type Slot = { variant: TileVariant; item: FeedItem; index: number };
type Section = { key: string; label: string; layout: SectionLayout; slots: Slot[] };

/** De tegelmaten binnen een gewone tegelrij, op volgorde. */
const TILE_CYCLE: TileVariant[] = ["tall", "text", "stat", "caption"];

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
    if (rule === "discussed") {
      // Meest besproken eerst. Bij gelijk aantal wint de nieuwste, zodat een
      // oude post met twee reacties niet eeuwig bovenaan blijft staan.
      pool = [...pool].sort((a, b) => {
        const d = (b.data.comment_count ?? 0) - (a.data.comment_count ?? 0);
        if (d !== 0) return d;
        return (
          new Date(b.data.created_at).getTime() -
          new Date(a.data.created_at).getTime()
        );
      });
      // Zonder enige reactie is er niets om "besproken" aan te noemen.
      pool = pool.filter((p) => (p.data.comment_count ?? 0) > 0);
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
        : TILE_CYCLE[i % TILE_CYCLE.length];
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
      item.type !== "post" ? "text" : TILE_CYCLE[leftovers.length % TILE_CYCLE.length];
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
  // De kop staat buiten de ScrollView; deze hook koppelt de scrollstand
  // aan de inklap-animatie van de woordmerk-plaat.
  const chrome = useChromeScroll();

  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    refetchOnWindowFocus: true,
  });

  // Eigen profiel voor het persoonlijke blok in de zijbalk.
  const me = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: async () => (await getProfiles([myUserId]))[0] ?? null,
    staleTime: 5 * 60_000,
  });

  // Zelfde sleutel als in (app)/_layout — react-query dedupliceert, dus dit
  // kost geen extra verzoek. Voedt het telletje naast "Meldingen".
  const unreadNotifications = useQuery({
    queryKey: ["notifications-unread", myUserId],
    queryFn: () => countUnreadNotifications(myUserId),
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

    // Chronologisch: geen rubrieken, alles op volgorde in het vaste ritme.
    if (sort === "chrono") {
      let n = 0;
      const flat: Slot[] = rest.map((item) => {
        n += 1;
        return {
          variant:
            item.type !== "post" ? "text" : TILE_CYCLE[(n - 1) % TILE_CYCLE.length],
          item,
          index: n,
        };
      });
      return { hero, sections: [] as Section[], leftovers: flat };
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

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* De kop staat buiten deze scroller en is absoluut verankerd —
          zie PageScroll voor waarom stickyHeaderIndices hier niet volstaat. */}
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
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
          {/* Eén gedeeld kader om zijbalk én hoofdkolom, zoals de mockup:
              de zijbalk heeft een scheidingslijn rechts, geen eigen doos.

              De richting staat bewust in `style` en niet in een `flex-row`-
              class: als NativeWind niet meedoet (stale CSS, Metro-cache) zou
              de hele pagina anders stilletjes op één kolom terugvallen. */}
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              alignItems: "stretch",
              marginTop: 16,
              borderWidth: FEED_BORDER,
              borderColor: feedColor.ink,
            }}
          >
            <View
              style={
                wide && Platform.OS === "web"
                  ? // `position: sticky` bestaat alleen op web. Op native
                    // scrollt de zijbalk mee; dat is daar het verwachte gedrag.
                    //
                    // De bovenmarge is de hoogte van de ingeklapte kop plus
                    // wat lucht: die kop zweeft absoluut over de pagina, dus
                    // een zijbalk die zich op 16px vastzet kruipt eronder —
                    // "Iets delen" verdween achter de zwarte balk.
                    ({
                      position: "sticky",
                      top: CHROME_COMPACT_H + 16,
                      alignSelf: "flex-start",
                    } as any)
                  : undefined
              }
            >
              <FeedRail
                wide={wide}
                displayName={me.data?.display_name ?? me.data?.username ?? "Jij"}
                avatarUrl={me.data?.avatar_url ?? null}
                onShare={() => router.push("/post-compose")}
                onProfile={() => router.push("/profile")}
                onNotifications={() => router.push("/notifications")}
                onSettings={() => router.push("/profile-edit")}
                unreadNotifications={unreadNotifications.data ?? 0}
              />
            </View>

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
                    {/* Ordening + leesstatus. Twee schakelaars, geen
                        instellingenscherm: dit is iets wat je terwijl je
                        leest wil kunnen omzetten. */}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "center",
                        marginBottom: 22,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          borderWidth: FEED_BORDER,
                          borderColor: feedColor.ink,
                          marginRight: 12,
                        }}
                      >
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
                      </View>

                      <Pressable
                        onPress={() => setDimSeen(!dimSeen)}
                        style={{
                          borderWidth: FEED_BORDER,
                          borderColor: feedColor.ink,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          backgroundColor: dimSeen ? feedColor.ink : "transparent",
                        }}
                      >
                        <Text
                          style={[
                            feedType.label,
                            { color: dimSeen ? feedColor.lav : feedColor.ink },
                          ]}
                        >
                          Gelezen dimmen
                        </Text>
                      </Pressable>
                    </View>

                    {tags.length > 0 ? (
                      <TagStrip
                        tags={tags}
                        active={activeTag}
                        onPick={(t) => setActiveTag(t === activeTag ? null : t)}
                      />
                    ) : null}

                    {sections.map((section) => (
                      <View key={section.key} style={{ marginBottom: 40 }}>
                        <Text
                          style={[
                            feedType.kicker,
                            { color: flameDeep, letterSpacing: 0.55, marginBottom: 18 },
                          ]}
                        >
                          {section.label.toUpperCase()}
                        </Text>
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
                      </View>
                    ))}

                    {leftovers.length > 0 ? (
                      <View style={{ marginBottom: 40 }}>
                        <Text
                          style={[
                            feedType.kicker,
                            { color: "#3A3540", letterSpacing: 0.55, marginBottom: 18 },
                          ]}
                        >
                          VERDER DEZE WEEK
                        </Text>
                        <CompactSection
                          slots={leftovers}
                          wide={wide}
                          myUserId={myUserId}
                          onChanged={invalidate}
                          dimmed={dimSeen ? seen : null}
                        />
                      </View>
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
            <View key={`band-${ri}`} style={{ marginTop: ri === 0 ? 0 : 16 }}>
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

        // De tegelrij: één kader eromheen, scheidingslijnen ertussen.
        return (
          <View
            key={`row-${ri}`}
            style={{
              flexDirection: "row",
              flexWrap: wide ? "nowrap" : "wrap",
              marginTop: ri === 0 ? 0 : 16,
              borderWidth: FEED_BORDER,
              borderColor: feedColor.ink,
              backgroundColor: feedColor.post,
            }}
          >
            {row.map((s, ci) => (
              <View
                key={s.item.id}
                style={{
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
  return (
    <Frame filled style={{ padding: 12, ...(dimStyle ?? {}) }}>
      <View style={{ marginBottom: 8 }}>
        <Meta tone="feed" caps>
          {label}
        </Meta>
      </View>
      {item.type === "poll" && <PollCard poll={item.data} onDeleted={onChanged} />}
      {item.type === "call_plan" && <CallPlanCard plan={item.data} />}
      {item.type === "shared_list" && <SharedListCard list={item.data} />}
      {item.type === "activity" && <ActivityCard event={item.data} />}
      {item.type === "memory" && <MemoryCard post={item.data} />}
    </Frame>
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

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            backgroundColor: "rgba(11,10,12,0.55)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{ borderTopWidth: FEED_BORDER, borderTopColor: feedColor.ink }}
            className="bg-feed-panel px-6 pt-6 pb-9"
          >
            <View className="flex-row items-center mb-4">
              <View className="flex-1">
                <Meta tone="feed" strong>
                  Toelichting bewerken
                </Meta>
              </View>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <Ionicons name="close" color={feedColor.ink} size={22} />
              </Pressable>
            </View>
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
                  paddingHorizontal: 14,
                  paddingVertical: 12,
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
              className="mt-4 bg-feed-ink py-4 items-center"
            >
              <Text style={[feedType.label, { color: feedColor.text }]}>
                {saving ? "Bewaren…" : "Bewaren"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
        borderWidth: FEED_BORDER,
        borderColor: feedColor.ink,
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
        paddingHorizontal: 14,
        paddingVertical: 9,
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
