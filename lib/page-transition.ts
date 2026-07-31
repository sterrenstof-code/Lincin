/**
 * Paginaovergangen — NATIVE.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN NO-OP IS — lees dit voor je hier iets bouwt
 * ---------------------------------------------------------------
 * Op web doet de browser de overgang zelf met de View Transitions API;
 * zie `page-transition.web.ts`. Op native bestaat die API niet, en daar
 * is hij ook niet nodig: de native stack animeert een push al, en die
 * animatie staat sinds de overgangsuitrol op `fade_from_bottom` — de
 * native evenknie van de fade-met-stijging die het web krijgt. Zie
 * `app/_layout.tsx`.
 *
 * Wat de stack níet animeert is een tabwissel. Dat gat vult
 * `components/PageTransition.tsx`, en dat is bewust een gewone
 * `Animated`-component en geen tweede implementatie hiervan.
 *
 * Deze module is dus een eerlijke no-op, geen stilzwijgend kapot ding:
 * elk scherm blijft navigeren, alleen zonder extra laag eromheen.
 */

/** De richting van een navigatie. Stuurt op web welke kant de pagina op komt. */
export type NavDirection = "forward" | "back" | "hero";

/** Ondersteunt dit platform de browser-overgang? Op native nooit. */
export const PAGE_TRANSITION_SUPPORTED = false;

/** Voer een navigatie uit binnen een overgang. Op native gewoon uitvoeren. */
export function withPageTransition(
  navigate: () => void,
  _direction: NavDirection = "forward"
): void {
  navigate();
}

/** Zet de app-brede overgangen aan. Op native niets te doen. */
export function installPageTransitions(): void {}
