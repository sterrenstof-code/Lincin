import { supabase } from "../supabase/client";

/**
 * Wat je met een vondst kunt doen zonder te typen.
 *
 *   OMHOOG DUWEN  je vindt dit het bekijken waard. De feed gebruikt het
 *                 om te bepalen waar over gepraat wordt.
 *   VOLGEN        je wilt op de hoogte blijven van wat er nog komt: elke
 *                 nieuwe reactie belandt in je meldingen, ook als je zelf
 *                 niets zegt.
 *
 * Beide zijn één rij per persoon per vondst; de primaire sleutel in
 * 0044_bio_follows_boosts houdt dat vast, dus dubbel duwen kan niet.
 */

export type PostSignals = {
  boosts: number;
  boosted: boolean;
  following: boolean;
  /** Wie de vondst omhoog duwden — voor "jij en 3 anderen". */
  boosterIds: string[];
};

export async function getPostSignals(postId: string, myUserId: string | undefined): Promise<PostSignals> {
  const [boosts, follows] = await Promise.all([
    supabase.from("post_boosts").select("user_id").eq("post_id", postId),
    myUserId
      ? supabase.from("post_follows").select("user_id").eq("post_id", postId).eq("user_id", myUserId)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const boosterIds = (boosts.data ?? []).map((r) => r.user_id);
  return {
    boosts: boosterIds.length,
    boosted: !!myUserId && boosterIds.includes(myUserId),
    following: ((follows as any).data ?? []).length > 0,
    boosterIds,
  };
}

/** Aantal duwen voor een reeks vondsten — voor de feed. */
export async function countBoostsForPosts(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;
  const { data } = await supabase.from("post_boosts").select("post_id").in("post_id", postIds);
  for (const row of data ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Duwen of de duw terugnemen.
 *
 * De meldingen komen van de database (trigger `post_boosts_notify_audience`,
 * 0048): de eigenaar hoort het, en iedereen die al iets met de vondst deed
 * ook. `ownerId` wordt niet meer gebruikt maar blijft in de signatuur staan
 * zodat de aanroepers ongemoeid blijven.
 */
export async function togglePostBoost(args: {
  postId: string;
  userId: string;
  /** @deprecated De database bepaalt zelf wie een melding krijgt (0048). */
  ownerId?: string | null;
  boosted: boolean;
}): Promise<void> {
  if (args.boosted) {
    const { error } = await supabase
      .from("post_boosts")
      .delete()
      .eq("post_id", args.postId)
      .eq("user_id", args.userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("post_boosts")
    .insert({ post_id: args.postId, user_id: args.userId });
  if (error) throw error;
}

export async function togglePostFollow(args: {
  postId: string;
  userId: string;
  following: boolean;
}): Promise<void> {
  if (args.following) {
    const { error } = await supabase
      .from("post_follows")
      .delete()
      .eq("post_id", args.postId)
      .eq("user_id", args.userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("post_follows")
    .insert({ post_id: args.postId, user_id: args.userId });
  if (error) throw error;
}

/** Wie deze vondst volgen — gebruikt om meldingen te sturen. */
export async function listPostFollowers(postId: string): Promise<string[]> {
  const { data } = await supabase.from("post_follows").select("user_id").eq("post_id", postId);
  return (data ?? []).map((r) => r.user_id);
}
