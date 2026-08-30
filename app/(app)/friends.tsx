import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { QueryError } from "@/components/QueryError";
import { SkeletonListCard } from "@/components/Skeleton";
import { creamOnDark, feed, flameDeep } from "@/lib/design/type";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { useToast } from "@/lib/toast";
import {
  acceptFriendRequest,
  deleteFriendship,
  listMyFriendships,
  sendFriendRequest,
  type FriendshipWithProfile,
} from "@/lib/api/friends";
import { searchProfilesByUsername, getProfile, type Profile } from "@/lib/api/profiles";
import { buildAddFriendUrl, shareText } from "@/lib/share";

export default function FriendsScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const qc = useQueryClient();
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const toast = useToast();

  const [query, setQuery] = useState("");

  const profile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId),
  });

  async function onShareLink() {
    const username = profile.data?.username;
    if (!username) return;
    await shareText({
      title: "Voeg me toe op Lincin",
      message: `Linc met mij op Lincin: ${buildAddFriendUrl(username)}`,
    });
  }
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
      toast.show("Linc-verzoek verstuurd.");
    } catch {
      toast.error("Het verzoek kon niet verstuurd worden.", {
        action: { label: "Opnieuw", onPress: () => onSendRequest(targetId) },
      });
    }
  }

  async function onAccept(friendshipId: string, requesterId: string) {
    try {
      await acceptFriendRequest(friendshipId, myUserId, requesterId);
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    } catch {
      // Stond hier zonder `try`: een mislukte accept werd een onafgevangen
      // rejection, dus de rij bleef staan en er stond nergens waarom.
      toast.error("Het verzoek kon niet aanvaard worden.", {
        action: {
          label: "Opnieuw",
          onPress: () => onAccept(friendshipId, requesterId),
        },
      });
    }
  }

  /**
   * Eén verzoek intrekken, weigeren of een linc verbreken.
   *
   * Alle drie de knoppen riepen dit rechtstreeks aan: één tik op
   * "Verwijder" en de linc was weg — geen bevestiging, geen weg terug, en
   * bij een fout een onafgevangen rejection. De chatlijst ernaast vraagt
   * voor precies dezelfde zwaarte wél om bevestiging, in twee stappen.
   *
   * Nu bepaalt `kind` wat er hoort te gebeuren:
   *   remove  — een bestaande linc. Verbreken raakt iemand anders en is
   *             niet ongedaan te maken: bevestigen.
   *   reject  — een verzoek dat iemand jou stuurde. Weiger je het, dan moet
   *             hij opnieuw beginnen: bevestigen.
   *   cancel  — je eigen verzoek intrekken. Kost jou één tik om opnieuw te
   *             sturen, dus daar staat een venster alleen maar in de weg.
   */
  async function onDelete(
    friendshipId: string,
    kind: "remove" | "reject" | "cancel",
    name: string
  ) {
    if (kind !== "cancel") {
      const ok = await confirm(
        kind === "remove" ? `Linc met ${name} verbreken?` : `Verzoek van ${name} weigeren?`,
        kind === "remove"
          ? "Jullie verdwijnen uit elkaars lijst. Je kunt daarna opnieuw een verzoek sturen."
          : "Het verzoek verdwijnt. Wil je later toch, dan moet die persoon opnieuw een verzoek sturen.",
        {
          affirmativeLabel: kind === "remove" ? "Verbreken" : "Weigeren",
          destructive: true,
        }
      );
      if (!ok) return;
    }

    try {
      await deleteFriendship(friendshipId);
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    } catch {
      toast.error(
        kind === "remove"
          ? "De linc kon niet verbroken worden."
          : "Het verzoek kon niet ingetrokken worden.",
        {
          action: {
            label: "Opnieuw",
            // Zonder bevestiging: die is hierboven al gegeven.
            onPress: () => onDelete(friendshipId, "cancel", name),
          },
        }
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* Eén scroller voor de hele pagina; de kop plakt bovenaan.
          Geen ScreenContainer meer: dit ontwerp gebruikt de volle
          breedte tot PAGE_MAX. */}
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
      >
      <View style={{ paddingVertical: 20, paddingBottom: 40 }}>
        <View>
          <Text className="text-3xl font-bold tracking-tight text-ink mb-1">
            Lincs
          </Text>
          <Text className="text-ink-soft text-base mb-5">
            Link up met mensen die je kent.
          </Text>

          {/* ── Link up ── */}
          <View className="bg-paper p-4 mb-5">
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-3 px-1">
              Link up
            </Text>
            {/* Twee primaire acties naast elkaar */}
            <View className="flex-row gap-2 mb-2">
              <Pressable
                onPress={() => router.push("/qr-scan")}
                className="flex-1 flex-row items-center justify-center gap-2 bg-ink active:bg-ink-soft py-3.5 px-4"
              >
                <Ionicons name="qr-code-outline" color={creamOnDark.DEFAULT} size={20} />
                <Text className="text-cream font-semibold text-sm">Scan een linc</Text>
              </Pressable>
              <Pressable
                onPress={onShareLink}
                className="flex-1 flex-row items-center justify-center gap-2 bg-paper-soft active:bg-paper py-3.5 px-4"
              >
                <Ionicons name="share-outline" color={feed.ink} size={20} />
                <Text className="text-ink font-semibold text-sm">Jouw linc</Text>
              </Pressable>
            </View>
            {/* Secundaire actie: iemand uitnodigen die nog niet op Lincin zit */}
            <Pressable
              onPress={() => router.push("/invite-email")}
              className="flex-row items-center justify-center gap-2 py-2.5"
            >
              <Ionicons name="mail-outline" color={feed.inkDim} size={15} />
              <Text className="text-ink-muted text-xs">
                Iemand uitnodigen die nog niet op Lincin zit
              </Text>
            </Pressable>
          </View>

          {/* ── Zoekbalk ── */}
          <View className="flex-row items-center bg-paper-light px-4 border border-line-paper mb-4">
            <Ionicons name="search" color={feed.inkDim} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Zoek iemand op handle"
              placeholderTextColor={feed.inkDim}
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 text-ink text-base py-3 pl-2"
            />
            {query.length > 0 && (
              <Pressable
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Zoekopdracht wissen"
                onPress={() => setQuery("")} className="p-1">
                <Ionicons name="close-circle" color={feed.inkDim} size={18} />
              </Pressable>
            )}
          </View>

          {trimmed.length >= 2 && (
            <Section title="Zoekresultaten">
              {search.isError ? (
                <QueryError
                  compact
                  title="Zoeken lukte niet"
                  error={search.error}
                  onRetry={() => search.refetch()}
                />
              ) : search.isLoading ? (
                <SkeletonListCard rows={2} />
              ) : searchResults.length === 0 ? (
                <PaperHint text="Geen gebruikers gevonden." />
              ) : (
                <View className="bg-paper-soft overflow-hidden">
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
              <View className="bg-paper-soft overflow-hidden">
                {pendingIncoming.map((f, i) => (
                  <FriendshipRow
                    key={f.id}
                    friendship={f}
                    isLast={i === pendingIncoming.length - 1}
                    onRowPress={() => router.push(`/user/${f.other.username}`)}
                    actions={[
                      { label: "Link up", onPress: () => onAccept(f.id, f.requester_id), primary: true },
                      {
                        label: "Weiger",
                        onPress: () =>
                          onDelete(
                            f.id,
                            "reject",
                            f.other.display_name ?? f.other.username
                          ),
                      },
                    ]}
                  />
                ))}
              </View>
            </Section>
          )}

          {pendingOutgoing.length > 0 && (
            <Section title="Verzonden">
              <View className="bg-paper-soft overflow-hidden">
                {pendingOutgoing.map((f, i) => (
                  <FriendshipRow
                    key={f.id}
                    friendship={f}
                    isLast={i === pendingOutgoing.length - 1}
                    onRowPress={() => router.push(`/user/${f.other.username}`)}
                    actions={[
                      {
                        label: "Annuleer",
                        onPress: () =>
                          onDelete(
                            f.id,
                            "cancel",
                            f.other.display_name ?? f.other.username
                          ),
                      },
                    ]}
                  />
                ))}
              </View>
            </Section>
          )}

          <Section title="Jouw lincs">
            {friendships.isError ? (
              <QueryError
                compact
                title="Je lincs konden niet geladen worden"
                error={friendships.error}
                onRetry={() => friendships.refetch()}
              />
            ) : friendships.isLoading ? (
              <SkeletonListCard rows={3} />
            ) : accepted.length === 0 ? (
              <PaperHint text="Nog geen lincs. Scan een QR-code of deel jouw linc." />
            ) : (
              <View className="bg-paper-soft overflow-hidden">
                {accepted.map((f, i) => (
                  <FriendshipRow
                    key={f.id}
                    friendship={f}
                    isLast={i === accepted.length - 1}
                    onRowPress={() => router.push(`/user/${f.other.username}`)}
                    actions={[
                      {
                        label: "Verwijder",
                        onPress: () =>
                          onDelete(
                            f.id,
                            "remove",
                            f.other.display_name ?? f.other.username
                          ),
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </Section>
        </View>
      </View>
      </PageScroll>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="text-xs uppercase tracking-wider text-ink-muted mb-3 px-1">
        {title}
      </Text>
      {children}
    </View>
  );
}

function PaperHint({ text }: { text: string }) {
  return (
    <View className="bg-paper-soft p-5">
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
        className="bg-ink active:bg-ink-soft px-4 py-2 flex-row items-center"
      >
        {actionIcon && (
          <Ionicons name={actionIcon} color={creamOnDark.DEFAULT} size={14} style={{ marginRight: 4 }} />
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
                ? "bg-ink active:bg-ink-soft px-3 py-1.5"
                : "border border-ink/20 active:bg-paper px-3 py-1.5"
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
