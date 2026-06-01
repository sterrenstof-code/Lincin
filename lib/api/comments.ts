import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createNotification } from "./notifications";

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
  const comment = data as CommentRow;

  // Fire-and-forget notifications (don't block the caller)
  fireCommentNotifications(comment).catch(() => {});

  return comment;
}

async function fireCommentNotifications(comment: CommentRow): Promise<void> {
  // 1. Get the post to find its owner
  const { data: post } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", comment.post_id)
    .single();

  // 2. Get all previous commenters on this post (excluding new commenter)
  const { data: prevComments } = await supabase
    .from("comments")
    .select("user_id")
    .eq("post_id", comment.post_id)
    .neq("id", comment.id);

  const prevCommenterIds = Array.from(
    new Set((prevComments ?? []).map((c: any) => c.user_id as string))
  ).filter((id) => id !== comment.user_id);

  const notifications: Promise<void>[] = [];

  // Notify post owner
  if (post && post.user_id !== comment.user_id) {
    notifications.push(
      createNotification({
        userId: post.user_id,
        actorId: comment.user_id,
        type: "comment_on_post",
        postId: comment.post_id,
        commentId: comment.id,
      })
    );
  }

  // Notify previous commenters (who are not the post owner — they already get notified above)
  for (const uid of prevCommenterIds) {
    if (uid === post?.user_id) continue; // already notified above
    notifications.push(
      createNotification({
        userId: uid,
        actorId: comment.user_id,
        type: "comment_on_thread",
        postId: comment.post_id,
        commentId: comment.id,
      })
    );
  }

  await Promise.allSettled(notifications);
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
