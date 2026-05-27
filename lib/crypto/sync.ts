import { bytesToBase64, base64ToBytes } from "./base64";
import {
  generateAndStoreIdentity,
  loadIdentity,
  storeIdentity,
  wipeIdentity,
  type IdentityKeyPair,
} from "./keys";
import { supabase } from "../supabase/client";

/**
 * Status van de account-sleutels voor de huidige sessie.
 *
 * Account-sleutel model: één keypair per account, opgeslagen in
 * `profiles.identity_privkey`. Elk apparaat haalt de sleutel op bij
 * het inloggen via bootstrap — geen per-device complexity meer.
 */
export type KeySyncStatus =
  | { kind: "ok"; pubkey: string }
  | { kind: "no-keys" }
  | { kind: "no-profile" };

/**
 * Controleer of dit toestel werkende encryptie-sleutels heeft.
 * Probeert lokaal te laden; als die er niet zijn, kijkt het op de server.
 */
export async function checkKeySync(userId: string): Promise<KeySyncStatus> {
  // Probeer lokale sleutels.
  const identity = await loadIdentity();
  if (identity) {
    return { kind: "ok", pubkey: bytesToBase64(identity.publicKey) };
  }

  // Geen lokale sleutels — kijk op de server.
  const { data, error } = await supabase
    .from("profiles")
    .select("identity_pubkey, identity_privkey")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kind: "no-profile" };
  if (!data.identity_privkey) return { kind: "no-keys" };

  // Herstel van server.
  await storeIdentity({
    secretKey: base64ToBytes(data.identity_privkey),
    publicKey: base64ToBytes(data.identity_pubkey),
  });
  return { kind: "ok", pubkey: data.identity_pubkey };
}

/**
 * Herstel of herregistreer de account-sleutels.
 * Haalt de sleutel van de server op als aanwezig; genereert anders een
 * nieuwe en slaat die op in zowel SecureStore als profiles.
 */
export async function resyncDevice(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .select("identity_pubkey, identity_privkey")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  if (data?.identity_privkey) {
    // Herstel van server.
    await storeIdentity({
      secretKey: base64ToBytes(data.identity_privkey),
      publicKey: base64ToBytes(data.identity_pubkey),
    });
    return;
  }

  // Geen sleutels op server — genereer nieuw.
  const fresh = await generateAndStoreIdentity();
  const pubB64 = bytesToBase64(fresh.publicKey);
  const privB64 = bytesToBase64(fresh.secretKey);
  await supabase
    .from("profiles")
    .update({ identity_pubkey: pubB64, identity_privkey: privB64 })
    .eq("id", userId);
}

/**
 * Reset de account-sleutels: wis lokaal, genereer nieuw, sla op in server.
 * Gevolg: alle bestaande berichten zijn onleesbaar (nieuwe sleutel kan ze
 * niet ontsleutelen). Gebruik alleen als de gebruiker expliciet vraagt om
 * een volledige reset.
 */
export async function resetDeviceIdentity(userId: string): Promise<IdentityKeyPair> {
  await wipeIdentity();
  const fresh = await generateAndStoreIdentity();
  const pubB64 = bytesToBase64(fresh.publicKey);
  const privB64 = bytesToBase64(fresh.secretKey);

  const { error } = await supabase
    .from("profiles")
    .update({ identity_pubkey: pubB64, identity_privkey: privB64 })
    .eq("id", userId);
  if (error) {
    console.warn("[resetDeviceIdentity] profiles update error:", error.message);
  }

  return fresh;
}
