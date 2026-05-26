import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

export type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type CommentWithAuthor = CommentRow & {
  author: Profile | null;
};

export async function listPostComments(
  postId: string
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, user_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const authors = await getProfiles(authorIds);
  const byId = new Map(authors.map((a) => [a.id, a]));
  return rows.map((r) => ({ ...r, author: byId.get(r.user_id) ?? null }));
}

export async function createComment(args: {
  postId: string;
  userId: string;
  body: string;
}): Promise<CommentRow> {
  const trimmed = args.body.trim();
  if (!trimmed) throw new Error("Lege reactie.");
  if (trimmed.length > 500) throw new Error("Maximaal 500 tekens.");
  const { data, error } = await supabase
    .from("comments")
    .insert({
      post_id: args.postId,
      user_id: args.userId,
      body: trimmed,
    })
    .select("id, post_id, user_id, body, created_at")
    .single();
  if (error) throw error;
  return data as CommentRow;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) throw error;
}

/** Subscribe to new comments on a post. */
export function subscribeToPostComments(
  postId: string,
  onComment: (c: CommentWithAuthor) => void
): RealtimeChannel {
  return supabase
    .channel(`post-comments:${postId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "comments",
        filter: `post_id=eq.${postId}`,
      },
      async (payload) => {
        const row = payload.new as CommentRow;
        const authors = await getProfiles([row.user_id]);
        onComment({ ...row, author: authors[0] ?? null });
      }
    )
    .subscribe();
}
