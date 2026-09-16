import { useQuery } from "@tanstack/react-query";

import { listMyChats } from "@/lib/api/chats";
import { countUnreadNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/provider";

/** De vier tabbladen van de app. */
export type Tab = "feed" | "chats" | "events" | "you";

/** Wat er ligt: ongelezen gesprekken en meldingen. */
export function useUnread(): { chats: number; notifications: number } {
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
  return {
    chats: (chats.data ?? []).reduce((n, c) => n + (c.unread_count ?? 0), 0),
    notifications: notes.data ?? 0,
  };
}
