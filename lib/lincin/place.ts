import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

import type { SharedPlace } from "@/lib/api/messages";

/**
 * Een plek delen in een gesprek (+ Bijlage → Plek).
 *
 * Alleen op jouw tik: dan vraagt de app één keer toestemming en leest hij
 * je huidige positie. Op een telefoon komt er een straatnaam bij; op web
 * kan dat niet zonder een externe dienst, en dan staan er coördinaten —
 * je kan de plek zelf een naam geven voor je hem deelt.
 */
export async function currentPlace(): Promise<SharedPlace> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") throw new Error("Geen toegang tot je locatie.");
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const place: SharedPlace = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
  if (Platform.OS !== "web") {
    try {
      const [a] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const label = [a?.street && a.streetNumber ? `${a.street} ${a.streetNumber}` : a?.street ?? a?.name, a?.city].filter(Boolean).join(", ");
      if (label) place.label = label;
    } catch {
      // Geen naam is geen ramp: de coördinaten volstaan.
    }
  }
  return place;
}

/** Vijf decimalen: op een meter nauwkeurig, niet nauwkeuriger dan nodig. */
function round(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

export function placeCoords(p: SharedPlace): string {
  return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
}

/** Openen in een kaartenapp: Google Maps werkt op elk toestel en in elke browser. */
export function openPlace(p: SharedPlace) {
  const q = encodeURIComponent(`${p.lat},${p.lng}`);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
}
