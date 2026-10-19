/**
 * CSP-hashes van de inline scripts controleren.
 *
 * De afgedwongen Content-Security-Policy in vercel.json laat geen
 * `'unsafe-inline'` scripts toe, alleen de inline scripts waarvan de
 * SHA-256 erin staat (die uit app/+html.tsx, plus de hydratievlag die
 * expo-router zelf toevoegt). Verandert er één teken in zo'n script, dan
 * blokkeert de browser hem stil in productie. Dit script vangt dat vooraf.
 *
 * Leest de geëxporteerde HTML (dus na JSX en minificatie: precies de bytes
 * die de browser hasht), drukt de hashes af en stopt met code 1 als er één
 * ontbreekt in vercel.json.
 *
 * Run: npx expo export -p web && npm run csp:check
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return p.endsWith(".html") ? [p] : [];
  });
}

let files;
try {
  files = htmlFiles(DIST);
} catch {
  console.error(`Geen ${DIST}/ gevonden. Eerst: npx expo export -p web`);
  process.exit(1);
}
if (!files.length) {
  console.error(`Geen HTML in ${DIST}/.`);
  process.exit(1);
}

// Elke pagina van de statische export draagt dezelfde <head>, maar we
// kijken ze allemaal na: één afwijkende pagina is ook een kapotte pagina.
const found = new Map(); // hash → { files, preview }
const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
for (const file of files) {
  const html = readFileSync(file, "utf8");
  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    if (!body) continue;
    const hash = `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
    const entry = found.get(hash) ?? { files: 0, preview: body.slice(0, 60).replace(/\s+/g, " ") };
    entry.files += 1;
    found.set(hash, entry);
  }
  // Inline event-handlers (onclick="…") zijn met een hash niet toe te laten.
  if (/<[^>]+\son[a-z]+\s*=/i.test(html)) {
    console.error(`Inline event-handler in ${file}: die blokkeert de CSP.`);
    process.exitCode = 1;
  }
}

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const csp = (vercel.headers ?? [])
  .flatMap((h) => h.headers ?? [])
  .find((h) => h.key.toLowerCase() === "content-security-policy")?.value;
if (!csp) {
  console.error("Geen afgedwongen Content-Security-Policy in vercel.json.");
  process.exit(1);
}
const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";

let missing = 0;
for (const [hash, { files: n, preview }] of found) {
  const ok = scriptSrc.includes(hash);
  if (!ok) missing += 1;
  console.log(`${ok ? "ok      " : "ONTBREEKT"} ${hash}  (${n} pagina's)  ${preview}…`);
}

// Een hash die nergens meer bij hoort is geen fout, wel ballast.
for (const stale of scriptSrc.match(/'sha256-[^']+'/g) ?? []) {
  if (!found.has(stale)) console.warn(`ongebruikt ${stale} in vercel.json`);
}

if (missing) {
  console.error(`\n${missing} inline script(s) staan niet in script-src van vercel.json. Zet de hash(es) hierboven erin.`);
  process.exit(1);
}
