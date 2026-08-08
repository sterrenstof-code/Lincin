import { useIsFocused } from "@react-navigation/native";
import type { ViewStyle } from "react-native";

import { PAGE_TRANSITION_SUPPORTED, withPageTransition } from "@/lib/page-transition";

/**
 * Gedeelde-element-overgang — WEB.
 *
 * Zie `hero-transition.ts` voor waarom dit niet met Reanimated gaat
 * (v4 heeft `sharedTransitionTag` verwijderd, en die werkte toch alleen
 * op native). Hier doet de browser het werk via de **View Transitions
 * API**: geef twee elementen dezelfde `view-transition-name`, wissel de
 * DOM binnen `document.startViewTransition()`, en de browser morpht het
 * ene naar het andere — positie, formaat en beeld tegelijk.
 *
 * Het uitvoeren van de overgang zelf staat sinds de overgangsuitrol in
 * `page-transition.web.ts`, want élke navigatie loopt daar nu doorheen.
 * Dit bestand houdt alleen nog wat er *eigen* aan de hero is over: het
 * markeren van het gedeelde element, en het meegeven dat deze navigatie
 * een morph is. Dat laatste is niet cosmetisch — bij een hero-overgang
 * blijft de pagina eromheen bewust stil (alleen kruisvervagen, geen
 * stijging), anders schuift het blad terwijl de foto morpht.
 *
 * Ondersteuning: Chrome/Edge 111+, Safari 18+. Firefox nog niet; daar is
 * het een gewone navigatie met de fade uit `components/PageTransition.tsx`.
 */

export const HERO_TRANSITION_SUPPORTED = PAGE_TRANSITION_SUPPORTED;

/**
 * Markeert het gedeelde element.
 *
 * `viewTransitionName` staat niet in het type van ViewStyle — het is een
 * CSS-eigenschap die react-native-web ongemoeid doorgeeft aan de DOM.
 * Vandaar de cast; dit is precies het soort plek waar die verantwoord is.
 *
 * De naam moet een geldige CSS-identifier zijn: geen streepjes aan het
 * begin, geen cijfer als eerste teken, en UUID's met koppeltekens zijn
 * prima zolang er een letter voor staat. Vandaar het `hero-`-voorvoegsel
 * en het schoonvegen van al het overige.
 */
export function heroTag(id: string, enabled = true): ViewStyle {
  if (!HERO_TRANSITION_SUPPORTED || !enabled) return {};
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  return { viewTransitionName: `hero-${safe}` } as unknown as ViewStyle;
}

/**
 * Hetzelfde, maar alleen op het scherm dat je aankijkt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT GEEN LUXE IS — dit was de reden dat er niets bewoog
 * ---------------------------------------------------------------
 * Een stack-navigator laat het vorige scherm op web gewoon in de DOM
 * staan: `react-native-screens` zet alleen een scherm met activiteits-
 * stand 0 op `display: none`, en het scherm ónder de bovenste staat op
 * 1. Tijdens een navigatie van de feed naar een vondst staan de tegel
 * (in de feed) en de hero (op de vondstpagina) dus tegelijk in beeld.
 *
 * Twee elementen met dezelfde `view-transition-name` is voor de browser
 * geen twijfelgeval maar een fout: hij slaat de **hele** overgang over —
 * niet alleen de morph, ook de kruisvervaging van de pagina zelf. Het
 * gevolg is precies wat je zag: een harde wissel met een haperend beeld.
 *
 * `chromeTag` had die bescherming al; het beeld niet. Vandaar deze hook,
 * zodat een aanroeper er niet meer zelf aan hoeft te denken.
 */
export function useHeroTag(id: string): ViewStyle {
  return heroTag(id, useIsFocused());
}

/**
 * De naam van het gedeelde element van de **paginakop**.
 *
 * De kop is het tweede ding dat over een navigatie heen blijft bestaan: op
 * de thuispagina staat hij groot, overal elders als balk. Krijgen beide
 * standen dezelfde naam, dan morpht de browser de ene naar de andere in
 * plaats van de ene te laten verdwijnen en de andere te laten verschijnen.
 * De keyframes staan in `app/+html.tsx`.
 */
export const CHROME_TRANSITION_NAME = "lincin-chrome";

/**
 * Markeert de kop als gedeeld element.
 *
 * `enabled` is geen luxe: een navigator houdt schermen gemount, en twéé
 * elementen met dezelfde naam tegelijk in beeld laat de browser de hele
 * overgang overslaan. Alleen het scherm dat de focus heeft draagt hem.
 */
export function chromeTag(enabled = true): ViewStyle {
  if (!HERO_TRANSITION_SUPPORTED || !enabled) return {};
  return { viewTransitionName: CHROME_TRANSITION_NAME } as unknown as ViewStyle;
}

/**
 * Voert de navigatie uit als gedeelde-element-overgang.
 *
 * De `"hero"`-richting is het enige verschil met een gewone navigatie: de
 * pagina eromheen kruisvervaagt dan alleen, zodat de morph van het beeld
 * het enige is dat beweegt.
 *
 * De navigatie zelf loopt ook zónder deze wikkel goed af — `router.push`
 * is app-breed al omwikkeld — maar dan zonder de hero-richting. Blijf hem
 * dus gebruiken op de plekken waar tegel en hero hetzelfde `heroTag`
 * dragen.
 */
export function withHeroTransition(navigate: () => void): void {
  withPageTransition(navigate, "hero");
}
