import type { RealtimeChannel } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

import { isAttentive } from "../attention";
import { rememberHues } from "../design/theme";
import { supabase } from "../supabase/client";
import { forgetChatRecipients, subscribeToAllMyMessages, type MessageRow } from "./messages";
import type { Profile } from "./profiles";
import { shareMyMessagesWithMembers } from "./rekey";
import { uniqueTopic } from "@/lib/supabase/channel";
import { timeoutSignal } from "@/lib/supabase/timeout";

export type ChatRow = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  avatar_url: string | null;
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

/** Mark a chat as read up to "now" for the current user. */
export async function markChatRead(chatId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_chat_read", { p_chat_id: chatId });
  if (error) throw error;
}

/**
 * Zet een gesprek weer op ongelezen: het laatste bericht van een ander telt
 * opnieuw mee (zie migratie 0075).
 */
export async function markChatUnread(chatId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_chat_unread", { p_chat_id: chatId });
  if (error) throw error;
}

/**
 * Verborgen chats wegfilteren — tenzij er sindsdien een nieuw bericht
 * binnenkwam, dan komt de chat vanzelf terug (archive-stijl).
 */
function visibleAfterHide(lastMessageAt: string | null, hiddenAt: string | null | undefined): boolean {
  if (!hiddenAt) return true;
  if (!lastMessageAt) return false;
  return new Date(lastMessageAt).getTime() > new Date(hiddenAt).getTime();
}

/** Bestaat de functie (nog) niet op de server? Dan de oude weg. */
function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

type ChatListRow = ChatRow & {
  hidden_at: string | null;
  unread_count: number | null;
  members: Profile[] | null;
};

/**
 * List all chats I'm a member of, with their members and unread counts.
 *
 * Eén vraag (`my_chat_list`, 0099) in plaats van vijf in drie golven na
 * elkaar (gesprekken → leden + ongelezen + hidden_at → profielen). De
 * lijst wordt bij elke terugkeer naar de app opgehaald, en op een trage
 * verbinding was elke golf de volle wachttijd. Volgorde, verborgen chats en
 * ongelezen-tellers zijn dezelfde als voorheen; zie de migratie.
 */
export async function listMyChats(myUserId: string): Promise<ChatWithMembers[]> {
  const { data, error } = await supabase
    .rpc("my_chat_list")
    .abortSignal(timeoutSignal());
  if (error) {
    // Een app die vóór de migratie uitrolt moet de lijst nog steeds tonen.
    if (isMissingFunction(error)) return listMyChatsLegacy(myUserId);
    throw error;
  }
  const rows = (data ?? []) as unknown as ChatListRow[];
  const out: ChatWithMembers[] = [];
  const allMembers: Profile[] = [];
  for (const r of rows) {
    if (!visibleAfterHide(r.last_message_at, r.hidden_at)) continue;
    const members = r.members ?? [];
    for (const m of members) allMembers.push(m);
    out.push({
      id: r.id,
      type: r.type,
      name: r.name,
      avatar_url: r.avatar_url,
      created_by: r.created_by,
      created_at: r.created_at,
      last_message_at: r.last_message_at,
      members,
      unread_count: r.unread_count ?? 0,
    });
  }
  rememberHues(allMembers);
  return out;
}

/** De oude weg, alleen voor een database zonder `my_chat_list` (vóór 0099). */
async function listMyChatsLegacy(myUserId: string): Promise<ChatWithMembers[]> {
  // RLS filters chats to those I'm a member of.
  // Sorteren op last_message_at (van trigger) zodat actieve chats bovenaan
  // staan — Telegram-style. nullsFirst:false zet lege chats onderaan.
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, type, name, avatar_url, created_by, created_at, last_message_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const chatRows = (chats ?? []) as ChatRow[];
  if (chatRows.length === 0) return [];

  const chatIds = chatRows.map((c) => c.id);
  const [membersResult, unreadResult, hiddenResult] = await Promise.all([
    supabase
      .from("chat_members")
      .select("chat_id, user_id")
      .in("chat_id", chatIds)
      .abortSignal(timeoutSignal()),
    supabase.rpc("my_chat_unread_counts").abortSignal(timeoutSignal()),
    // Mijn eigen chat_members rijen om hidden_at op te halen. Pre-0023
    // databases kennen de kolom niet — we vangen dat verderop op (filter
    // wordt dan effectief no-op).
    supabase
      .from("chat_members")
      .select("chat_id, hidden_at")
      .eq("user_id", myUserId)
      .in("chat_id", chatIds)
      .abortSignal(timeoutSignal()),
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
    // last_seen_at voor "actief · 2 min geleden" in de kop van een gesprek,
    // hue voor de eigen kleur van wie erin zit (0082).
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at, hue")
    .in("id", memberUserIds)
    .abortSignal(timeoutSignal());
  if (pErr) throw pErr;
  rememberHues(profiles ?? []);
  const profileById = new Map<string, Profile>(profiles?.map((p) => [p.id, p]) ?? []);

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
    .filter((c) => visibleAfterHide(c.last_message_at, hiddenByChat.get(c.id)))
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

/**
 * De foto die bij een gesprek hoort.
 *
 * Staat hier, naast `chatTitle`, om dezelfde reden als die: het antwoord
 * hangt af van het soort gesprek, en dat mag niet per scherm anders
 * uitpakken. Precies dat gebeurde. De chatlijst deed de goede afweging —
 * bij een groep de groepsfoto, bij een direct gesprek die van de ander —
 * en de zijkolom op breed scherm gaf blind `chat.avatar_url` mee. Dat veld
 * is bij een direct gesprek altijd `null`, dus dezelfde vriend stond links
 * als twee initialen en rechts als foto. Eén gesprek, twee gezichten.
 */
export function chatAvatarUrl(
  chat: ChatWithMembers,
  myUserId: string
): string | null {
  if (chat.type === "group") return chat.avatar_url ?? null;
  return chat.members.find((m) => m.id !== myUserId)?.avatar_url ?? null;
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
    .select("id, type, name, avatar_url, created_by, created_at")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  return (data as ChatRow) ?? null;
}

/** Upload a group avatar and save the URL on the chat row.
 *  Path: {userId}/group_{chatId}.ext — valt onder de bestaande eigen-map policy.
 */
export async function uploadGroupAvatar(
  chatId: string,
  userId: string,
  fileBytes: Uint8Array<ArrayBuffer>,
  mimeType: string
): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const path = `${userId}/group_${chatId}.${ext}`;
  const blob = new Blob([fileBytes], { type: mimeType });
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: mimeType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  const { error: upErr } = await supabase
    .from("chats")
    .update({ avatar_url: url })
    .eq("id", chatId);
  if (upErr) throw upErr;
  return url;
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
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at, hue")
    .in("id", profileIds);
  if (pErr) throw pErr;
  rememberHues(profiles ?? []);
  const byId = new Map<string, Profile>((profiles ?? []).map((p) => [p.id, p]));
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
  forgetChatRecipients(chatId);
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
  forgetChatRecipients(chatId);
}

/**
 * Haal per lid van een chat op tot waar hij las (`last_read_at`) en tot
 * waar de berichten bij hem aankwamen (`last_delivered_at`, 0100).
 * Wordt gebruikt voor de status onder je laatste bericht: "aangekomen",
 * "gezien".
 */
export async function fetchMemberLastRead(
  chatId: string
): Promise<{ read: Map<string, string>; delivered: Map<string, string> }> {
  const { data, error } = await supabase
    .from("chat_members")
    .select("user_id, last_read_at, last_delivered_at")
    .eq("chat_id", chatId);
  if (error) throw error;
  const read = new Map<string, string>();
  const delivered = new Map<string, string>();
  for (const r of data ?? []) {
    if (r.last_read_at) read.set(r.user_id, r.last_read_at);
    if (r.last_delivered_at) delivered.set(r.user_id, r.last_delivered_at);
  }
  return { read, delivered };
}

/**
 * Realtime subscription op `chat_members` updates voor een specifieke chat.
 * Vuurt af wanneer iemand de chat leest of een bericht binnenkrijgt
 * (last_read_at / last_delivered_at verandert). Werkt pas sinds 0100:
 * daarvoor stond chat_members niet in de realtime-publicatie en kwam hier
 * nooit iets langs.
 */
export function subscribeToChatMemberUpdates(
  chatId: string,
  onChange: (userId: string, at: { read: string | null; delivered: string | null }) => void
): RealtimeChannel {
  return supabase
    .channel(uniqueTopic(`chat-members-read:${chatId}`))
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_members",
        filter: `chat_id=eq.${chatId}`,
      },
      (payload) => {
        const row = payload.new as {
          user_id: string;
          last_read_at: string | null;
          last_delivered_at?: string | null;
        };
        onChange(row.user_id, { read: row.last_read_at, delivered: row.last_delivered_at ?? null });
      }
    )
    .subscribe();
}

/**
 * "Aangekomen" (0100): meld de server tot waar berichten van anderen in dit
 * gesprek bij mij binnen zijn. Los van aandacht — een tab op de achtergrond
 * heeft het bericht wél ontvangen, alleen nog niet gezien.
 *
 * Elk bericht dat binnenkomt passeert meerdere wegen (het globale kanaal,
 * het kanaal van een open gesprek, catch-up, de voorvertoningen), dus per
 * gesprek onthouden we het nieuwste tijdstip dat al gemeld is of in de rij
 * staat en slaan alles over wat niet nieuwer is. Een golf berichten (een
 * herverbinding, tien chats tegelijk bijwerken) wordt met een korte timer
 * één aanroep per gesprek. Vuur-en-vergeet: een mislukte melding vergeten
 * we, zodat het volgende bericht het opnieuw probeert; de server zet het
 * watermerk toch nooit terug.
 */
const deliveredSent = new Map<string, string>();
const deliveredQueued = new Map<string, string>();
let deliveredTimer: ReturnType<typeof setTimeout> | null = null;

function notNewer(prev: string | undefined, at: string): boolean {
  if (!prev) return false;
  // Date.parse kapt microseconden af; gelijk op de milliseconde maar een
  // andere string mag dus nog door — dat kost hoogstens één aanroep.
  return prev === at || Date.parse(prev) > Date.parse(at);
}

function flushDelivered(): void {
  deliveredTimer = null;
  const batch = [...deliveredQueued];
  deliveredQueued.clear();
  for (const [chatId, at] of batch) {
    deliveredSent.set(chatId, at);
    void supabase
      .rpc("mark_chat_delivered", { p_chat_id: chatId, p_at: at })
      .then(
        ({ error }) => {
          if (error && deliveredSent.get(chatId) === at) deliveredSent.delete(chatId);
        },
        () => {
          if (deliveredSent.get(chatId) === at) deliveredSent.delete(chatId);
        }
      );
  }
}

export function markChatDelivered(chatId: string, at: string): void {
  if (notNewer(deliveredQueued.get(chatId) ?? deliveredSent.get(chatId), at)) return;
  deliveredQueued.set(chatId, at);
  if (!deliveredTimer) deliveredTimer = setTimeout(flushDelivered, 300);
}

/**
 * Per gesprek het nieuwste bericht van een ander uit `rows` als aangekomen
 * melden. Mijn eigen berichten tellen niet: die "komen" niet bij mij aan.
 */
export function markMessagesDelivered(
  rows: Iterable<Pick<MessageRow, "chat_id" | "sender_id" | "created_at">>,
  myUserId: string
): void {
  const latest = new Map<string, string>();
  for (const r of rows) {
    if (r.sender_id === myUserId) continue;
    const prev = latest.get(r.chat_id);
    if (!prev || Date.parse(r.created_at) > Date.parse(prev)) latest.set(r.chat_id, r.created_at);
  }
  for (const [chatId, at] of latest) markChatDelivered(chatId, at);
}


// ---------- de chatlijst live houden zonder hem steeds opnieuw op te halen ----------

function chatsKey(myUserId: string) {
  return ["chats", myUserId] as const;
}

/**
 * Welke gesprekken nu open staan (met teller: een stack kan hetzelfde
 * gesprek twee keer gemount hebben). Een bericht in een open gesprek telt
 * niet als ongelezen — dat scherm markeert het meteen als gelezen. Maar
 * alleen als je ook kijkt (`isAttentive`, zie `applyIncomingMessage`):
 * open in een tab op de achtergrond is niet gezien.
 */
const openChats = new Map<string, number>();

/** Meld een gesprek als open; geeft de functie terug die het weer sluit. */
export function markChatOpen(chatId: string): () => void {
  openChats.set(chatId, (openChats.get(chatId) ?? 0) + 1);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const n = (openChats.get(chatId) ?? 1) - 1;
    if (n <= 0) openChats.delete(chatId);
    else openChats.set(chatId, n);
  };
}

/** Nieuwste eerst, lege gesprekken onderaan — dezelfde volgorde als de server. */
function byLastMessage(a: ChatWithMembers, b: ChatWithMembers): number {
  const x = a.last_message_at;
  const y = b.last_message_at;
  if (x === y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return Date.parse(y) - Date.parse(x);
}

/**
 * Een binnenkomend bericht in de gecachte chatlijst verwerken.
 *
 * Elk bericht in welk gesprek dan ook haalde vroeger de hele lijst opnieuw
 * op — bij iedereen die de app open had, voor één getal en één tijdstip
 * die we hier al weten. Nu passen we de rij zelf aan: `last_message_at`
 * naar dit bericht, het gesprek naar boven, en +1 ongelezen tenzij het van
 * mij is (de server telt eigen berichten nooit mee) of het gesprek open
 * staat terwijl je kijkt (dat scherm markeert hem dan meteen gelezen).
 * Open maar zonder aandacht telt wél: dan wacht dat scherm met lezen tot
 * je terug bent, en zonder deze +1 zag je nergens dat er iets was.
 *
 * Loopt er al een ophaalronde, dan wachten we die af en passen het daarna
 * toe: hij kan van vóór dit bericht zijn en zou onze aanpassing anders
 * overschrijven. (Hem afbreken met een invalidate zou een open gesprek dat
 * net op die lijst wacht voor zijn ongelezen-scheidslijn met lege handen
 * laten staan.) Wás het bericht er al in, dan houdt de tijdcontrole
 * hieronder het bij één keer tellen.
 *
 * Wél opnieuw ophalen als we de rij niet hebben: een nieuw gesprek, of een
 * verborgen gesprek dat door dit bericht terugkomt.
 */
export function applyIncomingMessage(
  qc: QueryClient,
  myUserId: string,
  row: Pick<MessageRow, "chat_id" | "sender_id" | "created_at">,
  afterFetch = false
): void {
  const key = chatsKey(myUserId);
  const inFlight = qc.getQueryCache().find<ChatWithMembers[]>({ queryKey: key, exact: true })?.promise;
  if (inFlight && !afterFetch) {
    // Een tik later: de query zet zijn data pas ná het afronden van deze
    // promise in de cache.
    void inFlight.then(
      () => void setTimeout(() => applyIncomingMessage(qc, myUserId, row, true), 0),
      () => void qc.invalidateQueries({ queryKey: key })
    );
    return;
  }
  const list = qc.getQueryData<ChatWithMembers[]>(key);
  const idx = list ? list.findIndex((c) => c.id === row.chat_id) : -1;
  if (!list || idx < 0) {
    void qc.invalidateQueries({ queryKey: key });
    return;
  }
  const chat = list[idx];
  // Al verwerkt: de lijst werd ná dit bericht opgehaald (de trigger uit
  // 0022 zet last_message_at op precies dit tijdstip). Niet dubbel tellen.
  if (chat.last_message_at && Date.parse(chat.last_message_at) >= Date.parse(row.created_at)) {
    return;
  }
  const countsAsUnread = row.sender_id !== myUserId && !(openChats.has(row.chat_id) && isAttentive());
  const next = list.slice();
  next[idx] = {
    ...chat,
    last_message_at: row.created_at,
    unread_count: countsAsUnread ? (chat.unread_count ?? 0) + 1 : chat.unread_count,
  };
  // Array.prototype.sort is stabiel: gelijke rijen houden hun plek.
  next.sort(byLastMessage);
  qc.setQueryData(key, next);
}

/**
 * Na `markChatRead`: de teller van dat gesprek op nul in de cache, in
 * plaats van de hele lijst opnieuw op te halen. De server zet
 * last_read_at op "nu", dus nul is precies wat een verse lijst zou geven.
 */
export function clearUnreadInCache(qc: QueryClient, myUserId: string, chatId: string, afterFetch = false): void {
  const key = chatsKey(myUserId);
  // Loopt er een ophaalronde (terug naar de tab = `refetchOnWindowFocus`),
  // dan kan die van vóór het gelezen-merk zijn en de oude teller
  // terugzetten. Na afloop nog eens op nul — anders bleef er een `1` staan
  // in een gesprek dat je net las.
  const query = afterFetch ? undefined : qc.getQueryCache().find({ queryKey: key, exact: true });
  const inFlight = query?.state.fetchStatus === "fetching" ? query.promise : undefined;
  if (inFlight) {
    const again = () => void setTimeout(() => clearUnreadInCache(qc, myUserId, chatId, true), 0);
    void inFlight.then(again, again);
  }
  qc.setQueryData<ChatWithMembers[]>(key, (list) => {
    if (!list) return list;
    const idx = list.findIndex((c) => c.id === chatId);
    if (idx < 0 || (list[idx].unread_count ?? 0) === 0) return list;
    const next = list.slice();
    next[idx] = { ...list[idx], unread_count: 0 };
    return next;
  });
}

/**
 * Eén globaal berichtenkanaal, hoeveel schermen er ook om vragen.
 *
 * Het (app)-layout en een open gesprek abonneerden allebei op álle
 * berichten (zonder filter; RLS bepaalt wat er langskomt): elk bericht
 * kwam dus twee keer binnen en haalde twee keer de lijst op. Het gesprek
 * kan het niet zomaar aan het layout overlaten — open je een gesprek via
 * een link of herlaad je de pagina erop, dan is het (app)-layout niet
 * gemount. Daarom telt dit hoeveel er om vragen en houdt het precies één
 * kanaal open zolang er minstens één is.
 */
let watch: { userId: string; refs: number; stop: () => void } | null = null;

export function watchMyChatList(qc: QueryClient, myUserId: string): () => void {
  if (watch && watch.userId !== myUserId) {
    watch.stop();
    watch = null;
  }
  if (!watch) {
    // Na een onderbroken verbinding is wat er intussen binnenkwam nooit
    // live langsgekomen; de lijst dan wél opnieuw ophalen.
    let subscribedOnce = false;
    const channel = subscribeToAllMyMessages(
      myUserId,
      (row) => {
        // Wat de draaiende app bereikt is aangekomen, welk scherm er ook
        // open staat en of je nu kijkt of niet.
        markMessagesDelivered([row], myUserId);
        applyIncomingMessage(qc, myUserId, row);
      },
      (status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribedOnce) void qc.invalidateQueries({ queryKey: chatsKey(myUserId) });
        subscribedOnce = true;
      }
    );
    watch = { userId: myUserId, refs: 0, stop: () => void supabase.removeChannel(channel) };
  }
  const w = watch;
  w.refs++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    w.refs--;
    if (w.refs <= 0 && watch === w) {
      w.stop();
      watch = null;
    }
  };
}

/**
 * `shareMyMessagesWithMembers` (0095) hooguit één keer per sessie: bij het
 * opstarten voor alle gesprekken, en per gesprek bij het eerste openen.
 *
 * Hij liep bij elke start én bij elk openen van een gesprek, en elke ronde
 * is minstens één RPC die de berichten van dat gesprek doorzoekt — meestal
 * om niets te vinden. Wie een lid toevoegt roept de onbegrensde versie
 * direct aan (app/group-add), dus daar verandert niets.
 */
const sharedThisSession = new Set<string>();

export function shareMyMessagesOnce(myUserId: string, chatId?: string): void {
  const key = `${myUserId}:${chatId ?? "*"}`;
  if (sharedThisSession.has(key)) return;
  sharedThisSession.add(key);
  void shareMyMessagesWithMembers(myUserId, chatId);
}
