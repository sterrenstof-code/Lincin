import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { PageHead, RubricHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { SkeletonListCard } from "@/components/Skeleton";
import { useToast } from "@/lib/toast";
import {
  CONTROL_H,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flame,
  flameDeep,
  space,
} from "@/lib/design/type";
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
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();
  const toast = useToast();

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
    } catch {
      toast.error("Het gesprek kon niet geopend worden.", {
        action: { label: "Opnieuw", onPress: () => openChatWith(friendUserId) },
      });
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

  /**
   * Eén weg terug voor alle drie de acties hieronder.
   *
   * De rij is al uit de lijst getrokken voordat de server iets zei. Faalt
   * de mutatie, dan zet de invalidatie hem terug — en dat gebeurde eerder
   * zonder één woord: je drukt op "verwijder definitief", er beweegt iets,
   * en dan staat het gesprek er weer. Een optimistische update is een
   * belofte; wordt die teruggedraaid, dan hoort er te staan dát hij
   * teruggedraaid is.
   */
  function rollback(message: string, retry: () => void) {
    qc.invalidateQueries({ queryKey: ["chats", myUserId] });
    toast.error(message, { action: { label: "Opnieuw", onPress: retry } });
  }

  async function onHide(chat: ChatWithMembers) {
    removeFromCache(chat.id);
    try {
      await hideChat(chat.id, myUserId);
    } catch {
      rollback("Het gesprek kon niet verborgen worden.", () => onHide(chat));
    }
  }

  async function onLeave(chat: ChatWithMembers) {
    removeFromCache(chat.id);
    try {
      await leaveChat(chat.id, myUserId);
    } catch {
      rollback("Je kon de groep niet verlaten.", () => onLeave(chat));
    }
  }

  async function onDeleteForEveryone(chat: ChatWithMembers) {
    removeFromCache(chat.id);
    try {
      await deleteChatForEveryone(chat.id);
    } catch {
      rollback("Het gesprek kon niet verwijderd worden.", () =>
        onDeleteForEveryone(chat)
      );
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
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* Eén scroller voor de hele pagina, net als op de andere tabs.
          De chatlijst is een gewone map i.p.v. een FlatList: een
          VirtualizedList binnen een ScrollView nesten mag niet, en de
          lijst is begrensd genoeg om virtualisatie niet te missen. */}
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        contentStyle={{ paddingVertical: 20, paddingBottom: 40 }}
      >
        <View>
          <PageHead
            kicker="Onder vier ogen"
            title="Chats"
            intro="Volledig end-to-end versleuteld — ook wij lezen niet mee."
            wide={wide}
            gap={space.xxl}
          />

          {/* Filterveld en de knop ernaast als één rij van 44 hoog
              (CONTROL_H). Het veld had een eigen vulling; op een blad
              waar verder niets gevuld is leest dat als een doos in
              plaats van als een regel om in te typen (§4). */}
          <View
            style={{ flexDirection: "row", gap: space.sm, marginBottom: space.xxl }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                height: CONTROL_H,
                paddingHorizontal: space.md,
                borderWidth: FEED_BORDER,
                borderColor: feed.ink,
              }}
            >
              <Ionicons name="search" color={feed.inkDim} size={17} />
              <TextInput
                value={filter}
                onChangeText={setFilter}
                placeholder="Filter gesprekken"
                placeholderTextColor={feed.inkDim}
                accessibilityLabel="Gesprekken filteren"
                style={[
                  feedType.body,
                  {
                    flex: 1,
                    color: feed.ink,
                    paddingLeft: space.sm,
                    ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null),
                  },
                ]}
              />
              {filter.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Filter wissen"
                  onPress={() => setFilter("")}
                  style={{
                    // Was `hitSlop={12}`. Het kruisje heeft geen eigen doos —
                    // het ís het glyph van 18 — en zijn buur is de `flex: 1`
                    // TextInput, zonder tussenruimte. Twaalf punten slop
                    // liggen dan over het einde van je eigen tekst, en omdat
                    // dit de latere broer is wint hij het raken: je tikt om
                    // je cursor te zetten en je filter is weg.
                    // Een eigen kolom van 44 hoog raakt niemand anders.
                    height: CONTROL_H,
                    paddingLeft: space.sm,
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close-circle" color={feed.inkDim} size={18} />
                </Pressable>
              )}
            </View>
            {/* Omlijnd en niet gevuld: de gevulde knop op dit scherm is de
                oranje plus in de kopbalk, en er is er hoogstens één (§4). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nieuwe groep maken"
              onPress={() => router.push("/group-create")}
              style={({ pressed }) => ({
                width: CONTROL_H,
                height: CONTROL_H,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: FEED_BORDER,
                borderColor: feed.ink,
                backgroundColor: pressed ? feed.panel : "transparent",
              })}
            >
              <Ionicons name="people" color={feed.ink} size={18} />
            </Pressable>
          </View>

          {/* Friends quick row */}
          {friendsWithoutChat.length > 0 && (
            <View style={{ marginBottom: space.xxl }}>
              <RubricHead label="Start een gesprek" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: space.xl, gap: space.md }}
              >
                {friendsWithoutChat.map((f) => (
                  <Pressable
                    key={f.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Gesprek beginnen met ${
                      f.other.display_name ?? f.other.username
                    }`}
                    onPress={() => openChatWith(f.other.id)}
                    className="items-center w-16"
                  >
                    <Avatar
                      name={f.other.display_name ?? f.other.username}
                      size="lg"
                      tint="warm"
                    />
                    <Text
                      style={[
                        feedType.label,
                        { color: feed.inkDim, marginTop: space.sm, textAlign: "center" },
                      ]}
                      numberOfLines={1}
                    >
                      {f.other.display_name ?? f.other.username}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <RubricHead label="Gesprekken" count={filtered.length || undefined} />

          {chats.isLoading && <SkeletonListCard rows={3} />}
        </View>
        {/* Faalt de query, dan stond hier "nog geen gesprekken" — en dan
            lijkt een lege lijst een feit in plaats van een storing. */}
        {chats.isError ? (
          <QueryError
            title="Gesprekken konden niet geladen worden"
            error={chats.error}
            onRetry={() => chats.refetch()}
          />
        ) : filtered.length === 0 ? (
          chats.isLoading ? null : (
        <View
          style={{
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
            padding: space.xxxl,
          }}
        >
          <Text style={[feedType.tile, { fontSize: 20, color: feed.ink, marginBottom: space.sm }]}>
            {filter.trim() ? "Geen gesprek gevonden" : "Nog geen gesprekken"}
          </Text>
          <Text style={[feedType.body, { color: feed.inkDim, maxWidth: 440 }]}>
            {filter.trim()
              ? `Geen gesprek met "${filter.trim()}" in de naam.`
              : friendsWithoutChat.length > 0
              ? "Begin er een met iemand hierboven."
              : "Je hebt nog geen lincs. Ga naar Lincs om iemand toe te voegen."}
          </Text>
        </View>
          )
        ) : (
          filtered.map((item, index) => (
            <ChatRow
              key={item.id}
              chat={item}
              myUserId={myUserId}
              onPress={() => router.push(`/chat/${item.id}`)}
              onLongPress={() => setMenuChat(item)}
              onMenuPress={() => setMenuChat(item)}
              isFirst={index === 0}
              isLast={index === filtered.length - 1}
            />
          ))
        )}
      </PageScroll>

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
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `${title}, ${unread} ongelezen` : title
      }
      // Geen afgeronde hoeken meer aan de uiteinden van de lijst: dit
      // systeem kent maar één ronding en dat is de avatar. De rijen worden
      // in plaats daarvan één gekaderd blok met scheidingslijnen ertussen.
      //
      // En geen vulling meer. De rij stond op `bg-paper-soft`, en twintig
      // gevulde rijen onder elkaar lezen als twintig dozen in plaats van
      // als één lijst (§4). Wat de opbouw draagt is de lijn: het blok sluit
      // zichzelf af met inkt, de rijen erbinnen scheiden met de lichtere
      // `postRule` — de binnenlijn hoort de zwakste te zijn, anders leest
      // één lijst als losse kaartjes.
      //
      // Ingedrukt krijgt hij wél een vlak: dat is geen rusttoestand maar
      // antwoord op een vinger, en zonder dat voelt een rij dood aan.
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.lg,
        paddingVertical: 14,
        backgroundColor: pressed ? feed.panel : "transparent",
        borderLeftWidth: FEED_BORDER,
        borderRightWidth: FEED_BORDER,
        borderTopWidth: isFirst ? FEED_BORDER : 0,
        borderBottomWidth: FEED_BORDER,
        borderColor: feed.ink,
        borderBottomColor: isLast ? feed.ink : feed.postRule,
      })}
    >
      {/* Avatar is geen aparte tap-target meer — op mobile vrat de hitSlop
          regelmatig de rij-tap op zodat je naar het profiel ging i.p.v. de
          chat. Toegang tot het profiel zit nu via de header binnen de chat
          (tap op de naam → /user/[username]). */}
      <Avatar
        name={title}
        avatarUrl={
          chat.type === "group"
            ? chat.avatar_url ?? null
            : (chat.members.find((m) => m.id !== myUserId)?.avatar_url ?? null)
        }
        size="md"
        tint="warm"
      />
      <View style={{ flex: 1, marginLeft: space.md, marginRight: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={[
              feedType.body,
              {
                flex: 1,
                fontSize: 14,
                color: feed.ink,
                fontWeight: unread > 0 ? "700" : "500",
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {relTime && (
            <Text
              style={[
                feedType.label,
                {
                  marginLeft: space.sm,
                  color: unread > 0 ? flameDeep : feed.inkDim,
                  fontWeight: unread > 0 ? "700" : "500",
                },
              ]}
            >
              {relTime}
            </Text>
          )}
        </View>
        <Text
          style={[
            feedType.label,
            { color: feed.inkDim, marginTop: 3 },
          ]}
          numberOfLines={1}
        >
          {baseSubtitle}
        </Text>
      </View>
      {unread > 0 ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: flame,
            marginRight: space.xs,
          }}
        >
          <Text
            style={[
              feedType.label,
              { fontSize: 11, fontWeight: "800", color: creamOnDark.DEFAULT },
            ]}
          >
            {unread > 99 ? "99+" : unread}
          </Text>
        </View>
      ) : null}
      {/* 3-dots actie-knop — opent verberg/verlaat/verwijder menu.
          Eigen Pressable met hitSlop, NIET ingebed in de row-onPress: door
          de visuele scheiding (rechts, klein icoon) en kleine hitbox gaan
          row-taps NIET per ongeluk hierheen — alleen wie écht op de drie
          puntjes mikt opent het menu. */}
      {/* Geen eigen label: deze knop zit ín de rij-Pressable, en RN
          behandelt die als één a11y-element — een label hier wordt
          gewoon niet voorgelezen. De rij draagt de naam. */}
      <Pressable
        onPress={onMenuPress}
        hitSlop={10}
        className="w-9 h-9 items-center justify-center -mr-2"
      >
        <Ionicons name="ellipsis-horizontal" color={feed.inkDim} size={18} />
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
