import type { ScrollView } from "react-native";

/**
 * Wie er op dit moment gescrolld wordt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN LOSSE MODULE IS
 * ---------------------------------------------------------------
 * Tikken op het tabblad waar je al staat deed niets: `TabStrip` doet
 * `if (!active) router.push(...)`, en dus was de tweede tik op "Feed" de
 * enige knop in de app zonder antwoord. Overal elders is dat het gebaar
 * dat terugspringt naar boven — je bent veertig vondsten diep, je wil
 * naar het begin, en je tikt op de rubriek waar je in zit.
 *
 * De kop kan daar zelf niet bij. `PageScroll` staat ín de pagina en de
 * kop staat erin genest, maar `TabStrip` weet niets van de scroller van
 * het scherm dat toevallig openstaat — en een context eromheen zou élke
 * pagina moeten optuigen voor iets wat maar één knop nodig heeft.
 *
 * Vandaar deze module: één plek waar de scroller van het scherm dat je
 * aankijkt zichzelf achterlaat. Een navigator houdt schermen gemount, dus
 * het is nadrukkelijk de *gefocuste* scroller die zich meldt — zonder dat
 * zou de laatste die toevallig mountte winnen, en spring je omhoog op een
 * pagina die je niet ziet.
 */
let active: React.RefObject<ScrollView | null> | null = null;

/** Aangeroepen door `PageScroll` zodra dat scherm de focus krijgt. */
export function registerScroller(ref: React.RefObject<ScrollView | null>) {
  active = ref;
}

/**
 * Loslaten bij verlies van focus, maar alleen als jíj nog de actieve bent.
 * Bij een navigatie krijgt het nieuwe scherm de focus vóórdat het oude hem
 * kwijtraakt; zonder deze vergelijking wist het vertrekkende scherm de
 * registratie van zijn opvolger.
 */
export function unregisterScroller(ref: React.RefObject<ScrollView | null>) {
  if (active === ref) active = null;
}

/** Terug naar boven, met beweging. Doet niets als er niets geregistreerd is. */
export function scrollActiveToTop() {
  active?.current?.scrollTo({ y: 0, animated: true });
}
