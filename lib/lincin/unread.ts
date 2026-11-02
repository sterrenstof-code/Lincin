import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { countUnreadNotifications, markAllNotificationsRead } from "@/lib/api/notifications";
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

/**
 * Wie de meldingen opent, heeft ze gezien: de teller gaat naar 0 en de
 * server zet alles op gelezen — ook wat te oud is om in de lijst te staan.
 *
 * Daar ging het mis: de lijst haalt de laatste veertig op (desktop toont er
 * twaalf), de teller telt alles. Zes ongelezen meldingen onder de veertigste
 * gaven "6 nieuw" zonder dat er één te zien was, en zonder "Alles gelezen"
 * om ze weg te krijgen.
 *
 * `ready` wacht tot de lijst binnen is, zodat die nog met de rode stippen
 * aankomt: je ziet bij dit bezoek wat nieuw was, de teller niet meer.
 */
export function useClearNotificationsOnVisit(myUserId: string, ready: boolean) {
  const qc = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      const countKey = ["notifications-unread", myUserId];
      // Weet de teller al dat er niets is, dan hoeft de server niets te doen.
      if (qc.getQueryData<number>(countKey) === 0) return;
      void qc.cancelQueries({ queryKey: countKey });
      qc.setQueryData<number>(countKey, 0);
      markAllNotificationsRead(myUserId)
        .catch(() => {})
        .finally(() => qc.invalidateQueries({ queryKey: countKey }));
    }, [qc, myUserId, ready]),
  );
}
