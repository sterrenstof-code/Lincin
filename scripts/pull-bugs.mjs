#!/usr/bin/env node
/**
 * Het bugbord ophalen en afhandelen, vanaf de opdrachtregel.
 *
 * Dit is de kant van `app/bugs.tsx` waar niemand anders bij hoeft te
 * kunnen. De app schrijft meldingen; dit script leest ze en zet de status.
 *
 *   npm run bugs                       alles wat nog openstaat
 *   npm run bugs -- --all              ook wat al afgehandeld is
 *   npm run bugs -- --json             machineleesbaar
 *   npm run bugs -- bezig <id>         "wordt aan gewerkt"
 *   npm run bugs -- opgelost <id> "Zat in de gesture-herkenner op web."
 *   npm run bugs -- geen_bug <id> "Werkt zoals bedoeld, zie …"
 *
 * De status zetten gaat bewust NIET via de app. Er is geen update-policy
 * voor gewone gebruikers (zie 0049): een melding op "opgelost" kunnen
 * zetten terwijl er niets gebeurd is holt het enige woord uit dat er iets
 * toe doet. Dus met de service-rol, buiten RLS om.
 *
 * Zodra je een melding op opgelost of geen_bug zet, krijgen de melder en
 * iedereen die "ik heb dit ook" tikte er bericht van — die trigger staat
 * in 0049 en hangt aan dezelfde meldingenketen als de rest van de app.
 *
 * ---------------------------------------------------------------
 * VOOR HET EERST DRAAIEN
 * ---------------------------------------------------------------
 * De service-rolsleutel staat NIET in `.env.local`, want die wordt
 * meegebundeld naar de client. Zet hem in `.env.bugs` (staat in
 * .gitignore) of geef hem mee als omgevingsvariabele:
 *
 *   Supabase Studio → Project Settings → API → service_role
 *
 *   echo 'SUPABASE_SERVICE_ROLE_KEY=eyJ…' > .env.bugs
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimale .env-lezer — geen dependency voor vier regels tekst. */
function readEnvFile(name) {
  const path = join(ROOT, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnvFile(".env.local"), ...readEnvFile(".env.bugs"), ...process.env };
const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE) {
  console.error("EXPO_PUBLIC_SUPABASE_URL ontbreekt (.env.local).");
  process.exit(1);
}
if (!KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY ontbreekt.\n" +
      "Supabase Studio → Project Settings → API → service_role, en dan:\n" +
      "  echo 'SUPABASE_SERVICE_ROLE_KEY=eyJ…' > .env.bugs"
  );
  process.exit(1);
}

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const STATUSES = ["open", "bezig", "opgelost", "geen_bug"];
const args = process.argv.slice(2);

// ---------------------------------------------------------------
// Status zetten
// ---------------------------------------------------------------
if (STATUSES.includes(args[0])) {
  const [status, id, ...rest_] = args;
  if (!id) {
    console.error(`Gebruik: npm run bugs -- ${status} <id> ["wat eraan gedaan is"]`);
    process.exit(1);
  }
  const resolution = rest_.join(" ").trim() || null;
  const patch = { status };
  if (resolution) patch.resolution = resolution;

  const updated = await rest(`bug_reports?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!updated?.length) {
    console.error(`Geen melding met id ${id}.`);
    process.exit(1);
  }
  console.log(`✓ ${updated[0].title}\n  → ${status}${resolution ? `\n  → ${resolution}` : ""}`);
  process.exit(0);
}

// ---------------------------------------------------------------
// Ophalen
// ---------------------------------------------------------------
const showAll = args.includes("--all");
const asJson = args.includes("--json");

// `bug_board` is een security_invoker-view; met de service-rol zien we alles,
// maar `confirmed_by_me` slaat dan nergens op (er is geen "ik"). Vandaar de
// telling apart, uit bug_confirms.
const [reports, confirms, profiles] = await Promise.all([
  rest(
    `bug_reports?select=*&order=created_at.desc${showAll ? "" : "&resolved_at=is.null"}`
  ),
  rest("bug_confirms?select=report_id"),
  rest("profiles?select=id,username,display_name"),
]);

const confirmCount = new Map();
for (const c of confirms ?? []) {
  confirmCount.set(c.report_id, (confirmCount.get(c.report_id) ?? 0) + 1);
}
const nameOf = new Map(
  (profiles ?? []).map((p) => [p.id, p.display_name || p.username || p.id.slice(0, 8)])
);

const rows = (reports ?? [])
  .map((r) => ({
    ...r,
    affected: (confirmCount.get(r.id) ?? 0) + 1,
    reporter: nameOf.get(r.user_id) ?? "onbekend",
  }))
  // Wat de meeste mensen raakt eerst — dat is de hele reden dat er een
  // "ik heb dit ook" op het bord staat.
  .sort((a, b) => b.affected - a.affected || a.created_at.localeCompare(b.created_at));

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

if (rows.length === 0) {
  console.log(showAll ? "Het bord is leeg." : "Niets open. 🎉");
  process.exit(0);
}

const MARK = { open: "●", bezig: "◐", opgelost: "○", geen_bug: "·" };
console.log(`\n${rows.length} melding${rows.length === 1 ? "" : "en"}\n`);

for (const r of rows) {
  const who = r.affected === 1 ? "1 persoon" : `${r.affected} mensen`;
  const ctx = [r.platform, r.app_version && `v${r.app_version}`, r.route]
    .filter(Boolean)
    .join(" · ");

  console.log(`${MARK[r.status] ?? "?"} ${r.title}`);
  console.log(`  ${who} · ${r.reporter} · ${r.created_at.slice(0, 16).replace("T", " ")}`);
  if (ctx) console.log(`  ${ctx}`);
  if (r.body) {
    for (const line of r.body.split("\n")) console.log(`  │ ${line}`);
  }
  if (r.resolution) console.log(`  → ${r.resolution}`);
  console.log(`  ${r.id}\n`);
}
