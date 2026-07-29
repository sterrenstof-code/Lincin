import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { ActivityCard } from "@/components/ActivityCard";
import { CallPlanCard } from "@/components/CallPlanCard";
import { CommentsSection } from "@/components/CommentsSection";
import {
  BoxButton,
  Kicker,
  Logo,
  Meta,
  Rule,
  SectionHead,
  Sheet,
  useWide,
} from "@/components/Editorial";
import { FindBody } from "@/components/FindBody";
import { MemoryCard } from "@/components/MemoryCard";
import { PollCard } from "@/components/PollCard";
import { PostReactions } from "@/components/PostReactions";
import { SharedListCard } from "@/components/SharedListCard";
import { useAuth } from "@/lib/auth/provider";
import { carbon, page, type } from "@/lib/design/type";
import {
  collectTags,
  deletePost,
  KIND_LABELS,
  listUnifiedFeed,
  updatePostCaption,
  type FeedItem,
  type PostWithAuthor,
} from "@/lib/api/posts";

/**
 * De feed als gedrukte pagina.
 *
 * Bovenaan staat alleen het merk en één knop. Geen scherm-titel, geen
 * ondertitel, geen kolommenkop — de inhoud is de titel. Daaronder banden
 * die van rand tot rand lopen, gescheiden door haarlijnen.
 *
 * Op desktop klapt elke band open naar de tweekolomsstructuur van het
 * affiche: etiket links, inhoud rechts. Op telefoon staat het etiket
 * gewoon boven de inhoud.
 *
 * Wat hier bewust niet staat: een algoritme, een bereikteller, oneindig
 * scrollen. De pagina eindigt, en dat einde is een zwarte voet.
 */

type Section = "vandaag" | "week" | "eerder";

const SECTION_LABELS: Record<Section, string> = {
  vandaag: "Vandaag",
  week: "Deze week",
  eerder: "Eerder",
};

function sectionOf(iso: string): Section {
  const age = Date.now() - new Date(iso).getTime();
  if (age < 24 * 60 * 60 * 1000) return "vandaag";
  if (age < 7 * 24 * 60 * 60 * 1000) return "week";
  return "eerder";
}

type Row = { item: FeedItem; section: Section | null };

export default function FeedScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    refetchOnWindowFocus: true,
  });

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
    }, [qc, myUserId])
  );

  const tags = useMemo(() => collectTags(feed.data ?? []).slice(0, 12), [feed.data]);

  const rows = useMemo<Row[]>(() => {
    let items = feed.data ?? [];
    if (activeTag) {
      items = items.filter(
        (i) =>
          (i.type === "post" || i.type === "memory") &&
          (i.data.tags ?? []).includes(activeTag)
      );
    }
    let previous: Section | null = null;
    return items.map((item) => {
      if (item.type === "memory") return { item, section: null };
      const section = sectionOf(item.created_at);
      const head = section === previous ? null : section;
      previous = section;
      return { item, section: head };
    });
  }, [feed.data, activeTag]);

  const onRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }, [qc, myUserId]);

  const renderItem = useCallback(
    ({ item: row }: { item: Row }) => (
      <View>
        {row.section ? <SectionHead label={SECTION_LABELS[row.section]} /> : <Rule />}
        <FeedRow item={row.item} myUserId={myUserId} onChanged={invalidate} wide={wide} />
      </View>
    ),
    [myUserId, invalidate, wide]
  );

  return (
    <SafeAreaView className="flex-1 bg-page" edges={["top"]}>
      {/* Kop — merk links, één knop rechts. Verder niets. */}
      <View className="bg-page">
        <Sheet>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 24,
              paddingVertical: 16,
            }}
          >
            <Logo />
            <BoxButton
              label="Iets delen"
              filled
              onPress={() => router.push("/post-compose")}
            />
          </View>
        </Sheet>
        <Rule strong />
      </View>

      <Sheet flex>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 0 }}
          removeClippedSubviews
          maxToRenderPerBatch={4}
          windowSize={5}
          initialNumToRender={5}
          refreshControl={
            <RefreshControl
              refreshing={feed.isFetching && !feed.isLoading}
              onRefresh={onRefresh}
              tintColor={carbon.muted}
            />
          }
          ListHeaderComponent={
            tags.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 13 }}
                >
                  <TagChip
                    label="Alles"
                    active={activeTag === null}
                    onPress={() => setActiveTag(null)}
                  />
                  {tags.map((t) => (
                    <TagChip
                      key={t}
                      label={t}
                      active={activeTag === t}
                      onPress={() => setActiveTag(activeTag === t ? null : t)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            feed.isLoading ? (
              <View className="items-center py-24">
                <ActivityIndicator color={carbon.muted} />
              </View>
            ) : (
              <View className="px-6 py-20">
                <Text style={[type.headline, { color: carbon.DEFAULT }]}>
                  {activeTag ? "Niets onder deze tag." : "Nog niets gedeeld."}
                </Text>
                <Text style={[type.body, { color: carbon.soft, marginTop: 10, maxWidth: 460 }]}>
                  {activeTag
                    ? "Probeer een andere tag, of deel zelf de eerste."
                    : "Plak een link, tik een zin over uit wat je aan het lezen bent, of voeg vrienden toe."}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            rows.length > 0 ? (
              <View>
                <Rule strong />
                {/* De zwarte voet — de pagina houdt op. */}
                <View className="bg-carbon px-6 py-14 items-center">
                  <Text style={[type.headline, { color: page.DEFAULT }]}>Je bent bij.</Text>
                  <View className="mt-3 max-w-[380px]">
                    <Meta tone="dark" dim style={{ textAlign: "center" }}>
                      Geen oneindige stroom. Kom straks terug, of deel zelf iets.
                    </Meta>
                  </View>
                </View>
              </View>
            ) : null
          }
        />
      </Sheet>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------
// Eén band
// ---------------------------------------------------------------

const FeedRow = memo(function FeedRow({
  item,
  myUserId,
  onChanged,
  wide,
}: {
  item: FeedItem;
  myUserId: string;
  onChanged: () => void;
  wide: boolean;
}) {
  if (item.type === "post") {
    return (
      <FindRow post={item.data} myUserId={myUserId} onChanged={onChanged} wide={wide} />
    );
  }

  const label =
    item.type === "poll" ? "Poll"
    : item.type === "call_plan" ? "Call"
    : item.type === "shared_list" ? "Lijst"
    : item.type === "memory" ? "Op deze dag"
    : "Activiteit";

  return (
    <Band label={label} wide={wide}>
      <View className="px-6">
        {item.type === "poll" && <PollCard poll={item.data} onDeleted={onChanged} />}
        {item.type === "call_plan" && <CallPlanCard plan={item.data} />}
        {item.type === "shared_list" && <SharedListCard list={item.data} />}
        {item.type === "activity" && <ActivityCard event={item.data} />}
        {item.type === "memory" && <MemoryCard post={item.data} />}
      </View>
    </Band>
  );
});

/**
 * De tweekolomsstructuur van het affiche: etiket links, inhoud rechts.
 * Op telefoon vouwt dat samen tot etiket-boven-inhoud.
 */
function Band({
  label,
  kicker,
  wide,
  children,
}: {
  label?: string;
  kicker?: React.ReactNode;
  wide: boolean;
  children: React.ReactNode;
}) {
  const head = kicker ?? (label ? <Meta strong>{label}</Meta> : null);

  // Let op: de richting staat bewust in `style`, niet in een `flex-row`-class.
  // Een View is in React Native standaard een kolom, dus als NativeWind om
  // welke reden dan ook niet meedoet (stale CSS na een config-wijziging,
  // Metro-cache), zou de hele tweekolomsstructuur stilletjes terugvallen op
  // één kolom. Dit is te belangrijk om van een class af te laten hangen.
  if (wide) {
    return (
      <View style={{ flexDirection: "row", paddingTop: 28, paddingBottom: 36 }}>
        <View style={{ width: 210, paddingHorizontal: 24 }}>{head}</View>
        {/* Geen maxWidth: de inhoud loopt door tot het einde van de
            haarlijn, zoals de rijen op het affiche. Tekst houdt zijn eigen
            marge via de px-6 binnen FindBody. */}
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 16, paddingBottom: 24 }}>
      {head ? <View style={{ paddingHorizontal: 24 }}>{head}</View> : null}
      {children}
    </View>
  );
}

const FindRow = memo(function FindRow({
  post,
  myUserId,
  onChanged,
  wide,
}: {
  post: PostWithAuthor;
  myUserId: string;
  onChanged: () => void;
  wide: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);

  const isMine = post.user_id === myUserId;
  const authorName = post.author?.display_name ?? post.author?.username ?? "Onbekend";
  const kindLabel = KIND_LABELS[post.kind] ?? "Notitie";

  const menuButton = isMine ? (
    <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} className={wide ? "" : "pl-3 -mr-1"}>
      <Ionicons name="ellipsis-horizontal" color={carbon.muted} size={16} />
    </Pressable>
  ) : undefined;

  return (
    <Band
      wide={wide}
      kicker={
        <Kicker
          stacked={wide}
          parts={[kindLabel, authorName, formatPostTime(post.created_at)]}
          right={menuButton}
        />
      }
    >
      <FindBody post={post} onPress={() => router.push(`/post/${post.id}`)} />

      <View className="pt-4">
        <PostReactions postId={post.id} />
      </View>

      <CommentsSection
        entityType="post"
        entityId={post.id}
        ownerId={post.user_id}
        initialCount={post.comment_count}
      />

      {isMine && (
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
      )}

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "rgba(18,17,15,0.55)", justifyContent: "flex-end" }}
        >
          <View className="bg-page px-6 pt-6 pb-9">
            <View className="flex-row items-center mb-4">
              <View className="flex-1">
                <Meta strong>Toelichting bewerken</Meta>
              </View>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <Ionicons name="close" color={carbon.DEFAULT} size={22} />
              </Pressable>
            </View>
            <TextInput
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="Schrijf iets…"
              placeholderTextColor={carbon.muted}
              multiline
              autoFocus
              maxLength={1000}
              style={[
                type.body,
                {
                  color: carbon.DEFAULT,
                  minHeight: 96,
                  maxHeight: 190,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: carbon.muted,
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
              className="mt-4 bg-carbon active:bg-carbon-soft py-4 items-center"
            >
              <Meta tone="dark" strong>{saving ? "Bewaren…" : "Bewaren"}</Meta>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Band>
  );
});

// ---------------------------------------------------------------

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
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? carbon.DEFAULT : "#CFCDC7",
        backgroundColor: active ? carbon.DEFAULT : "transparent",
        marginRight: 8,
      }}
      className="px-3.5 py-2"
    >
      <Text style={[type.meta, { color: active ? page.DEFAULT : carbon.soft }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatPostTime(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "net";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} u`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} d`;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}
