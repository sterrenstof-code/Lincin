import { generateKeyPair, sharedKey } from "@stablelib/x25519";

import { base64ToBytes, bytesToBase64 } from "./base64";
import { initCryptoRandom } from "./random";
import { secureStorage } from "./storage";

const IDENTITY_PRIVATE_KEY = "identity_private_key_v1";
const IDENTITY_PUBLIC_KEY = "identity_public_key_v1";
const DEVICE_ID_KEY = "device_id_v1";

export type IdentityKeyPair = {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
};

export async function generateAndStoreIdentity(): Promise<IdentityKeyPair> {
  initCryptoRandom();
  const kp = generateKeyPair();
  await secureStorage.setItem(IDENTITY_PRIVATE_KEY, bytesToBase64(kp.secretKey));
  await secureStorage.setItem(IDENTITY_PUBLIC_KEY, bytesToBase64(kp.publicKey));
  return kp;
}

export async function loadIdentity(): Promise<IdentityKeyPair | null> {
  const priv = await secureStorage.getItem(IDENTITY_PRIVATE_KEY);
  const pub = await secureStorage.getItem(IDENTITY_PUBLIC_KEY);
  if (!priv || !pub) return null;
  return {
    publicKey: base64ToBytes(pub),
    secretKey: base64ToBytes(priv),
  };
}

export async function wipeIdentity(): Promise<void> {
  await secureStorage.removeItem(IDENTITY_PRIVATE_KEY);
  await secureStorage.removeItem(IDENTITY_PUBLIC_KEY);
  // We bewaren device_id zodat deze browser dezelfde identity-slot houdt
  // wanneer iemand later opnieuw reset (geen wildgroei van losse devices).
}

export function deriveSharedSecret(
  ourSecret: Uint8Array,
  theirPublic: Uint8Array
): Uint8Array {
  return sharedKey(ourSecret, theirPublic);
}

/**
 * Leid de publieke sleutel af uit een bestaande private sleutel.
 * Gebruikt door de transfer-module na sleutelherstel.
 * generateKeyPair(seed) klampt de scalar en berekent het basispunt-product.
 * Dubbel klampen is idempotent, dus veilig voor al-geklampte keys.
 */
export function derivePublicFromPrivate(secretKey: Uint8Array): Uint8Array {
  return generateKeyPair(secretKey).publicKey;
}

// ---------- device id ----------

/**
 * Stabiele identifier voor deze browser/toestel. Wordt één keer gegenereerd
 * en bewaard in secureStorage. Wordt gebruikt als sleutel in
 * `recipient_payloads` en als primary key in `profile_devices`.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await secureStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = generateDeviceId();
  await secureStorage.setItem(DEVICE_ID_KEY, fresh);
  return fresh;
}

export async function getDeviceId(): Promise<string | null> {
  return secureStorage.getItem(DEVICE_ID_KEY);
}

export async function wipeDeviceId(): Promise<void> {
  await secureStorage.removeItem(DEVICE_ID_KEY);
}

function generateDeviceId(): string {
  if (typeof (globalThis.crypto as any)?.randomUUID === "function") {
    return (globalThis.crypto as any).randomUUID();
  }
  const bytes = new Uint8Array(16);
  (globalThis.crypto as any).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
    "-" + hex.slice(16, 20) + "-" + hex.slice(20)
  );
}
