import { base64ToBytes, bytesToBase64 } from "./base64";
import {
  generateAndStoreIdentity,
  loadIdentity,
  wipeIdentity,
  type IdentityKeyPair,
} from "./keys";
import { supabase } from "../supabase/client";

/**
 * Status check tussen het toestel z'n private key en de profile pubkey
 * in Supabase. Een mismatch betekent dat E2E-decryptie zal falen — meestal
 * komt dit van een logout-zonder-logback elders, of cache-wipe.
 */
export type KeySyncStatus =
  | { kind: "ok"; pubkey: string }
  | { kind: "no-device-keys" }
  | { kind: "no-profile" }
  | { kind: "mismatch"; devicePubkey: string; profilePubkey: string };

export async function checkKeySync(userId: string): Promise<KeySyncStatus> {
  const identity = await loadIdentity();
  if (!identity) return { kind: "no-device-keys" };

  const devicePub = bytesToBase64(identity.publicKey);
  const { data, error } = await supabase
    .from("profiles")
    .select("identity_pubkey")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { kind: "no-profile" };

  if (data.identity_pubkey !== devicePub) {
    return {
      kind: "mismatch",
      devicePubkey: devicePub,
      profilePubkey: data.identity_pubkey as string,
    };
  }
  return { kind: "ok", pubkey: devicePub };
}

/**
 * Forceer dat profile.identity_pubkey gelijk is aan device public key.
 * Niet-destructief: geen wipe van keys. Lost mismatches op waar profile
 * achterloopt op device.
 */
export async function syncDeviceKeyToProfile(userId: string): Promise<void> {
  const identity = await loadIdentity();
  if (!identity) throw new Error("Geen device-keys om te syncen.");
  const pub = bytesToBase64(identity.publicKey);
  const { error } = await supabase
    .from("profiles")
    .update({ identity_pubkey: pub })
    .eq("id", userId);
  if (error) throw error;
}

/**
 * Volledige device-reset: wipe lokale keys, genereer nieuwe, publiceer
 * de nieuwe pubkey naar je profile. Signal-stijl: oude berichten worden
 * onleesbaar omdat de oude private key weg is.
 */
export async function resetDeviceIdentity(userId: string): Promise<IdentityKeyPair> {
  await wipeIdentity();
  const fresh = await generateAndStoreIdentity();
  const { error } = await supabase
    .from("profiles")
    .update({ identity_pubkey: bytesToBase64(fresh.publicKey) })
    .eq("id", userId);
  if (error) throw error;
  return fresh;
}
