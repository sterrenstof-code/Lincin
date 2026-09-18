import { generateKeyPair, generateKeyPairFromSeed, sharedKey } from "@stablelib/x25519";

import { base64ToBytes, bytesToBase64 } from "./base64";
import { initCryptoRandom } from "./random";
import { secureStorage } from "./storage";

const IDENTITY_PRIVATE_KEY = "identity_private_key_v1";
const IDENTITY_PUBLIC_KEY = "identity_public_key_v1";

type IdentityKeyPair = {
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

/**
 * Sla een bestaand keypair op in SecureStore (bijv. na herstel van server).
 */
export async function storeIdentity(kp: IdentityKeyPair): Promise<void> {
  await secureStorage.setItem(IDENTITY_PRIVATE_KEY, bytesToBase64(kp.secretKey));
  await secureStorage.setItem(IDENTITY_PUBLIC_KEY, bytesToBase64(kp.publicKey));
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
 *
 * `generateKeyPairFromSeed` klampt de scalar en berekent het
 * basispunt-product. Dubbel klampen is idempotent, dus veilig voor
 * al-geklampte sleutels.
 *
 * LET OP — dit was `generateKeyPair(secretKey)`, en dat is een andere
 * functie: die verwacht géén seed maar een `RandomSource` en roept er
 * `randomBytes()` op aan. Op een Uint8Array bestaat die methode niet, dus
 * elke aanroep gooide. Sleutelherstel op een tweede toestel
 * (`lib/crypto/transfer.ts`) kon daardoor niet werken.
 */
export function derivePublicFromPrivate(secretKey: Uint8Array): Uint8Array {
  return generateKeyPairFromSeed(secretKey).publicKey;
}
