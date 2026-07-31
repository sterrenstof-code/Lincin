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
import { AppChrome, useChromeScroll } from "@/components/AppChrome";
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
} from "@/lib/design/type";
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
 * pixelreferentie en `DESIGN_V3_FEED.md` voor het ontwerpverslag.
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

/** Paginabreedte van de uitgave. */
const PAGE_MAX = 1280;

/**
 * Het vaste ritme van de compacte sectie: één cover-band, een rij van vier
 * tegels, één citaatband. Daarna herhaalt het.
 */
const TILE_CYCLE: TileVariant[] = ["cover", "tall", "text", "stat", "caption", "quote"];

/**
 * Welk soort vondst het béste in welke maat past. Dit is de "soort"-helft
 * van de hybride toewijzing: binnen elk blok van zes krijgt elke plek eerst
 * een passend soort aangeboden, en valt hij anders terug op het vaste ritme
 * hierboven. Zo staat een fragment in de citaatband en een video in de hoge
 * beeldtegel, zónder dat een vondst ooit kan blijven wachten op een plek.
 *
 * Dit is nadrukkelijk géén ranking: de volgorde van de blokken blijft
 * chronologisch, en er wordt alleen bínnen een blok van zes geschoven.
 */
const SLOT_PREFERENCE: Record<TileVariant, FindKind[]> = {
  cover: ["link", "video", "image"],
  tall: ["video", "image"],
  text: ["link", "note"],
  stat: ["fact", "idea"],
  caption: ["image", "music"],
  quote: ["fragment", "fact", "idea"],
};

type Slot = { variant: TileVariant; item: FeedItem; index: number };

/**
 * Deelt de resterende feed op in blokken van zes en wijst binnen elk blok
 * de plekken toe: eerst op soort, dan op volgorde.
 *
 * Niet-posts (herinnering, poll, call, lijst, activiteit) doen niet mee aan
 * de tegeltoewijzing — die houden hun eigen kaart en krijgen een eigen band.
 */
function assignSlots(items: FeedItem[]): Slot[] {
  const out: Slot[] = [];
  let counter = 0;
  let window: FeedItem[] = [];

  const flush = () => {
    if (window.length === 0) return;
    const remaining = [...window];
    for (const variant of TILE_CYCLE) {
      if (remaining.length === 0) break;
      const prefs = SLOT_PREFERENCE[variant];
      let pick = remaining.findIndex(
        (i) => i.type === "post" && prefs.includes(i.data.kind ?? "note")
      );
      // Geen passend soort in dit blok? Dan gewoon de volgende op volgorde.
      if (pick === -1) pick = 0;
      const [item] = remaining.splice(pick, 1);
      counter += 1;
      out.push({ variant, item, index: counter });
    }
    window = [];
  };

  for (const item of items) {
    if (item.type !== "post") {
      // De band van een niet-post breekt het blok niet open: we plaatsen hem
      // op zijn chronologische plek en gaan daarna verder met het ritme.
      flush();
      counter += 1;
      out.push({ variant: "text", item, index: counter });
      continue;
    }
    window.push(item);
    if (window.length === TILE_CYCLE.length) flush();
  }
  flush();
  return out;
}

export default function FeedScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { width, height } = useWindowDimensions();
  const wide = width >= FEED_BREAKPOINT;
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // De kop staat buiten de ScrollView; deze hook koppelt de scrollstand
  // aan de inklap-animatie van de woordmerk-plaat.
  const chrome = useChromeScroll();

  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    refetchOnWindowFocus: true,
  });

  // Eigen profiel voor het account-kaartje in de zijbalk.
  const me = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: async () => (await getProfiles([myUserId]))[0] ?? null,
    staleTime: 5 * 60_000,
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
  const { hero, slots } = useMemo(() => {
    let items = feed.data ?? [];
    if (activeTag) {
      items = items.filter(
        (i) =>
          (i.type === "post" || i.type === "memory") &&
          (i.data.tags ?? []).includes(activeTag)
      );
    }
    const heroIndex = items.findIndex((i) => i.type === "post");
    if (heroIndex === -1) return { hero: null, slots: assignSlots(items) };
    return {
      hero: items[heroIndex] as Extract<FeedItem, { type: "post" }>,
      slots: assignSlots(items.filter((_, i) => i !== heroIndex)),
    };
  }, [feed.data, activeTag]);

  const onRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const empty = !hero && slots.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      <AppChrome wide={wide} progress={chrome.progress} />

      <ScrollView
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        showsVerticalScrollIndicator={false}
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
            maxWidth: PAGE_MAX,
            alignSelf: "center",
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
                    ({ position: "sticky", top: 16, alignSelf: "flex-start" } as any)
                  : undefined
              }
            >
              <FeedRail
                wide={wide}
                displayName={me.data?.display_name ?? me.data?.username ?? "Jij"}
                avatarUrl={me.data?.avatar_url ?? null}
                onShare={() => router.push("/post-compose")}
                onProfile={() => router.push("/profile")}
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
                    <Text
                      style={[
                        feedType.kicker,
                        { color: "#3A3540", letterSpacing: 0.55, marginBottom: 22 },
                      ]}
                    >
                      MEER VONDSTEN DEZE WEEK
                    </Text>

                    {tags.length > 0 ? (
                      <TagStrip
                        tags={tags}
                        active={activeTag}
                        onPick={(t) => setActiveTag(t === activeTag ? null : t)}
                      />
                    ) : null}

                    <CompactSection
                      slots={slots}
                      wide={wide}
                      myUserId={myUserId}
                      onChanged={invalidate}
                    />

                    <Colophon />
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={{ height: wide ? 24 : 16 }} />
        </View>
      </ScrollView>
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
        onPress={() => router.push(`/post/${post.id}`)}
        onMenu={menu.isMine ? menu.open : undefined}
      />
      <View style={{ paddingHorizontal: wide ? 24 : 10, paddingTop: 12 }}>
        <PostReactions postId={post.id} tone="feed" />
        <CommentsSection
          entityType="post"
          entityId={post.id}
          ownerId={post.user_id}
          initialCount={post.comment_count}
          tone="feed"
        />
      </View>
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
}: {
  slots: Slot[];
  wide: boolean;
  myUserId: string;
  onChanged: () => void;
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
}: {
  slot: Slot;
  wide: boolean;
  myUserId: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { item, variant, index } = slot;

  if (item.type === "post") {
    return (
      <PostTile
        post={item.data}
        variant={variant}
        index={index}
        wide={wide}
        myUserId={myUserId}
        onChanged={onChanged}
        onPress={() => router.push(`/post/${item.data.id}`)}
      />
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
  // net zoals in het vorige feed-ontwerp. Zie DESIGN.md §10.
  return (
    <Frame filled style={{ padding: 12 }}>
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
