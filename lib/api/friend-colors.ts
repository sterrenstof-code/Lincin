import { HUES, type Hue } from "../design/theme";
import { supabase } from "../supabase/client";

/**
 * Jouw kleur per persoon (0062). Alleen de eigenaar leest en schrijft
 * (RLS); de rest van de app leest de keuzes via `hueFor` in theme.ts.
 */

/** Al je keuzes: id → kleur. Faalt stil — dan geldt de lokale kopie. */
export async function listFriendColors(ownerId: string): Promise<Record<string, Hue> | null> {
  const { data, error } = await supabase.from("friend_colors").select("friend_id, hue").eq("owner_id", ownerId);
  if (error) return null;
  const out: Record<string, Hue> = {};
  for (const r of data ?? []) {
    if (HUES.includes(r.hue)) out[r.friend_id] = r.hue;
  }
  return out;
}

/** Kies een kleur voor iemand; `null` geeft hem zijn eigen kleur terug. */
export async function setFriendColor(ownerId: string, friendId: string, hue: Hue | null): Promise<void> {
  const q = hue
    ? supabase
        .from("friend_colors")
        .upsert({ owner_id: ownerId, friend_id: friendId, hue, updated_at: new Date().toISOString() })
    : supabase.from("friend_colors").delete().eq("owner_id", ownerId).eq("friend_id", friendId);
  const { error } = await q;
  if (error) throw error;
}
