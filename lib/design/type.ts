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

/** Breekpunt waarboven de tweekolomsstructuur van het affiche aan gaat. */
export const WIDE_BREAKPOINT = 900;
