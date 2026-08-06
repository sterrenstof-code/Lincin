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
        {/* Kleurt de browserbalk mee met het paginavlak. */}
        <meta name="theme-color" content="#CDBEE3" />
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
            De display-serifs.
            Op iOS gebruiken we het ingebouwde Didot en laden we niets; op
            web bestaat dat font niet, dus halen we hier de twee snitten op.
            Bodoni Moda voor affiche-maten, Playfair Display voor leesmaten.
            `display=swap` zodat tekst meteen zichtbaar is in de fallback.
            Inter erbij draagt het feed-v3-systeem (lib/design/type.ts →
            INTER_FAMILY). Op iOS/Android valt dat terug op de ingebouwde
            grotesk, dus enkel web haalt de échte snitten op — 400 t/m 900,
            want de logo-plaat staat op 900 en de kickers op 700.
            --------------------------------------------------------------- */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap"
        />

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

/* ---- 2. De pagina: kruisvervagen met een stijging ---- */
@keyframes lincin-page-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes lincin-page-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lincin-page-in-back {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: none; }
}
@keyframes lincin-page-in-still {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* De oude pagina gaat sneller weg dan de nieuwe komt: zonder dat staan er
   een halve seconde lang twee volle paginabeelden over elkaar. */
::view-transition-old(root) {
  animation: lincin-page-out 160ms cubic-bezier(0.4, 0, 1, 1) both;
  object-fit: fill;
}
::view-transition-new(root) {
  animation: lincin-page-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
  object-fit: fill;
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
  ::view-transition-new(root) {
    animation-duration: 1ms !important;
  }
}
`,
          }}
        />

        {/* ScrollViewStyleReset verwijdert de default body-scroll-styling. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
