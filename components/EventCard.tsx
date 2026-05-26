import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "./Avatar";
import { eventStatusLabel, type EventWithMeta } from "@/lib/api/events";

/**
 * Een event-kaart in onze paper-cream stijl. Wordt gebruikt in:
 *  - Events tab (lijst van events)
 *  - Feed (mixed tussen post-kaarten)
 *
 * Toont status (Komt eraan / X over / Afgelopen / Onthulling over X) en
 * basis-stats. Tap → /event/{id}.
 */
export function EventCard({
  event,
  compact = false,
}: {
  event: EventWithMeta;
  compact?: boolean;
}) {
  const router = useRouter();
  const status = eventStatusLabel(event);
  const start = new Date(event.starts_at);
  const dateLabel = start.toLocaleDateString("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = start.toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      className="bg-paper rounded-3xl overflow-hidden"
    >
      <View className="px-5 pt-5">
        <View className="flex-row items-center mb-3">
          <View className="w-9 h-9 rounded-full bg-flame items-center justify-center mr-3">
            <Ionicons name="sparkles" color="#F5E8D3" size={16} />
          </View>
          <Text className="text-xs uppercase tracking-wider text-ink-muted flex-1">
            Event
          </Text>
          <View className={`rounded-full px-2.5 py-0.5 ${
            event.is_active ? "bg-ink" : "bg-paper-warm"
          }`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${
              event.is_active ? "text-cream" : "text-ink"
            }`}>
              {event.is_active ? "Live" : status.split(" ")[0]}
            </Text>
          </View>
        </View>

        <Text className="text-3xl font-bold tracking-tight text-ink mb-1" numberOfLines={2}>
          {event.name}
        </Text>

        {!compact && event.description && (
          <Text className="text-ink-soft text-sm leading-5 mb-3" numberOfLines={2}>
            {event.description}
          </Text>
        )}

        <View className="flex-row items-center gap-4 mt-2">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" color="#5A4F40" size={14} />
            <Text className="text-ink-soft text-xs ml-1.5">{status}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="people-outline" color="#5A4F40" size={14} />
            <Text className="text-ink-soft text-xs ml-1.5">
              {event.members_count} {event.members_count === 1 ? "gast" : "gasten"}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="images-outline" color="#5A4F40" size={14} />
            <Text className="text-ink-soft text-xs ml-1.5">
              {event.contributions_count}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-paper-soft mt-4 px-5 py-3 flex-row items-center">
        <View className="flex-1">
          <Text className="text-ink-muted text-[10px] uppercase tracking-wider">
            {dateLabel}
          </Text>
          <Text className="text-ink font-semibold text-sm">{timeLabel}</Text>
        </View>
        {event.is_host && (
          <View className="bg-paper-warm rounded-full px-2.5 py-0.5 mr-2">
            <Text className="text-ink text-[10px] font-bold uppercase tracking-wider">
              Host
            </Text>
          </View>
        )}
        <View className="bg-ink rounded-full px-4 py-2 flex-row items-center">
          <Text className="text-cream text-xs font-semibold mr-1">
            {event.is_active ? "Open" : event.is_revealed ? "Bekijk" : "Open"}
          </Text>
          <Ionicons name="arrow-forward" color="#F5E8D3" size={12} />
        </View>
      </View>
    </Pressable>
  );
}
