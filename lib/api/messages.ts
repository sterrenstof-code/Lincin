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

/** Fetch the most recent messages in a chat (default: last 100, oldest first). */
export async function fetchMessages(
  chatId: string,
  myUserId: string,
  limit = 100
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

export async function decryptRows(
  rows: MessageRow[],
  myUserId: string
): Promise<DecryptedMessage[]> {
  const identity = await loadIdentity();
  if (!identity) {
    console.warn(
      "[decryptRows] geen identity-keys gevonden op dit toestel — alle berichten worden als 'kon niet ontsleutelen' getoond. Reset device keys via Profiel."
    );
  }
  return rows.map((r) => {
    if (!identity) {
      return {
        id: r.id,
        chat_id: r.chat_id,
        sender_id: r.sender_id,
        content: null,
        created_at: r.created_at,
      };
    }
    const envelope = r.recipient_payloads?.[myUserId];
    if (!envelope) {
      console.warn(
        `[decryptRows] geen envelope voor mijn user_id (${myUserId}) in bericht ${r.id}. Mogelijk verstuurd voor jouw key-rotation of door legacy-client.`
      );
      return {
        id: r.id,
        chat_id: r.chat_id,
        sender_id: r.sender_id,
        content: null,
        created_at: r.created_at,
      };
    }
    const plaintext = decryptFromSender(envelope, identity.secretKey);
    if (!plaintext) {
      console.warn(
        `[decryptRows] decryptie faalde voor bericht ${r.id}. Het AEAD auth-tag matcht niet — je private key komt niet overeen met de public key die de afzender gebruikte. Meestal: je keys zijn lokaal vervangen na een logout/wipe terwijl de DB nog de oude pubkey heeft, of omgekeerd.`
      );
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
}): Promise<{ id: string; created_at: string }> {
  if (!args.text && !args.attachment) {
    throw new Error("Bericht heeft tekst of bijlage nodig.");
  }

  const { data: members, error } = await supabase
    .from("chat_members")
    .select("user_id")
    .eq("chat_id", args.chatId);
  if (error) throw error;
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (memberIds.length === 0) throw new Error("chat has no members");

  const profiles = await getProfiles(memberIds);
  const recipients = profiles.map((p) => ({
    userId: p.id,
    publicKey: base64ToBytes(p.identity_pubkey),
  }));

  const content: MessageContent = {};
  if (args.text) content.text = args.text;
  if (args.attachment) content.attachment = args.attachment;

  const payloads = encryptForRecipients(enc.encode(JSON.stringify(content)), recipients);

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
