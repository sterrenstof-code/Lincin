import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { ChatMediaThumb } from "@/components/ChatMediaThumb";
import type { AttachmentInfo } from "@/lib/api/messages";
import {
  chatAvatarUrl,
  chatTitle,
  listChatMembers,
  listMyChats,
  type ChatWithMembers,
} from "@/lib/api/chats";
import {
  creamOnDark,
  CONTROL_H,
  feed,
  FEED_BORDER,
  feedType,
  flame,
  flameDeep,
  gutter,
  ROW_H,
  sheetWidth,
  space,
} from "@/lib/design/type";

/**
 * De chat als volwaardige werkruimte op desktop: drie kolommen.
 *
 *   ┌──────────┬───────────────────────────┬──────────────┐
 *   │ gesprekken│  de gespreksinhoud        │  opties      │
 *   └──────────┴───────────────────────────┴──────────────┘
 *
 * De middenkolom is het bestaande chatscherm, ongewijzigd — dit onderdeel
 * wikkelt er alleen twee kolommen omheen. Dat is bewust: `app/chat/[id].tsx`
 * is ~2700 regels met versleuteling, realtime-abonnementen, opnames en
 * bijlagen. Daar een driekolomsindeling ín bouwen zou betekenen dat je al
 * die logica aanraakt voor een puur visuele verandering.
 *
 * Twee breekpunten, want de kolommen hebben niet dezelfde prioriteit:
 *   ≥ 900px  de gesprekkenlijst verschijnt links
 *   ≥ 1280px de optiekolom verschijnt rechts
 * Daaronder blijft het één kolom en werkt het scherm precies zoals nu op
 * een telefoon — de terug-knop in de chatkop blijft dus zinvol.
 */

/** Breekpunt waarboven de gesprekkenlijst links meekomt. */
/**
 * Drie miniaturen per rij in een kolom van 300 min de marges. Vast en niet
 * gemeten: deze kolom heeft altijd dezelfde breedte.
 */
const MEDIA_THUMB = 84;

export const CHAT_RAIL_BREAKPOINT = 900;
/** Breekpunt waarboven ook de optiekolom rechts meekomt. */
export const CHAT_OPTIONS_BREAKPOINT = 1280;

export function ChatWorkspace({
  chatId,
  myUserId,
  media,
  children,
}: {
  /** De open chat, zodat de lijst links hem kan markeren. */
  chatId: string;
  myUserId: string;
  /**
   * De beelden die in dit gesprek gedeeld zijn, nieuwste eerst.
   *
   * Komen van het chatscherm en niet uit een eigen vraag aan de server:
   * bijlagen zijn versleuteld, en de sleutels zitten in de berichten die
   * daar al ontsleuteld in het geheugen staan. Ze hier opnieuw ophalen zou
   * hetzelfde werk twee keer doen.
   */
  media?: AttachmentInfo[];
  /** Het bestaande chatscherm. */
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const showRail = width >= CHAT_RAIL_BREAKPOINT;
  const showOptions = width >= CHAT_OPTIONS_BREAKPOINT;

  if (!showRail) return <>{children}</>;

  return (
    /**
     * Dezelfde bladspiegel als de kopbalk erboven.
     *
     * De drie kolommen liepen van vensterrand tot vensterrand terwijl de
     * balk erboven op de bladbreedte staat: de gesprekkenlijst begon dus
     * links náást de kop en de optiekolom stak er rechts onderuit. DESIGN.md
     * §4b zegt het met zoveel woorden — kop én inhoud lezen dezelfde
     * `gutter()`, want anders begint de pagina naast zijn eigen kop.
     *
     * `true` en geen prop: deze kolommen bestaan alleen boven 900px, en
     * daarboven is `wide` per definitie waar (het breekpunt ligt op 800).
     */
    <View
      style={{
        flex: 1,
        paddingHorizontal: gutter(true),
        // Onderaan óók lucht, anders loopt de onderlijn van het blad tegen
        // de vensterrand aan en is het geen blad meer maar een afgesneden
        // kolom.
        paddingBottom: gutter(true),
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          width: "100%",
          maxWidth: sheetWidth(true),
          alignSelf: "center",
          /**
           * Het blad zelf: één kader om de drie kolommen, en een licht vlak
           * eronder.
           *
           * De kolommen zweefden los op het paginavlak — drie stroken die
           * toevallig naast elkaar stonden. Het kader zegt dat ze één ding
           * zijn, en het lichte vlak zet ze een laag boven de pagina. Wat
           * daarbinnen de rangorde doet is het verschil tussen de kolommen:
           * de twee zijkolommen zijn dit lichte blad, het gesprek in het
           * midden houdt het paginavlak. Zo lees je in één oogopslag wat het
           * apparaat is en wat het onderwerp.
           */
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
          backgroundColor: feed.panel,
          overflow: "hidden",
        }}
      >
        <ChatRail activeChatId={chatId} myUserId={myUserId} />

        {/* De gespreksinhoud. `minWidth: 0` is nodig omdat een flex-kind
            anders niet kleiner wordt dan zijn inhoud en de kolommen ernaast
            wegduwt. Het paginavlak, waar de zijkolommen het blad houden. */}
        <View style={{ flex: 1, minWidth: 0, backgroundColor: feed.lav }}>{children}</View>

        {showOptions ? (
          <ChatOptionsRail chatId={chatId} myUserId={myUserId} media={media} />
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// Links — de gesprekken
// ---------------------------------------------------------------

function ChatRail({
  activeChatId,
  myUserId,
}: {
  activeChatId: string;
  myUserId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");

  const chats = useQuery({
    queryKey: ["chats", myUserId],
    queryFn: () => listMyChats(myUserId),
    staleTime: 30_000,
  });

  const all = chats.data ?? [];
  const q = filter.trim().toLowerCase();
  const visible = q
    ? all.filter((c) => chatTitle(c, myUserId).toLowerCase().includes(q))
    : all;

  return (
    <View
      style={{
        width: 300,
        borderRightWidth: FEED_BORDER,
        borderRightColor: feed.ink,
      }}
    >
      <View
        style={{
          paddingHorizontal: space.lg,
          paddingVertical: space.lg,
          borderBottomWidth: FEED_BORDER,
          borderBottomColor: feed.ink,
        }}
      >
        <Text
          style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: space.md }]}
        >
          GESPREKKEN
        </Text>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter…"
          placeholderTextColor={feed.inkDim}
          style={{
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
            paddingHorizontal: space.md,
            height: CONTROL_H,
            color: feed.ink,
            fontFamily: feedType.body.fontFamily,
            fontSize: 14,
          }}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {visible.map((c) => (
          <ChatRailRow
            key={c.id}
            chat={c}
            myUserId={myUserId}
            active={c.id === activeChatId}
            onPress={() => router.push(`/chat/${c.id}`)}
          />
        ))}
        {visible.length === 0 ? (
          <Text
            style={[feedType.label, { color: feed.inkDim, padding: space.lg }]}
          >
            {q ? "Niets gevonden." : "Nog geen gesprekken."}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ChatRailRow({
  chat,
  myUserId,
  active,
  onPress,
}: {
  chat: ChatWithMembers;
  myUserId: string;
  active: boolean;
  onPress: () => void;
}) {
  const title = chatTitle(chat, myUserId);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        minHeight: ROW_H,
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: feed.ink,
        // De open chat wordt omgekeerd, net als de actieve tab in de kop.
        backgroundColor: active ? feed.ink : "transparent",
      }}
    >
      {/* Niet `chat.avatar_url`: dat is bij een direct gesprek altijd null.
          Zie chatAvatarUrl in lib/api/chats.ts. */}
      <Avatar
        name={title}
        avatarUrl={chatAvatarUrl(chat, myUserId)}
        size="sm"
        tint="light"
      />
      <View style={{ flex: 1, minWidth: 0, marginLeft: space.md }}>
        <Text
          style={[
            feedType.label,
            { fontSize: 14, fontWeight: "700", color: active ? creamOnDark.DEFAULT : feed.ink },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[
            feedType.label,
            { color: active ? creamOnDark.muted : feed.inkDim, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {chat.type === "group" ? `Groep · ${chat.members.length} leden` : "Direct · E2E"}
        </Text>
      </View>
      {chat.unread_count > 0 ? (
        <View style={{ backgroundColor: flame, paddingHorizontal: 6, paddingVertical: 2 }}>
          {/* Crème en geen `#FFFFFF`: dit staat op `flame`, een vlak dat in
              béide standen dezelfde blijft, en §7 kent geen hexwaarden. */}
          <Text style={[feedType.kicker, { color: creamOnDark.DEFAULT }]}>
            {chat.unread_count > 99 ? "99+" : String(chat.unread_count)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------
// Rechts — opties voor dit gesprek
// ---------------------------------------------------------------

/**
 * De optiekolom toont alleen wat er écht is: de deelnemers en de
 * versleutelingsstatus. Er staan bewust geen acties in die het
 * chatscherm zelf al aanbiedt (bijlage toevoegen, videocall plannen,
 * poll) — die horen bij de composer, niet bij een informatiepaneel.
 */
function ChatOptionsRail({
  chatId,
  myUserId,
  media,
}: {
  chatId: string;
  myUserId: string;
  media?: AttachmentInfo[];
}) {
  const router = useRouter();

  const members = useQuery({
    queryKey: ["chat-members", chatId],
    queryFn: () => listChatMembers(chatId),
    staleTime: 60_000,
  });

  const rows = members.data ?? [];

  return (
    <View
      style={{
        width: 320,
        borderLeftWidth: FEED_BORDER,
        borderLeftColor: feed.ink,
      }}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: space.lg,
            borderBottomWidth: FEED_BORDER,
            borderBottomColor: feed.ink,
          }}
        >
          <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
            OVER DIT GESPREK
          </Text>
        </View>

        {/* Versleuteling — geen sierlijke badge maar een feit. */}
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: space.lg,
            borderBottomWidth: FEED_BORDER,
            borderBottomColor: feed.ink,
          }}
        >
          <Text style={[feedType.tile, { fontSize: 15, color: feed.ink }]}>
            End-to-end versleuteld
          </Text>
          <Text style={[feedType.body, { fontSize: 13, color: feed.inkDim, marginTop: 6 }]}>
            Berichten in dit gesprek worden op je toestel versleuteld. Event-media
            valt hier niet onder.
          </Text>
        </View>

        {/*
            Gedeeld beeld.

            Een gesprek is een lint: wat gisteren gedeeld is, is vandaag
            twintig berichten terug. Deze strook haalt het weer naar voren —
            hoogstens negen, want elk beeld is een download plus een
            ontsleuteling (zie ChatMediaThumb), en dat doe je niet voor een
            gesprek van duizend berichten.
        */}
        {(media?.length ?? 0) > 0 ? (
          <View style={{ borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }}>
            <View
              style={{
                paddingHorizontal: space.lg,
                paddingTop: space.lg,
                paddingBottom: space.md,
              }}
            >
              <Text style={[feedType.kicker, { color: feed.ink, letterSpacing: 0.55 }]}>
                GEDEELD BEELD
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: space.xs,
                paddingHorizontal: space.lg,
                paddingBottom: space.lg,
              }}
            >
              {media!.slice(0, 9).map((attachment) => (
                <ChatMediaThumb
                  key={attachment.path}
                  attachment={attachment}
                  size={MEDIA_THUMB}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Deelnemers */}
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>
          <Text style={[feedType.kicker, { color: "#3A3540", letterSpacing: 0.55 }]}>
            {`DEELNEMERS (${rows.length})`}
          </Text>
        </View>

        {rows.map((m) => {
          const name =
            m.profile?.display_name ?? m.profile?.username ?? "Onbekend";
          return (
            <Pressable
              key={m.user_id}
              onPress={() =>
                m.profile?.username && router.push(`/user/${m.profile.username}`)
              }
              disabled={!m.profile?.username}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                minHeight: ROW_H,
              }}
            >
              <Avatar
                name={name}
                avatarUrl={m.profile?.avatar_url ?? null}
                size="sm"
                tint="light"
              />
              <View style={{ flex: 1, minWidth: 0, marginLeft: space.md }}>
                <Text
                  style={[feedType.label, { fontSize: 14, color: feed.ink }]}
                  numberOfLines={1}
                >
                  {name}
                  {m.user_id === myUserId ? " (jij)" : ""}
                </Text>
                {m.profile?.username ? (
                  <Text
                    style={[feedType.label, { color: feed.inkDim, marginTop: 1 }]}
                    numberOfLines={1}
                  >
                    @{m.profile.username}
                  </Text>
                ) : null}
              </View>
              {m.role === "owner" ? (
                <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.5 }]}>
                  BEHEERDER
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}
