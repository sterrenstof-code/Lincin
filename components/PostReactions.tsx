import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { carbon, feed, FEED_BORDER, page } from "@/lib/design/type";
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
  /** Rand van elke pil, en de vulling van een pil die ík gezet heb. */
  strong: string;
  /** Tekst óp die vulling — moet het tegenovergestelde van `strong` zijn. */
  onStrong: string;
  /** Tekst van een pil van iemand anders. */
  dim: string;
  /** Rand van de plus-knop: dezelfde pil, maar zachter. */
  fill: string;
};

function paletteFor(tone: Tone): Palette {
  switch (tone) {
    case "feed":
      return {
        strong: feed.ink,
        onStrong: feed.text,
        dim: feed.inkDim,
        fill: "rgba(11,10,12,0.28)",
      };
    case "post":
      return {
        strong: feed.text,
        onStrong: feed.post,
        dim: feed.textDim,
        fill: "rgba(243,237,228,0.35)",
      };
    case "dark":
      return {
        strong: page.DEFAULT,
        onStrong: feed.ink,
        dim: feed.inkDim,
        fill: "rgba(242,241,238,0.35)",
      };
    default:
      return {
        strong: carbon.DEFAULT,
        onStrong: page.DEFAULT,
        dim: carbon.muted,
        fill: "rgba(11,10,12,0.28)",
      };
  }
}

export function PostReactions({
  postId,
  tone = "page",
  padded = true,
}: {
  postId: string;
  tone?: Tone;
  /**
   * Zet uit als de aanroeper de ruimte eromheen zelf bepaalt. Anders
   * telt de marge van deze component op bij die van het blok eromheen, en
   * dat zag je: de pillen stonden verder van hun eigen kop af dan van de
   * regel eronder.
   */
  padded?: boolean;
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
    <View className={padded ? "px-4 pb-3" : undefined}>
      <View className="flex-row flex-wrap items-center gap-1.5">
        {grouped.map((g) => (
          <Pressable
            key={g.emoji}
            onPress={() => handleReaction(g.emoji)}
            /**
             * Waar jij zelf op geklikt hebt, is omgekeerd: vol vlak met
             * lichte tekst, zoals de actieve tab in de kop.
             *
             * Het verschil was een randje: dezelfde vulling, alleen een
             * lijn eromheen. Dat zie je niet tussen drie pillen van twintig
             * pixels, en dan weet je niet meer of dat hartje van jou was of
             * dat je op het punt staat er nog een te zetten. Vol of leeg is
             * het enige verschil dat je uit een ooghoek nog leest.
             */
            style={{
              borderWidth: FEED_BORDER,
              borderColor: c.strong,
              backgroundColor: g.mine ? c.strong : "transparent",
            }}
            className="flex-row items-center gap-1 px-2.5 py-1"
          >
            <Text style={{ fontSize: 13 }}>{g.emoji}</Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: g.mine ? c.onStrong : c.strong,
              }}
            >
              {g.count}
            </Text>
          </Pressable>
        ))}

        {/* Add reaction button */}
        <Pressable
          onPress={() => setPickerOpen((prev) => !prev)}
          style={{
            borderWidth: FEED_BORDER,
            borderColor: c.fill,
            backgroundColor: "transparent",
          }}
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
