import { randomBytes } from "@stablelib/random";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";
/**
 * `expo-file-system/legacy` en niet `expo-file-system`.
 *
 * Sinds SDK 54 draagt de hoofdingang de nieuwe File/Directory-API. De
 * klassieke functies staan er nog wel in als *deprecated stubs*, maar die
 * **gooien bij aanroep** ("This method will throw in runtime") en
 * `cacheDirectory`/`EncodingType` zijn er helemaal uit. Het typecheck-lawaai
 * verborg dat: dit bestand was in de praktijk stuk — versleutelde bijlagen
 * konden niet gelezen of weggeschreven worden.
 *
 * De legacy-ingang is dezelfde implementatie als vroeger en dus een
 * gedragsneutrale herstelling. Migreren naar `new File(...)` kan later.
 */
import * as FileSystem from "expo-file-system/legacy";
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

type EncryptedFile = {
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
export async function uriToBytes(uri: string): Promise<Uint8Array<ArrayBuffer>> {
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
    // Het type komt van de afzender. Een blob: URL draait op onze eigen
    // origin, dus een "bestand" als text/html of SVG kon bij openen script
    // uitvoeren met jouw sessie en sleutel. Alleen media krijgt zijn type.
    const blob = new Blob([bytes as any], { type: safeBlobType(mimeType) });
    return URL.createObjectURL(blob);
  }
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

const RENDERABLE = /^(image\/(jpeg|png|webp|gif|heic|heif|avif)|video\/(mp4|quicktime|webm|x-m4v)|audio\/(mpeg|mp4|aac|ogg|wav|webm|x-m4a))$/;

function safeBlobType(mime: string): string {
  const m = (mime ?? "").toLowerCase().split(";")[0].trim();
  return RENDERABLE.test(m) ? m : "application/octet-stream";
}

/**
 * Een bijlage bewaren op web: altijd als download, nooit door ernaar te
 * navigeren (dan zou de browser hem op onze origin kunnen tonen).
 */
export function downloadBlobUri(uri: string, filename: string): void {
  const a = document.createElement("a");
  a.href = uri;
  a.download = filename;
  a.rel = "noopener";
  a.click();
}

/** MIME-type → eenvoudige attachment-type categorie. */
export function attachmentTypeFor(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

/** Bij uitloggen: ontsleutelde bijlagen (`att-…`) niet op het toestel laten. */
export async function clearDecryptedAttachments(): Promise<void> {
  if (Platform.OS === "web" || !FileSystem.cacheDirectory) return;
  try {
    const names = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    await Promise.all(
      names
        .filter((n) => n.startsWith("att-"))
        .map((n) => FileSystem.deleteAsync(FileSystem.cacheDirectory + n, { idempotent: true }))
    );
  } catch {
    // de cache was al leeg of onleesbaar
  }
}
