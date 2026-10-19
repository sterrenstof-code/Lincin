/**
 * +html.tsx — HTML-wrapper voor de Expo web build.
 * Expo-router injecteert de app-content als {children}.
 *
 * Hier staan de dingen die app.config.ts niet kan uitdrukken:
 *   - iOS PWA meta tags (standalone modus, status bar, app-naam, touch icon)
 *   - De editorial display-serifs (zie lib/design/type.ts)
 *   - De manifest-link, die de Web Share Target draagt
 */
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

import { Asset } from "expo-asset";

import { propVarCss, themeVarCss } from "@/lib/design/theme";
import { FONT_FILES } from "@/lib/design/type";

type FontKey = keyof typeof FONT_FILES;

/**
 * Welke snit bij welke familie, welk gewicht en welke stand hoort. Op web
 * vraagt `sans(700)` om `'Archivo'` met gewicht 700 (lib/design/type.ts);
 * deze tabel zegt de browser welk bestand dat is.
 */
const FACES: [family: string, weight: number, style: "normal" | "italic", key: FontKey][] = [
  ["Archivo", 400, "normal", "Archivo-Regular"],
  ["Archivo", 500, "normal", "Archivo-Medium"],
  ["Archivo", 600, "normal", "Archivo-SemiBold"],
  ["Archivo", 700, "normal", "Archivo-Bold"],
  ["Archivo", 800, "normal", "Archivo-ExtraBold"],
  ["Archivo", 900, "normal", "Archivo-Black"],
  ["Instrument Serif", 400, "normal", "InstrumentSerif-Regular"],
  ["Instrument Serif", 400, "italic", "InstrumentSerif-Italic"],
  ["IBM Plex Mono", 400, "normal", "IBMPlexMono-Regular"],
  ["IBM Plex Mono", 500, "normal", "IBMPlexMono-Medium"],
  ["IBM Plex Mono", 600, "normal", "IBMPlexMono-SemiBold"],
];

/** De meestgebruikte: lopende tekst, vet, en de meta-letter. */
const PRELOAD_FONTS: FontKey[] = ["Archivo-Regular", "Archivo-Bold", "IBMPlexMono-Medium"];

/**
 * Het adres van een snit in de export: `/assets/…/<naam>.<hash>.ttf`. De
 * hash volgt de inhoud, dus de adressen liggen vast bij het bouwen en het
 * bestand mag eeuwig in de cache (vercel.json, `/assets/`).
 */
function fontUrl(key: FontKey): string {
  return Asset.fromModule(FONT_FILES[key]).uri;
}

function fontFaceCss(): string {
  return FACES.map(
    ([family, weight, style, key]) =>
      `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url('${fontUrl(key)}') format('truetype');}`
  ).join("\n");
}

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA — algemeen */}
        {/* Kleurt de browserbalk mee met het paginavlak. De waarde hieronder
            is de donkere stand; `applyWeb` in lib/design/theme.ts zet hem om
            zodra de lichte stand geldt, en het script hieronder doet dat al
            vóór het eerste beeld. */}
        <meta name="theme-color" content="#F6F3ED" />

        {/* ---------------------------------------------------------------
            De stand, vóór het eerste beeld.

            De klasse `dark` op <html> bepaalt welk palet geldt (zie
            `global.css`). Zou React die pas ná hydratie zetten, dan flitst
            er eerst een blad in de verkeerde stand — en dat is precies het
            beeld dat een donkere-stand-gebruiker níet wil zien.

            Dit script is met opzet dom en synchroon: lees de voorkeur, val
            terug op het besturingssysteem, zet de klasse. Alles wat er
            daarna mee gebeurt staat in lib/design/theme.ts.
            --------------------------------------------------------------- */}
        {/* Toetsenbordstand: Tab zet hem aan, een klik of tik weer uit.
            global.css toont daarmee ook in tekstvelden de rode focusring,
            die de velden inline uitzetten (voor wie klikt is de cursor
            genoeg).
            CSP: de SHA-256 van dit script staat vast in vercel.json
            (script-src). Verandert er ook maar één teken, herbereken hem:
            `npx expo export -p web && npm run csp:check`. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=document.documentElement;
addEventListener('keydown',function(e){if(e.key==='Tab')r.classList.add('kbd');},true);
addEventListener('pointerdown',function(){r.classList.remove('kbd');},true);})();`,
          }}
        />
        {/* CSP: ook van dit script staat de SHA-256 vast in vercel.json
            (script-src); bij elke wijziging herberekenen met
            `npm run csp:check` na een web-export. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var p = localStorage.getItem('lincin.theme');
  if (p !== 'light' && p !== 'dark') {
    p = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var t = localStorage.getItem('lincin-thema');
  // Kleur is vervallen (0081): een oud bewaard 'kleur' telt als geen keuze.
  if (t !== 'magazine' && t !== 'modern') t = 'modern';
  var r = document.documentElement;
  r.classList.toggle('dark', p === 'dark');
  r.dataset.theme = p;
  r.dataset.lincinTheme = t;
  var m = document.querySelector('meta[name="theme-color"]');
  var paper = {
    magazine: { light: '#F7F4EE', dark: '#14120E' },
    modern:   { light: '#F4F1EB', dark: '#0C0C0D' }
  };
  if (m) m.setAttribute('content', paper[t][p]);
}catch(e){}})();`,
          }}
        />
        <meta name="description" content="Privé chats, foto-events en feed voor je inner circle. End-to-end versleuteld." />

        {/* Manifest — expliciet, want hij draagt de share_target.
            `public/manifest.json` wordt letterlijk naar dist/ gekopieerd en
            overschrijft daarmee de door Expo gegenereerde variant. */}
        <link rel="manifest" href="/manifest.json" />

        {/* PWA — iOS Safari specifiek.
            Zonder apple-mobile-web-app-capable opent een tik op het
            homescreen-icoon alsnog in Safari i.p.v. fullscreen standalone. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lincin" />

        {/* Touch icon — iOS gebruikt dit voor het homescreen-icoon.
            180×180 is de standaard voor moderne iPhones. */}
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* ---------------------------------------------------------------
            De drie letters van v2 (zie lib/design/type.ts).

            Van onze eigen server, uit dezelfde bestanden als native. Ze
            kwamen bij Google vandaan, maar dat stylesheet hield de eerste
            weergave tegen tot er een tweede en een derde domein bereikt
            was. Nu tekent de pagina meteen in de systeemletter en wisselt
            hij zodra een snit binnen is (`font-display: swap`). De drie
            snitten die het vaakst staan worden al vooraf gehaald.
            --------------------------------------------------------------- */}
        {PRELOAD_FONTS.map((key) => (
          <link key={key} rel="preload" as="font" type="font/ttf" href={fontUrl(key)} crossOrigin="anonymous" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss() }} />

        {/* ---------------------------------------------------------------
            De paginaovergangen (View Transitions API).

            Twee dingen bewegen hier, en ze zijn met opzet niet hetzelfde:

            1. DE PAGINA — de `root`-opname. Elke navigatie loopt via
               `lib/page-transition.web.ts` door een View Transition, dus
               de browser heeft van élke wissel een oude en een nieuwe
               opname. Die kruisvervagen, en de nieuwe komt 12px omhoog.
               Bij een terugnavigatie komt hij van boven — dezelfde
               beweging omgekeerd, zodat "terug" ook terug voelt. De
               richting staat als `data-nav` op <html>.

            2. HET GEDEELDE ELEMENT — elk genoemd paar (`hero-…`, gezet
               door `lib/hero-transition.web.ts`). Dat morpht trager,
               520ms, want een foto die uitgroeit tot paginabreed legt een
               veel grotere afstand af dan een kruisvervaging.

            Volgorde is hier functioneel: de `*`-regels staan boven en de
            `root`-regels eronder. Ze zijn even specifiek, dus wat later
            staat wint — zo pakt de morph alles behalve de pagina zelf.

            Bij een hero-overgang staat de pagina bewust stil (alleen
            vervagen, geen stijging): één beweging tegelijk leest, twee
            tegelijk niet.

            `prefers-reduced-motion`: wie beweging heeft uitgezet krijgt
            een directe wissel. Precies het soort beweging waar die
            voorkeur over gaat.
            --------------------------------------------------------------- */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
/* ---- 0. Het vlak achter de app ----
   De app vult het venster, maar bij overscroll (en op een scherm hoger dan
   de inhoud) kijk je erlangs naar <body>. Zonder deze regel is dat wit, en
   dan zit er in de donkere stand een witte rand om een lavendel blad. */
html, body {
  background-color: rgb(var(--c-page));
}

/* ---- 1. Het gedeelde element: de morph ---- */
::view-transition-group(*) {
  animation-duration: 520ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 520ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  /* Het beeld vult zijn vlak in beide standen, zodat het tijdens de morph
     niet uitrekt maar bijsnijdt — hetzelfde gedrag als contentFit="cover". */
  object-fit: cover;
}

/* ---- 1b. De kop: krimpt mee in plaats van te verspringen ----
   De grote kop van de thuispagina en de balk van elke andere pagina dragen
   dezelfde naam (zie lib/hero-transition.web.ts). De browser morpht dus het
   ene kader naar het andere. Korter dan de 520ms van een beeld: de kop legt
   een kleinere afstand af, en hij mag niet nog bewegen wanneer de pagina
   eronder al staat.

   object-fit: cover met object-position: top left laat de kop bijsnijden
   vanaf de linkerbovenhoek in plaats van uit te rekken — het woordmerk staat
   daar, en dat is precies wat je in beeld wil houden terwijl hij krimpt. */
::view-transition-group(lincin-chrome) {
  animation-duration: 380ms;
}
::view-transition-old(lincin-chrome),
::view-transition-new(lincin-chrome) {
  animation-duration: 380ms;
  object-fit: cover;
  object-position: top left;
}

/* ---- 1c. De kolom naast het beeld: schuift naar binnen ----
   De gesprekskolom van een vondst bestaat alleen op de detailpagina. Zonder
   eigen beweging komt hij er plots te staan, en dan lijkt de foto niet te
   groeien maar te verspringen. Hij schuift daarom van rechts naar binnen,
   ná het beeld: eerst groeit de plaat, dan komt de omkadering ernaast.

   Alleen de nieuwe stand: er is geen oude om vandaan te komen. */
::view-transition-group(lincin-aside) {
  animation-duration: 520ms;
}
@keyframes lincin-aside-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: none; }
}
::view-transition-new(lincin-aside) {
  animation: lincin-aside-in 420ms cubic-bezier(0.22, 1, 0.36, 1) 100ms both;
}
::view-transition-old(lincin-aside) {
  animation: lincin-page-out 140ms cubic-bezier(0.4, 0, 1, 1) both;
}

/* ---- Het raster van het woordmerk ----
   Eén cel per acht seconden. Zo langzaam is met opzet: je ziet het niet
   bewegen, je ziet het leven. Alleen op de thuispagina — zie
   components/BrandMark.web.tsx. De reduced-motion-regel in global.css zet
   hem samen met de rest stil. */
@keyframes lincin-dots {
  from { background-position: 0 0; }
  to   { background-position: 2px 2px; }
}

/* ---- 2. De pagina: kruisvervagen met een stijging ---- */
@keyframes lincin-page-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes lincin-page-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lincin-page-in-back {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lincin-page-in-still {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* De oude pagina gaat sneller weg dan de nieuwe komt: zonder dat staan er
   een halve seconde lang twee volle paginabeelden over elkaar. Korter en
   met een kleinere stijging dan eerst (320 ms, 12 px): op een telefoon
   voelde het hele scherm als een sprong. */
::view-transition-old(root) {
  animation: lincin-page-out 120ms cubic-bezier(0.4, 0, 1, 1) both;
  object-fit: fill;
}
::view-transition-new(root) {
  animation: lincin-page-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
  object-fit: fill;
}
/* Achter de twee opnames: het papier, niet zwart. Tussen het wegvallen van
   de oude en het opkomen van de nieuwe flitste anders de achtergrond door. */
::view-transition {
  background-color: var(--p-paper, #F7F4EE);
}
/* De tabbalk staat stil (lib/hero-transition.web.ts → tabsTag). */
::view-transition-group(lincin-tabs) {
  animation-duration: 0s;
}
::view-transition-old(lincin-tabs) {
  animation: none;
  opacity: 0;
}
::view-transition-new(lincin-tabs) {
  animation: none;
}
:root[data-nav="back"]::view-transition-new(root) {
  animation-name: lincin-page-in-back;
}
:root[data-nav="hero"]::view-transition-new(root) {
  animation-name: lincin-page-in-still;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*),
  ::view-transition-old(root),
  ::view-transition-new(root),
  ::view-transition-new(lincin-aside) {
    animation-duration: 1ms !important;
  }
}
`,
          }}
        />

        {/* ---------------------------------------------------------------
            De kleurvariabelen voor kleur-*props*.

            `global.css` levert `--c-ink` (het triplet) en daar leest élke
            Tailwind-klasse uit. Een kleur die als prop in een style-object
            staat kan daar niet direct bij: react-native-web haalt zulke
            waarden door `normalizeColor`, en dat laat alleen een waarde
            ongemoeid die letterlijk met `var(` begint. `rgb(var(--c-ink)
            / 1)` sneuvelt daar zonder één waarschuwing — de stijl valt
            gewoon weg, en dan staat er een venster zonder vulling.

            Deze laag lost dat op: `--p-ink` ís die uitdrukking, en een
            prop leest `var(--p-ink)`. Ze verwijzen naar `--c-*`, dus ze
            schuiven nog steeds mee met de stand en hoeven niet per stand
            herhaald te worden.

            Zie `propVarName` in lib/design/theme.ts voor het volledige
            verhaal. Web-only: native heeft geen variabelen nodig.
            --------------------------------------------------------------- */}
        <style dangerouslySetInnerHTML={{ __html: propVarCss() }} />

        {/* De twee thema's (magazine en modern, sinds 0081), elk in een
            lichte en een donkere stand, gekoppeld aan `data-lincin-theme`
            en `.dark` op <html>. Uit dezelfde bron als native
            (lib/design/theme.ts), zodat de twee niet uit elkaar kunnen
            lopen. De selectors dragen zelf `html` mee, zodat ze op
            specificiteit winnen van `:root` en `.dark:root` in global.css
            en de volgorde in het document niets meer bepaalt. */}
        <style dangerouslySetInnerHTML={{ __html: themeVarCss() }} />

        {/* ScrollViewStyleReset verwijdert de default body-scroll-styling. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
