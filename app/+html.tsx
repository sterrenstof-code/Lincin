/**
 * +html.tsx — HTML-wrapper voor de Expo web build.
 * Expo-router injecteert de app-content als {children}.
 *
 * Hier voegen we iOS PWA meta tags toe die app.json niet kan bevatten,
 * zodat de app zich correct gedraagt als "Add to Home Screen" PWA op iPhone:
 *   - Standalone modus (geen browser-chrome)
 *   - Zwarte status bar (past bij shell-black design)
 *   - App-naam op de homescreen-icoon
 *   - Apple Touch Icon (voor het homescreen-icoon zelf)
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
        <meta name="theme-color" content="#0A0A0B" />
        <meta name="description" content="Privé chats, foto-events en feed voor je inner circle. End-to-end versleuteld." />

        {/* PWA — iOS Safari specifiek.
            Zonder apple-mobile-web-app-capable opent een tik op het
            homescreen-icoon alsnog in Safari i.p.v. fullscreen standalone. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lincin" />

        {/* Touch icon — iOS gebruikt dit voor het homescreen-icoon.
            180×180 is de standaard voor moderne iPhones. */}
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />

        {/* Expo-router injecteert hier automatisch de manifest-link
            op basis van app.json web.* settings. ScrollViewStyleReset
            verwijdert de default body-scroll-styling. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
