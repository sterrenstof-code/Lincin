import { Platform, type TextStyle } from "react-native";

import { color, subscribeScheme, subscribeTheme, themeSpec, type LincinTheme } from "./theme";

/**
 * ===============================================================
 * LINCIN v2 — drie letters
 * ===============================================================
 *
 * Uit `design_handoff_lincin_mobile/README.md`:
 *
 *   ARCHIVO           koppen: 900, 75% breed, kapitaal, regelhoogte .9–1.
 *                     Lopende tekst 15px/1.35, knoplabels 700 10px kapitaal.
 *   INSTRUMENT SERIF  bijschriften, paginatitels, citaten in een blad.
 *   IBM PLEX MONO     meta, labels, knoppen — kapitaal, .04–.1em spatie.
 *
 * ---------------------------------------------------------------
 * HOE DE LETTERS BINNENKOMEN
 * ---------------------------------------------------------------
 * `assets/fonts/` bevat statische snitten (van Google Fonts, per as-punt
 * uitgeschreven, dus zonder variabele as). Native laadt ze met expo-font
 * in `app/_layout.tsx`, onder de naam van het bestand. Web haalt Archivo,
 * Instrument Serif en IBM Plex Mono bij Google zelf (sneller, gecachet)
 * en alleen de smalle Archivo via `@font-face` uit `public/fonts/`, want
 * die smalle snit bestaat bij Google alleen als as van het variabele
 * bestand en react-native-web zet geen `font-stretch`.
 *
 * Daarom staan de gewichten hier als losse *snitten* en niet als
 * `fontWeight`: op native heet Archivo 700 "Archivo-Bold", en een
 * fontWeight op een snit die maar één gewicht heeft levert een nagemaakt
 * vet op. `sans()`, `serif()`, `mono()` en `head()` kiezen per platform.
 */

const isWeb = Platform.OS === "web";

/** De familienamen zoals ze geregistreerd zijn (native) of op web heten. */
export const FONT = {
  head: isWeb ? "'ArchivoCond-Black', 'Archivo', 'Helvetica Neue', sans-serif" : "ArchivoCond-Black",
  /** Archivo 900 op 62% breed: cijfers, initialen in een kleurcel, het masthead. */
  headX: isWeb ? "'ArchivoXCond-Black', 'ArchivoCond-Black', 'Archivo', sans-serif" : "ArchivoXCond-Black",
  sans: isWeb ? "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif" : "Archivo-Regular",
  sansMedium: isWeb ? "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif" : "Archivo-Medium",
  sansBold: isWeb ? "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif" : "Archivo-Bold",
  /** Archivo 600, 800 en 900 op volle breedte: het woordmerk en de rode titels van magazine. */
  sansSemi: isWeb ? "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif" : "Archivo-SemiBold",
  sansExtra: isWeb ? "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif" : "Archivo-ExtraBold",
  sansBlack: isWeb ? "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif" : "Archivo-Black",
  serif: isWeb ? "'Instrument Serif', Georgia, 'Times New Roman', serif" : "InstrumentSerif-Regular",
  serifItalic: isWeb ? "'Instrument Serif', Georgia, 'Times New Roman', serif" : "InstrumentSerif-Italic",
  mono: isWeb ? "'IBM Plex Mono', Menlo, Consolas, monospace" : "IBMPlexMono-Regular",
  monoMedium: isWeb ? "'IBM Plex Mono', Menlo, Consolas, monospace" : "IBMPlexMono-Medium",
  monoSemi: isWeb ? "'IBM Plex Mono', Menlo, Consolas, monospace" : "IBMPlexMono-SemiBold",
} as const;

/** De snitten die `app/_layout.tsx` op native laadt; sleutel = familienaam. */
export const FONT_FILES = {
  "ArchivoCond-Black": require("../../assets/fonts/ArchivoCond-Black.ttf"),
  "ArchivoXCond-Black": require("../../assets/fonts/ArchivoXCond-Black.ttf"),
  "Archivo-Regular": require("../../assets/fonts/Archivo-Regular.ttf"),
  "Archivo-Medium": require("../../assets/fonts/Archivo-Medium.ttf"),
  "Archivo-Bold": require("../../assets/fonts/Archivo-Bold.ttf"),
  "Archivo-SemiBold": require("../../assets/fonts/Archivo-SemiBold.ttf"),
  "Archivo-ExtraBold": require("../../assets/fonts/Archivo-ExtraBold.ttf"),
  "Archivo-Black": require("../../assets/fonts/Archivo-Black.ttf"),
  "InstrumentSerif-Regular": require("../../assets/fonts/InstrumentSerif-Regular.ttf"),
  "InstrumentSerif-Italic": require("../../assets/fonts/InstrumentSerif-Italic.ttf"),
  "IBMPlexMono-Regular": require("../../assets/fonts/IBMPlexMono-Regular.ttf"),
  "IBMPlexMono-Medium": require("../../assets/fonts/IBMPlexMono-Medium.ttf"),
  "IBMPlexMono-SemiBold": require("../../assets/fonts/IBMPlexMono-SemiBold.ttf"),
};

/** Archivo op leesmaat. */
export function sans(weight: 400 | 500 | 600 | 700 | 800 | 900 = 400): TextStyle {
  const fontFamily =
    weight === 900
      ? FONT.sansBlack
      : weight === 800
        ? FONT.sansExtra
        : weight === 700
          ? FONT.sansBold
          : weight === 600
            ? FONT.sansSemi
            : weight === 500
              ? FONT.sansMedium
              : FONT.sans;
  return isWeb ? { fontFamily, fontWeight: String(weight) as TextStyle["fontWeight"] } : { fontFamily };
}

/** Instrument Serif, rechtop of cursief. */
export function serif(italic = false): TextStyle {
  return isWeb
    ? { fontFamily: FONT.serif, fontStyle: italic ? "italic" : "normal", fontWeight: "400" }
    : { fontFamily: italic ? FONT.serifItalic : FONT.serif };
}

/**
 * De ONDERSCHRIFTLETTER (`--capf` in de prototypes).
 *
 * Bijschriften, citaten, paginatitels en namen staan in Instrument Serif —
 * behalve in modern. Daar bestaat geen serif én geen cursief (`--hfi` staat
 * er op `normal`): alles loopt in gewone Archivo. Vandaar deze functie in
 * plaats van `serif()` overal: hij kiest de letter die bij het thema hoort.
 *
 * `heavy` is voor de grotere trappen — een titel, een naam — die in modern
 * op 500 staan en niet op 400.
 */
export function capf(italic = false, heavy = false): TextStyle {
  if (themeSpec().heads === "archivo") {
    // Modern kent geen cursief; de nadruk komt van de maat, niet van de hoek.
    return sans(heavy ? 500 : 400);
  }
  return serif(italic);
}

/** IBM Plex Mono. */
export function mono(weight: 400 | 500 | 600 = 500): TextStyle {
  const fontFamily = weight === 600 ? FONT.monoSemi : weight === 500 ? FONT.monoMedium : FONT.mono;
  return isWeb ? { fontFamily, fontWeight: String(weight) as TextStyle["fontWeight"] } : { fontFamily };
}

/**
 * De kop. Drie letters, één per thema (`--tf/--tw/--tt` in het prototype):
 *
 *   kleur     Archivo 900, 75% breed, altijd kapitaal.
 *   magazine  Instrument Serif regular, geen kapitaal.
 *   modern    gewone Archivo op 500, geen kapitaal — de spatiëring komt
 *             er per maat bij (−.02em/−.03em), zie `lincinType`.
 *
 * Leest het thema op het moment van bouwen; `lincinType` wordt bij een
 * wissel opnieuw gebouwd.
 */
export function head(): TextStyle {
  const heads = themeSpec().heads;
  if (heads === "serif") {
    return isWeb
      ? { fontFamily: FONT.serif, fontWeight: "400", fontStyle: "normal", textTransform: "none" }
      : { fontFamily: FONT.serif, textTransform: "none" };
  }
  if (heads === "archivo") {
    return isWeb
      ? { fontFamily: FONT.sansMedium, fontWeight: "500", textTransform: "none" }
      : { fontFamily: FONT.sansMedium, textTransform: "none" };
  }
  return isWeb
    ? { fontFamily: FONT.head, fontWeight: "900", textTransform: "uppercase" }
    : { fontFamily: FONT.head, textTransform: "uppercase" };
}

/**
 * Het cijfer: Archivo 900 op 62% — de dag in een eventkaart, de initiaal
 * in een kleurcel, de drie cijfers op "Jij". In élk thema, want het
 * prototype zet hier `font-stretch: 62%` los van `--tf`.
 */
export function numeral(): TextStyle {
  return isWeb ? { fontFamily: FONT.headX, fontWeight: "900" } : { fontFamily: FONT.headX };
}

/**
 * De typeschaal van v2. Maten uit README §Typography.
 *
 * Regelhoogtes staan in px: RN kent geen `line-height: 1`. Koppen op
 * fontSize × 1 (README: .9–1), serif op × 1.25, lopende tekst op × 1.35.
 */
function buildLincinType() {
  const heads = themeSpec().heads;
  const serif_ = heads === "serif";
  /**
   * Serifkoppen spatiëren niet; Archivo 900 op −.01em, en de gewone
   * Archivo van modern strakker: −.02em (2.2 §1).
   */
  const ls = (px: number) => (serif_ ? 0 : heads === "archivo" ? -px / 50 : -px / 100);
  const cardTitle = themeSpec().cardTitle;
  return {
  // ---- mono: meta, labels, knoppen ----
  /** 11px, kapitaal, .06em — de kop van de app, chipteksten. */
  meta: { ...mono(500), fontSize: 11, lineHeight: 14, letterSpacing: 0.66, textTransform: "uppercase" } as TextStyle,
  /** 10px, kapitaal, .08em — de kleine regel: aantallen, tijd, rubriek. */
  micro: { ...mono(500), fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase" } as TextStyle,
  /** 9px — coördinaten, de allerkleinste noot. */
  tiny: { ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 0.54, textTransform: "uppercase" } as TextStyle,
  /** 10px 600 — de actiebalk van een kaart, tabs in een blad. */
  action: { ...mono(600), fontSize: 10, lineHeight: 13, letterSpacing: 0.4, textTransform: "uppercase" } as TextStyle,
  /** 12px 600 — pollopties, naam bij een comment. */
  monoBody: { ...mono(600), fontSize: 12, lineHeight: 16 } as TextStyle,

  // ---- Archivo: lopende tekst en knoplabels ----
  body: { ...sans(400), fontSize: 15, lineHeight: 20 } as TextStyle,
  bodySmall: { ...sans(400), fontSize: 13, lineHeight: 18 } as TextStyle,
  /** De knop: 700 10px kapitaal, .1em. */
  button: { ...sans(700), fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase" } as TextStyle,
  /** Het tabblad onderaan: dezelfde letter. */
  tab: { ...sans(700), fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase" } as TextStyle,
  /** De initiaal in een avatar. */
  initial: { ...sans(700), fontSize: 13, lineHeight: 16 } as TextStyle,

  // ---- Instrument Serif: bijschriften, titels, citaten ----
  caption: { ...capf(), fontSize: 15, lineHeight: 19 } as TextStyle,
  captionLarge: { ...capf(), fontSize: 17, lineHeight: 21 } as TextStyle,
  /** Het tekstvlak van een tekstbijdrage, en het bijschrift op de bladzijde. */
  quote: { ...capf(), fontSize: 19, lineHeight: 24 } as TextStyle,
  quoteLarge: { ...capf(), fontSize: 20, lineHeight: 25 } as TextStyle,
  /** "Zeg iets tegen …", de gestreepte kaarten. */
  aside: { ...capf(true), fontSize: 17, lineHeight: 21 } as TextStyle,
  asideSmall: { ...capf(true), fontSize: 14, lineHeight: 18 } as TextStyle,
  /** De rij in een lijst (Instellingen →). */
  row: { ...capf(false, true), fontSize: 19, lineHeight: 24 } as TextStyle,
  /** De naam in de gesprekkenlijst en de kop van een gesprek. */
  name: { ...capf(false, true), fontSize: 20, lineHeight: 25 } as TextStyle,
  /** Titel van een event. */
  eventTitle: { ...capf(false, true), fontSize: 24, lineHeight: 26, letterSpacing: -0.24 } as TextStyle,
  /** De paginatitel: "Wat je vrienden maken". */
  pageTitle: { ...capf(false, true), fontSize: 30, lineHeight: 30, letterSpacing: -0.3 } as TextStyle,
  pageTitleItalic: { ...capf(true, true), fontSize: 30, lineHeight: 30, letterSpacing: -0.3 } as TextStyle,
  pageTitleLarge: { ...capf(false, true), fontSize: 32, lineHeight: 33, letterSpacing: -0.32 } as TextStyle,
  /** Je eigen naam op "Jij". */
  ownName: { ...capf(false, true), fontSize: 34, lineHeight: 33, letterSpacing: -0.34 } as TextStyle,
  ownNameItalic: { ...capf(true, true), fontSize: 34, lineHeight: 33, letterSpacing: -0.34 } as TextStyle,

  // ---- Archivo 900 smal: de koppen ----
  /** Kaarttitel 22px, max 3 regels = 66px. */
  cardTitle: { ...head(), fontSize: cardTitle, lineHeight: cardTitle, letterSpacing: ls(cardTitle) } as TextStyle,
  /** Naam in de band. */
  band: { ...head(), fontSize: 22, lineHeight: 22, letterSpacing: ls(22) } as TextStyle,
  /** Tijdband in "Op tijd". */
  bandSmall: { ...head(), fontSize: 20, lineHeight: 20, letterSpacing: ls(20), textTransform: "uppercase" } as TextStyle,
  /** Titel op de bladzijde van een bijdrage. */
  postTitle: { ...head(), fontSize: 32, lineHeight: 31, letterSpacing: ls(32) } as TextStyle,
  /** Naam op een profiel. */
  profileName: { ...head(), fontSize: 44, lineHeight: 41, letterSpacing: ls(44) } as TextStyle,
  /** "Je feed is zo leeg als een nieuw schetsboek". */
  emptyTitle: { ...head(), fontSize: 40, lineHeight: 37, letterSpacing: ls(40) } as TextStyle,
  /** De dag in een eventkaart, de initiaal in een gesprek. */
  numeral: { ...numeral(), fontSize: 44, lineHeight: 42 } as TextStyle,
  numeralSmall: { ...numeral(), fontSize: 28, lineHeight: 28 } as TextStyle,
  numeralTiny: { ...numeral(), fontSize: 26, lineHeight: 26 } as TextStyle,
  /** Track in een muziekkaart. */
  track: { ...head(), fontSize: 18, lineHeight: 18, textTransform: "uppercase" } as TextStyle,
  /** "Niemand maakte iets nieuws. Jij wel?" op de eindkaart: 26px. */
  endTitle: { ...head(), fontSize: 26, lineHeight: 25, textTransform: "uppercase" } as TextStyle,
  /** Vermelde bijdrage in een gesprek. */
  mini: { ...head(), fontSize: 12, lineHeight: 12 } as TextStyle,
  /** Het masthead van magazine: "LINCIN" op 132px, 62% breed. */
  masthead: { ...numeral(), fontSize: 132, lineHeight: 108, letterSpacing: -5.28, textTransform: "uppercase" } as TextStyle,
  } as const;
}

/**
 * De typeschaal van v2. Een `let` en geen `const`: de koppen wisselen
 * van letter met het thema, en een import is een levende verwijzing —
 * wie `lincinType.cardTitle` leest ná een wissel krijgt de nieuwe.
 */
export let lincinType = buildLincinType();

subscribeTheme(() => {
  lincinType = buildLincinType();
});

// ===============================================================
// DE OUDE SCHALEN — namen blijven, letters zijn nu die van v2
// ===============================================================
//
// `feedType` en `type` dragen de schermen die nog niet herbouwd zijn.
// Hun families wijzen nu naar Archivo en Instrument Serif; de gewichten
// blijven staan. Op iOS lost het systeem een gewicht binnen de familie op
// (Archivo-Regular + 700 → de geladen Bold), op Android wordt het een
// nagemaakt vet — aanvaardbaar voor schermen die nog aan de beurt komen.

/** Alleen voor de grootste maten. */
const DISPLAY_FAMILY = FONT.serif;

/** Koppen en citaten op leesmaat. */
const SERIF_FAMILY = FONT.serif;

const SERIF_FAMILY_ITALIC = FONT.serifItalic;

/** Neutrale grotesk voor alles wat geen inhoud is. */
const SANS_FAMILY = FONT.sans;

/** De grotesk van het feed-systeem. */
export const INTER_FAMILY = FONT.sans;

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
 * KLEUR ALS PROP — en waarom het geen hexwaarden meer zijn
 * ---------------------------------------------------------------
 * Deze waarden liepen ooit uit de pas met `tailwind.config.js`: `ink` wees
 * daar naar #0B0A0C en hier naar #1A1714, `cream` naar #F3EDE4 daar en
 * #F5E8D3 hier. Twee zwarten van vier hexpunten uit elkaar zie je niet, en
 * dat is precies waarom het bleef staan.
 *
 * Nu kán dat niet meer: allebei lezen ze dezelfde variabele. Wat hier
 * `carbon.DEFAULT` heet en daar `ink`, is letterlijk `--c-ink` — één
 * waarde, gedefinieerd in `global.css`, uitgelegd in `lib/design/theme.ts`.
 *
 * Op web is een prop dus een stukje CSS (`rgb(var(--c-ink) / 1)`), en dat
 * betekent dat een kleur die in een style-object staat net zo goed meeschuift
 * met de stand als een klasse — zonder dat React iets hertekent.
 *
 * Op native bestaan variabelen niet. Daar worden deze bindingen opnieuw
 * opgebouwd zodra de stand wisselt (`subscribeScheme` onderaan) en hertekent
 * `ThemeGate` in `app/_layout.tsx` de boom.
 *
 * De namen blijven bestaan omdat vier componenten (Editorial, FindBody,
 * CommentsSection, PostReactions) er met een editoriale bedoeling naar
 * verwijzen — `carbon.muted` zegt daar iets anders dan `feed.textDim`.
 */

/** Inkt op een licht vlak. Gelijk aan `feed.ink` en aan `ink` in Tailwind. */
export let carbon = {
  DEFAULT: color("ink"),
  soft: color("inkSoft"),
  muted: color("inkMuted"),
};

/** De lichte vlakken. Gelijk aan `page`/`paper` in Tailwind. */
export let page = {
  DEFAULT: color("page"),
  alt: color("panel"),
  sheet: color("paperLight"),
};

/** Twee lijngewichten: inkt voor rubrieken, gedempt tussen rijen. */
export let rule = {
  strong: color("ink"),
  soft: color("ink", "linePaper"),
  /**
   * Waarmee een kaart zichzelf afsluit.
   *
   * Nu een kaart geen eigen vulling meer heeft (DESIGN.md §4) is er niets
   * dat zegt waar hij ophoudt: in een metselwerk lopen de laatste regel van
   * de ene en de kicker van de volgende in elkaar over. Deze lijn is
   * daarvoor, en hij is zwaarder dan de lijnen ín de kaart — anders leest
   * één kaart als drie losse.
   */
  card: color("ink", "cardEdge"),
  onDark: color("cream", "onDark"),
};

/**
 * Het scherpe accent. Draagt ALLE redactionele accenten: citaattekens,
 * indexcijfers, kickers, lijnwerk, gevulde knoppen.
 *
 * Donker is dat het drukwerkrood #E63329, licht de diepe oranje #D4551F.
 * Op lavendel staat rood rustig; op een wit blad met verder alleen grijzen
 * is rood náást de oranje balk één warme kleur te veel.
 */
export let flame = color("flame");

/**
 * Klein-tekst-veilige variant. De DEFAULT haalt op het paginavlak geen
 * 4.5:1, dus alles onder ~16px gebruikt deze: kickers, categorielabels.
 */
export let flameDeep = color("flameDeep");

/**
 * Het warme oranje van de aankondigingsbalk — en van niets anders. In
 * béide standen dezelfde kleur: dit is wat de app herkenbaar maakt.
 */
export let announce = color("announce");

/**
 * Dezelfde oranje, ingedrukt. Voor de primaire actie: delen, toevoegen,
 * opties. Dat waren rode vlakken, en rood is in dit ontwerp het accent van
 * de redactie — citaten, indexcijfers, lijnwerk. Een knop die iets dóet
 * hoort niet dezelfde kleur te hebben als een aanhalingsteken.
 */
export let announceDeep = color("announceDeep");

/**
 * Het blauw van het merk.
 *
 * §2 hield dit bij het logo en de e2e-badge, en dat was juist zolang het
 * nergens anders nodig was. Het profielraster maakt er een derde gebruik
 * van: het stipje op een tegel die méér draagt dan zijn foto (zie
 * `components/PostGrid.tsx`).
 *
 * Waarom niet flame of announce, de twee accenten die er al waren: die
 * zeggen allebei iets. Rood is de redactie — citaten, indexcijfers — en
 * oranje is "hier kun je op drukken". Het stipje zegt geen van beide; het
 * is een voetnootteken. Blauw is de enige kleur in dit palet die nergens
 * anders een betekenis draagt, en dat is precies waarom het geschikt is.
 */
export let brand = color("brand");

/**
 * Breekpunt waarboven de tweekolomsstructuur van het affiche aan gaat.
 *
 * Stond op 900 en dat gaf een dode zone precies waar de meeste tablets
 * liggen. De feed schakelt naar twee kolommen vanaf `FEED_BREAKPOINT`
 * (800), maar typografie, kolombreedtes en paginakoppen bleven tot 900 in
 * hun telefoonmaat. Een iPad 10.9" (820pt) en een iPad Pro 11" (834pt)
 * staan daar middenin: een tweekolomsfeed met telefoontypografie ernaast.
 *
 * Nu gelijk aan `FEED_BREAKPOINT`. De twee namen blijven bestaan omdat ze
 * over verschillende dingen gáán — de een over de zijbalk, de ander over de
 * leesmaat — maar er is geen reden waarom die op een ander moment zouden
 * moeten omslaan, en zolang ze verschilden was er een band waarin het
 * scherm half het een en half het ander was.
 *
 * Een iPad mini (744pt staand) blijft bewust telefoonbreed: daar is een
 * zijbalk náást de inhoud geen winst maar een versmalling.
 */
export const WIDE_BREAKPOINT = 800;

// ---------------------------------------------------------------
// FEED V3 — kleurwaarden die als *prop* moeten. Voor achtergronden
// gebruik je de `feed-*` Tailwind-tokens.
// ---------------------------------------------------------------

export let feed = {
  /** Paginavlak van de feed. */
  lav: color("page"),
  /** Tekst én kaders óp dat vlak. Kaders altijd op FEED_BORDER (1.5px). */
  ink: color("ink"),
  /** Secundaire tekst op het paginavlak — inkt op 58%. */
  inkDim: color("ink", "inkDim"),
  /** Enkel het zijbalk-paneel. Nadrukkelijk NIET voor posts. */
  panel: color("panel"),
  /**
   * Élk post-oppervlak: cover-band, tegels, quote-band.
   *
   * Dit is het énige vlak dat volledig kantelt tussen de twee standen —
   * plum in de donkere, wit in de lichte. `text`, `textDim` en `postRule`
   * hieronder kantelen mee; zonder dat staat er crème op wit.
   *
   * Staat er tekst op een vlak dat in béide standen donker blijft (de balk
   * bovenaan, een gevulde zwarte knop, een camerascherm), gebruik dan
   * `cream` uit Tailwind of `creamOnDark` hieronder — niet `feed.text`.
   */
  post: color("post"),
  /** Het vlak waar een foto nog moet landen. Kantelt mee met `post`. */
  postFill: color("postFill"),
  /** Primaire tekst op `post`. */
  text: color("postText"),
  /** Bijschrift/metadata op `post`. */
  textDim: color("postText", "postDim"),
  /** Lijn binnen een post-oppervlak. */
  postRule: color("postText", "postRule"),
  /** Secundaire accenten, opgehelderd zodat ze op `post` overeind blijven. */
  teal: color("teal"),
  gold: color("gold"),
};

/**
 * Tekst op een vlak dat in béide standen donker blijft.
 *
 * De balk bovenaan, een gevulde zwarte of oranje knop, een camerascherm,
 * een eigen chatbubbel: die vlakken kantelen niet mee, dus hun tekst mag
 * dat ook niet. `feed.text` doet dat wél — dat is de tegenhanger van het
 * kaartoppervlak — en stond hier eerder ten onrechte.
 */
/**
 * Het werkblad van de niet-gemigreerde schermen, als prop.
 *
 * Zie `desk` in `tailwind.config.js` en de uitleg in `lib/design/theme.ts`:
 * vlak én tekst kantelen samen, zodat die schermen in de donkere stand
 * blijven wat ze waren en in de lichte stand een blad worden.
 */
export let desk = {
  DEFAULT: color("desk"),
  ink: color("deskInk"),
  soft: color("deskSoft"),
  muted: color("deskMuted"),
  panel: color("deskPanel"),
};

/**
 * Het vlak dat in béide standen zwart blijft: de kopbalk, en de strook
 * onderaan die zegt wat er misging (`lib/toast.tsx`). Bestond alleen als
 * Tailwind-klasse (`bg-shell`), maar wie het als prop nodig heeft — een
 * style-object, een `backgroundColor` — schreef de hex over. §7 kent geen
 * hexwaarden inline, dus staat hij nu hier.
 */
export let shell = color("shell");

export let creamOnDark = {
  DEFAULT: color("cream"),
  soft: color("creamSoft"),
  muted: color("creamMuted"),
  rule: color("cream", "onDark"),
};

/**
 * De bladspiegel: waar een pagina begint en ophoudt.
 *
 * Dezelfde maat die `Sheet` aanhoudt. Staat hier omdat de kopbalk hem ook
 * nodig heeft: die hing eerder aan wat de pagina toevallig meegaf, en nam
 * daardoor per scherm een andere breedte en positie aan — smal op een
 * vondst, van rand tot rand op de feed. Een kop die per pagina verspringt
 * leest als een ander blad. Nu is er één maat en hangt de balk er niet meer
 * van af wie hem aanroept.
 */
export function sheetWidth(wide: boolean): number {
  /**
   * 1250 is de bladbreedte. Alles hangt eraan: de kopbalk, het woordmerk,
   * de schakelbalk, de rubrieken eronder.
   *
   * Stond op 1180, maar alleen de kop hield zich eraan — de inhoud eronder
   * liep via `PageScroll` gewoon door tot de vensterrand. Twee maten op één
   * pagina, en dan is er geen bladspiegel meer maar een kop die toevallig
   * ergens boven zweeft. De marge links en rechts komt van `gutter()`, dus
   * de tekst raakt de rand nooit.
   */
  return wide ? 1250 : 720;
}

// ---------------------------------------------------------------
// RUIMTE — de maatlat waar het raster op staat
// ---------------------------------------------------------------

/**
 * Eén ruimtemaat voor de hele app, in stappen van vier.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * Het systeem had wél tokens voor kleur en type maar niet voor ruimte, en
 * dat is precies waar het uit elkaar liep: de kop hield 24 aan, een
 * detailpagina 20, een rubriek 40, een kaart 18. Vier waarden die alle vier
 * "een marge" bedoelden, en op het scherm zag je ze niet uitlijnen.
 *
 * Gebruik een trede. Staat de maat die je nodig hebt er niet in, voeg er dan
 * één toe in plaats van een los getal te strooien — dat is dezelfde regel
 * als bij de typeschaal.
 */
export const space = {
  /** 4 — tussen twee dingen die bij elkaar hóren (icoon en label). */
  xs: 4,
  /** 8 — binnen één element. */
  sm: 8,
  /** 12 — tussen regels in een blok. */
  md: 12,
  /** 16 — tussen blokken; de marge op een telefoon. */
  lg: 16,
  /** 20 — binnenmarge van een kaart. */
  xl: 20,
  /** 24 — de marge op een breed scherm. */
  xxl: 24,
  /** 32 — binnenmarge van een kolom binnen een kader. */
  xxxl: 32,
  /** 40 — tussen twee rubrieken. */
  section: 40,
} as const;

/**
 * De hoogte van élk aanraakbaar besturingselement: een knop, een
 * invoerveld, de knoppen naast een tekstregel.
 *
 * Eén maat, want een rij met een knop van 44, een van 52 en een veld dat
 * met zijn inhoud meegroeit staat nergens op één lijn — precies wat er in
 * de berichtenbalk gebeurde.
 */
export const CONTROL_H = 44;

/**
 * De hoogte van een rij in een lijst (gesprek, deelnemer, melding).
 * Een avatar van 36 plus de marge erboven en eronder; vast, zodat een naam
 * die op twee regels valt de rij niet hoger maakt dan zijn buur.
 */
export const ROW_H = 60;

/**
 * De marge tussen de bladspiegel en de rand van het venster.
 *
 * Kop én inhoud lezen deze: staan ze op verschillende waarden, dan begint de
 * pagina vier pixels naast zijn eigen kop en dat zie je meteen.
 */
export function gutter(wide: boolean): number {
  return wide ? space.xxl : space.lg;
}


/**
 * Native kent geen CSS-variabelen: daar staat in élke binding hierboven de
 * échte kleur van de stand die op dát moment gold. Wisselt de stand, dan
 * moeten ze opnieuw opgebouwd worden. Op web is dit een no-op — daar staat
 * er al een variabele in en doet de browser het werk.
 *
 * De bindingen zijn `let` en geen `const` juist hiervoor: een import is een
 * levende verwijzing, dus wie `feed.ink` leest krijgt na deze herbouw
 * vanzelf de nieuwe waarde.
 */
if (Platform.OS !== "web") {
  subscribeScheme(() => {
    carbon = { DEFAULT: color("ink"), soft: color("inkSoft"), muted: color("inkMuted") };
    page = { DEFAULT: color("page"), alt: color("panel"), sheet: color("paperLight") };
    rule = {
      strong: color("ink"),
      soft: color("ink", "linePaper"),
      card: color("ink", "cardEdge"),
      onDark: color("cream", "onDark"),
    };
    flame = color("flame");
    flameDeep = color("flameDeep");
    announce = color("announce");
    announceDeep = color("announceDeep");
    brand = color("brand");
    feed = {
      lav: color("page"),
      ink: color("ink"),
      inkDim: color("ink", "inkDim"),
      panel: color("panel"),
      post: color("post"),
      postFill: color("postFill"),
      text: color("postText"),
      textDim: color("postText", "postDim"),
      postRule: color("postText", "postRule"),
      teal: color("teal"),
      gold: color("gold"),
    };
    desk = {
      DEFAULT: color("desk"),
      ink: color("deskInk"),
      soft: color("deskSoft"),
      muted: color("deskMuted"),
      panel: color("deskPanel"),
    };
    shell = color("shell");
    creamOnDark = {
      DEFAULT: color("cream"),
      soft: color("creamSoft"),
      muted: color("creamMuted"),
      rule: color("cream", "onDark"),
    };
  });
}

// ===============================================================
// DE KOPSCHAAL — één schaal, drie invullingen (2.2 §3)
// ===============================================================

/**
 * De tien trappen uit de prototypes (`--h11` … `--h52`).
 *
 * De naam is de maat in kleur; magazine zet er een grotere serif neer
 * (serifletters lezen kleiner bij dezelfde punt, vandaar ±20 %) en modern
 * een gewone Archivo op 500. De twee kleinste trappen blijven in élk thema
 * Archivo: dat zijn etiketten, geen koppen.
 *
 *   trap   kleur              magazine                modern
 *   h11    900 11 Archivo     500 11 Archivo          600 11 Archivo
 *   h12    900 12 Archivo     500 12 Archivo          600 12 Archivo
 *   h15    900 15 Archivo     400 19 Instrument       500 16 Archivo
 *   h18    900 18 Archivo     400 23 Instrument       500 19 Archivo
 *   h19    900 19 Archivo     400 24 Instrument       500 20 Archivo
 *   h26    900 26 Archivo     400 30 Instrument       500 24 Archivo
 *   h30    900 30 Archivo     400 34 Instrument       500 30 Archivo
 *   h34    900 34 Archivo     400 40 Instrument       500 34 Archivo
 *   h44    900 44 Archivo     400 50 Instrument       500 42 Archivo
 *   h52    900 52 Archivo     400 58 Instrument       500 50 Archivo
 *
 * `hstr` (75 % breed in kleur), `htt` (kapitaal in kleur) en de letter
 * zelf komen uit `head()`; deze functie legt er de maat overheen.
 */
export type HeadStep = 11 | 12 | 15 | 18 | 19 | 26 | 30 | 34 | 44 | 52;

const HEAD_SIZE: Record<LincinTheme, Record<HeadStep, number>> = {
  kleur:    { 11: 11, 12: 12, 15: 15, 18: 18, 19: 19, 26: 26, 30: 30, 34: 34, 44: 44, 52: 52 },
  magazine: { 11: 11, 12: 12, 15: 19, 18: 23, 19: 24, 26: 30, 30: 34, 34: 40, 44: 50, 52: 58 },
  modern:   { 11: 11, 12: 12, 15: 16, 18: 19, 19: 20, 26: 24, 30: 30, 34: 34, 44: 42, 52: 50 },
};

/**
 * Eén trap van de kopschaal, in het thema dat nu geldt.
 *
 * `lineHeight` volgt de letter: een serifkop op .96 van zijn maat (de
 * regels mogen daar dicht op elkaar), Archivo 900 op 1, en de gewone
 * Archivo van modern op 1.15 omdat die in gemengde kast loopt.
 */
export function headStep(step: HeadStep): TextStyle {
  const spec = themeSpec();
  const size = HEAD_SIZE[spec.id][step];
  // De twee kleinste trappen zijn etiketten en blijven overal Archivo.
  const base: TextStyle =
    step <= 12
      ? isWeb
        ? { fontFamily: FONT.head, fontWeight: spec.heads === "archivo900" ? "900" : spec.heads === "archivo" ? "600" : "500" }
        : { fontFamily: FONT.head }
      : head();
  const lh =
    spec.heads === "serif" ? size * 0.96 : spec.heads === "archivo" ? size * 1.15 : size;
  return {
    ...base,
    fontSize: size,
    lineHeight: Math.round(lh),
    letterSpacing: spec.heads === "serif" ? 0 : spec.heads === "archivo" ? -size * 0.02 : -size * 0.01,
  };
}
