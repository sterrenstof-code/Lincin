import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

/**
 * De app-vergrendeling (Instellingen → "Vergrendel met Face ID"): wie hem
 * aanzet, moet Lincin ontgrendelen met Face ID, Touch ID of een
 * vingerafdruk bij het openen en na een minuut weg. Per toestel, niet per
 * account — een tweede telefoon heeft misschien geen Face ID — dus in de
 * SecureStore en niet in `user_prefs`.
 *
 * De sessie zelf blijft waar hij was; dit is een slot vóór de app, geen
 * tweede wachtwoord. `components/AppLock.tsx` tekent het slot.
 */

const KEY = "lincin.applock";

let enabled: boolean | null = null;
const listeners = new Set<() => void>();
let loading: Promise<boolean> | null = null;

export function loadAppLock(): Promise<boolean> {
  if (enabled !== null) return Promise.resolve(enabled);
  if (!loading) {
    loading = SecureStore.getItemAsync(KEY)
      .then((v) => v === "1")
      .catch(() => false)
      .then((v) => {
        enabled = v;
        for (const fn of listeners) fn();
        return v;
      });
  }
  return loading;
}

export type Biometry = {
  /** Toestel heeft het en er is een gezicht of vinger ingesteld. */
  available: boolean;
  /** "Face ID", "Touch ID", "vingerafdruk" — voor de labels. */
  label: string;
};

export async function getBiometry(): Promise<Biometry> {
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const T = LocalAuthentication.AuthenticationType;
    const face = types.includes(T.FACIAL_RECOGNITION);
    const finger = types.includes(T.FINGERPRINT);
    const ios = process.env.EXPO_OS === "ios";
    const label = face ? (ios ? "Face ID" : "gezichtsherkenning") : finger ? (ios ? "Touch ID" : "vingerafdruk") : "ontgrendeling";
    return { available: hardware && enrolled, label };
  } catch {
    return { available: false, label: "ontgrendeling" };
  }
}

/** Vraag Face ID / vingerafdruk (met de toegangscode als terugval). */
export async function authenticate(reason: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Annuleer",
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

/**
 * Aan- of uitzetten. Beide vragen eerst om te ontgrendelen: aanzetten om
 * zeker te zijn dat het werkt (anders sluit je jezelf buiten), uitzetten
 * zodat wie je ontgrendelde telefoon even vasthoudt het slot niet weghaalt.
 */
export async function setAppLock(on: boolean): Promise<boolean> {
  const ok = await authenticate(on ? "Zet de vergrendeling aan" : "Zet de vergrendeling uit");
  if (!ok) return false;
  try {
    if (on) await SecureStore.setItemAsync(KEY, "1");
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    return false;
  }
  enabled = on;
  for (const fn of listeners) fn();
  return true;
}

/** Bij uitloggen: het slot hoort bij wie er ingelogd was. */
export async function clearAppLock() {
  enabled = false;
  for (const fn of listeners) fn();
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
}

export function useAppLock(): { enabled: boolean | null; biometry: Biometry | null } {
  const [on, setOn] = useState<boolean | null>(enabled);
  const [biometry, setBiometry] = useState<Biometry | null>(null);
  useEffect(() => {
    const fn = () => setOn(enabled);
    listeners.add(fn);
    loadAppLock().then(fn);
    getBiometry().then(setBiometry);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { enabled: on, biometry };
}
