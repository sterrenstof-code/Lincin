import { router } from "expo-router";
import { useWindowDimensions } from "react-native";

/**
 * Desktop (handoff 23 sep): vanaf 1024px breed een balk bovenaan met de
 * vier tabbladen (components/lincin/desktop/Shell.tsx) en daaronder de
 * pagina, hoogstens 1440 breed.
 *
 * Een bijdrage, een gesprek of een profiel zijn gewone schermen —
 * `/post/[id]`, `/chat/[id]`, `/user/[username]` — die op desktop hun
 * desktopvorm tekenen. De URL is waar je bent, en de terugknop van de
 * browser werkt.
 */

const DESKTOP_MIN = 1024;
/** De lijst links op Gesprekken. */
export const LIST_W = 280;
/** De commentkolom op een bijdrage. */
export const COMMENTS_W = 420;

function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN;
}

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return isDesktopWidth(width);
}

/** Een bijdrage: op een telefoon het scherm, op desktop dat scherm op volle breedte. */
export function openPost(id: string) {
  router.push(`/post/${id}` as never);
}

export function openProfile(username: string) {
  router.push(`/user/${username}` as never);
}

export function openThread(chatId: string) {
  router.push(`/chat/${chatId}` as never);
}

/**
 * Welk gesprek Gesprekken toont als er niets gekozen is: het laatste, maar
 * alleen als er niets ongelezen is. De lijst is nieuwste-eerst gesorteerd.
 *
 * Vroeger opende het juist het laatste ongelezen — en openen is lezen: je
 * kwam naar Gesprekken om te zien wat er nieuw was, en het was al weg voor
 * je het zag. Is er iets ongelezen, dan opent er niets en kies je zelf.
 */
export function pickThread(chatId: string | null, sorted: { id: string; unread_count?: number | null }[]): string | null {
  if (chatId) return chatId;
  if (sorted.some((c) => (c.unread_count ?? 0) > 0)) return null;
  return sorted[0]?.id ?? null;
}
