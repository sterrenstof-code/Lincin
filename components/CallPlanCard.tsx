import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { CommentsSection } from "./CommentsSection";
import { inviteToCallPlan, voteCallPlanSlot, type CallPlanWithDetails } from "@/lib/api/call-plans";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  const alreadyInvitedIds = new Set(localPlan.invitee_profiles.map((p) => p.id));
  const isMine = localPlan.user_id === myUserId;

  function openInvite() {
    listMyFriendships(myUserId).then((fs) => {
      setFriends(fs.filter((f) => f.status === "accepted" && !alreadyInvitedIds.has(f.other.id)));
    });
    setSelectedIds([]);
    setInviteOpen(true);
  }

  async function sendInvites() {
    if (selectedIds.length === 0 || inviting) return;
    setInviting(true);
    try {
      await inviteToCallPlan({ callPlanId: localPlan.id, inviterUserId: myUserId, inviteeIds: selectedIds });
      setInviteOpen(false);
    } finally {
      setInviting(false);
    }
  }

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

      {/* Footer: deelnemers + uitnodigen + agenda */}
      <View className="flex-row items-center gap-2 mt-2 flex-wrap">
        {/* Uitgenodigde + gestemmde avatars */}
        {localPlan.invitee_profiles.length > 0 && (
          <View className="flex-row items-center gap-1 flex-1">
            {localPlan.invitee_profiles.slice(0, 5).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i }}>
                <Avatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url ?? null} size="xs" />
              </View>
            ))}
            {localPlan.invitee_profiles.length > 5 && (
              <Text className="text-ink-muted text-xs ml-1">+{localPlan.invitee_profiles.length - 5}</Text>
            )}
            <Text className="text-ink-muted text-xs ml-1">uitgenodigd</Text>
          </View>
        )}

        <View className="flex-row items-center gap-2 ml-auto">
          {/* Uitnodigen-knop — alleen voor maker */}
          {isMine && (
            <Pressable
              onPress={openInvite}
              className="flex-row items-center gap-1.5 bg-paper border border-paper rounded-full px-3 py-1.5"
            >
              <Ionicons name="person-add-outline" color="#5A4F40" size={13} />
              <Text className="text-ink-muted text-xs font-semibold">Uitnodigen</Text>
            </Pressable>
          )}

          {/* Agenda-knop */}
          {bestSlot && bestSlot.yes_voters.length > 0 && (
            <Pressable
              onPress={() => downloadCalendarEvent({
                title: localPlan.title,
                description: localPlan.description ?? undefined,
                startsAt: new Date(bestSlot.starts_at),
                endsAt: new Date(bestSlot.ends_at),
              })}
              className="flex-row items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1.5"
            >
              <Ionicons name="calendar-outline" color="#0F6E56" size={13} />
              <Text className="text-teal-700 text-xs font-semibold">Agenda</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Uitnodigings-modal */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View className="bg-paper rounded-t-3xl px-5 pt-5 pb-10">
            <View className="flex-row items-center mb-4">
              <Text className="flex-1 text-ink font-bold text-lg">Uitnodigen</Text>
              <Pressable onPress={() => setInviteOpen(false)} hitSlop={8}>
                <Ionicons name="close" color="#8A7E6C" size={22} />
              </Pressable>
            </View>

            {friends.length === 0 ? (
              <Text className="text-ink-muted text-sm py-4 text-center">
                Alle vrienden zijn al uitgenodigd.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingVertical: 8 }}>
                {friends.map((f) => {
                  const p = f.other;
                  const selected = selectedIds.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedIds((prev) =>
                        selected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )}
                      className="items-center gap-1.5"
                      style={{ width: 60 }}
                    >
                      <View className={`rounded-full p-0.5 ${selected ? "bg-flame" : "bg-transparent"}`}>
                        <Avatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url ?? null} size="md" />
                      </View>
                      {selected && (
                        <View className="absolute top-0 right-0 w-4 h-4 bg-flame rounded-full items-center justify-center">
                          <Ionicons name="checkmark" color="#F5E8D3" size={10} />
                        </View>
                      )}
                      <Text className={`text-[11px] text-center ${selected ? "text-flame font-semibold" : "text-ink-muted"}`} numberOfLines={1}>
                        {p.display_name ?? p.username}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              onPress={sendInvites}
              disabled={selectedIds.length === 0 || inviting}
              className={`mt-4 rounded-full py-3.5 items-center ${selectedIds.length > 0 ? "bg-flame" : "bg-paper-soft"}`}
            >
              {inviting
                ? <ActivityIndicator size="small" color="#F5E8D3" />
                : <Text className={`font-semibold ${selectedIds.length > 0 ? "text-cream" : "text-ink-muted"}`}>
                    {selectedIds.length === 0 ? "Kies wie je uitnodigt" : `${selectedIds.length} uitnodigen`}
                  </Text>
              }
            </Pressable>
          </View>
        </View>
      </Modal>

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
