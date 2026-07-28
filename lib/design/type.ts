import { Platform, type TextStyle } from "react-native";

/**
 * Typografisch systeem — editorial / Zwitsers.
 *
 * Geïnspireerd op museumaffiches (Fondation Phi): brutaal schaalcontrast
 * tussen een hoog-contrast display-serif en piepkleine, wijd gespatieerde
 * kapitalen. De metadata fluistert, de inhoud schreeuwt. Daartussen zit
 * bijna niets — dat gat *is* het ontwerp.
 *
 * ---------------------------------------------------------------
 * FONTS — er wordt bewust géén fontbestand meegeleverd.
 * ---------------------------------------------------------------
 * iOS      Didot. Zit ingebouwd in het systeem, is een échte Didone en
 *          dus precies de referentie. Nul bytes in de bundle.
 * Web      Bodoni Moda (display) + Playfair Display (tekst), opgehaald
 *          door de browser via de stylesheet in `app/+html.tsx`.
 * Android  Valt terug op `serif` (Noto Serif). Er is geen Didone op
 *          Android zonder een bestand mee te leveren.
 *
 * Android gelijktrekken is één commando en één regel:
 *   npx expo install @expo-google-fonts/bodoni-moda expo-font
 * en dan hieronder de `android`-tak naar "BodoniModa_400Regular" wijzen
 * plus het font laden in `app/_layout.tsx`. Verder verandert er niets —
 * alle componenten lezen uitsluitend uit dit bestand.
 *
 * Twee serif-rollen, want een Didone op 44px en op 17px vragen om een
 * andere snit: DISPLAY voor het affiche-moment, SERIF voor leesmaten.
 */

/** Alleen voor `type.display` — de grootst mogelijke maat. */
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

export const SANS_FAMILY = Platform.select({
  ios: "Helvetica Neue",
  android: "sans-serif",
  default: "'Helvetica Neue', Helvetica, Arial, sans-serif",
}) as string;

/**
 * `type.x` geeft een kant-en-klare TextStyle. Gebruik dit voor alles wat
 * met de editorial-laag te maken heeft; NativeWind-classes blijven voor
 * kleur, spacing en layout.
 */
export const type = {
  /** Het affiche-moment. Eén per scherm, hooguit. */
  display: {
    fontFamily: DISPLAY_FAMILY,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.2,
    fontWeight: "400",
  } as TextStyle,

  /** Kop van een vondst: artikeltitel, videotitel. */
  headline: {
    fontFamily: SERIF_FAMILY,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontWeight: "400",
  } as TextStyle,

  headlineSmall: {
    fontFamily: SERIF_FAMILY,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
    fontWeight: "400",
  } as TextStyle,

  /** Het citaat zelf — het hart van een fragment. */
  quote: {
    fontFamily: SERIF_FAMILY,
    fontSize: 21,
    lineHeight: 32,
    letterSpacing: -0.2,
    fontWeight: "400",
  } as TextStyle,

  quoteLarge: {
    fontFamily: SERIF_FAMILY,
    fontSize: 26,
    lineHeight: 37,
    letterSpacing: -0.3,
    fontWeight: "400",
  } as TextStyle,

  /** Bronvermelding, onderschrift bij beeld. */
  caption: {
    fontFamily: SERIF_FAMILY_ITALIC,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  } as TextStyle,

  /**
   * De fluistering: 9px kapitalen, wijd gespatieerd. Rubrieklabels,
   * kolomkoppen, soort-aanduiding. Altijd in hoofdletters zetten via
   * `toUpperCase()` — niet via CSS, want RN's textTransform is traag.
   */
  meta: {
    fontFamily: SANS_FAMILY,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.3,
    fontWeight: "600",
  } as TextStyle,

  metaLarge: {
    fontFamily: SANS_FAMILY,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 1.5,
    fontWeight: "600",
  } as TextStyle,

  /** Lopende tekst in de toelichting van de deler. */
  body: {
    fontFamily: SANS_FAMILY,
    fontSize: 14.5,
    lineHeight: 22,
    letterSpacing: -0.1,
  } as TextStyle,

  bodySmall: {
    fontFamily: SANS_FAMILY,
    fontSize: 12.5,
    lineHeight: 18,
  } as TextStyle,

  /**
   * Boek-alinea: eerste regel ingesprongen, geen witruimte ertussen.
   * Zoals de slottekst op het affiche.
   */
  proseIndent: {
    fontFamily: SANS_FAMILY,
    fontSize: 13.5,
    lineHeight: 21,
  } as TextStyle,
} as const;

/** Kleurwaarden die als *prop* moeten (Ionicons, tintColor) — geen classes. */
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
