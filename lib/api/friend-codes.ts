import { supabase } from "../supabase/client";

/**
 * Vriendcodes (0082, 0093): `JV-4821`, één per persoon.
 *
 * De korte code is te raden, dus die stuurt een verzoek. De link en de QR
 * die je deelt dragen een lang geheim (`token`): wie die opent, is meteen
 * je linc — hij kreeg hem van jou. Lezen kan alleen je eigen code;
 * inwisselen gaat via `redeem_friend_code`, die ook raden afremt.
 */

export type MyFriendCode = { code: string; token: string };

export async function getMyFriendCode(userId: string): Promise<MyFriendCode | null> {
  const { data, error } = await supabase.from("friend_codes").select("code, token").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { code: data.code, token: data.token } : null;
}

export type RedeemResult =
  | { status: "ok" | "requested"; friend: { id: string; username: string; display_name: string | null } }
  | { status: "not_found" | "own" | "not_allowed" | "rate_limited" };

export async function redeemFriendCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc("redeem_friend_code", { p_code: code });
  if (error) throw error;
  return data as RedeemResult;
}

/** Het geheim uit een gedeelde link: 32 hextekens. */
export function looksLikeFriendToken(raw: string): boolean {
  return /^[0-9a-f]{32}$/i.test(raw.trim());
}

/** Een code zoals iemand hem typt of uit een link haalt: hoofdletters, geen spaties. Een token blijft klein. */
export function normalizeFriendCode(raw: string): string {
  const s = raw.trim().replace(/\s+/g, "");
  return looksLikeFriendToken(s) ? s.toLowerCase() : s.toUpperCase();
}

/** Ziet dit eruit als een vriendcode? Twee letters, streepje, vier cijfers. */
export function looksLikeFriendCode(raw: string): boolean {
  return /^[A-Z]{2}-\d{4}$/.test(normalizeFriendCode(raw));
}
