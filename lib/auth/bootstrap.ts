import { bytesToBase64, base64ToBytes } from "../crypto/base64";
import {
  generateAndStoreIdentity,
  loadIdentity,
  storeIdentity,
} from "../crypto/keys";
import { supabase } from "../supabase/client";

/**
 * Wordt aangeroepen na succesvolle login. Zorgt voor:
 *   1. Identity keypair beschikbaar op dit toestel.
 *   2. Sleutels gesynchroniseerd met de server (profiles.identity_privkey).
 *
 * Account-sleutel model (per-account, niet per-device):
 *   - De privé-sleutel wordt samen met de publieke sleutel opgeslagen in
 *     `profiles`. Zo kan elk apparaat dat inlogt direct berichten lezen
 *     zonder QR-koppeling of extra stappen.
 *   - Trade-off: de sleutel staat op de Supabase server. Dat is prima voor
 *     een vrienden/familie-app — berichten zijn versleuteld voor andere
 *     gebruikers maar niet voor server-admins.
 *
 * Volgorde:
 *   A. Lokale sleutels aanwezig → zorg dat ze gesynchroniseerd zijn naar server.
 *   B. Geen lokale sleutels maar wel op server → herstel naar SecureStore.
 *   C. Nergens → genereer nieuw keypair, sla op lokaal én op server.
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
  // Haal de huidige profilesrij op (of null als nog niet aangemaakt).
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, identity_pubkey, identity_privkey")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr) throw selErr;

  // ── A. Lokale sleutels aanwezig ──────────────────────────────────────────
  const localIdentity = await loadIdentity();
  if (localIdentity) {
    const pubB64 = bytesToBase64(localIdentity.publicKey);
    const privB64 = bytesToBase64(localIdentity.secretKey);

    if (!existing) {
      // Nieuw account, lokale keys al aanwezig (zeldzaam edge-case).
      const username =
        args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
      await supabase.from("profiles").insert({
        id: args.userId,
        username,
        identity_pubkey: pubB64,
        identity_privkey: privB64,
      });
      return { username, pubkeyMismatch: false, isNewDevice: false, needsDeviceConfirm: false };
    }

    // Bestaand profiel — sync sleutels naar server als ze er nog niet staan
    // of als de lokale sleutel nieuwer is (bv. na resetDeviceIdentity).
    if (!existing.identity_privkey || existing.identity_pubkey !== pubB64) {
      await supabase
        .from("profiles")
        .update({ identity_pubkey: pubB64, identity_privkey: privB64 })
        .eq("id", args.userId);
    }

    return {
      username: existing.username,
      pubkeyMismatch: false,
      isNewDevice: false,
      needsDeviceConfirm: false,
    };
  }

  // ── B. Geen lokale sleutels — herstel van server ─────────────────────────
  if (existing?.identity_privkey && existing?.identity_pubkey) {
    const kp = {
      secretKey: base64ToBytes(existing.identity_privkey),
      publicKey: base64ToBytes(existing.identity_pubkey),
    };
    await storeIdentity(kp);
    return {
      username: existing.username,
      pubkeyMismatch: false,
      isNewDevice: true,
      needsDeviceConfirm: false,
    };
  }

  // ── C. Nergens — genereer nieuw keypair ──────────────────────────────────
  const fresh = await generateAndStoreIdentity();
  const pubB64 = bytesToBase64(fresh.publicKey);
  const privB64 = bytesToBase64(fresh.secretKey);

  if (!existing) {
    const username =
      args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
    await supabase.from("profiles").insert({
      id: args.userId,
      username,
      identity_pubkey: pubB64,
      identity_privkey: privB64,
    });
    return { username, pubkeyMismatch: false, isNewDevice: true, needsDeviceConfirm: false };
  }

  await supabase
    .from("profiles")
    .update({ identity_pubkey: pubB64, identity_privkey: privB64 })
    .eq("id", args.userId);

  return {
    username: existing.username,
    pubkeyMismatch: false,
    isNewDevice: true,
    needsDeviceConfirm: false,
  };
}
