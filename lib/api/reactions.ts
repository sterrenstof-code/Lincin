import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";
import { uniqueTopic } from "@/lib/supabase/channel";

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

/**
 * Subscribe to reaction inserts/deletes in chats I can see.
 *
 * `message_reactions` heeft geen `chat_id`, dus filteren op het gesprek kan
 * de server niet; en een filter op bericht-ids (`message_id=in.(…)`) zou
 * bij elk nieuw bericht een nieuw abonnement vragen. Daarom geven we het
 * bericht-id door en laat de aanroeper alles negeren wat niet in beeld
 * staat — eerder haalde élke reactie, in welk gesprek ook, de reacties van
 * het open gesprek opnieuw op. Bij een DELETE draagt de oude rij onder RLS
 * alleen de primaire sleutel, en daar zit `message_id` in.
 *
 * Eigen kanaalnaam per abonnee — zie `lib/supabase/channel.ts`.
 */
export function subscribeToReactions(
  chatId: string,
  onChange: (messageId: string | null) => void
): RealtimeChannel {
  return supabase
    .channel(uniqueTopic(`reactions:${chatId}`))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions" },
      (payload) => {
        const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as
          | { message_id?: string }
          | undefined;
        onChange(row?.message_id ?? null);
      }
    )
    .subscribe();
}
