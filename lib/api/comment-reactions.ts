import { supabase } from "../supabase/client";

/**
 * Emoji onder een comment (0059, HANDOFF 2.1 §Comment reactions).
 *
 * Dezelfde vorm als `post-reactions.ts`: één rij per (comment, gebruiker,
 * emoji). Lezen faalt stil — zolang de migratie ergens nog niet draaide,
 * staan er gewoon geen chips onder een comment in plaats van een fout.
 */

/** De zes van de kiezer, in de volgorde van het prototype. */
export const COMMENT_REACTIONS = ["❤️", "😂", "🔥", "😮", "👏", "🥹"];

export type CommentReactionRow = {
  comment_id: string;
  user_id: string;
  emoji: string;
};

export async function listReactionsForComments(commentIds: string[]): Promise<CommentReactionRow[]> {
  if (commentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("comment_reactions")
    .select("comment_id, user_id, emoji")
    .in("comment_id", commentIds);
  if (error) return [];
  return (data ?? []) as CommentReactionRow[];
}

export async function toggleCommentReaction(args: {
  commentId: string;
  userId: string;
  emoji: string;
  /** Wat de kaart al wist: stond deze emoji van mij er al? */
  on: boolean;
}): Promise<void> {
  if (args.on) {
    const { error } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("comment_id", args.commentId)
      .eq("user_id", args.userId)
      .eq("emoji", args.emoji);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("comment_reactions")
    .insert({ comment_id: args.commentId, user_id: args.userId, emoji: args.emoji });
  if (error) throw error;
}
