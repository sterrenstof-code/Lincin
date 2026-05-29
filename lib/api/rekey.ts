/**
 * Re-keying: voeg enveloppen toe aan bestaande berichten voor een nieuw groepslid.
 *
 * Strategie:
 *  1. Prioriteitsbatch: meest recente PRIORITY_BATCH berichten direct (descending),
 *     zodat het nieuwe lid meteen de recente context kan lezen.
 *  2. Achtergrond: daarna alle oudere berichten backwards, batch voor batch.
 *
 * Fire-and-forget: fouten worden gelogd maar nooit omhoog gegooid zodat de UI
 * nooit vastloopt door een mislukte re-keying.
 */

import { base64ToBytes } from "../crypto/base64";
import { decryptFromSender, encryptForRecipient } from "../crypto/encrypt";
import { loadIdentity } from "../crypto/keys";
import { supabase } from "../supabase/client";
import { getProfiles } from "./profiles";
import type { MessageRow } from "./messages";

const PRIORITY_BATCH = 50;
const BACKGROUND_BATCH = 50;

/**
 * Hoofdfunctie: roep aan direct nadat een nieuw lid is toegevoegd.
 *
 * Rekeyt eerst de laatste PRIORITY_BATCH berichten (meest recent → oud),
 * dan gaat het backwards door de rest van de geschiedenis in de achtergrond.
 */
export async function rekeyMessagesForNewMember(
  chatId: string,
  newUserId: string,
  myUserId: string
): Promise<void> {
  try {
    const identity = await loadIdentity();
    if (!identity) {
      console.warn("[rekey] Geen identity-keys beschikbaar, re-keying overgeslagen.");
      return;
    }

    const profiles = await getProfiles([newUserId]);
    const newMemberProfile = profiles.find((p) => p.id === newUserId);
    if (!newMemberProfile?.identity_pubkey) {
      console.warn("[rekey] Geen publieke sleutel gevonden voor nieuw lid:", newUserId);
      return;
    }
    const newMemberPubKey = base64ToBytes(newMemberProfile.identity_pubkey);

    // ── Prioriteitsbatch: laatste PRIORITY_BATCH berichten (meest recent eerst) ──
    const { data: priorityData, error: priorityErr } = await supabase
      .from("messages")
      .select("id, chat_id, sender_id, recipient_payloads, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(PRIORITY_BATCH);

    if (priorityErr) {
      console.error("[rekey] Fout bij ophalen prioriteitsbatch:", priorityErr.message);
      return;
    }

    const priorityRows = (priorityData ?? []) as MessageRow[];
    const rekeyed = await rekeyBatch(priorityRows, newUserId, myUserId, newMemberPubKey, identity.secretKey);
    console.log(`[rekey] Prioriteitsbatch: ${rekeyed}/${priorityRows.length} berichten verwerkt.`);

    // Geen oudere berichten? Klaar.
    if (priorityRows.length < PRIORITY_BATCH) return;

    // ── Achtergrondbatch: alles ouder dan de laatste prioriteitsbatch ──
    const oldestCursor = priorityRows[priorityRows.length - 1].created_at;
    // Fire-and-forget: niet awaiten zodat de UI niet blokkeert.
    rekeyOlderBackground(chatId, newUserId, myUserId, newMemberPubKey, identity.secretKey, oldestCursor).catch(
      (err) => console.error("[rekey] Achtergrondfout:", err?.message ?? err)
    );
  } catch (err: any) {
    console.error("[rekey] Onverwachte fout:", err?.message ?? err);
  }
}

/** Verwerkt alle berichten ouder dan `before` in batches van BACKGROUND_BATCH. */
async function rekeyOlderBackground(
  chatId: string,
  newUserId: string,
  myUserId: string,
  newMemberPubKey: Uint8Array,
  mySecretKey: Uint8Array,
  before: string
): Promise<void> {
  let cursor = before;
  let totalRekeyed = 0;

  while (true) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, chat_id, sender_id, recipient_payloads, created_at")
      .eq("chat_id", chatId)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(BACKGROUND_BATCH);

    if (error) {
      console.error("[rekey] Fout in achtergrondbatch:", error.message);
      return;
    }

    const rows = (data ?? []) as MessageRow[];
    if (rows.length === 0) break;

    totalRekeyed += await rekeyBatch(rows, newUserId, myUserId, newMemberPubKey, mySecretKey);
    cursor = rows[rows.length - 1].created_at;

    if (rows.length < BACKGROUND_BATCH) break;
  }

  console.log(`[rekey] Achtergrond klaar: ${totalRekeyed} extra berichten verwerkt.`);
}

/**
 * Decrypt + encrypt voor nieuw lid + RPC-update voor een batch rijen.
 * Geeft het aantal succesvol verwerkte berichten terug.
 */
async function rekeyBatch(
  rows: MessageRow[],
  newUserId: string,
  myUserId: string,
  newMemberPubKey: Uint8Array,
  mySecretKey: Uint8Array
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    // Sla over als het nieuwe lid al een envelope heeft.
    if (row.recipient_payloads?.[newUserId]) continue;

    const myPayload = row.recipient_payloads?.[myUserId];
    const candidates = myPayload
      ? [myPayload]
      : Object.values(row.recipient_payloads ?? {});

    let plaintext: Uint8Array | null = null;
    for (const env of candidates) {
      const result = decryptFromSender(env, mySecretKey);
      if (result) { plaintext = result; break; }
    }

    if (!plaintext) continue; // Niet ontsleutelbaar, overslaan.

    const newPayload = encryptForRecipient(plaintext, newMemberPubKey);

    const { error } = await supabase.rpc("add_recipient_payload", {
      p_message_id: row.id,
      p_user_id: newUserId,
      p_payload: newPayload,
    });

    if (error) {
      console.warn("[rekey] RPC mislukt voor bericht", row.id, error.message);
    } else {
      count++;
    }
  }
  return count;
}
