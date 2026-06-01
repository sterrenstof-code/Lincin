import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import type { ActivityEventWithActor } from "@/lib/api/activity-events";

const KIND_ICON: Record<string, { name: any; color: string }> = {
  friend_accepted: { name: "person-add-outline", color: "#5B8DEF" },
  post_created:    { name: "image-outline",       color: "#D46220" },
  event_created:   { name: "calendar-outline",    color: "#2CA87F" },
  event_joined:    { name: "enter-outline",       color: "#2CA87F" },
};

function activityLabel(event: ActivityEventWithActor): string {
  const name = event.actor?.display_name ?? event.actor?.username ?? "Iemand";
  switch (event.kind) {
    case "friend_accepted": {
      const friend = event.friend_profile?.display_name ?? event.friend_profile?.username ?? "iemand";
      return `${name} en ${friend} zijn nu vrienden`;
    }
    case "post_created":
      return `${name} heeft een foto geplaatst`;
    case "event_created":
      return `${name} heeft een event aangemaakt`;
    case "event_joined":
      return `${name} doet mee aan een event`;
    default:
      return `${name} heeft iets gedaan`;
  }
}

export function ActivityCard({ event }: { event: ActivityEventWithActor }) {
  const router = useRouter();
  const icon = KIND_ICON[event.kind] ?? { name: "flash-outline", color: "#8A7E6C" };

  function handlePress() {
    if (event.kind === "post_created" && event.post_id) {
      router.push(`/post/${event.post_id}` as any);
    } else if ((event.kind === "event_created" || event.kind === "event_joined") && event.event_id) {
      router.push(`/event/${event.event_id}` as any);
    } else if (event.kind === "friend_accepted" && event.actor?.username) {
      router.push(`/user/${event.actor.username}` as any);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-3 px-4 py-3 bg-paper/50 rounded-2xl mb-2 active:bg-paper"
    >
      {/* Avatar */}
      <Avatar
        name={event.actor?.display_name ?? event.actor?.username}
        avatarUrl={event.actor?.avatar_url ?? null}
        size="sm"
      />
      {/* Tekst */}
      <Text className="flex-1 text-ink text-sm leading-snug">
        {activityLabel(event)}
      </Text>
      {/* Icoontje + tijd */}
      <View className="items-end gap-1">
        <Ionicons name={icon.name} size={16} color={icon.color} />
        <Text className="text-ink-muted text-[10px]">{formatRelativeTime(event.created_at)}</Text>
      </View>
    </Pressable>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d`
    : new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
