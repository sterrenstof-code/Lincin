import { supabase } from "../supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  identity_pubkey: string;
  last_seen_at?: string | null;
};

export const USERNAME_REGEX = /^[a-z0-9._]+$/;

/**
 * Validate a username candidate against client-side rules. Returns null
 * if valid, or a reason string otherwise. Final uniqueness check happens
 * server-side and surfaces as a unique-constraint error.
 */
export function validateUsername(username: string): string | null {
  if (username.length < 3) return "Minstens 3 tekens.";
  if (username.length > 32) return "Maximaal 32 tekens.";
  if (!USERNAME_REGEX.test(username))
    return "Gebruik alleen kleine letters, cijfers, punt of underscore.";
  return null;
}

export async function searchProfilesByUsername(
  query: string,
  excludeUserId?: string
): Promise<Profile[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  let req = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at")
    .ilike("username", `${q}%`)
    .limit(20);

  if (excludeUserId) {
    req = req.neq("id", excludeUserId);
  }

  const { data, error } = await req;
  if (error) throw error;
  return data ?? [];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at")
    .in("id", userIds);
  if (error) throw error;
  return data ?? [];
}

/**
 * Upload een avatar-afbeelding naar de `avatars` Storage bucket.
 * Geeft de publieke URL terug die direct in `profiles.avatar_url` opgeslagen kan worden.
 * Overschrijft altijd hetzelfde pad per user_id zodat er geen orphan files ontstaan.
 */
export async function uploadAvatar(
  userId: string,
  fileBytes: Uint8Array,
  mimeType: string
): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const path = `${userId}/avatar.${ext}`;
  const blob = new Blob([fileBytes], { type: mimeType });

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: mimeType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Voeg een cache-buster toe zodat de nieuwe foto meteen zichtbaar is.
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function updateMyProfile(
  userId: string,
  changes: { username?: string; display_name?: string | null; avatar_url?: string | null }
): Promise<Profile> {
  const patch: Record<string, unknown> = {};
  if (changes.username !== undefined) {
    const u = changes.username.trim().toLowerCase();
    const err = validateUsername(u);
    if (err) throw new Error(err);
    patch.username = u;
  }
  if (changes.display_name !== undefined) {
    const d = changes.display_name?.trim();
    patch.display_name = d && d.length > 0 ? d : null;
  }
  if (changes.avatar_url !== undefined) {
    patch.avatar_url = changes.avatar_url;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, username, display_name, avatar_url, identity_pubkey, last_seen_at")
    .single();

  if (error) {
    // Postgres unique violation code is 23505.
    if ((error as any).code === "23505") {
      throw new Error("Deze gebruikersnaam is al bezet.");
    }
    throw error;
  }
  return data as Profile;
}

/** Fire-and-forget: update last_seen_at voor de huidige gebruiker. */
export async function touchLastSeen(userId: string): Promise<void> {
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}
