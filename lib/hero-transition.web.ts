import type { ViewStyle } from "react-native";

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
 * `flushSync` wordt via `require` opgehaald en niet geïmporteerd: dit
 * project heeft geen `@types/react-dom`, dus een echte import geeft
 * TS7016. Zelfde patroon als `require("expo-linking")` elders in de code.
 * Als de call om welke reden dan ook ontbreekt, valt hij terug op een
 * gewone navigatie.
 *
 * Waarom `flushSync` überhaupt: `startViewTransition` maakt een momentopname van
 * de DOM, roept dan de callback aan en vergelijkt het resultaat. React
 * batcht state-updates standaard, dus zonder `flushSync` is de DOM nog
 * niet veranderd op het moment dat de browser de tweede opname maakt en
 * zie je geen overgang.
 *
 * Ondersteuning: Chrome/Edge 111+, Safari 18+. Firefox nog niet. De
 * `?.` en de capability-check zorgen dat het daar gewoon een directe
 * navigatie is in plaats van een fout.
 */

type DocumentWithVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> };
};

export const HERO_TRANSITION_SUPPORTED =
  typeof document !== "undefined" &&
  typeof (document as DocumentWithVT).startViewTransition === "function";

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
export function heroTag(id: string): ViewStyle {
  if (!HERO_TRANSITION_SUPPORTED) return {};
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  return { viewTransitionName: `hero-${safe}` } as unknown as ViewStyle;
}

/**
 * Voert de navigatie uit binnen een View Transition.
 *
 * Valt terug op een gewone navigatie als de browser het niet kent, of als
 * de overgang om welke reden dan ook gooit — een mislukte animatie mag
 * nooit een navigatie tegenhouden.
 */
export function withHeroTransition(navigate: () => void): void {
  const doc = document as DocumentWithVT;
  if (!HERO_TRANSITION_SUPPORTED || !doc.startViewTransition) {
    navigate();
    return;
  }

  let flush: ((cb: () => void) => void) | undefined;
  try {
    flush = (require("react-dom") as { flushSync?: (cb: () => void) => void })
      .flushSync;
  } catch {
    flush = undefined;
  }

  try {
    doc.startViewTransition(() => {
      // Zie de toelichting hierboven: zonder flushSync ziet de browser
      // geen verschil tussen de twee opnames en zie je geen overgang.
      if (flush) flush(navigate);
      else navigate();
    });
  } catch {
    navigate();
  }
}
