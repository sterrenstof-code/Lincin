import type { ViewStyle } from "react-native";

import { withPageTransition } from "@/lib/page-transition";

/**
 * Gedeelde-element-overgang tussen een vondst in de feed en zijn detailpagina:
 * het beeld van de tegel groeit uit tot de hero van de postpagina.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ZO GEBOUWD IS — lees dit voor je het vervangt
 * ---------------------------------------------------------------
 * De voor de hand liggende oplossing is `sharedTransitionTag` uit
 * react-native-reanimated. Die bestaat hier niet: dit project draait
 * **Reanimated 4.1.7**, en in versie 4 is de gedeelde-element-API
 * verwijderd (hij komt later terug in een nieuwe vorm). Een andere
 * bibliotheek installeren kan niet vanuit een cloud-sessie — de
 * device-bridge heeft geen netwerk.
 *
 * Bovendien: Reanimated's gedeelde overgangen werkten sowieso alleen op
 * native, en het doel hier is de **webversie** (lincin.vercel.app).
 *
 * Dus: op web gebruiken we de **View Transitions API** van de browser.
 * Twee elementen met dezelfde `view-transition-name` worden door de
 * browser zelf naar elkaar toe gemorphd — precies het framer-motion-
 * achtige effect, zonder dependency. Zie `hero-transition.web.ts`.
 *
 * Deze (native) variant is een bewuste no-op: geen tag, en `navigate`
 * doet gewoon de push. De pagina komt binnen met de stack-animatie uit
 * `app/_layout.tsx` (`fade_from_bottom`). Dat is eerlijk gedegradeerd
 * gedrag, geen stilzwijgend kapot ding.
 */

/**
 * De stijl die het gedeelde element markeert. Op native leeg.
 *
 * @param id  Unieke sleutel van de vondst — tegel en hero moeten dezelfde
 *            waarde krijgen, anders weet de browser niet wat bij wat hoort.
 */
export function heroTag(id: string): ViewStyle {
  void id;
  return {};
}

/** Zie de webvariant. Op native heeft de kop geen eigen morph. */
export const CHROME_TRANSITION_NAME = "lincin-chrome";

/**
 * Markeert de paginakop als gedeeld element. Op native leeg, om dezelfde
 * reden als `heroTag`: er is geen View Transitions API.
 */
export function chromeTag(enabled = true): ViewStyle {
  void enabled;
  return {};
}

/**
 * Voer een navigatie uit binnen een overgang. Op native gewoon uitvoeren
 * — `withPageTransition` is daar zelf ook een no-op.
 */
export function withHeroTransition(navigate: () => void): void {
  withPageTransition(navigate, "hero");
}

/** Ondersteunt dit platform de morph? Handig voor uitleg in de UI. */
export const HERO_TRANSITION_SUPPORTED = false;
