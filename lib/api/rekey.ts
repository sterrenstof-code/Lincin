/**
 * Je eigen berichten delen met wie ze nog mist (0095).
 *
 * Een nieuw groepslid heeft geen kopie van wat er vóór hem gezegd werd, en
 * een bericht dat vlak na een ledenwissel vertrok (de ledenlijst wordt een
 * minuut onthouden) mist soms iemand. Vroeger vulde de toevoeger alles aan,
 * ook andermans berichten — en kon zo een nieuwkomer een aangepaste versie
 * geven onder andermans naam. Nu deelt ieder alleen zijn eigen berichten:
 * de database geeft aan wie wat mist (`my_messages_missing_payloads`), en
 * alleen de afzender mag een kopie toevoegen (`add_recipient_payload`).
 *
 * Draait bij het opstarten (alle gesprekken), bij het openen van een
 * gesprek, en meteen na het toevoegen van een lid. Fouten worden gelogd en
 * nooit opgegooid: dit mag de app niet tegenhouden.
 */

import { base64ToBytes } from "../crypto/base64";
import { decryptFromSender, encryptForRecipient } from "../crypto/encrypt";
import { loadIdentity } from "../crypto/keys";
import { supabase } from "../supabase/client";
import { getProfiles } from "./profiles";

const BATCH = 200;
const MAX_ROUNDS = 10;

const running = new Map<string, Promise<void>>();

/** Deel je berichten (in één gesprek, of in alle) met leden die ze missen. */
export function shareMyMessagesWithMembers(myUserId: string, chatId?: string): Promise<void> {
  const key = chatId ?? "*";
  const busy = running.get(key);
  if (busy) return busy;
  const job = run(myUserId, chatId)
    .catch((err) => console.warn("[rekey]", err?.message ?? err))
    .finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

async function run(myUserId: string, chatId?: string): Promise<void> {
  const identity = await loadIdentity();
  if (!identity) return;
  const pubkeys = new Map<string, Uint8Array | null>();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.rpc("my_messages_missing_payloads", {
      p_chat_id: chatId ?? null,
      p_limit: BATCH,
    });
    if (error) throw error;
    const rows = (data ?? []) as { message_id: string; chat_id: string; missing: string[] }[];
    if (rows.length === 0) return;

    const unknown = Array.from(new Set(rows.flatMap((r) => r.missing))).filter((id) => !pubkeys.has(id));
    if (unknown.length) {
      const profiles = await getProfiles(unknown);
      for (const id of unknown) {
        const pk = profiles.find((p) => p.id === id)?.identity_pubkey;
        pubkeys.set(id, pk ? base64ToBytes(pk) : null);
      }
    }

    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("id, recipient_payloads")
      .in("id", rows.map((r) => r.message_id));
    if (msgErr) throw msgErr;
    const byId = new Map((msgs ?? []).map((m) => [m.id, m.recipient_payloads as Record<string, unknown>]));

    let added = 0;
    for (const row of rows) {
      const mine = byId.get(row.message_id)?.[myUserId];
      const plaintext = mine ? decryptFromSender(mine as never, identity.secretKey) : null;
      if (!plaintext) continue; // van een oude sleutel: niet meer te delen
      for (const userId of row.missing) {
        const pk = pubkeys.get(userId);
        if (!pk) continue;
        const { error: addErr } = await supabase.rpc("add_recipient_payload", {
          p_message_id: row.message_id,
          p_user_id: userId,
          p_payload: encryptForRecipient(plaintext, pk) as never,
        });
        if (!addErr) added++;
      }
    }
    // Niets meer te doen dat lukt (geen sleutel, oude berichten): stoppen.
    if (added === 0 || rows.length < BATCH) return;
  }
}
