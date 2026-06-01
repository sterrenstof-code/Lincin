import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo, useCallback, useState, useEffect } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { EventCard } from "@/components/EventCard";
import { SafeImage } from "@/components/SafeImage";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonPostCard } from "@/components/Skeleton";
import { PollCard } from "@/components/PollCard";
import { CallPlanCard } from "@/components/CallPlanCard";
import { ActivityCard } from "@/components/ActivityCard";
import { MemoryCard } from "@/components/MemoryCard";
import { useAuth } from "@/lib/auth/provider";
import { listMyEvents } from "@/lib/api/events";
import { deletePost, updatePostCaption, listUnifiedFeed, type FeedItem, type PostWithAuthor } from "@/lib/api/posts";

export default function FeedScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const [composeMenuOpen, setComposeMenuOpen] = useState(false);

  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    refetchOnWindowFocus: true,
  });

  // Refetch elke keer dat de feed-tab zichtbaar wordt (na terugkeer van compose)
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
    }, [qc, myUserId])
  );

  async function onRefresh() {
    await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
      <FlatList
        data={feed.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        windowSize={5}
        initialNumToRender={5}
        refreshControl={
          <RefreshControl
            refreshing={feed.isFetching && !feed.isLoading}
            onRefresh={onRefresh}
            tintColor="#F5E8D3"
          />
        }
        ListHeaderComponent={
          <View>
            <Text className="text-3xl font-bold tracking-tight text-cream mb-1">
              Feed
            </Text>
            <Text className="text-cream-soft text-base mb-5">
              Foto's, polls en momenten van jou en je vrienden.
            </Text>

            {/* Compose CTA */}
            <View className="bg-flame rounded-3xl p-6 mb-6">
              <Text className="text-xs uppercase tracking-wider text-cream/80 mb-1">
                Deel
              </Text>
              <Text className="text-2xl font-bold tracking-tight text-cream mb-4">
                Plaats een moment
              </Text>
              <View className="flex-row gap-2 flex-wrap">
                <Pressable
                  onPress={() => router.push("/post-compose")}
                  className="flex-row items-center bg-ink active:bg-ink-soft rounded-full px-4 py-2.5"
                >
                  <Ionicons name="image-outline" color="#F5E8D3" size={16} />
                  <Text className="text-cream font-semibold ml-2 text-sm">Foto</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/poll-compose")}
                  className="flex-row items-center bg-ink active:bg-ink-soft rounded-full px-4 py-2.5"
                >
                  <Ionicons name="bar-chart-outline" color="#F5E8D3" size={16} />
                  <Text className="text-cream font-semibold ml-2 text-sm">Stemming</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/call-plan-compose")}
                  className="flex-row items-center bg-ink active:bg-ink-soft rounded-full px-4 py-2.5"
                >
                  <Ionicons name="videocam-outline" color="#F5E8D3" size={16} />
                  <Text className="text-cream font-semibold ml-2 text-sm">Call plannen</Text>
                </Pressable>
              </View>
            </View>

            <Text className="text-xs uppercase tracking-wider text-cream-muted mb-3 px-1">
              Recent
            </Text>
          </View>
        }
        ListEmptyComponent={
          feed.isLoading ? (
            <View className="gap-4">
              <SkeletonPostCard />
              <SkeletonPostCard />
            </View>
          ) : (
            <View className="bg-paper-soft rounded-3xl p-6 items-center">
              <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="images-outline" color="#1A1714" size={24} />
              </View>
              <Text className="text-ink font-semibold text-base mb-1">
                Nog niks te tonen
              </Text>
              <Text className="text-ink-soft text-sm text-center">
                Plaats je eerste foto, poll of call hierboven, of voeg vrienden toe.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={useCallback(({ item }: { item: FeedItem }) => {
          if (item.type === "memory") {
            return <MemoryCard post={item.data} />;
          }
          if (item.type === "activity") {
            return <ActivityCard event={item.data} />;
          }
          if (item.type === "poll") {
            return (
              <PollCard
                poll={item.data}
                onDeleted={() => qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] })}
              />
            );
          }
          if (item.type === "call_plan") {
            return <CallPlanCard plan={item.data} />;
          }
          // type === "post"
          const post = item.data as PostWithAuthor;
          return (
            <PostCard
              post={post}
              myUserId={myUserId}
              onPress={() => router.push(`/post/${post.id}`)}
              onAuthorPress={() =>
                post.author?.username && router.push(`/user/${post.author.username}`)
              }
              onDelete={async () => {
                await deletePost(post);
                qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
              }}
              onEdit={() => {
                qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
              }}
            />
          );
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [myUserId])}
      />
      </ScreenContainer>
    </SafeAreaView>
  );
}

const PostCard = memo(function PostCard({
  post,
  myUserId,
  onPress,
  onAuthorPress,
  onDelete,
  onEdit,
}: {
  post: PostWithAuthor;
  myUserId: string;
  onPress: () => void;
  onAuthorPress: () => void;
  onDelete?: () => void;
  onEdit?: (newCaption: string) => void;
}) {
  const isMine = post.user_id === myUserId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption ?? "");
  const [saving, setSaving] = useState(false);
  const authorName =
    post.author?.display_name ?? post.author?.username ?? "Onbekend";
  const time = formatPostTime(post.created_at);
  const hasImage = !!post.image_path;
  const hasLink = !!post.link_url;
  const hasCaption = !!post.caption && post.caption.trim().length > 0;

  const [imageRatio, setImageRatio] = useState<number | undefined>(undefined);

  return (
    <View className="bg-paper-soft rounded-3xl overflow-hidden">
      <Pressable
        onPress={onAuthorPress}
        className="flex-row items-center px-4 py-3"
      >
        <Avatar name={authorName} size="md" tint="warm" />
        <View className="flex-1 ml-3">
          <Text className="text-ink font-semibold">{authorName}</Text>
          <Text className="text-ink-muted text-xs">
            @{post.author?.username ?? "?"} • {time}
          </Text>
        </View>
        {isMine && (
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            className="w-8 h-8 rounded-full items-center justify-center"
          >
            <Ionicons name="ellipsis-horizontal" color="#5A4F40" size={18} />
          </Pressable>
        )}
      </Pressable>

      {hasImage && (
        <Pressable onPress={onPress} className="bg-shell">
          <SafeImage
            uri={post.image_url}
            cacheKey={post.image_path ?? undefined}
            style={{
              width: "100%",
              aspectRatio: imageRatio
                ? Math.min(Math.max(imageRatio, 9 / 16), 2)
                : 1,
            }}
            contentFit="cover"
            transition={150}
            fallbackIcon="image-outline"
            onLoad={(e) => {
              const { width, height } = (e as any).source ?? {};
              if (width && height) setImageRatio(width / height);
            }}
          />
        </Pressable>
      )}

      {hasCaption && (
        <Pressable
          onPress={onPress}
          className={`px-4 ${hasImage ? "py-3" : "pt-1 pb-3"}`}
        >
          <Text
            className={`text-ink leading-6 ${
              hasImage ? "text-base" : "text-lg"
            }`}
          >
            {post.caption}
          </Text>
        </Pressable>
      )}

      {hasLink && post.link_url && <LinkCard url={post.link_url} />}

      <Pressable
        onPress={onPress}
        className="flex-row items-center px-4 pb-3 pt-2"
      >
        <Ionicons
          name={post.comment_count > 0 ? "chatbubble" : "chatbubble-outline"}
          color="#8C7B6B"
          size={14}
        />
        <Text className="text-ink-muted text-sm ml-2">
          {post.comment_count === 0
            ? "Reageer"
            : post.comment_count === 1
            ? "1 reactie"
            : `${post.comment_count} reacties`}
        </Text>
      </Pressable>

      {isMine && (
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          title="Bericht"
          actions={[
            {
              label: "Bijschrift bewerken",
              icon: "pencil-outline",
              onPress: () => { setMenuOpen(false); setEditCaption(post.caption ?? ""); setEditOpen(true); },
            },
            {
              label: "Verwijderen",
              icon: "trash-outline",
              destructive: true,
              onPress: () => { setMenuOpen(false); onDelete?.(); },
            },
          ]}
        />
      )}

      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
        >
          <View className="bg-paper rounded-t-3xl px-5 pt-5 pb-8">
            <View className="flex-row items-center mb-4">
              <Text className="flex-1 text-ink font-bold text-lg">Bijschrift bewerken</Text>
              <Pressable onPress={() => setEditOpen(false)} hitSlop={8}>
                <Ionicons name="close" color="#8A7E6C" size={22} />
              </Pressable>
            </View>
            <TextInput
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="Schrijf een bijschrift…"
              placeholderTextColor="#8A7E6C"
              multiline
              autoFocus
              maxLength={1000}
              className="bg-paper-light text-ink text-base px-4 py-3 rounded-2xl border border-line-paper"
              style={{ minHeight: 80, maxHeight: 160 }}
            />
            <Text className="text-ink-muted text-xs mt-1 text-right">{editCaption.length}/1000</Text>
            <Pressable
              onPress={async () => {
                setSaving(true);
                try {
                  await updatePostCaption(post.id, editCaption);
                  onEdit?.(editCaption.trim());
                  setEditOpen(false);
                } catch (e: any) {
                  console.warn("updatePostCaption", e?.message ?? e);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="mt-4 bg-ink active:bg-ink-soft rounded-full py-3.5 items-center"
            >
              <Text className="text-cream font-semibold">
                {saving ? "Bewaren…" : "Bewaren"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
});

function LinkCard({ url }: { url: string }) {
  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      className="mx-3 mb-3 mt-1 bg-paper-warm active:bg-paper rounded-2xl px-4 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-paper-light items-center justify-center">
        <Ionicons name="link" color="#1A1714" size={18} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
          {hostname}
        </Text>
        <Text className="text-ink-muted text-xs" numberOfLines={1}>
          {url}
        </Text>
      </View>
      <Ionicons name="open-outline" color="#5A4F40" size={16} />
    </Pressable>
  );
}

function formatPostTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "net";
  if (diffMin < 60) return `${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}u`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}
