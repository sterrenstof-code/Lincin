import { useQuery } from "@tanstack/react-query";

import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/provider";

/** De vier tabbladen van de app. */
export type Tab = "feed" | "chats" | "events" | "you";

/**
 * Wat er ligt: ongelezen gesprekken, meldingen, en wie op je wacht.
 *
 * `friendRequests` hoort bij "Jij", want daar wonen je lincs. Het is het
 * enige ding dat op je ligt te wachten zonder dat er een melding van
 * bestaat — er is geen `friend_request`-soort in `NotificationRow` — dus
 * zonder dit getal is een inkomend verzoek nergens te zien tot je uit
 * jezelf gaat kijken.
 */
export function useUnread(): {
  chats: number;
  notifications: number;
  friendRequests: number;
} {
  const { session } = useAuth();
  const myId = session?.user.id ?? "anon";
  const chats = useQuery({
    queryKey: ["chats", myId],
    queryFn: () => listMyChats(myId),
    enabled: !!session,
    staleTime: 30_000,
  });
  const notes = useQuery({
    queryKey: ["notifications-unread", myId],
    queryFn: () => countUnreadNotifications(myId),
    enabled: !!session,
    staleTime: 30_000,
  });
  // Dezelfde sleutel als elders in de app, dus react-query haalt dit niet
  // een tweede keer op.
  const friendships = useQuery({
    queryKey: ["friendships", myId],
    queryFn: () => listMyFriendships(myId),
    enabled: !!session,
    staleTime: 30_000,
  });
  return {
    chats: (chats.data ?? []).reduce((n, c) => n + (c.unread_count ?? 0), 0),
    notifications: notes.data ?? 0,
    friendRequests: (friendships.data ?? []).filter(
      (f) => f.status === "pending" && f.addressee_id === session?.user.id
    ).length,
  };
}
