import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { carbon, feed, page } from "@/lib/design/type";
import type { Tone } from "@/components/Editorial";
import {
  QUICK_REACTIONS,
  groupPostReactions,
  listReactionsForPost,
  subscribeToPostReactions,
  togglePostReaction,
  type GroupedPostReaction,
} from "@/lib/api/post-reactions";
import { supabase } from "@/lib/supabase/client";

/**
 * Reactiepillen onder een vondst.
 *
 * `tone` bepaalt op welk vlak dit staat. De standaard blijft `page`
 * (inkt op gebroken wit) zodat `app/post/[id].tsx` en alle andere
 * aanroepers ongewijzigd blijven; de feed geeft `feed` of `post` mee.
 */
type Palette = {
  /** Tekst en rand van een pil die ík heb gezet. */
  strong: string;
  /** Tekst van een pil van iemand anders. */
  dim: string;
  /** Vulling van een niet-gekozen pil. */
  fill: string;
};

function paletteFor(tone: Tone): Palette {
  switch (tone) {
    case "feed":
      return { strong: feed.ink, dim: feed.inkDim, fill: "rgba(11,10,12,0.08)" };
    case "post":
      return { strong: feed.text, dim: feed.textDim, fill: "rgba(243,237,228,0.10)" };
    case "dark":
      return { strong: page.DEFAULT, dim: "#8E8C86", fill: "rgba(242,241,238,0.10)" };
    default:
      return { strong: carbon.DEFAULT, dim: carbon.muted, fill: "#E9E8E4" };
  }
}

export function PostReactions({
  postId,
  tone = "page",
}: {
  postId: string;
  tone?: Tone;
}) {
  const c = paletteFor(tone);
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
            style={{
              borderWidth: 1,
              borderColor: g.mine ? c.strong : c.fill,
              backgroundColor: g.mine ? "transparent" : c.fill,
            }}
            className="flex-row items-center gap-1 px-2.5 py-1"
          >
            <Text style={{ fontSize: 13 }}>{g.emoji}</Text>
            <Text
              style={{ fontSize: 12, fontWeight: "600", color: g.mine ? c.strong : c.dim }}
            >
              {g.count}
            </Text>
          </Pressable>
        ))}

        {/* Add reaction button */}
        <Pressable
          onPress={() => setPickerOpen((prev) => !prev)}
          style={{ borderWidth: 1, borderColor: c.fill, backgroundColor: c.fill }}
          className="flex-row items-center gap-1 px-2.5 py-1"
        >
          <Text style={{ fontSize: 13 }}>😊</Text>
          <Text style={{ fontSize: 12, fontWeight: "600", color: c.dim }}>+</Text>
        </Pressable>
      </View>

      {/* Emoji picker */}
      {pickerOpen && (
        <View
          style={{ backgroundColor: c.fill }}
          className="flex-row flex-wrap gap-2 mt-2 px-3 py-2"
        >
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
