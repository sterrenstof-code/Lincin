import { randomBytes } from "@stablelib/random";
import { generateKeyPair } from "@stablelib/x25519";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";

import {
  base64ToBytes,
  bytesToBase64,
  bytesToString,
  stringToBytes,
} from "./base64";
import { deriveSharedSecret } from "./keys";
import { initCryptoRandom } from "./random";

/**
 * Hybrid E2E encryption scheme used for the MVP.
 *
 * For each message and each recipient:
 *  1. Generate an ephemeral X25519 keypair (E_priv, E_pub).
 *  2. Compute shared secret = X25519(E_priv, recipient_identity_pub).
 *  3. Encrypt the plaintext with XChaCha20-Poly1305 using that shared secret
 *     as the key, and a fresh random 24-byte nonce.
 *  4. Send { ephemeral_pub, nonce, ciphertext } to the recipient.
 *
 * The recipient computes the same shared secret with
 *   X25519(their_identity_priv, ephemeral_pub) and decrypts.
 *
 * Properties:
 *  - True end-to-end: server only sees opaque ciphertext blobs.
 *  - No forward secrecy yet (compromise of identity key => past decryptable).
 *    We will layer Double Ratchet on top in phase 3.
 *  - Each recipient gets their own encrypted payload (works for groups).
 */

export type EncryptedPayload = {
  ephemeral_pub: string; // base64
  nonce: string; // base64 (24 bytes)
  ciphertext: string; // base64 (plaintext + 16-byte auth tag)
};

const NONCE_BYTES = 24;

export function encryptForRecipient(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array
): EncryptedPayload {
  initCryptoRandom();
  const ephemeral = generateKeyPair();
  const sharedSecret = deriveSharedSecret(ephemeral.secretKey, recipientPublicKey);
  const aead = new XChaCha20Poly1305(sharedSecret);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = aead.seal(nonce, plaintext);

  // Zero the ephemeral private key after use (best-effort in JS).
  ephemeral.secretKey.fill(0);
  sharedSecret.fill(0);

  return {
    ephemeral_pub: bytesToBase64(ephemeral.publicKey),
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export function decryptFromSender(
  payload: EncryptedPayload,
  ourSecretKey: Uint8Array
): Uint8Array | null {
  const ephemeralPub = base64ToBytes(payload.ephemeral_pub);
  const nonce = base64ToBytes(payload.nonce);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const sharedSecret = deriveSharedSecret(ourSecretKey, ephemeralPub);
  const aead = new XChaCha20Poly1305(sharedSecret);
  const plaintext = aead.open(nonce, ciphertext);
  sharedSecret.fill(0);
  return plaintext;
}

/** Convenience: encrypt a UTF-8 string for one recipient. */
export function encryptTextForRecipient(
  text: string,
  recipientPublicKey: Uint8Array
): EncryptedPayload {
  return encryptForRecipient(stringToBytes(text), recipientPublicKey);
}

/** Convenience: decrypt and return a UTF-8 string, or null if auth fails. */
export function decryptTextFromSender(
  payload: EncryptedPayload,
  ourSecretKey: Uint8Array
): string | null {
  const bytes = decryptFromSender(payload, ourSecretKey);
  return bytes ? bytesToString(bytes) : null;
}

/**
 * Encrypt one plaintext for many recipients in one call. Returns a map
 * keyed by recipient user-id that can be stored directly in the
 * `messages.recipient_payloads` jsonb column.
 */
export function encryptForRecipients(
  plaintext: Uint8Array,
  recipients: { userId: string; publicKey: Uint8Array }[]
): Record<string, EncryptedPayload> {
  const out: Record<string, EncryptedPayload> = {};
  for (const r of recipients) {
    out[r.userId] = encryptForRecipient(plaintext, r.publicKey);
  }
  return out;
}
