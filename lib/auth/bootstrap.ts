import { bytesToBase64, base64ToBytes } from "../crypto/base64";
import {
  clearIdentity,
  derivePublicFromPrivate,
  generateAndStoreIdentity,
  getIdentityOwner,
  loadIdentity,
  setIdentityOwner,
  storeIdentity,
} from "../crypto/keys";
import { unwrapPrivateKey, wrapPrivateKey } from "../crypto/recovery";
import { supabase } from "../supabase/client";

/**
 * Waar je sleutel staat na het inloggen:
 *   ready    sleutel op dit toestel, en een versleutelde kopie op de server
 *   backup   sleutel op dit toestel, maar nog geen kopie met herstelcode:
 *            toon de code (`saveRecoveryBackup`) voor je verder gaat
 *   restore  de server kent je sleutel, dit toestel niet: haal hem met een
 *            QR van een ander toestel of met je herstelcode
 *            (`restoreWithRecoveryCode`), of begin opnieuw (`startFresh`)
 */
export type KeyStatus =
  | { state: "ready" }
  | { state: "backup" }
  | { state: "restore"; hasBackup: boolean };

/**
 * Wordt aangeroepen na succesvolle login. Zorgt voor:
 *   1. Een sleutelpaar op dit toestel dat bij dít account hoort.
 *   2. Een kopie van de privésleutel op de server (`private_keys`), maar
 *      alleen versleuteld met je herstelcode (0094). Wat er nog leesbaar
 *      stond (`privkey`, van vóór 0094) wordt één keer gebruikt om de
 *      sleutel terug te zetten, en verdwijnt zodra je code bewaard is.
 *
 * De regels (veiligheidscontrole okt 2026):
 *   - Sleutels op het toestel horen bij één account (`identity_owner_v1`).
 *     Sleutels van een ander account worden nooit gebruikt of geüpload —
 *     anders nam wie op hetzelfde toestel inlogde (of je liet inloggen in
 *     zijn account) jouw sleutel mee naar zijn profiel.
 *   - Staat er op de server al een sleutel en verschilt die van de lokale,
 *     dan wint de server; de lokale overschrijft hem niet. Ook niet stil
 *     door een nieuwe: dan zou je oude berichten kwijt zijn.
 */
export async function bootstrapProfile(args: {
  userId: string;
  email: string;
  preferredUsername?: string;
}): Promise<KeyStatus> {
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, identity_pubkey")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr) throw selErr;

  let legacyPrivkey: string | null = null;
  let wrapped: string | null = null;
  if (existing) {
    const { data: row } = await supabase
      .from("private_keys")
      .select("privkey, wrapped")
      .eq("user_id", args.userId)
      .maybeSingle();
    legacyPrivkey = row?.privkey ?? null;
    wrapped = row?.wrapped ?? null;
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
    return { state: "backup" };
  }

  const serverPub = existing.identity_pubkey || null;

  // ── Lokaal en server zijn dezelfde sleutel ───────────────────────────────
  if (local && serverPub && localPub === serverPub) {
    await setIdentityOwner(args.userId);
    return wrapped ? { state: "ready" } : { state: "backup" };
  }

  // ── Nog een leesbare kopie van vóór 0094: die zet hem terug ──────────────
  if (legacyPrivkey && serverPub) {
    await storeIdentity({ secretKey: base64ToBytes(legacyPrivkey), publicKey: base64ToBytes(serverPub) });
    await setIdentityOwner(args.userId);
    return { state: "backup" };
  }

  // ── Server kent nog geen sleutel: een eigen lokale mag erheen ────────────
  if (local && !serverPub) {
    await setIdentityOwner(args.userId);
    await supabase.from("profiles").update({ identity_pubkey: localPub! }).eq("id", args.userId);
    return { state: "backup" };
  }

  // ── De server kent je sleutel, dit toestel niet ──────────────────────────
  if (serverPub) {
    if (local) await clearIdentity();
    return { state: "restore", hasBackup: !!wrapped };
  }

  // ── Nergens een sleutel: een nieuwe ──────────────────────────────────────
  if (local) await clearIdentity();
  const fresh = await generateAndStoreIdentity();
  await setIdentityOwner(args.userId);
  await supabase.from("profiles").update({ identity_pubkey: bytesToBase64(fresh.publicKey) }).eq("id", args.userId);
  return { state: "backup" };
}

/**
 * De sleutel van dit toestel versleuteld naar de server, met `code`. Wist
 * meteen een leesbare kopie van vóór 0094. Ook om een nieuwe code te maken
 * (de oude werkt daarna niet meer).
 */
export async function saveRecoveryBackup(userId: string, code: string): Promise<void> {
  const local = await loadIdentity();
  if (!local) throw new Error("Geen sleutel op dit toestel.");
  const wrappedKey = await wrapPrivateKey(local.secretKey, code, userId);
  const { error } = await supabase
    .from("private_keys")
    .upsert({ user_id: userId, wrapped: wrappedKey, privkey: null, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Je sleutel terug met je herstelcode. `false` als de code niet past. */
export async function restoreWithRecoveryCode(userId: string, code: string): Promise<boolean> {
  const [{ data: row, error }, { data: profile }] = await Promise.all([
    supabase.from("private_keys").select("wrapped").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("identity_pubkey").eq("id", userId).maybeSingle(),
  ]);
  if (error) throw error;
  if (!row?.wrapped) return false;
  const secretKey = await unwrapPrivateKey(row.wrapped, code, userId);
  if (!secretKey) return false;
  const publicKey = derivePublicFromPrivate(secretKey);
  // Past hij niet bij wat je vrienden van je kennen, dan is het een oude kopie.
  if (profile?.identity_pubkey && profile.identity_pubkey !== bytesToBase64(publicKey)) return false;
  await storeIdentity({ secretKey, publicKey });
  await setIdentityOwner(userId);
  return true;
}

/**
 * Opnieuw beginnen zonder je oude sleutel: berichten van vroeger blijven
 * onleesbaar, nieuwe werken weer. Alleen na een bevestiging in de app.
 */
export async function startFresh(userId: string): Promise<void> {
  await clearIdentity();
  const fresh = await generateAndStoreIdentity();
  await setIdentityOwner(userId);
  const { error } = await supabase
    .from("profiles")
    .update({ identity_pubkey: bytesToBase64(fresh.publicKey) })
    .eq("id", userId);
  if (error) throw error;
  await supabase.from("private_keys").delete().eq("user_id", userId);
}
