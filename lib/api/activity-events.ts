import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

export type ActivityKind =
  | "friend_accepted"
  | "post_created"
  | "event_created"
  | "event_joined";

export type ActivityEventRow = {
  id: string;
  actor_id: string;
  kind: ActivityKind;
  post_id: string | null;
  event_id: string | null;
  friend_id: string | null;
  created_at: string;
};

export type ActivityEventWithActor = ActivityEventRow & {
  actor: Profile | null;
  friend_profile: Profile | null;
};

export async function createActivityEvent(args: {
  actorId: string;
  kind: ActivityKind;
  postId?: string;
  eventId?: string;
  friendId?: string;
}): Promise<void> {
  await supabase.from("activity_events").upsert(
    {
      actor_id: args.actorId,
      kind: args.kind,
      post_id: args.postId ?? null,
      event_id: args.eventId ?? null,
      friend_id: args.friendId ?? null,
    },
    { ignoreDuplicates: true }
  );
  // Fire-and-forget — niet fatal als het mislukt
}

export async function listFeedActivityEvents(
  limit = 40
): Promise<ActivityEventWithActor[]> {
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, actor_id, kind, post_id, event_id, friend_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const rows = data as ActivityEventRow[];
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id)));
  const friendIds = Array.from(
    new Set(rows.map((r) => r.friend_id).filter((id): id is string => !!id))
  );
  const allIds = Array.from(new Set([...actorIds, ...friendIds]));
  const profiles = await getProfiles(allIds);
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    actor: byId.get(r.actor_id) ?? null,
    friend_profile: r.friend_id ? byId.get(r.friend_id) ?? null : null,
  }));
}

/**
 * Alles wat één persoon gedaan heeft, nieuwste eerst en per bladzijde.
 *
 * Gepagineerd en niet in één keer: wie de app een jaar gebruikt heeft,
 * heeft honderden regels, en die allemaal ophalen om er twintig te tonen
 * is werk waar niemand om vroeg. `hasMore` komt uit één rij extra ophalen
 * dan je toont — goedkoper dan een aparte telling.
 */
export async function listActivityByActor(
  actorId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ events: ActivityEventWithActor[]; hasMore: boolean }> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const { data, error } = await supabase
    .from("activity_events")
    .select("id, actor_id, kind, post_id, event_id, friend_id, created_at")
    .eq("actor_id", actorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit); // één extra: die verklapt of er meer is
  if (error) throw error;

  const all = (data ?? []) as ActivityEventRow[];
  const hasMore = all.length > limit;
  const rows = hasMore ? all.slice(0, limit) : all;
  if (rows.length === 0) return { events: [], hasMore: false };

  const friendIds = Array.from(
    new Set(rows.map((r) => r.friend_id).filter((id): id is string => !!id))
  );
  const profiles = await getProfiles(Array.from(new Set([actorId, ...friendIds])));
  const byId = new Map(profiles.map((prof) => [prof.id, prof]));

  return {
    events: rows.map((r) => ({
      ...r,
      actor: byId.get(r.actor_id) ?? null,
      friend_profile: r.friend_id ? byId.get(r.friend_id) ?? null : null,
    })),
    hasMore,
  };
}

/** Haal posts op van precies een jaar geleden (± 1 dag) voor "On this day". */
export async function listMemoryPosts(myUserId: string) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const from = new Date(oneYearAgo);
  from.setDate(from.getDate() - 1);
  const to = new Date(oneYearAgo);
  to.setDate(to.getDate() + 1);

  const { data, error } = await supabase
    .from("posts")
    .select("id, user_id, image_path, caption, link_url, created_at")
    .eq("user_id", myUserId)
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return [];
  return data ?? [];
}
