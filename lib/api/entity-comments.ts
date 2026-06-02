import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createNotification } from "./notifications";

export type EntityType = "post" | "poll" | "call_plan" | "list";

export type EntityComment = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Profile | null;
};

export async function listEntityComments(
  entityType: EntityType,
  entityId: string
): Promise<EntityComment[]> {
  const { data, error } = await supabase
    .from("entity_comments")
    .select("id, entity_type, entity_id, user_id, body, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
  const profiles = await getProfiles(authorIds);
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  return rows.map((r: any) => ({ ...r, author: byId[r.user_id] ?? null }));
}

export async function countEntityComments(
  entityType: EntityType,
  entityId: string
): Promise<number> {
  const { count } = await supabase
    .from("entity_comments")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  return count ?? 0;
}

export async function addEntityComment(args: {
  entityType: EntityType;
  entityId: string;
  userId: string;
  body: string;
  /** Optioneel: user_id van de eigenaar van de entiteit, voor notificatie */
  ownerId?: string;
}): Promise<EntityComment> {
  const { data, error } = await supabase
    .from("entity_comments")
    .insert({
      entity_type: args.entityType,
      entity_id: args.entityId,
      user_id: args.userId,
      body: args.body.trim(),
    })
    .select("id, entity_type, entity_id, user_id, body, created_at")
    .single();
  if (error) throw error;

  // Notificeer de eigenaar (fire-and-forget)
  if (args.ownerId && args.ownerId !== args.userId) {
    createNotification({
      userId: args.ownerId,
      actorId: args.userId,
      type: "comment_on_post",
      postId: args.entityId,
    });
  }

  // Notificeer ook eerdere reageerders (fire-and-forget)
  supabase
    .from("entity_comments")
    .select("user_id")
    .eq("entity_type", args.entityType)
    .eq("entity_id", args.entityId)
    .neq("id", data.id)
    .then(({ data: prev }) => {
      const others = Array.from(
        new Set((prev ?? []).map((r: any) => r.user_id as string))
      ).filter((id) => id !== args.userId && id !== args.ownerId);
      for (const uid of others) {
        createNotification({
          userId: uid,
          actorId: args.userId,
          type: "comment_on_thread",
          postId: args.entityId,
        });
      }
    });

  const profiles = await getProfiles([args.userId]);
  return { ...data, author: profiles[0] ?? null } as EntityComment;
}

export async function deleteEntityComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from("entity_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw error;
}

export function subscribeToEntityComments(
  entityType: EntityType,
  entityId: string,
  onNew: (comment: EntityComment) => void
): RealtimeChannel {
  return supabase
    .channel(`entity-comments:${entityType}:${entityId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "entity_comments",
        filter: `entity_id=eq.${entityId}`,
      },
      async (payload) => {
        const row = payload.new as any;
        const profiles = await getProfiles([row.user_id]);
        onNew({ ...row, author: profiles[0] ?? null });
      }
    )
    .subscribe();
}
