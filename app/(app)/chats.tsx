import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { DashedTile } from "@/components/lincin/modern/Bento";
import { ChatsModern, type ChatRowData } from "@/components/lincin/modern/ChatsModern";
import { ChatsMagazine } from "@/components/lincin/magazine/Pages";
import { useChatReadMenu } from "@/components/lincin/ChatReadMenu";
import { chatAvatarUrl, chatTitle, getOrCreateDirectChat, listMyChats, otherMember } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { hueFor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { useLang, useT } from "@/lib/i18n";
import { useChatPreviews } from "@/lib/chat-preview";
import { displayName, shortAgo } from "@/lib/lincin/model";
import { DesktopChats } from "@/components/lincin/desktop/DesktopChats";
import { openThread, useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";
import { useToast } from "@/lib/toast";

/**
 * Gesprekken (README §04).
 *
 * Eén kader met rijen van 72: links een vlak van 56 in de kleur van de
 * ander met zijn initiaal, dan de naam in serif en de tijd (rood als er
 * iets ongelezen ligt), de laatste regel gedempt, en rechts het aantal
 * ongelezen. Groepen zijn groen en vierkant. Lincs zonder gesprek staan
 * eronder met "Nog geen berichten".
 */

export default function ChatsScreen() {
  usePageTitle("Gesprekken");
  const desktop = useIsDesktop();
  if (desktop) return <DesktopChats />;
  return <ChatsMobile />;
}

function ChatsMobile() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const toast = useToast();
  const readMenu = useChatReadMenu();

  const chats = useQuery({
    queryKey: ["chats", myUserId],
    queryFn: () => listMyChats(myUserId),
    refetchOnWindowFocus: true,
  });
  const previews = useChatPreviews(chats.data, myUserId);
  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const list = useMemo(() => {
    const all = [...(chats.data ?? [])];
    all.sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
    return all;
  }, [chats.data]);

  const inChats = useMemo(
    () => new Set(list.filter((c) => c.type === "direct").flatMap((c) => c.members.map((m) => m.id))),
    [list],
  );
  const withoutChat = (friendships.data ?? []).filter((f) => f.status === "accepted" && !inChats.has(f.other.id));
  const unread = list.reduce((n, c) => n + (c.unread_count ?? 0), 0);

  async function openWith(friendId: string) {
    try {
      const id = await getOrCreateDirectChat(friendId);
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      openThread(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  /**
   * De rijen als gegevens, los van hun vorm. Magazine tekent ze als
   * spread; modern als tegels in een bento-rooster (2.2 §1). Dezelfde
   * gesprekken, dezelfde volgorde, dezelfde handelingen.
   */
  const rows: ChatRowData[] = [
    ...list.map((c) => {
      const isGroup = c.type === "group";
      const other = isGroup ? null : otherMember(c, myUserId);
      const pv = previews[c.id];
      let preview = "Nog geen berichten";
      if (pv) preview = pv.fromMe ? `${t.me}: ${pv.text}` : isGroup && pv.sender ? `${pv.sender}: ${pv.text}` : pv.text;
      const name = chatTitle(c, myUserId);
      return {
        key: c.id,
        name,
        initial: name.slice(0, 1).toUpperCase(),
        avatarUrl: chatAvatarUrl(c, myUserId),
        hue: (isGroup ? "green" : hueFor(other?.id)) as Hue,
        time: c.last_message_at ? shortAgo(c.last_message_at, t, lang) : "",
        preview,
        unread: c.unread_count ?? 0,
        onPress: () => openThread(c.id),
        menu: readMenu.rowProps(c.id, name, (c.unread_count ?? 0) > 0),
      };
    }),
    ...withoutChat.map((f) => {
      const name = displayName(f.other);
      return {
        key: f.id,
        name,
        initial: name.slice(0, 1).toUpperCase(),
        avatarUrl: f.other.avatar_url,
        hue: hueFor(f.other.id),
        time: "",
        preview: "Nog geen berichten",
        unread: 0,
        onPress: () => openWith(f.other.id),
      };
    }),
  ];

  if (spec.layout === "spread") {
    return (
      <ChatsMagazine
        rows={rows}
        unread={unread}
        scheme={scheme}
        t={t}
        state={chats.isLoading ? t.loading : chats.isError ? t.failed : rows.length === 0 ? t.noFriendsYet : null}
        footer={readMenu.sheet}
      />
    );
  }

  return (
    <ChatsModern
      rows={rows}
      unread={unread}
      scheme={scheme}
      t={t}
      state={chats.isLoading ? t.loading : chats.isError ? t.failed : rows.length === 0 ? t.noFriendsYet : null}
      footer={
        <>
          <DashedTile label="Nieuwe groep →" onPress={() => router.push("/group-create")} />
          {readMenu.sheet}
        </>
      }
    />
  );
}
