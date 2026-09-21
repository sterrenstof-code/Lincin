import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { chatTitle, getOrCreateDirectChat, listMyChats, otherMember, type ChatWithMembers } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { useChatPreviews } from "@/lib/chat-preview";
import { color, friendColor, hueFor, listSeam, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { capf, mono, sans } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { displayName, shortAgo } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { MonoLink } from "./Shell";

/**
 * De gesprekken als lijst (Lincin Desktop.dc.html, GESPREKKENPANEEL en
 * GESPREKKEN): een kop van 56 met "Gesprekken" en "n ongelezen" in rood,
 * dan rijen met een kleurbalk van 10×38, de naam in serif 19, de laatste
 * regel in 12.5 gedempt, en rechts het aantal ongelezen (rood) of de tijd.
 *
 * Rechts van de feed is het een wegwijzer — een tik opent het gesprek op
 * volle breedte. Op Gesprekken zelf staat de open rij in de kleur van de
 * ander, met een inktbalk; daar komen ook de lincs zonder gesprek en
 * "Nieuwe groep →" onderaan.
 */

export function useSortedChats() {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId), enabled: !!session, refetchOnWindowFocus: true });
  const list = useMemo(() => {
    const all = [...(chats.data ?? [])];
    all.sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
    return all;
  }, [chats.data]);
  return { myUserId, chats, list };
}

export function chatHue(c: ChatWithMembers, myUserId: string) {
  return c.type === "group" ? "green" : hueFor(otherMember(c, myUserId)?.id);
}

export function ChatListHead({ link = false }: { link?: boolean }) {
  const t = useT();
  const router = useRouter();
  const spec = useThemeSpec();
  const { list } = useSortedChats();
  const unread = list.reduce((n, c) => n + (c.unread_count ?? 0), 0);
  return (
    <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: spec.border, borderBottomColor: color("ink") }}>
      {link ? (
        <MonoLink label={t.chats} active onPress={() => router.push("/chats")} />
      ) : (
        <MonoLink label={t.chats} />
      )}
      <MonoLink label={`${unread} ${t.unread}`} tone={color("red")} />
    </View>
  );
}

export function ChatList({ activeId, onOpen, full = false }: { activeId: string | null; onOpen: (chatId: string) => void; full?: boolean }) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const previews = useChatPreviews();
  const { myUserId, chats, list } = useSortedChats();
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId), enabled: full });
  const inChats = useMemo(() => new Set(list.filter((c) => c.type === "direct").flatMap((c) => c.members.map((m) => m.id))), [list]);
  const withoutChat = full ? (friendships.data ?? []).filter((f) => f.status === "accepted" && !inChats.has(f.other.id)) : [];

  async function openWith(friendId: string) {
    try {
      const id = await getOrCreateDirectChat(friendId);
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      onOpen(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  const dim = color("ink", "inkDim");
  return (
    <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator={false}>
      {chats.isLoading ? (
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim, padding: 16 }]}>{t.loading}</Text>
      ) : null}
      {list.map((c) => {
        const pv = previews[c.id];
        const preview = pv ? (pv.fromMe ? `${t.me}: ${pv.text}` : c.type === "group" && pv.sender ? `${pv.sender}: ${pv.text}` : pv.text) : "Nog geen berichten";
        const n = c.unread_count ?? 0;
        return (
          <Row
            key={c.id}
            fill={friendColor(chatHue(c, myUserId), scheme)}
            name={chatTitle(c, myUserId)}
            preview={preview}
            right={n ? String(n) : c.last_message_at ? shortAgo(c.last_message_at, t, lang) : ""}
            unread={n > 0}
            active={full && c.id === activeId}
            onPress={() => onOpen(c.id)}
          />
        );
      })}
      {withoutChat.map((f) => (
        <Row
          key={f.id}
          fill={friendColor(hueFor(f.other.id), scheme)}
          name={displayName(f.other)}
          preview="Nog geen berichten"
          right=""
          unread={false}
          active={false}
          onPress={() => openWith(f.other.id)}
        />
      ))}
      {full ? (
        <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
          <MonoLink label="Nieuwe groep →" active onPress={() => router.push("/group-create")} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function Row({
  fill,
  name,
  preview,
  right,
  unread,
  active,
  onPress,
}: {
  fill: { fill: string; ink: string };
  name: string;
  preview: string;
  right: string;
  unread: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const spec = useThemeSpec();
  const ink = active ? fill.ink : color("ink");
  const dim = active ? fill.ink : color("ink", "inkDim");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={unread ? `${name}, ${right} ${t.unread}` : name}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: active ? fill.fill : "transparent",
        // Kleur en magazine zetten een haarlijn tussen twee rijen; modern
        // een naad van 6 met een ronding en géén lijn (2.2 §9).
        borderRadius: spec.cardRadius,
        ...listSeam(),
        ...(spec.listGap > 1 ? { marginHorizontal: spec.gap } : null),
      }}
    >
      {/* Op de open rij is de balk inkt (licht) of papier (donker), zoals het
          prototype. De kleurrug volgt de ronding van de rij. */}
      <View
        style={{
          width: 10,
          height: 38,
          borderRadius: spec.cardRadius ? 5 : 0,
          backgroundColor: active ? color("ink") : fill.fill,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[capf(false, true), { fontSize: 19, lineHeight: 21, color: ink }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[sans(), { fontSize: 12.5, lineHeight: 17, color: dim }]}>
          {preview}
        </Text>
      </View>
      {right ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: active ? fill.ink : unread ? color("red") : color("ink", "inkDim") }]}>{right}</Text> : null}
    </Pressable>
  );
}
