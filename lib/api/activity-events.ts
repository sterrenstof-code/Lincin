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
  await supabase.from("activity_events").insert({
    actor_id: args.actorId,
    kind: args.kind,
    post_id: args.postId ?? null,
    event_id: args.eventId ?? null,
    friend_id: args.friendId ?? null,
  });
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
