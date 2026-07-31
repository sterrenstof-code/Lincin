import { useIsFocused } from "@react-navigation/native";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

import { PAGE_TRANSITION_SUPPORTED } from "@/lib/page-transition";

/**
 * De binnenkomst van een pagina: kruisvervagen met een lichte stijging.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT NAAST DE VIEW TRANSITIONS BESTAAT
 * ---------------------------------------------------------------
 * Er zijn drie manieren waarop een pagina in beeld komt, en ze worden
 * door drie verschillende dingen geanimeerd:
 *
 *   web + View Transitions   de browser (`lib/page-transition.web.ts`)
 *   native, stack-push       de native stack (`animation: fade_from_bottom`)
 *   de rest                  déze component
 *
 * "De rest" is niet klein. Een **tabwissel** krijgt op native van de
 * Tabs-navigator geen enkele animatie — die knippert gewoon. En een
 * browser zonder View Transitions (Firefox, oudere Safari) krijgt van de
 * eerste regel niets. Zonder deze component zou de overgang dus precies
 * op die twee plekken stilzwijgend ontbreken.
 *
 * De maten komen overeen met de keyframes in `app/+html.tsx`: 320ms,
 * 12px stijging, dezelfde kromme. Eén beweging, ongeacht wie hem uitvoert.
 *
 * ---------------------------------------------------------------
 * WAAROM DE BESLISSING ÍN DE COMPONENT ZIT EN NIET ERBUITEN
 * ---------------------------------------------------------------
 * De webbuild is `output: "static"` (zie app.json): elke pagina wordt op
 * de server voorgerenderd en in de browser gehydrateerd. Op de server
 * bestaat `document` niet, dus `PAGE_TRANSITION_SUPPORTED` is daar altijd
 * `false` en in Chrome/Safari `true`.
 *
 * Zou die vlag bepalen of deze wikkel *bestaat*, dan rendert de server een
 * extra element dat de client niet verwacht — een hydratatieverschil. En
 * omdat de wikkel op `opacity: 0` zou beginnen, zou de statische HTML
 * onzichtbaar op het scherm staan tot de JS binnen is. Precies het soort
 * fout dat je pas in productie ziet.
 *
 * Daarom: de wikkel staat er altijd (structuur gelijk op server en
 * client), begint **zichtbaar** (`1`), en pas ná de eerste render — in een
 * layout-effect, dus vóór de verf — wordt bepaald of er iets te animeren
 * valt. Waar het platform het al doet, doet deze component niets: dubbel
 * animeren leest als hapering.
 */

const DURATION = 320;
const RISE = 12;
/** Dezelfde kromme als `::view-transition-new(root)` in `app/+html.tsx`. */
const CURVE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Vóór de verf op de client, gewoon ná de render op de server. React
 * waarschuwt terecht dat een layout-effect op de server niets doet; deze
 * wissel houdt het aantal en de volgorde van de hooks gelijk, wat het
 * enige is waar React om geeft.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Wie beweging heeft uitgezet, krijgt de pagina meteen. Op web leest
 * react-native-web hiervoor `prefers-reduced-motion`, op native de
 * systeeminstelling — in beide gevallen dezelfde vraag.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (alive) setReduced(!!value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (value: boolean) => setReduced(!!value)
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

export function PageTransition({ children }: { children: ReactNode }) {
  /**
   * Op focus en niet op mount. Een tabblad mount één keer en blijft
   * daarna gemount; zou dit op mount hangen, dan animeerde alleen het
   * állereerste bezoek en elke volgende tabwissel niet.
   */
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  /** Begint zichtbaar — zie de toelichting over de statische build. */
  const anim = useRef(new Animated.Value(1)).current;

  useIsomorphicLayoutEffect(() => {
    // Buiten beeld: klaarzetten op zichtbaar, zodat een scherm dat om een
    // andere reden getoond wordt nooit onzichtbaar blijft hangen.
    if (!focused) {
      anim.setValue(1);
      return;
    }
    // Doet iemand anders de overgang al, of is beweging uitgezet, dan
    // blijft de pagina gewoon staan waar hij staat.
    if (reduced || PAGE_TRANSITION_SUPPORTED) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    const run = Animated.timing(anim, {
      toValue: 1,
      duration: DURATION,
      easing: CURVE,
      // De native driver kan opacity en transform aan; op web bestaat hij
      // niet en valt react-native-web terug op de JS-driver.
      useNativeDriver: Platform.OS !== "web",
    });
    run.start();
    return () => run.stop();
  }, [focused, reduced, anim]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [RISE, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------
// Waar deze wikkel geldt
// ---------------------------------------------------------------

const render = ({ children }: { children: ReactNode }) => (
  <PageTransition>{children}</PageTransition>
);

/**
 * Voor een stack-navigator. Alleen op web: op native animeert de stack
 * zichzelf al (`fade_from_bottom`), en een tweede laag eroverheen zou
 * dubbel vervagen.
 *
 * Op web staat hij er altijd, ook in een browser mét View Transitions —
 * de component doet daar niets, en de structuur moet gelijk blijven aan
 * wat de statische build voorrendert. `Platform.OS` is wél stabiel over
 * server en client heen; de capability-check niet.
 */
export const stackScreenLayout = Platform.OS === "web" ? render : undefined;

/**
 * Voor de Tabs-navigator. Een tabwissel heeft op native géén enkele
 * animatie, dus hier geldt hij op elk platform.
 */
export const tabScreenLayout = render;
