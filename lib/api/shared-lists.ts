import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createNotification } from "./notifications";
import { uniqueTopic } from "@/lib/supabase/channel";

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

    // Notify each invited member
    for (const uid of args.memberIds) {
      createNotification({
        userId: uid,
        actorId: args.userId,
        type: "invited_to_list",
        listId: list.id,
      });
    }
  }
  return list as SharedListRow;
}

/**
 * Lijsten met hun items en leden in één select.
 *
 * Dit waren drie vragen per lijst (de lijst, items, leden) plus de
 * profielen. PostgREST neemt `list_items` en `list_members` mee via hun
 * foreign key, en beide gaan door hun eigen policy (`can_see_list`) — er
 * komt niets bij wat je los niet ook zag. Een lijst heeft hooguit een paar
 * dozijn items, dus dat blijft klein. Daarna één vraag voor alle profielen.
 */
const LIST_SELECT =
  "id, user_id, title, emoji, created_at, list_items(id, list_id, user_id, text, checked, checked_by, checked_at, position, created_at), list_members(user_id)";

type SharedListEmbedded = SharedListRow & {
  list_items: ListItem[] | null;
  list_members: { user_id: string }[] | null;
};

async function withDetails(lists: SharedListEmbedded[]): Promise<SharedListWithDetails[]> {
  if (lists.length === 0) return [];
  const allIds = new Set<string>();
  for (const l of lists) {
    allIds.add(l.user_id);
    (l.list_members ?? []).forEach((m) => allIds.add(m.user_id));
  }
  const profiles = await getProfiles(Array.from(allIds));
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return lists.map((list) => {
    const items = list.list_items ?? [];
    const memberIds = (list.list_members ?? []).map((m) => m.user_id);
    return {
      id: list.id,
      user_id: list.user_id,
      title: list.title,
      emoji: list.emoji,
      created_at: list.created_at,
      author: profileMap[list.user_id] ?? null,
      members: memberIds.map((id) => profileMap[id]).filter(Boolean) as Profile[],
      items,
      item_count: items.length,
      checked_count: items.filter((i) => i.checked).length,
    };
  });
}

export async function getSharedListWithDetails(
  listId: string
): Promise<SharedListWithDetails | null> {
  const { data: list, error } = await supabase
    .from("shared_lists")
    .select(LIST_SELECT)
    .eq("id", listId)
    .order("position", { referencedTable: "list_items" })
    .single();
  if (error || !list) return null;
  const [details] = await withDetails([list as unknown as SharedListEmbedded]);
  return details ?? null;
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
    .select(LIST_SELECT)
    .or(`user_id.eq.${userId}${memberListIds.length > 0 ? `,id.in.(${memberListIds.join(",")})` : ""}`)
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "list_items" })
    .limit(20);
  if (error) throw error;
  return withDetails((lists ?? []) as unknown as SharedListEmbedded[]);
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

export function subscribeToListItems(listId: string, onChange: () => void): RealtimeChannel {
  return supabase
    .channel(uniqueTopic(`list-items:${listId}`))
    .on("postgres_changes", { event: "*", schema: "public", table: "list_items", filter: `list_id=eq.${listId}` }, onChange)
    .subscribe();
}

/** De hele lijst weghalen (alleen de eigenaar; RLS "shared_lists: delete"). */
export async function deleteSharedList(listId: string): Promise<void> {
  const { error } = await supabase.from("shared_lists").delete().eq("id", listId);
  if (error) throw error;
}
