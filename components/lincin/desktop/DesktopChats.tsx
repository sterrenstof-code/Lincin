import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { ChatDetail } from "@/app/chat/[id]";
import { chatTitle, otherMember } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { color, friendColor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { capf, mono } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { LIST_W, pickThread } from "@/lib/lincin/desktop";

import { chatHue, ChatList, ChatListHead, useSortedChats } from "./ChatList";
import { DesktopShell, MonoLink } from "./Shell";

/**
 * Gesprekken op volle breedte (Lincin Desktop.dc.html, GESPREKKEN — model
 * 3e). De rail klapt in tot 64; links de lijst van 280, rechts het gesprek
 * over de rest: een kop van 56 met de naam in serif 26, "linc sinds …" of
 * "groep · n lincs", en PROFIEL →; daaronder het gesprek zelf — dezelfde
 * draad als op de telefoon, versleuteling en al, met de vermelde
 * bijdragen bovenaan en de invoer onderaan.
 *
 * `/chats` kiest zelf (het laatste ongelezen, anders het laatste);
 * `/chat/[id]` toont dat gesprek. Een andere rij kiezen verandert de URL.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export function DesktopChats({ chatId }: { chatId?: string | null }) {
  const router = useRouter();
  const scheme = useScheme();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const spec = useThemeSpec();
  const { myUserId, list, chats } = useSortedChats();
  const current = pickThread(chatId ?? null, list);
  const chat = list.find((c) => c.id === current) ?? null;
  const tint = chat ? friendColor(chatHue(chat, myUserId), scheme).fill : null;

  const open = (id: string) => {
    if (id === current) return;
    if (chatId) router.setParams({ id });
    else router.push(`/chat/${id}` as never);
  };

  return (
    <DesktopShell active="chats" mode="full" tint={tint}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
        <View style={{ width: LIST_W, minHeight: 0, borderRightWidth: spec.border, borderRightColor: color("ink") }}>
          <ChatListHead />
          <ChatList activeId={current} onOpen={open} full />
        </View>
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {current ? (
            <>
              <ThreadHead chatId={current} />
              <View style={{ flex: 1, minHeight: 0 }}>
                <ChatDetail key={current} id={current} embedded />
              </View>
            </>
          ) : chats.isLoading ? null : (
            <EmptyThread />
          )}
        </View>
      </View>
    </DesktopShell>
  );
}

function EmptyThread() {
  const t = useT();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{t.noFriendsYet}</Text>
    </View>
  );
}

/** Naam, ondertitel en "Profiel →" boven het gesprek. */
function ThreadHead({ chatId }: { chatId: string }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const spec = useThemeSpec();
  const { myUserId, list } = useSortedChats();
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });
  const chat = list.find((c) => c.id === chatId);
  if (!chat) return null;
  const isGroup = chat.type === "group";
  const other = isGroup ? null : otherMember(chat, myUserId);
  const since = other ? (friendships.data ?? []).find((f) => f.other.id === other.id && f.status === "accepted")?.accepted_at : null;
  const sub = isGroup
    ? `${t.group} · ${chat.members.length} lincs`
    : since
      ? `${t.lincSince} ${new Date(since).toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "")} '${String(new Date(since).getFullYear()).slice(2)}`
      : "";
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingHorizontal: 24, borderBottomWidth: spec.border, borderBottomColor: color("ink") }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12, flexShrink: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[capf(false, true), { fontSize: 26, lineHeight: 28, color: color("ink"), flexShrink: 1 }]}>
          {chatTitle(chat, myUserId)}
        </Text>
        {sub ? <MonoLink label={sub} on={false} /> : null}
      </View>
      {isGroup ? (
        <MonoLink label={`${t.scrProfile} →`} active onPress={() => router.push(`/group/${chat.id}` as never)} />
      ) : other?.username ? (
        <MonoLink label={`${t.scrProfile} →`} active onPress={() => router.push(`/user/${other.username}` as never)} />
      ) : null}
    </View>
  );
}
