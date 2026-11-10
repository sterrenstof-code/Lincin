/**
 * Catalogus (ontwerp 3e): de testpagina's naast de referentie.
 *
 * Per scherm en per stand:
 *   1. de testpagina (/dev/catalogus/<nr-naam>?stand=…) in Chromium op 390
 *      breed, schaal 2, met de hoogte uit schermen.json, animaties uit;
 *   2. een schermafbeelding, vergeleken met de referentie-PNG met
 *      pixelmatch (drempel 0.1);
 *   3. de positie en maat van de hoofdonderdelen (kop, vak, voorwerp,
 *      kaartje, actierij, tabbalk) in de referentie-HTML en in de eigen
 *      pagina (testID), en elke band met een naad erboven, elk verschil > 1 px;
 *   4. de kleur van elk vlak (een punt binnen elk vak) tegen de referentie.
 *
 * Schrijft naar tmp/catalogus/: eigen afbeelding, verschilbeeld en
 * verslag.json. Eindigt met een tabel en code 1 als iets niet slaagt.
 *
 *   npm run catalogus:vergelijk                 alles
 *   npm run catalogus:vergelijk -- 01 05        alleen deze nummers
 *   npm run catalogus:vergelijk -- --stand=licht
 *
 * Met `--desktop` (npm run catalogus:vergelijk:desktop) de desktopstaten uit
 * desktop/staten.json; zie `vergelijkDesktop` onderaan.
 *
 *   npm run catalogus:vergelijk:desktop                  alle staten
 *   npm run catalogus:vergelijk:desktop -- wand-open     alleen deze
 */

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HANDOFF = join(ROOT, "design_handoff_lincin_3e");
const OUT = join(ROOT, "tmp", "catalogus");
const PORT = Number(process.env.CATALOGUS_PORT ?? 8081);
const BASE = `http://localhost:${PORT}`;

const DREMPEL = 0.1;
const MAX_PROCENT = 0.5;
const MAX_PX = 1;

const args = process.argv.slice(2);
const nummers = args.filter((a) => /^\d\d$/.test(a));
const standArg = args.find((a) => a.startsWith("--stand="))?.split("=")[1];
const standen = standArg ? [standArg] : ["licht", "donker"];

const lijst = JSON.parse(readFileSync(join(HANDOFF, "schermen.json"), "utf8")).schermen.filter(
  (s) => !nummers.length || nummers.includes(s.nr),
);

mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------
// De webversie
// ---------------------------------------------------------------

async function bereikbaar() {
  try {
    const r = await fetch(`${BASE}/dev/catalogus/01-home`, { signal: AbortSignal.timeout(60_000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function startWeb() {
  if (await bereikbaar()) return null;
  console.log(`Webversie start op ${BASE} …`);
  const proc = spawn("npx", ["expo", "start", "--web", "--port", String(PORT)], {
    cwd: ROOT,
    env: { ...process.env, CI: "1", BROWSER: "none" },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 180; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await bereikbaar()) return proc;
  }
  throw new Error("De webversie kwam niet op.");
}

// ---------------------------------------------------------------
// Meten
// ---------------------------------------------------------------

/** In de referentie: de onderdelen herkend aan hun inline stijl. */
function meetReferentie() {
  const root = document.body.firstElementChild;
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, b: b.width, h: b.height };
  };
  const st = (el) => el.getAttribute("style") ?? "";
  const out = { kop: [], vak: [], voorwerp: [], kaartje: [], actierij: [], tabbalk: [], band: [] };
  out.kop.push(r(root.firstElementChild));
  // Elke band met een naad erboven: rijen, kopjes, knoppenrijen.
  for (const b of root.querySelectorAll('[style*="border-top:2px solid"]')) out.band.push(r(b));
  for (const nav of root.querySelectorAll("nav")) out.tabbalk.push(r(nav));
  for (const k of root.querySelectorAll('[style*="grid-template-columns:auto minmax(0,1fr)"]')) out.kaartje.push(r(k));
  const vakken = [];
  for (const g of root.querySelectorAll('[style*="display:grid;grid-template-columns:repeat(2"], [style*="grid-template-columns:132px"]')) {
    for (const el of g.children) {
      const s = st(el);
      if (s.includes("padding:12px") || s.includes("height:196px")) vakken.push(el);
    }
  }
  for (const v of vakken) out.vak.push(r(v));
  const voorwerpen = new Set();
  for (const img of root.querySelectorAll("img")) voorwerpen.add(img.parentElement);
  for (const v of vakken) {
    const w = v.firstElementChild;
    if (!w) continue;
    if (st(w).includes("flex:1")) {
      if (w.firstElementChild) voorwerpen.add(w.firstElementChild);
    } else if (st(v).includes("height:196px")) voorwerpen.add(w);
  }
  for (const el of [...root.querySelectorAll("*")].filter((e) => voorwerpen.has(e))) out.voorwerp.push(r(el));
  for (const b of root.querySelectorAll('button[aria-label="Vind ik leuk"]')) {
    const p = b.parentElement;
    if (!out.actierij.some((a) => a.el === p)) out.actierij.push({ el: p });
  }
  out.actierij = out.actierij.map((a) => r(a.el));
  return { delen: out, hoogte: root.getBoundingClientRect().height };
}

/** In de eigen pagina: de onderdelen aan hun testID. */
function meetEigen() {
  const root = document.querySelector('[data-testid="scherm"]');
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, b: b.width, h: b.height };
  };
  const out = {};
  for (const rol of ["kop", "vak", "voorwerp", "kaartje", "actierij", "tabbalk", "band"]) {
    // Een testID kan meer rollen dragen ("band actierij").
    out[rol] = [...root.querySelectorAll(`[data-testid~="${rol}"]`)].map(r);
  }
  return { delen: out, hoogte: root.getBoundingClientRect().height };
}

async function wachtTotKlaar(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const imgs = [...document.images];
    await Promise.all(
      imgs.map((i) => (i.complete ? null : new Promise((res) => ((i.onload = res), (i.onerror = res))))),
    );
    await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    await document.fonts.ready;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  });
  await page.waitForTimeout(300);
}

/**
 * Welke letter elk teken tekent: per element de lettertypen die Chromium
 * er echt voor gebruikte. Een pijl uit een andere letter is een paar
 * pixels en valt in het percentage weg; hier niet.
 */
async function letterKeuze(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "body *" });
  const set = new Set();
  for (const id of nodeIds) {
    const f = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: id }).catch(() => ({ fonts: [] }));
    // Archivo heet per snit anders (variabel in het ontwerp, statisch hier): één naam.
    for (const x of f.fonts) set.add(/^Archivo/.test(x.familyName) ? "Archivo" : x.familyName);
  }
  await cdp.detach();
  return set;
}

const STIL = `*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}
::-webkit-scrollbar{display:none}html{scrollbar-width:none}`;

// ---------------------------------------------------------------
// Vergelijken
// ---------------------------------------------------------------

function vergelijkDelen(ref, eigen, { domVolgorde = false } = {}) {
  const fouten = [];
  let grootste = 0;
  // Op volgorde van plaats (boven naar onder, links naar rechts): een laag
  // die bovenop ligt staat in de DOM achteraan, maar hoort op zijn plek.
  // Desktop: in de volgorde van de DOM, die aan beide kanten gelijk is; een
  // verschoven foto wisselt dan niet van plaats met zijn buur.
  const opPlek = (l) => (domVolgorde ? [...l] : [...l].sort((p, q) => p.y - q.y || p.x - q.x));
  for (const rol of Object.keys(ref)) {
    const a = opPlek(ref[rol]);
    const b = opPlek(eigen[rol] ?? []);
    if (a.length !== b.length) fouten.push(`${rol}: ${a.length} in de referentie, ${b.length} eigen`);
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const d = {
        x: b[i].x - a[i].x,
        y: b[i].y - a[i].y,
        b: b[i].b - a[i].b,
        h: b[i].h - a[i].h,
      };
      const m = Math.max(...Object.values(d).map(Math.abs));
      grootste = Math.max(grootste, m);
      if (m > MAX_PX) {
        const f = (v) => (Math.round(v * 10) / 10).toString();
        fouten.push(
          `${rol} ${i + 1}: ref ${f(a[i].x)},${f(a[i].y)} ${f(a[i].b)}×${f(a[i].h)} · eigen ${f(b[i].x)},${f(b[i].y)} ${f(b[i].b)}×${f(b[i].h)}`,
        );
      }
    }
  }
  return { fouten, grootste: Math.round(grootste * 10) / 10 };
}

/** De grootste aaneengesloten afwijkende gebieden, in CSS-px. */
function gebieden(diff, w, h) {
  const CEL = 8;
  const gw = Math.ceil(w / CEL);
  const gh = Math.ceil(h / CEL);
  const tel = new Uint32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (diff[i] === 255 && diff[i + 1] === 0 && diff[i + 2] === 0) tel[Math.floor(y / CEL) * gw + Math.floor(x / CEL)]++;
    }
  }
  const gezien = new Uint8Array(gw * gh);
  const uit = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!tel[s] || gezien[s]) continue;
    const stapel = [s];
    gezien[s] = 1;
    let minx = Infinity, miny = Infinity, maxx = -1, maxy = -1, som = 0;
    while (stapel.length) {
      const c = stapel.pop();
      const cx = c % gw, cy = Math.floor(c / gw);
      som += tel[c];
      minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); miny = Math.min(miny, cy); maxy = Math.max(maxy, cy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (tel[n] && !gezien[n]) { gezien[n] = 1; stapel.push(n); }
      }
    }
    uit.push({ x: (minx * CEL) / 2, y: (miny * CEL) / 2, b: ((maxx - minx + 1) * CEL) / 2, h: ((maxy - miny + 1) * CEL) / 2, pixels: som });
  }
  return uit.sort((a, b) => b.pixels - a.pixels).slice(0, 6);
}

function pixel(png, x, y) {
  const i = (Math.round(y) * png.width + Math.round(x)) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

// ---------------------------------------------------------------

// Desktop: een eigen lus, met een eigen venster en schaal (zie onderaan).
if (args.includes("--desktop")) process.exit(await vergelijkDesktop());

const web = await startWeb();
// De referentiebeelden zijn gemaakt met een échte schaalfactor 2. Een
// alleen geëmuleerde (`deviceScaleFactor` van de context) rastert letters en
// foto's anders, en dan wijkt de referentie-HTML zelf al 0,2–1 % af van zijn
// eigen PNG. Met deze vlag is dat 0,04–0,07 %.
const browser = await chromium.launch({ args: ["--force-device-scale-factor=2"] });
const rijen = [];

try {
  for (const s of lijst) {
    for (const stand of standen) {
      const naam = `${s.nr}-${s.naam}`;
      const bestand = s[stand === "donker" ? "donker" : "licht"];
      const ctx = await browser.newContext({
        viewport: { width: 390, height: s.hoogte },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
        colorScheme: stand === "donker" ? "dark" : "light",
      });
      const page = await ctx.newPage();

      // De referentie: alleen meten.
      await page.goto(pathToFileURL(join(HANDOFF, bestand.html)).href);
      await page.addStyleTag({ content: STIL });
      await wachtTotKlaar(page);
      const ref = await page.evaluate(meetReferentie);
      const refLetters = await letterKeuze(page);
      // Ter vergelijking: de referentie-HTML zelf in deze browser. Wat de PNG
      // anders heeft dan deze render, komt van de machine waarop hij gemaakt is.
      const refShot = await page.screenshot({ fullPage: false });

      // De eigen pagina.
      await page.goto(`${BASE}/dev/catalogus/${naam}?stand=${stand}`, { waitUntil: "load" });
      await page.addStyleTag({ content: STIL });
      await page.waitForSelector('[data-testid="scherm"]', { timeout: 60_000 });
      await wachtTotKlaar(page);
      const eigen = await page.evaluate(meetEigen);
      const eigenLetters = await letterKeuze(page);
      const shot = await page.screenshot({ fullPage: false });
      await ctx.close();

      const refPng = PNG.sync.read(readFileSync(join(HANDOFF, bestand.png)));
      const eigenPng = PNG.sync.read(shot);
      const w = refPng.width;
      const h = refPng.height;
      const verschil = new PNG({ width: w, height: h });
      let afwijkend = w * h;
      let maatFout = null;
      if (eigenPng.width !== w || eigenPng.height !== h) {
        maatFout = `afbeelding ${eigenPng.width}×${eigenPng.height}, referentie ${w}×${h}`;
      } else {
        afwijkend = pixelmatch(refPng.data, eigenPng.data, verschil.data, w, h, { threshold: DREMPEL, includeAA: false });
      }
      const procent = (afwijkend / (w * h)) * 100;
      const refHtmlPng = PNG.sync.read(refShot);
      const tegenHtml =
        refHtmlPng.width === eigenPng.width && refHtmlPng.height === eigenPng.height
          ? (pixelmatch(refHtmlPng.data, eigenPng.data, null, w, h, { threshold: DREMPEL }) / (w * h)) * 100
          : 100;
      const htmlTegenPng =
        refHtmlPng.width === w && refHtmlPng.height === h ? (pixelmatch(refPng.data, refHtmlPng.data, null, w, h, { threshold: DREMPEL }) / (w * h)) * 100 : 100;
      const pad = `tmp/catalogus/${naam}-${stand}`;
      writeFileSync(join(ROOT, `${pad}-eigen.png`), shot);
      if (!maatFout) writeFileSync(join(ROOT, `${pad}-verschil.png`), PNG.sync.write(verschil));

      const delen = vergelijkDelen(ref.delen, eigen.delen);
      const hoogteVerschil = Math.round((eigen.hoogte - ref.hoogte) * 10) / 10;

      // De kleur van elk vlak: een punt net binnen elk vak.
      const kleurFouten = [];
      if (!maatFout) {
        ref.delen.vak.forEach((v, i) => {
          const a = pixel(refPng, (v.x + 3) * 2, (v.y + 3) * 2);
          const b = pixel(eigenPng, (v.x + 3) * 2, (v.y + 3) * 2);
          if (a.some((c, k) => c !== b[k])) kleurFouten.push(`vak ${i + 1}: ref rgb(${a}) eigen rgb(${b})`);
        });
      }

      const letterFouten = [
        ...[...refLetters].filter((f) => !eigenLetters.has(f)).map((f) => `letter ${f} ontbreekt`),
        ...[...eigenLetters].filter((f) => !refLetters.has(f)).map((f) => `letter ${f} staat er te veel`),
      ];
      const fouten = [
        ...(maatFout ? [maatFout] : []),
        ...letterFouten,
        ...(procent >= MAX_PROCENT ? [`${procent.toFixed(2)} % afwijkend`] : []),
        ...(hoogteVerschil !== 0 ? [`hoogte ${hoogteVerschil > 0 ? "+" : ""}${hoogteVerschil} px`] : []),
        ...delen.fouten,
        ...kleurFouten,
      ];
      const rij = {
        scherm: naam,
        stand,
        geslaagd: fouten.length === 0,
        procent: Math.round(procent * 1000) / 1000,
        tegenHtml: Math.round(tegenHtml * 1000) / 1000,
        htmlTegenPng: Math.round(htmlTegenPng * 1000) / 1000,
        hoogteVerschil,
        grootsteMaatafwijking: delen.grootste,
        fouten,
        gebieden: maatFout ? [] : gebieden(verschil.data, w, h),
        eigen: `${pad}-eigen.png`,
        verschil: maatFout ? null : `${pad}-verschil.png`,
      };
      rijen.push(rij);
      console.log(`${rij.geslaagd ? "✓" : "✗"} ${naam} ${stand}  ${rij.procent.toFixed(3)} %  maat ${rij.grootsteMaatafwijking} px${fouten.length ? `  — ${fouten.length} punt(en)` : ""}`);
    }
  }
} finally {
  await browser.close();
  if (web) {
    try {
      process.kill(-web.pid);
    } catch {
      // al weg
    }
  }
}

writeFileSync(join(OUT, "verslag.json"), JSON.stringify({ datum: new Date().toISOString(), rijen }, null, 1));

console.log("\n| Scherm | Stand | Afwijkend (PNG) | Grootste maatafwijking | Hoogte | Geslaagd | Eigen ↔ ref-HTML | Ref-HTML ↔ PNG |");
console.log("|---|---|---|---|---|---|---|---|");
for (const r of rijen) {
  console.log(
    `| ${r.scherm} | ${r.stand} | ${r.procent.toFixed(3)} % | ${r.grootsteMaatafwijking} px | ${r.hoogteVerschil} px | ${r.geslaagd ? "ja" : "nee"} | ${r.tegenHtml.toFixed(3)} % | ${r.htmlTegenPng.toFixed(3)} % |`,
  );
}
const mis = rijen.filter((r) => !r.geslaagd);
console.log(`\n${rijen.length - mis.length} van ${rijen.length} geslaagd.`);
if (mis.length) {
  for (const r of mis) console.log(`\n${r.scherm} ${r.stand}:\n  ${r.fouten.slice(0, 12).join("\n  ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------
// Desktop (design_handoff_lincin_3e/desktop)
// ---------------------------------------------------------------

/**
 * Per staat uit desktop/staten.json:
 *   1. venster 1440 × 900, schaal 1, minder beweging, letters en beelden klaar;
 *   2. de testpagina /dev/catalogus-desktop/<naam> tegen desktop/png/<naam>.png
 *      (pixelmatch, drempel 0.1);
 *   3. dezelfde staat in het prototype (index.html + hash): positie en maat van
 *      kop of tabbladen, elk stuk, elke foto, het paneel en zijn blokken, het
 *      menu en zijn rijen, en de kolommen van Gesprekken en Events; > 1 px meldt;
 *   4. het kleurveld apart (alles erboven onzichtbaar): het gemiddelde
 *      verschil per kanaal tegen het prototype, < 3 %;
 *   5. de vlakkleuren: een punt in elk vlak tegen de kleur uit tokens.json.
 * Uitvoer in tmp/catalogus-desktop/.
 */
async function vergelijkDesktop() {
  const DH = join(HANDOFF, "desktop");
  const UIT = join(ROOT, "tmp", "catalogus-desktop");
  mkdirSync(UIT, { recursive: true });
  const namen = args.filter((a) => !a.startsWith("--"));
  const staten = JSON.parse(readFileSync(join(DH, "staten.json"), "utf8")).staten.filter((s) => !namen.length || namen.includes(s.naam));
  const tokens = JSON.parse(readFileSync(join(HANDOFF, "tokens.json"), "utf8"));
  const hexen = new Set(
    [...Object.values(tokens.licht), ...Object.values(tokens.donker), "#141210", "#000000"]
      .filter((v) => typeof v === "string" && v.startsWith("#"))
      .map((v) => v.toUpperCase()),
  );
  const MAX_VELD = 3;

  /** Wat er gemeten wordt, per rol: een selector in het prototype en in de eigen pagina. */
  const ROLLEN = {
    kop: [".top", '[data-meet="kop"]'],
    tabbladen: [".tabs", '[data-meet="tabs"]'],
    tab: [".tabs .tab", '[data-meet="tab"]'],
    blad: [".sheet", '[data-meet="blad"]'],
    bladkop: [".sheet .main > .strip", '[data-meet="bladkop"]'],
    stuk: [".hang, .gg > a, .light .mid", '[data-meet="stuk"]'],
    foto: [".hang .pic, .gg .pic, .light .mid .pic", '[data-meet="foto"]'],
    vakje: [".film a", '[data-meet="vakje"]'],
    paneel: [".drawer", '[data-meet="drawer"]'],
    paneelblok: [".drawer .panel > *", '[data-meet="paneel"] > *'],
    knop: [".wkbtn", '[data-meet="wkbtn"]'],
    menu: [".menu", '[data-meet="menu"]'],
    menurij: [".menu .rij", '[data-meet="menurij"]'],
    kolom: ['.main > .grid[style*="340px"] > *, .main > .grid[style*="400px"] > *', '[data-meet="gesprekken"] > *, [data-meet="events"] > *'],
    gesprek: ['.main > .grid[style*="340px"] > section > .tile', '[data-meet="gesprek"]'],
    event: ['.main > .grid[style*="400px"] > section > .grid > div', '[data-meet="event"]'],
  };

  function meet({ rollen, eigen }) {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, b: b.width, h: b.height };
    };
    const out = {};
    for (const [rol, sel] of Object.entries(rollen)) out[rol] = [...document.querySelectorAll(sel[eigen ? 1 : 0])].map(r);
    return out;
  }

  /** De vlakken van het prototype: een punt net binnen elk, en zijn kleur. */
  function vlakken() {
    const sel = ".top, .wall, .strip, .panel, .tab, .table, .sheet, .menu, .tile, .film a, .rail";
    const uit = [];
    for (const el of document.querySelectorAll(sel)) {
      const c = getComputedStyle(el).backgroundColor;
      const m = c.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/);
      if (!m || (m[4] !== undefined && Number(m[4]) < 1)) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) continue;
      for (const [x, y] of [
        [Math.round(b.x + 3), Math.round(b.y + 3)],
        [Math.round(b.right - 4), Math.round(b.bottom - 4)],
      ]) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      // Alleen als dit vlak daar het bovenste dekkende vlak is.
      const dekkend = document.elementsFromPoint(x, y).find((e) => {
        const k = getComputedStyle(e).backgroundColor;
        return k !== "rgba(0, 0, 0, 0)" && !/rgba\(.*, 0(\.\d+)?\)$/.test(k);
      });
      if (dekkend !== el) continue;
      // Geen laag erboven die er een tint over legt (verbleekt, schaduw).
      let n = el, doorzichtig = false;
      for (; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 1) doorzichtig = true;
      if (doorzichtig) continue;
      uit.push({ x, y, kleur: [Number(m[1]), Number(m[2]), Number(m[3])], wat: el.className || el.tagName });
      }
    }
    return uit;
  }

  const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  const VERBERG = ".cd .app, #app{visibility:hidden!important}";

  const web = await startWeb();
  const browser = await chromium.launch({ args: ["--force-device-scale-factor=1"] });
  const rijen = [];
  try {
    for (const s of staten) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      const page = await ctx.newPage();

      // Het prototype: meten, de vlakken, en het kleurveld alleen.
      await page.goto(pathToFileURL(join(DH, "prototype", "index.html")).href + s.hash);
      await page.addStyleTag({ content: STIL });
      await wachtTotKlaar(page);
      const ref = await page.evaluate(meet, { rollen: ROLLEN, eigen: false });
      const refVlakken = await page.evaluate(vlakken);
      const refShot = await page.screenshot();
      const glow = await page.evaluate(() => document.body.classList.contains("glow"));
      let refVeld = null;
      if (glow) {
        await page.addStyleTag({ content: VERBERG });
        await page.waitForTimeout(100);
        refVeld = await page.screenshot();
      }

      // De eigen pagina.
      await page.goto(`${BASE}/dev/catalogus-desktop/${s.naam}`, { waitUntil: "load" });
      await page.addStyleTag({ content: STIL });
      await page.waitForSelector('[data-testid="desktop"]', { timeout: 60_000 });
      await wachtTotKlaar(page);
      const eigen = await page.evaluate(meet, { rollen: ROLLEN, eigen: true });
      const shot = await page.screenshot();
      let eigenVeld = null;
      if (glow) {
        await page.addStyleTag({ content: VERBERG });
        await page.waitForTimeout(100);
        eigenVeld = await page.screenshot();
      }
      await ctx.close();

      const refPng = PNG.sync.read(readFileSync(join(DH, s.png)));
      const eigenPng = PNG.sync.read(shot);
      const w = refPng.width;
      const h = refPng.height;
      const verschil = new PNG({ width: w, height: h });
      let maatFout = null;
      let afwijkend = w * h;
      if (eigenPng.width !== w || eigenPng.height !== h) maatFout = `afbeelding ${eigenPng.width}×${eigenPng.height}, referentie ${w}×${h}`;
      else afwijkend = pixelmatch(refPng.data, eigenPng.data, verschil.data, w, h, { threshold: DREMPEL, includeAA: false });
      const procent = (afwijkend / (w * h)) * 100;
      const refHtmlPng = PNG.sync.read(refShot);
      const tegenHtml = maatFout ? 100 : (pixelmatch(refHtmlPng.data, eigenPng.data, null, w, h, { threshold: DREMPEL }) / (w * h)) * 100;
      const htmlTegenPng = (pixelmatch(refPng.data, refHtmlPng.data, null, w, h, { threshold: DREMPEL }) / (w * h)) * 100;

      const pad = `tmp/catalogus-desktop/${s.naam}`;
      writeFileSync(join(ROOT, `${pad}-eigen.png`), shot);
      if (!maatFout) writeFileSync(join(ROOT, `${pad}-verschil.png`), PNG.sync.write(verschil));

      const delen = vergelijkDelen(ref, eigen, { domVolgorde: true });

      // Het kleurveld: gemiddeld verschil per kanaal, in procent van 255.
      let veld = null;
      if (glow && refVeld && eigenVeld) {
        const a = PNG.sync.read(refVeld).data;
        const b = PNG.sync.read(eigenVeld).data;
        const som = [0, 0, 0];
        for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) som[k] += Math.abs(a[i + k] - b[i + k]);
        veld = som.map((v) => Math.round((v / (a.length / 4) / 255) * 10000) / 100);
      }

      // De vlakkleuren: de kleur van het prototype, en die moet een token zijn.
      const kleurFouten = [];
      for (const v of refVlakken) {
        if (!hexen.has(hex(v.kleur))) kleurFouten.push(`vlak ${v.wat} in het prototype ${hex(v.kleur)} is geen token`);
        if (maatFout) continue;
        // Valt er in de referentie een schaduw of zweem over, dan is het daar geen vlak.
        const r = pixel(refPng, v.x, v.y);
        if (r.some((c, k) => c !== v.kleur[k])) continue;
        v.geteld = true;
        const e = pixel(eigenPng, v.x, v.y);
        if (e.some((c, k) => c !== v.kleur[k])) kleurFouten.push(`vlak ${v.wat} bij ${v.x},${v.y}: ${hex(v.kleur)} verwacht, eigen ${hex(e)}`);
      }

      const fouten = [
        ...(maatFout ? [maatFout] : []),
        ...(procent >= MAX_PROCENT ? [`${procent.toFixed(2)} % afwijkend`] : []),
        ...delen.fouten,
        ...(veld && veld.some((v) => v >= MAX_VELD) ? [`kleurveld ${veld.join(" / ")} % per kanaal`] : []),
        ...kleurFouten,
      ];
      const rij = {
        staat: s.naam,
        geslaagd: fouten.length === 0,
        procent: Math.round(procent * 1000) / 1000,
        tegenHtml: Math.round(tegenHtml * 1000) / 1000,
        htmlTegenPng: Math.round(htmlTegenPng * 1000) / 1000,
        grootsteMaatafwijking: delen.grootste,
        kleurveld: veld,
        vlakken: refVlakken.filter((v) => v.geteld).length,
        fouten,
        gebieden: maatFout ? [] : gebiedenEen(verschil.data, w, h),
        eigen: `${pad}-eigen.png`,
        verschil: maatFout ? null : `${pad}-verschil.png`,
      };
      rijen.push(rij);
      console.log(`${rij.geslaagd ? "✓" : "✗"} ${s.naam}  ${rij.procent.toFixed(3)} %  maat ${rij.grootsteMaatafwijking} px${veld ? `  veld ${veld.join("/")} %` : ""}${fouten.length ? `  — ${fouten.length} punt(en)` : ""}`);
    }
  } finally {
    await browser.close();
    if (web) {
      try {
        process.kill(-web.pid);
      } catch {
        // al weg
      }
    }
  }

  writeFileSync(join(UIT, "verslag.json"), JSON.stringify({ datum: new Date().toISOString(), rijen }, null, 1));
  const tabel = [
    "| Staat | Afwijkend (PNG) | Grootste maatafwijking | Kleurveld (R/G/B) | Geslaagd | Eigen ↔ prototype | Prototype ↔ PNG |",
    "|---|---|---|---|---|---|---|",
    ...rijen.map(
      (r) =>
        `| ${r.staat} | ${r.procent.toFixed(3)} % | ${r.grootsteMaatafwijking} px | ${r.kleurveld ? r.kleurveld.map((v) => v.toFixed(2)).join(" / ") + " %" : "—"} | ${r.geslaagd ? "ja" : "nee"} | ${r.tegenHtml.toFixed(3)} % | ${r.htmlTegenPng.toFixed(3)} % |`,
    ),
  ].join("\n");
  writeFileSync(join(UIT, "tabel.md"), tabel + "\n");
  console.log("\n" + tabel);
  const mis = rijen.filter((r) => !r.geslaagd);
  console.log(`\n${rijen.length - mis.length} van ${rijen.length} geslaagd.`);
  for (const r of mis) console.log(`\n${r.staat}:\n  ${r.fouten.slice(0, 14).join("\n  ")}`);
  return mis.length ? 1 : 0;
}

/** `gebieden` op schaal 1. */
function gebiedenEen(diff, w, h) {
  return gebieden(diff, w, h).map((g) => ({ ...g, x: g.x * 2, y: g.y * 2, b: g.b * 2, h: g.h * 2 }));
}
