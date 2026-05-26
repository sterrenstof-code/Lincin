import { randomBytes } from "@stablelib/random";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

import { base64ToBytes, bytesToBase64 } from "./base64";
import { initCryptoRandom } from "./random";

/**
 * Symmetrische file-encryptie voor chat-attachments.
 *
 * Werkflow zender:
 *   1. randomKey (32 bytes) + randomNonce (24 bytes)
 *   2. encrypt(bytes, key, nonce) -> ciphertext
 *   3. upload ciphertext naar Storage path
 *   4. embed { path, key, nonce, mime_type, size } in de versleutelde
 *      message-envelope (per ontvanger)
 *
 * Ontvanger:
 *   1. decrypt envelope -> krijgt path + key + nonce
 *   2. download bytes vanaf Storage
 *   3. decrypt(bytes, key, nonce) -> plaintext bytes
 *   4. converteer naar uri voor display (blob URL op web, file:// op native)
 */

const NONCE_BYTES = 24;
const KEY_BYTES = 32;

export type EncryptedFile = {
  ciphertext: Uint8Array;
  key: Uint8Array;
  nonce: Uint8Array;
};

export function encryptFileBytes(plaintext: Uint8Array): EncryptedFile {
  initCryptoRandom();
  const key = randomBytes(KEY_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const aead = new XChaCha20Poly1305(key);
  const ciphertext = aead.seal(nonce, plaintext);
  return { ciphertext, key, nonce };
}

export function decryptFileBytes(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array | null {
  const aead = new XChaCha20Poly1305(key);
  return aead.open(nonce, ciphertext);
}

// ---------- URI helpers ----------

/**
 * Lees een lokale URI (van image-picker of document-picker) als Uint8Array.
 * Werkt op web (blob: of data: URIs) en native (file://).
 */
export async function uriToBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  // Native: lees als base64 en decodeer
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

/**
 * Schrijf bytes naar een tijdelijke URI die door <Image>, <Video>, etc.
 * gebruikt kan worden. Op web -> blob: URL. Op native -> file:// in cache.
 */
export async function bytesToDisplayUri(
  bytes: Uint8Array,
  mimeType: string,
  filename: string
): Promise<string> {
  if (Platform.OS === "web") {
    const blob = new Blob([bytes as any], { type: mimeType });
    return URL.createObjectURL(blob);
  }
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

/** MIME-type → eenvoudige attachment-type categorie. */
export function attachmentTypeFor(mime: string): "image" | "video" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "file";
}
