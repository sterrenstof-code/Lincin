import { router } from "expo-router";
import { useWindowDimensions } from "react-native";

/**
 * Desktop (Lincin Desktop.dc.html, model 3c "Prikbord + lade"): vanaf
 * 1024px breed een rail van 196 met de navigatie en de hoofdkolom; in de
 * feed staat rechts de gesprekkenlijst van 300.
 *
 * Een bijdrage en een gesprek nemen het hele venster (3d/3e): de rail
 * klapt in tot 64 en de lijst rechts verdwijnt. Dat zijn gewoon schermen
 * — `/post/[id]`, `/chat/[id]`, `/user/[username]` — die op desktop hun
 * desktopvorm tekenen. Er is geen paneel meer dat onthoudt wat er open
 * staat: de URL is waar je bent, en de terugknop van de browser werkt.
 */

const DESKTOP_MIN = 1024;
/** De rail in rust. */
export const RAIL_W = 196;
/** De rail op volle breedte (bijdrage, gesprek). */
export const RAIL_NARROW = 64;
/** De gesprekkenlijst rechts van de feed: minmax(240px, 300px). */
export const CHATS_W = 300;
export const CHATS_MIN = 240;
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
 * Welk gesprek Gesprekken toont als er niets gekozen is: het laatste
 * ongelezen, anders het laatste. De lijst is nieuwste-eerst gesorteerd.
 */
export function pickThread(chatId: string | null, sorted: { id: string; unread_count?: number | null }[]): string | null {
  return chatId ?? sorted.find((c) => (c.unread_count ?? 0) > 0)?.id ?? sorted[0]?.id ?? null;
}
