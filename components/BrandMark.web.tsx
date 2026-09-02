import { createElement } from "react";

import { creamOnDark, INTER_FAMILY } from "@/lib/design/type";

/**
 * Het woordmerk in de balk, als rasterletter — WEB variant.
 *
 * ---------------------------------------------------------------
 * DE TECHNIEK
 * ---------------------------------------------------------------
 * Dezelfde als in `LogoMark.web.tsx`, en met opzet niet een tweede: een
 * stippenpatroon dat met `background-clip: text` bínnen de letters wordt
 * afgeknipt. De letter eronder is crème, de stippen erboven zijn de
 * balkkleur — dus wat je ziet zijn lichte punten in de vorm van het woord,
 * precies zoals op de plaat.
 *
 * Twee dingen die op balkformaat anders moeten dan op de plaat:
 *
 * **Het raster is fijner.** De plaat staat op 3px stippen bij een letter
 * van 64; dat is zo'n twintig punten per letterhoogte. Bij vijftien punten
 * zou 3px betekenen dat er vijf stippen in een stok passen en er geen
 * letter meer overblijft. Op 2px zijn het er zeven à acht — genoeg om het
 * raster te zien, genoeg om het woord te lezen.
 *
 * **Er is één laag, geen twee.** De plaat legt er nog een flame-raster
 * overheen voor de warme gloed. Op deze maat valt dat samen tot een vieze
 * rand; wat overblijft is ruis in plaats van kleur.
 *
 * ---------------------------------------------------------------
 * DE BEWEGING
 * ---------------------------------------------------------------
 * `animated` laat het raster langzaam over de letters schuiven — acht
 * seconden voor één cel, dus je ziet het niet bewegen maar je ziet het wél
 * leven. Alleen op de thuispagina: daar is het merk het onderwerp, overal
 * elders is de pagina dat, en een balk die op elk scherm beweegt is een
 * balk die om aandacht vraagt op het moment dat je iets anders wil lezen.
 *
 * De keyframes staan in `app/+html.tsx` bij de andere, en de regel voor
 * `prefers-reduced-motion` in `global.css` zet ze samen met de rest stil —
 * dat hoeft hier dus niet nog eens.
 *
 * De DOM-knopen gaan via `createElement` en niet via JSX: dit project heeft
 * geen `@types/react-dom`. Zelfde reden als in `LogoMark.web.tsx`.
 */
const WORD = "LINCIN";

const TYPE = {
  fontFamily: INTER_FAMILY,
  fontWeight: 900,
  fontSize: "15px",
  lineHeight: 1.1,
  letterSpacing: "0.09em",
} as const;

export function BrandMark({ animated = false }: { animated?: boolean }) {
  return createElement(
    "span",
    {
      style: {
        position: "relative",
        display: "inline-block",
        color: creamOnDark.DEFAULT,
        whiteSpace: "nowrap",
        userSelect: "none",
        ...TYPE,
      },
    },
    WORD,
    createElement(
      "span",
      {
        key: "dots",
        "aria-hidden": true,
        style: {
          position: "absolute",
          inset: 0,
          // De stippen dragen de kleur van de cel eronder, niet zwart: op
          // een vlak dat al bijna zwart is zou zwart niets doen behalve de
          // letter dichtsmeren.
          backgroundImage:
            "radial-gradient(circle at center, rgba(11,10,12,0.92) 45%, transparent 47%)",
          backgroundSize: "2px 2px",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextFillColor: "transparent",
          ...(animated ? { animation: "lincin-dots 8s linear infinite" } : null),
          ...TYPE,
        },
      },
      WORD
    )
  );
}
