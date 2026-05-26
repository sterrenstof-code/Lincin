import * as Linking from "expo-linking";

/**
 * Jitsi via meet.jit.si — volledig gratis, geen account, geen minuten-limiet.
 * Rooms zijn technisch publiek maar de naam is UUID-afgeleid en dus praktisch
 * onraadbaar. Voor echte toegangscontrole: voeg later een JWT toe via JaaS.
 *
 * Room-slug: "lincin-" + chatId (UUID met koppelstreepjes).
 * Deterministisch → alle deelnemers met dezelfde chatId komen in dezelfde room.
 */
function roomSlug(chatId: string): string {
  return `lincin-${chatId}`;
}

/**
 * Iframe-embedbare URL voor meet.jit.si.
 * ?minimal=1 is niet ondersteund op meet.jit.si; de standaard UI is voldoende.
 */
export function buildJitsiEmbedUrl(chatId: string): string {
  return `https://meet.jit.si/${roomSlug(chatId)}`;
}

/**
 * Open een Jitsi call in de browser (native fallback).
 * Op iOS/Android opent dit in Safari/Chrome; de in-app modal is web-only.
 */
export async function openJitsiCall(chatId: string): Promise<void> {
  await Linking.openURL(buildJitsiEmbedUrl(chatId));
}
