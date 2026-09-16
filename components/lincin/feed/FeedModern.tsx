import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { columnWidth, LincinScreen } from "@/components/lincin/Chrome";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { GUTTER, Mono, Serif } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import { chatTitle, listMyChats, otherMember } from "@/lib/api/chats";
import { votePoll } from "@/lib/api/polls";
import { useChatPreviews } from "@/lib/chat-preview";
import { color, friendColor, GLASS, hueFor, useScheme, type FriendColor, type Hue } from "@/lib/design/theme";
import { useLang, useT } from "@/lib/i18n";
import { lincinType } from "@/lib/design/type";
import { timeLabel, two, waveform, type CardPost } from "@/lib/lincin/model";

import { EmptyFeed } from "./FeedKleur";
import { useFeed } from "./useFeed";

/**
 * De feed van het thema modern (HANDOFF §Modern feed, prototype
 * `FEED · MODERN`, referentie Desktop Opties #2b).
 *
 * Beeld eerst: per vriend een kleefregel in mono (kleurstip, naam, aantal,
 * "n nieuw" in het accent) en daaronder een mozaïek van twee kolommen,
 * rijen van 150, kier van 5. De eerste tegel is dubbel breed, behalve als
 * de vriend er precies twee heeft. Beeld op zwart-20%, tekst/poll/plek/
 * spraak op glas (papier-8%), muziek op #7A1E1E. Onder het mozaïek een
 * glazen gespreksbalk met het laatste ongelezen gesprek → Gesprekken.
 */

const ROW_H = 150;
const GAP = 5;
const PAD = 16;
const INK = "#F2EFE8";
const MUSIC = "#7A1E1E";

export function FeedModern() {
  const f = useFeed();
  const { t, router, view, changeView, feed, groups, byTime, seen, myUserId, sheet, setSheet } = f;
  const scheme = useScheme();
  const accent = color("acid");
  /**
   * De breedte van het mozaïek wordt niet gemeten maar berekend — het blad
   * min de twee marges (prototype: `repeat(2, minmax(0, 1fr))`). Zo staan
   * de tegels er bij de eerste render al; een meting via `onLayout` blijft
   * op web soms uit, en dan bleef het mozaïek leeg.
   */
  const w = columnWidth(useWindowDimensions().width) - PAD * 2;

  const noFriends = f.empty && f.friendCount === 0;
  const counter = view === "friends" && groups.length ? `${two(1)} / ${two(groups.length)}` : t.tabFeed;

  // Per vriend, of alles op tijd als één groep.
  const sections = useMemo(() => {
    if (view === "time") {
      return [{ key: "time", name: t.byTime, fill: INK, hue: null as Hue | null, posts: byTime, fresh: 0, onName: () => {} }];
    }
    return groups.map((g) => ({
      key: g.key,
      name: g.name,
      fill: friendColor(g.hue, scheme).fill,
      hue: g.hue as Hue | null,
      posts: g.posts,
      fresh: g.posts.filter((p) => !seen.has(p.id)).length,
      onName: () => f.openProfile(g),
    }));
  }, [view, groups, byTime, seen, scheme, t.byTime, f]);

  const hueOf = (p: CardPost): Hue => groups.find((g) => g.key === p.authorId)?.hue ?? hueFor(p.authorId);
  const half = (w - GAP) / 2;

  const children: ReactNode[] = [];
  // De kleefregels: de labelrij van elke vriend blijft bovenaan staan tot
  // de volgende hem verdringt (prototype: `position: sticky; top: 0`).
  const sticky: number[] = [];
  if (feed.isLoading) {
    children.push(
      <Mono key="loading" variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
        {t.loading}
      </Mono>,
    );
  } else if (noFriends) {
    children.push(<EmptyFeed key="empty" />);
  } else {
    sections.forEach((s) => {
      sticky.push(children.length);
      children.push(
        <Pressable
          key={`label-${s.key}`}
          accessibilityRole="button"
          onPress={s.onName}
          style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 10, backgroundColor: color("paper") }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.fill }} />
          <Mono variant="micro" numberOfLines={1} style={{ letterSpacing: 1.4, flexShrink: 1 }}>
            {s.name}
          </Mono>
          <Mono variant="micro" style={{ letterSpacing: 1.4, opacity: 0.5 }}>
            · {s.posts.length} {s.posts.length === 1 ? t.post1 : t.posts}
          </Mono>
          <View style={{ flex: 1 }} />
          {s.fresh > 0 ? (
            <Mono variant="micro" color={accent} style={{ letterSpacing: 1.4 }}>
              {s.fresh} {t.new}
            </Mono>
          ) : null}
        </Pressable>,
      );
      children.push(
        <View key={`grid-${s.key}`} style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, marginBottom: 14 }}>
          {s.posts.map((p, j) => {
            const span = j === 0 && s.posts.length !== 2 ? 2 : 1;
            return (
              <Tile
                key={p.id}
                post={p}
                width={span === 2 ? w : half}
                fc={friendColor(hueOf(p), scheme)}
                myUserId={myUserId}
                onOpen={() => f.openPost(p)}
                onPrivate={() => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)}
              />
            );
          })}
        </View>,
      );
    });
    children.push(
      <Mono key="end" variant="tiny" style={{ textAlign: "center", paddingTop: 16, paddingBottom: 30, letterSpacing: 1.08, opacity: 0.5, textTransform: "none" }}>
        {t.endLine}
      </Mono>,
    );
  }

  return (
    <LincinScreen tab="feed" counter={counter}>
      {/* de tweede regel: per vriend | op tijd … n nieuw · n lincs */}
      <View style={{ flexDirection: "row", gap: 16, paddingTop: 6, paddingHorizontal: PAD, alignItems: "center" }}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === "friends" }} onPress={() => changeView("friends")}>
          <Mono variant="micro" style={{ letterSpacing: 1.4, opacity: view === "friends" ? 1 : 0.5 }}>
            {t.perFriend}
          </Mono>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === "time" }} onPress={() => changeView("time")}>
          <Mono variant="micro" style={{ letterSpacing: 1.4, opacity: view === "time" ? 1 : 0.5 }}>
            {t.byTime}
          </Mono>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Mono variant="micro" style={{ letterSpacing: 1.4, opacity: 0.6 }}>
          {f.fresh} {t.new} · {f.friendCount} lincs
        </Mono>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 14, paddingHorizontal: PAD }}
        stickyHeaderIndices={sticky}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <ChatBar myUserId={myUserId} onPress={() => router.push("/chats")} accent={accent} newLabel={t.new} />
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

// ---------------------------------------------------------------
// Eén tegel
// ---------------------------------------------------------------

function Tile({
  post: p,
  width,
  fc,
  myUserId,
  onOpen,
  onPrivate,
}: {
  post: CardPost;
  width: number;
  fc: FriendColor;
  myUserId: string;
  onOpen: () => void;
  onPrivate: () => void;
}) {
  const m = p.media;
  const t = useT();
  const lang = useLang();
  const isImg = m.kind === "foto" || (m.kind === "link" && !!m.image);
  // Referentie #2b: "Noor · Het licht om 22:19". Zonder titel: de naam en de tijd.
  const line1 = `${p.authorName} · ${p.untitled ? timeLabel(p.createdAt, t, lang) : p.title}`;
  const bg = isImg ? "rgba(0,0,0,.2)" : m.kind === "muziek" ? MUSIC : m.kind === "kleur" ? m.hex : GLASS.fill;
  return (
    // Bewust géén `accessibilityRole="button"`: op web wordt dat een
    // <button>, en daar mogen de ✉ en de pollopties (zelf knoppen) niet in.
    <Pressable
      accessibilityLabel={`${p.title}, ${p.authorName}`}
      onPress={onOpen}
      style={[{ width, height: ROW_H, overflow: "hidden", backgroundColor: bg }, glass(!isImg && m.kind !== "muziek")]}
    >
      {m.kind === "foto" ? (
        <SafeImage uri={m.uri} cacheKey={m.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
      ) : m.kind === "link" && m.image ? (
        <SafeImage uri={m.image} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
      ) : m.kind === "tekst" ? (
        <View style={{ flex: 1, padding: 12, justifyContent: "center" }}>
          <Serif variant="caption" color={INK} numberOfLines={5} style={{ fontSize: 14, lineHeight: 18 }}>
            {m.text}
          </Serif>
        </View>
      ) : m.kind === "muziek" ? (
        <View style={{ flex: 1, padding: 12, justifyContent: "flex-end" }}>
          <Serif variant="captionLarge" color={INK} numberOfLines={2} style={{ fontSize: 18, lineHeight: 21 }}>
            {m.track}
          </Serif>
          <Text style={[lincinType.bodySmall, { fontSize: 11, lineHeight: 14, color: INK, opacity: 0.75 }]} numberOfLines={1}>
            {m.artist}
          </Text>
        </View>
      ) : m.kind === "poll" ? (
        <PollTile media={m} fill={fc.fill} myUserId={myUserId} />
      ) : m.kind === "spraak" ? (
        <View style={{ flex: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: INK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: INK, fontSize: 11, lineHeight: 13 }}>▶</Text>
          </View>
          <View style={{ flex: 1, height: 40, flexDirection: "row", alignItems: "center", gap: 2 }}>
            {waveform(p.id, 20).map((h, i) => (
              <View key={i} style={{ flex: 1, height: `${h}%`, backgroundColor: INK }} />
            ))}
          </View>
          <Mono variant="micro" color={INK} style={{ textTransform: "none", letterSpacing: 0 }}>
            {m.duration}
          </Mono>
        </View>
      ) : m.kind === "plek" ? (
        <PlaceTile place={m.place} fc={fc} width={width} />
      ) : m.kind === "link" ? (
        <View style={{ flex: 1, padding: 12, justifyContent: "center" }}>
          <Serif variant="caption" color={INK} numberOfLines={4} style={{ fontSize: 14, lineHeight: 18 }}>
            {m.title}
          </Serif>
          <Mono variant="tiny" color={INK} style={{ opacity: 0.6, marginTop: 6 }}>
            {m.site}
          </Mono>
        </View>
      ) : null}

      {/* de kleurstip */}
      <View style={{ position: "absolute", top: 6, left: 6, width: 12, height: 12, borderRadius: 6, backgroundColor: "rgba(0,0,0,.25)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fc.fill }} />
      </View>

      {/* onderaan: titel en ✉ */}
      <View
        style={[
          { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 18, paddingHorizontal: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
          Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg, transparent, rgba(20,12,8,.7))" } as object) : null,
        ]}
      >
        {Platform.OS !== "web" ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, backgroundColor: "rgba(20,12,8,.55)" }} /> : null}
        <Mono variant="tiny" color={INK} numberOfLines={1} style={{ flex: 1, letterSpacing: 0.9 }}>
          {line1}
        </Mono>
        <Pressable accessibilityRole="button" accessibilityLabel="Privaat bericht" onPress={onPrivate} hitSlop={8}>
          <Text style={{ color: INK, fontSize: 12, lineHeight: 14, opacity: 0.8 }}>✉</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function PollTile({ media, fill, myUserId }: { media: Extract<CardPost["media"], { kind: "poll" }>; fill: string; myUserId: string }) {
  const poll = media.poll;
  const [mine, setMine] = useState<string | null>(poll.my_vote_option_id);
  const counts = poll.options.map((o) => {
    let n = o.vote_count;
    if (poll.my_vote_option_id === o.id) n -= 1;
    if (mine === o.id) n += 1;
    return n;
  });
  const total = counts.reduce((a, b) => a + b, 0);
  async function vote(id: string) {
    if (id === mine) return;
    setMine(id);
    try {
      await votePoll({ optionId: id, userId: myUserId, pollId: poll.id });
    } catch {
      setMine(poll.my_vote_option_id);
    }
  }
  return (
    <View style={{ flex: 1, padding: 12, justifyContent: "center", gap: 5 }}>
      {poll.options.slice(0, 4).map((o, i) => {
        const pct = total ? Math.round((counts[i] / total) * 100) : 0;
        const on = mine === o.id;
        return (
          <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${o.label}, ${counts[i]}`} onPress={() => vote(o.id)} style={{ height: 24, backgroundColor: GLASS.strong, overflow: "hidden" }}>
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: fill }} />
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 }}>
              <Mono variant="action" color={INK} numberOfLines={1} style={{ flex: 1, textTransform: "none", letterSpacing: 0 }}>
                {o.label}
                {on ? " ✓" : ""}
              </Mono>
              <Mono variant="action" color={INK} style={{ letterSpacing: 0 }}>
                {counts[i]}
              </Mono>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function PlaceTile({ place, fc, width }: { place: string; fc: FriendColor; width: number }) {
  const cols = Math.ceil(width / 24);
  const rows = Math.ceil(ROW_H / 24);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: cols }, (_, i) => (
        <View key={`c${i}`} pointerEvents="none" style={{ position: "absolute", left: i * 24, top: 0, bottom: 0, width: 1, backgroundColor: GLASS.strong }} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View key={`r${i}`} pointerEvents="none" style={{ position: "absolute", top: i * 24, left: 0, right: 0, height: 1, backgroundColor: GLASS.strong }} />
      ))}
      <View style={{ backgroundColor: fc.fill, paddingVertical: 4, paddingHorizontal: 8 }}>
        <Mono variant="action" color={fc.ink} numberOfLines={1}>
          {place}
        </Mono>
      </View>
    </View>
  );
}

/** Glas: op web met vervaging erachter; native heeft alleen het vlak. */
function glass(on: boolean): object | null {
  if (!on) return null;
  return Platform.OS === "web" ? { backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } : null;
}

// ---------------------------------------------------------------
// De glazen gespreksbalk
// ---------------------------------------------------------------

function ChatBar({ myUserId, onPress, accent, newLabel }: { myUserId: string; onPress: () => void; accent: string; newLabel: string }) {
  const scheme = useScheme();
  const previews = useChatPreviews();
  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId), staleTime: 30_000 });
  const list = chats.data ?? [];
  // Het laatste ongelezen gesprek; anders het laatste gesprek.
  const pick = [...list].sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at));
  const chat = pick.find((c) => (c.unread_count ?? 0) > 0) ?? pick[0];
  if (!chat) return null;
  const isGroup = chat.type === "group";
  const other = isGroup ? null : otherMember(chat, myUserId);
  const fc = friendColor(isGroup ? "green" : hueFor(other?.id), scheme);
  const name = chatTitle(chat, myUserId);
  const pv = previews[chat.id];
  const text = pv ? (pv.sender ? `${pv.sender}: ${pv.text}` : pv.text) : "";
  const unread = chat.unread_count ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${unread} ${newLabel}`}
      onPress={onPress}
      style={[
        {
          marginTop: 10,
          marginHorizontal: GUTTER - 2,
          backgroundColor: GLASS.fill,
          borderWidth: 1,
          borderColor: GLASS.edge,
          paddingVertical: 10,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object) : null,
      ]}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fc.fill }} />
      <Serif variant="caption" color={INK} numberOfLines={1} style={{ fontSize: 16, lineHeight: 19 }}>
        {name}
      </Serif>
      <Text numberOfLines={1} style={[lincinType.bodySmall, { flex: 1, fontSize: 12, lineHeight: 15, color: INK, opacity: 0.75 }]}>
        {text}
      </Text>
      {unread > 0 ? (
        <Mono variant="tiny" color={accent} style={{ letterSpacing: 0.9 }}>
          {unread} {newLabel}
        </Mono>
      ) : null}
    </Pressable>
  );
}
