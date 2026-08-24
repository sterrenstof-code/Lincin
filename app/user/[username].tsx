import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityHistory } from "@/components/ActivityHistory";
import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { Skeleton, SkeletonGallery } from "@/components/Skeleton";
import { safeBack } from "@/lib/nav";
import { useAuth } from "@/lib/auth/provider";
import { getOrCreateDirectChat } from "@/lib/api/chats";
import {
  acceptFriendRequest,
  deleteFriendship,
  listMyFriendships,
  sendFriendRequest,
} from "@/lib/api/friends";
import { getProfileByUsername } from "@/lib/api/profiles";
import { listUserPosts } from "@/lib/api/posts";
import { feed, FEED_BORDER, feedType, flame, flameDeep } from "@/lib/design/type";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function UserProfileScreen() {
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  const username = (raw ?? "").toString().trim().toLowerCase();

  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);

  const profile = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: () => getProfileByUsername(username),
    enabled: !!username,
  });

  const friendships = useQuery({
    queryKey: ["friendships", session?.user.id ?? "anon"],
    queryFn: () => listMyFriendships(session!.user.id),
    enabled: !!session,
  });

  const posts = useQuery({
    queryKey: ["posts-by-user", profile.data?.id],
    queryFn: () => listUserPosts(profile.data!.id, 60),
    enabled: !!profile.data,
  });

  const relation: Relation = useMemo(() => {
    if (authLoading) return { kind: "loading" };
    if (!session) return { kind: "needs-login" };
    if (profile.isLoading) return { kind: "loading" };
    if (!profile.data) return { kind: "not-found" };
    if (profile.data.id === session.user.id) return { kind: "self" };
    const f = (friendships.data ?? []).find(
      (f) => f.other.id === profile.data!.id
    );
    if (f?.status === "accepted")
      return { kind: "friend", friendshipId: f.id };
    if (f?.status === "pending" && f.requester_id === session.user.id)
      return { kind: "outgoing", friendshipId: f.id };
    if (f?.status === "pending")
      return { kind: "incoming", friendshipId: f.id };
    return { kind: "stranger" };
  }, [authLoading, session, profile.data, profile.isLoading, friendships.data]);

  async function onSendRequest() {
    if (!session || !profile.data) return;
    setPendingAction(true);
    setError(null);
    try {
      await sendFriendRequest(session.user.id, profile.data.id);
      await qc.invalidateQueries({ queryKey: ["friendships", session.user.id] });
    } catch (e: any) {
      setError(e?.message ?? "Kon verzoek niet versturen.");
    } finally {
      setPendingAction(false);
    }
  }

  async function onAccept(friendshipId: string, requesterId: string) {
    setPendingAction(true);
    setError(null);
    try {
      await acceptFriendRequest(friendshipId, session!.user.id, requesterId);
      await qc.invalidateQueries({ queryKey: ["friendships", session!.user.id] });
    } finally {
      setPendingAction(false);
    }
  }

  async function onCancel(friendshipId: string) {
    setPendingAction(true);
    setError(null);
    try {
      await deleteFriendship(friendshipId);
      await qc.invalidateQueries({ queryKey: ["friendships", session!.user.id] });
    } finally {
      setPendingAction(false);
    }
  }

  async function onOpenChat() {
    if (!profile.data) return;
    setPendingAction(true);
    try {
      const chatId = await getOrCreateDirectChat(profile.data.id);
      router.replace(`/chat/${chatId}`);
    } catch (e: any) {
      setError(e?.message ?? "Kon chat niet openen.");
    } finally {
      setPendingAction(false);
    }
  }

  const heroName = profile.data?.display_name ?? username;

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        backLabel="Terug"
        onBack={() => safeBack(router, "/(app)/feed")}
        contentStyle={{ paddingVertical: 24, paddingBottom: 80 }}
      >
        <Pressable
          onPress={() => safeBack(router, "/(app)/feed")}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", marginBottom: 22 }}
        >
          <Ionicons name="chevron-back" color={feed.ink} size={16} />
          <Text style={[feedType.label, { color: feed.ink, marginLeft: 4 }]}>Terug</Text>
        </Pressable>

        {/* Hero — links uitgelijnd, niet gecentreerd. Een profiel is hier
            een redactionele kop met een portret, geen visitekaartje. */}
        <View
          style={{
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
            backgroundColor: feed.post,
            padding: wide ? 32 : 24,
          }}
        >
          {relation.kind === "loading" ? (
            <>
              <Skeleton className="w-20 h-20 bg-paper-warm" />
              <View className="h-3" />
              <Skeleton className="w-40 h-6 bg-paper-warm" />
              <View className="h-2" />
              <Skeleton className="w-24 h-3.5 bg-paper-warm" />
            </>
          ) : relation.kind === "not-found" ? (
            <>
              <View className="w-20 h-20 bg-paper-warm items-center justify-center">
                <Ionicons name="help" color={feed.ink} size={32} />
              </View>
              <Text style={[feedType.heroSmall, { color: feed.text, marginTop: 16 }]}>
                Niet gevonden
              </Text>
              <Text style={[feedType.body, { color: feed.textDim, marginTop: 8 }]}>
                @{username} bestaat niet (of heeft een andere handle).
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[feedType.kicker, { color: flame, letterSpacing: 0.55, marginBottom: 16 }]}
              >
                PROFIEL
              </Text>
              <Avatar name={heroName} avatarUrl={profile.data?.avatar_url} size="hero" tint="warm" />
              {profile.data?.display_name ? (
                <Text
                  style={[
                    wide ? feedType.hero : feedType.heroSmall,
                    { color: feed.text, marginTop: 18 },
                  ]}
                  numberOfLines={2}
                >
                  {profile.data.display_name}
                </Text>
              ) : null}
              <Text style={[feedType.label, { fontSize: 14, color: feed.textDim, marginTop: 6 }]}>
                @{profile.data?.username ?? username}
              </Text>
              {profile.data?.bio ? (
                <Text
                  style={[
                    feedType.body,
                    { color: feed.textDim, marginTop: 14, textAlign: "center", maxWidth: 460 },
                  ]}
                >
                  {profile.data.bio}
                </Text>
              ) : null}

              <View className="w-full mt-5">
                <ActionButton
                  relation={relation}
                  username={username}
                  loading={pendingAction}
                  onSend={onSendRequest}
                  onAccept={(id) => onAccept(id, profile.data?.id ?? "")}
                  onCancel={(id) => onCancel(id)}
                  onChat={onOpenChat}
                  onLogin={() => router.replace("/(auth)/login")}
                  onEdit={() => router.push("/profile-edit")}
                />
              </View>

              {error && (
                <Text className="text-red-700 text-sm mt-3 text-center">
                  {error}
                </Text>
              )}
            </>
          )}
        </View>

        {/* Posts */}
        {relation.kind !== "not-found" && (
          <View className="mt-6">
            <Text
              style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 16 }]}
            >
              GEDEELDE VONDSTEN
            </Text>
            {posts.isLoading ? (
              <SkeletonGallery />
            ) : (posts.data?.length ?? 0) === 0 ? (
              <View className="bg-paper-soft p-5">
                <Text className="text-ink-soft text-sm leading-5">
                  {relation.kind === "self"
                    ? "Je hebt nog niks gedeeld. Plaats je eerste post vanaf de Feed-tab."
                    : `@${profile.data?.username ?? username} heeft nog niets gedeeld.`}
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
                {posts.data!.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/post/${p.id}`)}
                    className="w-1/3 p-[3px]"
                  >
                    <View className="bg-paper-warm" style={{ aspectRatio: 1, borderRadius: 12, overflow: "hidden" }}>
                      {p.image_url ? (
                        <Image
                          source={{ uri: p.image_url, cacheKey: p.image_path ?? p.id }}
                          cachePolicy="disk"
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          transition={150}
                        />
                      ) : p.link_url ? (
                        <View className="flex-1 items-center justify-center p-2">
                          <View className="w-8 h-8 bg-paper items-center justify-center mb-1">
                            <Ionicons name="link" color={feed.ink} size={14} />
                          </View>
                          <Text
                            className="text-ink-soft text-[9px] text-center leading-3"
                            numberOfLines={2}
                          >
                            {(() => { try { return new URL(p.link_url).hostname.replace(/^www\./, ""); } catch { return p.link_url; } })()}
                          </Text>
                        </View>
                      ) : p.caption ? (
                        <View className="flex-1 justify-center p-2.5">
                          <Text
                            className="text-ink text-[11px] font-medium leading-4"
                            numberOfLines={4}
                          >
                            {p.caption}
                          </Text>
                        </View>
                      ) : (
                        <View className="flex-1 items-center justify-center">
                          <Ionicons name="text" color="#8C7B6B" size={20} />
                        </View>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Activiteit — wat deze persoon gedaan heeft, per bladzijde. */}
        {relation.kind !== "not-found" && profile.data?.id ? (
          <ActivityHistory
            userId={profile.data.id}
            title="Activiteit"
            emptyLabel="Nog geen activiteit om te tonen."
          />
        ) : null}
      </PageScroll>
    </SafeAreaView>
  );
}

type Relation =
  | { kind: "loading" }
  | { kind: "needs-login" }
  | { kind: "not-found" }
  | { kind: "self" }
  | { kind: "stranger" }
  | { kind: "friend"; friendshipId: string }
  | { kind: "outgoing"; friendshipId: string }
  | { kind: "incoming"; friendshipId: string };

function ActionButton({
  relation,
  username,
  loading,
  onSend,
  onAccept,
  onCancel,
  onChat,
  onLogin,
  onEdit,
}: {
  relation: Relation;
  username: string;
  loading: boolean;
  onSend: () => void;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  onChat: () => void;
  onLogin: () => void;
  onEdit: () => void;
}) {
  const primaryClass =
    "w-full bg-ink active:bg-ink-soft py-3.5 items-center";
  const ghostClass =
    "w-full border border-ink/30 active:bg-paper py-3 items-center mt-2";

  switch (relation.kind) {
    case "needs-login":
      return (
        <Pressable onPress={onLogin} className={primaryClass}>
          <Text className="text-cream font-semibold">Inloggen</Text>
        </Pressable>
      );
    case "self":
      return (
        <Pressable onPress={onEdit} className={primaryClass}>
          <Text className="text-cream font-semibold">Bewerk profiel</Text>
        </Pressable>
      );
    case "friend":
      return (
        <Pressable onPress={onChat} disabled={loading} className={primaryClass}>
          <Text className="text-cream font-semibold">
            {loading ? "Bezig…" : "Stuur bericht"}
          </Text>
        </Pressable>
      );
    case "incoming":
      return (
        <>
          <Pressable
            // De `requesterId` wordt door de ouder al meegebonden (zie waar
            // `onAccept` wordt doorgegeven); hier hoort alleen het id.
            onPress={() => onAccept(relation.friendshipId)}
            disabled={loading}
            className={primaryClass}
          >
            <Text className="text-cream font-semibold">
              {loading ? "Bezig…" : "Accepteer verzoek"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onCancel(relation.friendshipId)}
            disabled={loading}
            className={ghostClass}
          >
            <Text className="text-ink font-semibold">Weiger</Text>
          </Pressable>
        </>
      );
    case "outgoing":
      return (
        <>
          <View className="w-full border border-ink/20 py-3.5 items-center">
            <Text className="text-ink-soft font-semibold">Verzoek verstuurd</Text>
          </View>
          <Pressable
            onPress={() => onCancel(relation.friendshipId)}
            disabled={loading}
            className={ghostClass}
          >
            <Text className="text-ink font-semibold">Annuleer</Text>
          </Pressable>
        </>
      );
    case "stranger":
      return (
        <Pressable onPress={onSend} disabled={loading} className={primaryClass}>
          <Text className="text-cream font-semibold">
            {loading ? "Bezig…" : `Voeg @${username} toe`}
          </Text>
        </Pressable>
      );
    default:
      return null;
  }
}
