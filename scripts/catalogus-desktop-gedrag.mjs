/**
 * Catalogus op desktop: gedrag en beweging (briefing §3–§7).
 *
 * Beelden vangen geen beweging. Dit script opent de testpagina's
 * (/dev/catalogus-desktop/<weergave>-dicht) met beweging áán, op 1440 × 900,
 * en gaat per weergave na:
 *
 *   - klik op een stuk: het midden van de foto staat binnen 1 px van het
 *     midden van de vrije ruimte links van het paneel, en de schaal is die
 *     uit §4;
 *   - het paneel is 440 breed, raakt boven- en onderrand, ligt over de kop en
 *     bevat geen beeld van het stuk;
 *   - de berekende overgangen zijn die van §5;
 *   - op 0, 150, 350 en 700 ms en na afloop: de foto en het paneel bewegen in
 *     één richting, zonder sprong, en eindigen op het doel;
 *   - het paneel beweegt als één vlak;
 *   - sluiten met een klik links, Esc of het kruisje: de foto staat terug;
 *   - ← → dicht en open, Enter opent;
 *   - de knoppen Wand en Gloedraster wisselen, en de keuze blijft na herladen;
 *     Esc en een klik erbuiten sluiten het;
 *   - minder beweging: geen enkele overgang, meteen de eindtoestand;
 *   - lichtbak en gloedraster: het kleurveld wisselt mee.
 *
 * Uitvoer: tmp/catalogus-desktop/gedrag.json en een tabel; code 1 als iets
 * niet klopt.
 *
 *   node scripts/catalogus-desktop-gedrag.mjs              alle vier
 *   node scripts/catalogus-desktop-gedrag.mjs lichtbak     alleen deze
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tmp", "catalogus-desktop");
const PORT = Number(process.env.CATALOGUS_PORT ?? 8081);
const BASE = `http://localhost:${PORT}`;
const PANEEL = 440;

const WEERGAVEN = ["wand", "blad", "lichtbak", "gloedraster"];
const gevraagd = process.argv.slice(2).filter((a) => WEERGAVEN.includes(a));
const lijst = gevraagd.length ? gevraagd : WEERGAVEN;

/** Briefing §4. */
const SCHAAL = { wand: [1.7, 0.74], blad: [1.7, 0.74], gloedraster: [3.2, 0.74], lichtbak: [1.5, 0.82] };
/** Het stuk dat open gaat, en het tweede voor ← →. */
const STUK = { wand: "2", blad: "2", lichtbak: "1", gloedraster: "3" };

const FOTO = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const PAN = "cubic-bezier(0.3, 0.7, 0.25, 1)";

mkdirSync(OUT, { recursive: true });

const uitslag = [];
function noteer(weergave, controle, ok, detail = "") {
  uitslag.push({ weergave, controle, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${weergave.padEnd(12)} ${controle}${detail ? `  — ${detail}` : ""}`);
}

const r1 = (v) => Math.round(v * 10) / 10;

async function wacht(page) {
  await page.waitForSelector('[data-testid="desktop"]', { timeout: 60_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
  });
  await page.waitForTimeout(400);
}

/** De foto van een stuk, het vlak, en het paneel, in het venster. */
async function stand(page, id) {
  return page.evaluate((id) => {
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, b: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    };
    const stuk = document.querySelector(`[data-meet="stuk"][data-id="${id}"]`);
    const foto = stuk?.querySelector('[data-meet="foto"]');
    return {
      foto: r(foto),
      basis: foto ? { b: foto.offsetWidth, h: foto.offsetHeight } : null,
      vlak: r(document.querySelector('[data-meet="vlak"]')),
      paneel: r(document.querySelector('[data-meet="drawer"]')),
      track: (() => {
        const t = document.querySelector('[data-meet="track"]');
        return t ? new DOMMatrix(getComputedStyle(t).transform).e : null;
      })(),
    };
  }, id);
}

/**
 * Klikken met de muis op het midden van een element, zoals een gebruiker.
 * (Playwrights eigen controle weigert de knop Weergave op het blad, ook in het
 * prototype, terwijl het element onder de muis wél de knop is.)
 */
async function klik(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`niet gevonden: ${sel}`);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

/** Het verwachte doel volgens §4, los van de app uitgerekend. */
function verwacht(w, s, venster) {
  const [max, deel] = SCHAAL[w];
  const links = s.vlak.x;
  const rechts = Math.min(s.vlak.x + s.vlak.b, venster.b - PANEEL);
  const vrij = rechts - links;
  const schaal = Math.min(max, (s.vlak.h * deel) / s.basis.h, (vrij * 0.8) / s.basis.b);
  return { cx: (links + rechts) / 2, cy: s.vlak.y + s.vlak.h / 2, schaal };
}

async function opnameOpenen(page, id) {
  // Klikken en meten in de pagina zelf, op vaste momenten na de klik.
  return page.evaluate(async (id) => {
    const el = document.querySelector(`[data-meet="stuk"][data-id="${id}"]`);
    const foto = () => el.querySelector('[data-meet="foto"]').getBoundingClientRect();
    const paneel = () => document.querySelector('[data-meet="drawer"]')?.getBoundingClientRect() ?? null;
    const punt = (t) => {
      const f = foto();
      const p = paneel();
      return { t, cx: f.x + f.width / 2, cy: f.y + f.height / 2, b: f.width, px: p ? p.x : null };
    };
    const uit = [];
    const t0 = performance.now();
    el.click();
    uit.push(punt(0));
    for (const t of [150, 350, 700]) {
      await new Promise((res) => setTimeout(res, Math.max(0, t - (performance.now() - t0))));
      uit.push(punt(Math.round(performance.now() - t0)));
    }
    await new Promise((res) => setTimeout(res, 900));
    uit.push(punt(Math.round(performance.now() - t0)));
    return uit;
  }, id);
}

/** Loopt een reeks in één richting naar het doel, zonder sprong? */
function eenRichting(reeks, doel, sleutel) {
  const afstand = reeks.map((p) => Math.abs(p[sleutel] - doel));
  for (let i = 1; i < afstand.length; i++) if (afstand[i] > afstand[i - 1] + 0.5) return `${sleutel} loopt terug bij ${reeks[i].t} ms`;
  const start = afstand[0];
  if (start > 2 && afstand[1] < start * 0.02 && reeks[1].t < 120) return `${sleutel} sprong meteen naar het doel`;
  if (afstand[afstand.length - 1] > 1) return `${sleutel} eindigt ${r1(afstand[afstand.length - 1])} px naast het doel`;
  return null;
}

async function overgang(page, sel) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      prop: s.transitionProperty,
      duur: s.transitionDuration,
      verloop: s.transitionTimingFunction,
      anim: s.animationName,
      animDuur: s.animationDuration,
      animVerloop: s.animationTimingFunction,
    };
  }, sel);
}

/** De duur en het verloop van één eigenschap in een transition-lijst. */
function van(o, prop) {
  if (!o) return null;
  const props = o.prop.split(", ");
  const duren = o.duur.split(", ");
  const verlopen = o.verloop.split(/, (?=[a-z])/);
  const i = props.indexOf(prop) >= 0 ? props.indexOf(prop) : props.indexOf("all");
  if (i < 0) return null;
  return { duur: duren[i % duren.length], verloop: verlopen[i % verlopen.length] };
}

function zelfde(o, duur, verloop) {
  return !!o && o.duur === duur && o.verloop === verloop;
}

const browser = await chromium.launch({ args: ["--force-device-scale-factor=1"] });
try {
  for (const w of lijst) {
    const id = STUK[w];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    const venster = { b: 1440, h: 900 };
    await page.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht`);
    await wacht(page);

    // ---- overgangen in rust (§5) ----
    if (w === "wand" || w === "blad") {
      noteer(w, "wand schuift: 0,7 s", zelfde(van(await overgang(page, '[data-meet="track"]'), "transform"), "0.7s", FOTO));
      const hov = await overgang(page, `[data-meet="stuk"][data-id="1"] [data-meet="foto"]`);
      noteer(w, "stuk onder de muis: 0,3 s", zelfde(van(hov, "transform"), "0.3s", FOTO) && van(hov, "box-shadow")?.duur === "0.3s");
      await page.hover(`[data-meet="stuk"][data-id="1"] [data-meet="foto"]`);
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const f = document.querySelector('[data-meet="stuk"][data-id="1"] [data-meet="foto"]');
        const s = getComputedStyle(f);
        return { t: s.transform, schaduw: s.boxShadow };
      });
      noteer(w, "stuk onder de muis: 8 px omhoog met schaduw", m.t === "matrix(1, 0, 0, 1, 0, -8)" && m.schaduw !== "none", `${m.t}`);
      await page.mouse.move(5, 895);
      await page.waitForTimeout(400);
    }
    if (w === "gloedraster") {
      const hov = await overgang(page, `[data-meet="stuk"][data-id="1"] [data-meet="foto"]`);
      noteer(w, "stuk onder de muis: 0,7 s", zelfde(van(hov, "transform"), "0.7s", FOTO));
      await page.hover(`[data-meet="stuk"][data-id="1"]`);
      await page.waitForTimeout(900);
      const t = await page.evaluate(() => getComputedStyle(document.querySelector('[data-meet="stuk"][data-id="1"] [data-meet="foto"]')).transform);
      const m = (t.match(/^matrix\((.*)\)$/)?.[1] ?? "").split(", ").map(Number);
      noteer(w, "stuk onder de muis: 8 % groter, 6 px omhoog", Math.abs(m[0] - 1.08) < 1e-3 && Math.abs(m[5] + 6 * 1.08) < 0.01, t);
    }
    if (w === "lichtbak" || w === "gloedraster") {
      const k = await overgang(page, '[data-meet="kleurveld"] > div');
      noteer(w, "kleurveld kruist: 0,9 s", zelfde(van(k, "opacity"), "0.9s", "ease"));
    }

    // ---- kleurveld wisselt mee (lichtbak: gekozen stuk; gloedraster: ook de muis) ----
    const veld = () =>
      page.evaluate(() => {
        const on = document.querySelector('[data-meet="kleurveld"] > div.on');
        return on ? on.style.backgroundImage : null;
      });
    if (w === "lichtbak") {
      const voor = await veld();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(100);
      const na = await veld();
      const rise = await overgang(page, '[data-meet="lichtbak-titel"]');
      noteer(w, "nieuw stuk verschijnt: 0,35 s, 12 px omhoog", rise?.anim === "cd-rise" && rise.animDuur === "0.35s" && rise.animVerloop === FOTO, rise ? `${rise.anim} ${rise.animDuur}` : "");
      noteer(w, "→ dicht: volgend stuk", (await page.textContent('[data-meet="lichtbak-titel"] .S')) === "Plaat 02 van 08");
      noteer(w, "kleurveld wisselt met het gekozen stuk", !!voor && !!na && voor !== na);
      await page.click('[data-meet="vakje"]:nth-child(5)');
      await page.waitForTimeout(100);
      noteer(w, "strook kiest een stuk", (await page.textContent('[data-meet="lichtbak-titel"] .S')) === "Plaat 05 van 08");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(1000);
      noteer(w, "← dicht: vorig stuk", (await page.textContent('[data-meet="lichtbak-titel"] .S')) === "Plaat 01 van 08");
    }
    if (w === "gloedraster") {
      await page.hover(`[data-meet="stuk"][data-id="6"]`);
      await page.waitForTimeout(100);
      const a = await veld();
      await page.hover(`[data-meet="stuk"][data-id="7"]`);
      await page.waitForTimeout(100);
      const b = await veld();
      noteer(w, "kleurveld wisselt met het vak onder de muis", !!a && !!b && a !== b && /raket/.test(a) && /kat\./.test(b), `${a?.slice(-30)} → ${b?.slice(-30)}`);
      await page.mouse.move(5, 895);
    }

    // ---- ← → dicht bij de wand ----
    if (w === "wand" || w === "blad") {
      const t0 = (await stand(page, id)).track;
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(900);
      const t1 = (await stand(page, id)).track;
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(900);
      const t2 = (await stand(page, id)).track;
      noteer(w, "→ dicht: de wand schuift 380 px", Math.abs(t1 - t0 + 380) < 0.5 && Math.abs(t2 - t0) < 0.5, `${r1(t0)} → ${r1(t1)} → ${r1(t2)}`);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(900);
      noteer(w, "← aan het begin: de wand stopt", Math.abs((await stand(page, id)).track) < 0.5);
      // Het wiel, tot het einde.
      await page.mouse.move(700, 450);
      for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 400);
      await page.waitForTimeout(500);
      const eind = await page.evaluate(() => {
        const w = document.querySelector('[data-meet="vlak"]');
        const t = document.querySelector('[data-meet="track"]');
        return { x: new DOMMatrix(getComputedStyle(t).transform).e, min: w.clientWidth - t.offsetWidth };
      });
      noteer(w, "het wiel schuift zijwaarts en stopt aan het einde", Math.abs(eind.x - eind.min) < 0.5, `${r1(eind.x)} / ${r1(eind.min)}`);
      for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -400);
      await page.waitForTimeout(500);
    }

    // ---- openen ----
    // De muis op een lege plek: een stuk onder de muis staat 8 px hoger.
    await page.mouse.move(720, 20);
    await page.waitForTimeout(500);
    const voor = await stand(page, id);
    if (!voor.foto) {
      noteer(w, "stuk gevonden", false, `geen stuk ${id}`);
      await ctx.close();
      continue;
    }
    // Het doel volgens de briefing: gemeten in rust, de foto zonder transform.
    const doel = verwacht(w, voor, venster);
    const reeks = await opnameOpenen(page, id);
    const na = await stand(page, id);
    const dx = na.foto.cx - doel.cx;
    const dy = na.foto.cy - doel.cy;
    noteer(w, "foto in het midden van de vrije ruimte (±1 px)", Math.abs(dx) <= 1 && Math.abs(dy) <= 1, `Δ ${r1(dx)}, ${r1(dy)} px`);
    const schaal = na.foto.b / voor.basis.b;
    noteer(w, `schaal ${doel.schaal.toFixed(3)} (§4)`, Math.abs(schaal - doel.schaal) < 0.005, `${schaal.toFixed(3)}`);
    const p = na.paneel;
    noteer(w, "paneel 440 breed, boven- en onderrand", !!p && Math.abs(p.b - PANEEL) < 0.5 && Math.abs(p.y) < 0.5 && Math.abs(p.y + p.h - venster.h) < 0.5 && Math.abs(p.x + p.b - venster.b) < 0.5, p ? `${r1(p.x)},${r1(p.y)} ${r1(p.b)}×${r1(p.h)}` : "geen paneel");
    const over = await page.evaluate(() => {
      const d = document.querySelector('[data-meet="drawer"]');
      const kop = document.querySelector('[data-meet="kop"], [data-meet="tabs"]');
      const x = innerWidth - 220;
      const y = kop ? Math.min(kop.getBoundingClientRect().bottom - 10, 28) : 28;
      const top = document.elementFromPoint(x, y);
      const beeld = [...d.querySelectorAll("img")].map((i) => i.src);
      const stuk = document.querySelector('[data-meet="stuk"][aria-current] [data-meet="foto"] img')?.src;
      return { over: d.contains(top), beelden: beeld.length, metStuk: !!stuk && beeld.includes(stuk) };
    });
    noteer(w, "paneel ligt over de kop", over.over);
    noteer(w, "paneel toont het beeld niet", !over.metStuk && over.beelden === 0, `${over.beelden} beeld(en)`);

    // De beweging, 0 / 150 / 350 / 700 ms en na afloop.
    const fx = eenRichting(reeks, reeks[reeks.length - 1].cx, "cx") ?? eenRichting(reeks, reeks[reeks.length - 1].cy, "cy");
    const fb = eenRichting(reeks, reeks[reeks.length - 1].b, "b");
    const pr = reeks.filter((r) => r.px !== null);
    const fp = eenRichting(pr, venster.b - PANEEL, "px");
    const pad = reeks.map((r) => `${r.t}ms ${r1(r.cx)},${r1(r.cy)} ${r1(r.b)}${r.px !== null ? ` p${r1(r.px)}` : ""}`).join(" | ");
    noteer(w, "foto: één richting, geen sprong, eindigt op het doel", !fx && !fb && Math.abs(reeks[reeks.length - 1].cx - doel.cx) <= 1, fx ?? fb ?? pad);
    noteer(w, "paneel: één richting, geen sprong, eindigt op het doel", !fp && pr.length >= 4 && pr[0].px > venster.b - PANEEL + 100, fp ?? pr.map((r) => r1(r.px)).join(" → "));

    // Duur en verloop terwijl het open is.
    const f = van(await overgang(page, `[data-meet="stuk"][data-id="${id}"] [data-meet="foto"]`), "transform");
    noteer(w, "foto naar het midden: 0,7 s", zelfde(f, "0.7s", FOTO), f ? `${f.duur} ${f.verloop}` : "");
    const d = await overgang(page, '[data-meet="drawer"]');
    noteer(w, "paneel schuift in: 0,42 s", d?.anim === "cd-slide" && d.animDuur === "0.42s" && d.animVerloop === PAN, d ? `${d.anim} ${d.animDuur} ${d.animVerloop}` : "");
    if (w === "wand" || w === "blad") {
      const ander = await overgang(page, `[data-meet="stuk"][data-id="1"]`);
      noteer(w, "andere stukken verbleken: 0,45 s", zelfde(van(ander, "opacity"), "0.45s", "ease") && zelfde(van(ander, "filter"), "0.45s", "ease"));
      const o = await page.evaluate(() => getComputedStyle(document.querySelector('[data-meet="stuk"][data-id="1"]')).opacity);
      noteer(w, "andere stukken op 14 %", o === "0.14", o);
    } else if (w === "gloedraster") {
      const ander = await overgang(page, `[data-meet="stuk"][data-id="1"]`);
      noteer(w, "andere stukken verbleken: 0,45 s", zelfde(van(ander, "opacity"), "0.45s", "ease"));
      const o = await page.evaluate(() => getComputedStyle(document.querySelector('[data-meet="stuk"][data-id="1"]')).opacity);
      noteer(w, "andere stukken op 14 %", o === "0.14", o);
    } else {
      const s = await overgang(page, '[data-meet="strook"]');
      noteer(w, "strook verbleekt: 0,45 s", zelfde(van(s, "opacity"), "0.45s", "ease"));
      const o = await page.evaluate(() => getComputedStyle(document.querySelector('[data-meet="strook"]')).opacity);
      noteer(w, "strook op 14 %", o === "0.14", o);
    }

    // Het paneel als één vlak.
    const eigen = await page.evaluate(() => {
      const d = document.querySelector('[data-meet="drawer"]');
      const fout = [];
      for (const el of d.querySelectorAll("*")) {
        if (el.closest(".act")) continue; // het hartje dat even groter wordt als je drukt
        const s = getComputedStyle(el);
        const duur = s.transitionDuration.split(", ").some((v) => v !== "0s");
        if (duur || s.animationName !== "none") fout.push(`${el.tagName.toLowerCase()}.${el.className}`);
      }
      return fout;
    });
    noteer(w, "paneel als één vlak (geen eigen overgang erin)", eigen.length === 0, eigen.slice(0, 3).join(", "));

    // ← → open: ander stuk, het nieuwe neemt de plek links in.
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1100);
    const volgend = String(Number(id) + 1);
    const nu = await page.evaluate(() => document.querySelector('[data-meet="stuk"][aria-current]')?.getAttribute("data-id") ?? null);
    const sv = await stand(page, volgend);
    noteer(w, "→ open: volgend stuk op de plek links", nu === volgend && Math.abs(sv.foto.cx - doel.cx) <= 1 && Math.abs(sv.foto.cy - doel.cy) <= 1, `stuk ${nu}, Δ ${r1(sv.foto.cx - doel.cx)}, ${r1(sv.foto.cy - doel.cy)}`);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(1100);
    const terug = await page.evaluate(() => document.querySelector('[data-meet="stuk"][aria-current]')?.getAttribute("data-id") ?? null);
    noteer(w, "← open: vorig stuk", terug === id, `stuk ${terug}`);
    // De pijl in het paneel.
    await page.click('[aria-label="Volgende bijdrage"]');
    await page.waitForTimeout(1100);
    const pijl = await page.evaluate(() => document.querySelector('[data-meet="stuk"][aria-current]')?.getAttribute("data-id") ?? null);
    noteer(w, "→ in het paneel: volgend stuk", pijl === volgend, `stuk ${pijl}`);
    await page.click('[aria-label="Vorige bijdrage"]');
    await page.waitForTimeout(1100);

    // Sluiten, drie manieren; daarna staat de foto terug.
    for (const [hoe, doe] of [
      ["klik links van het paneel", () => page.mouse.click(200, 450)],
      ["Esc", () => page.keyboard.press("Escape")],
      ["het kruisje", () => page.click('[aria-label="Sluit"]')],
    ]) {
      const open = await page.evaluate(() => !!document.querySelector('[data-meet="drawer"]:not(.weg)'));
      if (!open) {
        await page.click(`[data-meet="stuk"][data-id="${id}"]`);
        await page.waitForTimeout(1100);
      }
      // Het menu kan niet onder het paneel door: eerst zeker dicht.
      let weg = null;
      if (hoe === "Esc") {
        // Duur en verloop van het wegschuiven, meteen na Esc.
        await doe();
        weg = await overgang(page, '[data-meet="drawer"]');
      } else await doe();
      await page.mouse.move(720, 20);
      await page.waitForTimeout(1100);
      const s = await stand(page, id);
      const dicht = !s.paneel;
      const opPlek = Math.abs(s.foto.x - voor.foto.x) <= 1 && Math.abs(s.foto.y - voor.foto.y) <= 1 && Math.abs(s.foto.b - voor.foto.b) <= 1;
      noteer(w, `sluiten met ${hoe}: foto terug op zijn plek`, dicht && opPlek, `${dicht ? "dicht" : "nog open"}, Δ ${r1(s.foto.x - voor.foto.x)}, ${r1(s.foto.y - voor.foto.y)}`);
      if (weg) {
        const t = van(weg, "transform");
        noteer(w, "paneel schuift weg: 0,36 s", zelfde(t, "0.36s", PAN), t ? `${t.duur} ${t.verloop}` : "");
      }
    }

    // Enter opent het gekozen stuk.
    await page.mouse.click(720, 20);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1100);
    const enter = await page.evaluate(() => document.querySelector('[data-meet="stuk"][aria-current]')?.getAttribute("data-id") ?? null);
    noteer(w, "Enter opent het gekozen stuk", enter === id, `stuk ${enter}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);

    // ---- naar de pagina van de bijdrage: de open foto en de titel in het paneel ----
    for (const [hoe, doe] of [
      ["de open foto", async () => klik(page, `[data-meet="stuk"][data-id="${id}"] [data-meet="foto"]`)],
      ["de titel in het paneel", async () => klik(page, '[data-meet="naarpagina"]')],
    ]) {
      await page.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht`);
      await wacht(page);
      await page.click(`[data-meet="stuk"][data-id="${id}"]`);
      await page.waitForTimeout(1100);
      if (hoe === "de open foto") {
        const f = await page.locator(`[data-meet="stuk"][data-id="${id}"] [data-meet="foto"]`).boundingBox();
        await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
        const cursor = await page.evaluate(() => getComputedStyle(document.querySelector('[data-meet="scrim"]')).cursor);
        noteer(w, "boven de open foto: de cursor vergroot", cursor === "zoom-in", cursor);
      }
      await doe();
      await page.waitForTimeout(300);
      const naar = await page.evaluate(() => document.querySelector('[data-meet="bijdragepagina"]')?.getAttribute("data-id") ?? null);
      noteer(w, `klik op ${hoe}: naar de bijdragepagina`, naar === id, `stuk ${naar}`);
    }
    // ---- een @naam in een reactie: naar dat profiel ----
    await page.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht`);
    await wacht(page);
    await page.click(`[data-meet="stuk"][data-id="${id}"]`);
    await page.waitForTimeout(1100);
    await page.fill('[data-meet="paneel-invoer"] input', "dankje @mie!");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    const naam = await page.evaluate(() => {
      const a = document.querySelector('[data-meet="paneel-draad"] a.naam[data-gebruiker="mie"]');
      return a ? { tekst: a.textContent, dik: getComputedStyle(a).fontWeight } : null;
    });
    noteer(w, "@mie in een reactie: vet en klikbaar", !!naam && naam.tekst === "@mie" && naam.dik === "600", JSON.stringify(naam));
    await klik(page, '[data-meet="paneel-draad"] a.naam[data-gebruiker="mie"]');
    await page.waitForTimeout(200);
    const profiel = await page.evaluate(() => document.querySelector('[data-meet="profielpagina"]')?.getAttribute("data-gebruiker") ?? null);
    noteer(w, "klik op @mie: naar het profiel van mie", profiel === "mie", `${profiel}`);

    await page.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht`);
    await wacht(page);

    // ---- je eigen bijdrage: bewerken en verwijderen (⋯) ----
    noteer(w, "bijdrage van een ander: geen ⋯", !(await page.evaluate(() => !!document.querySelector('[data-meet="eigenknop"]'))));
    await page.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht?eigen=1`);
    await wacht(page);
    await page.click(`[data-meet="stuk"][data-id="${id}"]`);
    await page.waitForTimeout(1100);
    const knopE = await page.evaluate(() => {
      const b = document.querySelector('[data-meet="eigenknop"]');
      const r = b?.getBoundingClientRect();
      return b ? { pop: b.getAttribute("aria-haspopup"), h: r.height, b: r.width, bericht: [...document.querySelectorAll('[data-meet="drawer"] .link')].length } : null;
    });
    noteer(w, "eigen bijdrage: ⋯ in het paneel (44 × 44), geen \"Bericht aan\"", !!knopE && knopE.pop === "true" && knopE.h === 44 && knopE.b === 44 && knopE.bericht === 0, JSON.stringify(knopE));
    await klik(page, '[data-meet="eigenknop"]');
    const items = await page.$$eval('[data-meet="eigenmenu"] [role="menuitem"]', (l) => l.map((e) => e.textContent));
    noteer(w, "⋯ toont Bewerk en Verwijder", items.join("|") === "Bewerk deze bijdrage|Verwijder deze bijdrage", items.join("|"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    const naEsc = await page.evaluate(() => ({ menu: !!document.querySelector('[data-meet="eigenmenu"]'), paneel: !!document.querySelector('[data-meet="drawer"]:not(.weg)') }));
    noteer(w, "Esc sluit het menu ⋯, niet het paneel", !naEsc.menu && naEsc.paneel);
    await klik(page, '[data-meet="eigenknop"]');
    await page.click('[data-meet="eigenmenu"] [role="menuitem"]:first-child');
    await page.waitForTimeout(100);
    const vorm = await page.evaluate(() => ({
      form: !!document.querySelector('[data-meet="bewerk"] [data-meet="bewerkformulier"]'),
      invoer: getComputedStyle(document.querySelector('[data-meet="paneel-invoer"]')).display,
    }));
    noteer(w, "Bewerk: het formulier in het paneel, zonder reactieveld", vorm.form && vorm.invoer === "none", JSON.stringify(vorm));
    await page.fill('[data-meet="bewerkformulier"] input', "Nieuwe titel");
    await page.click('[data-meet="bewerkformulier"] button[type="submit"]');
    await page.waitForTimeout(100);
    const titelNa = await page.textContent('[data-meet="paneel-titel"] .T');
    const formWeg = await page.evaluate(() => !document.querySelector('[data-meet="bewerk"]'));
    noteer(w, "Bewaar: nieuwe titel in het paneel, formulier weg", titelNa === "Nieuwe titel" && formWeg, titelNa ?? "");
    await klik(page, '[data-meet="eigenknop"]');
    await page.click('[data-meet="eigenmenu"] [role="menuitem"]:last-child');
    await page.waitForTimeout(1100);
    const weg = await page.evaluate((id) => ({ paneel: !!document.querySelector('[data-meet="drawer"]'), stuk: !!document.querySelector(`[data-meet="stuk"][data-id="${id}"]`), open: !!document.querySelector('[data-meet="stuk"][aria-current]') }), id);
    // Lichtbak toont één stuk: daar staat na verwijderen het volgende.
    noteer(w, "Verwijder: paneel dicht, stuk weg", !weg.paneel && !weg.stuk && !weg.open, JSON.stringify(weg));

    // ---- de weergave in de bovenbalk: Wand en Gloedraster ----
    await page.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht?bewaar=1`);
    await page.evaluate((w) => localStorage.setItem("lincin.weergave.dev", w), w);
    await page.reload();
    await wacht(page);
    const knoppen = await page.evaluate(() =>
      [...document.querySelectorAll('[data-meet="wkkeuze"]')].map((b) => [b.dataset.w, b.getAttribute("role"), b.getAttribute("aria-checked"), Math.round(b.getBoundingClientRect().height)]),
    );
    // Wand op blad en Lichtbak kies je niet meer: bewaard worden ze de wand.
    const bewaardeW = w === "gloedraster" ? "gloedraster" : "wand";
    noteer(
      w,
      "bovenbalk: twee knoppen Wand en Gloedraster, de bewaarde aan",
      knoppen.length === 2 && knoppen.every((k) => k[1] === "radio" && k[3] === 40) && knoppen.find((k) => k[2] === "true")?.[0] === bewaardeW,
      JSON.stringify(knoppen),
    );
    const naar = bewaardeW === "wand" ? "gloedraster" : "wand";
    await klik(page, `[data-meet="wkkeuze"][data-w="${naar}"]`);
    await page.waitForTimeout(100);
    const isNaar = (naar) => (naar === "gloedraster" ? !!document.querySelector(".gg") : !document.querySelector(".gg") && !document.querySelector(".light"));
    const gewisseld = await page.evaluate(isNaar, naar);
    await page.reload();
    await wacht(page);
    const bewaard = await page.evaluate(isNaar, naar);
    noteer(w, `een klik wisselt naar ${naar}, en blijft na herladen`, gewisseld && bewaard);
    const standVoor = await page.evaluate(() => document.querySelector("[data-stand]")?.getAttribute("data-stand"));
    await klik(page, '[data-meet="wkstand"]');
    await page.waitForTimeout(50);
    const standNa = await page.evaluate(() => document.querySelector("[data-stand]")?.getAttribute("data-stand"));
    noteer(w, "de knop licht/donker wisselt de stand", !!standVoor && !!standNa && standVoor !== standNa, `${standVoor} → ${standNa}`);
    await page.evaluate(() => localStorage.removeItem("lincin.weergave.dev"));
    await ctx.close();

    // ---- minder beweging ----
    const still = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const sp = await still.newPage();
    await sp.goto(`${BASE}/dev/catalogus-desktop/${w}-dicht`);
    await wacht(sp);
    const rv = await stand(sp, id);
    const rd = verwacht(w, rv, venster);
    const meteen = await sp.evaluate(async (id) => {
      const el = document.querySelector(`[data-meet="stuk"][data-id="${id}"]`);
      el.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const f = el.querySelector('[data-meet="foto"]').getBoundingClientRect();
      const p = document.querySelector('[data-meet="drawer"]').getBoundingClientRect();
      const bewegend = [];
      for (const e of document.querySelectorAll('[data-testid="desktop"], [data-testid="desktop"] *')) {
        const s = getComputedStyle(e);
        if (s.transitionDuration.split(", ").some((v) => v !== "0s") || s.animationName !== "none") bewegend.push(`${e.tagName.toLowerCase()}.${e.className}`);
      }
      return { cx: f.x + f.width / 2, cy: f.y + f.height / 2, px: p.x, bewegend };
    }, id);
    noteer(w, "minder beweging: geen enkele overgang", meteen.bewegend.length === 0, meteen.bewegend.slice(0, 3).join(", "));
    noteer(
      w,
      "minder beweging: meteen de eindtoestand",
      Math.abs(meteen.cx - rd.cx) <= 1 && Math.abs(meteen.cy - rd.cy) <= 1 && Math.abs(meteen.px - (venster.b - PANEEL)) < 0.5,
      `Δ ${r1(meteen.cx - rd.cx)}, ${r1(meteen.cy - rd.cy)}; paneel ${r1(meteen.px)}`,
    );
    await sp.keyboard.press("Escape");
    await sp.waitForTimeout(50);
    const s2 = await stand(sp, id);
    noteer(w, "minder beweging: sluiten meteen", !s2.paneel && Math.abs(s2.foto.x - rv.foto.x) <= 1 && Math.abs(s2.foto.y - rv.foto.y) <= 1);
    await still.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(OUT, "gedrag.json"), JSON.stringify({ datum: new Date().toISOString(), uitslag }, null, 1));
const mis = uitslag.filter((u) => !u.ok);
console.log(`\n${uitslag.length - mis.length} van ${uitslag.length} controles kloppen.`);
if (mis.length) {
  for (const u of mis) console.log(`  ✗ ${u.weergave}: ${u.controle}${u.detail ? ` — ${u.detail}` : ""}`);
  process.exit(1);
}
