import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonListCard } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import {
  acceptFriendRequest,
  deleteFriendship,
  listMyFriendships,
  sendFriendRequest,
  type FriendshipWithProfile,
} from "@/lib/api/friends";
import { searchProfilesByUsername, type Profile } from "@/lib/api/profiles";

export default function FriendsScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const qc = useQueryClient();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const search = useQuery({
    queryKey: ["search-profiles", trimmed, myUserId],
    queryFn: () => searchProfilesByUsername(trimmed, myUserId),
    enabled: trimmed.length >= 2,
  });

  const pendingIncoming = (friendships.data ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === myUserId
  );
  const pendingOutgoing = (friendships.data ?? []).filter(
    (f) => f.status === "pending" && f.requester_id === myUserId
  );
  const accepted = (friendships.data ?? []).filter((f) => f.status === "accepted");

  const friendIds = new Set([
    ...accepted.flatMap((f) => [f.requester_id, f.addressee_id]),
    ...pendingIncoming.map((f) => f.requester_id),
    ...pendingOutgoing.map((f) => f.addressee_id),
  ]);

  const searchResults = (search.data ?? []).filter((p) => !friendIds.has(p.id));

  async function onSendRequest(targetId: string) {
    try {
      await sendFriendRequest(myUserId, targetId);
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
      setQuery("");
    } catch (e: any) {
      console.warn("sendFriendRequest", e?.message ?? e);
    }
  }

  async function onAccept(friendshipId: string) {
    await acceptFriendRequest(friendshipId);
    await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
  }

  async function onDelete(friendshipId: string) {
    await deleteFriendship(friendshipId);
    await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
      <FlatList
        data={[]}
        keyExtractor={() => "_"}
        renderItem={null as never}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Text className="text-3xl font-bold tracking-tight text-cream mb-1">
              Lincs
            </Text>
            <Text className="text-cream-soft text-base mb-5">
              Link up met mensen die je kent.
            </Text>

            {/* ── Link up ── */}
            <View className="bg-paper rounded-3xl p-4 mb-5">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-3 px-1">
                Link up
              </Text>
              {/* Twee primaire acties naast elkaar */}
              <View className="flex-row gap-2 mb-2">
                <Pressable
                  onPress={() => router.push("/qr-scan")}
                  className="flex-1 flex-row items-center justify-center gap-2 bg-ink active:bg-ink-soft rounded-2xl py-3.5 px-4"
                >
                  <Ionicons name="qr-code-outline" color="#F5E8D3" size={20} />
                  <Text className="text-cream font-semibold text-sm">Scan een linc</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/qr-code")}
                  className="flex-1 flex-row items-center justify-center gap-2 bg-paper-soft active:bg-paper rounded-2xl py-3.5 px-4"
                >
                  <Ionicons name="share-outline" color="#1A1714" size={20} />
                  <Text className="text-ink font-semibold text-sm">Jouw linc</Text>
                </Pressable>
              </View>
              {/* Secundaire actie: iemand uitnodigen die nog niet op Lincin zit */}
              <Pressable
                onPress={() => router.push("/invite-email")}
                className="flex-row items-center justify-center gap-2 py-2.5"
              >
                <Ionicons name="mail-outline" color="#8A7E6C" size={15} />
                <Text className="text-ink-muted text-xs">
                  Iemand uitnodigen die nog niet op Lincin zit
                </Text>
              </Pressable>
            </View>

            {/* ── Zoekbalk ── */}
            <View className="flex-row items-center bg-paper-light rounded-full px-4 border border-line-paper mb-4">
              <Ionicons name="search" color="#8A7E6C" size={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Zoek iemand op handle"
                placeholderTextColor="#8A7E6C"
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-ink text-base py-3 pl-2"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} className="p-1">
                  <Ionicons name="close-circle" color="#8A7E6C" size={18} />
                </Pressable>
              )}
            </View>

            {trimmed.length >= 2 && (
              <Section title="Zoekresultaten">
                {search.isLoading ? (
                  <SkeletonListCard rows={2} />
                ) : searchResults.length === 0 ? (
                  <PaperHint text="Geen gebruikers gevonden." />
                ) : (
                  <View className="bg-paper-soft rounded-2xl overflow-hidden">
                    {searchResults.map((p, i) => (
                      <ProfileRow
                        key={p.id}
                        profile={p}
                        onRowPress={() => router.push(`/user/${p.username}`)}
                        onAction={() => onSendRequest(p.id)}
                        actionLabel="Linc"
                        actionIcon="person-add-outline"
                        isLast={i === searchResults.length - 1}
                      />
                    ))}
                  </View>
                )}
              </Section>
            )}

            {pendingIncoming.length > 0 && (
              <Section title={`Linc-verzoeken (${pendingIncoming.length})`}>
                <View className="bg-paper-soft rounded-2xl overflow-hidden">
                  {pendingIncoming.map((f, i) => (
                    <FriendshipRow
                      key={f.id}
                      friendship={f}
                      isLast={i === pendingIncoming.length - 1}
                      onRowPress={() => router.push(`/user/${f.other.username}`)}
                      actions={[
                        { label: "Link up", onPress: () => onAccept(f.id), primary: true },
                        { label: "Weiger", onPress: () => onDelete(f.id) },
                      ]}
                    />
                  ))}
                </View>
              </Section>
            )}

            {pendingOutgoing.length > 0 && (
              <Section title="Verzonden">
                <View className="bg-paper-soft rounded-2xl overflow-hidden">
                  {pendingOutgoing.map((f, i) => (
                    <FriendshipRow
                      key={f.id}
                      friendship={f}
                      isLast={i === pendingOutgoing.length - 1}
                      onRowPress={() => router.push(`/user/${f.other.username}`)}
                      actions={[{ label: "Annuleer", onPress: () => onDelete(f.id) }]}
                    />
                  ))}
                </View>
              </Section>
            )}

            <Section title="Jouw lincs">
              {friendships.isLoading ? (
                <SkeletonListCard rows={3} />
              ) : accepted.length === 0 ? (
                <PaperHint text="Nog geen lincs. Scan een QR-code of deel jouw linc." />
              ) : (
                <View className="bg-paper-soft rounded-2xl overflow-hidden">
                  {accepted.map((f, i) => (
                    <FriendshipRow
                      key={f.id}
                      friendship={f}
                      isLast={i === accepted.length - 1}
                      onRowPress={() => router.push(`/user/${f.other.username}`)}
                      actions={[{ label: "Verwijder", onPress: () => onDelete(f.id) }]}
                    />
                  ))}
                </View>
              )}
            </Section>
          </View>
        }
      />
      </ScreenContainer>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="text-xs uppercase tracking-wider text-cream-muted mb-3 px-1">
        {title}
      </Text>
      {children}
    </View>
  );
}

function PaperHint({ text }: { text: string }) {
  return (
    <View className="bg-paper-soft rounded-2xl p-5">
      <Text className="text-ink-soft text-sm leading-5">{text}</Text>
    </View>
  );
}

function ProfileRow({
  profile,
  onRowPress,
  onAction,
  actionLabel,
  actionIcon,
  isLast,
}: {
  profile: Profile;
  onRowPress: () => void;
  onAction: () => void;
  actionLabel: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  isLast: boolean;
}) {
  return (
    <View
      className={`flex-row items-center px-4 py-3 ${
        isLast ? "" : "border-b border-line-paper/60"
      }`}
    >
      <Pressable
        onPress={onRowPress}
        className="flex-row items-center flex-1"
        hitSlop={4}
      >
        <Avatar name={profile.display_name ?? profile.username} size="md" />
        <View className="flex-1 ml-3">
          <Text className="text-ink font-semibold">
            {profile.display_name ?? profile.username}
          </Text>
          <Text className="text-ink-muted text-xs">@{profile.username}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onAction}
        className="bg-ink active:bg-ink-soft rounded-full px-4 py-2 flex-row items-center"
      >
        {actionIcon && (
          <Ionicons name={actionIcon} color="#F5E8D3" size={14} style={{ marginRight: 4 }} />
        )}
        <Text className="text-cream font-semibold text-sm">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

function FriendshipRow({
  friendship,
  actions,
  onRowPress,
  isLast,
}: {
  friendship: FriendshipWithProfile;
  actions: { label: string; onPress: () => void; primary?: boolean }[];
  onRowPress: () => void;
  isLast: boolean;
}) {
  return (
    <View
      className={`flex-row items-center px-4 py-3 ${
        isLast ? "" : "border-b border-line-paper/60"
      }`}
    >
      <Pressable
        onPress={onRowPress}
        className="flex-row items-center flex-1"
        hitSlop={4}
      >
        <Avatar name={friendship.other.display_name ?? friendship.other.username} size="md" />
        <View className="flex-1 ml-3">
          <Text className="text-ink font-semibold">
            {friendship.other.display_name ?? friendship.other.username}
          </Text>
          <Text className="text-ink-muted text-xs">@{friendship.other.username}</Text>
        </View>
      </Pressable>
      <View className="flex-row gap-2">
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            className={
              a.primary
                ? "bg-ink active:bg-ink-soft rounded-full px-3 py-1.5"
                : "border border-ink/20 active:bg-paper rounded-full px-3 py-1.5"
            }
          >
            <Text
              className={`text-xs font-semibold ${
                a.primary ? "text-cream" : "text-ink"
              }`}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
