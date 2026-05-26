import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase/client";

/**
 * Configureer wat er gebeurt wanneer een notificatie binnenkomt terwijl de
 * app open is. Standaard tonen we de banner + speel het geluid niet
 * (gebruiker is al in de app, dus subtieler).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Vraag permissie + haal de Expo push-token op + sla op in user_devices.
 * Roep dit één keer per sessie aan, na succesvolle bootstrap.
 *
 * Werkt op iOS, Android (echte toestellen, niet simulator), en web mits
 * VAPID-keys geconfigureerd zijn (zie PUSH.md).
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // Expo push notifications werken niet op simulators (iOS Simulator,
  // Android Emulator). Real device check.
  if (Platform.OS !== "web" && !Device.isDevice) {
    return null;
  }

  // Web: vereist VAPID public key + service worker registratie. Skip stil
  // als er geen key is geconfigureerd.
  if (Platform.OS === "web") {
    const vapid = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) return null;
  }

  // Permissie check + request
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.status === "granted";
  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.status === "granted";
  }
  if (!granted) return null;

  // Vraag token
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenResponse =
      Platform.OS === "web"
        ? await Notifications.getDevicePushTokenAsync()
        : await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );

    const token = tokenResponse.data;
    if (!token) return null;

    // Sla op in user_devices
    const { error } = await supabase
      .from("user_devices")
      .upsert(
        {
          user_id: userId,
          push_token: typeof token === "string" ? token : JSON.stringify(token),
          platform: Platform.OS === "web" ? "web" : Platform.OS === "ios" ? "ios" : "android",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "push_token" }
      );
    if (error) {
      console.warn("registerPushToken db error", error.message);
      return null;
    }

    return typeof token === "string" ? token : JSON.stringify(token);
  } catch (e) {
    console.warn("registerPushToken failed", e);
    return null;
  }
}

/** Verwijder de huidige device-rij bij uitloggen. */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const tokenResponse = await Notifications.getDevicePushTokenAsync().catch(
      () => null
    );
    if (!tokenResponse) return;
    const token =
      typeof tokenResponse.data === "string"
        ? tokenResponse.data
        : JSON.stringify(tokenResponse.data);
    await supabase
      .from("user_devices")
      .delete()
      .eq("user_id", userId)
      .eq("push_token", token);
  } catch {
    /* ignore */
  }
}

/**
 * Listener voor inkomende notificaties. Roep dit in een useEffect aan en
 * cleanup met removeNotificationSubscription. Voor nu loggen we alleen —
 * UI-specifieke routing (bv. tap → /chat/{id}) komt later.
 */
export function addNotificationTapListener(
  onTap: (data: Record<string, any>) => void
) {
  const sub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<
        string,
        any
      >;
      onTap(data);
    }
  );
  return () => sub.remove();
}

/**
 * Status van push voor de huidige sessie. Handig voor het profielscherm
 * om te tonen of pushes actief zijn + de token te tonen voor debugging.
 */
export type PushStatus =
  | { kind: "unsupported"; reason: string }
  | { kind: "permission-denied" }
  | { kind: "no-token" }
  | { kind: "ready"; token: string; platform: "ios" | "android" | "web" };

export async function getPushStatus(): Promise<PushStatus> {
  if (Platform.OS !== "web" && !Device.isDevice) {
    return { kind: "unsupported", reason: "Push werkt enkel op fysieke toestellen (geen simulator)." };
  }
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return { kind: "unsupported", reason: "Deze browser ondersteunt geen notificaties." };
    }
    if (!process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY) {
      return {
        kind: "unsupported",
        reason: "Web push is op deze deploy nog niet geconfigureerd (VAPID-key ontbreekt).",
      };
    }
  }

  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== "granted") return { kind: "permission-denied" };

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResponse =
      Platform.OS === "web"
        ? await Notifications.getDevicePushTokenAsync()
        : await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );
    const tokenStr =
      typeof tokenResponse.data === "string"
        ? tokenResponse.data
        : JSON.stringify(tokenResponse.data);
    if (!tokenStr) return { kind: "no-token" };
    return {
      kind: "ready",
      token: tokenStr,
      platform: Platform.OS === "web" ? "web" : Platform.OS === "ios" ? "ios" : "android",
    };
  } catch (e) {
    return { kind: "no-token" };
  }
}

/**
 * Stuur een test-notificatie naar deze device via Expo's Push API. Werkt
 * onafhankelijk van onze Edge Function en is handig om te verifiëren dat
 * de hele pipeline (permission → token → Expo → device) goed staat.
 *
 * Eis: de token moet een Expo-push-token zijn (begint met "ExponentPushToken[...]").
 * Web push tokens via FCM/APNs werken hier niet rechtstreeks.
 */
export async function sendTestPush(token: string): Promise<{ ok: boolean; detail: string }> {
  if (!token.startsWith("ExponentPushToken")) {
    return {
      ok: false,
      detail:
        "Token is geen Expo-push-token. Test push via Expo werkt nu enkel op iOS/Android via Expo Go of een EAS build.",
    };
  }
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify([
        {
          to: token,
          title: "Lincin test 🔔",
          body: "Push notificaties werken op dit toestel.",
          data: { test: true },
          sound: "default",
        },
      ]),
    });
    const body = await response.json();
    const detail = JSON.stringify(body);
    if (response.ok) return { ok: true, detail };
    return { ok: false, detail };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}
