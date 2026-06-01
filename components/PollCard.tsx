import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { votePoll, type PollWithDetails } from "@/lib/api/polls";
import { useAuth } from "@/lib/auth/provider";

export function PollCard({
  poll,
  onVoted,
}: {
  poll: PollWithDetails;
  onVoted?: (updatedPoll: PollWithDetails) => void;
}) {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const [voting, setVoting] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);

  const hasVoted = !!localPoll.my_vote_option_id;
  const isExpired = localPoll.ends_at ? new Date(localPoll.ends_at) < new Date() : false;
  const showResults = hasVoted || isExpired;

  async function handleVote(optionId: string) {
    if (voting || showResults) return;
    setVoting(true);
    try {
      await votePoll({ optionId, userId: myUserId, pollId: localPoll.id });
      // Optimistische update — voeg huidige gebruiker toe als voter
      const myProfile = localPoll.author?.id === myUserId ? localPoll.author : null;
      const updated: PollWithDetails = {
        ...localPoll,
        my_vote_option_id: optionId,
        total_votes: localPoll.total_votes + 1,
        options: localPoll.options.map((o) =>
          o.id === optionId
            ? {
                ...o,
                vote_count: o.vote_count + 1,
                voters: myProfile
                  ? [...o.voters.filter((v) => v.id !== myUserId), myProfile]
                  : o.voters,
              }
            : o
        ),
      };
      setLocalPoll(updated);
      onVoted?.(updated);
    } finally {
      setVoting(false);
    }
  }

  return (
    <View className="bg-paper-soft rounded-3xl p-4 mb-3">
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
      </View>

      {/* Vraag */}
      <Text className="text-ink text-base font-semibold mb-3">{localPoll.question}</Text>

      {/* Opties */}
      <View className="gap-2">
        {localPoll.options.map((option) => {
          const pct = localPoll.total_votes > 0
            ? Math.round((option.vote_count / localPoll.total_votes) * 100)
            : 0;
          const isMyVote = localPoll.my_vote_option_id === option.id;

          if (showResults) {
            return (
              <View key={option.id} className="rounded-2xl overflow-hidden">
                <View
                  className="px-4 pt-3 pb-2.5"
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
                  {/* Label + percentage */}
                  <View className="flex-row items-center">
                    <Text className={`flex-1 text-sm font-medium ${isMyVote ? "text-flame" : "text-ink"}`}>
                      {option.label}
                    </Text>
                    <Text className={`text-sm font-bold ${isMyVote ? "text-flame" : "text-ink-muted"}`}>
                      {pct}%
                    </Text>
                  </View>
                  {/* Voter avatars */}
                  {option.voters.length > 0 && (
                    <View className="flex-row items-center gap-1 mt-1.5 flex-wrap">
                      {option.voters.slice(0, 8).map((voter) => (
                        <Avatar
                          key={voter.id}
                          name={voter.display_name ?? voter.username}
                          avatarUrl={voter.avatar_url ?? null}
                          size="xs"
                        />
                      ))}
                      {option.voters.length > 8 && (
                        <Text className="text-ink-muted text-[10px] ml-0.5">
                          +{option.voters.length - 8}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
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
      <View className="flex-row items-center mt-3 gap-1">
        {voting && <ActivityIndicator size="small" color="#D46220" />}
        <Text className="text-ink-muted text-xs">
          {localPoll.total_votes} {localPoll.total_votes === 1 ? "stem" : "stemmen"}
        </Text>
      </View>
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
