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
  Arrow,
  Kicker,
  Masthead,
  Meta,
  Rule,
  SectionHead,
} from "@/components/Editorial";
import { FindBody } from "@/components/FindBody";
import { MemoryCard } from "@/components/MemoryCard";
import { PollCard } from "@/components/PollCard";
import { PostReactions } from "@/components/PostReactions";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SharedListCard } from "@/components/SharedListCard";
import { useAuth } from "@/lib/auth/provider";
import { ink, type } from "@/lib/design/type";
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
 * De feed als *gedrukte pagina*.
 *
 * Geen zwevende kaartjes met tussenruimte, maar banden die van rand tot rand
 * lopen en gescheiden worden door haarlijnen — de structuur van een affiche.
 * Kolomkoppen in 9px-kapitalen dragen de inhoud eronder; de inhoud zelf staat
 * in een display-serif. Dat schaalcontrast is het hele ontwerp.
 *
 * Wat hier bewust NIET staat: een algoritme, een bereikteller, oneindig
 * scrollen. De feed heeft een einde, en dat einde zegt dat je bij bent.
 */

type Section = "vandaag" | "week" | "eerder";

const SECTION_LABELS: Record<Section, string> = {
  vandaag: "Vandaag",
  week: "Deze week",
  eerder: "Eerder",
};

function sectionOf(iso: string): Section {
  const then = new Date(iso).getTime();
  const age = Date.now() - then;
  if (age < 24 * 60 * 60 * 1000) return "vandaag";
  if (age < 7 * 24 * 60 * 60 * 1000) return "week";
  return "eerder";
}

/** Rij + eventueel de rubriekkop die eraan voorafgaat. */
type Row = { item: FeedItem; section: Section | null };

export default function FeedScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
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

  /**
   * Filteren en rubriceren in één pass. De rubriekkop hangt aan de eerste
   * rij van elke periode, zodat de FlatList plat blijft (geen SectionList —
   * die breekt de volle-breedte banden).
   */
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

  const today = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  }, []);

  const renderItem = useCallback(
    ({ item: row }: { item: Row }) => (
      <View>
        {row.section ? (
          <SectionHead label={SECTION_LABELS[row.section]} tone="paper" />
        ) : (
          <Rule tone="paper" />
        )}
        <FeedRow item={row.item} myUserId={myUserId} onChanged={invalidate} />
      </View>
    ),
    [myUserId, invalidate]
  );

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      {/* De feed is een papieren kolom op de donkere schil. Op breed scherm
          blijft de goot donker — dat maakt van de kolom een pagina. */}
      <ScreenContainer className="bg-paper-light">
        <FlatList
          data={rows}
          keyExtractor={(row) => row.item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 72 }}
          removeClippedSubviews
          maxToRenderPerBatch={4}
          windowSize={5}
          initialNumToRender={5}
          refreshControl={
            <RefreshControl
              refreshing={feed.isFetching && !feed.isLoading}
              onRefresh={onRefresh}
              tintColor={ink.muted}
            />
          }
          ListHeaderComponent={
            <View>
              <Masthead
                tone="paper"
                columns={[
                  { label: "Lincin", value: "Vondsten" },
                  { label: "Van je kring", value: "Niet van een algoritme" },
                  { label: today },
                  { label: "Privé" },
                ]}
              />

              {/* Het affiche-moment: één keer groot, daarna nooit meer */}
              <View className="px-5 pt-7 pb-5">
                <Text style={[type.display, { color: ink.DEFAULT }]}>Vondsten</Text>
                <Text style={[type.body, { color: ink.soft, marginTop: 10 }]}>
                  Wat je vrienden tegenkwamen en de moeite waard vonden om mee
                  terug te brengen.
                </Text>
              </View>

              <Rule tone="paper" strong />

              {/* Delen — een regel, geen invoerveld */}
              <Pressable
                onPress={() => router.push("/post-compose")}
                className="flex-row items-center px-5 py-4 active:bg-paper-warm"
              >
                <View className="flex-1 pr-4">
                  <Text style={[type.headlineSmall, { color: ink.DEFAULT }]}>
                    Deel een vondst
                  </Text>
                  <View className="mt-1">
                    <Meta tone="paper" dim>
                      Link · Video · Muziek · Fragment · Weetje · Idee
                    </Meta>
                  </View>
                </View>
                <Arrow tone="paper" />
              </Pressable>
              <Rule tone="paper" />

              {/* Nevenwegen — klein gezet, want ze zijn niet de hoofdzaak */}
              <View className="flex-row px-5 py-3">
                {[
                  { label: "Poll", route: "/poll-compose" },
                  { label: "Call", route: "/call-plan-compose" },
                  { label: "Lijst", route: "/list-compose" },
                ].map((s, i) => (
                  <Pressable
                    key={s.route}
                    onPress={() => router.push(s.route as any)}
                    className="flex-row items-center"
                  >
                    {i > 0 && (
                      <Meta tone="paper" dim style={{ marginHorizontal: 8 }}>
                        /
                      </Meta>
                    )}
                    <Meta tone="paper">{s.label}</Meta>
                  </Pressable>
                ))}
              </View>
              <Rule tone="paper" />

              {tags.length > 0 && (
                <View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 11 }}
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
                  <Rule tone="paper" />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            feed.isLoading ? (
              <View className="items-center py-16">
                <ActivityIndicator color={ink.muted} />
              </View>
            ) : (
              <View className="px-5 py-14">
                <Text style={[type.headline, { color: ink.DEFAULT }]}>
                  {activeTag ? "Niks onder deze tag." : "Nog niets gevonden."}
                </Text>
                <Text style={[type.body, { color: ink.soft, marginTop: 8 }]}>
                  {activeTag
                    ? "Probeer een andere tag, of deel zelf de eerste."
                    : "Plak een link, tik een citaat over uit wat je aan het lezen bent, of voeg vrienden toe."}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            rows.length > 0 ? (
              <View>
                <Rule tone="paper" strong />
                <View className="items-center px-5 py-10">
                  <Text style={[type.headlineSmall, { color: ink.DEFAULT }]}>
                    Je bent bij.
                  </Text>
                  <Text
                    style={[type.bodySmall, { color: ink.muted, marginTop: 6, textAlign: "center" }]}
                  >
                    Geen oneindige stroom. Kom straks terug — of deel zelf iets.
                  </Text>
                </View>
              </View>
            ) : null
          }
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------
// Eén rij
// ---------------------------------------------------------------

const FeedRow = memo(function FeedRow({
  item,
  myUserId,
  onChanged,
}: {
  item: FeedItem;
  myUserId: string;
  onChanged: () => void;
}) {
  if (item.type === "post") {
    return <FindRow post={item.data} myUserId={myUserId} onChanged={onChanged} />;
  }

  // De overige types houden voorlopig hun eigen kaart; ze krijgen wel de
  // kicker-regel en de inspringing, zodat het ritme klopt.
  const label =
    item.type === "poll" ? "Poll"
    : item.type === "call_plan" ? "Call"
    : item.type === "shared_list" ? "Lijst"
    : item.type === "memory" ? "Op deze dag"
    : "Activiteit";

  return (
    <View className="pt-3.5 pb-4">
      <View className="px-5 pb-2.5">
        <Kicker tone="paper" parts={[label]} />
      </View>
      <View className="px-5">
        {item.type === "poll" && <PollCard poll={item.data} onDeleted={onChanged} />}
        {item.type === "call_plan" && <CallPlanCard plan={item.data} />}
        {item.type === "shared_list" && <SharedListCard list={item.data} />}
        {item.type === "activity" && <ActivityCard event={item.data} />}
        {item.type === "memory" && <MemoryCard post={item.data} />}
      </View>
    </View>
  );
});

const FindRow = memo(function FindRow({
  post,
  myUserId,
  onChanged,
}: {
  post: PostWithAuthor;
  myUserId: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);

  const isMine = post.user_id === myUserId;
  const authorName = post.author?.display_name ?? post.author?.username ?? "Onbekend";
  const kindLabel = KIND_LABELS[post.kind] ?? "Notitie";

  return (
    <View className="pt-3.5 pb-4">
      <View className="px-5">
        <Kicker
          tone="paper"
          parts={[kindLabel, authorName, formatPostTime(post.created_at)]}
          right={
            isMine ? (
              <Pressable
                onPress={() => setMenuOpen(true)}
                hitSlop={10}
                className="pl-3 -mr-1"
              >
                <Ionicons name="ellipsis-horizontal" color={ink.muted} size={16} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <FindBody post={post} onPress={() => router.push(`/post/${post.id}`)} />

      <View className="pt-3">
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
          style={{ flex: 1, backgroundColor: "rgba(10,10,11,0.6)", justifyContent: "flex-end" }}
        >
          <View className="bg-paper-light px-5 pt-5 pb-8">
            <View className="flex-row items-center mb-4">
              <View className="flex-1">
                <Meta tone="paper">Toelichting bewerken</Meta>
              </View>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <Ionicons name="close" color={ink.muted} size={22} />
              </Pressable>
            </View>
            <TextInput
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="Schrijf iets…"
              placeholderTextColor={ink.muted}
              multiline
              autoFocus
              maxLength={1000}
              style={[
                type.body,
                {
                  color: ink.DEFAULT,
                  minHeight: 90,
                  maxHeight: 180,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: ink.muted,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                },
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
              className="mt-4 bg-ink active:bg-ink-soft py-3.5 items-center"
            >
              <Meta tone="shell">{saving ? "Bewaren…" : "Bewaren"}</Meta>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
        borderColor: active ? ink.DEFAULT : ink.muted,
        backgroundColor: active ? ink.DEFAULT : "transparent",
        marginRight: 7,
      }}
      className="px-3 py-1.5"
    >
      <Meta tone={active ? "shell" : "paper"} dim={!active}>
        {label}
      </Meta>
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
