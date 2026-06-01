import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  QUICK_REACTIONS,
  groupPostReactions,
  listReactionsForPost,
  subscribeToPostReactions,
  togglePostReaction,
  type GroupedPostReaction,
} from "@/lib/api/post-reactions";
import { supabase } from "@/lib/supabase/client";

export function PostReactions({ postId }: { postId: string }) {
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<GroupedPostReaction[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listReactionsForPost(postId).then((rows) => {
      if (!cancelled) setGrouped(groupPostReactions(rows, myUserId ?? ""));
    });
    const channel = subscribeToPostReactions(postId, () => {
      listReactionsForPost(postId).then((rows) => {
        if (!cancelled) setGrouped(groupPostReactions(rows, myUserId ?? ""));
      });
    });
    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [postId, myUserId]);

  async function handleReaction(emoji: string) {
    if (!myUserId) return;
    setPickerOpen(false);
    // Optimistic update
    setGrouped((prev) => {
      const existing = prev.find((g) => g.emoji === emoji);
      if (existing) {
        if (existing.mine) {
          // remove
          const updated = { ...existing, count: existing.count - 1, mine: false, userIds: existing.userIds.filter((id) => id !== myUserId) };
          return updated.count === 0
            ? prev.filter((g) => g.emoji !== emoji)
            : prev.map((g) => g.emoji === emoji ? updated : g);
        } else {
          return prev.map((g) => g.emoji === emoji ? { ...g, count: g.count + 1, mine: true, userIds: [...g.userIds, myUserId] } : g);
        }
      }
      return [...prev, { emoji, count: 1, mine: true, userIds: [myUserId] }];
    });
    await togglePostReaction({ postId, userId: myUserId, emoji });
  }

  return (
    <View className="px-4 pb-3">
      <View className="flex-row flex-wrap items-center gap-1.5">
        {grouped.map((g) => (
          <Pressable
            key={g.emoji}
            onPress={() => handleReaction(g.emoji)}
            className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full border ${
              g.mine ? "bg-flame/10 border-flame/30" : "bg-paper border-paper"
            }`}
          >
            <Text style={{ fontSize: 13 }}>{g.emoji}</Text>
            <Text className={`text-xs font-semibold ${g.mine ? "text-flame" : "text-ink-muted"}`}>
              {g.count}
            </Text>
          </Pressable>
        ))}

        {/* Add reaction button */}
        <Pressable
          onPress={() => setPickerOpen((p) => !p)}
          className="flex-row items-center gap-1 px-2.5 py-1 rounded-full border border-paper bg-paper"
        >
          <Text style={{ fontSize: 13 }}>😊</Text>
          <Text className="text-ink-muted text-xs font-semibold">+</Text>
        </Pressable>
      </View>

      {/* Emoji picker */}
      {pickerOpen && (
        <View className="flex-row flex-wrap gap-2 mt-2 bg-paper rounded-2xl px-3 py-2">
          {QUICK_REACTIONS.map((emoji) => (
            <Pressable key={emoji} onPress={() => handleReaction(emoji)} className="p-1">
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
