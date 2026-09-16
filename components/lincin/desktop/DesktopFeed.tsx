import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { color, friendColor, useScheme } from "@/lib/design/theme";
import { mono, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { PANEL_W, RAIL_W, usePanel } from "@/lib/lincin/desktop";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

import { EmptyFeed } from "../feed/EmptyFeed";
import { useFeed } from "../feed/useFeed";
import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * De feed op desktop, thema kleur (Lincin Desktop.dc.html, MAIN · FEED).
 *
 * Titel van 52 met "Per vriend | Op tijd" als onderstreepte links; per
 * vriend een kleefbalk van 64 (kleurblok 10×36, naam serif 30, GROEP ·
 * n lincs, "n NIEUW" in rood of "GELEZEN"), en daaronder een raster van
 * kaarten (minstens 300 breed) met haarlijnen van 1px ertussen. Een kaart:
 * regel in mono, beeld van 180, titel serif 28 (twee regels), bijschrift
 * 14, en een rij met reacties · COMMENT · PRIVAAT BERICHT. Een tik opent
 * de bladzijde in het paneel rechts.
 */

const PAD = 48;
const MIN_CARD = 300;

export function DesktopFeed() {
  const f = useFeed();
  const { t, lang, view, changeView, feed, groups, timeGroups, reactions, seen, myUserId, sheet, setSheet, numberOf } = f;
  const scheme = useScheme();
  const panel = usePanel();
  const { width } = useWindowDimensions();
  const mainW = width - RAIL_W - PANEL_W;
  const cols = Math.max(1, Math.floor(mainW / MIN_CARD));
  const cardW = (mainW - (cols - 1)) / cols;
  const rule = color("ink", "postRule");
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const openId = panel.kind === "post" ? panel.id : null;
  const hueOf = (p: CardPost) => groups.find((g) => g.key === p.authorId)?.hue ?? "orange";

  const sticky: number[] = [];
  const children: ReactNode[] = [];
  const noFriends = f.empty && f.friendCount === 0;

  const grid = (posts: CardPost[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, backgroundColor: rule, borderBottomWidth: 1, borderBottomColor: ink }}>
      {posts.map((p) => (
        <Card
          key={p.id}
          post={p}
          width={cardW}
          number={numberOf(p.id)}
          fill={friendColor(hueOf(p), scheme).fill}
          open={p.id === openId}
          reactions={reactions.grouped(p.id)}
          onReact={(e) => reactions.toggle(p.id, e)}
          onOpen={() => f.openPost(p)}
          onPrivate={() => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)}
          myUserId={myUserId}
        />
      ))}
    </View>
  );

  if (feed.isLoading) {
    children.push(
      <Text key="loading" style={[mono(500), { fontSize: 10, color: dim, textTransform: "uppercase", letterSpacing: 0.8, padding: PAD }]}>
        {t.loading}
      </Text>,
    );
  } else if (noFriends) {
    children.push(
      <View key="empty" style={{ maxWidth: 560, paddingVertical: 24 }}>
        <EmptyFeed />
      </View>,
    );
  } else if (view === "friends") {
    groups.forEach((g) => {
      const fresh = g.posts.filter((p) => !seen.has(p.id)).length;
      sticky.push(children.length);
      children.push(<Bar key={`bar-${g.key}`} group={g} fresh={fresh} onProfile={() => f.openProfile(g)} onPrivate={() => f.privateAbout(g)} />);
      children.push(<View key={`grid-${g.key}`}>{grid(g.posts)}</View>);
    });
  } else {
    timeGroups.forEach((g) => {
      sticky.push(children.length);
      children.push(
        <View key={`tbar-${g.key}`} style={{ height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: PAD, backgroundColor: color("paper"), borderBottomWidth: 1, borderBottomColor: ink }}>
          <Text style={[serif(true), { fontSize: 30, lineHeight: 32, color: ink }]}>{g.label}</Text>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: dim }]}>
            {g.range} · {g.posts.length} {g.posts.length === 1 ? t.post1 : t.posts}
          </Text>
        </View>,
      );
      children.push(<View key={`tgrid-${g.key}`}>{grid(g.posts)}</View>);
    });
  }

  if (!feed.isLoading && !noFriends) {
    children.push(
      <View key="end" style={{ paddingTop: 40, paddingHorizontal: PAD, paddingBottom: 64, gap: 18, alignItems: "flex-start" }}>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: dim }]}>{t.endLine}</Text>
        <Pressable accessibilityRole="button" onPress={f.compose} style={{ maxWidth: 560 }}>
          <Text style={[serif(), { fontSize: 40, lineHeight: 40, letterSpacing: -0.8, color: ink }]}>{t.endTitle}</Text>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: ink, marginTop: 14, textDecorationLine: "underline" }]}>
            {t.newPost} →
          </Text>
        </Pressable>
      </View>,
    );
  }

  return (
    <DesktopShell active="feed">
      <DesktopTitle
        right={
          <>
            <MonoLink label={t.perFriend} on={view === "friends"} active={view === "friends"} onPress={() => changeView("friends")} />
            <MonoLink label={t.byTime} on={view === "time"} active={view === "time"} onPress={() => changeView("time")} />
          </>
        }
      >
        {t.feedA} <Text style={serif(true)}>{t.feedB}</Text>
      </DesktopTitle>
      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={sticky} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
      {/* lang houdt de hook-volgorde gelijk aan de andere feeds */}
      {lang ? null : null}
    </DesktopShell>
  );
}

function Bar({ group: g, fresh, onProfile, onPrivate }: { group: FriendGroup; fresh: number; onProfile: () => void; onPrivate: () => void }) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(g.hue, scheme);
  const seen = fresh === 0;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const label = (s: string, c: string = dim) => (
    <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: c }]}>{s}</Text>
  );
  return (
    <View style={{ height: 64, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: PAD, backgroundColor: color("paper"), borderBottomWidth: 1, borderBottomColor: ink }}>
      <View style={{ width: 10, height: 36, backgroundColor: fc.fill, opacity: seen ? 0.35 : 1 }} />
      <Pressable accessibilityRole="button" onPress={onProfile}>
        <Text style={[serif(), { fontSize: 30, lineHeight: 32, letterSpacing: -0.3, color: seen ? dim : ink }]}>{g.name}</Text>
      </Pressable>
      {g.isGroup ? label(`${t.group}`) : null}
      {fresh > 0 ? label(`${fresh} ${t.new}`, color("red")) : label(t.read)}
      <Text style={[mono(500), { marginLeft: "auto", fontSize: 10, lineHeight: 13, color: dim }]} numberOfLines={1}>
        {g.posts.length} {g.posts.length === 1 ? t.post1 : t.posts} · {timeLabel(g.latest, t, lang)}
      </Text>
      <MonoLink label={t.privateMsg} active onPress={onPrivate} />
    </View>
  );
}

function Card({
  post: p,
  width,
  number,
  fill,
  open,
  reactions,
  onReact,
  onOpen,
  onPrivate,
  myUserId,
}: {
  post: CardPost;
  width: number;
  number: string;
  fill: string;
  open: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
  onReact: (emoji: string) => void;
  onOpen: () => void;
  onPrivate: () => void;
  myUserId: string;
}) {
  const t = useT();
  const lang = useLang();
  const [hover, setHover] = useState(false);
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const hue = useMemo(() => ({ fill }), [fill]);
  void hue;
  return (
    <Pressable
      accessibilityLabel={`${p.title}, ${p.authorName}`}
      onPress={onOpen}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{ width, backgroundColor: open || hover ? color("paper2") : color("paper"), paddingTop: 22, paddingHorizontal: 24, paddingBottom: 18, gap: 14 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <View style={{ width: 8, height: 8, backgroundColor: fill }} />
          <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>
            {p.authorName} · {p.kind}
          </Text>
        </View>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>
          № {number} · {timeLabel(p.createdAt, t, lang)}
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ height: 180, borderWidth: 1, borderColor: rule, overflow: "hidden" }}>
          <Media media={p.media} height={178} hue="orange" postId={p.id} myUserId={myUserId} />
        </View>
        <Text numberOfLines={2} style={[serif(), { fontSize: 28, lineHeight: 28.5, letterSpacing: -0.42, color: ink, minHeight: 57 }]}>
          {p.title}
        </Text>
        <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 20, color: dim, height: 40 }}>
          {p.caption || p.body}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: 1, borderTopColor: rule, paddingTop: 12, marginTop: "auto" }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {reactions.map((r) => (
            <Pressable key={r.emoji} accessibilityRole="button" accessibilityLabel={`${r.emoji} ${r.count}`} onPress={() => onReact(r.emoji)} hitSlop={4}>
              <Text style={[mono(500), { fontSize: 12, lineHeight: 15, color: r.mine ? ink : dim }]}>
                {r.emoji} {r.count}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <MonoLink label={`${t.comment}${p.commentCount ? ` · ${p.commentCount}` : ""}`} active onPress={onOpen} />
        <MonoLink label={t.privateMsg} active onPress={onPrivate} />
      </View>
    </Pressable>
  );
}
