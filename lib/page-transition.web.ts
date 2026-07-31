import { router } from "expo-router";

/**
 * Paginaovergangen — WEB.
 *
 * Elke navigatie loopt hier doorheen en wordt uitgevoerd binnen een
 * **View Transition**: de browser maakt een opname van de oude pagina,
 * laat ons de DOM wisselen, maakt een opname van de nieuwe, en animeert
 * daartussen. De keyframes staan in `app/+html.tsx` — hier zit alleen
 * het aan- en uitzetten.
 *
 * ---------------------------------------------------------------
 * WAAROM DE ROUTER GEPATCHT WORDT — lees dit voor je het weghaalt
 * ---------------------------------------------------------------
 * Een View Transition moet de navigatie *omsluiten*. De nette manier is
 * elke aanroep omwikkelen: `withPageTransition(() => router.push(…))`.
 * Dat zijn in deze app 106 aanroepen in 42 bestanden, en elke nieuwe
 * `router.push` die iemand later typt valt er stilzwijgend buiten — de
 * overgang zou dan op sommige plekken werken en op andere niet, zonder
 * dat iets dat meldt.
 *
 * Daarom wordt het één keer bij de wortel gedaan. `useRouter()` uit
 * expo-router geeft géén nieuw object terug maar exact deze singleton
 * (zie `expo-router/build/hooks.js` → `imperative-api.router`), dus één
 * patch dekt élke aanroep in de app, ook die van morgen.
 *
 * De prijs is dat we in het binnenwerk van een dependency grijpen. Dat
 * is afgedekt: we patchen alleen methodes die er écht zijn, we doen het
 * hoogstens één keer, en als er iets misgaat valt alles terug op een
 * gewone navigatie. Verandert expo-router de vorm van dat object, dan
 * verdwijnt de animatie — de navigatie zelf niet.
 *
 * `<Link>` uit expo-router loopt *niet* langs de singleton. Die wordt in
 * deze app nergens gebruikt; komt hij terug, dan heeft hij zijn eigen
 * omwikkeling nodig.
 *
 * Ondersteuning: Chrome/Edge 111+, Safari 18+. Firefox nog niet. Daar
 * neemt `components/PageTransition.tsx` het over met een gewone
 * `Animated`-fade, zodat het ook daar geen harde wissel is.
 */

type DocumentWithVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

/** De richting van een navigatie. Bepaalt welke kant de pagina op komt. */
export type NavDirection = "forward" | "back" | "hero";

export const PAGE_TRANSITION_SUPPORTED =
  typeof document !== "undefined" &&
  typeof (document as DocumentWithVT).startViewTransition === "function";

/**
 * Loopt er al een overgang? Dan navigeert een tweede aanroep gewoon
 * direct. Twee redenen: een View Transition in een View Transition gooit,
 * en een gedeelde-element-overgang (`hero-transition.web.ts`) roept
 * onderwater `router.push` aan — die is ná de patch hieronder zelf ook
 * omwikkeld, en zou zichzelf dus nesten.
 */
let active = false;

/**
 * `flushSync` via `require` en niet via import: dit project heeft geen
 * `@types/react-dom`, dus een echte import geeft TS7016. Zelfde patroon
 * als elders in de code.
 */
function getFlushSync(): ((cb: () => void) => void) | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- zie hierboven
    return (require("react-dom") as { flushSync?: (cb: () => void) => void })
      .flushSync;
  } catch {
    return undefined;
  }
}

/**
 * Wacht tot de router zijn werk gecommit heeft.
 *
 * Waarom dit nodig is: expo-router voert een `push` niet meteen uit. Hij
 * zet de actie in een wachtrij (`routingQueue`), een `useSyncExternalStore`
 * wekt React, en pas in een effect gaat de actie naar de navigator. Zonder
 * te wachten maakt de browser zijn tweede opname van een DOM die nog niet
 * veranderd is, en zie je geen overgang.
 *
 * `flushSync` duwt het grootste deel van die keten synchroon door, maar de
 * dispatch die daaruit volgt landt niet gegarandeerd in dezelfde flush.
 * Vandaar twee macrotaken erachteraan — genoeg voor de commit, en met
 * `setTimeout` in plaats van `requestAnimationFrame`, want tijdens de
 * update-callback staat het renderen stil en zou een rAF nooit vuren.
 *
 * De browser breekt een overgang zelf af als de callback te lang duurt,
 * dus dit kan de app niet laten hangen.
 */
function settled(): Promise<void> {
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return tick().then(tick);
}

/**
 * Voert de navigatie uit binnen een View Transition.
 *
 * Valt terug op een gewone navigatie als de browser het niet kent of als
 * de overgang gooit — een mislukte animatie mag nooit een navigatie
 * tegenhouden.
 */
export function withPageTransition(
  navigate: () => void,
  direction: NavDirection = "forward"
): void {
  const doc = document as DocumentWithVT;
  if (!PAGE_TRANSITION_SUPPORTED || !doc.startViewTransition || active) {
    navigate();
    return;
  }

  // De richting staat op <html>; de keyframes in `+html.tsx` lezen hem.
  const root = doc.documentElement;
  const previous = root.dataset.nav;
  root.dataset.nav = direction;

  const flush = getFlushSync();
  active = true;

  try {
    const transition = doc.startViewTransition(async () => {
      if (flush) flush(navigate);
      else navigate();
      await settled();
    });
    transition.finished
      .catch(() => {})
      .finally(() => {
        active = false;
        if (previous === undefined) delete root.dataset.nav;
        else root.dataset.nav = previous;
      });
  } catch {
    active = false;
    if (previous === undefined) delete root.dataset.nav;
    else root.dataset.nav = previous;
    navigate();
  }
}

/**
 * Welke methode van de router welke kant op gaat. Alleen methodes die
 * `void` teruggeven staan hier: de update-callback van een View Transition
 * draait pas een frame later, dus een returnwaarde zouden we toch niet
 * kunnen doorgeven. `canGoBack`, `canDismiss`, `setParams` en `prefetch`
 * blijven daarom met opzet ongemoeid.
 */
const PATCHED: Record<string, NavDirection> = {
  push: "forward",
  navigate: "forward",
  replace: "forward",
  back: "back",
  dismiss: "back",
  dismissTo: "back",
  dismissAll: "back",
};

let installed = false;

/**
 * Zet de app-brede overgangen aan. Idempotent — een tweede aanroep (fast
 * refresh, een dubbel gemounte root) doet niets.
 */
export function installPageTransitions(): void {
  if (installed || !PAGE_TRANSITION_SUPPORTED) return;
  installed = true;

  const target = router as unknown as Record<string, unknown>;

  for (const [name, direction] of Object.entries(PATCHED)) {
    const original = target[name];
    // Bestaat de methode niet (meer), dan slaan we hem over in plaats van
    // te gooien. Een gewijzigde dependency mag hooguit de animatie kosten.
    if (typeof original !== "function") continue;

    const fn = original as (...args: unknown[]) => unknown;
    target[name] = (...args: unknown[]) => {
      withPageTransition(() => {
        fn.apply(router, args);
      }, direction);
    };
  }
}
