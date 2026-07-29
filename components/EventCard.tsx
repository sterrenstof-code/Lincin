import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

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
      className="bg-page-alt overflow-hidden"
    >
      {event.cover_url && !compact && (
        <Image
          source={{ uri: event.cover_url }}
          style={{ width: "100%", height: 130 }}
          contentFit="cover"
          transition={150}
        />
      )}
      <View className="px-5 pt-5">
        <View className="flex-row items-center mb-3">
          <View className="w-9 h-9 bg-carbon items-center justify-center mr-3">
            <Ionicons name="sparkles" color="#F2F1EE" size={16} />
          </View>
          <Text className="text-xs uppercase tracking-wider text-carbon-muted flex-1">
            Event
          </Text>
          <View className={`px-2.5 py-0.5 ${
            event.is_active ? "bg-carbon" : "bg-page-alt"
          }`}>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${
              event.is_active ? "text-page" : "text-carbon"
            }`}>
              {event.is_active ? "Live" : status.split(" ")[0]}
            </Text>
          </View>
        </View>

        <Text className="text-3xl font-bold tracking-tight text-carbon mb-1" numberOfLines={2}>
          {event.name}
        </Text>

        {!compact && event.description && (
          <Text className="text-carbon-soft text-sm leading-5 mb-3" numberOfLines={2}>
            {event.description}
          </Text>
        )}

        <View className="flex-row items-center gap-4 mt-2">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" color="#55534E" size={14} />
            <Text className="text-carbon-soft text-xs ml-1.5">{status}</Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="people-outline" color="#55534E" size={14} />
            <Text className="text-carbon-soft text-xs ml-1.5">
              {event.members_count} {event.members_count === 1 ? "gast" : "gasten"}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="images-outline" color="#55534E" size={14} />
            <Text className="text-carbon-soft text-xs ml-1.5">
              {event.contributions_count}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-page-alt mt-4 px-5 py-3 flex-row items-center">
        <View className="flex-1">
          <Text className="text-carbon-muted text-[10px] uppercase tracking-wider">
            {dateLabel}
          </Text>
          <Text className="text-carbon font-semibold text-sm">{timeLabel}</Text>
        </View>
        {event.is_host && (
          <View className="bg-page-alt px-2.5 py-0.5 mr-2">
            <Text className="text-carbon text-[10px] font-bold uppercase tracking-wider">
              Host
            </Text>
          </View>
        )}
        <View className="bg-carbon px-4 py-2 flex-row items-center">
          <Text className="text-page text-xs font-semibold mr-1">
            {event.is_active ? "Open" : event.is_revealed ? "Bekijk" : "Open"}
          </Text>
          <Ionicons name="arrow-forward" color="#F2F1EE" size={12} />
        </View>
      </View>
    </Pressable>
  );
}
