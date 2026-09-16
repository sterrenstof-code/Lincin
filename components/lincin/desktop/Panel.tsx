import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View, type TextStyle } from "react-native";

import ChatDetail from "@/app/chat/[id]";
import PostScreen from "@/app/post/[id]";
import UserProfileScreen from "@/app/user/[username]";
import { useFeedCard } from "@/components/lincin/feed/useFeed";
import { chatTitle, listMyChats, otherMember } from "@/lib/api/chats";
import { getPost } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useScheme } from "@/lib/design/theme";
import { mono, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { closePanel, openProfile, openThread, pickThread, usePanel } from "@/lib/lincin/desktop";
import { displayName } from "@/lib/lincin/model";

/**
 * Het paneel rechts (Lincin Desktop.dc.html, "RIGHT PANEL"): in rust het
 * gesprek — met bovenaan een strook van alle gesprekken als tabs — en
 * daaroverheen, met een × om te sluiten, een bladzijde of een profiel.
 *
 * De inhoud is het gewone scherm in `embedded`-stand: dezelfde
 * bladzijde, hetzelfde gesprek (versleuteling en al), alleen zonder de
 * omlijsting van een telefoon.
 */
export function Panel() {
  const panel = usePanel();
  const t = useT();
  const ink = color("ink");

  if (panel.kind === "post" || panel.kind === "profile") {
    return (
      <View style={{ flex: 1, minHeight: 0 }}>
        <View style={{ height: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: ink }}>
          {panel.kind === "post" ? <PostLabel id={panel.id} /> : <Text style={labelStyle()}>{t.scrProfile}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
            onPress={closePanel}
            style={{ width: 32, height: 32, borderWidth: 1, borderColor: ink, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 16, lineHeight: 18, color: ink }}>×</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, minHeight: 0 }}>
          {panel.kind === "post" ? (
            <PostScreen key={panel.id} id={panel.id} embedded />
          ) : (
            <UserProfileScreen key={panel.username} username={panel.username} embedded />
          )}
        </View>
      </View>
    );
  }
  return <ThreadPanel chatId={panel.chatId} />;
}

/** De kop van het paneel in mono 10, gedempt — bij het bouwen gelezen, want de kleur wisselt mee met het thema. */
const labelStyle = (): TextStyle => ({ ...mono(500), fontSize: 10, lineHeight: 13, letterSpacing: 0.6, textTransform: "uppercase", color: color("ink", "inkDim") });

/** "BIJDRAGE № 07 · Naam" — nummer uit de feed, naam uit de feed of anders uit de bijdrage zelf. */
function PostLabel({ id }: { id: string }) {
  const t = useT();
  const { card, number } = useFeedCard(id);
  const post = useQuery({ queryKey: ["post", id], queryFn: () => getPost(id), enabled: !card, staleTime: 30_000 });
  const by = card?.authorName ?? (post.data ? displayName(post.data.author) : null);
  return (
    <Text numberOfLines={1} style={[labelStyle(), { flexShrink: 1 }]}>
      {t.post}
      {number ? ` № ${number}` : ""}
      {by ? ` · ${by}` : ""}
    </Text>
  );
}

function ThreadPanel({ chatId }: { chatId: string | null }) {
  const t = useT();
  const scheme = useScheme();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId), enabled: !!session, staleTime: 30_000 });
  const list = [...(chats.data ?? [])].sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
  const current = pickThread(chatId, list);
  const ink = color("ink");
  const dim = color("ink", "inkDim");

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: ink }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", gap: 18, paddingHorizontal: 18, height: 58 }}>
          {list.map((c) => {
            const isGroup = c.type === "group";
            const fc = friendColor(isGroup ? "green" : hueFor(otherMember(c, myUserId)?.id), scheme);
            const on = c.id === current;
            const n = c.unread_count ?? 0;
            return (
              <Pressable key={c.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => openThread(c.id)} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 8, height: 8, backgroundColor: fc.fill }} />
                <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: on ? ink : dim, textDecorationLine: on ? "underline" : "none" }]}>
                  {chatTitle(c, myUserId)}
                  {n ? <Text style={{ color: color("red") }}> ·{n}</Text> : null}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {current ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <ThreadHead chat={list.find((c) => c.id === current)} myUserId={myUserId} />
          <ChatDetail key={current} id={current} embedded />
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase", color: dim }]}>{t.noFriendsYet}</Text>
        </View>
      )}
    </View>
  );
}

/** Naam en ondertitel boven het gesprek, met "Profiel →" rechts. */
function ThreadHead({ chat, myUserId }: { chat: ReturnType<typeof listMyChats> extends Promise<(infer C)[]> ? C | undefined : never; myUserId: string }) {
  const t = useT();
  if (!chat) return null;
  const isGroup = chat.type === "group";
  const other = isGroup ? null : otherMember(chat, myUserId);
  const name = chatTitle(chat, myUserId);
  const sub = isGroup ? `${t.group} · ${chat.members.length} lincs` : t.scrThread;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: color("ink", "postRule") }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[serif(), { fontSize: 22, lineHeight: 23, color: color("ink") }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[mono(500), { fontSize: 10, lineHeight: 13, color: color("ink", "inkDim"), marginTop: 3, textTransform: "lowercase" }]}>
          {sub}
        </Text>
      </View>
      {other?.username ? (
        <Pressable accessibilityRole="button" onPress={() => openProfile(other.username)}>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink"), textDecorationLine: "underline" }]}>
            {t.scrProfile} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
