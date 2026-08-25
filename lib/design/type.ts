import { Platform, type TextStyle } from "react-native";

import { color, subscribeScheme } from "./theme";

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

/** Breekpunt waarboven de tweekolomsstructuur van het affiche aan gaat. */
export const WIDE_BREAKPOINT = 900;

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

export let creamOnDark = {
  DEFAULT: color("cream"),
  soft: color("creamSoft"),
  muted: color("creamMuted"),
  rule: color("cream", "onDark"),
};

/**
 * Breekpunt waarop de feed van twee kolommen (zijbalk + hoofdkolom)
 * naar één gestapelde kolom valt. Lager dan `WIDE_BREAKPOINT`, want
 * de zijbalk is smal genoeg om al vanaf 800px naast de inhoud te passen.
 */
export const FEED_BREAKPOINT = 800;

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
 * Het donkere verloop onder een foto waar tekst over staat.
 *
 * Geen schaduw — die staan niet in dit systeem — maar een sluier: een
 * verloop van niets naar bijna-zwart, zodat de naam van de uploader leesbaar
 * is zonder dat er een balk over het beeld ligt. In stappen van 6% in plaats
 * van in drie brokken; drie brokken zag je als drie banden.
 *
 * `height` is hoe hoog de sluier wordt; de onderste stap is de donkerste.
 */
export function scrimSteps(strength = 0.72, steps = 12): string[] {
  const out: string[] = [];
  for (let i = 1; i <= steps; i++) {
    // Kwadratisch: bovenaan bijna niets, onderaan vol. Lineair leest als een
    // grijze doos over de onderste helft van de foto.
    const t = (i / steps) ** 2;
    out.push(`rgba(11,10,12,${(t * strength).toFixed(3)})`);
  }
  return out;
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
      onDark: color("cream", "onDark"),
    };
    flame = color("flame");
    flameDeep = color("flameDeep");
    announce = color("announce");
    announceDeep = color("announceDeep");
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
    creamOnDark = {
      DEFAULT: color("cream"),
      soft: color("creamSoft"),
      muted: color("creamMuted"),
      rule: color("cream", "onDark"),
    };
  });
}
