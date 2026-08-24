import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import {
  getProfiles,
  getProfilesByUsernames,
  mentionedUsernames,
  type Profile,
} from "./profiles";
import { createNotification } from "./notifications";
import { uniqueTopic } from "@/lib/supabase/channel";
import { IMG, signedImageUrl, signedImageUrls } from "../media";
import { uriToBytes } from "../crypto/file";

export type EntityType = "post" | "poll" | "call_plan" | "list";

/**
 * Beeld bij een reactie ligt in dezelfde bucket als de foto's van een
 * vondst. Die heeft al de regel die we nodig hebben — je eigen map is van
 * jou, vrienden mogen kijken — en één bucket met één regel is beter dan
 * twee die uit elkaar kunnen lopen.
 */
const COMMENT_BUCKET = "posts";

async function uploadCommentImage(userId: string, uri: string): Promise<string> {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  const ext = (match?.[1] ?? "jpg").toLowerCase();
  const safeExt = ["gif", "png", "webp", "jpeg", "jpg", "heic"].includes(ext) ? ext : "jpg";
  const type =
    safeExt === "gif" ? "image/gif"
    : safeExt === "png" ? "image/png"
    : safeExt === "webp" ? "image/webp"
    : safeExt === "heic" ? "image/heic"
    : "image/jpeg";

  const unique =
    typeof (globalThis.crypto as any)?.randomUUID === "function"
      ? (globalThis.crypto as any).randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const path = `${userId}/comment-${unique}.${safeExt}`;
  const bytes = await uriToBytes(uri);
  const blob = new Blob([bytes as any], { type });
  const { error } = await supabase.storage
    .from(COMMENT_BUCKET)
    .upload(path, blob, { contentType: type, upsert: false });
  if (error) throw error;
  return path;
}

export type EntityComment = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: Profile | null;
  /** Pad van een gif of meme bij deze reactie. */
  image_path: string | null;
  /** Ondertekende URL bij `image_path`. */
  image_url: string | null;
};

export async function listEntityComments(
  entityType: EntityType,
  entityId: string
): Promise<EntityComment[]> {
  const { data, error } = await supabase
    .from("entity_comments")
    .select("id, entity_type, entity_id, user_id, body, created_at, image_path")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
  const profiles = await getProfiles(authorIds);
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const urls = await signedImageUrls(
    COMMENT_BUCKET,
    rows.map((r: any) => r.image_path),
    IMG.tile
  );

  return rows.map((r: any) => ({
    ...r,
    author: byId[r.user_id] ?? null,
    image_url: r.image_path ? urls.get(r.image_path) ?? null : null,
  }));
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
  /**
   * Een gif of een meme bij deze reactie. Wordt geüpload naar de eigen map
   * in de posts-bucket, waar vrienden hem mogen lezen — dezelfde regel als
   * voor de foto's van een vondst, dus geen tweede stel policies.
   */
  imageUri?: string | null;
}): Promise<EntityComment> {
  let imagePath: string | null = null;
  if (args.imageUri) {
    imagePath = await uploadCommentImage(args.userId, args.imageUri);
  }

  const { data, error } = await supabase
    .from("entity_comments")
    .insert({
      entity_type: args.entityType,
      entity_id: args.entityId,
      user_id: args.userId,
      body: args.body.trim(),
      image_path: imagePath,
    })
    .select("id, entity_type, entity_id, user_id, body, created_at, image_path")
    .single();
  if (error) {
    if (imagePath) {
      await supabase.storage.from(COMMENT_BUCKET).remove([imagePath]).catch(() => {});
    }
    throw error;
  }

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

  // Genoemd worden is persoonlijker dan meelezen: wie in de tekst staat,
  // hoort het te weten. Fire-and-forget, net als de rest hierboven.
  const handles = mentionedUsernames(args.body);
  if (handles.length > 0) {
    getProfilesByUsernames(handles).then((profiles) => {
      for (const prof of profiles) {
        createNotification({
          userId: prof.id,
          actorId: args.userId,
          type: "mention",
          postId: args.entityType === "post" ? args.entityId : null,
        });
      }
    });
  }

  /**
   * Volgers krijgen hun melding niet meer van hier maar van de database
   * (trigger `entity_comments_notify_followers`, 0047).
   *
   * Vanaf hier werkte het alleen als de reactie via dít pad binnenkwam en
   * de gebruiker bleef staan tot het verzoek klaar was — en geen van beide
   * is gegarandeerd: reacties komen ook van de lijst onder een stemming of
   * een gedeelde lijst, en wie meteen wegklikt annuleert wat nog onderweg
   * was. Een melding die soms wel en soms niet komt is erger dan geen
   * melding. Nu gebeurt het in dezelfde transactie als de reactie zelf.
   */

  const profiles = await getProfiles([args.userId]);
  return {
    ...data,
    author: profiles[0] ?? null,
    image_url: imagePath ? await signedImageUrl(COMMENT_BUCKET, imagePath, IMG.tile) : null,
  } as EntityComment;
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
    .channel(uniqueTopic(`entity-comments:${entityType}:${entityId}`))
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
