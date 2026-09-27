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

/**
 * De sleutels, eenmaal gelezen, in het geheugen.
 *
 * `loadIdentity` liep bij élke pagina berichten en élk live binnenkomend
 * bericht opnieuw naar de opslag: twee keer Keychain op een telefoon, twee
 * keer een verse IndexedDB-verbinding op web. Dat is traag, en het is
 * steeds hetzelfde antwoord. Alleen een gevonden paar wordt onthouden —
 * "geen sleutels" kan een tel later al anders zijn (bootstrap, koppelen).
 * Wie schrijft, gaat via `storeIdentity` en werkt de cache mee bij.
 */
let cached: IdentityKeyPair | null = null;

export async function generateAndStoreIdentity(): Promise<IdentityKeyPair> {
  initCryptoRandom();
  const kp = generateKeyPair();
  await storeIdentity(kp);
  return kp;
}

export async function loadIdentity(): Promise<IdentityKeyPair | null> {
  if (cached) return cached;
  const [priv, pub] = await Promise.all([
    secureStorage.getItem(IDENTITY_PRIVATE_KEY),
    secureStorage.getItem(IDENTITY_PUBLIC_KEY),
  ]);
  if (!priv || !pub) return null;
  cached = {
    publicKey: base64ToBytes(pub),
    secretKey: base64ToBytes(priv),
  };
  return cached;
}

/**
 * Sla een bestaand keypair op in SecureStore (bijv. na herstel van server).
 */
export async function storeIdentity(kp: IdentityKeyPair): Promise<void> {
  cached = null;
  await secureStorage.setItem(IDENTITY_PRIVATE_KEY, bytesToBase64(kp.secretKey));
  await secureStorage.setItem(IDENTITY_PUBLIC_KEY, bytesToBase64(kp.publicKey));
  cached = { publicKey: kp.publicKey, secretKey: kp.secretKey };
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
