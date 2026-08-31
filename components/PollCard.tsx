import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { ActionSheet } from "./ActionSheet";
import { CommentsSection } from "./CommentsSection";
import { votePoll, deletePoll, type PollWithDetails } from "@/lib/api/polls";
import { useAuth } from "@/lib/auth/provider";
import { feed, FEED_BORDER, feedType, space } from "@/lib/design/type";
import { NL } from "@/lib/locale";

export function PollCard({
  poll,
  onVoted,
  onDeleted,
}: {
  poll: PollWithDetails;
  onVoted?: (updatedPoll: PollWithDetails) => void;
  onDeleted?: () => void;
}) {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const isMine = poll.user_id === myUserId;
  const [voting, setVoting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);

  const hasVoted = !!localPoll.my_vote_option_id;
  const isExpired = localPoll.ends_at ? new Date(localPoll.ends_at) < new Date() : false;
  const showResults = hasVoted || isExpired;
  const canChange = hasVoted && !isExpired;

  async function handleVote(optionId: string) {
    if (voting || isExpired) return;
    if (optionId === localPoll.my_vote_option_id) return; // al gestemd op dit optie
    setVoting(true);
    try {
      await votePoll({ optionId, userId: myUserId, pollId: localPoll.id });
      const myProfile = localPoll.author?.id === myUserId ? localPoll.author : null;
      const prevVoteId = localPoll.my_vote_option_id;
      const updated: PollWithDetails = {
        ...localPoll,
        my_vote_option_id: optionId,
        // total_votes stays the same when changing (remove old, add new)
        total_votes: prevVoteId ? localPoll.total_votes : localPoll.total_votes + 1,
        options: localPoll.options.map((o) => {
          if (o.id === optionId) {
            return {
              ...o,
              vote_count: o.vote_count + 1,
              voters: myProfile
                ? [...o.voters.filter((v) => v.id !== myUserId), myProfile]
                : o.voters,
            };
          }
          if (o.id === prevVoteId) {
            // Remove old vote
            return {
              ...o,
              vote_count: Math.max(0, o.vote_count - 1),
              voters: o.voters.filter((v) => v.id !== myUserId),
            };
          }
          return o;
        }),
      };
      setLocalPoll(updated);
      onVoted?.(updated);
    } finally {
      setVoting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deletePoll(localPoll.id);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  }

  if (deleting) return null;

  return (
    <View className="py-1">
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <Avatar name={localPoll.author?.display_name ?? localPoll.author?.username} avatarUrl={localPoll.author?.avatar_url ?? null} size="sm" />
        <View className="flex-1">
          <Text className="text-carbon font-semibold text-sm">
            {localPoll.author?.display_name ?? localPoll.author?.username ?? "Onbekend"}
          </Text>
          <Text className="text-carbon-muted text-xs">
            {formatRelativeTime(localPoll.created_at)}
            {localPoll.ends_at && !isExpired ? ` · eindigt ${formatRelativeTime(localPoll.ends_at)}` : ""}
            {isExpired ? " · gesloten" : ""}
          </Text>
        </View>
        <View className="bg-page-alt px-2.5 py-1">
          <Text className="text-carbon text-xs font-semibold">Stemming</Text>
        </View>
        {isMine && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Opties voor deze stemming"
            onPress={() => setMenuOpen(true)} hitSlop={8} className="w-8 h-8 items-center justify-center">
            <Ionicons name="ellipsis-horizontal" color={feed.inkDim} size={18} />
          </Pressable>
        )}
      </View>

      {/* Vraag */}
      <Text className="text-carbon text-base font-semibold mb-3">{localPoll.question}</Text>

      {/* Opties */}
      <View className="gap-2">
        {localPoll.options.map((option) => {
          const pct = localPoll.total_votes > 0
            ? Math.round((option.voters.length / localPoll.total_votes) * 100)
            : 0;
          const isMyVote = localPoll.my_vote_option_id === option.id;

          if (showResults) {
            const shownVoters = option.voters.slice(0, 5);
            const extraVoters = option.voters.length > 5 ? option.voters.length - 5 : 0;
            return (
              <Pressable
                key={option.id}
                onPress={() => canChange ? handleVote(option.id) : undefined}
                disabled={!canChange || isMyVote}
              >
                <View
                  className="flex-row items-center px-4 py-3 gap-2"
                  style={{ backgroundColor: isMyVote ? "#12110F10" : "#12110F08" }}
                >
                  {/* Voortgangsbalk */}
                  <View
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isMyVote ? "#12110F22" : "#12110F0A",
                    }}
                  />
                  {/* Label */}
                  <Text className={`flex-1 text-sm font-medium ${isMyVote ? "text-carbon" : "text-carbon"}`}>
                    {option.label}
                  </Text>
                  {/* Overlapping avatars */}
                  {shownVoters.length > 0 && (
                    <VoterPeek voters={option.voters}>
                      {shownVoters.map((voter, i) => (
                        <View key={voter.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shownVoters.length - i }}>
                          <Avatar
                            name={voter.display_name ?? voter.username}
                            avatarUrl={voter.avatar_url ?? null}
                            size="xs"
                          />
                        </View>
                      ))}
                      {extraVoters > 0 && (
                        <View className="w-6 h-6 bg-page-alt items-center justify-center" style={{ marginLeft: -8, zIndex: 0 }}>
                          <Text className="text-carbon-muted text-[9px] font-bold">+{extraVoters}</Text>
                        </View>
                      )}
                    </VoterPeek>
                  )}
                  {/* Count + % */}
                  <Text className={`text-xs font-bold tabular-nums ${isMyVote ? "text-carbon" : "text-carbon-muted"}`}>
                    {option.voters.length} · {pct}%
                  </Text>
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={option.id}
              onPress={() => handleVote(option.id)}
              className="border border-page-alt px-4 py-3 active:bg-page-alt"
            >
              <Text className="text-carbon text-sm font-medium">{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View className="flex-row items-center mt-3 gap-2">
        {voting && <ActivityIndicator size="small" color={feed.ink} />}
        <Text className="text-carbon-muted text-xs">
          {localPoll.total_votes} {localPoll.total_votes === 1 ? "stem" : "stemmen"}
        </Text>
        {canChange && !voting && (
          <Text className="text-carbon-muted text-xs">· tik om te wijzigen</Text>
        )}
      </View>

      <CommentsSection
        entityType="poll"
        entityId={localPoll.id}
        ownerId={localPoll.user_id}
      />

      {isMine && (
        <ActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          title="Stemming"
          actions={[
            {
              label: "Verwijderen",
              icon: "trash-outline",
              destructive: true,
              onPress: () => { setMenuOpen(false); handleDelete(); },
            },
          ]}
        />
      )}
    </View>
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
  return new Date(iso).toLocaleDateString(NL, { day: "numeric", month: "short" });
}

/**
 * Wie er op deze optie gestemd hebben.
 *
 * ---------------------------------------------------------------
 * WAAROM NIET ALLEEN HOVER
 * ---------------------------------------------------------------
 * Hover bestaat niet op een telefoon. Een functie die je daar niet kunt
 * bereiken is geen functie maar een bureaublad-extraatje, en de helft van
 * deze app draait op een toestel zonder muis. Dus: aanwijzen opent hem op
 * web, aantikken opent hem overal.
 *
 * Dat aantikken moet wél de stem met rust laten. De rij eronder is zelf
 * een knop ("tik om te wijzigen"); een Pressable binnen een Pressable vangt
 * de aanraking en laat hem niet doorlopen naar de ouder, dus dat gaat
 * vanzelf goed — maar het is precies waarom dit een Pressable moet zijn en
 * geen View met een onTouchStart.
 *
 * De rij had `overflow-hidden`. Dat knipte dit paneel weg, en het diende
 * nergens voor: de voortgangsbalk erin is een percentage van de breedte en
 * kan per definitie niet buiten de rij vallen.
 */
function VoterPeek({
  voters,
  children,
}: {
  voters: { id: string; display_name: string | null; username: string }[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Een lijst van veertig namen is geen tooltip meer. Boven de tien tonen
  // we er tien en zeggen we hoeveel er nog zijn.
  const shown = voters.slice(0, 10);
  const rest = voters.length - shown.length;

  return (
    <View style={{ marginRight: 2 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        onHoverIn={() => setOpen(true)}
        onHoverOut={() => setOpen(false)}
        accessibilityLabel={`Wie stemden: ${shown
          .map((v) => v.display_name ?? v.username)
          .join(", ")}`}
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        {children}
      </Pressable>

      {open ? (
        <View
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 6,
            minWidth: 140,
            maxWidth: 240,
            backgroundColor: feed.panel,
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
            // Boven de rij ernaast blijven, op alle drie de platforms.
            zIndex: 100,
            elevation: 8,
          }}
        >
          <Text
            style={[
              feedType.kicker,
              { color: feed.inkDim, letterSpacing: 0.55, marginBottom: 4 },
            ]}
          >
            {voters.length === 1 ? "STEMDE" : "STEMDEN"}
          </Text>
          {shown.map((voter) => (
            <Text
              key={voter.id}
              style={[feedType.label, { color: feed.ink, marginTop: 2 }]}
              numberOfLines={1}
            >
              {voter.display_name ?? voter.username}
            </Text>
          ))}
          {rest > 0 ? (
            <Text style={[feedType.label, { color: feed.inkDim, marginTop: 4 }]}>
              en {rest} {rest === 1 ? "ander" : "anderen"}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
