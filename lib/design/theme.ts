import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { Appearance, Platform } from "react-native";

/**
 * ===============================================================
 * DE TWEE STANDEN — donker (lavendel) en licht (krantenwit)
 * ===============================================================
 *
 * Het systeem uit DESIGN.md had één palet. Dit bestand maakt er twee van
 * zónder dat één scherm hoeft te weten welke aan staat: élk kleurtoken uit
 * `tailwind.config.js` en uit `lib/design/type.ts` leest voortaan een
 * CSS-variabele, en die variabelen wisselen van waarde. Precies dezelfde
 * truc als bij de v3-uitrol — de namen blijven, de wáárden schuiven — maar
 * nu op het moment zelf in plaats van bij een commit.
 *
 *   DONKER   Lavendel blad, plum kaarten, crème tekst, oranje actie.
 *            Dit is de app zoals hij was; er verandert geen hex.
 *   LICHT    Vier soorten wit en grijs, inkt erop, en dezelfde oranje.
 *            Geen lavendel, geen plum, geen tweede accent.
 *
 * De zwarte balk bovenaan staat in béide standen. Hij is de kop van de
 * uitgave: op een lavendel blad is dat een omlijsting, op een wit blad een
 * drukkerskop. In geen van beide standen is hij het blad zelf.
 *
 * ---------------------------------------------------------------
 * HET WERKBLAD (`desk*`)
 * ---------------------------------------------------------------
 * Een stuk of twintig schermen — de compose-vensters, de QR-schermen,
 * instellingen, groepsinfo — zijn nooit naar het v3-patroon gemigreerd en
 * gebruiken een zwart vlak als páginavlak in plaats van als balk (zie
 * DESIGN.md §8). Dat is in de donkere stand precies goed, maar het zou
 * betekenen dat de lichte stand twintig pikzwarte schermen houdt.
 *
 * Ze lezen daarom een eigen paar: `desk` is het vlak en `deskInk` de tekst
 * erop, en die kantelen samen — net zoals `post`/`postText` dat doen voor
 * een kaart. In de donkere stand staan ze op exact de waarden die die
 * schermen nú al hebben (#0B0A0C met #F3EDE4), dus daar verandert er geen
 * pixel; in de lichte stand worden ze een blad met inkt erop.
 *
 * `desk` is in de lichte stand één tint lichter dan `page`. Deze schermen
 * liggen over de app heen — een venster, geen pagina — en een venster dat
 * ietsje lichter is dan wat eronder ligt hoeft geen rand om zich als
 * venster te lezen.
 *
 * ---------------------------------------------------------------
 * EEN KAART HEEFT GEEN VULLING
 * ---------------------------------------------------------------
 * `post` en `postText` waren een paar dat kantelde: plum met crème in de
 * donkere stand, wit met inkt in de lichte. Dat werkte, maar het betekende
 * dat élke kaart een eigen vlak was, en een pagina met twintig vlakken
 * erop leest als twintig dozen — niet als een blad.
 *
 * Ze staan nu allebei op het paginavlak: `post` ís `page` en `postText`
 * ís `ink`. Een kaart is dus niets meer dan het blad zelf, en zijn
 * hiërarchie komt uit lijn en inspringing (DESIGN.md §4). Dat is dezelfde
 * regel die dit systeem al hanteerde voor diepte — geen schaduwen, vlak en
 * lijn dragen de opbouw — nu ook toegepast op het vlak zelf.
 *
 * De namen blijven bestaan omdat ~80 plekken ernaar wijzen én omdat ze nog
 * steeds iets zeggen: `feed.text` is de tekst óp een kaart, en dat is een
 * andere bedoeling dan `feed.ink`, ook al is het nu dezelfde kleur. Wijzigt
 * de regel ooit terug, dan is dat één waarde.
 *
 * `postFill` is de uitzondering en blijft wél een vlak: dat is het vak waar
 * een foto nog moet landen. Zonder vulling is dat een gat in de pagina.
 *
 * ---------------------------------------------------------------
 * WAAROM TRIPLETS EN GEEN HEX
 * ---------------------------------------------------------------
 * De waarden hieronder staan als `"R G B"`. Dat is de vorm die CSS nodig
 * heeft om `rgb(var(--c-ink) / 0.58)` te kunnen schrijven — één variabele
 * die zowel dekkend als doorzichtig gebruikt kan worden. Zonder die vorm
 * heb je voor élke doorzichtigheid een eigen variabele nodig, en dat zijn
 * er in dit systeem een stuk of veertig.
 *
 * Native leest dezelfde triplets en zet ze zelf om naar `rgba(...)`, zodat
 * er maar één lijst met kleuren bestaat.
 */

export type Scheme = "light" | "dark";

/** Wat de gebruiker koos. `system` volgt het besturingssysteem. */
export type ThemePreference = "system" | "light" | "dark";

export type Token =
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

/** Doorzichtigheden die per stand verschillen. */
export type AlphaToken =
  | "postDim"
  | "postRule"
  | "linePaper"
  | "inkDim"
  | "onDark"
  /** De vulling van een reactiepil. */
  | "pill"
  | "pillSoft";

type Palette = Record<Token, string>;
type Alphas = Record<AlphaToken, number>;

/**
 * Alle tokennamen, in volgorde. `app/+html.tsx` loopt hier doorheen om de
 * `--p-*`-variabelen uit te schrijven; zie `color()` onderaan voor waarom
 * die bestaan.
 */
export const TOKENS: Token[] = [
  "page", "panel", "paperWarm", "paperLight",
  "shell", "shellSoft",
  "desk", "deskInk", "deskSoft", "deskMuted", "deskPanel",
  "ink", "inkSoft", "inkMuted",
  "cream", "creamSoft", "creamMuted",
  "post", "postText", "postFill",
  "flame", "flameDeep", "announce", "announceDeep",
  "teal", "gold", "brand",
];

export const ALPHA_TOKENS: AlphaToken[] = [
  "postDim", "postRule", "linePaper", "inkDim", "onDark", "pill", "pillSoft",
];

/**
 * DONKER — het bestaande systeem, hex voor hex.
 *
 * Wie wil vergelijken met DESIGN.md §2: dit is die tabel, omgezet naar
 * triplets. Er is bewust niets aan bijgesteld; de donkere stand hoort er
 * na deze wijziging identiek uit te zien als ervoor.
 */
const DARK: Palette = {
  page: "205 190 227", // #CDBEE3 lavendel
  panel: "239 233 245", // #EFE9F5
  paperWarm: "191 172 219", // #BFACDB
  paperLight: "245 241 250", // #F5F1FA
  shell: "11 10 12", // #0B0A0C
  shellSoft: "46 33 56", // #2E2138 plum
  desk: "11 10 12", // #0B0A0C — het blad van een compose-scherm
  deskInk: "243 237 228", // #F3EDE4
  deskSoft: "217 210 228", // #D9D2E4
  deskMuted: "167 159 181", // #A79FB5
  deskPanel: "46 33 56", // #2E2138
  ink: "11 10 12", // #0B0A0C
  inkSoft: "58 53 64", // #3A3540
  inkMuted: "107 100 116", // #6B6474
  cream: "243 237 228", // #F3EDE4
  creamSoft: "217 210 228", // #D9D2E4
  creamMuted: "167 159 181", // #A79FB5
  // Een kaart heeft géén eigen vulling — zie de uitleg bij LIGHT hieronder
  // en DESIGN.md §4. `post` is daarom het paginavlak en `postText` de inkt
  // erop; de namen blijven bestaan omdat ~80 plekken ernaar wijzen en omdat
  // ze nog steeds iets zeggen: dit is de tekst óp een kaart.
  post: "205 190 227", // = page
  postText: "11 10 12", // = ink
  postFill: "191 172 219", // #BFACDB — het vlak waar een foto nog moet landen
  flame: "230 51 41", // #E63329
  flameDeep: "168 28 19", // #A81C13
  announce: "230 107 63", // #E66B3F
  announceDeep: "196 85 44", // #C4552C
  teal: "79 189 176", // #4FBDB0
  gold: "227 168 75", // #E3A84B
  brand: "91 141 239", // #5B8DEF
};

const DARK_ALPHA: Alphas = {
  postDim: 0.62,
  postRule: 0.22,
  linePaper: 0.25,
  inkDim: 0.58,
  onDark: 0.22,
  pill: 0.35,
  pillSoft: 0.28,
};

/**
 * LICHT — vier witten, drie grijzen, inkt, en de oranje.
 *
 * De trap is met opzet klein: #FFFFFF voor een kaart, #F7F7F5 voor een
 * zacht vlak, #EFEFEC voor het blad, #E2E2DE voor een band. Vier stappen
 * van ongeveer vijf procent. Meer verschil en het wordt een grijs ontwerp
 * in plaats van een wit ontwerp; minder en de kaart verdwijnt in het blad.
 *
 * Het blad is dus níet het witste vlak. Dat is bewust: een kaart moet van
 * het blad áf komen zonder schaduw, en dit systeem heeft geen schaduwen —
 * dus doet het verschil in wit het werk dat elders een schaduw doet.
 *
 * De accenten zijn dieper dan in de donkere stand. Op lavendel staat
 * #E63329 rustig; op wit is datzelfde rood schel, en de oranje van de
 * balk (#E66B3F) haalt op wit geen 4.5:1 voor kleine tekst. Vandaar
 * #D4551F voor het lijnwerk en #A83E12 voor alles onder ~16px.
 *
 * Er is in deze stand geen rood én oranje meer, alleen oranje. Rood was
 * het redactionele accent náást de oranje actieknop; op een wit blad met
 * verder alleen grijzen zijn twee warme kleuren er één te veel.
 */
const LIGHT: Palette = {
  page: "239 239 236", // #EFEFEC — krantenwit, het blad
  panel: "255 255 255", // #FFFFFF — kaart en paneel
  paperWarm: "226 226 222", // #E2E2DE — band
  paperLight: "247 247 245", // #F7F7F5 — zacht vlak
  shell: "11 10 12", // #0B0A0C — de drukkerskop, ongewijzigd
  shellSoft: "38 38 43", // #26262B — donker vlak bínnen de balk
  desk: "247 247 245", // #F7F7F5 — een tint lichter dan het blad eronder
  deskInk: "11 10 12", // #0B0A0C
  deskSoft: "68 68 74", // #44444A
  deskMuted: "122 122 128", // #7A7A80
  deskPanel: "226 226 222", // #E2E2DE
  ink: "11 10 12", // #0B0A0C
  inkSoft: "68 68 74", // #44444A
  inkMuted: "122 122 128", // #7A7A80
  cream: "247 247 245", // #F7F7F5 — tekst op zwart/oranje
  creamSoft: "220 220 217", // #DCDCD9
  creamMuted: "160 160 156", // #A0A09C
  post: "239 239 236", // = page
  postText: "11 10 12", // = ink
  postFill: "231 231 227", // #E7E7E3
  flame: "212 85 31", // #D4551F
  flameDeep: "168 62 18", // #A83E12
  announce: "230 107 63", // #E66B3F — de balk blijft
  announceDeep: "196 85 44", // #C4552C
  teal: "31 143 130", // #1F8F82 — dieper, want op wit
  gold: "168 122 28", // #A87A1C
  brand: "63 111 208", // #3F6FD0
};

const LIGHT_ALPHA: Alphas = {
  postDim: 0.58,
  postRule: 0.18,
  linePaper: 0.2,
  inkDim: 0.58,
  onDark: 0.22,
  pill: 0.35,
  pillSoft: 0.28,
};

export const PALETTE: Record<Scheme, Palette> = { dark: DARK, light: LIGHT };
export const ALPHA: Record<Scheme, Alphas> = { dark: DARK_ALPHA, light: LIGHT_ALPHA };

/** `paperWarm` → `--c-paper-warm`. */
export function varName(token: Token): string {
  return `--c-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

export function alphaVarName(token: AlphaToken): string {
  return `--a-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

/**
 * De naam van de kant-en-klare kleurvariabele voor een prop.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN APARTE VARIABELE IS
 * ---------------------------------------------------------------
 * react-native-web haalt élke kleur-prop door `normalizeColor`, en dat
 * laat maar één soort CSS-uitdrukking ongemoeid: een waarde die letterlijk
 * met `var(` begínt (zie `modules/isWebColor`). Alles anders gaat door
 * `processColor`, die van `rgb(var(--c-ink) / 1)` niets kan maken en
 * `undefined` teruggeeft — waarna de stijl stílletjes wegvalt. Geen
 * waarschuwing, geen fout; een venster zonder vulling.
 *
 * Vandaar deze tweede laag: `--p-ink` is gedefinieerd áls
 * `rgb(var(--c-ink) / 1)` en een prop leest `var(--p-ink)`. Dat begint met
 * `var(`, dus het komt er ongeschonden doorheen, en omdat de variabele
 * naar `--c-ink` verwijst schuift hij nog steeds mee met de stand.
 *
 * De definities staan in `app/+html.tsx` — web-only, want native heeft
 * ze niet nodig.
 */
export function propVarName(token: Token, alpha?: AlphaToken): string {
  const base = token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  if (!alpha) return `--p-${base}`;
  return `--p-${base}--${alpha.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

// ===============================================================
// DE STAND — waar hij vandaan komt en wie het hoort
// ===============================================================

const STORAGE_KEY = "lincin.theme";

const isWeb = Platform.OS === "web";

function systemScheme(): Scheme {
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
}

/**
 * De voorkeur bij het allereerste beeld.
 *
 * Op web staat hij in `localStorage` en lezen we hem synchroon, want het
 * script in `app/+html.tsx` heeft dezelfde waarde al gelezen en de klasse
 * al gezet vóórdat de browser iets tekende. Zouden we hier op AsyncStorage
 * wachten, dan flitst het blad eerst in de verkeerde stand.
 */
function initialPreference(): ThemePreference {
  if (isWeb && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") return raw;
    } catch {
      // Private mode of een browser die opslag blokkeert — dan `system`.
    }
  }
  return "system";
}

let preference: ThemePreference = initialPreference();
let scheme: Scheme = preference === "system" ? systemScheme() : preference;

const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

/**
 * Zet de klasse op `<html>`.
 *
 * Dit is het enige wat de wissel op web hoeft te doen: de variabelen onder
 * `.dark:root` in `global.css` nemen het over en élke klasse en élke prop
 * die eruit leest schuift mee. Geen enkel scherm hertekent — de browser
 * herberekent alleen kleuren, en dat is één frame.
 */
function applyWeb(next: Scheme) {
  if (!isWeb || typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.dataset.theme = next;
  // De browserbalk mee laten kleuren met het blad — anders staat er op een
  // telefoon een lavendel rand boven een wit blad.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const [r, g, b] = PALETTE[next].page.split(" ");
    meta.setAttribute("content", `rgb(${r}, ${g}, ${b})`);
  }
}

function resolve() {
  const next: Scheme = preference === "system" ? systemScheme() : preference;
  if (next === scheme) return;
  scheme = next;
  applyWeb(next);
  emit();
}

Appearance.addChangeListener(() => {
  if (preference === "system") resolve();
});

/** Wat er nú op het scherm staat. */
export function getScheme(): Scheme {
  return scheme;
}

export function getPreference(): ThemePreference {
  return preference;
}

export function setPreference(next: ThemePreference) {
  if (next === preference) return;
  preference = next;
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  if (isWeb && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Zie initialPreference — opslag mag falen, de stand werkt dan alleen
      // niet meer na een herlaad.
    }
  }
  const before = scheme;
  scheme = next === "system" ? systemScheme() : next;
  if (scheme !== before) applyWeb(scheme);
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Meeluisteren op de wissel, buiten React om.
 *
 * `lib/design/type.ts` gebruikt dit om zijn kleur-bindingen opnieuw op te
 * bouwen op native, waar CSS-variabelen niet bestaan.
 */
export const subscribeScheme = subscribe;

/** De stand zoals hij nu is — `light` of `dark`. */
export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, getScheme, getScheme);
}

/** Wat de gebruiker koos — `system`, `light` of `dark`. */
export function usePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getPreference, getPreference);
}

/**
 * Native heeft geen localStorage, dus daar komt de bewaarde voorkeur één
 * tel later binnen. Roep dit één keer aan bij het opstarten.
 */
export function loadStoredPreference() {
  if (isWeb) {
    applyWeb(scheme);
    return;
  }
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (raw === "light" || raw === "dark" || raw === "system") setPreference(raw);
    })
    .catch(() => {});
}

// ===============================================================
// KLEUR ALS PROP — wat `lib/design/type.ts` naar buiten brengt
// ===============================================================

/**
 * Eén kleur, klaar om in een style-object te zetten.
 *
 * Web krijgt de variabele zelf: `rgb(var(--c-ink) / 0.58)`. Dat is geldige
 * CSS, react-native-web laat kleurwaarden ongemoeid door naar de inline
 * stijl, en dus wisselt zo'n prop mee met de klasse op `<html>` zónder dat
 * React iets opnieuw hoeft te tekenen.
 *
 * Native kent geen variabelen en krijgt de waarde van de stand die nú
 * geldt. Daar is de wissel dus wél een hertekening — zie `ThemeGate` in
 * `app/_layout.tsx`.
 */
export function color(token: Token, alpha?: AlphaToken): string {
  if (isWeb) return `var(${propVarName(token, alpha)})`;
  const [r, g, b] = PALETTE[scheme][token].split(" ");
  const a = alpha === undefined ? 1 : ALPHA[scheme][alpha];
  return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * De `--p-*`-definities als één stuk CSS. Zie `propVarName` voor het
 * waarom; `app/+html.tsx` zet dit in de <head>.
 *
 * Ze staan bewust in `:root` en worden niet herhaald onder `.dark:root`:
 * ze verwijzen naar `--c-*`, en díe wisselen. Eén lijst dus, geen tweede
 * om uit de pas te laten lopen.
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
