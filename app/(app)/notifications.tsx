import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { useAuth } from "@/lib/auth/provider";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationWithDetails,
} from "@/lib/api/notifications";
import { supabase } from "@/lib/supabase/client";
import { feed, FEED_BORDER, feedType, flame, flameDeep } from "@/lib/design/type";

export default function NotificationsScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
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
    if (item.event_id) {
      router.push(`/event/${item.event_id}`);
    } else if (item.post_id) {
      router.push(`/post/${item.post_id}`);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        contentStyle={{ paddingVertical: 28, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={feed.ink}
          />
        }
      >
        {/* Paginakop in de redactionele opbouw: kicker, kop, ondertitel. */}
        <Text
          style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 10 }]}
        >
          WAT ER SPEELT
        </Text>
        <Text
          style={[
            wide ? feedType.hero : feedType.heroSmall,
            { color: feed.ink, maxWidth: 620 },
          ]}
        >
          Meldingen
        </Text>
        <Text
          style={[feedType.body, { color: feed.inkDim, maxWidth: 520, marginTop: 10, marginBottom: 34 }]}
        >
          Nieuwe vondsten uit je kring, en elke beweging op een vondst waar
          jij iets mee gedaan hebt.
        </Text>

        {(data ?? []).length === 0 ? (
          isLoading ? null : (
            <View
              style={{
                borderWidth: FEED_BORDER,
                borderColor: feed.ink,
                backgroundColor: feed.post,
                padding: 32,
              }}
            >
              <Text style={[feedType.tile, { fontSize: 20, color: feed.text, marginBottom: 8 }]}>
                Nog geen meldingen
              </Text>
              <Text style={[feedType.body, { color: feed.textDim, maxWidth: 440 }]}>
                Zodra iemand uit je kring iets deelt, of reageert op een vondst
                waar jij iets mee gedaan hebt, verschijnt het hier.
              </Text>
            </View>
          )
        ) : (
          /* Eén gekaderd blok met scheidingslijnen — geen zwevende kaartjes
             met tussenruimte. Zelfde vorm als de chatlijst. */
          <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>
            {(data ?? []).map((item, i) => (
              <NotificationRow
                key={item.id}
                item={item}
                isLast={i === (data ?? []).length - 1}
                onPress={() => onPressNotification(item)}
              />
            ))}
          </View>
        )}
      </PageScroll>
    </SafeAreaView>
  );
}

function NotificationRow({
  item,
  onPress,
  isLast = false,
}: {
  item: NotificationWithDetails;
  onPress: () => void;
  /** Laatste rij krijgt geen scheidingslijn — het kader sluit al af. */
  isLast?: boolean;
}) {
  const actorName =
    item.actor?.display_name ?? item.actor?.username ?? "Iemand";

  const eventName = item.event_name ? `"${item.event_name}"` : "je event";

  // Waar de melding over gaat, in één woordgroep. De brontitel gaat voor
  // op de toelichting van de deler: bij een link of een boekfragment is
  // die herkenbaarder dan wat iemand er zelf bij typte.
  const subject = item.post_source_title
    ? `„${truncate(item.post_source_title, 32)}”`
    : "een vondst";

  const label =
    item.type === "friend_post"       ? `${actorName} deelde ${subject}` :
    item.type === "comment_on_post"   ? `${actorName} reageerde op jouw vondst` :
    item.type === "comment_on_thread" ? `${actorName} reageerde ook op ${subject}` :
    item.type === "post_reaction"     ? `${actorName} gaf ${item.detail ?? "een reactie"} aan jouw vondst` :
    item.type === "thread_reaction"   ? `${actorName} gaf ${item.detail ?? "een reactie"} aan ${subject}` :
    item.type === "thread_boost"      ? `${actorName} duwde ${subject} omhoog` :
    item.type === "vote_on_poll"      ? `${actorName} stemde op jouw stemming` :
    item.type === "vote_on_call"      ? `${actorName} koos een tijdslot voor jouw call` :
    item.type === "invited_to_list"   ? `${actorName} nodigde je uit voor een lijst` :
    item.type === "invited_to_call"   ? `${actorName} nodigde je uit voor een videocall` :
    item.type === "event_join"        ? `${actorName} nam deel aan ${eventName}` :
    item.type === "event_join_request" ? `${actorName} vraagt toegang tot ${eventName}` :
    item.type === "event_join_approved" ? `${actorName} liet je toe tot ${eventName}` :
    item.type === "event_contribution" ? `${actorName} plaatste iets in ${eventName}` :
    item.type === "mention"           ? `${actorName} noemde je` :
    item.type === "post_boost"        ? `${actorName} duwde jouw vondst omhoog` :
    item.type === "followed_post_comment" ? `${actorName} reageerde op een vondst die je volgt` :
    `${actorName} deed iets`;

  // Prefer the comment body as snippet (especially useful for emoji-only comments).
  // Fall back to post caption, then image indicator.
  const rawSnippet = item.comment_body ?? item.post_caption;
  const snippet = rawSnippet
    ? rawSnippet.length > 60
      ? rawSnippet.slice(0, 60) + "…"
      : rawSnippet
    : item.post_image_path
    ? "📷 foto"
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: item.read ? feed.panel : feed.lav,
        ...(isLast ? null : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }),
      }}
    >
      {/* Ongelezen-markering: vierkant, in het rood. */}
      <View style={{ width: 6, height: 6, backgroundColor: item.read ? "transparent" : flame }} />

      <Avatar
        name={item.actor?.display_name ?? item.actor?.username}
        avatarUrl={item.actor?.avatar_url ?? null}
        size="sm"
      />

      <View className="flex-1">
        <Text
          style={[
            feedType.body,
            { fontSize: 14, color: feed.ink, fontWeight: item.read ? "400" : "700" },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {snippet ? (
          <Text
            style={[feedType.label, { color: feed.inkDim, marginTop: 3 }]}
            numberOfLines={1}
          >
            {snippet}
          </Text>
        ) : null}
        <Text style={[feedType.kicker, { color: "#3A3540", letterSpacing: 0.5, marginTop: 4 }]}>
          {formatRelativeTime(item.created_at).toUpperCase()}
        </Text>
      </View>

      {/* Post thumbnail */}
      {item.post_image_path && (
        <PostThumb imagePath={item.post_image_path} />
      )}

      <Ionicons name="chevron-forward" color={feed.inkDim} size={14} />
    </Pressable>
  );
}

function PostThumb({ imagePath }: { imagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    // `cancelled` voorkomt een setState nadat de rij uit de lijst is
    // gevallen — de ondertekende URL komt asynchroon binnen.
    let cancelled = false;
    supabase.storage
      .from("posts")
      .createSignedUrl(imagePath, 300)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
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

/** Kort in op een woordgrens — een half woord leest slordig. */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
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
