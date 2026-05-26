import * as Linking from "expo-linking";

// JaaS AppID — gratis tier: 10.000 min/maand.
// We gebruiken 8x8.vc (JaaS) i.p.v. meet.jit.si omdat meet.jit.si inmiddels
// een ingelogde moderator vereist om een vergadering te starten. JaaS heeft
// die beperking niet op de free tier: de eerste persoon die binnenkomt wordt
// automatisch moderator, ook zonder JWT.
const JAAS_APP_ID = "vpaas-magic-cookie-eaf3718655db436ca8e5535b6a565a84";

/**
 * Deterministische room-slug afgeleid van chatId (UUID).
 * UUID bevat enkel hex-chars + koppelstreepjes — veilig in een URL-segment.
 */
function roomSlug(chatId: string): string {
  return `lincin-${chatId}`;
}

/**
 * Iframe-embedbare URL voor JaaS (8x8.vc).
 */
export function buildJitsiEmbedUrl(chatId: string): string {
  return `https://8x8.vc/${JAAS_APP_ID}/${roomSlug(chatId)}`;
}

/**
 * Open een JaaS call in de browser (native fallback).
 * Op iOS/Android opent dit in Safari/Chrome; de in-app modal is web-only.
 */
export async function openJitsiCall(chatId: string): Promise<void> {
  await Linking.openURL(buildJitsiEmbedUrl(chatId));
}
