import { supabase } from "../supabase/client";
import type { Profile } from "./profiles";
import { createActivityEvent } from "./activity-events";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  accepted_at: string | null;
};

export type FriendshipWithProfile = Friendship & {
  other: Profile;
};

/** Send a friend request to another user. */
export async function sendFriendRequest(
  myUserId: string,
  addresseeId: string
): Promise<void> {
  const { error } = await supabase.from("friendships").insert({
    requester_id: myUserId,
    addressee_id: addresseeId,
    status: "pending",
  });
  if (error) throw error;
}

/** Accept a pending friend request you've received. */
export async function acceptFriendRequest(
  friendshipId: string,
  myUserId: string,
  requesterId: string,
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", friendshipId);
  if (error) throw error;
  // Activiteitsmoment — fire-and-forget
  createActivityEvent({ actorId: myUserId, kind: "friend_accepted", friendId: requesterId }).catch(() => {});
}

/** Decline (delete) a friend request, or unfriend. */
export async function deleteFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);
  if (error) throw error;
}

/** Friendships the current user is involved in, joined with the other party's profile. */
export async function listMyFriendships(
  myUserId: string
): Promise<FriendshipWithProfile[]> {
  // RLS already filters to friendships I'm part of, so we don't need an extra
  // where clause. We then resolve the "other" profile per row.
  const { data, error } = await supabase
    .from("friendships")
    .select(
      "id, requester_id, addressee_id, status, created_at, accepted_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Friendship[];

  const otherIds = Array.from(
    new Set(rows.map((r) => (r.requester_id === myUserId ? r.addressee_id : r.requester_id)))
  );
  if (otherIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, identity_pubkey")
    .in("id", otherIds);
  if (pErr) throw pErr;

  const byId = new Map(profiles?.map((p) => [p.id, p]) ?? []);
  return rows
    .map((r) => {
      const otherId = r.requester_id === myUserId ? r.addressee_id : r.requester_id;
      const other = byId.get(otherId);
      if (!other) return null;
      return { ...r, other } satisfies FriendshipWithProfile;
    })
    .filter((x): x is FriendshipWithProfile => x !== null);
}
