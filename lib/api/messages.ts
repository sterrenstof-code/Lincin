import type { RealtimeChannel } from "@supabase/supabase-js";

import { base64ToBytes, bytesToBase64 } from "../crypto/base64";
import {
  decryptFromSender,
  encryptForRecipients,
  type EncryptedPayload,
} from "../crypto/encrypt";
import { loadIdentity } from "../crypto/keys";
import { supabase } from "../supabase/client";
import { getProfiles } from "./profiles";
import { uniqueTopic } from "@/lib/supabase/channel";
import { timeoutSignal } from "@/lib/supabase/timeout";

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  recipient_payloads: Record<string, EncryptedPayload>;
  created_at: string;
  edited_at?: string | null;
};

export type AttachmentInfo = {
  type: "image" | "video" | "audio" | "file";
  path: string; // {chat_id}/{file_uuid}.bin inside chat-attachments bucket
  key_b64: string; // base64 32-byte symmetric key
  nonce_b64: string; // base64 24-byte nonce
  mime_type: string;
  size: number;
  filename?: string;
};

export type ReplyInfo = {
  messageId: string;
  senderName: string;
  /** Eerste ~80 tekens van het geciteerde bericht, voor de preview. */
  previewText: string;
};

/**
 * v2 — een bijdrage waar een bericht óver gaat.
 *
 * Het privé-blad (components/lincin/PrivateSheet.tsx) stuurt hem mee als
 * je "Vermeld" aan laat; het gesprek toont hem als "over «…»" boven het
 * bericht en in de strook met vermelde bijdragen. Oudere clients kennen
 * het veld niet en laten het gewoon staan.
 */
export type PostRef = {
  id: string;
  title: string;
  /** Het bijschrift, voor de regel "over «…»". */
  quote: string;
};

export type MessageContent = {
  text?: string;
  /** Aanwezig wanneer dit bericht over een bijdrage gaat. */
  postRef?: PostRef;
  attachment?: AttachmentInfo;
  /** Aanwezig wanneer dit bericht een videogesprek-uitnodiging is. */
  call?: { started: true };
  /** Aanwezig wanneer dit bericht een call-plan deelt (Doodle-stijl). */
  call_plan_id?: string;
  /** Aanwezig wanneer dit bericht een poll deelt. */
  poll_id?: string;
  /** Aanwezig wanneer dit bericht een reply is op een ander bericht. */
  reply?: ReplyInfo;
  /** Systeemmelding — gecentreerd weergegeven in de chat. */
  system?: { event: "group_avatar_updated"; actorName: string };
  /**
   * Een gedeelde plek (+ Bijlage → Plek). Zit in de versleutelde inhoud:
   * de server weet niet waar je bent.
   */
  place?: SharedPlace;
};

export type SharedPlace = { lat: number; lng: number; label?: string };

export type DecryptedMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  /** null wanneer decryptie faalde (auth-tag mismatch) of envelope ontbreekt. */
  content: MessageContent | null;
  /**
   * true wanneer er geen envelope bestaat voor deze user_id — het bericht is
   * mogelijk onderweg via re-keying en nog niet permanent onleesbaar.
   * false wanneer de envelope wél bestaat maar decryptie mislukte (auth-tag mismatch).
   */
  pendingRekey?: boolean;
  created_at: string;
  edited_at?: string | null;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const MESSAGE_COLUMNS = "id, chat_id, sender_id, recipient_payloads, created_at, edited_at";


/**
 * Decoderen van een plaintext-blob: nieuwe berichten zijn een JSON-object,
 * oude berichten zijn een rauwe string (voor backwards compat).
 */
function parseDecrypted(bytes: Uint8Array): MessageContent {
  const str = dec.decode(bytes);
  if (str.startsWith("{")) {
    try {
      const obj = JSON.parse(str);
      if (obj && typeof obj === "object") {
        return obj as MessageContent;
      }
    } catch {
      /* fallthrough */
    }
  }
  return { text: str };
}

/**
 * Haal specifieke berichten op bij hun ID en decrypt ze.
 * Wordt gebruikt om `pendingRekey`-berichten te herladen nadat re-keying
 * mogelijk al is afgerond (bijv. wanneer de gebruiker naar boven scrollt).
 */
export async function fetchMessagesByIds(
  ids: string[],
  myUserId: string
): Promise<DecryptedMessage[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .in("id", ids)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  return decryptRows((data ?? []) as MessageRow[], myUserId);
}

/** Fetch the most recent messages in a chat (default: last 50, oldest first). */
export async function fetchMessages(
  chatId: string,
  myUserId: string,
  limit = 50
): Promise<DecryptedMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const rows = ((data ?? []) as MessageRow[]).reverse();
  return decryptRows(rows, myUserId);
}

/**
 * Wat er sinds `after` in een gesprek bijkwam, oudste eerst.
 *
 * Voor het bijwerken na een onderbreking. Het live-kanaal geeft alleen door
 * wat er gebeurt terwijl het verbonden is; wat er binnenkwam terwijl de
 * telefoon in je zak lag of de tab sliep, komt nooit meer langs. Zonder dit
 * zag je die berichten pas na het opnieuw openen van het gesprek.
 */
export async function fetchMessagesSince(
  chatId: string,
  myUserId: string,
  after: string,
  limit = 200
): Promise<DecryptedMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .gt("created_at", after)
    .order("created_at", { ascending: true })
    .limit(limit)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  return decryptRows((data ?? []) as MessageRow[], myUserId);
}

/**
 * Haal een oudere pagina op: berichten die aangemaakt zijn vóór `before`.
 * Gebruikt als cursor de `created_at` van het oudste zichtbare bericht.
 * Geeft `hasMore: false` terug als er minder dan `limit` rows zijn.
 */
export async function fetchEarlierMessages(
  chatId: string,
  myUserId: string,
  before: string,
  limit = 50
): Promise<{ messages: DecryptedMessage[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(limit)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const rows = ((data ?? []) as MessageRow[]).reverse();
  const messages = await decryptRows(rows, myUserId);
  return { messages, hasMore: rows.length === limit };
}

/**
 * Wat al eens ontsleuteld is, per bericht en versie.
 *
 * Ontsleutelen kost per bericht een X25519-stap in pure JS. In de browser
 * is dat niets, maar op een telefoon (Hermes, zonder JIT) loopt het voor
 * een pagina van vijftig berichten op tot een seconde waarin de app
 * bevroren staat — en dat bij élk openen van hetzelfde gesprek, en bij
 * élke keer dat we bijwerken. De sleutel bevat `edited_at`, zodat een
 * bewerkt bericht opnieuw ontsleuteld wordt. Alleen geslaagde resultaten:
 * een bericht dat nog op her-versleuteling wacht moet het later opnieuw
 * kunnen proberen.
 */
const decrypted = new Map<string, DecryptedMessage>();
const DECRYPTED_MAX = 5_000;

function cacheKey(r: MessageRow, myUserId: string): string {
  return `${myUserId}:${r.id}:${r.edited_at ?? ""}`;
}

async function decryptRows(
  rows: MessageRow[],
  myUserId: string
): Promise<DecryptedMessage[]> {
  const identity = await loadIdentity();
  if (!identity) {
    console.warn("[decryptRows] geen identity-keys op dit toestel.");
  }

  return rows.map((r) => {
    if (!identity) {
      return { id: r.id, chat_id: r.chat_id, sender_id: r.sender_id, content: null, created_at: r.created_at };
    }

    const key = cacheKey(r, myUserId);
    const hit = decrypted.get(key);
    if (hit) return hit;

    // Account-model: envelop gekeyed op user_id.
    // Backward-compat voor de per-device periode: probeer alle enveloppen
    // met de accountsleutel — bij toevallige match werkt het, anders null.
    const payloads = r.recipient_payloads ?? {};
    const primary = payloads[myUserId];
    // Geen envelope voor deze user_id → re-keying nog niet afgerond.
    const pendingRekey = !primary;
    const candidates = primary
      ? [primary]
      : Object.values(payloads);

    let plaintext: Uint8Array | null = null;
    for (const env of candidates) {
      const result = decryptFromSender(env, identity.secretKey);
      if (result) { plaintext = result; break; }
    }

    const out: DecryptedMessage = {
      id: r.id,
      chat_id: r.chat_id,
      sender_id: r.sender_id,
      content: plaintext ? parseDecrypted(plaintext) : null,
      pendingRekey: plaintext ? false : pendingRekey,
      created_at: r.created_at,
      edited_at: r.edited_at ?? null,
    };
    if (plaintext) {
      if (decrypted.size >= DECRYPTED_MAX) decrypted.clear();
      decrypted.set(key, out);
    }
    return out;
  });
}

/**
 * Voor wie een bericht in een gesprek versleuteld wordt, even onthouden.
 *
 * Elke verzending vroeg eerst de leden op en daarna hun publieke sleutels:
 * twee keer heen en weer naar de server vóór het bericht zelf vertrok. De
 * leden van een gesprek veranderen zelden, dus een minuut onthouden scheelt
 * bij een vlot gesprek bijna alle wachttijd. Een lid dat in die minuut
 * bijkomt, krijgt zijn envelop via het her-versleutelen (zie rekey.ts);
 * wie via dit toestel leden toevoegt of verwijdert, wist de cache meteen.
 */
type Recipient = { userId: string; publicKey: Uint8Array };
const RECIPIENTS_TTL_MS = 60_000;
const recipientsByChat = new Map<string, { at: number; value: Promise<Recipient[]> }>();

async function loadRecipients(chatId: string): Promise<Recipient[]> {
  const { data: members, error } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("chat_id", chatId)
    .abortSignal(timeoutSignal());
  if (error) throw error;
  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (memberIds.length === 0) throw new Error("chat has no members");
  const memberProfiles = await getProfiles(memberIds);
  return memberProfiles.map((p) => ({
    userId: p.id,
    publicKey: base64ToBytes(p.identity_pubkey),
  }));
}

/** De ontvangers van een gesprek; roep hem gerust vooraf aan om op te warmen. */
export function getChatRecipients(chatId: string): Promise<Recipient[]> {
  const hit = recipientsByChat.get(chatId);
  if (hit && Date.now() - hit.at < RECIPIENTS_TTL_MS) return hit.value;
  const value = loadRecipients(chatId);
  recipientsByChat.set(chatId, { at: Date.now(), value });
  // Een mislukte poging niet onthouden.
  value.catch(() => {
    if (recipientsByChat.get(chatId)?.value === value) recipientsByChat.delete(chatId);
  });
  return value;
}

/** Na een ledenwijziging: de volgende verzending vraagt de leden opnieuw op. */
export function forgetChatRecipients(chatId: string): void {
  recipientsByChat.delete(chatId);
}

/**
 * Stuur een bericht. Inhoud is een JSON-blob (text + optioneel attachment)
 * versleuteld per ontvanger. Backwards compatible met oude string-only
 * decoderen aan ontvang-zijde.
 *
 * Geeft de server-side row id + created_at terug zodat callers hun
 * optimistic-bericht kunnen vervangen door de echte rij.
 */
export async function sendMessage(args: {
  chatId: string;
  senderId: string;
  text?: string;
  attachment?: AttachmentInfo;
  call?: { started: true };
  call_plan_id?: string;
  poll_id?: string;
  reply?: ReplyInfo;
  postRef?: PostRef;
  system?: { event: "group_avatar_updated"; actorName: string };
  place?: SharedPlace;
}): Promise<{ id: string; created_at: string }> {
  if (!args.text && !args.attachment && !args.call && !args.system && !args.call_plan_id && !args.poll_id && !args.place) {
    throw new Error("Bericht heeft tekst, bijlage, call, poll of call-plan nodig.");
  }

  // Account-model: één envelop per user_id, gekeyed op user_id.
  // Elk apparaat van de ontvanger haalt de account-sleutel op bij inloggen
  // en kan daarmee alle berichten ontsleutelen.
  const recipients = await getChatRecipients(args.chatId);

  const content: MessageContent = {};
  if (args.text) content.text = args.text;
  if (args.attachment) content.attachment = args.attachment;
  if (args.call) content.call = args.call;
  if (args.call_plan_id) content.call_plan_id = args.call_plan_id;
  if (args.poll_id) content.poll_id = args.poll_id;
  if (args.reply) content.reply = args.reply;
  if (args.postRef) content.postRef = args.postRef;
  if (args.system) content.system = args.system;
  if (args.place) content.place = args.place;

  const payloads = encryptForRecipients(
    enc.encode(JSON.stringify(content)),
    recipients
  );

  const { data: inserted, error: insertErr } = await supabase
    .from("messages")
    .insert({
      chat_id: args.chatId,
      sender_id: args.senderId,
      recipient_payloads: payloads,
    })
    .select("id, created_at")
    .single();
  if (insertErr) throw insertErr;

  // Push komt van de database-webhook op `messages` (send-push, tak
  // "messages"), niet van hier. Hier stond een tweede aanroep die de
  // ontsleutelde tekst naar de server stuurde — terwijl de functie zonder
  // `table` niets doet ("unsupported table"). Geen push gemist, wel een
  // lek gedicht: de tekst van een bericht verlaat het toestel alleen
  // versleuteld.

  return { id: inserted!.id as string, created_at: inserted!.created_at as string };
}

/**
 * Globale subscription op alle nieuwe messages waar de huidige user toegang
 * toe heeft (RLS filtert vanzelf). Wordt op het (app)-layout level gebruikt
 * om de chatlijst en bottom-bar badge meteen mee te updaten, ongeacht in
 * welke tab je staat.
 *
 * Eigen kanaalnaam per abonnee: het (app)-layout en een open gesprek
 * abonneren allebei, en een gedeelde naam gooit dan. Zie
 * `lib/supabase/channel.ts`.
 */
export function subscribeToAllMyMessages(
  myUserId: string,
  onInsert: (row: MessageRow) => void,
  /** Zie `subscribeToChatMessages`: "SUBSCRIBED" na een onderbreking = bijwerken. */
  onStatus?: (status: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(uniqueTopic(`global-messages:${myUserId}`))
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const row = payload.new as MessageRow;
        onInsert(row);
      }
    )
    .subscribe((status) => onStatus?.(status));
  return channel;
}

/**
 * Realtime-berichten van één gesprek.
 *
 * Eigen kanaalnaam per abonnee (`uniqueTopic`), want ditzelfde scherm kan
 * twee keer gemount staan: een stack houdt een scherm in leven als je er
 * bovenop navigeert, dus ga je van een gesprek via een tussenscherm terug
 * naar datzelfde gesprek, dan abonneren er twee. Zie
 * `lib/supabase/channel.ts` voor wat er dan misgaat.
 */
export function subscribeToChatMessages(
  chatId: string,
  myUserId: string,
  onMessage: (msg: DecryptedMessage) => void,
  /**
   * De stand van het kanaal. supabase-js verbindt zelf opnieuw na een
   * onderbreking en meldt dan opnieuw "SUBSCRIBED" — het teken om op te
   * halen wat er in de tussentijd gemist is.
   */
  onStatus?: (status: string) => void
): RealtimeChannel {
  const channel = supabase
    .channel(uniqueTopic(`chat:${chatId}`))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      },
      async (payload) => {
        const row = payload.new as MessageRow;
        const [decrypted] = await decryptRows([row], myUserId);
        if (decrypted) onMessage(decrypted);
      }
    )
    .subscribe((status) => onStatus?.(status));
  return channel;
}

// ---------- attachments ----------

const ATTACHMENT_BUCKET = "chat-attachments";

/** Random UUID using globalThis.crypto (polyfilled on RN). */
function randomId(): string {
  if (typeof (globalThis.crypto as any)?.randomUUID === "function") {
    return (globalThis.crypto as any).randomUUID();
  }
  const bytes = new Uint8Array(16);
  (globalThis.crypto as any).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20)
  );
}

/**
 * Upload encrypted attachment bytes to Storage. Returns the storage path.
 * The bucket-RLS ensures only chat members can upload to {chat_id}/.
 */
export async function uploadEncryptedAttachment(args: {
  chatId: string;
  ciphertext: Uint8Array;
}): Promise<string> {
  const path = `${args.chatId}/${randomId()}.bin`;
  // Upload as Blob — supabase-js accepts ArrayBuffer/Blob/Uint8Array but
  // Blob is the most cross-platform on web + RN.
  const blob = new Blob([args.ciphertext as any], {
    type: "application/octet-stream",
  });
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, blob, { contentType: "application/octet-stream", upsert: false });
  if (error) throw error;
  return path;
}

/** Download encrypted attachment bytes from Storage. */
export async function downloadEncryptedAttachment(
  path: string
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(path);
  if (error) throw error;
  const buffer = await data.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Build the AttachmentInfo envelope from encrypt-helper output. */
export function buildAttachmentInfo(args: {
  path: string;
  key: Uint8Array;
  nonce: Uint8Array;
  mimeType: string;
  size: number;
  filename?: string;
  attachmentType: "image" | "video" | "audio" | "file";
}): AttachmentInfo {
  return {
    type: args.attachmentType,
    path: args.path,
    key_b64: bytesToBase64(args.key),
    nonce_b64: bytesToBase64(args.nonce),
    mime_type: args.mimeType,
    size: args.size,
    filename: args.filename,
  };
}

/** Verwijder een bericht (alleen eigen berichten, RLS geeft de rest terug). */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);
  if (error) throw error;
}

/**
 * Bewerk de tekst van een eigen bericht.
 * We bewaren de bestaande recipient_payloads-sleutels maar vervangen de
 * plaintext door opnieuw te versleutelen voor alle huidige ontvangers.
 */
export async function editMessage(
  messageId: string,
  chatId: string,
  newText: string,
  senderId: string
): Promise<void> {
  const recipients = await getChatRecipients(chatId);
  const content: MessageContent = { text: newText };
  const payloads = encryptForRecipients(
    new TextEncoder().encode(JSON.stringify(content)),
    recipients
  );
  const { error: upErr } = await supabase
    .from("messages")
    .update({ recipient_payloads: payloads, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", senderId);
  if (upErr) throw upErr;
}
