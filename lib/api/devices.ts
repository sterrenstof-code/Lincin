import { Platform } from "react-native";

import { supabase } from "../supabase/client";

export type ProfileDevice = {
  user_id: string;
  device_id: string;
  identity_pubkey: string;
  label: string | null;
  created_at: string;
  last_seen_at: string;
};

/** Haal alle geregistreerde devices voor een lijst user-ids op. */
export async function listUserDevices(userIds: string[]): Promise<ProfileDevice[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profile_devices")
    .select("user_id, device_id, identity_pubkey, label, created_at, last_seen_at")
    .in("user_id", userIds);
  if (error) throw error;
  return (data ?? []) as ProfileDevice[];
}

/** Mijn devices, voor de "Devices" sectie in Profiel. */
export async function listMyDevices(myUserId: string): Promise<ProfileDevice[]> {
  const { data, error } = await supabase
    .from("profile_devices")
    .select("user_id, device_id, identity_pubkey, label, created_at, last_seen_at")
    .eq("user_id", myUserId)
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProfileDevice[];
}

/** Registreer of update deze device (upsert op (user_id, device_id)). */
export async function registerOrUpdateDevice(args: {
  userId: string;
  deviceId: string;
  identityPubkey: string;
  label?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("profile_devices")
    .upsert(
      {
        user_id: args.userId,
        device_id: args.deviceId,
        identity_pubkey: args.identityPubkey,
        label: args.label ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" }
    );
  if (error) throw error;
}

export async function removeDevice(
  userId: string,
  deviceId: string
): Promise<void> {
  const { error } = await supabase
    .from("profile_devices")
    .delete()
    .eq("user_id", userId)
    .eq("device_id", deviceId);
  if (error) throw error;
}

/** Mijn label-detectie. "Chrome op Mac", "Safari op iPhone", etc. */
export function guessDeviceLabel(): string {
  if (Platform.OS === "ios") return "iOS";
  if (Platform.OS === "android") return "Android";
  if (typeof navigator === "undefined") return "Web";
  const ua = navigator.userAgent ?? "";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Web";
  const platform =
    /Mac/.test(ua) ? "Mac" :
    /Windows/.test(ua) ? "Windows" :
    /Linux/.test(ua) ? "Linux" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" : "";
  return platform ? `${browser} op ${platform}` : browser;
}
