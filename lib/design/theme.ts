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
export type AlphaToken = "postDim" | "postRule" | "linePaper" | "inkDim" | "onDark";

type Palette = Record<Token, string>;
type Alphas = Record<AlphaToken, number>;

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
  post: "46 33 56", // #2E2138 — hetzelfde plum als shellSoft
  postText: "243 237 228", // #F3EDE4 crème op plum
  postFill: "58 42 70", // #3A2A46 — het vlak waar een foto nog moet landen
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
  post: "255 255 255", // #FFFFFF — de kaart kantelt mee
  postText: "11 10 12", // #0B0A0C — en dus ook zijn tekst
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
export function color(token: Token, alpha?: number | AlphaToken): string {
  if (isWeb) {
    const a =
      alpha === undefined
        ? "1"
        : typeof alpha === "number"
          ? String(alpha)
          : `var(${alphaVarName(alpha)})`;
    return `rgb(var(${varName(token)}) / ${a})`;
  }
  const triplet = PALETTE[scheme][token];
  const a = alpha === undefined ? 1 : typeof alpha === "number" ? alpha : ALPHA[scheme][alpha];
  const [r, g, b] = triplet.split(" ");
  return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}
