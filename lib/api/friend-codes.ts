import { supabase } from "../supabase/client";

/**
 * Vriendcodes (0082): `JV-4821`, één per persoon.
 *
 * Wie jouw code (of de link of QR erbij) gebruikt, is meteen je linc —
 * geen verzoek, geen wachten. Lezen kan alleen je eigen code; inwisselen
 * gaat via `redeem_friend_code`, die ook raden afremt.
 */

export async function getMyFriendCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("friend_codes").select("code").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.code ?? null;
}

export type RedeemResult =
  | { status: "ok"; friend: { id: string; username: string; display_name: string | null } }
  | { status: "not_found" | "own" | "not_allowed" | "rate_limited" };

export async function redeemFriendCode(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc("redeem_friend_code", { p_code: code });
  if (error) throw error;
  return data as RedeemResult;
}

/** Een code zoals iemand hem typt of uit een link haalt: hoofdletters, geen spaties. */
export function normalizeFriendCode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/** Ziet dit eruit als een vriendcode? Twee letters, streepje, vier cijfers. */
export function looksLikeFriendCode(raw: string): boolean {
  return /^[A-Z]{2}-\d{4}$/.test(normalizeFriendCode(raw));
}
