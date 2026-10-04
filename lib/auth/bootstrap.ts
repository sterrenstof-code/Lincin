import { bytesToBase64, base64ToBytes } from "../crypto/base64";
import {
  clearIdentity,
  generateAndStoreIdentity,
  getIdentityOwner,
  loadIdentity,
  setIdentityOwner,
  storeIdentity,
} from "../crypto/keys";
import { supabase } from "../supabase/client";

/**
 * Wordt aangeroepen na succesvolle login. Zorgt voor:
 *   1. Een sleutelpaar op dit toestel dat bij dít account hoort.
 *   2. Een kopie van de privésleutel op de server (`private_keys`, 0090:
 *      alleen jij leest je eigen rij), zodat een nieuw toestel hem terugvindt.
 *
 * De regels (veiligheidscontrole okt 2026):
 *   - Sleutels op het toestel horen bij één account (`identity_owner_v1`).
 *     Sleutels van een ander account worden nooit gebruikt of geüpload —
 *     anders nam wie op hetzelfde toestel inlogde (of je liet inloggen in
 *     zijn account) jouw sleutel mee naar zijn profiel.
 *   - Staat er op de server al een sleutel en verschilt die van de lokale,
 *     dan wint de server; de lokale overschrijft hem niet meer.
 */
export async function bootstrapProfile(args: {
  userId: string;
  email: string;
  preferredUsername?: string;
  /** @deprecated Genegeerd */
  confirmOverwrite?: boolean;
}): Promise<{
  username: string | null;
  pubkeyMismatch: boolean;
  isNewDevice: boolean;
  needsDeviceConfirm: boolean;
}> {
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, identity_pubkey")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr) throw selErr;

  let storedPrivkey: string | null = null;
  if (existing) {
    const { data: row } = await supabase.from("private_keys").select("privkey").eq("user_id", args.userId).maybeSingle();
    storedPrivkey = row?.privkey ?? null;
  }

  async function savePrivkey(privB64: string) {
    await supabase
      .from("private_keys")
      .upsert({ user_id: args.userId, privkey: privB64, updated_at: new Date().toISOString() })
      .then(() => {}, () => {});
  }

  // Lokale sleutels: alleen als ze van dit account zijn (of van vóór de
  // eigenaarsregel én ze passen bij wat de server van dit account kent).
  let local = await loadIdentity();
  const owner = await getIdentityOwner();
  if (local && owner && owner !== args.userId) {
    await clearIdentity();
    local = null;
  }
  const localPub = local ? bytesToBase64(local.publicKey) : null;
  const ownedHere = !!local && owner === args.userId;

  // ── Nieuw account ────────────────────────────────────────────────────────
  if (!existing) {
    // Nooit sleutels hergebruiken die niet aantoonbaar van dit account zijn.
    const kp = ownedHere && local ? local : await generateAndStoreIdentity();
    await setIdentityOwner(args.userId);
    const username = args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
    const { error: insErr } = await supabase.from("profiles").insert({
      id: args.userId,
      username,
      identity_pubkey: bytesToBase64(kp.publicKey),
    });
    if (insErr) throw insErr;
    await savePrivkey(bytesToBase64(kp.secretKey));
    return { username, pubkeyMismatch: false, isNewDevice: true, needsDeviceConfirm: false };
  }

  const serverPub = existing.identity_pubkey || null;

  // ── Lokaal en server zijn dezelfde sleutel ───────────────────────────────
  if (local && serverPub && localPub === serverPub) {
    await setIdentityOwner(args.userId);
    if (!storedPrivkey) await savePrivkey(bytesToBase64(local.secretKey));
    return { username: existing.username, pubkeyMismatch: false, isNewDevice: false, needsDeviceConfirm: false };
  }

  // ── De server heeft de sleutel van dit account: die wint ─────────────────
  if (storedPrivkey && serverPub) {
    await storeIdentity({ secretKey: base64ToBytes(storedPrivkey), publicKey: base64ToBytes(serverPub) });
    await setIdentityOwner(args.userId);
    return { username: existing.username, pubkeyMismatch: false, isNewDevice: true, needsDeviceConfirm: false };
  }

  // ── Server kent nog geen sleutel: een eigen lokale mag erheen ────────────
  if (local && (ownedHere || !serverPub)) {
    await setIdentityOwner(args.userId);
    await supabase.from("profiles").update({ identity_pubkey: localPub! }).eq("id", args.userId);
    await savePrivkey(bytesToBase64(local.secretKey));
    return { username: existing.username, pubkeyMismatch: false, isNewDevice: false, needsDeviceConfirm: false };
  }

  // ── Nergens een bruikbare sleutel: een nieuwe ────────────────────────────
  if (local) await clearIdentity();
  const fresh = await generateAndStoreIdentity();
  await setIdentityOwner(args.userId);
  await supabase.from("profiles").update({ identity_pubkey: bytesToBase64(fresh.publicKey) }).eq("id", args.userId);
  await savePrivkey(bytesToBase64(fresh.secretKey));
  return { username: existing.username, pubkeyMismatch: false, isNewDevice: true, needsDeviceConfirm: false };
}
