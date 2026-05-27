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

export type MessageRow = {
  id: string;
  chat_id: string;
  sender_id: string;
  recipient_payloads: Record<string, EncryptedPayload>;
  created_at: string;
};

export type AttachmentInfo = {
  type: "image" | "video" | "file";
  path: string; // {chat_id}/{file_uuid}.bin inside chat-attachments bucket
  key_b64: string; // base64 32-byte symmetric key
  nonce_b64: string; // base64 24-byte nonce
  mime_type: string;
  size: number;
  filename?: string;
};

export type MessageContent = {
  text?: string;
  attachment?: AttachmentInfo;
  /** Aanwezig wanneer dit bericht een videogesprek-uitnodiging is. */
  call?: { started: true };
};

export type DecryptedMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  /** null wanneer decryptie faalde (auth-tag mismatch). */
  content: MessageContent | null;
  created_at: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

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

/** Fetch the most recent messages in a chat (default: last 50, oldest first). */
export async function fetchMessages(
  chatId: string,
  myUserId: string,
  limit = 50
): Promise<DecryptedMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, recipient_payloads, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = ((data ?? []) as MessageRow[]).reverse();
  return decryptRows(rows, myUserId);
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
    .select("id, chat_id, sender_id, recipient_payloads, created_at")
    .eq("chat_id", chatId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = ((data ?? []) as MessageRow[]).reverse();
  const messages = await decryptRows(rows, myUserId);
  return { messages, hasMore: rows.length === limit };
}

export async function decryptRows(
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

    // Account-model: envelop gekeyed op user_id.
    // Backward-compat voor de per-device periode: probeer alle enveloppen
    // met de accountsleutel — bij toevallige match werkt het, anders null.
    const payloads = r.recipient_payloads ?? {};
    const primary = payloads[myUserId];
    const candidates = primary
      ? [primary]
      : Object.values(payloads);

    let plaintext: Uint8Array | null = null;
    for (const env of candidates) {
      const result = decryptFromSender(env, identity.secretKey);
      if (result) { plaintext = result; break; }
    }

    return {
      id: r.id,
      chat_id: r.chat_id,
      sender_id: r.sender_id,
      content: plaintext ? parseDecrypted(plaintext) : null,
      created_at: r.created_at,
    };
  });
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
}): Promise<{ id: string; created_at: string }> {
  if (!args.text && !args.attachment && !args.call) {
    throw new Error("Bericht heeft tekst, bijlage of call nodig.");
  }

  const { data: members, error } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("chat_id", args.chatId);
  if (error) throw error;
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) throw new Error("chat has no members");

  // Account-model: één envelop per user_id, gekeyed op user_id.
  // Elk apparaat van de ontvanger haalt de account-sleutel op bij inloggen
  // en kan daarmee alle berichten ontsleutelen.
  const memberProfiles = await getProfiles(memberIds);
  const recipients = memberProfiles.map((p) => ({
    userId: p.id,
    publicKey: base64ToBytes(p.identity_pubkey),
  }));

  const content: MessageContent = {};
  if (args.text) content.text = args.text;
  if (args.attachment) content.attachment = args.attachment;
  if (args.call) content.call = args.call;

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

  // Push notificatie: fire-and-forget — nooit blokkeren op bezorging.
  // De Edge Function zoekt zelf de push tokens op via `user_devices` en
  // stuurt de notificatie naar alle ontvangers (iedereen behalve de verzender).
  const recipientIds = memberIds.filter((id) => id !== args.senderId);
  if (recipientIds.length > 0) {
    const textPreview = args.text ? args.text.slice(0, 120) : null;
    supabase.functions
      .invoke("send-push", {
        body: {
          chat_id: args.chatId,
          sender_id: args.senderId,
          recipient_ids: recipientIds,
          body: textPreview,
        },
      })
      .catch(() => {}); // stil falen — push is best-effort
  }

  return { id: inserted!.id as string, created_at: inserted!.created_at as string };
}

/**
 * Globale subscription op alle nieuwe messages waar de huidige user toegang
 * toe heeft (RLS filtert vanzelf). Wordt op het (app)-layout level gebruikt
 * om de chatlijst en bottom-bar badge meteen mee te updaten, ongeacht in
 * welke tab je staat.
 *
 * Belangrijk: de channel-naam moet uniek zijn per subscription-site,
 * anders krijg je "cannot add postgres_changes callbacks after subscribe()"
 * wanneer meerdere screens tegelijk subscriben (bv. (app)-layout én chat
 * detail). We hangen er een random suffix aan.
 */
export function subscribeToAllMyMessages(
  myUserId: string,
  onInsert: (row: MessageRow) => void
): RealtimeChannel {
  const uniq = Math.random().toString(36).slice(2, 10);
  const channel = supabase
    .channel(`global-messages:${myUserId}:${uniq}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const row = payload.new as MessageRow;
        onInsert(row);
      }
    )
    .subscribe();
  return channel;
}

export function subscribeToChatMessages(
  chatId: string,
  myUserId: string,
  onMessage: (msg: DecryptedMessage) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`chat:${chatId}`)
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
    .subscribe();
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
  attachmentType: "image" | "video" | "file";
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
