import * as ExpoCrypto from "expo-crypto";
import { randomBytes } from "@stablelib/random";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";

import { base64ToBytes, bytesToBase64 } from "./base64";
import { initCryptoRandom } from "./random";

/**
 * De herstelcode (veiligheidscontrole okt 2026).
 *
 * De server bewaarde je privésleutel leesbaar: wie bij de database kon (wij,
 * een lek, een back-up) las elk gesprek. Nu staat daar alleen nog de
 * sleutel versleuteld met een code die alleen jij hebt:
 *
 *   code   24 tekens Crockford-base32 = 120 bit toeval, in zessen van vier
 *   sleutel SHA-256("lincin-recovery-v1|" + userId + "|" + code)
 *   kopie  base64(nonce(24) || XChaCha20-Poly1305(sleutel, privkey, aad=userId))
 *
 * Met 120 bit toeval is een trage KDF niet nodig: raden is onbegonnen werk.
 * De userId zit erin zodat een kopie niet bij een ander account past.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_CHARS = 24;
const NONCE_BYTES = 24;

/** Een nieuwe code, zoals hij getoond wordt: `K7QM-3XRT-…`. */
export function generateRecoveryCode(): string {
  initCryptoRandom();
  const bytes = randomBytes(15);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return formatRecoveryCode(out);
}

/** Wat iemand typt: hoofdletters, zonder streepjes of spaties; O→0, I/L→1. */
export function normalizeRecoveryCode(raw: string): string | null {
  const s = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (s.length !== CODE_CHARS) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
}

export function formatRecoveryCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join("-");
}

async function wrapKey(code: string, userId: string): Promise<Uint8Array> {
  const digest = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    `lincin-recovery-v1|${userId}|${code}`,
    { encoding: ExpoCrypto.CryptoEncoding.BASE64 }
  );
  return base64ToBytes(digest);
}

export async function wrapPrivateKey(secretKey: Uint8Array, code: string, userId: string): Promise<string> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error("Ongeldige herstelcode.");
  initCryptoRandom();
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = new XChaCha20Poly1305(await wrapKey(normalized, userId)).seal(
    nonce,
    secretKey,
    new TextEncoder().encode(userId)
  );
  const combined = new Uint8Array(nonce.length + sealed.length);
  combined.set(nonce, 0);
  combined.set(sealed, nonce.length);
  return bytesToBase64(combined);
}

/** De privésleutel terug, of `null` als de code niet past. */
export async function unwrapPrivateKey(wrapped: string, code: string, userId: string): Promise<Uint8Array | null> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return null;
  const combined = base64ToBytes(wrapped);
  if (combined.length <= NONCE_BYTES) return null;
  return new XChaCha20Poly1305(await wrapKey(normalized, userId)).open(
    combined.slice(0, NONCE_BYTES),
    combined.slice(NONCE_BYTES),
    new TextEncoder().encode(userId)
  );
}
