import { bytesToBase64 } from "./base64";
import {
  generateAndStoreIdentity,
  getDeviceId,
  getOrCreateDeviceId,
  loadIdentity,
  wipeDeviceId,
  wipeIdentity,
  type IdentityKeyPair,
} from "./keys";
import { registerOrUpdateDevice, removeDevice, guessDeviceLabel } from "../api/devices";
import { supabase } from "../supabase/client";

/**
 * Status van de device-registratie voor de huidige sessie.
 *
 * Multi-device model: elk toestel registreert zich in `profile_devices`
 * met zijn eigen keypair. `checkKeySync` controleert of dit toestel
 * nog steeds actief geregistreerd is.
 */
export type KeySyncStatus =
  | { kind: "ok"; pubkey: string }
  | { kind: "no-device-keys" }
  | { kind: "not-registered" }
  | { kind: "no-profile" };

/**
 * Controleer of dit toestel geregistreerd staat in `profile_devices`.
 * Vervangt de vroegere single-device `profiles.identity_pubkey` check.
 */
export async function checkKeySync(userId: string): Promise<KeySyncStatus> {
  const identity = await loadIdentity();
  if (!identity) return { kind: "no-device-keys" };

  const deviceId = await getDeviceId();
  if (!deviceId) return { kind: "no-device-keys" };

  const pubB64 = bytesToBase64(identity.publicKey);

  const { data, error } = await supabase
    .from("profile_devices")
    .select("identity_pubkey")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (error) throw error;

  if (!data) return { kind: "not-registered" };

  return { kind: "ok", pubkey: pubB64 };
}

/**
 * Registreer (of herregistreer) dit toestel in `profile_devices`.
 * Gebruik dit wanneer het toestel `not-registered` teruggeeft, bv. na
 * een server-reset of als de device-rij verwijderd is.
 */
export async function resyncDevice(userId: string): Promise<void> {
  const identity = await loadIdentity();
  if (!identity) throw new Error("Geen device-keys om te syncen.");
  const deviceId = await getOrCreateDeviceId();
  const pubB64 = bytesToBase64(identity.publicKey);

  await registerOrUpdateDevice({
    userId,
    deviceId,
    identityPubkey: pubB64,
    label: guessDeviceLabel(),
  });

  // Houd profiles.identity_pubkey bij voor legacy-decryptie van oude berichten.
  await supabase
    .from("profiles")
    .update({ identity_pubkey: pubB64 })
    .eq("id", userId);
}

/**
 * Volledig device-reset: wipe lokale keys en device-id, genereer nieuwe,
 * verwijder oud device uit profile_devices, registreer nieuwe.
 *
 * Gevolg: berichten die encrypted waren voor de oude key zijn onleesbaar
 * op dit toestel (Signal-stijl). Andere toestellen met hun eigen key
 * worden niet geraakt — zij kunnen nieuwe berichten nog steeds lezen.
 */
export async function resetDeviceIdentity(userId: string): Promise<IdentityKeyPair> {
  const oldDeviceId = await getDeviceId();

  // Wipe bestaande keys en device-id.
  await wipeIdentity();
  await wipeDeviceId();

  // Genereer nieuwe keys en een nieuw device-id.
  const fresh = await generateAndStoreIdentity();
  const newDeviceId = await getOrCreateDeviceId();
  const pubB64 = bytesToBase64(fresh.publicKey);

  // Verwijder het oude device-record zodat het geen dode entry achterlaat.
  if (oldDeviceId) {
    await removeDevice(userId, oldDeviceId).catch(() => {});
  }

  // Registreer het nieuwe device.
  await registerOrUpdateDevice({
    userId,
    deviceId: newDeviceId,
    identityPubkey: pubB64,
    label: guessDeviceLabel(),
  });

  // Update profiles.identity_pubkey voor legacy-compat.
  const { error } = await supabase
    .from("profiles")
    .update({ identity_pubkey: pubB64 })
    .eq("id", userId);
  if (error) {
    console.warn("[resetDeviceIdentity] profiles update error:", error.message);
  }

  return fresh;
}
