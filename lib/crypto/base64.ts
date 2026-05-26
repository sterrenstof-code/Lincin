/**
 * Tiny base64 helpers that work in both Hermes (React Native) and browsers.
 * We avoid Node's Buffer so the same code runs everywhere.
 */

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i: number;
  for (i = 0; i + 2 < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64_CHARS[a >> 2];
    out += B64_CHARS[((a & 0x03) << 4) | (b >> 4)];
    out += B64_CHARS[((b & 0x0f) << 2) | (c >> 6)];
    out += B64_CHARS[c & 0x3f];
  }
  if (i < bytes.length) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    out += B64_CHARS[a >> 2];
    out += B64_CHARS[((a & 0x03) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64_CHARS[(b & 0x0f) << 2] : "=";
    out += "=";
  }
  return out;
}

/**
 * Padding-aware base64 decode. **Critical**: padding "=" chars moeten als
 * waarde 0 in de bitstroom geïnterpreteerd worden, niet als index -1
 * (wat .indexOf("=") teruggeeft). Eerdere implementatie had die bug en
 * corrupteerde de laatste 1-2 bytes van elk gepaddeerd input — voor X25519
 * keys (44 chars, 1 "=") werden de laatste 2 bytes 0xFF, waardoor
 * encrypt/decrypt nooit kon werken cross-session.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const pad = (clean.match(/=+$/) || [""])[0].length;
  const len = (clean.length / 4) * 3 - pad;
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = b64Value(clean[i]);
    const c1 = b64Value(clean[i + 1]);
    const c2 = b64Value(clean[i + 2]);
    const c3 = b64Value(clean[i + 3]);
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (p < len) out[p++] = (n >> 16) & 0xff;
    if (p < len) out[p++] = (n >> 8) & 0xff;
    if (p < len) out[p++] = n & 0xff;
  }
  return out;
}

function b64Value(c: string | undefined): number {
  if (!c || c === "=") return 0;
  const idx = B64_CHARS.indexOf(c);
  return idx < 0 ? 0 : idx;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function stringToBytes(s: string): Uint8Array {
  return textEncoder.encode(s);
}

export function bytesToString(b: Uint8Array): string {
  return textDecoder.decode(b);
}
