import type { PostRef } from "@/lib/api/messages";

/**
 * Een bijdrage die klaarstaat om in een gesprek vermeld te worden.
 *
 * "Bericht aan" opent geen blad meer maar meteen het gesprek
 * (components/lincin/PrivateSheet.tsx). Het gesprek neemt de bijdrage hier
 * op, toont hem boven het tekstveld, en stuurt hem als `postRef` mee met het
 * eerste bericht. Alleen in het geheugen: herlaad je, dan is hij weg.
 */
const klaar = new Map<string, PostRef>();

export function zetBijdrage(chatId: string, ref: PostRef) {
  klaar.set(chatId, ref);
}

export function neemBijdrage(chatId: string): PostRef | null {
  const r = klaar.get(chatId) ?? null;
  klaar.delete(chatId);
  return r;
}
