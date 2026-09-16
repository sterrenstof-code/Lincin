import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { LincinScreen } from "@/components/lincin/Chrome";
import { CARD_W, PostCard } from "@/components/lincin/PostCard";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { BORDER, Box, Btn, Chip, DashedCard, GAP, GUTTER, Head, Initial, line, Mono, Segment, Serif, SquareBtn } from "@/components/lincin/ui";
import { color, friendColor, useScheme } from "@/lib/design/theme";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, two, type FriendGroup, type TimeGroup } from "@/lib/lincin/model";
import { usePrefs } from "@/lib/lincin/prefs";
import { markSeen } from "@/lib/read-state";
import { registerScroller, unregisterScroller } from "@/lib/scroll-top";

import { useFeed } from "./useFeed";

/**
 * Het schrift — de feed van het thema kleur (HANDOFF §01 Feed).
 *
 * Geen algoritme, geen oneindig scrollen: alleen wat je vrienden maken,
 * per vriend onder een kleefband in zijn kleur, of op tijd. Het blad kleurt
 * mee met de vriend wiens band bovenaan staat. Onderaan staat het einde.
 *
 * Wat de kaart draagt staat in `lib/lincin/model.ts`; wat er níet in zit
 * (belafspraken, lijsten, activiteit, je eigen bijdragen) staat daar ook.
 * De gegevens en handelingen deelt hij met magazine en modern (`useFeed`).
 */

const PULL_H = 56;
/**
 * De hoogte van een band. Gemeten wordt niet de band zelf maar de rij
 * eronder: een kleefkop zit in een eigen wikkel en meldt zijn y als 0.
 */
const BAND_H = 56;
const TIME_BAND_H = 44;

export function FeedKleur() {
  const f = useFeed();
  const { t, view, changeView, feed, groups, timeGroups, reactions, seen, myUserId, sheet, setSheet } = f;
  const scheme = useScheme();
  const prefs = usePrefs(myUserId);

  // ---- gelezen: per bijdrage bewaard, per band afgeleid ----
  const [passed, setPassed] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ---- scrollen: welke band bovenaan staat, en trekken om te vernieuwen ----
  const scrollRef = useRef<ScrollView>(null);
  const tops = useRef<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    registerScroller(scrollRef);
    return () => unregisterScroller(scrollRef);
  }, []);

  // Bij een wissel van weergave begint het blad opnieuw onder de trekzone.
  useEffect(() => {
    settled.current = false;
    tops.current = [];
    setIdx(0);
  }, [view]);

  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    scrollRef.current?.scrollTo({ y: PULL_H, animated: false });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await f.refresh();
    setTimeout(() => {
      setRefreshing(false);
      scrollRef.current?.scrollTo({ y: PULL_H, animated: true });
    }, 600);
  }, [f]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (y <= 2 && settled.current && !refreshing) refresh();
      const mid = y + 100;
      let i = 0;
      tops.current.forEach((top, k) => {
        if (top !== undefined && top <= mid) i = k;
      });
      setIdx((prev) => {
        if (prev === i) return prev;
        if (view === "friends") {
          const newly = groups.slice(0, i).filter((g) => !passed.has(g.key));
          if (newly.length) {
            setPassed((p) => new Set([...p, ...newly.map((g) => g.key)]));
            newly.forEach((g) => g.posts.forEach((p) => markSeen(p.id)));
          }
        }
        return i;
      });
    },
    [refresh, refreshing, view, groups, passed],
  );

  // ---- de bladzijde ----
  const current = view === "friends" ? groups[idx] : undefined;
  const tint = current && prefs.tint ? friendColor(current.hue, scheme).fill : null;
  const counter = view === "friends" && groups.length ? `${two(Math.min(idx + 1, groups.length))} / ${two(groups.length)}` : t.tabFeed;

  const children: ReactNode[] = [];
  const sticky: number[] = [];

  children.push(
    <View key="pull" style={{ height: PULL_H, alignItems: "center", justifyContent: "center" }}>
      <Mono variant="micro" tone="dim">
        {refreshing ? t.refreshing : t.pull}
      </Mono>
    </View>,
  );

  const noFriends = f.empty && f.friendCount === 0;

  if (feed.isLoading) {
    children.push(
      <View key="loading" style={{ padding: 40, alignItems: "center" }}>
        <Mono variant="micro" tone="dim">
          {t.loading}
        </Mono>
      </View>,
    );
  } else if (feed.isError) {
    children.push(
      <View key="error" style={{ padding: 40, alignItems: "center", gap: 12 }}>
        <Mono variant="micro" tone="dim">
          {t.failed}
        </Mono>
        <Btn label={t.retry} onPress={() => feed.refetch()} height={34} />
      </View>,
    );
  } else if (noFriends) {
    children.push(<EmptyFeed key="empty" />);
  } else if (view === "friends") {
    groups.forEach((g, i) => {
      const fresh = g.posts.filter((p) => !seen.has(p.id)).length;
      const isSeen = fresh === 0 || passed.has(g.key);
      const open = !collapsed[g.key];
      sticky.push(children.length);
      children.push(
        <Band
          key={`band-${g.key}`}
          group={g}
          seen={isSeen}
          fresh={isSeen ? 0 : fresh}
          open={open}
          onToggle={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}
          onProfile={() => f.openProfile(g)}
        />,
      );
      if (open) {
        children.push(
          <ScrollView
            key={`row-${g.key}`}
            onLayout={(e) => {
              tops.current[i] = e.nativeEvent.layout.y - BAND_H;
            }}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 16, gap: GAP, alignItems: "stretch" }}
          >
            {g.posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                hue={g.hue}
                width={CARD_W}
                myUserId={myUserId}
                reactions={reactions.grouped(p.id)}
                onReact={(emoji) => reactions.toggle(p.id, emoji)}
                onOpen={() => f.openPost(p)}
                onPrivate={() => f.privateAbout(g, p)}
                onProfile={() => f.openProfile(g)}
              />
            ))}
            <DashedCard width={120} onPress={() => f.privateAbout(g)}>
              {t.sayTo} {g.name} →
            </DashedCard>
          </ScrollView>,
        );
      } else {
        children.push(
          <View
            key={`row-${g.key}`}
            onLayout={(e) => {
              tops.current[i] = e.nativeEvent.layout.y - BAND_H;
            }}
          />,
        );
      }
    });
  } else {
    timeGroups.forEach((g, i) => {
      sticky.push(children.length);
      children.push(<TimeBand key={`tband-${g.key}`} group={g} />);
      children.push(
        <View
          key={`tlist-${g.key}`}
          onLayout={(e) => {
            tops.current[i] = e.nativeEvent.layout.y - TIME_BAND_H;
          }}
          style={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 6, gap: GAP }}
        >
          {g.posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              hue={groups.find((x) => x.key === p.authorId)?.hue ?? "orange"}
              myUserId={myUserId}
              reactions={reactions.grouped(p.id)}
              onReact={(emoji) => reactions.toggle(p.id, emoji)}
              onOpen={() => f.openPost(p)}
              onPrivate={() => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)}
              onProfile={() => f.openProfile({ username: p.authorUsername })}
            />
          ))}
        </View>,
      );
    });
  }

  if (!feed.isLoading && !feed.isError && !noFriends) {
    children.push(<EndCard key="end" onCompose={f.compose} />);
  }

  return (
    <LincinScreen tab="feed" tint={tint} counter={counter}>
      <View
        style={{
          paddingTop: 8,
          paddingHorizontal: GUTTER,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Serif variant="pageTitle" style={{ flex: 1, minWidth: 0 }}>
          {t.feedA} <Serif variant="pageTitleItalic">{t.feedB}</Serif>
        </Serif>
        <Segment
          options={[
            { value: "friends", label: t.perFriend },
            { value: "time", label: t.byTime },
          ]}
          value={view}
          onChange={changeView}
        />
      </View>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, marginTop: 12 }}
        stickyHeaderIndices={sticky}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onContentSizeChange={settle}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

// ---------------------------------------------------------------
// De band van een vriend
// ---------------------------------------------------------------

function Band({
  group: g,
  seen,
  fresh,
  open,
  onToggle,
  onProfile,
}: {
  group: FriendGroup;
  seen: boolean;
  fresh: number;
  open: boolean;
  onToggle: () => void;
  onProfile: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(g.hue, scheme);
  const bandBg = seen ? color("paper") : fc.fill;
  const bandInk = seen ? color("ink") : fc.ink;
  const n = g.posts.length;
  return (
    <View
      style={{
        height: BAND_H,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: GUTTER,
        backgroundColor: bandBg,
        borderTopWidth: 3,
        borderTopColor: fc.fill,
        borderBottomWidth: BORDER,
        borderBottomColor: line(),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${g.name}, ${t.viewProfile}`}
        onPress={onProfile}
        style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <Initial
          letter={g.initial}
          size={30}
          round={!g.isGroup}
          bg={seen ? fc.fill : color("paper")}
          fg={seen ? fc.ink : color("ink")}
        />
        <Head
          variant="band"
          color={bandInk}
          numberOfLines={1}
          style={{ flexShrink: 1, textDecorationLine: "underline" }}
        >
          {g.name}
        </Head>
        {g.isGroup ? <Chip label={t.group} tone="outline" inkColor={bandInk} /> : null}
        {seen ? <Chip label={t.read} tone="plain" inkColor={bandInk} /> : null}
        {fresh > 0 ? <Chip label={`${fresh} ${t.new}`} tone="red" /> : null}
      </Pressable>
      <View style={{ alignItems: "flex-end", opacity: 0.8 }}>
        <Mono variant="micro" color={bandInk} style={{ textTransform: "none" }}>
          {n} {n === 1 ? t.post1 : t.posts}
        </Mono>
        <Mono variant="micro" color={bandInk} style={{ textTransform: "none" }}>
          {timeLabel(g.latest, t, lang)}
        </Mono>
      </View>
      <SquareBtn
        glyph="+"
        size={30}
        fontSize={16}
        onPress={onToggle}
        accessibilityLabel={open ? "Inklappen" : "Uitklappen"}
        style={{ borderWidth: 1.5, borderColor: bandInk, transform: [{ rotate: open ? "45deg" : "0deg" }] }}
      />
    </View>
  );
}

function TimeBand({ group: g }: { group: TimeGroup }) {
  const t = useT();
  return (
    <View
      style={{
        height: TIME_BAND_H,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: GUTTER,
        backgroundColor: color("ink"),
        borderTopWidth: BORDER,
        borderTopColor: line(),
      }}
    >
      <Head variant="bandSmall" tone="paper">
        {g.label}
      </Head>
      <Mono variant="micro" tone="paper" style={{ opacity: 0.75, textTransform: "none" }}>
        {g.range} · {g.posts.length} {g.posts.length === 1 ? t.post1 : t.posts}
      </Mono>
    </View>
  );
}

// ---------------------------------------------------------------
// Het einde, en de lege staat
// ---------------------------------------------------------------

export function EndCard({ onCompose }: { onCompose: () => void }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 20, gap: 12, borderTopWidth: BORDER, borderTopColor: line() }}>
      <Mono variant="micro" tone="dim" style={{ textAlign: "center", textTransform: "none" }}>
        {t.endLine}
      </Mono>
      <Box fill="acid" style={{ paddingVertical: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Head variant="endTitle" color="#141414">
            {t.endTitle}
          </Head>
          <Serif variant="asideSmall" color="#141414" style={{ fontSize: 15, lineHeight: 19, marginTop: 6 }}>
            {t.endSub}
          </Serif>
        </View>
        <SquareBtn glyph="+" size={44} fontSize={22} fill borderless onPress={onCompose} accessibilityLabel={t.newPost} style={{ backgroundColor: "#141414" }} />
      </Box>
    </View>
  );
}

/** De lege staat (HANDOFF §11): nog niemand hier. */
export function EmptyFeed() {
  const t = useT();
  const router = useRouter();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: 20, gap: 12 }}>
      <Box fill="acid" style={{ paddingVertical: 18, paddingHorizontal: 16, gap: 10 }}>
        <Mono variant="micro" color="#141414">
          {t.emptyKicker}
        </Mono>
        <Head variant="emptyTitle" color="#141414">
          {t.emptyTitle}
        </Head>
        <Serif variant="captionLarge" color="#141414" style={{ fontSize: 18, lineHeight: 23 }}>
          {t.emptyBody}
        </Serif>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Btn label={t.scanQr} flex={1} bg="#141414" fg={color("acid")} onPress={() => router.push("/qr-scan")} />
          <Btn label={t.shareCode} flex={1} bg="transparent" fg="#141414" style={{ borderWidth: 1.5, borderColor: "#141414" }} onPress={() => router.push("/qr-code")} />
        </View>
      </Box>
      <DashedCard onPress={() => router.push("/post-compose")}>{t.emptyCompose}</DashedCard>
    </View>
  );
}
