/**
 * Catalogus op desktop: responsive. Elke staat van de testpagina's in een
 * reeks vensters, van 1024 × 768 tot 2560 × 1440, ook staand en laag, en per
 * venster:
 *
 *   - de pagina schuift niet zijwaarts en de kop past;
 *   - wand en blad: elke foto onder zijn nummer, foto en bijschrift binnen de wand;
 *   - blad: de tabbladen, + en de knop Weergave overlappen niet en passen;
 *   - lichtbak: titel, foto en knoppen naast elkaar, de foto boven de strook;
 *   - gloedraster: elk voorwerp binnen zijn vak, boven zijn titel;
 *   - open: de foto in het midden van de vrije ruimte (±1 px), helemaal in
 *     beeld en links van het paneel; het paneel 440 en over de volle hoogte;
 *   - het menu en Gesprekken en Events: binnen het venster, niets loopt over.
 *
 * Beelden in tmp/catalogus-desktop/maten/. Code 1 als iets niet klopt.
 *
 *   node scripts/catalogus-desktop-maten.mjs
 *   node scripts/catalogus-desktop-maten.mjs 1024x768 wand-open
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tmp", "catalogus-desktop", "maten");
const BASE = `http://localhost:${Number(process.env.CATALOGUS_PORT ?? 8081)}`;

const VENSTERS = ["1024x768", "1024x1366", "1280x720", "1280x800", "1366x768", "1440x620", "1440x900", "1680x1050", "1920x1080", "2560x1440"];
const STATEN = [
  "wand-dicht",
  "wand-open",
  "blad-dicht",
  "blad-open",
  "lichtbak-dicht",
  "lichtbak-open",
  "gloedraster-dicht",
  "gloedraster-open",
  "weergaveknop-menu",
  "weergaveknop-menu-blad",
  "gesprekken",
  "events",
  "jij",
  "jij-blad",
];
const SCHAAL = { wand: [1.7, 0.74], blad: [1.7, 0.74], gloedraster: [3.2, 0.74], lichtbak: [1.5, 0.82] };

const arg = process.argv.slice(2);
const vensters = arg.filter((a) => /^\d+x\d+$/.test(a)).length ? arg.filter((a) => /^\d+x\d+$/.test(a)) : VENSTERS;
const staten = arg.filter((a) => STATEN.includes(a)).length ? arg.filter((a) => STATEN.includes(a)) : STATEN;

mkdirSync(OUT, { recursive: true });

/** In de pagina: alle controles voor deze staat, als lijst van fouten. */
function controleer({ staat, schaal }) {
  const fout = [];
  const R = (el) => el.getBoundingClientRect();
  const vw = innerWidth;
  const vh = innerHeight;
  const t = 1; // px
  if (document.documentElement.scrollWidth > vw + t) fout.push(`pagina ${document.documentElement.scrollWidth} breed`);
  const kop = document.querySelector('[data-meet="kop"]');
  if (kop && kop.scrollWidth > kop.clientWidth + t) fout.push(`kop loopt over (${kop.scrollWidth} > ${kop.clientWidth})`);
  const binnen = (a, b, wat) => {
    if (a.left < b.left - t || a.top < b.top - t || a.right > b.right + t || a.bottom > b.bottom + t)
      fout.push(`${wat}: ${Math.round(a.left)},${Math.round(a.top)}–${Math.round(a.right)},${Math.round(a.bottom)} buiten ${Math.round(b.left)},${Math.round(b.top)}–${Math.round(b.right)},${Math.round(b.bottom)}`);
  };
  const open = /-open$/.test(staat);
  const w = staat.split("-")[0];

  // Wand en blad, dicht: foto onder zijn nummer; foto en bijschrift binnen de wand (verticaal).
  if ((w === "wand" || w === "blad" || staat.startsWith("weergaveknop")) && !open) {
    const wand = document.querySelector('[data-meet="vlak"]');
    const wr = R(wand);
    for (const h of document.querySelectorAll('[data-meet="stuk"]')) {
      const nr = R(h.querySelector(".nr"));
      const f = R(h.querySelector('[data-meet="foto"]'));
      const cap = R(h.querySelector(".cap"));
      if (f.top < nr.bottom - t) fout.push(`stuk ${h.dataset.id}: foto over het nummer`);
      if (nr.top < wr.top - t) fout.push(`stuk ${h.dataset.id}: nummer boven de wand`);
      if (cap.bottom > wr.bottom + t) fout.push(`stuk ${h.dataset.id}: bijschrift onder de wand (${Math.round(cap.bottom)} > ${Math.round(wr.bottom)})`);
    }
  }
  // Blad: de kolom met tabbladen.
  if (w === "blad" || staat === "weergaveknop-menu-blad") {
    const tabs = document.querySelector('[data-meet="tabs"]');
    const kinderen = [...tabs.children].filter((c) => R(c).height > 0 && getComputedStyle(c).flexGrow === "0");
    for (let i = 1; i < kinderen.length; i++) if (R(kinderen[i]).top < R(kinderen[i - 1]).bottom - t) fout.push(`tabbladen overlappen (${i})`);
    const knop = R(document.querySelector('[data-meet="wkbtn"]'));
    if (knop.bottom > vh - t) fout.push("knop Weergave onder het venster");
  }
  // Lichtbak, dicht.
  if (w === "lichtbak" && !open) {
    const f = R(document.querySelector('[data-meet="foto"]'));
    const ti = R(document.querySelector('[data-meet="lichtbak-titel"]'));
    const kn = R(document.querySelector('[data-meet="lichtbak-knoppen"]'));
    const st = R(document.querySelector('[data-meet="strook"]'));
    if (ti.right > f.left + t) fout.push(`titel over de foto (${Math.round(ti.right)} > ${Math.round(f.left)})`);
    if (kn.left < f.right - t) fout.push("knoppen over de foto");
    if (f.bottom > st.top + t) fout.push("foto over de strook");
    if (f.top < 56 - t) fout.push("foto onder de kop");
    const titel = document.querySelector('[data-meet="lichtbak-titel"] .T');
    if (titel.scrollWidth > titel.clientWidth + t) fout.push("titel loopt zijwaarts over");
  }
  // Gloedraster: elk voorwerp binnen zijn vak, boven zijn titel.
  if (w === "gloedraster" && !open) {
    for (const a of document.querySelectorAll('[data-meet="stuk"]')) {
      const ar = R(a);
      if (ar.top > vh) continue; // onder de rand: schuift
      const f = R(a.querySelector('[data-meet="foto"]'));
      binnen(f, ar, `vak ${a.dataset.id}`);
      const tekst = R(a.querySelector(".T"));
      if (f.bottom > tekst.top + t) fout.push(`vak ${a.dataset.id}: voorwerp over de titel`);
      const kop = R(a.firstElementChild);
      if (f.top < kop.bottom - t) fout.push(`vak ${a.dataset.id}: voorwerp over het nummer`);
    }
  }
  // Open: de foto in het midden van de vrije ruimte, in beeld, links van het paneel.
  if (open) {
    const p = R(document.querySelector('[data-meet="drawer"]'));
    if (Math.abs(p.width - 440) > 0.5 || Math.abs(p.top) > 0.5 || Math.abs(p.bottom - vh) > 0.5 || Math.abs(p.right - vw) > 0.5) fout.push(`paneel ${Math.round(p.left)},${Math.round(p.top)} ${Math.round(p.width)}×${Math.round(p.height)}`);
    const v = R(document.querySelector('[data-meet="vlak"]'));
    const f = R(document.querySelector('[data-meet="stuk"][aria-current] [data-meet="foto"]'));
    const rechts = Math.min(v.right, vw - 440);
    const cx = (v.left + rechts) / 2;
    const cy = v.top + v.height / 2;
    const dx = f.left + f.width / 2 - cx;
    const dy = f.top + f.height / 2 - cy;
    if (Math.abs(dx) > t || Math.abs(dy) > t) fout.push(`foto niet in het midden (Δ ${dx.toFixed(1)}, ${dy.toFixed(1)})`);
    binnen(f, { left: v.left, top: v.top, right: rechts, bottom: v.bottom }, "open foto");
    const basis = document.querySelector('[data-meet="stuk"][aria-current] [data-meet="foto"]');
    const [max, deel] = schaal;
    const s = Math.min(max, (v.height * deel) / basis.offsetHeight, ((rechts - v.left) * 0.8) / basis.offsetWidth);
    if (Math.abs(f.width / basis.offsetWidth - s) > 0.005) fout.push(`schaal ${(f.width / basis.offsetWidth).toFixed(3)}, verwacht ${s.toFixed(3)}`);
  }
  // Het menu.
  const menu = document.querySelector('[data-meet="menu"]');
  if (menu) binnen(R(menu), { left: 0, top: 0, right: vw, bottom: vh }, "menu");
  // Gesprekken en Events: niets loopt zijwaarts over in een kolom.
  for (const k of document.querySelectorAll('[data-meet="gesprekken"] > *, [data-meet="events"] > *, [data-meet="jij"] > *')) {
    if (k.scrollWidth > k.clientWidth + t) fout.push(`kolom loopt over (${k.scrollWidth} > ${k.clientWidth})`);
  }
  for (const e of document.querySelectorAll('[data-meet="event"]')) {
    const er = R(e);
    if (er.top > vh) continue;
    for (const c of e.querySelectorAll("button, .T, .spec")) {
      const cr = R(c);
      if (cr.bottom > er.bottom + t || cr.right > er.right + t) fout.push("event: inhoud buiten de rij");
    }
  }
  // Jij: elk voorwerp binnen zijn vak, elke ingang op één regel binnen de kolom.
  for (const v of document.querySelectorAll('[data-meet="mijnstuk"]')) {
    const vr = R(v);
    if (vr.top > vh) continue;
    binnen(R(v.querySelector(".pic")), vr, "mijn bijdrage");
  }
  for (const i of document.querySelectorAll('[data-meet="ingang"]')) {
    const ir = R(i);
    for (const c of i.children) if (R(c).right > ir.right + t) fout.push("ingang loopt over");
  }
  return fout;
}

const browser = await chromium.launch({ args: ["--force-device-scale-factor=1"] });
const rijen = [];
try {
  for (const v of vensters) {
    const [b, h] = v.split("x").map(Number);
    const ctx = await browser.newContext({ viewport: { width: b, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    for (const s of staten) {
      await page.goto(`${BASE}/dev/catalogus-desktop/${s}`);
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 60_000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
      });
      await page.waitForTimeout(300);
      const w = s.split("-")[0];
      const fout = await page.evaluate(controleer, { staat: s, schaal: SCHAAL[w] ?? [1, 1] });
      await page.screenshot({ path: join(OUT, `${v}-${s}.png`) });
      rijen.push({ venster: v, staat: s, ok: !fout.length, fout });
      console.log(`${fout.length ? "✗" : "✓"} ${v.padEnd(10)} ${s}${fout.length ? `  — ${fout.slice(0, 3).join("; ")}` : ""}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync(join(OUT, "maten.json"), JSON.stringify({ datum: new Date().toISOString(), rijen }, null, 1));
const mis = rijen.filter((r) => !r.ok);
console.log(`\n${rijen.length - mis.length} van ${rijen.length} kloppen.`);
if (mis.length) process.exit(1);
