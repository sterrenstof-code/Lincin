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

        {/* ScrollViewStyleReset verwijdert de default body-scroll-styling. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
