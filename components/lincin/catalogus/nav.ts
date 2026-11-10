import { useRouter } from "expo-router";

import { useUnread } from "@/lib/lincin/unread";

import type { CatTab } from "./Tabbalk";

const TAB_HREF: Record<CatTab, string> = {
  feed: "/feed",
  chats: "/chats",
  events: "/events",
  you: "/profile",
};

/**
 * De omlijsting van een hoofdpagina in catalogus: de tabbalk, ✳ en +.
 * Dezelfde routes en tellers als de kop en voet van de andere thema's
 * (components/lincin/chrome).
 */
export function useCatNav() {
  const router = useRouter();
  const unread = useUnread();
  return {
    router,
    tab: (t: CatTab) => router.push(TAB_HREF[t] as never),
    meldingen: () => router.push("/notifications"),
    nieuw: () => router.push("/post-compose"),
    nieuweMeldingen: unread.notifications,
    ongelezen: unread.chats > 0,
    verzoeken: unread.friendRequests,
  };
}

/** Terug, of naar een vaste pagina als er niets achter ligt (een gedeelde link). */
export function useTerug(standaard: string) {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(standaard as never);
  };
}
