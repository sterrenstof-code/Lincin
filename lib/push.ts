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
 * Converteer de URL-safe base64 VAPID public key naar Uint8Array zoals de
 * browser PushManager dat verwacht als applicationServerKey.
 */
function vapidKeyToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Web Push registratie via de native browser Push API.
 * Bypassed expo-notifications — die is bedoeld voor native iOS/Android.
 *
 * Flow:
 *   1. Registreer service worker (/sw.js)
 *   2. Vraag Notification-permissie
 *   3. Abonneer via pushManager met VAPID public key
 *   4. Sla de subscription JSON op in user_devices
 *
 * iOS-noot: Web Push werkt op iOS 16.4+ MAAR enkel als de app geïnstalleerd
 * is als PWA (via "Zet op beginscherm"). In de browser zelf doet het niets.
 * De InstallBanner component begeleidt gebruikers hierin.
 */
async function registerWebPush(userId: string): Promise<string | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;

  const vapidKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null; // Web push uitgeschakeld op deze deploy

  try {
    // Registreer de SW. Als hij al actief is, krijg je de bestaande
    // registratie terug — geen dubbele installatie.
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // subscribe() is idempotent: bestaand abonnement → zelfde object terug.
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToUint8Array(vapidKey),
    });

    const subscriptionJson = JSON.stringify(subscription.toJSON());

    const { error } = await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        push_token: subscriptionJson,
        platform: "web",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "push_token" }
    );
    if (error) {
      console.warn("registerWebPush db error", error.message);
      return null;
    }

    return subscription.endpoint;
  } catch (e) {
    console.warn("registerWebPush failed", e);
    return null;
  }
}

/**
 * Vraag permissie + registreer push token + sla op in user_devices.
 * Roep dit één keer per sessie aan, na succesvolle bootstrap.
 *
 * Op web: gebruikt de native browser Push API + VAPID (zie registerWebPush).
 * Op iOS/Android: gebruikt Expo push tokens via Expo's push service.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // Web: volledig eigen pad via browser Push API.
  if (Platform.OS === "web") {
    return registerWebPush(userId);
  }

  // Native: expo-notifications werkt niet op simulators.
  if (!Device.isDevice) return null;

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.status === "granted";
  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.status === "granted";
  }
  if (!granted) return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;
    if (!token) return null;

    const { error } = await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        push_token: token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "push_token" }
    );
    if (error) {
      console.warn("registerPushToken db error", error.message);
      return null;
    }

    return token;
  } catch (e) {
    console.warn("registerPushToken failed", e);
    return null;
  }
}

/** Verwijder de huidige device-rij bij uitloggen. */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Web: verwijder de subscription op basis van het endpoint.
      if (!("serviceWorker" in navigator)) return;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription().catch(() => null);
      if (!sub) return;
      const token = JSON.stringify(sub.toJSON());
      await supabase
        .from("user_devices")
        .delete()
        .eq("user_id", userId)
        .eq("push_token", token);
      await sub.unsubscribe();
    } else {
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
    }
  } catch {
    /* ignore */
  }
}

/**
 * Listener voor inkomende notificaties (native). Roep dit in een useEffect
 * aan en cleanup de returnwaarde. Op web worden taps afgehandeld via de
 * service worker (zie public/sw.js notificationclick + postMessage).
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
 * Status van push voor de huidige sessie.
 */
export type PushStatus =
  | { kind: "unsupported"; reason: string }
  | { kind: "permission-denied" }
  | { kind: "no-token" }
  | { kind: "ready"; token: string; platform: "ios" | "android" | "web" };

export async function getPushStatus(): Promise<PushStatus> {
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
    if (Notification.permission !== "granted") return { kind: "permission-denied" };
    if (!("serviceWorker" in navigator)) return { kind: "no-token" };
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return { kind: "no-token" };
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    if (!sub) return { kind: "no-token" };
    return { kind: "ready", token: sub.endpoint, platform: "web" };
  }

  if (!Device.isDevice) {
    return { kind: "unsupported", reason: "Push werkt enkel op fysieke toestellen (geen simulator)." };
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== "granted") return { kind: "permission-denied" };

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const tokenStr = tokenResponse.data;
    if (!tokenStr) return { kind: "no-token" };
    return {
      kind: "ready",
      token: tokenStr,
      platform: Platform.OS === "ios" ? "ios" : "android",
    };
  } catch {
    return { kind: "no-token" };
  }
}

/**
 * Stuur een test-notificatie via Expo's Push API (native tokens only).
 */
export async function sendTestPush(token: string): Promise<{ ok: boolean; detail: string }> {
  if (!token.startsWith("ExponentPushToken")) {
    return {
      ok: false,
      detail: "Token is geen Expo-push-token. Test push via Expo werkt enkel op iOS/Android.",
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
          title: "Lincin test",
          body: "Push notificaties werken op dit toestel.",
          data: { test: true },
          sound: "default",
        },
      ]),
    });
    const body = await response.json();
    const detail = JSON.stringify(body);
    return response.ok ? { ok: true, detail } : { ok: false, detail };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}
