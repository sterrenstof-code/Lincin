import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { LincinScreen, columnWidth, vfade } from "@/components/lincin/Chrome";
import { CARD_W, PostCard } from "@/components/lincin/PostCard";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { BORDER, Box, Btn, Chip, DashedCard, GAP, GUTTER, Head, Initial, line, Mono, Segment, Serif, SquareBtn } from "@/components/lincin/ui";
import { ON_LIGHT, color, friendColor, useScheme } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, two, type FriendGroup, type TimeGroup } from "@/lib/lincin/model";
import { usePrefs } from "@/lib/lincin/prefs";
import { markSeen } from "@/lib/read-state";
import { registerScroller, unregisterScroller } from "@/lib/scroll-top";

import { EmptyFeed } from "./EmptyFeed";
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
/**
 * De hoogte van een band. Gemeten wordt niet de band zelf maar de rij
 * eronder: een kleefkop zit in een eigen wikkel en meldt zijn y als 0.
 */
const BAND_H = 56;
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
  const { t, view, changeView, feed, groups, timeGroups, reactions, seen, myUserId, sheet, setSheet } = f;
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
  const next = view === "friends" ? groups[idx + 1] : undefined;
  const currentFill = current ? friendColor(current.hue, scheme).fill : null;
  const tint = prefs.tint ? currentFill : null;
  // Het verloop kijkt vooruit: onderaan de tint van wie hierna komt.
  const tintNext = tint && next ? friendColor(next.hue, scheme).fill : null;
  const counter = view === "friends" && groups.length ? `${two(Math.min(idx + 1, groups.length))} / ${two(groups.length)}` : t.tabFeed;

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
    groups.forEach((g, i) => {
      const fresh = g.posts.filter((p) => !seen.has(p.id)).length;
      const isSeen = fresh === 0 || passed.has(g.key);
      const open = !f.collapsed[g.key];
      sticky.push(children.length);
      children.push(
        <Band
          key={`band-${g.key}`}
          group={g}
          seen={isSeen}
          fresh={isSeen ? 0 : fresh}
          open={open}
          onToggle={() => f.toggleCollapsed(g.key)}
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
            snapToInterval={rowCardW + GAP}
            snapToAlignment="start"
            decelerationRate="fast"
            // Elke kaart zo hoog als haar inhoud; alleen "Zeg iets tegen" rekt mee.
            contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 16, gap: GAP, alignItems: "flex-start" }}
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
              <DashedCard width={120} style={{ alignSelf: "stretch" }} onPress={() => f.privateAbout(g)}>
                {t.sayTo} {g.name} →
              </DashedCard>
            )}
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
    <LincinScreen tab="feed" tint={tint} tintNext={tintNext} tabTint={currentFill} counter={counter}>
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
        style={[{ flex: 1, marginTop: 12 }, vfade()]}
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
  // 2.1: een band met iets ongelezens draagt geen rode chip en geen
  // telling meer, maar een lopende regel van wat er nieuw is.
  const ticker = fresh > 0;
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
          style={ticker ? { flexShrink: 0, maxWidth: 150, textDecorationLine: "underline" } : { flexShrink: 1, textDecorationLine: "underline" }}
        >
          {g.name}
        </Head>
        {g.isGroup ? <Chip label={t.group} tone="outline" inkColor={bandInk} /> : null}
        {seen ? <Chip label={t.read} tone="plain" inkColor={bandInk} /> : null}
        {ticker ? (
          <Ticker
            text={`${fresh} ${t.new} · ${g.posts.map((p) => `${p.kind} ${timeLabel(p.createdAt, t, lang)}`).join(" · ")} · \u00a0\u00a0 `}
            ink={bandInk}
            bg={bandBg}
          />
        ) : null}
      </Pressable>
      {ticker ? null : (
        <View style={{ alignItems: "flex-end", opacity: 0.8 }}>
          <Mono variant="micro" color={bandInk} style={{ textTransform: "none", letterSpacing: 0 }}>
            {n} {n === 1 ? t.post1 : t.posts}
          </Mono>
          <Mono variant="micro" color={bandInk} style={{ textTransform: "none", letterSpacing: 0 }}>
            {timeLabel(g.latest, t, lang)}
          </Mono>
        </View>
      )}
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

/**
 * De lopende regel in een ongelezen band (HANDOFF 2.1 §Motion — Ticker).
 *
 * Mono 600 9px kapitaal op .1em, aan beide kanten 10% uitgevaagd:
 * `2 NIEUW · FOTO 22:41 · PLEK 22:58 ·` twee keer achter elkaar, die
 * lineair van 0 naar −50% schuift, dus naadloos rondloopt. Duur:
 * max(7s, 0.28s × tekens). Staat stil als "beweging verminderen" aan is.
 */
function Ticker({ text, ink, bg }: { text: string; ink: string; bg: string }) {
  const [w, setW] = useState(0);
  const [still, setStill] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setStill(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    x.setValue(0);
    if (!w || still) return;
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: -w / 2,
        duration: Math.max(7, text.length * 0.28) * 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [w, still, text, x]);

  const style = { ...mono(600), fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase" as const, color: ink };
  const fadeWeb =
    Platform.OS === "web"
      ? ({
          maskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
        } as object)
      : null;

  return (
    <View style={[{ flex: 1, minWidth: 0, height: 12, overflow: "hidden" }, fadeWeb]}>
      {/* Een ruim spoor, zodat de regel nergens afbreekt; gemeten wordt de
          tekst zelf, niet het spoor. */}
      <Animated.View
        style={{ position: "absolute", left: 0, top: 0, width: 10000, flexDirection: "row", alignItems: "flex-start", transform: [{ translateX: x }] }}
      >
        <Text
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
          style={[style, Platform.OS === "web" ? ({ whiteSpace: "pre" } as object) : null]}
        >
          {text}
          {text}
        </Text>
      </Animated.View>
      {Platform.OS === "web" ? null : (
        // Native kent geen masker: twee verlopen in de kleur van de band erover.
        <Svg pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
          <Defs>
            <LinearGradient id="tick-l" x1="0" y1="0" x2="1" y2="0">
              <Stop offset={0} stopColor={bg} stopOpacity={1} />
              <Stop offset={1} stopColor={bg} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="tick-r" x1="0" y1="0" x2="1" y2="0">
              <Stop offset={0} stopColor={bg} stopOpacity={0} />
              <Stop offset={1} stopColor={bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="10%" height="100%" fill="url(#tick-l)" />
          <Rect x="90%" y="0" width="10%" height="100%" fill="url(#tick-r)" />
        </Svg>
      )}
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

function EndCard({ onCompose }: { onCompose: () => void }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 20, gap: 12, borderTopWidth: BORDER, borderTopColor: line() }}>
      <Mono variant="micro" tone="dim" style={{ textAlign: "center", textTransform: "none" }}>
        {t.endLine}
      </Mono>
      <Box fill="acid" style={{ paddingVertical: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Head variant="endTitle" color={ON_LIGHT}>
            {t.endTitle}
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
