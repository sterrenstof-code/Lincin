import { Platform } from "react-native";

/**
 * Bytes naar Supabase Storage, en terug.
 *
 * Op web is een Blob het handigst. React Native kan geen Blob maken uit een
 * Uint8Array ("Creating blobs from 'ArrayBuffer' … are not supported") en
 * zijn Blob kent geen `arrayBuffer()`. Daar gaat er een ArrayBuffer heen,
 * wat supabase-js ook aanneemt, en komt er een terug via FileReader.
 */
export function uploadBody(bytes: Uint8Array, type: string): Blob | ArrayBuffer {
  if (Platform.OS === "web") return new Blob([bytes as BlobPart], { type });
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  if (Platform.OS === "web" || typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("Lezen lukte niet."));
    reader.readAsArrayBuffer(blob);
  });
}
