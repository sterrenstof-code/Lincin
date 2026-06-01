import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import type { SharedListWithDetails } from "@/lib/api/shared-lists";

export function SharedListCard({ list }: { list: SharedListWithDetails }) {
  const router = useRouter();
  const done = list.checked_count;
  const total = list.item_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const preview = list.items.slice(0, 3);

  return (
    <Pressable
      onPress={() => router.push(`/list/${list.id}`)}
      className="bg-paper-soft rounded-2xl p-3 active:bg-paper"
    >
      {/* Header */}
      <View className="flex-row items-center gap-2 mb-3">
        <Avatar
          name={list.author?.display_name ?? list.author?.username}
          avatarUrl={list.author?.avatar_url ?? null}
          size="sm"
        />
        <View className="flex-1">
          <Text className="text-ink font-semibold text-sm">
            {list.author?.display_name ?? list.author?.username ?? "Onbekend"}
          </Text>
          <Text className="text-ink-muted text-xs">{formatRelativeTime(list.created_at)}</Text>
        </View>
        <View className="bg-paper rounded-full px-2.5 py-1 flex-row items-center gap-1">
          <Ionicons name="checkmark-circle-outline" color="#5A4F40" size={12} />
          <Text className="text-ink-muted text-xs font-semibold">Lijst</Text>
        </View>
      </View>

      {/* Title */}
      <View className="flex-row items-center gap-2 mb-3">
        <Text style={{ fontSize: 20 }}>{list.emoji}</Text>
        <Text className="text-ink text-base font-semibold flex-1">{list.title}</Text>
      </View>

      {/* Preview items */}
      {preview.length > 0 && (
        <View className="gap-1.5 mb-3">
          {preview.map((item) => (
            <View key={item.id} className="flex-row items-center gap-2">
              <View className={`w-4 h-4 rounded-full border items-center justify-center ${item.checked ? "bg-teal-500 border-teal-500" : "border-ink-muted"}`}>
                {item.checked && <Ionicons name="checkmark" color="#fff" size={10} />}
              </View>
              <Text className={`text-sm flex-1 ${item.checked ? "text-ink-muted line-through" : "text-ink"}`} numberOfLines={1}>
                {item.text}
              </Text>
            </View>
          ))}
          {total > 3 && (
            <Text className="text-ink-muted text-xs ml-6">
              +{total - 3} meer…
            </Text>
          )}
        </View>
      )}

      {/* Progress bar */}
      {total > 0 && (
        <View className="h-1.5 bg-paper rounded-full overflow-hidden mb-3">
          <View
            className="h-full bg-teal-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </View>
      )}

      {/* Footer: members + count */}
      <View className="flex-row items-center gap-2">
        <View className="flex-row items-center flex-1">
          {[list.author, ...list.members].filter(Boolean).slice(0, 5).map((p, i) => (
            <View key={p!.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i }}>
              <Avatar name={p!.display_name ?? p!.username} avatarUrl={p!.avatar_url ?? null} size="xs" />
            </View>
          ))}
        </View>
        <Text className="text-ink-muted text-xs">
          {done}/{total} gedaan
        </Text>
        <Ionicons name="chevron-forward" color="#8A7E6C" size={14} />
      </View>
    </Pressable>
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
  return days < 7 ? `${days}d` : new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
