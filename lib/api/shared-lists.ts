import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

export type SharedListRow = {
  id: string;
  user_id: string;
  title: string;
  emoji: string;
  created_at: string;
};

export type ListItem = {
  id: string;
  list_id: string;
  user_id: string;
  text: string;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  position: number;
  created_at: string;
};

export type SharedListWithDetails = SharedListRow & {
  author: Profile | null;
  members: Profile[];
  items: ListItem[];
  item_count: number;
  checked_count: number;
};

export async function createSharedList(args: {
  userId: string;
  title: string;
  emoji?: string;
  memberIds?: string[];
}): Promise<SharedListRow> {
  const { data: list, error } = await supabase
    .from("shared_lists")
    .insert({ user_id: args.userId, title: args.title.trim(), emoji: args.emoji ?? "📋" })
    .select("id, user_id, title, emoji, created_at")
    .single();
  if (error) throw error;

  if (args.memberIds && args.memberIds.length > 0) {
    await supabase.from("list_members").insert(
      args.memberIds.map((uid) => ({ list_id: list.id, user_id: uid }))
    );
  }
  return list as SharedListRow;
}

export async function getSharedListWithDetails(
  listId: string
): Promise<SharedListWithDetails | null> {
  const { data: list, error } = await supabase
    .from("shared_lists")
    .select("id, user_id, title, emoji, created_at")
    .eq("id", listId)
    .single();
  if (error) return null;

  const [{ data: itemRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("list_items")
      .select("id, list_id, user_id, text, checked, checked_by, checked_at, position, created_at")
      .eq("list_id", listId)
      .order("position"),
    supabase.from("list_members").select("user_id").eq("list_id", listId),
  ]);

  const items = (itemRows ?? []) as ListItem[];
  const memberIds = (memberRows ?? []).map((r: any) => r.user_id as string);
  const allIds = Array.from(new Set([list.user_id, ...memberIds]));
  const profiles = await getProfiles(allIds);
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return {
    ...(list as SharedListRow),
    author: profileMap[list.user_id] ?? null,
    members: memberIds.map((id) => profileMap[id]).filter(Boolean) as Profile[],
    items,
    item_count: items.length,
    checked_count: items.filter((i) => i.checked).length,
  };
}

export async function listMySharedLists(userId: string): Promise<SharedListWithDetails[]> {
  // Lists I own or am a member of
  const { data: memberOf } = await supabase
    .from("list_members")
    .select("list_id")
    .eq("user_id", userId);
  const memberListIds = (memberOf ?? []).map((r: any) => r.list_id as string);

  const { data: lists, error } = await supabase
    .from("shared_lists")
    .select("id, user_id, title, emoji, created_at")
    .or(`user_id.eq.${userId}${memberListIds.length > 0 ? `,id.in.(${memberListIds.join(",")})` : ""}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  if (!lists || lists.length === 0) return [];

  const results = await Promise.all(
    (lists as SharedListRow[]).map((l) => getSharedListWithDetails(l.id))
  );
  return results.filter((l): l is SharedListWithDetails => l !== null);
}

export async function addListItem(args: {
  listId: string;
  userId: string;
  text: string;
  position?: number;
}): Promise<ListItem> {
  // position = after last item
  const { count } = await supabase
    .from("list_items")
    .select("id", { count: "exact", head: true })
    .eq("list_id", args.listId);

  const { data, error } = await supabase
    .from("list_items")
    .insert({
      list_id: args.listId,
      user_id: args.userId,
      text: args.text.trim(),
      position: args.position ?? (count ?? 0),
    })
    .select("id, list_id, user_id, text, checked, checked_by, checked_at, position, created_at")
    .single();
  if (error) throw error;
  return data as ListItem;
}

export async function toggleListItem(args: {
  itemId: string;
  userId: string;
  checked: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from("list_items")
    .update({
      checked: args.checked,
      checked_by: args.checked ? args.userId : null,
      checked_at: args.checked ? new Date().toISOString() : null,
    })
    .eq("id", args.itemId);
  if (error) throw error;
}

export async function deleteListItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("list_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function deleteSharedList(listId: string): Promise<void> {
  const { error } = await supabase.from("shared_lists").delete().eq("id", listId);
  if (error) throw error;
}

export async function addListMember(listId: string, userId: string): Promise<void> {
  await supabase.from("list_members").upsert({ list_id: listId, user_id: userId }, { ignoreDuplicates: true });
}

export function subscribeToListItems(listId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(`list-items:${listId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${listId}` }, onChange)
    .subscribe();
}
