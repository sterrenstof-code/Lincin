import { Linking } from "react-native";

/**
 * Een link uit iets wat iemand anders schreef (een bijdrage, een reactie,
 * een bio) openen: alleen http(s). `javascript:`, `data:`, `intent:` of de
 * deeplink van een andere app gaan nooit open — op web kon een
 * `javascript:`-link anders code draaien met jouw sessie.
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function openExternal(raw: string | null | undefined) {
  const url = safeHttpUrl(raw);
  if (url) Linking.openURL(url).catch(() => {});
}
