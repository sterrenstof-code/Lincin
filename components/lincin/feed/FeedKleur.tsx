import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { LincinScreen, columnWidth, vfade } from "@/components/lincin/Chrome";
import { CARD_W, PostCard } from "@/components/lincin/PostCard";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { BORDER, Box, Btn, DashedCard, GAP, GUTTER, Head, line, Mono, Segment, Serif, SquareBtn } from "@/components/lincin/ui";
import { ON_LIGHT, color, friendColor, useScheme } from "@/lib/design/theme";
import { useT } from "@/lib/i18n";
import { two, type FriendGroup, type TimeGroup } from "@/lib/lincin/model";
import { usePrefs } from "@/lib/lincin/prefs";
import { markSeen } from "@/lib/read-state";
import { registerScroller, unregisterScroller } from "@/lib/scroll-top";

import { EmptyFeed } from "./EmptyFeed";
import { BAND_H, FriendBand, SectionHead, SeenRow, statusLine } from "./FriendBlocks";
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
 * De gegevens en handelingen deelt hij met magazine (`useFeed`).
 */

const PULL_H = 56;
const TIME_BAND_H = 44;

/** Hoeveel van de volgende kaart in een rij zichtbaar blijft. */
const PEEK = 56;
/**
 * Een foto in een rij: hoogstens zo hoog als 0,85× de breedte van de kaart
 * — een staande foto (4:5) maakt de rij anders hoger dan het scherm aankan.
 */
const ROW_PHOTO_MAX = 0.85;

export function FeedKleur() {
  const f = useFeed();
  const { t, view, changeView, feed, groups, timeGroups, reactions, myUserId, sheet, setSheet } = f;
  // De volgorde op het blad: eerst Nieuw, dan Gezien.
  const order = useMemo(() => [...f.sections.neu, ...f.sections.old], [f.sections]);
  const scheme = useScheme();
  const prefs = usePrefs(myUserId);
  // Een kaart in een rij laat altijd het begin van de volgende zien (PEEK),
  // zodat je ziet dat je opzij kunt; nooit breder dan 340.
  const { width: windowW } = useWindowDimensions();
  const rowCardW = Math.min(CARD_W, columnWidth(windowW) - GUTTER - GAP - PEEK);

  // ---- gelezen: per bijdrage bewaard, per band afgeleid ----
  const [passed, setPassed] = useState<Set<string>>(() => new Set());

  // ---- scrollen: welke band bovenaan staat, en trekken om te vernieuwen ----
  const scrollRef = useRef<ScrollView>(null);
  const tops = useRef<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Zit het blad nog in de trekzone (2.2 §5)? De regel "trek om te
   * vernieuwen" hoort alleen te staan terwijl je trekt of terwijl er
   * ververst wordt. Ingeklapt blijft de strook leeg — anders leest er
   * bovenaan élk bezoek een instructie die je niet vroeg.
   */
  const [pullNear, setPullNear] = useState(false);
  const [viewportH, setViewportH] = useState(0);
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

  const settle = useCallback((_w: number, h: number) => {
    // Pas als het blad hoog genoeg is om onder de trekzone te beginnen.
    if (settled.current || !viewportH || h < viewportH + PULL_H) return;
    settled.current = true;
    scrollRef.current?.scrollTo({ y: PULL_H, animated: false });
  }, [viewportH]);

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
      // Prototype: `pullNear = scrollTop < 44`.
      setPullNear((was) => {
        const near = y < 44;
        return near === was ? was : near;
      });
      if (y <= 2 && settled.current && !refreshing) refresh();
      const mid = y + 100;
      let i = 0;
      tops.current.forEach((top, k) => {
        if (top !== undefined && top <= mid) i = k;
      });
      setIdx((prev) => {
        if (prev === i) return prev;
        if (view === "friends") {
          const newly = order.slice(0, i).filter((g) => !passed.has(g.key));
          if (newly.length) {
            setPassed((p) => new Set([...p, ...newly.map((g) => g.key)]));
            newly.forEach((g) => g.posts.forEach((p) => markSeen(p.id)));
          }
        }
        return i;
      });
    },
    [refresh, refreshing, view, order, passed],
  );

  // ---- de bladzijde ----
  const current = view === "friends" ? order[idx] : undefined;
  const next = view === "friends" ? order[idx + 1] : undefined;
  const currentFill = current ? friendColor(current.hue, scheme).fill : null;
  // Het blad kleurt alleen mee met een vriend die iets nieuws heeft; is alles
  // gelezen, dan blijft het papier (mobile-kleur-home: `tintFill`).
  const currentIsNew = !!current && f.sections.neu.includes(current);
  const tint = prefs.tint && currentIsNew ? currentFill : null;
  // Het verloop kijkt vooruit: onderaan de tint van wie hierna komt.
  const tintNext = tint && next && f.sections.neu.includes(next) ? friendColor(next.hue, scheme).fill : null;
  const counter = view === "friends" && order.length ? `${two(Math.min(idx + 1, order.length))} / ${two(order.length)}` : t.tabFeed;

  const children: ReactNode[] = [];
  const sticky: number[] = [];

  children.push(
    <View key="pull" style={{ height: PULL_H, alignItems: "center", justifyContent: "center" }}>
      {pullNear || refreshing ? (
        <Mono variant="micro" tone="dim">
          {refreshing ? t.refreshing : t.pull}
        </Mono>
      ) : null}
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
    // Nieuw en Gezien (HANDOFF 23 sep): nieuwe vrienden eerst, elk in een
    // eigen getinte band; daaronder de geziene, ingeklapt tot één rij.
    const { neu, old } = f.sections;
    const row = (g: FriendGroup) => {
      const i = order.indexOf(g);
      return (
        <ScrollView
          key={`row-${g.key}`}
          onLayout={(e) => {
            tops.current[i] = e.nativeEvent.layout.y - BAND_H;
          }}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={rowCardW + GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          // Elke kaart zo hoog als haar inhoud; alleen "Zeg iets tegen" rekt mee.
          contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 18, gap: GAP, alignItems: "flex-start" }}
        >
          {g.posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              number={f.numberOf(p.id)}
              hue={g.hue}
              width={rowCardW}
              maxPhotoH={Math.round(rowCardW * ROW_PHOTO_MAX)}
              myUserId={myUserId}
              reactions={reactions.grouped(p.id)}
              onReact={(emoji) => reactions.toggle(p.id, emoji)}
              onOpen={() => f.openPost(p)}
              onPrivate={f.isMine(g.authorId) ? undefined : () => f.privateAbout(g, p)}
              onProfile={() => f.openProfile(g)}
            />
          ))}
          {f.isMine(g.authorId) ? null : (
            <DashedCard width={110} style={{ alignSelf: "stretch" }} onPress={() => f.privateAbout(g)}>
              {t.sayTo} {g.name} →
            </DashedCard>
          )}
        </ScrollView>
      );
    };
    const marker = (g: FriendGroup) => (
      <View
        key={`at-${g.key}`}
        onLayout={(e) => {
          tops.current[order.indexOf(g)] = e.nativeEvent.layout.y;
        }}
      />
    );

    if (neu.length) {
      const n = neu.reduce((s, g) => s + f.freshIn(g).length, 0);
      children.push(
        <SectionHead key="sec-new" label={t.secNew} isNew meta={`${n} ${n === 1 ? t.post1 : t.posts}`} action={t.markAllRead} onAction={f.markAllRead} />,
      );
    }
    neu.forEach((g) => {
      const open = f.isOpen(g.key);
      sticky.push(children.length);
      children.push(
        <FriendBand
          key={`band-${g.key}`}
          group={g}
          isNew
          status={statusLine(f.freshIn(g), g.posts, t)}
          open={open}
          onToggle={() => f.toggleOpen(g.key)}
          onProfile={() => f.openProfile(g)}
        />,
      );
      children.push(open ? row(g) : marker(g));
    });

    if (old.length) {
      children.push(
        <SectionHead
          key="sec-seen"
          label={neu.length ? t.secSeen : t.allRead}
          meta={`${old.length} · ${t.folded}`}
          style={neu.length ? { paddingTop: 22 } : undefined}
        />,
      );
    }
    old.forEach((g, k) => {
      if (f.isOpen(g.key)) {
        sticky.push(children.length);
        children.push(
          <FriendBand
            key={`band-${g.key}`}
            group={g}
            isNew={false}
            status={statusLine([], g.posts, t)}
            open
            onToggle={() => f.toggleOpen(g.key)}
            onProfile={() => f.openProfile(g)}
          />,
        );
        children.push(row(g));
      } else {
        children.push(marker(g));
        children.push(<SeenRow key={`seen-${g.key}`} group={g} top={k === 0 || f.isOpen(old[k - 1].key)} onToggle={() => f.toggleOpen(g.key)} />);
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
              number={f.numberOf(p.id)}
              bleed
              hue={groups.find((x) => x.key === p.authorId)?.hue ?? "orange"}
              myUserId={myUserId}
              reactions={reactions.grouped(p.id)}
              onReact={(emoji) => reactions.toggle(p.id, emoji)}
              onOpen={() => f.openPost(p)}
              onPrivate={f.isMine(p.authorId) ? undefined : () => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)}
              onProfile={() => f.openProfile({ username: p.authorUsername, authorId: p.authorId })}
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
    <LincinScreen tab="feed" tint={tint} tintNext={tintNext} tabTint={tint} counter={counter}>
      <View style={{ paddingTop: 6, paddingHorizontal: GUTTER }}>
        <Serif variant="pageTitle" numberOfLines={1} style={{ fontSize: 34, lineHeight: 36 }}>
          {t.feedA} <Serif variant="pageTitleItalic" style={{ fontSize: 34, lineHeight: 36 }}>{t.feedB}</Serif>
        </Serif>
        <View
          style={{
            marginTop: 14,
            height: 38,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            borderTopWidth: BORDER,
            borderTopColor: line(),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderWidth: 1.5,
                borderColor: f.fresh ? color("red") : color("ink", "inkDim"),
                backgroundColor: f.fresh ? color("red") : "transparent",
              }}
            />
            <Mono variant="micro" tone="ink" style={{ fontSize: 9.5, fontWeight: "600", letterSpacing: 0.6 }}>
              {f.fresh ? `${f.fresh} ${t.new}` : t.upToDate}
            </Mono>
          </View>
          <Segment
            compact
            options={[
              { value: "friends", label: t.perFriend },
              { value: "time", label: t.byTime },
            ]}
            value={view === "time" ? "time" : "friends"}
            onChange={changeView}
          />
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={[{ flex: 1 }, vfade()]}
        stickyHeaderIndices={sticky}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onContentSizeChange={settle}
        onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
        // Altijd iets om te scrollen: anders blijft de trekzone van 56 boven
        // een korte feed staan als lege strook.
        contentContainerStyle={{ minHeight: viewportH + PULL_H }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
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

function EndCard({ onCompose }: { onCompose: () => void }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 22, paddingBottom: 20, gap: 12 }}>
      <Mono variant="micro" tone="dim" style={{ textAlign: "center", textTransform: "none" }}>
        {t.endLine}
      </Mono>
      <Box fill="acid" style={{ paddingVertical: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Head variant="endTitle" color={ON_LIGHT}>
            {t.caughtUp}
          </Head>
          <Serif variant="asideSmall" color={ON_LIGHT} style={{ fontSize: 15, lineHeight: 19, marginTop: 6 }}>
            {t.endSub}
          </Serif>
        </View>
        <SquareBtn glyph="+" size={44} fontSize={22} fill borderless onPress={onCompose} accessibilityLabel={t.newPost} style={{ backgroundColor: ON_LIGHT }} />
      </Box>
    </View>
  );
}
