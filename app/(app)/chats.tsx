import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { LincinScreen, vfade } from "@/components/lincin/Chrome";
import { DashedTile } from "@/components/lincin/modern/Bento";
import { ChatsModern, type ChatRowData } from "@/components/lincin/modern/ChatsModern";
import { ChatsMagazine } from "@/components/lincin/magazine/Pages";
import { UnreadBanner } from "@/components/lincin/UnreadBanner";
import { Body, BORDER, DashedCard, GUTTER, Head, Mono, Serif, line } from "@/components/lincin/ui";
import { chatTitle, getOrCreateDirectChat, listMyChats, otherMember, type ChatWithMembers } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
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
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const toast = useToast();
  const previews = useChatPreviews();

  const chats = useQuery({
    queryKey: ["chats", myUserId],
    queryFn: () => listMyChats(myUserId),
    refetchOnWindowFocus: true,
  });
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
  const unreadChats = list.filter((c) => (c.unread_count ?? 0) > 0);
  const banner = (style?: object | null) => (
    <UnreadBanner messages={unread} chats={unreadChats.length} onPress={() => unreadChats[0] && openThread(unreadChats[0].id)} style={style} />
  );

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
   * De rijen als gegevens, los van hun vorm. Kleur tekent ze als lijst in
   * één kader; modern als tegels in een bento-rooster (2.2 §1). Dezelfde
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
        hue: (isGroup ? "green" : hueFor(other?.id)) as Hue,
        time: c.last_message_at ? shortAgo(c.last_message_at, t, lang) : "",
        preview,
        unread: c.unread_count ?? 0,
        onPress: () => openThread(c.id),
      };
    }),
    ...withoutChat.map((f) => {
      const name = displayName(f.other);
      return {
        key: f.id,
        name,
        initial: name.slice(0, 1).toUpperCase(),
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
        banner={banner({ marginHorizontal: 6, marginBottom: 6 })}
        scheme={scheme}
        t={t}
        state={chats.isLoading ? t.loading : chats.isError ? t.failed : rows.length === 0 ? t.noFriendsYet : null}
      />
    );
  }

  if (spec.layout === "bento") {
    return (
      <ChatsModern
        rows={rows}
        unread={unread}
        banner={banner()}
        scheme={scheme}
        t={t}
        state={chats.isLoading ? t.loading : chats.isError ? t.failed : rows.length === 0 ? t.noFriendsYet : null}
        footer={<DashedTile label="Nieuwe groep →" onPress={() => router.push("/group-create")} />}
      />
    );
  }

  function rowFor(c: ChatWithMembers) {
    const isGroup = c.type === "group";
    const other = isGroup ? null : otherMember(c, myUserId);
    const hue: Hue = isGroup ? "green" : hueFor(other?.id);
    const fc = friendColor(hue, scheme);
    const name = chatTitle(c, myUserId);
    const pv = previews[c.id];
    let preview = "Nog geen berichten";
    if (pv) preview = pv.fromMe ? `${t.me}: ${pv.text}` : isGroup && pv.sender ? `${pv.sender}: ${pv.text}` : pv.text;
    const time = c.last_message_at ? shortAgo(c.last_message_at, t, lang) : "";
    return (
      <Row
        key={c.id}
        initial={name.slice(0, 1).toUpperCase()}
        fill={fc.fill}
        ink={fc.ink}
        square={isGroup}
        name={name}
        time={time}
        preview={preview}
        unread={c.unread_count ?? 0}
        onPress={() => openThread(c.id)}
      />
    );
  }

  return (
    <LincinScreen tab="chats" counter={t.tabChats}>
      <View style={{ paddingTop: 8, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <Serif variant="pageTitle">{t.chats}</Serif>
        <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
          {unread} {t.unread}
        </Mono>
      </View>
      {banner({ marginTop: 14, marginHorizontal: GUTTER })}
      {/* Eén kader dat tot de onderrand loopt (prototype §04: het scrollvlak
          zelf draagt het kader, zonder onderlijn); de rijen erin. */}
      <ScrollView
        style={[{ flex: 1, marginTop: 14, marginHorizontal: GUTTER, borderWidth: BORDER, borderBottomWidth: 0, borderColor: line(), backgroundColor: color("paper") }, vfade()]}
        showsVerticalScrollIndicator={false}
      >
        {chats.isLoading ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
            {t.loading}
          </Mono>
        ) : chats.isError ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
            {t.failed}
          </Mono>
        ) : list.length + withoutChat.length === 0 ? (
          <DashedCard style={{ margin: 12 }} onPress={() => router.push("/friends")}>{t.noFriendsYet} →</DashedCard>
        ) : (
          <>
            {list.map(rowFor)}
            {withoutChat.map((f) => {
              const fc = friendColor(hueFor(f.other.id), scheme);
              const name = displayName(f.other);
              return (
                <Row
                  key={f.id}
                  initial={name.slice(0, 1).toUpperCase()}
                  fill={fc.fill}
                  ink={fc.ink}
                  name={name}
                  time=""
                  preview="Nog geen berichten"
                  unread={0}
                  onPress={() => openWith(f.other.id)}
                />
              );
            })}
          </>
        )}
        <DashedCard style={{ margin: 12 }} onPress={() => router.push("/group-create")}>Nieuwe groep →</DashedCard>
        <DashedCard style={{ marginHorizontal: 12, marginBottom: 12 }} onPress={() => router.push("/list-compose")}>{`${t.newList} →`}</DashedCard>
      </ScrollView>
    </LincinScreen>
  );
}

function Row({
  initial,
  fill,
  ink,
  square = false,
  name,
  time,
  preview,
  unread,
  onPress,
}: {
  initial: string;
  fill: string;
  ink: string;
  square?: boolean;
  name: string;
  time: string;
  preview: string;
  unread: number;
  onPress: () => void;
}) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `${name}, ${unread} ${t.unread}` : name}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 72,
        flexDirection: "row",
        alignItems: "stretch",
        borderBottomWidth: BORDER,
        borderBottomColor: line(),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 56,
          backgroundColor: fill,
          alignItems: "center",
          justifyContent: "center",
          borderRightWidth: BORDER,
          borderRightColor: line(),
          margin: square ? 0 : 0,
        }}
      >
        <Head variant="numeralTiny" color={ink}>
          {initial}
        </Head>
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, justifyContent: "center", gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <Serif variant="name" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
            {name}
          </Serif>
          {time ? (
            <Mono variant="micro" tone={unread ? "red" : "dim"} style={{ textTransform: "none" }}>
              {time}
            </Mono>
          ) : null}
        </View>
        <Body small tone={unread ? undefined : "dim"} numberOfLines={1} style={{ lineHeight: 17, fontWeight: unread ? "700" : undefined }}>
          {preview}
        </Body>
      </View>
      {unread > 0 ? (
        <View style={{ alignSelf: "center", marginRight: 12, minWidth: 26, height: 26, paddingHorizontal: 7, backgroundColor: color("red"), alignItems: "center", justifyContent: "center" }}>
          <Mono variant="action" style={{ color: "#F5F1E8", letterSpacing: 0 }}>
            {unread}
          </Mono>
        </View>
      ) : null}
    </Pressable>
  );
}
