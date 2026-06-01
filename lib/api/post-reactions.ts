import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

export const QUICK_REACTIONS = ["❤️", "👍", "😂", "🔥", "😮", "🎉", "😢"];

export type PostReactionRow = {
  post_id: string;
  user_id: string;
  emoji: string;
};

export type GroupedPostReaction = {
  emoji: string;
  count: number;
  userIds: string[];
  mine: boolean;
};

export async function listReactionsForPost(postId: string): Promise<PostReactionRow[]> {
  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, user_id, emoji")
    .eq("post_id", postId);
  if (error) throw error;
  return (data ?? []) as PostReactionRow[];
}

export async function listReactionsForPosts(postIds: string[]): Promise<PostReactionRow[]> {
  if (postIds.length === 0) return [];
  const { data, error } = await supabase
    .from("post_reactions")
    .select("post_id, user_id, emoji")
    .in("post_id", postIds);
  if (error) throw error;
  return (data ?? []) as PostReactionRow[];
}

export async function togglePostReaction(args: {
  postId: string;
  userId: string;
  emoji: string;
}): Promise<"added" | "removed"> {
  // Check if already reacted with this emoji
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", args.postId)
    .eq("user_id", args.userId)
    .eq("emoji", args.emoji)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", args.postId)
      .eq("user_id", args.userId)
      .eq("emoji", args.emoji);
    return "removed";
  } else {
    await supabase.from("post_reactions").insert({
      post_id: args.postId,
      user_id: args.userId,
      emoji: args.emoji,
    });
    return "added";
  }
}

export function groupPostReactions(
  rows: PostReactionRow[],
  myUserId: string
): GroupedPostReaction[] {
  const byEmoji = new Map<string, GroupedPostReaction>();
  for (const r of rows) {
    const g = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [], mine: false };
    g.count++;
    g.userIds.push(r.user_id);
    if (r.user_id === myUserId) g.mine = true;
    byEmoji.set(r.emoji, g);
  }
  return Array.from(byEmoji.values()).sort((a, b) => b.count - a.count);
}

export function subscribeToPostReactions(
  postId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`post-reactions:${postId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions", filter: `post_id=eq.${postId}` }, onChange)
    .subscribe();
}
