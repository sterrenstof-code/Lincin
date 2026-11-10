import { createContext, useContext, type ReactNode } from "react";
import { Platform, type TextStyle } from "react-native";

import { CATALOGUS, hueFor, useScheme, type CatalogusKleuren, type Hue, type Scheme } from "@/lib/design/theme";
import { FONT } from "@/lib/design/type";

/**
 * Catalogus (ontwerp 3e): de kleuren en de letter.
 *
 * De kleuren komen uit `CATALOGUS` in lib/design/theme.ts, als hex: deze
 * onderdelen tekenen vlakken in exact de waarden van tokens.json. De stand
 * volgt de app, tenzij een `CatalogusStand` hem vastzet (de testpagina's in
 * app/dev/catalogus kiezen hem met `?stand=`).
 */

const StandCtx = createContext<Scheme | null>(null);

export function CatalogusStand({ stand, children }: { stand: Scheme; children: ReactNode }) {
  return <StandCtx.Provider value={stand}>{children}</StandCtx.Provider>;
}

export function useStand(): Scheme {
  const vast = useContext(StandCtx);
  const app = useScheme();
  return vast ?? app;
}

/** De kleuren van de stand die nu geldt. */
export function useCat(): CatalogusKleuren {
  return CATALOGUS[useStand()];
}

/**
 * De kleur van een linc: zijn eigen kleur (`hueFor`, wat hij koos of wat uit
 * zijn id volgt), in de tinten van het ontwerp. Dat zijn precies de
 * gedempte vriendkleuren van de app in donker; zuur is het geelgroen van
 * het ontwerp. De zevende (#34C47A) heeft geen eigen kleur in de app.
 */
const HUE_KLEUR: Record<Hue, string> = {
  orange: "#C1724E",
  green: "#8A9273",
  blue: "#6E8A97",
  ochre: "#C9B77F",
  red: "#A9503F",
  acid: "#DDEE3C",
};

export function hueKleur(hue: Hue): string {
  return HUE_KLEUR[hue];
}

export function lincKleur(id: string | null | undefined): string {
  return HUE_KLEUR[hueFor(id)];
}

const isWeb = Platform.OS === "web";

/**
 * Na Archivo Latijn de systeemletters die de tekens buiten dat bereik
 * dragen, in de volgorde waarin de browser ze bij het ontwerp vond (№
 * Helvetica, ← → Lucida Grande, ✳ ✕ Zapf Dingbats, ⋯ PingFang, ↗ Hiragino).
 * Zonder deze keten valt Chrome voor een pijl soms terug op de volledige
 * Archivo die de andere thema's laden, en dan is het een andere pijl.
 */
const FAMILIE_WEB = "'Archivo Latijn', Helvetica, 'Lucida Grande', 'Zapf Dingbats', 'PingFang SC', 'Hiragino Sans', sans-serif";

/**
 * Archivo in een gewicht. Op web de familie `Archivo Latijn` (app/+html.tsx):
 * dezelfde bestanden, alleen voor het latijnse bereik, zodat pijlen, ✳ en №
 * net als in het ontwerp uit de systeemletter komen.
 */
export function letter(gewicht: 200 | 300 | 400 | 500 | 600 | 700 = 400): TextStyle {
  if (isWeb) return { fontFamily: FAMILIE_WEB, fontWeight: String(gewicht) as TextStyle["fontWeight"] };
  const familie = {
    200: FONT.sansExtraLight,
    300: FONT.sansLight,
    400: FONT.sans,
    500: FONT.sansMedium,
    600: FONT.sansSemi,
    700: FONT.sansBold,
  }[gewicht];
  return { fontFamily: familie };
}

/** Het kaartje: 9 px, 500, kapitalen, spatiëring .1em, regelhoogte 1.7. */
export const KAARTJE_REGEL = 9 * 1.7;
export const kaartjeTekst: TextStyle = {
  ...letter(500),
  fontSize: 9,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  lineHeight: KAARTJE_REGEL,
};

/** Een titel: 300, spatiëring −.04em. */
export function titel(maat: number, regel: number): TextStyle {
  return { ...letter(300), fontSize: maat, letterSpacing: -0.04 * maat, lineHeight: maat * regel };
}

/** Tekst zonder eigen regelhoogte: de `normal` van de browser. */
export function tekst(maat: number, gewicht: 200 | 300 | 400 | 500 | 600 | 700 = 400, regel?: number): TextStyle {
  return { ...letter(gewicht), fontSize: maat, ...(regel ? { lineHeight: maat * regel } : null) };
}

/** De tabbalk: 11 px, 500, kapitalen, .08em. */
export const tabTekst: TextStyle = {
  ...letter(500),
  fontSize: 11,
  letterSpacing: 0.88,
  textTransform: "uppercase",
};

/** Het kleinste raakvlak. */
export const RAAK = 44;
/** De naad tussen vakken. */
export const NAAD = 2;
/** De marge in een vak. */
export const MARGE = 12;
