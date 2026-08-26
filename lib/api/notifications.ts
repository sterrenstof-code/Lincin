import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { uniqueTopic } from "@/lib/supabase/channel";

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  type:
    | "comment_on_post"
    | "comment_on_thread"
    | "vote_on_poll"
    | "vote_on_call"
    | "invited_to_list"
    | "invited_to_call"
    | "event_join"
    | "event_join_request"
    | "event_join_approved"
    | "event_contribution"
    // 0044 — wat je met een vondst kunt doen zonder te typen
    | "post_boost"
    | "mention"
    | "followed_post_comment"
    // 0048 — de kring rond een vondst. Elk paar is "op de jouwe" en
    // "op een waar jij ook in zit"; die twee lezen anders en horen dus
    // niet dezelfde soort te zijn.
    | "friend_post"
    | "thread_boost"
    | "post_reaction"
    | "thread_reaction"
    // 0049 — je bugmelding is afgehandeld
    | "bug_resolved";
  post_id: string | null;
  comment_id: string | null;
  /** 0048 — de reactie zelf, zodat het fragment in de melding kan staan. */
  entity_comment_id: string | null;
  event_id: string | null;
  /** 0048 — soort-specifiek detail. Nu: de emoji bij een reactie. */
  detail: string | null;
  /** 0049 — de bugmelding waar dit over gaat. */
  bug_report_id: string | null;
  read: boolean;
  created_at: string;
};

export type NotificationWithDetails = NotificationRow & {
  actor: Profile | null;
  post_caption: string | null;
  post_image_path: string | null;
  /** Titel van de bron — bij een link of fragment zegt die meer dan de caption. */
  post_source_title: string | null;
  comment_body: string | null;
  event_name: string | null;
};

export async function listNotifications(
  userId: string,
  limit = 40
): Promise<NotificationWithDetails[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, user_id, actor_id, type, post_id, comment_id, entity_comment_id, event_id, detail, bug_report_id, read, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const rows = data as NotificationRow[];

  // Load actor profiles
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id)));
  const actors = await getProfiles(actorIds);
  const actorMap = Object.fromEntries(actors.map((a) => [a.id, a]));

  // Load post info (caption + image) for posts we reference
  const postIds = Array.from(new Set(rows.map((r) => r.post_id).filter(Boolean))) as string[];
  let postMap: Record<
    string,
    { caption: string | null; image_path: string | null; source_title: string | null }
  > = {};
  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from("posts")
      .select("id, caption, image_path, source_title")
      .in("id", postIds);
    for (const p of posts ?? []) {
      postMap[p.id] = {
        caption: p.caption,
        image_path: p.image_path,
        source_title: (p as any).source_title ?? null,
      };
    }
  }

  // Load comment bodies so emoji-only comments show in the snippet.
  //
  // Twee tabellen: `comments` is de oude, `entity_comments` de huidige.
  // Meldingen van vóór 0048 wijzen naar de eerste, alles daarna naar de
  // tweede. Beide ophalen en in dezelfde map gooien houdt de oude rijen
  // leesbaar zonder ze te hoeven verhuizen.
  const commentIds = Array.from(new Set(rows.map((r) => r.comment_id).filter(Boolean))) as string[];
  const entityCommentIds = Array.from(
    new Set(rows.map((r) => r.entity_comment_id).filter(Boolean))
  ) as string[];
  let commentMap: Record<string, { body: string }> = {};
  if (commentIds.length > 0) {
    const { data: comments } = await supabase
      .from("comments")
      .select("id, body")
      .in("id", commentIds);
    for (const c of comments ?? []) {
      commentMap[c.id] = { body: c.body };
    }
  }
  if (entityCommentIds.length > 0) {
    const { data: comments } = await supabase
      .from("entity_comments")
      .select("id, body")
      .in("id", entityCommentIds);
    for (const c of comments ?? []) {
      commentMap[c.id] = { body: c.body };
    }
  }

  // Load event names for event notifications
  const eventIds = Array.from(new Set(rows.map((r) => r.event_id).filter(Boolean))) as string[];
  let eventMap: Record<string, { name: string }> = {};
  if (eventIds.length > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, name")
      .in("id", eventIds);
    for (const e of events ?? []) {
      eventMap[e.id] = { name: e.name };
    }
  }

  return rows.map((r) => ({
    ...r,
    actor: actorMap[r.actor_id] ?? null,
    post_caption: r.post_id ? (postMap[r.post_id]?.caption ?? null) : null,
    post_image_path: r.post_id ? (postMap[r.post_id]?.image_path ?? null) : null,
    post_source_title: r.post_id ? (postMap[r.post_id]?.source_title ?? null) : null,
    comment_body:
      (r.entity_comment_id ? commentMap[r.entity_comment_id]?.body : null) ??
      (r.comment_id ? commentMap[r.comment_id]?.body : null) ??
      null,
    event_name: r.event_id ? (eventMap[r.event_id]?.name ?? null) : null,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
}

/** Fire-and-forget: create a notification (does not throw). */
export async function createNotification(args: {
  userId: string;       // recipient
  actorId: string;      // who did the action
  type: NotificationRow["type"];
  postId?: string | null;
  commentId?: string | null;
  eventId?: string | null;
}): Promise<void> {
  if (args.userId === args.actorId) return; // nooit aan jezelf
  const { error } = await supabase.from("notifications").insert({
    user_id: args.userId,
    actor_id: args.actorId,
    type: args.type,
    post_id: args.postId ?? null,
    comment_id: args.commentId ?? null,
    event_id: args.eventId ?? null,
  });
  if (error) console.warn("createNotification error", error.message);
}

export function subscribeToNotifications(
  userId: string,
  onNew: () => void
): RealtimeChannel {
  return supabase
    .channel(uniqueTopic(`notifications:${userId}`))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => onNew()
    )
    .subscribe();
}
