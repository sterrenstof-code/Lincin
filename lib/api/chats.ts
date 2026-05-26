import { supabase } from "../supabase/client";
import type { Profile } from "./profiles";

export type ChatRow = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  created_by: string;
  created_at: string;
  /**
   * Timestamp van het meest recente bericht in deze chat. Gevuld via DB-
   * trigger op messages-insert (migratie 0022). Default = chat.created_at
   * voor lege chats.
   */
  last_message_at: string | null;
};

export type ChatWithMembers = ChatRow & {
  members: Profile[];
  /** Number of messages newer than my last_read_at, from other senders. */
  unread_count: number;
};

/** Find-or-create the direct chat between me and another user. Atomic via RPC. */
export async function getOrCreateDirectChat(otherUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_direct_chat", {
    other_user: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

/** Atomically create a group chat with the given name and member user-ids. */
export async function createGroupChat(
  name: string,
  memberIds: string[]
): Promise<string> {
  const { data, error } = await supabase.rpc("create_group_chat", {
    group_name: name,
    member_ids: memberIds,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Leave a chat — deletes your own chat_members row. For direct chats this
 * effectively orphans the chat for the other party but the row stays for
 * them. For groups, you're simply removed.
 */
export async function leaveChat(chatId: string, myUserId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", myUserId);
  if (error) throw error;
}

/**
 * Verberg een chat voor mij — WhatsApp-archive stijl. De chat verdwijnt uit
 * mijn lijst maar verschijnt opnieuw zodra de andere persoon iets stuurt
 * (filter in listMyChats vergelijkt hidden_at met chat.last_message_at).
 *
 * Niets wordt verwijderd, voor de andere partij verandert er niets.
 */
export async function hideChat(chatId: string, myUserId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_members")
    .update({ hidden_at: new Date().toISOString() })
    .eq("chat_id", chatId)
    .eq("user_id", myUserId);
  if (error) throw error;
}

/**
 * Verwijder een 1:1 chat hard voor alle deelnemers. De delete-policy op
 * `chats` checkt dat type='direct' en dat ik member ben. CASCADE-FK's
 * ruimen messages en chat_members op.
 *
 * Werkt NIET op groepen — daar moet je leaveChat() gebruiken. Server-side
 * RLS blokkeert het anders ook.
 */
export async function deleteChatForEveryone(chatId: string): Promise<void> {
  const { error } = await supabase.from("chats").delete().eq("id", chatId);
  if (error) throw error;
}

/** Mark a chat as read up to "now" for the current user. */
export async function markChatRead(chatId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_chat_read", { p_chat_id: chatId });
  if (error) throw error;
}

/** List all chats I'm a member of, with their members and unread counts. */
export async function listMyChats(myUserId: string): Promise<ChatWithMembers[]> {
  // RLS filters chats to those I'm a member of.
  // Sorteren op last_message_at (van trigger) zodat actieve chats bovenaan
  // staan — Telegram-style. nullsFirst:false zet lege chats onderaan.
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, type, name, created_by, created_at, last_message_at")
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const chatRows = (chats ?? []) as ChatRow[];
  if (chatRows.length === 0) return [];

  const chatIds = chatRows.map((c) => c.id);
  const [membersResult, unreadResult, hiddenResult] = await Promise.all([
    supabase
      .from("chat_members")
      .select("chat_id, user_id")
      .in("chat_id", chatIds),
    supabase.rpc("my_chat_unread_counts"),
    // Mijn eigen chat_members rijen om hidden_at op te halen. Pre-0023
    // databases kennen de kolom niet — we vangen dat verderop op (filter
    // wordt dan effectief no-op).
    supabase
      .from("chat_members")
      .select("chat_id, hidden_at")
      .eq("user_id", myUserId)
      .in("chat_id", chatIds),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (unreadResult.error) throw unreadResult.error;
  // hiddenResult kan falen op pre-0023 DB's; dan slaan we het filter over.
  const hiddenByChat = new Map<string, string | null>();
  if (!hiddenResult.error) {
    for (const r of hiddenResult.data ?? []) {
      hiddenByChat.set(
        (r as any).chat_id,
        (r as any).hidden_at ?? null
      );
    }
  }

  const members = membersResult.data ?? [];
  const memberUserIds = Array.from(new Set(members.map((m) => m.user_id)));
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey")
    .in("id", memberUserIds);
  if (pErr) throw pErr;
  const profileById = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const membersByChat = new Map<string, Profile[]>();
  for (const m of members) {
    const prof = profileById.get(m.user_id);
    if (!prof) continue;
    const arr = membersByChat.get(m.chat_id) ?? [];
    arr.push(prof);
    membersByChat.set(m.chat_id, arr);
  }

  const unreadByChat = new Map<string, number>(
    (unreadResult.data ?? []).map((u: any) => [u.chat_id, u.unread_count ?? 0])
  );

  return chatRows
    .filter((c) => {
      // Verborgen chats wegfilteren — tenzij er sindsdien een nieuw bericht
      // binnenkwam, dan komt de chat vanzelf terug (archive-stijl).
      const hiddenAt = hiddenByChat.get(c.id);
      if (!hiddenAt) return true;
      const lastAt = c.last_message_at;
      if (!lastAt) return false;
      return new Date(lastAt).getTime() > new Date(hiddenAt).getTime();
    })
    .map((c) => ({
      ...c,
      members: membersByChat.get(c.id) ?? [],
      unread_count: unreadByChat.get(c.id) ?? 0,
    }));
}

/** Compute a friendly title for a chat from the current user's perspective. */
export function chatTitle(chat: ChatWithMembers, myUserId: string): string {
  if (chat.type === "group") return chat.name ?? "Groep";
  const other = chat.members.find((m) => m.id !== myUserId);
  return other?.display_name ?? other?.username ?? "Direct";
}

/** Find the other party in a direct chat (returns null for groups or self-only). */
export function otherMember(
  chat: ChatWithMembers,
  myUserId: string
): Profile | null {
  if (chat.type !== "direct") return null;
  return chat.members.find((m) => m.id !== myUserId) ?? null;
}

// ---------- group management helpers ----------

export type ChatMemberRow = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profile: Profile | null;
};

/** Fetch the raw chat row by id (without members). */
export async function getChatRow(chatId: string): Promise<ChatRow | null> {
  const { data, error } = await supabase
    .from("chats")
    .select("id, type, name, created_by, created_at")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  return (data as ChatRow) ?? null;
}

/** Fetch chat members with role + profile, sorted by join order. */
export async function listChatMembers(
  chatId: string
): Promise<ChatMemberRow[]> {
  const { data, error } = await supabase
    .from("chat_members")
    .select("user_id, role, joined_at")
    .eq("chat_id", chatId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const profileIds = rows.map((r) => r.user_id);
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey")
    .in("id", profileIds);
  if (pErr) throw pErr;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    user_id: r.user_id,
    role: r.role as "owner" | "member",
    joined_at: r.joined_at,
    profile: byId.get(r.user_id) ?? null,
  }));
}

/** Rename a group chat (owner only, enforced server-side by RLS). */
export async function renameChat(chatId: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Naam mag niet leeg zijn.");
  if (trimmed.length > 64) throw new Error("Maximaal 64 tekens.");
  const { error } = await supabase
    .from("chats")
    .update({ name: trimmed })
    .eq("id", chatId);
  if (error) throw error;
}

/** Owner adds a friend to a group. Uses the SECURITY DEFINER RPC. */
export async function addChatMember(
  chatId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("add_chat_member", {
    p_chat_id: chatId,
    p_user_id: userId,
  });
  if (error) throw error;
}

/** Owner removes a member from a group (RLS enforces owner + group-only). */
export async function removeChatMember(
  chatId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", userId);
  if (error) throw error;
}
