import { createElement } from "react";
import { View } from "react-native";

import { feed, FEED_BORDER, INTER_FAMILY } from "@/lib/design/type";

/**
 * Het woordmerk als korrelplaat — WEB variant.
 *
 * Expo kiest dit bestand automatisch op web, precies zoals bij
 * `Embed.tsx` / `Embed.web.tsx`. Omdat react-native-web naar echte DOM
 * rendert, staan hier de technieken uit `feed-v3-merged.html` één op één:
 *
 *   1. radiale verlooponderlaag;
 *   2. `feTurbulence`-filmkorrel als inline-SVG data-URL, met
 *      `mix-blend-mode: overlay` zodat het de plaat vuil maakt in plaats van
 *      hem grijs te wassen;
 *   3. de halftoon ín de letters: twee gestapelde `background-clip: text`-
 *      lagen — zwarte stippen op `multiply`, flame-stippen op `screen`;
 *   4. de lijntekening op `mix-blend-mode: difference`.
 *
 * De DOM-knopen gaan via `createElement` en niet via JSX: dit project heeft
 * geen `@types/react-dom`, dus `<div>` in een .tsx zou een typefout geven.
 * Zelfde truc als `Embed.web.tsx`.
 *
 * Props zijn identiek aan `LogoMark.tsx` — de aanroeper weet niet op welk
 * platform hij draait.
 */
export type LogoMarkProps = {
  /** `plate` = de brede band onder de kop, `compact` = inline in een rij. */
  size?: "plate" | "compact";
};

const WORDMARK = "Lincin";

/** Filmkorrel als inline SVG. `#` moet %23 zijn binnen een data-URL. */
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E" +
  "%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E" +
  "%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E" +
  "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function LogoMark({ size = "plate" }: LogoMarkProps) {
  const compact = size === "compact";
  const height = compact ? 56 : 150;
  const fontSize = compact ? 26 : 64;

  /** De drie letterlagen delen exact dezelfde typografie. */
  const wordType = {
    fontFamily: INTER_FAMILY,
    fontWeight: 900,
    textTransform: "uppercase" as const,
    fontSize: `${fontSize}px`,
    lineHeight: 0.86,
    letterSpacing: "-.03em",
  };

  return (
    <View
      style={{
        height,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        overflow: "hidden",
      }}
    >
      {createElement(
        "div",
        {
          style: {
            position: "relative",
            height: "100%",
            display: "flex",
            alignItems: "center",
            background:
              "radial-gradient(120% 160% at 15% 0%, #24252a 0%, #17181B 55%, #0C0C0E 100%)",
          },
        },

        // 1 — korrellaag, bovenop alles behalve de tekst-stapel
        createElement("div", {
          key: "grain",
          "aria-hidden": true,
          style: {
            position: "absolute",
            inset: 0,
            zIndex: 3,
            pointerEvents: "none",
            mixBlendMode: "overlay",
            opacity: 0.5,
            backgroundImage: GRAIN_URL,
          },
        }),

        // 2 — het woordmerk met twee halftoonlagen erin geknipt
        createElement(
          "div",
          {
            key: "word",
            style: {
              position: "relative",
              marginLeft: compact ? 14 : 28,
              color: "#FAF8F5",
              transform: "scaleX(.82)",
              transformOrigin: "left top",
              whiteSpace: "nowrap",
              userSelect: "none",
              ...wordType,
            },
          },
          WORDMARK,
          // zwarte stippen, multiply — geeft de letters hun raster
          createElement(
            "div",
            {
              key: "tex",
              "aria-hidden": true,
              style: {
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(circle at center, #000 42%, transparent 44%)",
                backgroundSize: "3px 3px",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                mixBlendMode: "multiply",
                opacity: 0.55,
                ...wordType,
              },
            },
            WORDMARK
          ),
          // flame-stippen, screen — de warme gloed in het raster
          createElement(
            "div",
            {
              key: "tex2",
              "aria-hidden": true,
              style: {
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(circle at center, #E63329 40%, transparent 42%)",
                backgroundSize: "5px 5px",
                backgroundPosition: "1.5px 1.5px",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                mixBlendMode: "screen",
                opacity: 0.3,
                ...wordType,
              },
            },
            WORDMARK
          )
        ),

        // 3 — de lijntekening, rechtsonder
        createElement(
          "div",
          {
            key: "lineart",
            "aria-hidden": true,
            style: {
              position: "absolute",
              right: compact ? 12 : 36,
              bottom: compact ? -6 : -10,
              zIndex: 2,
              mixBlendMode: "difference",
              opacity: 0.9,
              pointerEvents: "none",
            },
          },
          createElement(
            "svg",
            {
              viewBox: "0 0 260 220",
              width: compact ? 64 : 150,
              height: compact ? 55 : 128,
              fill: "none",
              stroke: "#FAF8F5",
              strokeWidth: 1.6,
            },
            createElement("path", {
              key: "p1",
              d: "M20 200 C 60 160, 40 120, 90 100 C 130 84, 120 40, 160 20",
            }),
            createElement("path", {
              key: "p2",
              d: "M90 100 C 110 130, 150 130, 170 160 C 190 185, 220 175, 240 200",
            }),
            createElement("circle", { key: "c1", cx: 160, cy: 20, r: 5 }),
            createElement("circle", { key: "c2", cx: 90, cy: 100, r: 4 })
          )
        ),

        // 4 — het onderschrift
        compact
          ? null
          : createElement(
              "div",
              {
                key: "tag",
                style: {
                  position: "absolute",
                  left: 28,
                  bottom: 14,
                  zIndex: 4,
                  fontFamily: INTER_FAMILY,
                  fontSize: "11px",
                  letterSpacing: ".05em",
                  color: "rgba(250,248,245,.65)",
                },
              },
              "Link up."
            )
      )}
    </View>
  );
}
