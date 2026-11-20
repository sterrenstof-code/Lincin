import { Platform } from "react-native";

/**
 * Lincin is er vanaf 16 (nov 2026). Dat is de grens voor toestemming zonder
 * ouders in Nederland en Duitsland, en ruim boven de 13 van België en de
 * Amerikaanse COPPA.
 *
 * We vragen een geboortejaar, zonder te verklappen welk antwoord "goed" is,
 * en bewaren alleen dat het in orde was (`age_ok` in de gebruikersmetadata),
 * niet het jaar zelf. Wie te jong is en terugkeert om een ander jaar te
 * proberen, ziet op dit toestel opnieuw de weigering.
 */
export const MIN_AGE = 16;

const KEY = "lincin-leeftijd-geweigerd";

/** `null`: geen geldig jaar. Wie dit jaar 16 wordt, telt als 16. */
export function oldEnough(input: string): boolean | null {
  const year = Number(input.trim());
  const now = new Date().getFullYear();
  if (!/^\d{4}$/.test(input.trim()) || year < now - 120 || year > now) return null;
  return now - year >= MIN_AGE;
}

export function ageRefused(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markAgeRefused(): void {
  if (Platform.OS !== "web") return;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Zonder opslag geldt de weigering alleen voor deze keer.
  }
}

export const AGE_REFUSED_TEXT = `Lincin is er vanaf ${MIN_AGE} jaar. Je kunt nog geen account maken.`;
