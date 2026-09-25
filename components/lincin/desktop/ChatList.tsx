import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { chatTitle, getOrCreateDirectChat, listMyChats, otherMember, type ChatWithMembers } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { useChatPreviews } from "@/lib/chat-preview";
import { ON_DARK, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { displayName, shortAgo } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { useChatReadMenu } from "../ChatReadMenu";

import { MonoLink } from "./Shell";

/**
 * De gesprekken als lijst (desktop-*-pages.dc.html, GESPREKKEN).
 *
 *   kleur     rijen van 84 met inktlijnen, links een blok van 64 in de kleur
 *             van de ander met de initiaal; naam in Archivo 900 smal, tijd
 *             in mono (rood als er iets ongelezen is), een rood blokje met
 *             het aantal. De open rij op het tweede vlak.
 *   magazine  een rug van 5 in de kleur van de ander, een omlijnde
 *             initiaal, de naam in serif 26 (cursief als hij open is), het
 *             aantal ongelezen als rode serif.
 *   modern    tegels met een ronde avatar van 52 en een teller erop.
 *
 * Daaronder de lincs zonder gesprek, en "Nieuwe groep →".
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
  const readMenu = useChatReadMenu();
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
  const spec = useThemeSpec();
  return (
    <ScrollView
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={spec.id === "kleur" ? undefined : { gap: 6 }}
      showsVerticalScrollIndicator={false}
    >
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
            initial={chatTitle(c, myUserId).slice(0, 1).toUpperCase()}
            fill={friendColor(chatHue(c, myUserId), scheme)}
            name={chatTitle(c, myUserId)}
            preview={preview}
            time={c.last_message_at ? shortAgo(c.last_message_at, t, lang) : ""}
            unread={n}
            active={full && c.id === activeId}
            onPress={() => onOpen(c.id)}
            menu={readMenu.rowProps(c.id, chatTitle(c, myUserId), n > 0)}
            onToggleRead={() => readMenu.toggle(c.id, n === 0)}
          />
        );
      })}
      {withoutChat.map((f) => (
        <Row
          key={f.id}
          fill={friendColor(hueFor(f.other.id), scheme)}
          initial={displayName(f.other).slice(0, 1).toUpperCase()}
          name={displayName(f.other)}
          preview="Nog geen berichten"
          time=""
          unread={0}
          active={false}
          onPress={() => openWith(f.other.id)}
        />
      ))}
      {full ? (
        <View style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
          <MonoLink label="Nieuwe groep →" active onPress={() => router.push("/group-create")} />
          <MonoLink label={`${t.newList} →`} active onPress={() => router.push("/list-compose")} />
        </View>
      ) : null}
      {readMenu.sheet}
    </ScrollView>
  );
}

function Row({
  fill,
  initial,
  name,
  preview,
  time,
  unread,
  active,
  onPress,
  menu,
  onToggleRead,
}: {
  fill: { fill: string; ink: string };
  initial: string;
  name: string;
  preview: string;
  time: string;
  unread: number;
  active: boolean;
  onPress: () => void;
  menu?: object;
  /** Bij hover: gelezen/ongelezen zetten zonder het gesprek te openen. */
  onToggleRead?: () => void;
}) {
  const t = useT();
  const spec = useThemeSpec();
  const [hover, setHoverNow] = useState(false);
  // Van de rij naar de knop ernaast is even "uit de rij": zonder deze korte
  // wacht verdween de knop net voor je erop klikte.
  const hoverOff = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHover = (on: boolean) => {
    if (hoverOff.current) clearTimeout(hoverOff.current);
    if (on) setHoverNow(true);
    else hoverOff.current = setTimeout(() => setHoverNow(false), 120);
  };
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const label = unread ? `${name}, ${unread} ${t.unread}` : name;
  const timeFg = unread ? color("red") : dim;
  // Ongelezen moet je zien zonder te zoeken: de laatste regel in inkt en
  // vet, en rechts een rood blok met het aantal — in élk thema hetzelfde.
  // Telegram: gelezen/ongelezen zonder het gesprek te openen. Op desktop bij
  // hover, waar de tijd staat; overal ook via lang drukken of rechtsklik.
  // Naast de rij en niet erin: een knop in een knop is op web geen geldige
  // HTML, en de klik kwam dan nergens aan.
  const pad = spec.id === "magazine" ? { top: 20, right: 22 } : { top: 16, right: 16 };
  const toggleBtn = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? t.markRead : t.markUnread}
      onPress={onToggleRead}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      hitSlop={8}
      style={{ position: "absolute", ...pad, display: hover && onToggleRead ? "flex" : "none" }}
    >
      <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: unread ? ink : color("red"), textDecorationLine: "underline" }]}>
        {unread ? `✓ ${t.markRead}` : `● ${t.markUnread}`}
      </Text>
    </Pressable>
  );
  const previewStyle = unread ? { ...sans(700), color: ink } : null;
  const badge = unread ? (
    <View style={{ flexShrink: 0, minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: spec.id === "kleur" ? 0 : 13, backgroundColor: color("red"), alignItems: "center", justifyContent: "center" }}>
      <Text style={[sans(800), { fontSize: 13, lineHeight: 16, color: ON_DARK }]}>{unread > 99 ? "99+" : unread}</Text>
    </View>
  ) : null;

  if (spec.id === "magazine") {
    return (
      <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={onPress}
        {...menu}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 18, paddingRight: 22, paddingLeft: 17, borderLeftWidth: 5, borderLeftColor: fill.fill, backgroundColor: active ? color("paper2") : "transparent" }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: fill.fill, alignItems: "center", justifyContent: "center" }}>
          <Text style={[serif(), { fontSize: 22, lineHeight: 26, color: fill.fill }]}>{initial}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <Text numberOfLines={1} style={[serif(active), { flexShrink: 1, fontSize: 26, lineHeight: 28, color: ink }]}>
              {name}
            </Text>
            {hover && onToggleRead ? null : time ? <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: timeFg }]}>{time}</Text> : null}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
            <Text numberOfLines={1} style={[sans(), { flex: 1, fontSize: 14, lineHeight: 18, color: color("inkSoft") }, previewStyle]}>
              {preview}
            </Text>
            {badge}
          </View>
        </View>
      </Pressable>
      {toggleBtn}
      </View>
    );
  }

  if (spec.id === "modern") {
    return (
      <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={onPress}
        {...menu}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 18, backgroundColor: active ? color("tile") : color("tile", "pill") }}
      >
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: fill.fill, alignItems: "center", justifyContent: "center" }}>
          <Text style={[sans(700), { fontSize: 16, lineHeight: 19, color: fill.ink }]}>{initial}</Text>
          {unread ? (
            <View style={{ position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 999, backgroundColor: color("red"), alignItems: "center", justifyContent: "center" }}>
              <Text style={[sans(800), { fontSize: 11, lineHeight: 13, color: ON_DARK }]}>{unread > 99 ? "99+" : unread}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <Text numberOfLines={1} style={[sans(500), { flexShrink: 1, fontSize: 18, lineHeight: 20, letterSpacing: -0.36, color: ink }]}>
              {name}
            </Text>
            {hover && onToggleRead ? null : time ? <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.26, color: timeFg }]}>{time}</Text> : null}
          </View>
          <Text numberOfLines={1} style={[sans(), { fontSize: 14, lineHeight: 18, color: dim }, previewStyle]}>
            {preview}
          </Text>
        </View>
      </Pressable>
      {toggleBtn}
      </View>
    );
  }

  return (
    <View>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      {...menu}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{ flexDirection: "row", alignItems: "stretch", minHeight: 84, borderBottomWidth: spec.border, borderBottomColor: ink, backgroundColor: active ? color("paper2") : "transparent" }}
    >
      <View style={{ width: 64, backgroundColor: fill.fill, borderRightWidth: spec.border, borderRightColor: ink, alignItems: "center", justifyContent: "center" }}>
        <Text style={[head(), { fontSize: 28, lineHeight: 30, color: fill.ink }]}>{initial}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 16, justifyContent: "center", gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <Text numberOfLines={1} style={[head(), { flexShrink: 1, fontSize: 20, lineHeight: 20, color: ink }]}>
            {name}
          </Text>
          {hover && onToggleRead ? null : time ? <Text style={[mono(600), { fontSize: 10, lineHeight: 13, letterSpacing: 0.6, color: timeFg }]}>{time}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <Text numberOfLines={1} style={[sans(), { flex: 1, fontSize: 14, lineHeight: 18, color: dim }, previewStyle]}>
            {preview}
          </Text>
          {badge}
        </View>
      </View>
    </Pressable>
    {toggleBtn}
    </View>
  );
}
