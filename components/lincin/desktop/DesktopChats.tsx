import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { chatTitle, getOrCreateDirectChat, listMyChats, otherMember } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { useChatPreviews } from "@/lib/chat-preview";
import { color, friendColor, hueFor, useScheme } from "@/lib/design/theme";
import { mono, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { openThread, usePanel } from "@/lib/lincin/desktop";
import { displayName, shortAgo } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * Gesprekken op desktop (Lincin Desktop.dc.html, CHATS): een lijst van
 * hoogstens 720 breed met een inktlijn erboven; per rij een kleurblok van
 * 10×40, de naam in serif 26, de tijd (rood bij ongelezen), de laatste
 * regel gedempt, en rechts "n ongelezen". De open rij staat op papier 2.
 * Een tik opent het gesprek in het paneel rechts.
 */
export function DesktopChats() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const toast = useToast();
  const previews = useChatPreviews();
  const panel = usePanel();
  const current = panel.kind === "thread" ? panel.chatId : null;

  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId), refetchOnWindowFocus: true });
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });
  const list = useMemo(() => {
    const all = [...(chats.data ?? [])];
    all.sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
    return all;
  }, [chats.data]);
  const inChats = useMemo(() => new Set(list.filter((c) => c.type === "direct").flatMap((c) => c.members.map((m) => m.id))), [list]);
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

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");

  const row = (key: string, fill: string, name: string, time: string, preview: string, n: number, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={n ? `${name}, ${n} ${t.unread}` : name}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: rule, backgroundColor: active ? color("paper2") : "transparent" }}
    >
      <View style={{ width: 10, height: 40, backgroundColor: fill }} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <Text numberOfLines={1} style={[serif(), { fontSize: 26, lineHeight: 27, letterSpacing: -0.26, color: ink, flexShrink: 1 }]}>
            {name}
          </Text>
          {time ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, color: n ? color("red") : dim }]}>{time}</Text> : null}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, color: dim }}>
          {preview}
        </Text>
      </View>
      {n > 0 ? (
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: color("red") }]}>
          {n} {t.unread}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <DesktopShell active="chats">
      <DesktopTitle right={<MonoLink label={`${unread} ${t.unread}`} on={false} />}>{t.chats}</DesktopTitle>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 22, paddingHorizontal: 48, paddingBottom: 40 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: ink, maxWidth: 720 }}>
          {list.map((c) => {
            const isGroup = c.type === "group";
            const other = isGroup ? null : otherMember(c, myUserId);
            const fc = friendColor(isGroup ? "green" : hueFor(other?.id), scheme);
            const pv = previews[c.id];
            const preview = pv ? (pv.fromMe ? `${t.me}: ${pv.text}` : isGroup && pv.sender ? `${pv.sender}: ${pv.text}` : pv.text) : "Nog geen berichten";
            return row(c.id, fc.fill, chatTitle(c, myUserId), c.last_message_at ? shortAgo(c.last_message_at, t, lang) : "", preview, c.unread_count ?? 0, c.id === current, () => openThread(c.id));
          })}
          {withoutChat.map((f) =>
            row(f.id, friendColor(hueFor(f.other.id), scheme).fill, displayName(f.other), "", "Nog geen berichten", 0, false, () => openWith(f.other.id)),
          )}
          <View style={{ paddingVertical: 18 }}>
            <MonoLink label="Nieuwe groep →" active onPress={() => router.push("/group-create")} />
          </View>
        </View>
      </ScrollView>
    </DesktopShell>
  );
}
