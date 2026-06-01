import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationWithDetails,
} from "@/lib/api/notifications";
import { supabase } from "@/lib/supabase/client";

export default function NotificationsScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["notifications", myUserId],
    queryFn: () => listNotifications(myUserId),
    refetchOnWindowFocus: true,
  });

  // Mark all as read when this screen is opened
  useEffect(() => {
    markAllNotificationsRead(myUserId).then(() => {
      qc.invalidateQueries({ queryKey: ["notifications-unread", myUserId] });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);

  async function onRefresh() {
    await qc.invalidateQueries({ queryKey: ["notifications", myUserId] });
  }

  async function onPressNotification(item: NotificationWithDetails) {
    if (!item.read) {
      markNotificationRead(item.id);
    }
    if (item.post_id) {
      router.push(`/post/${item.post_id}`);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={onRefresh}
              tintColor="#F5E8D3"
            />
          }
          ListHeaderComponent={
            <View className="mb-5">
              <Text className="text-3xl font-bold tracking-tight text-cream mb-1">
                Meldingen
              </Text>
              <Text className="text-cream-soft text-base">
                Reacties op jouw posts en threads.
              </Text>
            </View>
          }
          ListEmptyComponent={
            isLoading ? null : (
              <View className="bg-paper-soft rounded-3xl p-6 items-center mt-2">
                <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
                  <Ionicons name="notifications-outline" color="#1A1714" size={24} />
                </View>
                <Text className="text-ink font-semibold text-base mb-1">
                  Nog geen meldingen
                </Text>
                <Text className="text-ink-soft text-sm text-center">
                  Zodra iemand reageert op jouw post of een thread waarbij je bent, verschijnt het hier.
                </Text>
              </View>
            )
          }
          ItemSeparatorComponent={() => <View className="h-2" />}
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => onPressNotification(item)} />
          )}
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationWithDetails;
  onPress: () => void;
}) {
  const actorName =
    item.actor?.display_name ?? item.actor?.username ?? "Iemand";

  const label =
    item.type === "comment_on_post"
      ? `${actorName} reageerde op jouw post`
      : `${actorName} reageerde ook op een post`;

  const snippet = item.post_caption
    ? item.post_caption.length > 60
      ? item.post_caption.slice(0, 60) + "…"
      : item.post_caption
    : item.post_image_path
    ? "📷 foto"
    : null;

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl ${
        item.read ? "bg-paper-soft" : "bg-paper"
      }`}
    >
      {/* Unread dot */}
      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: item.read ? "transparent" : "#E66B3F" }} />

      <Avatar
        name={item.actor?.display_name ?? item.actor?.username}
        avatarUrl={item.actor?.avatar_url ?? null}
        size="sm"
      />

      <View className="flex-1">
        <Text className={`text-sm ${item.read ? "text-ink-muted" : "text-ink font-semibold"}`} numberOfLines={2}>
          {label}
        </Text>
        {snippet && (
          <Text className="text-ink-muted text-xs mt-0.5" numberOfLines={1}>
            {snippet}
          </Text>
        )}
        <Text className="text-ink-muted text-[10px] mt-0.5">
          {formatRelativeTime(item.created_at)}
        </Text>
      </View>

      {/* Post thumbnail */}
      {item.post_image_path && (
        <PostThumb imagePath={item.post_image_path} />
      )}

      <Ionicons name="chevron-forward" color="#8A7E6C" size={14} />
    </Pressable>
  );
}

function PostThumb({ imagePath }: { imagePath: string }) {
  const [url, setUrl] = require("react").useState<string | null>(null);
  require("react").useEffect(() => {
    supabase.storage
      .from("posts")
      .createSignedUrl(imagePath, 300)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [imagePath]);
  if (!url) return null;
  return (
    <Image
      source={{ uri: url }}
      style={{ width: 40, height: 40, borderRadius: 8 }}
      contentFit="cover"
    />
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
