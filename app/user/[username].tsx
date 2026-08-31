import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActivityHistory } from "@/components/ActivityHistory";
import { PostGrid } from "@/components/PostGrid";
import { Avatar } from "@/components/Avatar";
import { DetailState } from "@/components/DetailState";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { Skeleton } from "@/components/Skeleton";
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
import { feed, feedType, flameDeep, space } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";


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

  usePageTitle(
    profile.data ? (profile.data.display_name ?? `@${profile.data.username}`) : null
  );

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

  /**
   * Een mislukte query is geen niet-bestaand mens.
   *
   * `relation` keek alleen naar `isLoading` en `data`, dus alles wat niet
   * laadde viel door naar `not-found` — en dan stond er "@tom bestaat niet
   * (of heeft een andere handle)" terwijl de server simpelweg niet
   * antwoordde. Dat is dezelfde verwisseling die DESIGN.md §4b beschrijft,
   * en juist hier weegt hij zwaar: dit is het scherm achter "Jouw linc"
   * (lib/share.ts). Iemand krijgt jouw link doorgestuurd, de verbinding
   * hapert één keer, en de app vertelt hem dat jij niet bestaat.
   *
   * `DetailState` brengt de schil mee inclusief de terug-knop — zonder dat
   * is een deep-link naar deze pagina een kamer zonder deur.
   */
  if (profile.isError) {
    return (
      <DetailState
        kind="error"
        subject={`@${username}`}
        error={profile.error}
        onRetry={() => profile.refetch()}
        backLabel="Terug"
        onBack={() => safeBack(router, "/(app)/feed")}
      />
    );
  }

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

        {/*
            De kop van een profiel: een portret, een naam, en wat je met
            deze persoon kunt.

            Dit was een plum vlak van bijna een halve pagina met de naam in
            koeienletters, de bio eronder gecentreerd, en een knop over de
            volle breedte. Veel ruimte voor drie regels tekst — en een
            gekleurd vlak dat het profiel losknipt van de vondsten eronder,
            terwijl het dezelfde pagina is. Nu staat het op het paginavlak,
            op één regel: portret links, naam en bio ernaast, de knop waar
            hij hoort.
        */}
        <View style={{ paddingVertical: space.lg }}>
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
              <Text style={[feedType.heroSmall, { color: feed.ink, marginTop: space.lg }]}>
                Niet gevonden
              </Text>
              <Text style={[feedType.body, { color: feed.inkDim, marginTop: space.sm }]}>
                @{username} bestaat niet (of heeft een andere handle).
              </Text>
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.lg }}>
                <Avatar
                  name={heroName}
                  avatarUrl={profile.data?.avatar_url}
                  size="hero"
                  tint="warm"
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  {profile.data?.display_name ? (
                    <Text
                      style={[
                        feedType.heroSmall,
                        { fontSize: wide ? 34 : 26, lineHeight: wide ? 38 : 30, color: feed.ink },
                      ]}
                      numberOfLines={2}
                    >
                      {profile.data.display_name}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      feedType.label,
                      { fontSize: 14, color: feed.inkDim, marginTop: space.xs },
                    ]}
                  >
                    @{profile.data?.username ?? username}
                  </Text>
                  {profile.data?.bio ? (
                    <Text
                      style={[
                        feedType.body,
                        { color: feed.inkDim, marginTop: space.sm, maxWidth: 520 },
                      ]}
                    >
                      {profile.data.bio}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ marginTop: space.lg, maxWidth: 320 }}>
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
            {/* Zelfde raster als op je eigen profiel, en dus ook dezelfde
                beweging naar de volledige plaat. Hier stond een eigen
                variant met afgeronde hoeken en losse kleurwaarden — twee
                rasters voor hetzelfde ding. Zie components/PostGrid.tsx. */}
            <PostGrid
              posts={posts.data}
              loading={posts.isLoading}
              emptyLabel={
                relation.kind === "self"
                  ? "Je hebt nog niks gedeeld. Plaats je eerste vondst vanaf de feed."
                  : `@${profile.data?.username ?? username} heeft nog niets gedeeld.`
              }
            />
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
