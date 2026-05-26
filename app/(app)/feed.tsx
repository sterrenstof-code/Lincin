import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { EventCard } from "@/components/EventCard";
import { SafeImage } from "@/components/SafeImage";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonPostCard } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { listMyEvents, type EventWithMeta } from "@/lib/api/events";
import { listFeedPosts, type PostWithAuthor } from "@/lib/api/posts";

export default function FeedScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();

  const feed = useQuery({
    queryKey: ["feed", myUserId],
    queryFn: () => listFeedPosts(50),
  });

  const events = useQuery({
    queryKey: ["events", myUserId],
    queryFn: () => listMyEvents(myUserId),
  });

  const liveEvents = (events.data ?? []).filter(
    (e) => e.is_active || new Date(e.starts_at).getTime() > Date.now()
  );

  async function onRefresh() {
    await qc.invalidateQueries({ queryKey: ["feed", myUserId] });
    await qc.invalidateQueries({ queryKey: ["events", myUserId] });
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
      <FlatList
        data={feed.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
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
              Foto's van jou en je vrienden.
            </Text>

            {/* Compose CTA */}
            <Pressable
              onPress={() => router.push("/post-compose")}
              className="bg-flame rounded-3xl p-6 mb-6"
            >
              <Text className="text-xs uppercase tracking-wider text-cream/80 mb-1">
                Deel
              </Text>
              <Text className="text-2xl font-bold tracking-tight text-cream mb-4">
                Plaats een moment
              </Text>
              <View className="flex-row items-center bg-ink active:bg-ink-soft rounded-full px-5 py-3 self-start">
                <Ionicons name="add" color="#F5E8D3" size={18} />
                <Text className="text-cream font-semibold ml-2">Nieuwe foto</Text>
              </View>
            </Pressable>

            {/* Live/upcoming events — verborgen tot events-feature klaar is.
                De useQuery hierboven blijft draaien zodat re-enable enkel
                deze block hoeft te uncommenten. */}
            {/* {liveEvents.length > 0 && (
              <View className="mb-6">
                <Text className="text-xs uppercase tracking-wider text-cream-muted mb-3 px-1">
                  Events
                </Text>
                <View className="gap-3">
                  {liveEvents.slice(0, 3).map((e) => (
                    <EventCard key={e.id} event={e} compact />
                  ))}
                </View>
              </View>
            )} */}

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
                Plaats je eerste foto hierboven, of voeg vrienden toe — dan verschijnen hun foto's hier ook.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-4" />}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            myUserId={myUserId}
            onPress={() => router.push(`/post/${item.id}`)}
            onAuthorPress={() =>
              item.author?.username && router.push(`/user/${item.author.username}`)
            }
          />
        )}
      />
      </ScreenContainer>
    </SafeAreaView>
  );
}

function PostCard({
  post,
  myUserId,
  onPress,
  onAuthorPress,
}: {
  post: PostWithAuthor;
  myUserId: string;
  onPress: () => void;
  onAuthorPress: () => void;
}) {
  const isMine = post.user_id === myUserId;
  const authorName =
    post.author?.display_name ?? post.author?.username ?? "Onbekend";
  const time = formatPostTime(post.created_at);
  const hasImage = !!post.image_path;
  const hasLink = !!post.link_url;
  const hasCaption = !!post.caption && post.caption.trim().length > 0;

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
          <View className="bg-paper-warm rounded-full px-2.5 py-0.5">
            <Text className="text-ink text-[10px] font-bold uppercase tracking-wider">
              Jij
            </Text>
          </View>
        )}
      </Pressable>

      {hasImage && (
        <Pressable onPress={onPress} className="bg-shell">
          <SafeImage
            uri={post.image_url}
            style={{ width: "100%", aspectRatio: 1 }}
            contentFit="cover"
            transition={150}
            fallbackIcon="image-outline"
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

      {/* Reacties-footer — altijd zichtbaar, tikt door naar post detail */}
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
    </View>
  );
}

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
