import { Platform, type TextStyle } from "react-native";

/**
 * Typografisch systeem — editorial / Zwitsers.
 *
 * Naar de affiche-site van Fondation Phi (Yoko Ono, *Liberté Conquérante*):
 * gebroken wit vlak, zwarte inkt, haarlijnen van rand tot rand, en een
 * groot schaalverschil tussen een hoog-contrast display-serif en een
 * neutrale grotesk op labelformaat.
 *
 * Twee dingen die het rustiger en moderner maken dan de vorige versie:
 * de labels staan in **zinsvorm**, niet in kapitalen (de referentie doet
 * dat ook — "Events", "Featured Content"), en ze zijn 11px in plaats van
 * 9px. Kapitalen bestaan nog, maar als uitzondering: `<Meta caps>`.
 *
 * ---------------------------------------------------------------
 * FONTS — er wordt bewust géén fontbestand meegeleverd.
 * ---------------------------------------------------------------
 * iOS      Didot. Ingebouwd, een échte Didone, nul bytes in de bundle.
 * Web      Bodoni Moda (display) + Playfair Display (tekst), opgehaald
 *          door de browser via de stylesheet in `app/+html.tsx`.
 * Android  Valt terug op `serif` (Noto Serif).
 *
 * Android gelijktrekken is één commando en één regel:
 *   npx expo install @expo-google-fonts/bodoni-moda expo-font
 * en dan hieronder de `android`-tak omzetten plus het font laden in
 * `app/_layout.tsx`. Alle componenten lezen uitsluitend uit dit bestand.
 */

/** Alleen voor de grootste maten. */
export const DISPLAY_FAMILY = Platform.select({
  ios: "Didot",
  android: "serif",
  default: "'Bodoni Moda', Didot, 'Playfair Display', Georgia, serif",
}) as string;

/** Koppen en citaten op leesmaat. */
export const SERIF_FAMILY = Platform.select({
  ios: "Didot",
  android: "serif",
  default: "'Playfair Display', Didot, Georgia, 'Times New Roman', serif",
}) as string;

export const SERIF_FAMILY_ITALIC = Platform.select({
  ios: "Didot-Italic",
  android: "serif",
  default: "'Playfair Display', Didot, Georgia, 'Times New Roman', serif",
}) as string;

/** Neutrale grotesk voor alles wat geen inhoud is. */
export const SANS_FAMILY = Platform.select({
  ios: "Helvetica Neue",
  android: "sans-serif",
  default: "'Helvetica Neue', Helvetica, Arial, sans-serif",
}) as string;

// ===============================================================
// FEED V3 — het lavendel/plum-systeem. ALLEEN het feed-scherm.
//
// Dit blok staat náást het serif-systeem hierboven, dat overal
// elders in de app live blijft. De feed is bewust sans-only: ook
// de brontitel krijgt hier géén serif. Dat is een afwijking van
// DESIGN.md §1.4, en die afwijking stopt bij de feed.
// ===============================================================

/**
 * Inter — de grotesk van het feed-systeem.
 *
 * Er wordt bewust géén fontbestand meegeleverd, exact zoals bij de
 * serifs hierboven:
 *   Web      Inter 400–900, opgehaald via de stylesheet in `app/+html.tsx`.
 *   iOS      San Francisco. Een neutrale grotesk met vrijwel dezelfde
 *            proporties als Inter (Inter is er letterlijk op gebaseerd),
 *            nul bytes in de bundle.
 *   Android  Roboto.
 *
 * Écht Inter op native is één commando en één regel:
 *   npx expo install @expo-google-fonts/inter
 * daarna hieronder de ios/android-takken op "Inter_400Regular" e.d.
 * zetten en de snitten laden in `app/_layout.tsx`. Dat kost ~6 snitten
 * in de native bundle — vandaar dat het niet de standaard is.
 */
export const INTER_FAMILY = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
}) as string;

/**
 * Kaderdikte van het hele feed-systeem. Geen haarlijn: dit ontwerp
 * leest als een gedrukt raster met échte kaders, niet als de
 * rand-tot-rand haarlijnen van het affiche-systeem.
 */
export const FEED_BORDER = 1.5;

export const feedType = {
  /** Kop van de hero-post. */
  hero: {
    fontFamily: INTER_FAMILY,
    fontSize: 44,
    lineHeight: 47,
    letterSpacing: -1.6,
    fontWeight: "800",
  } as TextStyle,

  heroSmall: {
    fontFamily: INTER_FAMILY,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -1,
    fontWeight: "800",
  } as TextStyle,

  /** De tagline-kop in rij C van de gekaderde kop. */
  tagline: {
    fontFamily: INTER_FAMILY,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontWeight: "700",
  } as TextStyle,

  taglineSmall: {
    fontFamily: INTER_FAMILY,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.2,
    fontWeight: "700",
  } as TextStyle,

  /** De grote kapitalenkop van de cover-band. */
  cover: {
    fontFamily: INTER_FAMILY,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.1,
    fontWeight: "800",
  } as TextStyle,

  coverSmall: {
    fontFamily: INTER_FAMILY,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -0.8,
    fontWeight: "800",
  } as TextStyle,

  /** Kop binnen een tegel. */
  tile: {
    fontFamily: INTER_FAMILY,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.4,
    fontWeight: "700",
  } as TextStyle,

  /** Het citaat in de brede quote-band. */
  pull: {
    fontFamily: INTER_FAMILY,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontWeight: "500",
  } as TextStyle,

  pullSmall: {
    fontFamily: INTER_FAMILY,
    fontSize: 19,
    lineHeight: 26,
    letterSpacing: -0.4,
    fontWeight: "500",
  } as TextStyle,

  /** Het grote cijfer van de stat-tegel. */
  numeral: {
    fontFamily: INTER_FAMILY,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -2.4,
    fontWeight: "800",
  } as TextStyle,

  /** De (06)-index naast een cover-kop. */
  index: {
    fontFamily: INTER_FAMILY,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
    fontWeight: "500",
  } as TextStyle,

  /** Kicker boven een kop — klein, kapitaal, in flame-deep. */
  kicker: {
    fontFamily: INTER_FAMILY,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.5,
    fontWeight: "700",
  } as TextStyle,

  /** De labellaag: tabs, metadata, knoplabels. */
  label: {
    fontFamily: INTER_FAMILY,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    fontWeight: "600",
  } as TextStyle,

  /** Nog kleiner: de micro-utilityregel bovenaan de kop. */
  micro: {
    fontFamily: INTER_FAMILY,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.3,
    fontWeight: "500",
  } as TextStyle,

  /** Lopende tekst in een tegel of onder een kop. */
  body: {
    fontFamily: INTER_FAMILY,
    fontSize: 13.5,
    lineHeight: 20,
    letterSpacing: -0.1,
    fontWeight: "400",
  } as TextStyle,

  caption: {
    fontFamily: INTER_FAMILY,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "400",
  } as TextStyle,
} as const;

export const type = {
  /** Het affiche-moment. Zeldzaam. */
  display: {
    fontFamily: DISPLAY_FAMILY,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.4,
    fontWeight: "400",
  } as TextStyle,

  /** Wordmark in de kop. */
  wordmark: {
    fontFamily: DISPLAY_FAMILY,
    fontSize: 21,
    lineHeight: 25,
    letterSpacing: -0.3,
    fontWeight: "400",
  } as TextStyle,

  /** Kop van een vondst. Op desktop een maat groter, zie `headlineWide`. */
  headline: {
    fontFamily: SERIF_FAMILY,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.3,
    fontWeight: "400",
  } as TextStyle,

  headlineWide: {
    fontFamily: SERIF_FAMILY,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.4,
    fontWeight: "400",
  } as TextStyle,

  headlineSmall: {
    fontFamily: SERIF_FAMILY,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.1,
    fontWeight: "400",
  } as TextStyle,

  /** Het citaat zelf — het hart van een fragment. */
  quote: {
    fontFamily: SERIF_FAMILY,
    fontSize: 21,
    lineHeight: 33,
    letterSpacing: -0.2,
    fontWeight: "400",
  } as TextStyle,

  quoteLarge: {
    fontFamily: SERIF_FAMILY,
    fontSize: 27,
    lineHeight: 40,
    letterSpacing: -0.3,
    fontWeight: "400",
  } as TextStyle,

  /** Bronvermelding, onderschrift bij beeld. */
  caption: {
    fontFamily: SERIF_FAMILY_ITALIC,
    fontSize: 13.5,
    lineHeight: 20,
    fontStyle: "italic",
  } as TextStyle,

  /**
   * De labellaag. Zinsvorm, 11px, nauwelijks gespatieerd — rustiger en
   * beter leesbaar dan de kapitalen van de vorige versie.
   */
  meta: {
    fontFamily: SANS_FAMILY,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.1,
    fontWeight: "500",
  } as TextStyle,

  /** Kapitalen als uitzondering: rubrieken die echt moeten opvallen. */
  metaCaps: {
    fontFamily: SANS_FAMILY,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    fontWeight: "600",
  } as TextStyle,

  /** Lopende tekst: de toelichting van de deler. */
  body: {
    fontFamily: SANS_FAMILY,
    fontSize: 15,
    lineHeight: 24,
    letterSpacing: -0.1,
  } as TextStyle,

  bodySmall: {
    fontFamily: SANS_FAMILY,
    fontSize: 13,
    lineHeight: 20,
  } as TextStyle,
} as const;

// ---------------------------------------------------------------
// Kleurwaarden die als *prop* moeten (Ionicons, tintColor, borderColor
// in een style-object). Voor achtergronden gebruik je de Tailwind-tokens.
// ---------------------------------------------------------------

/** Het editorial-palet — feed en composer. */
export const carbon = {
  DEFAULT: "#12110F",
  soft: "#55534E",
  muted: "#8E8C86",
} as const;

export const page = {
  DEFAULT: "#F2F1EE",
  alt: "#E9E8E4",
  sheet: "#FFFFFF",
} as const;

/** Twee lijngewichten: zwart voor rubrieken, grijs tussen rijen. */
export const rule = {
  strong: "#12110F",
  soft: "#CFCDC7",
  onDark: "#3A3936",
} as const;

/** Het oudere warme palet — nog in gebruik door de niet-gemigreerde schermen. */
export const ink = {
  DEFAULT: "#1A1714",
  soft: "#5A4F40",
  muted: "#8A7E6C",
} as const;

export const cream = {
  DEFAULT: "#F5E8D3",
  soft: "#C7BBA9",
  muted: "#8A8275",
} as const;

export const line = {
  shell: "#2A2620",
  paper: "#D8C29B",
} as const;

export const flame = "#E66B3F";

/** Klein-tekst-veilige variant van flame: kickers, categoriekleur. */
export const flameDeep = "#C4491F";

/** Breekpunt waarboven de tweekolomsstructuur van het affiche aan gaat. */
export const WIDE_BREAKPOINT = 900;

// ---------------------------------------------------------------
// FEED V3 — kleurwaarden die als *prop* moeten. Voor achtergronden
// gebruik je de `feed-*` Tailwind-tokens.
// ---------------------------------------------------------------

export const feed = {
  /** Paginavlak van de feed. */
  lav: "#CDBEE3",
  /** Tekst én kaders. Kaders altijd op FEED_BORDER (1.5px). */
  ink: "#0B0A0C",
  /** Secundaire tekst op `lav` — inkt op 58%. */
  inkDim: "rgba(11,10,12,0.58)",
  /** Enkel het zijbalk-paneel. Nadrukkelijk NIET voor posts. */
  panel: "#EFE9F5",
  /** Élk post-oppervlak: cover-band, tegels, quote-band. */
  post: "#2E2138",
  /** Primaire tekst op `post`. */
  text: "#F3EDE4",
  /** Bijschrift/metadata op `post`. */
  textDim: "rgba(243,237,228,0.62)",
  /** Lijn binnen een post-oppervlak — licht, want op donker. */
  postRule: "rgba(243,237,228,0.22)",
  /** Secundaire accenten, opgehelderd zodat ze op `post` overeind blijven. */
  teal: "#4FBDB0",
  gold: "#E3A84B",
} as const;

/**
 * Breekpunt waarop de feed van twee kolommen (zijbalk + hoofdkolom)
 * naar één gestapelde kolom valt. Lager dan `WIDE_BREAKPOINT`, want
 * de zijbalk is smal genoeg om al vanaf 800px naast de inhoud te passen.
 */
export const FEED_BREAKPOINT = 800;
