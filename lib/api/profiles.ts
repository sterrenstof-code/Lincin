import { supabase } from "../supabase/client";

/** Eén regel op je profiel: waar je heen wijst, en hoe je het noemt. */
export type ProfileLink = {
  label: string;
  url: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  identity_pubkey: string;
  last_seen_at?: string | null;
  /**
   * 0044 — vrije tekst bovenaan het profiel.
   *
   * Sinds 0054 is dit **markdown**, dezelfde vorm als de toelichting bij een
   * vondst (`lib/richtext.ts`). Er is niets voor gemigreerd en dat hoefde
   * ook niet: platte tekst is geldige markdown, dus bestaande bio's lezen
   * ongewijzigd door.
   */
  bio?: string | null;
  /** 0054 — de plaat bovenaan het profiel. Publieke URL, zoals `avatar_url`. */
  hero_url?: string | null;
  /** 0054 — hoogstens tien, in de volgorde waarin ze staan. */
  links?: ProfileLink[] | null;
};

/**
 * De kolommen van een profiel, op één plek.
 *
 * Deze lijst stond zes keer uitgeschreven, en dat is precies zo lang goed
 * als niemand er een kolom bij zet: bij 0054 zou "hero_url" op vijf plekken
 * kloppen en op de zesde niet, en dan is er één scherm waar je plaat het
 * niet doet zonder dat iets dat meldt.
 */
export const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, identity_pubkey, last_seen_at, bio, hero_url, links";

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
    .select(PROFILE_COLUMNS)
    .ilike("username", `${q}%`)
    .limit(20);

  if (excludeUserId) {
    req = req.neq("id", excludeUserId);
  }

  const { data, error } = await req;
  if (error) throw error;
  return data ?? [];
}

/**
 * Zoek profielen voor de @-suggesties. Anders dan
 * `searchProfilesByUsername` kijkt dit ook in de weergavenaam en ook
 * midden in een woord: je typt zelden de eerste letters van een handle,
 * je typt de naam zoals je die kent.
 */
export async function searchProfilesForMention(
  query: string,
  excludeUserId?: string,
  limit = 8
): Promise<Profile[]> {
  const q = query.trim().toLowerCase();
  const cols = PROFILE_COLUMNS;

  let req = supabase.from("profiles").select(cols).limit(limit);
  if (q) req = req.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  else req = req.order("last_seen_at", { ascending: false, nullsFirst: false });
  if (excludeUserId) req = req.neq("id", excludeUserId);

  const { data, error } = await req;
  if (error) return [];
  return data ?? [];
}

/** Profielen bij een reeks handles — voor het omzetten van @vermeldingen. */
export async function getProfilesByUsernames(usernames: string[]): Promise<Profile[]> {
  const unique = Array.from(new Set(usernames.map((u) => u.toLowerCase()))).filter(Boolean);
  if (unique.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("username", unique);
  if (error) return [];
  return data ?? [];
}

/** De handles die in een tekst genoemd worden, zonder de @. */
export function mentionedUsernames(text: string | null | undefined): string[] {
  if (!text) return [];
  return Array.from(text.matchAll(/@([a-z0-9._]{3,32})/gi)).map((m) => m[1].toLowerCase());
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
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
    .select(PROFILE_COLUMNS)
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfiles(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
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
  fileBytes: Uint8Array<ArrayBuffer>,
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

/**
 * De plaat bovenaan het profiel.
 *
 * Zelfde bucket als de avatar, ander pad. Dat kan omdat de policies uit
 * 0028 op de *map* staan (`{user_id}/…`) en niet op de bestandsnaam — dus
 * er is geen tweede bucket, geen tweede set rechten, en niets wat uit
 * elkaar kan lopen.
 *
 * Wel een aparte functie en geen `uploadAvatar(..., name)`: de twee hebben
 * een andere bedoeling en een andere maat, en een gedeelde functie met een
 * naam-parameter nodigt uit om er ooit een derde ding doorheen te duwen.
 */
export async function uploadProfileHero(
  userId: string,
  fileBytes: Uint8Array<ArrayBuffer>,
  mimeType: string
): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/hero.${ext}`;
  const blob = new Blob([fileBytes], { type: mimeType });

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: mimeType, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Hoeveel links een profiel mag dragen. Gelijk aan de check in 0054. */
export const MAX_PROFILE_LINKS = 10;

/**
 * Wat er van een lijst links overblijft voordat hij de database in gaat.
 *
 * De check in 0054 bewaakt alleen de vórm (een array, hoogstens tien). Wat
 * er ín staat is aan ons, en er is één ding dat je hier moet doen: een
 * adres zonder schema aanvullen. Iemand typt `beyondesign.io` en verwacht
 * dat het een link is; zonder `https://` opent dat op web een pad binnen de
 * app en op native niets. Dat is geen validatie maar de bedoeling raden, en
 * hier is de bedoeling niet dubbelzinnig.
 *
 * Een rij zonder adres valt weg. Een rij zonder label krijgt zijn eigen
 * adres als naam — beter een lelijke naam dan een link die je niet ziet.
 */
export function normalizeLinks(links: ProfileLink[]): ProfileLink[] {
  return links
    .map((l) => {
      const url = l.url.trim();
      if (!url) return null;
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const label = l.label.trim();
      return { label: label || url.replace(/^https?:\/\//i, ""), url: href };
    })
    .filter((l): l is ProfileLink => l !== null)
    .slice(0, MAX_PROFILE_LINKS);
}

export async function updateMyProfile(
  userId: string,
  changes: {
    username?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    hero_url?: string | null;
    bio?: string | null;
    links?: ProfileLink[];
  }
): Promise<Profile> {
  // Niet `Record<string, unknown>`: dat is te breed voor de Update-vorm van
  // de tabel, waardoor `.update(patch)` niet meer typecheckt.
  const patch: {
    username?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    hero_url?: string | null;
    bio?: string | null;
    links?: ProfileLink[];
  } = {};
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
  if (changes.hero_url !== undefined) {
    patch.hero_url = changes.hero_url;
  }
  if (changes.bio !== undefined) {
    const b = changes.bio?.trim();
    patch.bio = b && b.length > 0 ? b : null;
  }
  if (changes.links !== undefined) {
    patch.links = normalizeLinks(changes.links);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
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
