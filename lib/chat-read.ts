import { useQueryClient } from "@tanstack/react-query";

import { markChatRead, markChatUnread, type ChatWithMembers } from "@/lib/api/chats";
import { useAuth } from "@/lib/auth/provider";
import { useT } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

/**
 * Gelezen of ongelezen zetten vanuit de lijst, zonder het gesprek te openen
 * (Telegram: lang drukken of rechtsklikken op een gesprek).
 *
 * De teller springt meteen om; de lijst haalt daarna de echte stand op.
 * Ongelezen wordt `1` tot die stand er is — zo telt de server het ook als
 * alleen het laatste bericht van een ander weer meetelt.
 */
export function useToggleChatRead() {
  const { session } = useAuth();
  const myId = session?.user.id ?? "anon";
  const qc = useQueryClient();
  const toast = useToast();
  const t = useT();
  return async (chatId: string, unread: boolean) => {
    const key = ["chats", myId];
    qc.setQueryData<ChatWithMembers[]>(key, (old) =>
      old?.map((c) => (c.id === chatId ? { ...c, unread_count: unread ? Math.max(1, c.unread_count ?? 0) : 0 } : c)),
    );
    try {
      await (unread ? markChatUnread(chatId) : markChatRead(chatId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
    qc.invalidateQueries({ queryKey: key });
  };
}
