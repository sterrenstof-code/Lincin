import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance, Platform } from "react-native";

/**
 * ===============================================================
 * LINCIN v2 — papier en inkt, één kleur per vriend, en drie thema's
 * ===============================================================
 *
 * Het palet uit `HANDOFF.md` en `WIJZIGINGEN-2.2.md`. Twee standen,
 * "licht" en "donker", en drie thema's die de héle app veranderen:
 *
 *   KLEUR     (standaard) papier #F2EFE8 / inkt #141414, kaders 1.5px
 *             inkt, koppen Archivo 900 smal kapitaal, geen ronding,
 *             vriendbanden gevuld, actieve tab = inktvlak, het blad tint
 *             mee met de vriend in beeld — als kleur van boven (2.2 §4).
 *   MAGAZINE  papier #F7F4EE / #14120E, haarlijnen 1px inkt, koppen
 *             Instrument Serif (geen kapitaal), poster-spreads met een
 *             naad van 6px, accent #F06A2B / #D9A05B (2.2 §2).
 *   MODERN    papier #F4F1EB / #0C0C0D, een bento-rooster van tegels op
 *             een zachte kleurhaze, koppen in gewone Archivo (2.2 §1).
 *
 * Wat een thema vastlegt staat in `SPEC` (maten, stijlen) en in
 * `paletteFor()` (kleuren). Sinds 2.2 kennen álle drie de thema's een
 * lichte én een donkere stand; in 2.1 stond magazine nog op licht vast.
 *
 *   PAPER    het blad         #F2EFE8 / #1A1917
 *   PAPER 2  tweede vlak      #E7E3D8 / #232220   (media, metakolom)
 *   INK      de inkt          #141414 / #EDE8DD
 *   DIM      inkt op 58%/62%  — bijschriften, meta
 *   RULE     inkt op 20%      — haarlijnen bínnen een kaart
 *   LINE     de kaderlijn     — inkt
 *   ACID     #E5FF3A / #D9F04A — de oproep-kaart, actieve tab in een blad
 *   RED      #D8321F / #E4553F — ongelezen, nieuw
 *
 * En zes vriendkleuren. Elke vriend (of groep) bezit er één; die kleur
 * draagt zijn band in de feed, de titelstrook van zijn kaart, zijn
 * avatar, en tint het hele blad zodra hij in beeld is (`pageTint`).
 *
 * ---------------------------------------------------------------
 * DE OUDE NAMEN BESTAAN NOG
 * ---------------------------------------------------------------
 * Zo'n duizend klassen en props in de rest van de app wijzen naar `page`,
 * `panel`, `shell`, `cream`, `flame`, `announce`… Die namen blijven
 * bestaan en krijgen hier de v2-waarden — dezelfde zet als bij de v3- en
 * v4-uitrol: de namen houden, de waarden verplaatsen. Zo kleurt élk
 * scherm meteen mee, ook wat nog niet herbouwd is.
 *
 * ---------------------------------------------------------------
 * WAAROM TRIPLETS EN GEEN HEX
 * ---------------------------------------------------------------
 * De waarden staan als `"R G B"`. Dat is de vorm die CSS nodig heeft om
 * `rgb(var(--c-ink) / 0.58)` te kunnen schrijven — één variabele die zowel
 * dekkend als doorzichtig gebruikt kan worden. Native leest dezelfde
 * triplets en zet ze zelf om naar `rgba(...)`.
 */

export type Scheme = "light" | "dark";

/** Wat de gebruiker koos. `system` volgt het besturingssysteem. */
export type ThemePreference = "system" | "light" | "dark";

/** Het thema: kleur (standaard), magazine of modern. Per gebruiker bewaard. */
export type LincinTheme = "kleur" | "magazine" | "modern";

export const THEMES: LincinTheme[] = ["kleur", "magazine", "modern"];

export function isLincinTheme(v: unknown): v is LincinTheme {
  return v === "kleur" || v === "magazine" || v === "modern";
}

/**
 * Het raster van 2.2 (WIJZIGINGEN-2.2 §1 en §2).
 *
 * Eén set maten die modern (bento) en magazine (poster-spreads) delen: de
 * naad tussen twee vlakken, de ronding en de binnenpadding van een tegel,
 * en de breedte van de verticale metarail. Ze staan hier en niet in de
 * onderdelen zelf, zodat een tegel in de feed en een tegel in Instellingen
 * dezelfde maat houden.
 */
export const RASTER = {
  /** De naad tussen twee tegels én de buitenmarge. */
  seam: 6,
  /** De ronding van een tegel (modern). Magazine-spreads hebben er geen. */
  tileRadius: 18,
  /** De binnenpadding van een tegel: 18 gewoon, 22 voor een titeltegel. */
  tilePad: 18,
  tilePadLarge: 22,
  /** De verticale metarail naast een magazine-spread. */
  rail: 26,
} as const;

type Token =
  // ---- v2 ----
  | "paper"
  | "paper2"
  | "acid"
  | "red"
  | "line"
  // ---- 2.2: het vlak van een bento-tegel (modern) ----
  | "tile"
  // ---- de oude namen, met v2-waarden ----
  | "page"
  | "panel"
  | "paperWarm"
  | "paperLight"
  | "shell"
  | "shellSoft"
  | "desk"
  | "deskInk"
  | "deskSoft"
  | "deskMuted"
  | "deskPanel"
  | "ink"
  | "inkSoft"
  | "inkMuted"
  | "cream"
  | "creamSoft"
  | "creamMuted"
  | "post"
  | "postText"
  | "postFill"
  | "flame"
  | "flameDeep"
  | "announce"
  | "announceDeep"
  | "teal"
  | "gold"
  | "brand";

/** Doorzichtigheden die per stand of thema verschillen. */
type AlphaToken =
  | "postDim"
  | "postRule"
  | "linePaper"
  | "inkDim"
  | "onDark"
  | "pill"
  | "pillSoft"
  | "cardEdge"
  /** De dekking van een bento-tegel: .82 op licht, .9 op donker. */
  | "tileFill"
  /** Een gestippelde scheiding bínnen een tegel: inkt op 26%. */
  | "dash";

type Palette = Record<Token, string>;
type Alphas = Record<AlphaToken, number>;

/**
 * Alle tokennamen, in volgorde. `app/+html.tsx` loopt hier doorheen om de
 * `--p-*`-variabelen uit te schrijven; zie `color()` onderaan.
 */
const TOKENS: Token[] = [
  "paper", "paper2", "acid", "red", "line", "tile",
  "page", "panel", "paperWarm", "paperLight",
  "shell", "shellSoft",
  "desk", "deskInk", "deskSoft", "deskMuted", "deskPanel",
  "ink", "inkSoft", "inkMuted",
  "cream", "creamSoft", "creamMuted",
  "post", "postText", "postFill",
  "flame", "flameDeep", "announce", "announceDeep",
  "teal", "gold", "brand",
];

const ALPHA_TOKENS: AlphaToken[] = [
  "postDim", "postRule", "linePaper", "inkDim", "onDark", "pill", "pillSoft", "cardEdge",
  "tileFill", "dash",
];

/**
 * LICHT.
 *
 * `inkMuted` is de "dim" (inkt op 58%) plat op papier gelegd, voor de
 * plekken die een dekkende kleur nodig hebben. `shellSoft` en
 * `announceDeep` zijn de inkt "ingedrukt": één stap lichter.
 */
const LIGHT: Palette = {
  paper: "242 239 232", // #F2EFE8
  paper2: "231 227 216", // #E7E3D8
  acid: "229 255 58", // #E5FF3A
  red: "216 50 31", // #D8321F
  line: "20 20 20", // = ink
  tile: "255 255 255", // het tegelvlak van modern; kleur gebruikt het niet

  page: "242 239 232", // = paper
  panel: "242 239 232", // = paper — een kaart heeft geen eigen vulling
  paperWarm: "231 227 216", // = paper2
  paperLight: "242 239 232", // = paper
  shell: "20 20 20", // = ink — een gevuld vlak
  shellSoft: "43 43 43", // ink, ingedrukt
  desk: "242 239 232",
  deskInk: "20 20 20",
  deskSoft: "58 58 58",
  deskMuted: "113 113 112",
  deskPanel: "231 227 216",
  ink: "20 20 20", // #141414
  inkSoft: "58 58 58", // #3A3A3A
  inkMuted: "113 113 112", // dim op papier
  cream: "242 239 232", // = paper — tekst óp inkt
  creamSoft: "231 227 216",
  creamMuted: "184 180 170",
  post: "242 239 232",
  postText: "20 20 20",
  postFill: "231 227 216", // = paper2
  flame: "216 50 31", // = red
  flameDeep: "181 41 26", // rood voor kleine tekst
  announce: "20 20 20", // de primaire actie is een inktvlak
  announceDeep: "43 43 43",
  teal: "76 154 99", // = vriendgroen
  gold: "224 182 74", // = oker
  brand: "47 91 255", // = blauw
};

const LIGHT_ALPHA: Alphas = {
  postDim: 0.58,
  postRule: 0.2,
  linePaper: 0.2,
  inkDim: 0.58,
  onDark: 0.22,
  pill: 0.35,
  pillSoft: 0.28,
  // Elk kader is inkt, dekkend. Geen zachte afsluitlijn meer.
  cardEdge: 1,
  tileFill: 0.82,
  dash: 0.26,
};

/** DONKER. */
const DARK: Palette = {
  paper: "26 25 23", // #1A1917
  paper2: "35 34 32", // #232220
  acid: "217 240 74", // #D9F04A
  red: "228 85 63", // #E4553F
  line: "237 232 221",
  tile: "24 24 26",

  page: "26 25 23",
  panel: "26 25 23",
  paperWarm: "35 34 32",
  paperLight: "26 25 23",
  shell: "237 232 221", // = ink
  shellSoft: "214 209 198",
  desk: "26 25 23",
  deskInk: "237 232 221",
  deskSoft: "201 196 185",
  deskMuted: "157 153 146",
  deskPanel: "35 34 32",
  ink: "237 232 221", // #EDE8DD
  inkSoft: "201 196 185",
  inkMuted: "157 153 146", // dim op donker papier
  cream: "26 25 23", // = paper
  creamSoft: "35 34 32",
  creamMuted: "110 106 98",
  post: "26 25 23",
  postText: "237 232 221",
  postFill: "35 34 32",
  flame: "228 85 63",
  flameDeep: "228 85 63",
  announce: "237 232 221",
  announceDeep: "214 209 198",
  teal: "94 156 114",
  gold: "201 169 79",
  brand: "95 127 230",
};

const DARK_ALPHA: Alphas = {
  postDim: 0.62,
  postRule: 0.2,
  linePaper: 0.2,
  inkDim: 0.62,
  onDark: 0.22,
  pill: 0.35,
  pillSoft: 0.28,
  cardEdge: 1,
  tileFill: 0.9,
  dash: 0.26,
};

const PALETTE: Record<Scheme, Palette> = { dark: DARK, light: LIGHT };
const ALPHA: Record<Scheme, Alphas> = { dark: DARK_ALPHA, light: LIGHT_ALPHA };

// ===============================================================
// DE THEMA'S — wat magazine anders doet
// ===============================================================

/**
 * Wat een thema aan maten en stijlen vastlegt. De kleuren staan in
 * `paletteFor()`; dit is de rest: kaderdikte, de letter van de
 * koppen, en de dingen die de feed en de omlijsting anders tekenen.
 */
export type ThemeSpec = {
  id: LincinTheme;
  /** Kaderdikte: 1.5 (kleur) of 1 (magazine, modern). */
  border: number;
  /** Koppen in Instrument Serif (regular, geen kapitaal) in plaats van Archivo. */
  serifHeads: boolean;
  /**
   * De letter van de koppen. `archivo900` is de smalle kapitaal van kleur,
   * `serif` de Instrument Serif van magazine, `archivo` de gewone Archivo
   * van modern (400–600, onderkast, strak gespatieerd). `serifHeads`
   * blijft ernaast bestaan: de rest van de app leest hem nog.
   */
  heads: "archivo900" | "serif" | "archivo";
  /** Het blad kleurt mee met de vriend in beeld. Alleen kleur. */
  tint: boolean;
  /**
   * Het blad draagt een zachte kleurhaze van de vriend in beeld: drie
   * radiale verlopen in plaats van het verticale verloop van kleur.
   * Alleen modern.
   */
  haze: boolean;
  /** De vriendband in de feed gevuld met zijn kleur. Anders papier met kleurbalk. */
  bandFilled: boolean;
  /** Titelstrook van een kaart gevuld met de vriendkleur; anders papier met 6px balk. */
  stripFilled: boolean;
  /** De kop "Lincin · teller · ◉ · +" boven de feed. Magazine en modern dragen hun eigen. */
  feedHeader: boolean;
  /** Maat van de kaarttitel: 22 (Archivo), 24 (serif) of 20 (modern). */
  cardTitle: number;
  /** De ronding van een tegel of kaart: 0 (kleur, magazine) of 18 (modern). */
  radius: number;
  /**
   * De vorm van een scherm.
   *   `lijst`   kaders en lijsten op papier — kleur.
   *   `spread`  volvlaks kleurvlakken met een naad van 6 — magazine.
   *   `bento`   een raster van tegels van twee kolommen — modern.
   */
  layout: "lijst" | "spread" | "bento";
  /** De navigatie: het kader van kleur, de rugstrook (1d), of de zwevende pil. */
  nav: "rubrieken" | "rugstrook" | "pil";
  /** Het blad is donker — voor de statusbalk en de navigatie. */
  dark: boolean;
};

const SPEC: Record<LincinTheme, Omit<ThemeSpec, "dark">> = {
  kleur: {
    id: "kleur",
    border: 1.5,
    serifHeads: false,
    heads: "archivo900",
    tint: true,
    haze: false,
    bandFilled: true,
    stripFilled: true,
    feedHeader: true,
    cardTitle: 22,
    radius: 0,
    layout: "lijst",
    nav: "rubrieken",
  },
  magazine: {
    id: "magazine",
    border: 1,
    serifHeads: true,
    heads: "serif",
    tint: false,
    haze: false,
    bandFilled: false,
    stripFilled: false,
    feedHeader: false,
    cardTitle: 24,
    radius: 0,
    layout: "spread",
    nav: "rugstrook",
  },
  modern: {
    id: "modern",
    border: 1,
    serifHeads: false,
    heads: "archivo",
    tint: false,
    haze: true,
    bandFilled: false,
    stripFilled: false,
    feedHeader: false,
    cardTitle: 20,
    radius: RASTER.tileRadius,
    layout: "bento",
    nav: "pil",
  },
};

function mix(a: string, b: string, wA: number): string {
  const A = a.split(" ").map(Number);
  const B = b.split(" ").map(Number);
  return A.map((v, i) => Math.round(v * wA + B[i] * (1 - wA))).join(" ");
}

/**
 * Het palet van een thema, afgeleid van een basisstand.
 *
 * Magazine zet papier, inkt en accent. De oude namen
 * volgen de v2-tokens (papier → page, panel, cream…; inkt → shell,
 * deskInk…), en de tussenwaarden (inkSoft, inkMuted, shellSoft…) zijn de
 * inkt op het papier gelegd, net als in de basisstand.
 */
function derive(
  base: Palette,
  o: { paper: string; paper2: string; ink: string; acid: string; red: string; line: string; tile: string },
): Palette {
  return {
    ...base,
    paper: o.paper,
    paper2: o.paper2,
    acid: o.acid,
    red: o.red,
    line: o.line,
    tile: o.tile,
    page: o.paper,
    panel: o.paper,
    paperWarm: o.paper2,
    paperLight: o.paper,
    shell: o.ink,
    shellSoft: mix(o.ink, o.paper, 0.9),
    desk: o.paper,
    deskInk: o.ink,
    deskSoft: mix(o.ink, o.paper, 0.83),
    deskMuted: mix(o.ink, o.paper, 0.58),
    deskPanel: o.paper2,
    ink: o.ink,
    inkSoft: mix(o.ink, o.paper, 0.83),
    inkMuted: mix(o.ink, o.paper, 0.58),
    cream: o.paper,
    creamSoft: o.paper2,
    creamMuted: mix(o.paper, o.ink, 0.72),
    post: o.paper,
    postText: o.ink,
    postFill: o.paper2,
    flame: o.red,
    flameDeep: o.red,
    announce: o.ink,
    announceDeep: mix(o.ink, o.paper, 0.9),
  };
}

/**
 * MAGAZINE — papier en serif, nu in twee standen (2.2 §2).
 *
 * Licht bleef zoals het was. Donker is in 2.2 herzien: het grijsbruine
 * #282520/#DAD4C6 van 2.1 is vervangen door een warm, bijna zwart papier
 * met okeren accent — de kleurvlakken van de spreads moeten erop kunnen
 * staan zonder dat het blad zelf meekleurt.
 */
const MAGAZINE_LIGHT: Palette = derive(LIGHT, {
  paper: "247 244 238", // #F7F4EE
  paper2: "241 237 227", // #F1EDE3
  ink: "22 22 15", // #16160F
  acid: "240 106 43", // #F06A2B — het accent van magazine
  red: "216 50 31", // #D8321F
  line: "22 22 15",
  tile: "255 255 255",
});
const MAGAZINE_DARK: Palette = derive(DARK, {
  paper: "20 18 14", // #14120E
  paper2: "27 24 19", // #1B1813
  ink: "239 231 214", // #EFE7D6
  acid: "217 160 91", // #D9A05B
  red: "194 96 78", // #C2604E
  line: "239 231 214",
  tile: "27 24 19",
});

/**
 * MODERN — het bento-rooster (2.2 §1).
 *
 * Bijna neutraal papier, tegels van halfdoorzichtig wit (licht) of bijna
 * zwart (donker) op een zachte kleurhaze van de vriend in beeld. `acid` is
 * hier geen zuurgeel maar de inkt zelf: modern kent geen derde kleur
 * naast papier, inkt en de vriendkleuren.
 */
const MODERN_LIGHT: Palette = derive(LIGHT, {
  paper: "244 241 235", // #F4F1EB
  paper2: "234 231 223", // #EAE7DF
  ink: "23 23 15", // #17170F
  acid: "23 23 15", // #17170F — = inkt
  red: "192 80 58", // #C0503A
  line: "23 23 15",
  tile: "255 255 255", // op .82 → rgba(255,255,255,.82)
});
const MODERN_DARK: Palette = derive(DARK, {
  paper: "12 12 13", // #0C0C0D
  paper2: "21 21 23", // #151517
  ink: "239 236 230", // #EFECE6
  acid: "233 230 224", // #E9E6E0
  red: "228 103 78", // #E4674E
  line: "239 236 230",
  tile: "24 24 26", // op .9 → rgba(24,24,26,.9)
});

/**
 * De doorzichtigheden per thema en stand. `postDim`/`inkDim` is de `--dim`
 * uit het prototype, `postRule`/`linePaper` de `--rule`.
 */
const MAGAZINE_LIGHT_ALPHA: Alphas = { ...LIGHT_ALPHA, postDim: 0.52, inkDim: 0.52, postRule: 0.13, linePaper: 0.13 };
const MAGAZINE_DARK_ALPHA: Alphas = { ...DARK_ALPHA, postDim: 0.54, inkDim: 0.54, postRule: 0.14, linePaper: 0.14 };
const MODERN_LIGHT_ALPHA: Alphas = { ...LIGHT_ALPHA, postDim: 0.56, inkDim: 0.56, postRule: 0.12, linePaper: 0.12 };
const MODERN_DARK_ALPHA: Alphas = { ...DARK_ALPHA, postDim: 0.58, inkDim: 0.58, postRule: 0.14, linePaper: 0.14 };

const THEME_PALETTE: Record<LincinTheme, Record<Scheme, Palette>> = {
  kleur: PALETTE,
  magazine: { light: MAGAZINE_LIGHT, dark: MAGAZINE_DARK },
  modern: { light: MODERN_LIGHT, dark: MODERN_DARK },
};

const THEME_ALPHA: Record<LincinTheme, Record<Scheme, Alphas>> = {
  kleur: ALPHA,
  magazine: { light: MAGAZINE_LIGHT_ALPHA, dark: MAGAZINE_DARK_ALPHA },
  modern: { light: MODERN_LIGHT_ALPHA, dark: MODERN_DARK_ALPHA },
};

/** De kleuren die gelden voor een stand én een thema. */
function paletteFor(s: Scheme, t: LincinTheme): Palette {
  return THEME_PALETTE[t][s];
}

function alphaFor(s: Scheme, t: LincinTheme): Alphas {
  return THEME_ALPHA[t][s];
}

/**
 * De per-thema-overschrijvingen als CSS; `app/+html.tsx` zet dit in de
 * <head>. Sinds 2.2 kennen magazine en modern allebei een lichte én een
 * donkere stand, dus er zijn zes blokken.
 *
 * De selectors staan hier al met `html` ervoor: `html:root.dark[…]` wint
 * op specificiteit van `html:root[…]`, en die twee winnen allebei van
 * `.dark:root` in global.css. Zo bepaalt de volgorde in het document niets
 * en kan er geen regel per ongeluk overheen vallen.
 */
export function themeVarCss(): string {
  const block = (selector: string, p: Palette, a: Alphas) => {
    const lines: string[] = [];
    for (const token of TOKENS) lines.push(`  ${varName(token)}: ${p[token]};`);
    for (const al of ALPHA_TOKENS) lines.push(`  ${alphaVarName(al)}: ${a[al]};`);
    return `${selector} {\n${lines.join("\n")}\n}`;
  };
  const out: string[] = [];
  // Kleur is de basis in global.css; alleen zijn nieuwe tokens (het
  // tegelvlak, de stippellijn) moeten er nog bij.
  for (const t of THEMES) {
    for (const s of ["light", "dark"] as Scheme[]) {
      if (t === "kleur") continue;
      const sel = s === "dark" ? `html:root.dark[data-lincin-theme="${t}"]` : `html:root[data-lincin-theme="${t}"]`;
      out.push(block(sel, THEME_PALETTE[t][s], THEME_ALPHA[t][s]));
    }
  }
  out.push(block("html:root", LIGHT, LIGHT_ALPHA));
  out.push(block("html:root.dark", DARK, DARK_ALPHA));
  return out.join("\n");
}

// ===============================================================
// VRIENDKLEUREN
// ===============================================================

export type Hue = "orange" | "blue" | "ochre" | "green" | "red" | "acid";

export const HUES: Hue[] = ["orange", "blue", "ochre", "green", "red", "acid"];

/** Het vlak en de inkt erop. */
type FriendColor = { fill: string; ink: string };

const FRIEND: Record<Scheme, Record<Hue, FriendColor>> = {
  light: {
    orange: { fill: "#F06A2B", ink: "#141414" },
    blue: { fill: "#2F5BFF", ink: "#F2EFE8" },
    ochre: { fill: "#E0B64A", ink: "#141414" },
    green: { fill: "#4C9A63", ink: "#F2EFE8" },
    red: { fill: "#D8321F", ink: "#F2EFE8" },
    acid: { fill: "#E5FF3A", ink: "#141414" },
  },
  dark: {
    orange: { fill: "#D9764A", ink: "#1A1917" },
    blue: { fill: "#5F7FE6", ink: "#1A1917" },
    ochre: { fill: "#C9A94F", ink: "#1A1917" },
    green: { fill: "#5E9C72", ink: "#1A1917" },
    red: { fill: "#CF5442", ink: "#1A1917" },
    acid: { fill: "#D2E85A", ink: "#1A1917" },
  },
};

/**
 * Welke kleur een vriend bezit — in jouw app.
 *
 * Heb je zelf een kleur voor iemand gekozen (op zijn profiel), dan wint
 * die in het thema kleur; zie `setHueChoice` hieronder. Magazine kent
 * alleen de kleurbalk en houdt de eigen kleur van iedereen. Anders komt de kleur uit het id zelf,
 * zodat hij op élk toestel en in élke sessie dezelfde is. Groepen zijn
 * altijd groen (README §01).
 *
 * Een scherm dat hiermee tekent roept `useHueFor()` aan, zodat het
 * hertekent zodra je een kleur verandert.
 */
export function hueFor(id: string | null | undefined): Hue {
  if (!id) return "orange";
  return (theme === "kleur" ? hueChoices[id] : undefined) ?? defaultHueFor(id);
}

/** De kleur die iemand krijgt als je zelf niets koos. */
export function defaultHueFor(id: string): Hue {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  // Zuur is de kleur van de oproep; als vriendkleur is hij de zesde en
  // komt hij het minst vaak voor.
  return HUES[h % 5];
}

/**
 * De inkt die op een vriendkleur hoort, gegeven alleen het vlak (hex).
 * Voor wie een kleur doorkreeg zonder zijn tint — het actieve tabblad
 * (HANDOFF 2.1 §Footer tabs). Onbekend vlak → de inkt van de stand.
 */
export function inkOn(fill: string, s: Scheme = getScheme()): string {
  const f = fill.toLowerCase();
  for (const scheme_ of [s, s === "dark" ? "light" : "dark"] as Scheme[]) {
    for (const hue of HUES) {
      if (FRIEND[scheme_][hue].fill.toLowerCase() === f) return FRIEND[s][hue].ink;
    }
  }
  return inkHex(s);
}

/**
 * De vriendkleuren volgen de stand (licht of donker), ook in magazine.
 */
export function friendColor(hue: Hue, s: Scheme = getScheme()): FriendColor {
  return FRIEND[s][hue];
}

// ---------------------------------------------------------------
// De tint van het blad: color-mix(in oklch, vriend 42%, papier)
// ---------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function fromLinear(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

/** sRGB → OKLCH. */
function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** OKLCH → sRGB hex. */
function fromOklch(L: number, C: number, H: number): string {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const [R, G, B] = [r, g, bl].map(fromLinear);
  return "#" + [R, G, B].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function tripletToHex(triplet: string): string {
  return "#" + triplet.split(" ").map((v) => Number(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Het blad in de kleur van de vriend in beeld.
 *
 * Licht: 42% vriendkleur op papier; donker: 18%. Gemengd in OKLCH, zoals
 * de CSS `color-mix(in oklch, …)` uit het ontwerp, zodat de tint dezelfde
 * is als in het prototype.
 *
 * De tint houdt de kleurtoon van de vriend. Het papier is bijna grijs, en
 * de browser behandelt zijn toon in `color-mix` als machteloos: hij mengt
 * alleen lichtheid en verzadiging. Nagemeten in Chrome — groen #4C9A63 op
 * #F2EFE8 geeft oklch(0.814 0.053 151.4), precies de toon van het groen.
 * Mengden we de toon van het papier mee, dan trok elke tint naar geel.
 */
export function pageTint(fill: string, s: Scheme = getScheme(), weight?: { light: number; dark: number }): string {
  // Desktop mengt zachter (Lincin Desktop.dc.html: 26% licht, 14% donker).
  const w = weight ? (s === "dark" ? weight.dark : weight.light) : s === "dark" ? 0.18 : 0.42;
  const [Lf, Cf, Hf] = toOklch(fill);
  const [Lp, Cp] = toOklch(paperHex(s));
  const L = Lf * w + Lp * (1 - w);
  const C = Cf * w + Cp * (1 - w);
  const H = Hf;
  return fromOklch(L, C, H);
}

/** Het papier als hex, voor wie een echte waarde nodig heeft. */
export function paperHex(s: Scheme = getScheme()): string {
  return tripletToHex(paletteFor(s, theme).paper);
}

function inkHex(s: Scheme = getScheme()): string {
  return tripletToHex(paletteFor(s, theme).ink);
}

// ===============================================================
// VARIABELEN
// ===============================================================

/** `paperWarm` → `--c-paper-warm`. */
function varName(token: Token): string {
  return `--c-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/([a-z])(\d)/g, "$1-$2")}`;
}

function alphaVarName(token: AlphaToken): string {
  return `--a-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

/**
 * De naam van de kant-en-klare kleurvariabele voor een prop.
 *
 * react-native-web haalt élke kleur-prop door `normalizeColor`, en dat
 * laat maar één soort CSS-uitdrukking ongemoeid: een waarde die letterlijk
 * met `var(` begínt. `--p-ink` is gedefinieerd áls `rgb(var(--c-ink) / 1)`
 * en een prop leest `var(--p-ink)`. De definities staan in `app/+html.tsx`.
 */
function propVarName(token: Token, alpha?: AlphaToken): string {
  const base = token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/([a-z])(\d)/g, "$1-$2");
  if (!alpha) return `--p-${base}`;
  return `--p-${base}--${alpha.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

// ===============================================================
// DE STAND EN HET THEMA — waar ze vandaan komen en wie het hoort
// ===============================================================

const STORAGE_KEY = "lincin.theme";
/** Dezelfde sleutel als het prototype, zodat een export ervan overeenkomt. */
const THEME_KEY = "lincin-thema";

const isWeb = Platform.OS === "web";

function systemScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

function readLocal(key: string): string | null {
  if (isWeb && typeof localStorage !== "undefined") {
    try {
      return localStorage.getItem(key);
    } catch {
      // Private mode of een browser die opslag blokkeert.
    }
  }
  return null;
}

function writeLocal(key: string, value: string) {
  AsyncStorage.setItem(key, value).catch(() => {});
  if (isWeb && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Opslag mag falen; de keuze werkt dan alleen niet meer na een herlaad.
    }
  }
}

/**
 * De voorkeur bij het allereerste beeld.
 *
 * Op web staat hij in `localStorage` en lezen we hem synchroon, want het
 * script in `app/+html.tsx` heeft dezelfde waarde al gelezen en de klasse
 * al gezet vóórdat de browser iets tekende.
 */
function initialPreference(): ThemePreference {
  const raw = readLocal(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function initialTheme(): LincinTheme {
  const raw = readLocal(THEME_KEY);
  return isLincinTheme(raw) ? raw : "kleur";
}

let preference: ThemePreference = initialPreference();
let scheme: Scheme = preference === "system" ? systemScheme() : preference;
let theme: LincinTheme = initialTheme();

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}


/**
 * Zet de klasse en het thema op `<html>`. De variabelen onder `.dark:root`
 * en `[data-lincin-theme]` in `global.css` nemen het over en élke klasse
 * en élke prop die eruit leest schuift mee.
 */
function applyWeb() {
  if (!isWeb || typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", scheme === "dark");
  root.dataset.theme = scheme;
  root.dataset.lincinTheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", paperHex(scheme));
}

function resolve() {
  const next: Scheme = preference === "system" ? systemScheme() : preference;
  if (next === scheme) return;
  scheme = next;
  applyWeb();
  emit();
}

Appearance.addChangeListener(() => {
  if (preference === "system") resolve();
});

/** Wat er nú op het scherm staat. */
function getScheme(): Scheme {
  return scheme;
}

function getPreference(): ThemePreference {
  return preference;
}

export function setPreference(next: ThemePreference) {
  if (next === preference) return;
  preference = next;
  writeLocal(STORAGE_KEY, next);
  const before = scheme;
  scheme = next === "system" ? systemScheme() : next;
  if (scheme !== before) applyWeb();
  emit();
}

/** Het thema dat nu geldt. */
export function getTheme(): LincinTheme {
  return theme;
}

/**
 * Wissel van thema. Lokaal bewaard; `components/lincin/ThemeProvider.tsx`
 * schrijft hem daarnaast naar het profiel, zodat een tweede toestel hem
 * ook kent. Geen herlaad: de schermen hertekenen zich (zie `app/_layout.tsx`).
 */
export function setTheme(next: LincinTheme) {
  if (next === theme) return;
  theme = next;
  writeLocal(THEME_KEY, next);
  applyWeb();
  emit();
}

/** De maten en stijlen van het thema dat nu geldt. */
export function themeSpec(t: LincinTheme = theme): ThemeSpec {
  const s = SPEC[t];
  return { ...s, dark: scheme === "dark" };
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Meeluisteren op de wissel van stand óf thema, buiten React om. */
export const subscribeScheme = subscribe;
export const subscribeTheme = subscribe;

/** De stand zoals hij nu is — `light` of `dark`. */
export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, getScheme, getScheme);
}

/** Wat de gebruiker koos — `system`, `light` of `dark`. */
export function usePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getPreference, getPreference);
}

/** Het thema — `kleur` of `magazine`. */
export function useTheme(): LincinTheme {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}

/** De maten en stijlen van het thema, meebewegend. */
export function useThemeSpec(): ThemeSpec {
  const t = useTheme();
  const s = useScheme();
  return { ...SPEC[t], dark: s === "dark" };
}

/**
 * Native heeft geen localStorage, dus daar komen de bewaarde voorkeuren
 * één tel later binnen. Roep dit één keer aan bij het opstarten.
 */
export function loadStoredPreference() {
  if (isWeb) {
    applyWeb();
    return;
  }
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (raw === "light" || raw === "dark" || raw === "system") setPreference(raw);
    })
    .catch(() => {});
  AsyncStorage.getItem(THEME_KEY)
    .then((raw) => {
      if (isLincinTheme(raw)) setTheme(raw);
    })
    .catch(() => {});
  AsyncStorage.getItem(HUE_KEY)
    .then((raw) => {
      // De database kan intussen al geantwoord hebben; die wint.
      if (raw && !hueChoicesSynced) setHueChoices(parseChoices(raw), false);
    })
    .catch(() => {});
}

// ===============================================================
// JOUW KLEUR PER PERSOON
// ===============================================================

/**
 * De kleuren die je zelf aan mensen gaf: id → kleur. Van jou alleen —
 * een ander ziet ze niet. De bron is de tabel `friend_colors`
 * (lib/api/friend-colors.ts); hier staat een kopie, lokaal bewaard, zodat
 * het eerste beeld al klopt.
 */
const HUE_KEY = "lincin-kleuren";

function parseChoices(raw: string | null): Record<string, Hue> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Hue> = {};
    for (const [id, h] of Object.entries(o)) if (HUES.includes(h as Hue)) out[id] = h as Hue;
    return out;
  } catch {
    return {};
  }
}

let hueChoices: Record<string, Hue> = parseChoices(readLocal(HUE_KEY));
/** Heeft de database al geantwoord? Dan wint die van de lokale kopie. */
let hueChoicesSynced = false;
const hueListeners = new Set<() => void>();

function emitHues() {
  for (const fn of hueListeners) fn();
}

function subscribeHues(fn: () => void) {
  hueListeners.add(fn);
  return () => {
    hueListeners.delete(fn);
  };
}

const getHueChoices = () => hueChoices;

/** Alle keuzes tegelijk — zo komen ze binnen uit de database. */
export function setHueChoices(next: Record<string, Hue>, fromServer = true) {
  if (fromServer) hueChoicesSynced = true;
  hueChoices = next;
  writeLocal(HUE_KEY, JSON.stringify(next));
  emitHues();
}

/** Eén keuze; `null` geeft iemand zijn eigen kleur terug. */
export function setHueChoice(id: string, hue: Hue | null) {
  const next = { ...hueChoices };
  if (hue) next[id] = hue;
  else delete next[id];
  setHueChoices(next);
}

/** Jouw keuzes, meebewegend. */
export function useHueChoices(): Record<string, Hue> {
  return useSyncExternalStore(subscribeHues, getHueChoices, getHueChoices);
}

// ===============================================================
// KLEUR ALS PROP
// ===============================================================

/**
 * Eén kleur, klaar om in een style-object te zetten.
 *
 * Web krijgt de variabele zelf, zodat een prop meewisselt met de klasse en
 * het thema op `<html>` zónder dat React iets hertekent. Native kent geen
 * variabelen en krijgt de waarde van de stand en het thema die nú gelden —
 * daar is de wissel een hertekening (zie `app/_layout.tsx`).
 */
export function color(token: Token, alpha?: AlphaToken): string {
  if (isWeb) return `var(${propVarName(token, alpha)})`;
  const [r, g, b] = paletteFor(scheme, theme)[token].split(" ");
  const a = alpha === undefined ? 1 : alphaFor(scheme, theme)[alpha];
  return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * De kaderlijn: inkt. Voor élk `borderColor` in de v2-onderdelen.
 */
export function line(): string {
  return color("line");
}

/**
 * De `--p-*`-definities als één stuk CSS; `app/+html.tsx` zet dit in de
 * <head>. Ze verwijzen naar `--c-*`, en díe wisselen — één lijst dus.
 */
export function propVarCss(): string {
  const lines: string[] = [];
  for (const token of TOKENS) {
    lines.push(`  ${propVarName(token)}: rgb(var(${varName(token)}) / 1);`);
    for (const a of ALPHA_TOKENS) {
      lines.push(
        `  ${propVarName(token, a)}: rgb(var(${varName(token)}) / var(${alphaVarName(a)}));`,
      );
    }
  }
  return `:root {\n${lines.join("\n")}\n}`;
}
