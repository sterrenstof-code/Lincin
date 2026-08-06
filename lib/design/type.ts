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
// FEED V3 — het sans-stelsel.
//
// Dit blok staat náást het serif-systeem hierboven; welke waar
// geldt staat in DESIGN.md §3. Kort: `feedType` draagt de feed en
// alles wat sinds de v3-uitrol herbouwd is, `type` draagt de
// redactionele momenten (citaten, koppen van een vondst).
//
// De feed is bewust sans-only: ook de brontitel krijgt géén serif.
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

/**
 * ---------------------------------------------------------------
 * ÉÉN ZWART, ÉÉN GEBROKEN WIT — en ze staan gelijk aan Tailwind
 * ---------------------------------------------------------------
 * Deze waarden liepen uit de pas met `tailwind.config.js`. Daar wees
 * `ink` naar #0B0A0C en hier naar #1A1714; `cream` naar #F3EDE4 daar en
 * #F5E8D3 hier; `page` naar #CDBEE3 daar en #F2F1EE hier. Twee zwarten
 * van vier hexpunten uit elkaar zie je niet, en dat is precies waarom
 * het bleef staan: `text-ink` (klasse) en `ink.DEFAULT` (prop) gaven een
 * andere kleur zonder dat iets het meldde.
 *
 * Sinds de v3-uitrol is er één systeem. Deze objecten wijzen daarom nu
 * naar dezelfde waarden als het `feed`-object hieronder en als de
 * Tailwind-tokens. Ze blijven bestaan onder hun eigen naam omdat vier
 * componenten (Editorial, FindBody, CommentsSection, PostReactions) er
 * met een editoriale bedoeling naar verwijzen — `carbon.muted` zegt daar
 * iets anders dan `feed.textDim`.
 *
 * De pre-v3 exports `ink`, `cream` en `line` zijn weg: nergens
 * geïmporteerd, en ze hielden een tweede palet in leven. De
 * Tailwind-klassen `text-ink`/`text-cream` bestaan gewoon nog — die
 * komen uit `tailwind.config.js`, niet hieruit.
 */

/** Inkt op een licht vlak. Gelijk aan `feed.ink` en aan `ink` in Tailwind. */
export const carbon = {
  DEFAULT: "#0B0A0C",
  soft: "#3A3540",
  muted: "#6B6474",
} as const;

/** De lichte vlakken. Gelijk aan `page`/`paper` in Tailwind. */
export const page = {
  DEFAULT: "#CDBEE3",
  alt: "#EFE9F5",
  sheet: "#F5F1FA",
} as const;

/** Twee lijngewichten: inkt voor rubrieken, gedempt tussen rijen. */
export const rule = {
  strong: "#0B0A0C",
  soft: "rgba(11,10,12,0.25)",
  onDark: "rgba(243,237,228,0.22)",
} as const;

/**
 * Het scherpe drukwerk-rood. Draagt ALLE redactionele accenten:
 * citaattekens, indexcijfers, kickers, lijnwerk, gevulde knoppen.
 * Moet gelijk blijven aan `flame.DEFAULT` in tailwind.config.js.
 */
export const flame = "#E63329";

/**
 * Klein-tekst-veilige variant. De DEFAULT haalt op lavendel geen 4.5:1,
 * dus alles onder ~16px gebruikt deze: kickers, categorielabels.
 */
export const flameDeep = "#A81C13";

/**
 * Het warme oranje van de aankondigingsbalk — en van niets anders.
 * Bewust een eigen naam zodat het rood hierboven vrij te vervangen is
 * zonder de balk mee te nemen.
 */
export const announce = "#E66B3F";

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
