import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";

export type ReactionRow = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type GroupedReaction = {
  emoji: string;
  count: number;
  userIds: string[];
  mine: boolean;
};

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

export async function listReactionsForMessages(
  messageIds: string[]
): Promise<ReactionRow[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id, user_id, emoji, created_at")
    .in("message_id", messageIds);
  if (error) throw error;
  return (data ?? []) as ReactionRow[];
}

export async function addReaction(args: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  const { error } = await supabase.from("message_reactions").upsert(
    {
      message_id: args.messageId,
      user_id: args.userId,
      emoji: args.emoji,
    },
    { onConflict: "message_id,user_id,emoji" }
  );
  if (error) throw error;
}

export async function removeReaction(args: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<void> {
  const { error } = await supabase
    .from("message_reactions")
    .delete()
    .eq("message_id", args.messageId)
    .eq("user_id", args.userId)
    .eq("emoji", args.emoji);
  if (error) throw error;
}

export function groupReactions(
  rows: ReactionRow[],
  myUserId: string
): GroupedReaction[] {
  const byEmoji = new Map<string, GroupedReaction>();
  for (const r of rows) {
    const g = byEmoji.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      userIds: [],
      mine: false,
    };
    g.count++;
    g.userIds.push(r.user_id);
    if (r.user_id === myUserId) g.mine = true;
    byEmoji.set(r.emoji, g);
  }
  return Array.from(byEmoji.values()).sort((a, b) => b.count - a.count);
}

/** Subscribe to reaction inserts/deletes for a list of message IDs. */
export function subscribeToReactions(
  chatId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`reactions:${chatId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions" },
      () => onChange()
    )
    .subscribe();
}
