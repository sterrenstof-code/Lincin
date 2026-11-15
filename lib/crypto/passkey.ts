import * as ExpoCrypto from "expo-crypto";
import { randomBytes } from "@stablelib/random";
import { Platform } from "react-native";

import { base64ToBytes, bytesToBase64 } from "./base64";
import { initCryptoRandom } from "./random";
import { openSecretKey, sealSecretKey } from "./recovery";

/**
 * Je sleutel terug met een passkey (0101, nov 2026).
 *
 * Een passkey staat in Google Wachtwoordbeheer of de iCloud-sleutelhanger,
 * niet in de opslag van deze site. Met de PRF-uitbreiding van WebAuthn
 * geeft hij, na vingerafdruk of gezicht, voor een vaste invoer altijd
 * dezelfde 32 geheime bytes terug. Daarmee versleutelen we je privésleutel:
 *
 *   prf     PRF(passkey, "lincin-sleutel-passkey-v1")   (alleen in de passkey)
 *   sleutel SHA-256("lincin-passkey-v1|" + userId + "|" + base64(prf))
 *   kopie   zoals bij de herstelcode (`sealSecretKey`), in `key_passkeys`
 *
 * De server krijgt `prf` nooit te zien. We gebruiken de passkey niet om in
 * te loggen; de `challenge` hoeft dus door niemand gecontroleerd te worden.
 *
 * Alleen op web. In de app voor iOS en Android is hiervoor een eigen module
 * nodig; daar blijven de herstelcode en de QR van een ander toestel.
 */

const SALT = new TextEncoder().encode("lincin-sleutel-passkey-v1");

type Prf = { enabled?: boolean; results?: { first?: ArrayBuffer } };

/** Kan deze browser het? `null`: weet hij niet te zeggen, dan proberen we het. */
export async function passkeySupported(): Promise<boolean | null> {
  if (Platform.OS !== "web" || typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
  const pkc = window.PublicKeyCredential as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> };
  try {
    const caps = await pkc.getClientCapabilities?.();
    if (caps && "extension:prf" in caps) return !!caps["extension:prf"];
  } catch {
    // Oudere browsers kennen de vraag niet.
  }
  return null;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return bytesToBase64(new Uint8Array(bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(b + "=".repeat((4 - (b.length % 4)) % 4));
}

function challenge(): Uint8Array {
  initCryptoRandom();
  return randomBytes(32);
}

async function keyFromPrf(prf: ArrayBuffer, userId: string): Promise<Uint8Array> {
  const digest = await ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    `lincin-passkey-v1|${userId}|${bytesToBase64(new Uint8Array(prf))}`,
    { encoding: ExpoCrypto.CryptoEncoding.BASE64 }
  );
  return base64ToBytes(digest);
}

/** Wat de passkey teruggaf, of `null` als hij geen PRF kent. */
function prfOf(cred: PublicKeyCredential): ArrayBuffer | null {
  const ext = cred.getClientExtensionResults() as { prf?: Prf };
  return ext.prf?.results?.first ?? null;
}

/** Een passkey ophalen (vingerafdruk), beperkt tot `ids` als die er zijn. */
async function ask(ids: string[]): Promise<{ id: string; prf: ArrayBuffer | null }> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge() as BufferSource,
      userVerification: "required",
      allowCredentials: ids.map((id) => ({ type: "public-key" as const, id: fromB64url(id) as BufferSource })),
      extensions: { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new PasskeyError("geannuleerd");
  return { id: b64url(cred.rawId), prf: prfOf(cred) };
}

export class PasskeyError extends Error {
  constructor(public readonly reason: "geannuleerd" | "geen-prf" | "onbekend") {
    super(reason);
  }
}

/** Gooi `geannuleerd` als de gebruiker het venster wegklikte. */
function vertaal(e: unknown): never {
  if (e instanceof PasskeyError) throw e;
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") throw new PasskeyError("geannuleerd");
  throw e;
}

/**
 * Een nieuwe passkey voor dit account, en je sleutel ermee versleuteld.
 * Geeft de rij voor `key_passkeys` terug.
 */
export async function createPasskeyCopy(args: {
  userId: string;
  name: string;
  secretKey: Uint8Array;
}): Promise<{ credential_id: string; wrapped: string }> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "Lincin" },
        user: { id: new TextEncoder().encode(args.userId), name: args.name, displayName: args.name },
        challenge: challenge() as BufferSource,
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        extensions: { prf: { eval: { first: SALT } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new PasskeyError("geannuleerd");
    const id = b64url(cred.rawId);
    const ext = cred.getClientExtensionResults() as { prf?: Prf };
    if (ext.prf?.enabled === false) throw new PasskeyError("geen-prf");
    // Niet elke passkey geeft de waarde al bij het aanmaken; dan meteen
    // één keer vragen (nog een vingerafdruk).
    const prf = prfOf(cred) ?? (await ask([id])).prf;
    if (!prf) throw new PasskeyError("geen-prf");
    const wrapped = sealSecretKey(args.secretKey, await keyFromPrf(prf, args.userId), args.userId);
    return { credential_id: id, wrapped };
  } catch (e) {
    vertaal(e);
  }
}

/**
 * Je sleutel terug met een van je passkeys. `rows` zijn je rijen uit
 * `key_passkeys`. `null` als de gekozen passkey er geen van is of niet past.
 */
export async function openWithPasskey(
  userId: string,
  rows: { credential_id: string; wrapped: string }[]
): Promise<Uint8Array | null> {
  try {
    const { id, prf } = await ask(rows.map((r) => r.credential_id));
    if (!prf) throw new PasskeyError("geen-prf");
    const row = rows.find((r) => r.credential_id === id);
    if (!row) return null;
    return openSecretKey(row.wrapped, await keyFromPrf(prf, userId), userId);
  } catch (e) {
    vertaal(e);
  }
}
