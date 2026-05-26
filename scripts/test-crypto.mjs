/**
 * Crypto roundtrip test for Lincin.
 *
 * Mirrors what lib/crypto/encrypt.ts does in production. Validates:
 *   1. 1-on-1 encrypt -> decrypt roundtrip
 *   2. Sender cannot decrypt its own ciphertext with its own key
 *   3. Multi-recipient envelopes (groups) keep each user's payload isolated
 *   4. Tamper detection on ciphertext
 *   5. Tamper detection on nonce
 *   6. Unicode + long messages survive correctly
 *
 * Run: npm run test:crypto
 */

import { generateKeyPair, sharedKey } from "@stablelib/x25519";
import { randomBytes } from "@stablelib/random";
import { XChaCha20Poly1305 } from "@stablelib/xchacha20poly1305";

const NONCE_BYTES = 24;
const enc = new TextEncoder();
const dec = new TextDecoder();

// --- helpers mirroring lib/crypto/encrypt.ts ---

function encryptForRecipient(plaintext, recipientPublicKey) {
  const ephemeral = generateKeyPair();
  const shared = sharedKey(ephemeral.secretKey, recipientPublicKey);
  const aead = new XChaCha20Poly1305(shared);
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = aead.seal(nonce, plaintext);
  ephemeral.secretKey.fill(0);
  shared.fill(0);
  return {
    ephemeral_pub: ephemeral.publicKey,
    nonce,
    ciphertext,
  };
}

function decryptFromSender(payload, ourSecretKey) {
  const shared = sharedKey(ourSecretKey, payload.ephemeral_pub);
  const aead = new XChaCha20Poly1305(shared);
  const plaintext = aead.open(payload.nonce, payload.ciphertext);
  shared.fill(0);
  return plaintext;
}

function encryptForRecipients(plaintext, recipients) {
  const out = {};
  for (const r of recipients) {
    out[r.userId] = encryptForRecipient(plaintext, r.publicKey);
  }
  return out;
}

// --- test harness ---

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, err) {
  failed++;
  console.error(`  ✗ ${label}`);
  if (err) console.error(`    → ${err.message ?? err}`);
}

function group(name, fn) {
  console.log(`\n${name}`);
  try {
    fn();
  } catch (e) {
    fail("group threw", e);
  }
}

// --- tests ---

group("1) 1-on-1 roundtrip", () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const message = enc.encode("Hallo Bob, dit is Alice 👋");
  const envelope = encryptForRecipient(message, bob.publicKey);

  const decrypted = decryptFromSender(envelope, bob.secretKey);
  if (!decrypted) return fail("Bob kon niet ontsleutelen");
  if (dec.decode(decrypted) === "Hallo Bob, dit is Alice 👋") {
    ok("Bob ontsleutelt Alice's bericht correct");
  } else {
    fail("Ontsleutelde tekst klopt niet");
  }
});

group("2) Sender cannot decrypt with own key", () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const envelope = encryptForRecipient(enc.encode("geheim"), bob.publicKey);

  // Alice probeert met haar EIGEN private key — moet falen
  // (de ephemeral pub in de envelope is NIET Bob's pub)
  const result = decryptFromSender(envelope, alice.secretKey);
  if (result === null) {
    ok("Alice kan haar eigen ciphertext niet ontsleutelen met haar key");
  } else {
    fail("Auth-tag check werkt niet — Alice kreeg plaintext terug!");
  }
});

group("3) Multi-recipient (groep) isolatie", () => {
  const sender = generateKeyPair();
  const b = generateKeyPair();
  const c = generateKeyPair();
  const d = generateKeyPair();

  const plaintext = enc.encode("Hoi allemaal!");
  const envelopes = encryptForRecipients(plaintext, [
    { userId: "b", publicKey: b.publicKey },
    { userId: "c", publicKey: c.publicKey },
    { userId: "d", publicKey: d.publicKey },
  ]);

  // Elke ontvanger ontsleutelt zijn eigen envelope
  const bPlain = decryptFromSender(envelopes["b"], b.secretKey);
  const cPlain = decryptFromSender(envelopes["c"], c.secretKey);
  const dPlain = decryptFromSender(envelopes["d"], d.secretKey);

  if (bPlain && dec.decode(bPlain) === "Hoi allemaal!") ok("B ontsleutelt eigen envelope");
  else fail("B ontsleutelt eigen envelope niet");
  if (cPlain && dec.decode(cPlain) === "Hoi allemaal!") ok("C ontsleutelt eigen envelope");
  else fail("C ontsleutelt eigen envelope niet");
  if (dPlain && dec.decode(dPlain) === "Hoi allemaal!") ok("D ontsleutelt eigen envelope");
  else fail("D ontsleutelt eigen envelope niet");

  // C probeert B's envelope te ontsleutelen — moet falen
  const cTriesB = decryptFromSender(envelopes["b"], c.secretKey);
  if (cTriesB === null) ok("C kan B's envelope niet ontsleutelen");
  else fail("C kreeg toegang tot B's envelope!");
});

group("4) Tamper detection — ciphertext", () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const envelope = encryptForRecipient(enc.encode("officieel statement"), bob.publicKey);

  // Eén byte in de ciphertext flippen
  envelope.ciphertext[3] ^= 0xff;

  const result = decryptFromSender(envelope, bob.secretKey);
  if (result === null) ok("Gewijzigde ciphertext wordt geweigerd");
  else fail("Tamper bleef onopgemerkt!");
});

group("5) Tamper detection — nonce", () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const envelope = encryptForRecipient(enc.encode("officieel statement"), bob.publicKey);

  // Eén byte in de nonce flippen
  envelope.nonce[0] ^= 0xff;

  const result = decryptFromSender(envelope, bob.secretKey);
  if (result === null) ok("Gewijzigde nonce wordt geweigerd");
  else fail("Nonce-tamper bleef onopgemerkt!");
});

group("6) Unicode & lange berichten", () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();

  const cases = [
    "🦊🍰🎉 emoji storm",
    "中文 + nederlands + ελληνικά",
    "a".repeat(10_000), // 10 KB
    "", // empty (edge case)
  ];

  for (const text of cases) {
    const envelope = encryptForRecipient(enc.encode(text), bob.publicKey);
    const decrypted = decryptFromSender(envelope, bob.secretKey);
    if (decrypted && dec.decode(decrypted) === text) {
      ok(`roundtrip: ${text.length === 0 ? "(empty)" : text.slice(0, 24) + (text.length > 24 ? "…" : "")}`);
    } else {
      fail(`roundtrip faalde voor: ${text.slice(0, 32)}`);
    }
  }
});

// --- summary ---

console.log("\n──────────────────────────────────────");
console.log(`  ${passed} geslaagd, ${failed} gefaald`);
console.log("──────────────────────────────────────\n");

if (failed > 0) process.exit(1);
