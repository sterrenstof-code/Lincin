import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { VerticalLabel } from "@/components/lincin/ui";
import { color, friendColor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { head, mono, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, type CardPost } from "@/lib/lincin/model";

import { EmptyFeed } from "../feed/EmptyFeed";
import { useFeed } from "../feed/useFeed";
import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * De feed op desktop, model 3c "Prikbord" (Lincin Desktop.dc.html, FEED).
 *
 * Titel serif 40 met "Per vriend | Op tijd"; per vriend een kleefband van
 * 46 over de volle breedte in zijn kleur — de naam in Archivo 900 smal,
 * een mono-regel met wat er nieuw is, het aantal en PRIVAAT BERICHT —
 * en daaronder een raster van kaarten (minstens 330 breed, 248 hoog) met
 * haarlijnen van 1px ertussen. Een kaart: een kleurrug van 34 met het №
 * boven en "wie · soort · tijd" gedraaid, het beeld (carrousel bij een
 * album), titel en bijschrift, en een voetregel met de reacties en
 * COMMENT · n. Een tik opent de bijdrage op volle breedte.
 */

const MIN_CARD = 330;
const CARD_H = 248;
const SPINE_W = 34;

export function DesktopFeed() {
  const f = useFeed();
  const { t, lang, view, changeView, feed, groups, timeGroups, reactions, seen, myUserId, sheet, setSheet, numberOf } = f;
  const scheme = useScheme();
  const spec = useThemeSpec();
  const [gridW, setGridW] = useState(0);
  const cols = Math.max(1, Math.floor((gridW + 1) / (MIN_CARD + 1)));
  const cardW = gridW ? (gridW - (cols - 1)) / cols : MIN_CARD;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const hueOf = (p: CardPost): Hue => groups.find((g) => g.key === p.authorId)?.hue ?? "orange";

  const sticky: number[] = [];
  const children: ReactNode[] = [];
  const noFriends = f.empty && f.friendCount === 0;

  const grid = (posts: CardPost[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, backgroundColor: color("ink", "postRule"), borderBottomWidth: spec.border, borderBottomColor: ink }}>
      {posts.map((p) => (
        <Card
          key={p.id}
          post={p}
          width={cardW}
          number={numberOf(p.id)}
          hue={hueOf(p)}
          reactions={p.reactable ? reactions.grouped(p.id) : []}
          onReact={(e) => reactions.toggle(p.id, e)}
          onOpen={() => f.openPost(p)}
          myUserId={myUserId}
        />
      ))}
    </View>
  );

  if (feed.isLoading) {
    children.push(
      <Text key="loading" style={[mono(500), { fontSize: 10, lineHeight: 13, color: dim, textTransform: "uppercase", letterSpacing: 1, padding: 24 }]}>
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
      const fc = friendColor(g.hue, scheme);
      const unseen = g.posts.filter((p) => !seen.has(p.id));
      // "2 nieuw · foto 22:41 · plek 22:58" — of "gelezen".
      const sub = g.isGroup
        ? t.group
        : unseen.length
          ? [`${unseen.length} ${t.new}`, ...unseen.map((p) => `${p.kind} ${timeLabel(p.createdAt, t, lang)}`)].join(" · ")
          : t.read;
      sticky.push(children.length);
      children.push(
        <Band
          key={`band-${g.key}`}
          name={g.name}
          sub={sub}
          count={`${g.posts.length} ${g.posts.length === 1 ? t.post1 : t.posts}`}
          bg={spec.bandFilled ? fc.fill : color("paper")}
          fg={spec.bandFilled ? fc.ink : ink}
          bar={spec.bandFilled ? null : fc.fill}
          onName={() => f.openProfile(g)}
          onPrivate={f.isMine(g.authorId) ? undefined : () => f.privateAbout(g)}
        />,
      );
      children.push(<View key={`grid-${g.key}`}>{grid(g.posts)}</View>);
    });
  } else {
    timeGroups.forEach((g) => {
      sticky.push(children.length);
      children.push(
        <Band
          key={`tband-${g.key}`}
          name={g.label}
          sub=""
          count={`${g.posts.length} ${g.posts.length === 1 ? t.post1 : t.posts}`}
          bg={ink}
          fg={color("paper")}
          bar={null}
        />,
      );
      children.push(<View key={`tgrid-${g.key}`}>{grid(g.posts)}</View>);
    });
  }

  if (!feed.isLoading && !noFriends) {
    children.push(
      <View key="end" style={{ paddingTop: 34, paddingHorizontal: 24, paddingBottom: 50, gap: 14, alignItems: "flex-start" }}>
        <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: dim }]}>{t.endLine}</Text>
        <Pressable accessibilityRole="button" onPress={f.compose} style={{ maxWidth: 560 }}>
          <Text style={[serif(), { fontSize: 34, lineHeight: 34, color: ink }]}>{t.endTitle}</Text>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: ink, marginTop: 12, textDecorationLine: "underline" }]}>
            {t.newPost} →
          </Text>
        </Pressable>
      </View>,
    );
  }

  // Het blad neemt de tint van de eerste vriend (prototype `bgPanel`).
  const tint = view === "friends" && groups[0] ? friendColor(groups[0].hue, scheme).fill : null;

  return (
    <DesktopShell active="feed" mode="feed" tint={tint}>
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
      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        <ScrollView style={{ flex: 1 }} stickyHeaderIndices={sticky} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

/** De band van 46: naam, wat er nieuw is, het aantal, PRIVAAT BERICHT. */
function Band({
  name,
  sub,
  count,
  bg,
  fg,
  bar,
  onName,
  onPrivate,
}: {
  name: string;
  sub: string;
  count: string;
  bg: string;
  fg: string;
  /** Magazine en modern: papier met een kleurbalk in plaats van een gevulde band. */
  bar: string | null;
  onName?: () => void;
  onPrivate?: () => void;
}) {
  const t = useT();
  const spec = useThemeSpec();
  const label = (s: string, extra: object = {}) => (
    <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: fg }, extra]}>
      {s}
    </Text>
  );
  return (
    <View style={{ height: 46, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, backgroundColor: bg, borderBottomWidth: spec.border, borderBottomColor: color("ink") }}>
      {bar ? <View style={{ width: 6, alignSelf: "stretch", marginVertical: 8, backgroundColor: bar }} /> : null}
      <Pressable accessibilityRole={onName ? "link" : undefined} onPress={onName} disabled={!onName}>
        <Text numberOfLines={1} style={[head(), { fontSize: 17, lineHeight: 19, letterSpacing: spec.serifHeads ? 0 : -0.17, color: fg }]}>
          {name}
        </Text>
      </Pressable>
      <View style={{ flexShrink: 1, minWidth: 0 }}>{sub ? label(sub, { opacity: 0.85 }) : null}</View>
      <View style={{ flex: 1 }} />
      {label(count, { letterSpacing: 0.54 })}
      {onPrivate ? (
        <Pressable accessibilityRole="button" onPress={onPrivate}>
          {label(t.privateMsg, { letterSpacing: 0.9, textDecorationLine: "underline" })}
        </Pressable>
      ) : null}
    </View>
  );
}

function Card({
  post: p,
  width,
  number,
  hue,
  reactions,
  onReact,
  onOpen,
  myUserId,
}: {
  post: CardPost;
  width: number;
  number: string;
  hue: Hue;
  reactions: { emoji: string; count: number; mine: boolean }[];
  onReact: (emoji: string) => void;
  onOpen: () => void;
  myUserId: string;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const [mediaH, setMediaH] = useState(0);
  // Een foto krijgt zijn eigen verhouding (Instagram, 4:5–1.91:1); de kaart
  // wordt dan zo hoog als hij moet zijn en de rug meet mee.
  const photo = p.media.kind === "foto";
  const [cardH, setCardH] = useState(CARD_H);
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  return (
    <Pressable
      accessibilityLabel={`${p.title}, ${p.authorName}`}
      onPress={onOpen}
      onLayout={photo ? (e) => setCardH(Math.round(e.nativeEvent.layout.height)) : undefined}
      style={{ width, height: photo ? undefined : CARD_H, flexDirection: "row", backgroundColor: color("paper") }}
    >
      {/* de rug: № boven, "wie · soort · tijd" van onder naar boven */}
      <View style={{ width: SPINE_W, backgroundColor: fc.fill, alignItems: "center", paddingVertical: 8, overflow: "hidden" }}>
        <Text style={[mono(600), { fontSize: 10, lineHeight: 13, color: fc.ink }]}>{number}</Text>
        <View style={{ position: "absolute", left: 0, top: 27, width: SPINE_W, height: cardH - 27 }}>
          <VerticalLabel
            text={`${p.authorName} · ${p.kind} · ${timeLabel(p.createdAt, t, lang)}`}
            width={SPINE_W}
            height={cardH - 27}
            color={fc.ink}
            style={[mono(600), { fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }]}
          />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {photo ? (
          <Media media={p.media} height={CARD_H} hue={hue} postId={p.id} myUserId={myUserId} photoFit="ratio" />
        ) : (
          <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }} onLayout={(e) => setMediaH(Math.round(e.nativeEvent.layout.height))}>
            {mediaH > 0 ? <Media media={p.media} height={mediaH} hue={hue} postId={p.id} myUserId={myUserId} /> : null}
          </View>
        )}
        <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: rule }}>
          <Text numberOfLines={2} style={[head(), { fontSize: 18, lineHeight: 18, letterSpacing: -0.09, color: ink }]}>
            {p.title}
          </Text>
          {p.caption || p.body ? (
            <Text numberOfLines={1} style={[serif(), { fontSize: 15, lineHeight: 18, color: dim, marginTop: 4 }]}>
              {p.caption || p.body}
            </Text>
          ) : null}
        </View>
        <View style={{ height: 38, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: rule }}>
          {reactions.map((r) => (
            <Pressable key={r.emoji} accessibilityRole="button" accessibilityLabel={`${r.emoji} ${r.count}`} accessibilityState={{ selected: r.mine }} onPress={() => onReact(r.emoji)} hitSlop={4}>
              <Text style={[mono(500), { fontSize: 12, lineHeight: 15, color: r.mine ? ink : dim }]}>
                {r.emoji} {r.count}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <MonoLink label={`${t.comment}${p.commentCount ? ` · ${p.commentCount}` : ""}`} active onPress={onOpen} />
        </View>
      </View>
    </Pressable>
  );
}
