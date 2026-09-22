import { useNavigationState } from "@react-navigation/native";
import type { useRouter } from "expo-router";

import { useT, type Dict } from "@/lib/i18n";

type Router = ReturnType<typeof useRouter>;

/**
 * Go back if there's something in the navigation stack, otherwise replace
 * the current route with a fallback. Use this everywhere instead of
 * `router.back()` directly so deep-links and refreshes don't end up in a
 * stuck state with no back-history.
 */
export function safeBack(router: Router, fallback: string = "/"): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}

/**
 * Door genestelde navigators heen naar het scherm dat je écht aankijkt.
 *
 * De wortelstack kent maar één naam voor alle tabbladen samen — `(app)` —
 * dus zonder dit afdalen heet elke terugweg "app". De focus-index wijst
 * per laag het actieve kind aan; onderaan ligt de bladnaam, en dat is de
 * enige die iets zegt.
 */
function leafRouteName(route: any): string | null {
  let node = route;
  while (node?.state) {
    const i = node.state.index ?? 0;
    const next = node.state.routes?.[i];
    if (!next) break;
    node = next;
  }
  return typeof node?.name === "string" ? node.name : null;
}

/**
 * De bladnaam van het scherm één plek onder de bovenste.
 *
 * Alleen voor een stack. In een tabnavigator is `routes` de rij tabbladen
 * in hun vaste volgorde, geen geschiedenis: `routes[i - 1]` van Lincs is
 * dan Gesprekken, omdat die er in `_layout` voor staat — en zo zei de pijl
 * "← GESPREKKEN" terwijl je net uit Jij kwam. Een tabblad weet niet waar je
 * vandaan komt; wie er een terugweg wil, geeft hem zelf op.
 */
export function usePreviousRouteName(): string | null {
  return useNavigationState((state) => {
    if (!state || state.type === "tab") return null;
    const i = state.index ?? 0;
    if (i < 1) return null;
    return leafRouteName(state.routes[i - 1]);
  });
}

/**
 * Hoe het scherm heet waar je vandaan komt, in de taal van de lezer.
 *
 * Alleen de plekken die een eigen naam dragen staan hierin. Een
 * detailscherm terug naar een ánder detailscherm ("← BIJDRAGE") helpt
 * niemand: dan is de kortste eerlijke tekst gewoon "terug".
 */
function originLabel(name: string | null, t: Dict): string | null {
  switch (name) {
    case "feed":
      return t.tabFeed;
    case "chats":
      return t.tabChats;
    case "events":
      return t.tabEvents;
    case "profile":
      return t.tabYou;
    case "notifications":
      return t.notifications;
    case "friends":
      return t.myLincs;
    default:
      return null;
  }
}

export type BackTarget = { label: string; go: () => void };

/**
 * De terugweg als één ding: het etiket en de daad horen bij elkaar.
 *
 * Hier stonden ze los. De pijl links in de kop van een bijdrage zei
 * altijd "← FEED" en ging ook altijd naar de feed, ook als je net uit
 * Meldingen of uit je Lincs kwam; het kruisje ernaast gebruikte wél
 * `safeBack` en kwam dus ergens anders uit. Twee knoppen naast elkaar,
 * tien pixels uit elkaar, met een verschillende bestemming — en de enige
 * met een etiket was de enige die loog over waar je terechtkwam.
 *
 * Nu leest de pijl de stack: staat daar een plek met een naam, dan draagt
 * hij die naam en gaat hij erheen. Kom je binnen via een gedeelde link —
 * geen geschiedenis — dan blijft het de feed, want dat is waar deze app
 * begint.
 */
export function useBackTarget(router: Router, fallback: string = "/feed"): BackTarget {
  const t = useT();
  const previous = usePreviousRouteName();
  const named = originLabel(previous, t);

  // Eén voorwaarde voor allebei: is er iets om naar terug te keren, dan
  // gaat de pijl daarheen en draagt hij die naam. Anders is het de feed,
  // en zegt hij dat ook.
  return previous
    ? { label: named ?? t.back, go: () => safeBack(router, fallback) }
    : { label: t.tabFeed, go: () => router.navigate(fallback as any) };
}
