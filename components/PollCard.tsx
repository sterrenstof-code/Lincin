import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { ActionSheet } from "./ActionSheet";
import { CommentsSection } from "./CommentsSection";
import { votePoll, deletePoll, type PollWithDetails } from "@/lib/api/polls";
import { useAuth } from "@/lib/auth/provider";

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
    <View className="bg-paper-soft rounded-2xl p-3">
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <Avatar name={localPoll.author?.display_name ?? localPoll.author?.username} avatarUrl={localPoll.author?.avatar_url ?? null} size="sm" />
        <View className="flex-1">
          <Text className="text-ink font-semibold text-sm">
            {localPoll.author?.display_name ?? localPoll.author?.username ?? "Onbekend"}
          </Text>
          <Text className="text-ink-muted text-xs">
            {formatRelativeTime(localPoll.created_at)}
            {localPoll.ends_at && !isExpired ? ` · eindigt ${formatRelativeTime(localPoll.ends_at)}` : ""}
            {isExpired ? " · gesloten" : ""}
          </Text>
        </View>
        <View className="bg-flame/20 rounded-full px-2.5 py-1">
          <Text className="text-flame text-xs font-semibold">Stemming</Text>
        </View>
        {isMine && (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} className="w-8 h-8 items-center justify-center">
            <Ionicons name="ellipsis-horizontal" color="#5A4F40" size={18} />
          </Pressable>
        )}
      </View>

      {/* Vraag */}
      <Text className="text-ink text-base font-semibold mb-3">{localPoll.question}</Text>

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
                className="rounded-2xl overflow-hidden"
              >
                <View
                  className="flex-row items-center px-4 py-3 gap-2"
                  style={{ backgroundColor: isMyVote ? "#D4622010" : "#1A160E08" }}
                >
                  {/* Voortgangsbalk */}
                  <View
                    className="absolute left-0 top-0 bottom-0 rounded-2xl"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isMyVote ? "#D4622022" : "#1A160E0A",
                    }}
                  />
                  {/* Label */}
                  <Text className={`flex-1 text-sm font-medium ${isMyVote ? "text-flame" : "text-ink"}`}>
                    {option.label}
                  </Text>
                  {/* Overlapping avatars */}
                  {shownVoters.length > 0 && (
                    <View className="flex-row items-center" style={{ marginRight: 2 }}>
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
                        <View className="w-6 h-6 rounded-full bg-paper items-center justify-center" style={{ marginLeft: -8, zIndex: 0 }}>
                          <Text className="text-ink-muted text-[9px] font-bold">+{extraVoters}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* Count + % */}
                  <Text className={`text-xs font-bold tabular-nums ${isMyVote ? "text-flame" : "text-ink-muted"}`}>
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
              className="border border-paper rounded-2xl px-4 py-3 active:bg-paper"
            >
              <Text className="text-ink text-sm font-medium">{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View className="flex-row items-center mt-3 gap-2">
        {voting && <ActivityIndicator size="small" color="#D46220" />}
        <Text className="text-ink-muted text-xs">
          {localPoll.total_votes} {localPoll.total_votes === 1 ? "stem" : "stemmen"}
        </Text>
        {canChange && !voting && (
          <Text className="text-ink-muted text-xs">· tik om te wijzigen</Text>
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
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
