import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import { useWindowDimensions } from "react-native";

/**
 * Desktop (Lincin Desktop.dc.html): vanaf 1100px breed drie kolommen —
 * een rail van 220 met de navigatie, de hoofdkolom, en een paneel van 400
 * rechts waarin een bladzijde, een profiel of een gesprek opent zónder
 * dat je van scherm wisselt. Hieronder de schakelaar en het paneel.
 *
 * Het paneel is een klein extern winkeltje: de feeds, lijsten en kaarten
 * roepen `openPost()` enz. aan; op een telefoon is dat gewoon `router.push`,
 * op desktop zet het het paneel. Zo hoeft geen enkel scherm te weten waar
 * het draait.
 */

export const DESKTOP_MIN = 1100;
export const RAIL_W = 220;
export const PANEL_W = 400;

export function isDesktopWidth(width: number): boolean {
  return width >= DESKTOP_MIN;
}

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return isDesktopWidth(width);
}

let desktopNow = false;
/** `DesktopShell` meldt hier of hij staat; de helpers hieronder lezen het. */
export function setDesktopNow(v: boolean) {
  desktopNow = v;
}

export type Panel =
  | { kind: "thread"; chatId: string | null }
  | { kind: "post"; id: string }
  | { kind: "profile"; username: string };

let panel: Panel = { kind: "thread", chatId: null };
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function getPanel(): Panel {
  return panel;
}

export function setPanel(next: Panel) {
  panel = next;
  emit();
}

export function usePanel(): Panel {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getPanel,
    getPanel,
  );
}

/** Terug naar het gesprek — het paneel in ruststand. */
export function closePanel() {
  setPanel({ kind: "thread", chatId: panel.kind === "thread" ? panel.chatId : lastChatId });
}

let lastChatId: string | null = null;

/** Een bladzijde: op desktop in het paneel, anders het scherm. */
export function openPost(id: string) {
  if (desktopNow) setPanel({ kind: "post", id });
  else router.push(`/post/${id}` as never);
}

export function openProfile(username: string) {
  if (desktopNow) setPanel({ kind: "profile", username });
  else router.push(`/user/${username}` as never);
}

/**
 * Welk gesprek het paneel in rust toont: de gekozen, anders het laatste
 * ongelezen, anders het laatste. De lijst is nieuwste-eerst gesorteerd.
 * Paneel én gesprekkenlijst rekenen hiermee, zodat de rij die de lijst
 * markeert ook echt de rij is die rechts openstaat.
 */
export function pickThread(chatId: string | null, sorted: { id: string; unread_count?: number | null }[]): string | null {
  return chatId ?? sorted.find((c) => (c.unread_count ?? 0) > 0)?.id ?? sorted[0]?.id ?? null;
}

export function openThread(chatId: string) {
  lastChatId = chatId;
  if (desktopNow) setPanel({ kind: "thread", chatId });
  else router.push(`/chat/${chatId}` as never);
}
