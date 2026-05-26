import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonListCard } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import {
  chatTitle,
  deleteChatForEveryone,
  getOrCreateDirectChat,
  hideChat,
  leaveChat,
  listMyChats,
  type ChatWithMembers,
} from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";

export default function ChatsScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();

  const [filter, setFilter] = useState("");
  // Twee-traps menu voor chat-acties:
  //   menuChat = chat waarvoor de eerste sheet (acties-lijst) open is
  //   confirmKind = welke destructieve actie wacht op bevestiging
  // We splitsen ze omdat hideChat geen confirm hoeft, maar leave/delete wel.
  const [menuChat, setMenuChat] = useState<ChatWithMembers | null>(null);
  const [confirmKind, setConfirmKind] = useState<
    null | { chat: ChatWithMembers; kind: "leave" | "delete" }
  >(null);

  const chats = useQuery({
    queryKey: ["chats", myUserId],
    queryFn: () => listMyChats(myUserId),
  });

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const accepted = (friendships.data ?? []).filter((f) => f.status === "accepted");
  const friendsInChats = new Set(
    (chats.data ?? [])
      .filter((c) => c.type === "direct")
      .flatMap((c) => c.members.map((m) => m.id))
  );
  const friendsWithoutChat = accepted.filter((f) => !friendsInChats.has(f.other.id));

  const filtered = useMemo(() => {
    const all = chats.data ?? [];
    if (!filter.trim()) return all;
    const q = filter.trim().toLowerCase();
    return all.filter((c) => chatTitle(c, myUserId).toLowerCase().includes(q));
  }, [chats.data, filter, myUserId]);

  async function openChatWith(friendUserId: string) {
    try {
      const chatId = await getOrCreateDirectChat(friendUserId);
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      router.push(`/chat/${chatId}`);
    } catch (e: any) {
      console.warn("openChatWith", e?.message ?? e);
    }
  }

  // Optimistisch wegtrekken uit de lijst: we filteren de chat eruit in de
  // cache zodat hij meteen verdwijnt, daarna doet de mutatie z'n werk.
  // Bij fout invalidate'n we de query zodat de echte server-state terugkomt.
  function removeFromCache(chatId: string) {
    qc.setQueryData<ChatWithMembers[]>(
      ["chats", myUserId],
      (old) => (old ?? []).filter((c) => c.id !== chatId)
    );
  }

  async function onHide(chat: ChatWithMembers) {
    removeFromCache(chat.id);
    try {
      await hideChat(chat.id, myUserId);
    } catch (e: any) {
      console.warn("hideChat", e?.message ?? e);
      qc.invalidateQueries({ queryKey: ["chats", myUserId] });
    }
  }

  async function onLeave(chat: ChatWithMembers) {
    removeFromCache(chat.id);
    try {
      await leaveChat(chat.id, myUserId);
    } catch (e: any) {
      console.warn("leaveChat", e?.message ?? e);
      qc.invalidateQueries({ queryKey: ["chats", myUserId] });
    }
  }

  async function onDeleteForEveryone(chat: ChatWithMembers) {
    removeFromCache(chat.id);
    try {
      await deleteChatForEveryone(chat.id);
    } catch (e: any) {
      console.warn("deleteChatForEveryone", e?.message ?? e);
      qc.invalidateQueries({ queryKey: ["chats", myUserId] });
    }
  }

  // Acties dynamisch op basis van chat-type. Voor groepen geen "verwijder
  // voor iedereen" (RLS blokkeert het server-side ook), maar wel "verlaat
  // groep". Voor 1:1 chats: verberg + verwijder voor iedereen.
  const menuActions = menuChat
    ? menuChat.type === "direct"
      ? [
          {
            label: "Verberg gesprek",
            icon: "eye-off-outline" as const,
            onPress: () => onHide(menuChat),
          },
          {
            label: "Verwijder gesprek voor iedereen",
            icon: "trash-outline" as const,
            destructive: true,
            onPress: () =>
              setConfirmKind({ chat: menuChat, kind: "delete" }),
          },
        ]
      : [
          {
            label: "Verberg gesprek",
            icon: "eye-off-outline" as const,
            onPress: () => onHide(menuChat),
          },
          {
            label: "Verlaat groep",
            icon: "exit-outline" as const,
            destructive: true,
            onPress: () => setConfirmKind({ chat: menuChat, kind: "leave" }),
          },
        ]
    : [];

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Text className="text-3xl font-bold tracking-tight text-cream mb-1">
              Chats
            </Text>
            <Text className="text-cream-soft text-base mb-5">
              Volledig end-to-end versleuteld.
            </Text>

            {/* Search pill */}
            <View className="flex-row items-center gap-2 mb-5">
              <View className="flex-1 flex-row items-center bg-paper-light rounded-full px-4 border border-line-paper">
                <Ionicons name="search" color="#8A7E6C" size={18} />
                <TextInput
                  value={filter}
                  onChangeText={setFilter}
                  placeholder="Filter chats…"
                  placeholderTextColor="#8A7E6C"
                  className="flex-1 text-ink text-base py-3 pl-2"
                />
                {filter.length > 0 && (
                  <Pressable onPress={() => setFilter("")} className="p-1">
                    <Ionicons name="close-circle" color="#8A7E6C" size={18} />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={() => router.push("/group-create")}
                className="bg-ink active:bg-ink-soft rounded-full w-11 h-11 items-center justify-center"
              >
                <Ionicons name="people" color="#F5E8D3" size={18} />
              </Pressable>
            </View>

            {/* Friends quick row */}
            {friendsWithoutChat.length > 0 && (
              <View className="mb-5">
                <Text className="text-xs uppercase tracking-wider text-cream-muted mb-3 px-1">
                  Start een chat
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 20, gap: 12 }}
                >
                  {friendsWithoutChat.map((f) => (
                    <Pressable
                      key={f.id}
                      onPress={() => openChatWith(f.other.id)}
                      className="items-center w-16"
                    >
                      <Avatar
                        name={f.other.display_name ?? f.other.username}
                        size="lg"
                        tint="warm"
                      />
                      <Text
                        className="text-cream-soft text-xs mt-2 text-center"
                        numberOfLines={1}
                      >
                        {f.other.display_name ?? f.other.username}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text className="text-xs uppercase tracking-wider text-cream-muted mb-3 px-1">
              Gesprekken
            </Text>

            {chats.isLoading && <SkeletonListCard rows={3} />}
          </View>
        }
        ListEmptyComponent={
          chats.isLoading ? null : (
            <View className="bg-paper-soft rounded-3xl p-6 items-center">
              <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="chatbubbles-outline" color="#1A1714" size={24} />
              </View>
              <Text className="text-ink font-semibold text-base mb-1">
                Nog geen gesprekken
              </Text>
              <Text className="text-ink-soft text-sm text-center">
                Start een chat met een vriend hierboven, of deel je link vanuit Profiel.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <ChatRow
            chat={item}
            myUserId={myUserId}
            onPress={() => router.push(`/chat/${item.id}`)}
            onLongPress={() => setMenuChat(item)}
            onMenuPress={() => setMenuChat(item)}
            isFirst={index === 0}
            isLast={index === filtered.length - 1}
          />
        )}
      />
      </ScreenContainer>

      {/* Acties-menu voor een specifieke chat (long-press of 3-dots). */}
      <ActionSheet
        visible={!!menuChat}
        onClose={() => setMenuChat(null)}
        title={menuChat ? chatTitle(menuChat, myUserId) : undefined}
        actions={menuActions}
      />

      {/* Bevestigings-sheet voor destructieve acties — verlaat-groep of
          verwijder-voor-iedereen. Aparte sheet zodat de eerste vlot dichtgaat. */}
      <ActionSheet
        visible={!!confirmKind}
        onClose={() => setConfirmKind(null)}
        title={
          confirmKind?.kind === "delete"
            ? "Verwijder dit gesprek voor iedereen?"
            : confirmKind?.kind === "leave"
            ? "Deze groep verlaten?"
            : undefined
        }
        actions={
          confirmKind?.kind === "delete"
            ? [
                {
                  label: "Verwijder definitief",
                  icon: "trash-outline",
                  destructive: true,
                  onPress: () => onDeleteForEveryone(confirmKind.chat),
                },
              ]
            : confirmKind?.kind === "leave"
            ? [
                {
                  label: "Verlaat groep",
                  icon: "exit-outline",
                  destructive: true,
                  onPress: () => onLeave(confirmKind.chat),
                },
              ]
            : []
        }
      />
    </SafeAreaView>
  );
}

function ChatRow({
  chat,
  myUserId,
  onPress,
  onLongPress,
  onMenuPress,
  isFirst,
  isLast,
}: {
  chat: ChatWithMembers;
  myUserId: string;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const title = chatTitle(chat, myUserId);
  const baseSubtitle =
    chat.type === "direct"
      ? "Direct • E2E"
      : `Groep • ${chat.members.length} leden`;
  const lastAt = chat.last_message_at;
  const relTime = lastAt ? relativeTime(lastAt) : null;
  const unread = chat.unread_count;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`flex-row items-center bg-paper-soft active:bg-paper px-4 py-3.5 ${
        isFirst ? "rounded-t-2xl" : ""
      } ${isLast ? "rounded-b-2xl" : ""} ${
        !isLast ? "border-b border-line-paper/60" : ""
      }`}
    >
      {/* Avatar is geen aparte tap-target meer — op mobile vrat de hitSlop
          regelmatig de rij-tap op zodat je naar het profiel ging i.p.v. de
          chat. Toegang tot het profiel zit nu via de header binnen de chat
          (tap op de naam → /user/[username]). */}
      <Avatar name={title} size="md" tint="warm" />
      <View className="flex-1 ml-3 mr-2">
        <View className="flex-row items-center">
          <Text
            className={`flex-1 ${
              unread > 0 ? "text-ink font-bold" : "text-ink font-semibold"
            }`}
            numberOfLines={1}
          >
            {title}
          </Text>
          {relTime && (
            <Text
              className={`text-xs ml-2 ${
                unread > 0 ? "text-flame font-semibold" : "text-ink-muted"
              }`}
            >
              {relTime}
            </Text>
          )}
        </View>
        <Text
          className={`text-xs mt-0.5 ${
            unread > 0 ? "text-ink font-medium" : "text-ink-muted"
          }`}
          numberOfLines={1}
        >
          {baseSubtitle}
        </Text>
      </View>
      {unread > 0 ? (
        <View className="bg-flame rounded-full min-w-[22px] h-[22px] px-1.5 items-center justify-center mr-1">
          <Text className="text-cream text-[11px] font-bold">
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      ) : null}
      {/* 3-dots actie-knop — opent verberg/verlaat/verwijder menu.
          Eigen Pressable met hitSlop, NIET ingebed in de row-onPress: door
          de visuele scheiding (rechts, klein icoon) en kleine hitbox gaan
          row-taps NIET per ongeluk hierheen — alleen wie écht op de drie
          puntjes mikt opent het menu. */}
      <Pressable
        onPress={onMenuPress}
        hitSlop={10}
        className="w-9 h-9 items-center justify-center -mr-2"
      >
        <Ionicons name="ellipsis-horizontal" color="#8A7E6C" size={18} />
      </Pressable>
    </Pressable>
  );
}

/**
 * Korte relatieve tijdsaanduiding voor chatlijst, zoals "5m" / "2u" / "3d".
 * Voor langer dan 7d tonen we de datum, zoals chat-apps doen.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "nu";
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}u`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
  });
}
