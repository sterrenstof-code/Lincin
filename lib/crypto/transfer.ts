/**
 * QR-gebaseerde apparaatkoppeling — sleuteloverdracht tussen apparaten.
 *
 * Protocol:
 *   BRONTOESTEL (heeft keys)
 *     1. Genereer 32-byte transfer_secret.
 *     2. token = SHA-256(transfer_secret)  [server-lookup, onthult nooit het geheim]
 *     3. blob  = base64( nonce || XChaCha20Poly1305(key=secret, data=private_key) )
 *     4. Sla { user_id, token, blob, expires_at } op in key_transfers.
 *     5. Toon QR met:  lincin://device-receive?s=<base64(secret)>&u=<userId>
 *
 *   NIEUW TOESTEL (geen keys)
 *     1. Scan QR → haal s (secret) en u (userId) op.
 *     2. token = SHA-256(s)
 *     3. Haal blob op via token (RLS: enkel eigen user_id).
 *     4. Decrypt private_key uit blob.
 *     5. Sla private + public key op in SecureStore.
 *     6. Verwijder de transfer-record (eenmalig gebruik).
 */

import * as ExpoCrypto from "expo-crypto";
import { randomBytes } from "@stablelib/random";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";
import { base64ToBytes, bytesToBase64 } from "./base64";
import { initCryptoRandom } from "./random";
import { loadIdentity, derivePublicFromPrivate } from "./keys";
import { secureStorage } from "./storage";
import { supabase } from "../supabase/client";

const NONCE_BYTES = 24;
/** Sleutelnamen — gelijk aan die in keys.ts */
const PRIV_KEY = "identity_private_key_v1";
const PUB_KEY = "identity_public_key_v1";

export type TransferPackage = {
  /** URL voor QR-code én desktop-kopieerknop */
  url: string;
  /** base64(transfer_secret) — zit in QR */
  secret: string;
  expiresAt: Date;
};

/** SHA-256 van een base64-string; resultaat als base64. */
async function sha256B64(input: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: ExpoCrypto.CryptoEncoding.BASE64 }
  );
}

/**
 * Aanmaken op het brontoestel.
 * Gooit een error als er geen lokale identity-keys zijn.
 */
export async function createTransferPackage(
  userId: string
): Promise<TransferPackage> {
  initCryptoRandom();
  const identity = await loadIdentity();
  if (!identity) throw new Error("Geen identity-keys op dit apparaat.");

  const secret = randomBytes(32);
  const secretB64 = bytesToBase64(secret);
  const token = await sha256B64(secretB64);

  // Versleutel de private key
  const nonce = randomBytes(NONCE_BYTES);
  const aead = new XChaCha20Poly1305(secret);
  const ciphertext = aead.seal(nonce, identity.secretKey);

  // Nonce + ciphertext aaneengesloten opslaan
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);
  const blob = bytesToBase64(combined);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Verwijder eventueel lopende transfer (één per user tegelijk)
  await supabase.from("key_transfers").delete().eq("user_id", userId);

  const { error } = await supabase.from("key_transfers").insert({
    user_id: userId,
    token,
    blob,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  const url =
    `lincin://device-receive?s=${encodeURIComponent(secretB64)}&u=${userId}`;
  return { url, secret: secretB64, expiresAt };
}

/**
 * Verwerking op het nieuwe toestel.
 * Downloadt de encrypted blob, decrypteert hem en slaat de keys op.
 * Gooit een error bij verlopen of ongeldig pakket.
 */
export async function consumeTransferPackage(
  secretB64: string,
  userId: string
): Promise<void> {
  const secret = base64ToBytes(secretB64);
  const token = await sha256B64(secretB64);

  const { data, error } = await supabase
    .from("key_transfers")
    .select("blob, expires_at, user_id")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "QR-code ongeldig of verlopen. Genereer een nieuwe op je andere apparaat."
    );
  }
  if (data.user_id !== userId) {
    throw new Error(
      "Deze QR-code is voor een ander account. Log in met het juiste account."
    );
  }
  if (new Date(data.expires_at) < new Date()) {
    throw new Error(
      "QR-code is verlopen (> 10 min). Genereer een nieuwe op je andere apparaat."
    );
  }

  // Decrypteer
  const combined = base64ToBytes(data.blob);
  const nonce = combined.slice(0, NONCE_BYTES);
  const ciphertext = combined.slice(NONCE_BYTES);

  const aead = new XChaCha20Poly1305(secret);
  const privateKeyBytes = aead.open(nonce, ciphertext);
  if (!privateKeyBytes) {
    throw new Error(
      "Decryptie mislukt. Controleer of je de juiste QR-code scant."
    );
  }

  // Leid publieke sleutel af van de private sleutel
  const publicKeyBytes = derivePublicFromPrivate(privateKeyBytes);

  // Sla op in secure storage (zelfde sleutelnamen als keys.ts)
  await secureStorage.setItem(PRIV_KEY, bytesToBase64(privateKeyBytes));
  await secureStorage.setItem(PUB_KEY, bytesToBase64(publicKeyBytes));

  // Eenmalig gebruik: verwijder de record
  await supabase.from("key_transfers").delete().eq("token", token);
}

/** Annuleer een openstaand transfer-pakket (bij afsluiten scherm). */
export async function cancelTransferPackage(userId: string): Promise<void> {
  await supabase.from("key_transfers").delete().eq("user_id", userId);
}
