import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { CommentsSection } from "./CommentsSection";
import { voteCallPlanSlot, type CallPlanWithDetails } from "@/lib/api/call-plans";
import { useAuth } from "@/lib/auth/provider";
import { downloadCalendarEvent } from "@/lib/calendar";

export function CallPlanCard({
  plan,
  onUpdated,
}: {
  plan: CallPlanWithDetails;
  onUpdated?: (updated: CallPlanWithDetails) => void;
}) {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const [localPlan, setLocalPlan] = useState(plan);
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleSlot(slotId: string, currentlyYes: boolean) {
    setSaving(slotId);
    const available = !currentlyYes;
    try {
      await voteCallPlanSlot({ slotId, userId: myUserId, available });
      // Optimistische update
      const updated: CallPlanWithDetails = {
        ...localPlan,
        slots: localPlan.slots.map((s) => {
          if (s.id !== slotId) return s;
          const yesVoters = available
            ? [...s.yes_voters.filter((id) => id !== myUserId), myUserId]
            : s.yes_voters.filter((id) => id !== myUserId);
          const noVoters = available
            ? s.no_voters.filter((id) => id !== myUserId)
            : [...s.no_voters.filter((id) => id !== myUserId), myUserId];
          return { ...s, yes_voters: yesVoters, no_voters: noVoters };
        }),
      };
      setLocalPlan(updated);
      onUpdated?.(updated);
    } finally {
      setSaving(null);
    }
  }

  // Beste slot = meeste yes-votes
  const bestSlot = [...localPlan.slots].sort(
    (a, b) => b.yes_voters.length - a.yes_voters.length
  )[0];

  return (
    <View className="bg-paper-soft rounded-2xl p-3">
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-2">
        <Avatar name={localPlan.author?.display_name ?? localPlan.author?.username} avatarUrl={localPlan.author?.avatar_url ?? null} size="sm" />
        <View className="flex-1">
          <Text className="text-ink font-semibold text-sm">
            {localPlan.author?.display_name ?? localPlan.author?.username ?? "Onbekend"}
          </Text>
          <Text className="text-ink-muted text-xs">{formatRelativeTime(localPlan.created_at)}</Text>
        </View>
        <View className="bg-blue-100 rounded-full px-2.5 py-1">
          <Text className="text-blue-700 text-xs font-semibold">Videocall</Text>
        </View>
      </View>

      {/* Titel */}
      <Text className="text-ink text-base font-semibold mb-1">{localPlan.title}</Text>
      {localPlan.description ? (
        <Text className="text-ink-muted text-sm mb-3">{localPlan.description}</Text>
      ) : null}

      {/* Tijdsloten */}
      <View className="gap-2 mb-3">
        {localPlan.slots.map((slot) => {
          const isBest = slot.id === bestSlot?.id && bestSlot.yes_voters.length > 0;
          const myVote = slot.yes_voters.includes(myUserId);
          const isSaving = saving === slot.id;
          const totalParticipants = new Set([
            ...localPlan.slots.flatMap((s) => [...s.yes_voters, ...s.no_voters]),
          ]).size;

          const yesProfiles = slot.yes_voters
            .map((uid) => localPlan.participant_profiles.find((p) => p.id === uid))
            .filter(Boolean) as typeof localPlan.participant_profiles;

          return (
            <Pressable
              key={slot.id}
              onPress={() => toggleSlot(slot.id, myVote)}
              disabled={isSaving}
              className={`px-4 py-3 rounded-2xl border ${myVote ? "bg-teal-50 border-teal-300" : "bg-paper border-paper"}`}
            >
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${myVote ? "text-teal-700" : "text-ink"}`}>
                    {formatSlotDate(slot.starts_at)}
                  </Text>
                  <Text className={`text-xs mt-0.5 ${myVote ? "text-teal-600" : "text-ink-muted"}`}>
                    {formatSlotTime(slot.starts_at)} – {formatSlotTime(slot.ends_at)}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-xs font-bold text-teal-600">{slot.yes_voters.length}</Text>
                    <Text className="text-xs text-ink-muted">/{totalParticipants > 0 ? totalParticipants : "?"} ✓</Text>
                  </View>
                  {isBest && (
                    <View className="bg-teal-100 rounded-full px-2 py-0.5">
                      <Text className="text-teal-700 text-[10px] font-semibold">Beste</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Wie is er ook */}
              {yesProfiles.length > 0 && (
                <View className="flex-row items-center mt-2">
                  {yesProfiles.slice(0, 6).map((p, i) => (
                    <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 6 - i }}>
                      <Avatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url ?? null} size="xs" />
                    </View>
                  ))}
                  {yesProfiles.length > 6 && (
                    <Text className="text-teal-600 text-[10px] font-semibold ml-1">+{yesProfiles.length - 6}</Text>
                  )}
                  <Text className="text-teal-600 text-[10px] ml-1.5">kunnen</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Deelnemers + agenda-knop */}
      <View className="flex-row items-center gap-2 mt-1">
        {localPlan.participant_profiles.length > 0 && (
          <View className="flex-row items-center gap-1 flex-1">
            {localPlan.participant_profiles.slice(0, 5).map((p) => (
              <Avatar key={p.id} name={p.display_name ?? p.username} avatarUrl={p.avatar_url ?? null} size="xs" />
            ))}
            {localPlan.participant_profiles.length > 5 && (
              <Text className="text-ink-muted text-xs ml-1">
                +{localPlan.participant_profiles.length - 5}
              </Text>
            )}
            <Text className="text-ink-muted text-xs ml-1">gestemd</Text>
          </View>
        )}

        {/* Agenda-knop — alleen als er een winnend slot is */}
        {bestSlot && bestSlot.yes_voters.length > 0 && (
          <Pressable
            onPress={() =>
              downloadCalendarEvent({
                title: localPlan.title,
                description: localPlan.description ?? undefined,
                startsAt: new Date(bestSlot.starts_at),
                endsAt: new Date(bestSlot.ends_at),
              })
            }
            className="flex-row items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1.5"
          >
            <Ionicons name="calendar-outline" color="#0F6E56" size={14} />
            <Text className="text-teal-700 text-xs font-semibold">Agenda</Text>
          </Pressable>
        )}
      </View>

      <CommentsSection
        entityType="call_plan"
        entityId={localPlan.id}
        ownerId={localPlan.user_id}
      />
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
  return days < 7
    ? `${days}d`
    : new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatSlotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}
