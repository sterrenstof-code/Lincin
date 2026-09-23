import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { vfade } from "@/components/lincin/Chrome";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { useReadCursor } from "@/components/lincin/ReadCursor";
import { VerticalLabel } from "@/components/lincin/ui";
import { WhoReacted } from "@/components/lincin/WhoReacted";
import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { cardStyle, color, friendColor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { capf, head, headStep, mono } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, type CardPost } from "@/lib/lincin/model";
import { useReactionWho } from "@/lib/lincin/reactors";

import { EmptyFeed } from "../feed/EmptyFeed";
import { Spread, SpreadCaption, SpreadKicker, SpreadTitle } from "../magazine/Spread";
import { KindPreview } from "../modern/KindPreview";
import { useFeed } from "../feed/useFeed";
import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * De feed op desktop, model 3c "Prikbord" (Lincin Desktop.dc.html, FEED).
 *
 * Titel serif 40 met "Per vriend | Op tijd"; per vriend een kleefband van
 * 46 over de volle breedte in zijn kleur — de naam in Archivo 900 smal,
 * een mono-regel met wat er nieuw is, het aantal en BERICHT —
 * en daaronder een raster van kaarten (minstens 330 breed, 248 hoog) met
 * haarlijnen van 1px ertussen. Een kaart: een kleurrug van 34 met het №
 * boven en "wie · soort · tijd" gedraaid, het beeld (carrousel bij een
 * album), titel en bijschrift, en een voetregel met de reacties en
 * REACTIE · n. Een tik opent de bijdrage op volle breedte.
 *
 * Per vriend staat de naam niet meer als band bóven de kaarten maar als
 * kolom ernaast, op dezelfde regel: zo lees je vriend en bijdragen als één
 * rij. Elke kaart heeft dezelfde vaste hoogte — een foto wordt bijgesneden
 * in plaats van zijn eigen verhouding te krijgen — zodat de rijen gelijk
 * lopen en er meer bijdragen tegelijk in beeld passen.
 *
 * Magazine legt hetzelfde rooster, maar met de poster-spreads van de
 * telefoon (2.2 §2): elk item een volvlaks kleurvlak van de vriend, een
 * verticale metarail die van kant wisselt, een serif-kop, een cursief
 * onderschrift en rechts het beeld. Ook de naamkolom is daar een kleurvlak.
 */

const MIN_CARD = 220;
const CARD_H = 280;
/** De kolom met de naam links van de kaarten van een vriend. */
const HEAD_W = 200;
/** Magazine: een spread is breder (hij draagt een beeldkolom) en even hoog als een kaart. */
const MIN_SPREAD = 340;
/**
 * De kaartrug is 34 in kleur en magazine, 26 in modern (2.2 §9); hij komt
 * nu uit `spec.spine`. De constante blijft als terugval voor wie hem buiten
 * een thema nodig heeft.
 */
const SPINE_FALLBACK = 34;

export function DesktopFeed() {
  const f = useFeed();
  const { t, lang, view, changeView, feed, groups, timeGroups, reactions, seen, myUserId, sheet, setSheet, numberOf } = f;
  const scheme = useScheme();
  const spec = useThemeSpec();
  const [gridW, setGridW] = useState(0);
  /**
   * De naad tussen twee kaarten: een échte naad in elk thema (`spec.gap`:
   * 10 in kleur, 6 in magazine en modern), en de kaarten staan als losse
   * vlakken op het blad.
   *
   * Kleur en magazine hadden eerst een haarlijn van één pixel: het rooster
   * stond op de haarlijnkleur en de kaarten lieten hem ertussen
   * doorschijnen. Dan liep de gekleurde rug van elke kaart pal tegen de foto
   * van zijn buur aan, en las een rij als één lange strook in plaats van
   * losse bijdragen. Een kaart in kleur of magazine krijgt daarom zijn eigen
   * inktrand (`cardStyle`: 1,5 en 1), anders valt het papieren tekstvlak weg
   * tegen het papier van het blad. Modern heeft geen rand; zijn tegels
   * dragen hun eigen vlak.
   */
  const seam = spec.gap;
  /** De kaarten van één rij, `avail` breed. */
  const spread = spec.layout === "spread";
  const minW = spread ? MIN_SPREAD : MIN_CARD;
  const cardWidth = (avail: number) => {
    const cols = Math.max(1, Math.floor((avail + seam) / (minW + seam)));
    return avail > 0 ? (avail - (cols - 1) * seam) / cols : minW;
  };
  // Op tijd: het hele blad min de naad links en rechts. Per vriend: min de naamkolom.
  const cardW = cardWidth(gridW - 2 * seam);
  const friendCardW = cardWidth(gridW - 3 * seam - HEAD_W);
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const hueOf = (p: CardPost): Hue => groups.find((g) => g.key === p.authorId)?.hue ?? "orange";

  const sticky: number[] = [];
  const children: ReactNode[] = [];
  const noFriends = f.empty && f.friendCount === 0;

  const grid = (posts: CardPost[], width = cardW, padded = true) => (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: seam,
        paddingHorizontal: padded ? seam : 0,
        paddingBottom: padded ? seam : 0,
        flex: padded ? undefined : 1,
        minWidth: 0,
      }}
    >
      {posts.map((p, i) =>
        spread ? (
          <PostSpread key={p.id} post={p} index={i} width={width} number={numberOf(p.id)} hue={hueOf(p)} f={f} />
        ) : (
        <Card
          key={p.id}
          post={p}
          width={width}
          number={numberOf(p.id)}
          hue={hueOf(p)}
          reactions={p.reactable ? reactions.grouped(p.id) : []}
          onReact={(e) => reactions.toggle(p.id, e)}
          onOpen={() => f.openPost(p)}
          myUserId={myUserId}
          framed={seam > 1}
        />
        ),
      )}
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
      const open = f.isOpen(g.key);
      const bandProps = {
        name: g.name,
        sub,
        count: `${g.posts.length} ${g.posts.length === 1 ? t.post1 : t.posts}`,
        // Magazine: een volvlaks kleurvlak, zoals de spreads ernaast.
        bg: spec.bandFilled || spread ? fc.fill : spec.layout === "bento" ? color("tile", "tileFill") : color("paper"),
        fg: spec.bandFilled || spread ? fc.ink : ink,
        bar: spec.bandFilled || spread ? null : fc.fill,
        onName: () => f.openProfile(g),
        onPrivate: f.isMine(g.authorId) ? undefined : () => f.privateAbout(g),
        open,
        onToggle: () => f.toggleOpen(g.key),
      };
      // Ingeklapt: alleen de band over de volle breedte, zodat je een
      // gekleurde lijst van vrienden ziet. Uitgeklapt: de naam links, de
      // kaarten ernaast op dezelfde regel.
      if (!open) {
        children.push(<Band key={`band-${g.key}`} {...bandProps} />);
        return;
      }
      children.push(
        <View key={`row-${g.key}`} style={{ flexDirection: "row", alignItems: "stretch", gap: seam, paddingTop: seam, paddingHorizontal: seam }}>
          <FriendHead {...bandProps} />
          {grid(g.posts, friendCardW, false)}
        </View>,
      );
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
          <Text style={[capf(false, true), { fontSize: 34, lineHeight: 34, color: ink }]}>{t.endTitle}</Text>
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
        {t.feedA} <Text style={capf(true, true)}>{t.feedB}</Text>
      </DesktopTitle>
      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {/* Dezelfde scrollfade van 18 px als op de telefoon (2.2 §9). */}
        <ScrollView style={[{ flex: 1 }, vfade()]} stickyHeaderIndices={sticky} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

/** De band van 46: naam, wat er nieuw is, het aantal, BERICHT. */
function Band({
  name,
  sub,
  count,
  bg,
  fg,
  bar,
  onName,
  onPrivate,
  open,
  onToggle,
}: {
  name: string;
  sub: string;
  count: string;
  bg: string;
  fg: string;
  /** Magazine: papier met een kleurbalk in plaats van een gevulde band. */
  bar: string | null;
  onName?: () => void;
  onPrivate?: () => void;
  /** Uit- of ingeklapt; weggelaten (op tijd) staat er geen knop. */
  open?: boolean;
  onToggle?: () => void;
}) {
  const t = useT();
  const spec = useThemeSpec();
  const label = (s: string, extra: object = {}) => (
    <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: fg }, extra]}>
      {s}
    </Text>
  );
  return (
    <View
      style={{
        height: 46,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 24,
        backgroundColor: bg,
        // In modern krijgt de band een ronding en 6 px zijmarge, zodat hij
        // als tegel leest in plaats van als een strook die het blad
        // doorsnijdt (2.2 §9). Dan hoort er ook geen onderlijn onder.
        ...(spec.layout === "bento"
          ? { marginHorizontal: spec.gap, marginTop: spec.gap, borderRadius: spec.cardRadius }
          : { borderBottomWidth: spec.border, borderBottomColor: color("ink") }),
      }}
    >
      {bar ? <View style={{ width: 6, alignSelf: "stretch", marginVertical: 8, borderRadius: spec.layout === "bento" ? 3 : 0, backgroundColor: bar }} /> : null}
      <Pressable accessibilityRole={onName ? "link" : undefined} onPress={onName} disabled={!onName}>
        <Text numberOfLines={1} style={[headStep(18), { color: fg }]}>
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
      {onToggle ? (
        // Zoals de band op de telefoon: + klapt uit, × (45° gedraaid) klapt in.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? "Inklappen" : "Uitklappen"}
          accessibilityState={{ expanded: !!open }}
          onPress={onToggle}
          hitSlop={6}
          style={{ width: 28, height: 28, ...(spec.layout === "bento" ? { borderRadius: 14, borderWidth: 1 } : { borderWidth: 1.5 }), borderColor: fg, alignItems: "center", justifyContent: "center", transform: [{ rotate: open ? "45deg" : "0deg" }] }}
        >
          <Text style={[mono(500), { fontSize: 16, lineHeight: 18, color: fg }]}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * De naamkolom van een vriend, links naast zijn kaarten: kleurbalk en naam,
 * wat er nieuw is, het aantal en BERICHT, en rechtsboven in-/uitklappen.
 */
function FriendHead({
  name,
  sub,
  count,
  bg,
  fg,
  bar,
  onName,
  onPrivate,
  open,
  onToggle,
}: {
  name: string;
  sub: string;
  count: string;
  bg: string;
  fg: string;
  bar: string | null;
  onName: () => void;
  onPrivate?: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const spec = useThemeSpec();
  const round = spec.layout === "bento";
  const shape = cardStyle();
  const label = (s: string, extra: object = {}) => (
    <Text numberOfLines={3} style={[mono(500), { fontSize: 9, lineHeight: 13, letterSpacing: 0.9, textTransform: "uppercase", color: fg }, extra]}>
      {s}
    </Text>
  );
  return (
    <View
      style={{
        width: HEAD_W,
        padding: 14,
        gap: 10,
        backgroundColor: bg,
        borderRadius: shape.borderRadius,
        // Kleur en magazine: dezelfde inktrand als de kaarten ernaast.
        borderWidth: round || spec.bandFilled || spec.layout === "spread" ? 0 : shape.borderWidth,
        borderColor: shape.borderColor,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        {bar ? <View style={{ width: 6, height: 22, borderRadius: round ? 3 : 0, backgroundColor: bar }} /> : null}
        <Pressable accessibilityRole="link" onPress={onName} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[headStep(18), { color: fg }]}>
            {name}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? "Inklappen" : "Uitklappen"}
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          hitSlop={6}
          style={{ width: 24, height: 24, ...(round ? { borderRadius: 12, borderWidth: 1 } : { borderWidth: 1.5 }), borderColor: fg, alignItems: "center", justifyContent: "center", transform: [{ rotate: open ? "45deg" : "0deg" }] }}
        >
          <Text style={[mono(500), { fontSize: 14, lineHeight: 16, color: fg }]}>+</Text>
        </Pressable>
      </View>
      {sub ? label(sub, { opacity: 0.85 }) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {label(count, { letterSpacing: 0.54 })}
        {onPrivate ? (
          <Pressable accessibilityRole="button" onPress={onPrivate}>
            {label(t.privateMsg, { letterSpacing: 0.9, textDecorationLine: "underline" })}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Magazine: één bijdrage als poster-spread, zoals de inhoudsopgave op de telefoon. */
function PostSpread({
  post: p,
  index,
  width,
  number,
  hue,
  f,
}: {
  post: CardPost;
  index: number;
  width: number;
  number: string;
  hue: Hue;
  f: ReturnType<typeof useFeed>;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  return (
    <Spread
      index={index}
      page="feed"
      fill={fc.fill}
      ink={fc.ink}
      rail={`№ ${number} · ${p.authorName} · ${timeLabel(p.createdAt, t, lang)}`}
      onPress={() => f.openPost(p)}
      accessibilityLabel={p.title}
      height={CARD_H}
      mediaWidth={Math.round(width * 0.42)}
      media={<KindPreview post={p} scheme={scheme} variant="papier" />}
      style={{ width, marginHorizontal: 0, marginBottom: 0 }}
    >
      <SpreadKicker ink={fc.ink}>{p.kind}</SpreadKicker>
      <SpreadTitle ink={fc.ink} size={26}>
        {p.untitled ? p.caption || p.kind : p.title}
      </SpreadTitle>
      <View style={{ gap: 10 }}>
        {p.caption && !p.untitled ? (
          <SpreadCaption ink={fc.ink} numberOfLines={2}>
            {p.caption}
          </SpreadCaption>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t.comment} ${p.commentCount}`} onPress={() => f.openPost(p)}>
            <SpreadKicker ink={fc.ink}>
              {t.comment}
              {p.commentCount ? ` · ${p.commentCount}` : ""}
            </SpreadKicker>
          </Pressable>
          {f.isMine(p.authorId) ? null : (
            <Pressable accessibilityRole="button" accessibilityLabel={t.privateMsg} onPress={() => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)}>
              <SpreadKicker ink={fc.ink}>{t.privateShort}</SpreadKicker>
            </Pressable>
          )}
        </View>
      </View>
    </Spread>
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
  framed = false,
}: {
  post: CardPost;
  width: number;
  number: string;
  hue: Hue;
  reactions: GroupedPostReaction[];
  onReact: (emoji: string) => void;
  onOpen: () => void;
  myUserId: string;
  /** Losse kaart met naad eromheen: dan draagt hij zijn eigen rand. */
  framed?: boolean;
}) {
  const t = useT();
  const who = useReactionWho(reactions);
  const read = useReadCursor();
  const lang = useLang();
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const [mediaH, setMediaH] = useState(0);
  // Elke kaart is even hoog; een foto wordt bijgesneden en opent op volle
  // breedte in zijn eigen verhouding.
  const photo = p.media.kind === "foto";
  const cardH = CARD_H;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const spec = useThemeSpec();
  const spine = spec.spine ?? SPINE_FALLBACK;
  const shape = cardStyle();
  return (
    <Pressable
      accessibilityLabel={`${p.title}, ${p.authorName}`}
      onPress={onOpen}
      style={{
        width,
        height: CARD_H,
        flexDirection: "row",
        backgroundColor: shape.backgroundColor,
        borderRadius: shape.borderRadius,
        borderWidth: framed ? shape.borderWidth : 0,
        borderColor: shape.borderColor,
        // Een ronde kaart moet zijn beeld en zijn rug bijsnijden.
        overflow: shape.borderRadius ? "hidden" : "visible",
      }}
    >
      {/* de rug: № boven, "wie · soort · tijd" van onder naar boven */}
      <View style={{ width: spine, backgroundColor: fc.fill, alignItems: "center", paddingVertical: 8, overflow: "hidden" }}>
        <Text style={[mono(600), { fontSize: 10, lineHeight: 13, color: fc.ink }]}>{number}</Text>
        <View style={{ position: "absolute", left: 0, top: 27, width: spine, height: cardH - 27 }}>
          <VerticalLabel
            text={`${p.authorName} · ${p.kind} · ${timeLabel(p.createdAt, t, lang)}`}
            width={spine}
            height={cardH - 27}
            color={fc.ink}
            style={[mono(600), { fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }]}
          />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Bij een foto wordt de muis "post lezen": de hele kaart opent de bijdrage. */}
        <View
          ref={photo ? (read.ref as never) : undefined}
          style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
          onLayout={(e) => setMediaH(Math.round(e.nativeEvent.layout.height))}
        >
          {mediaH > 0 ? <Media media={p.media} height={mediaH} hue={hue} postId={p.id} myUserId={myUserId} /> : null}
          {photo ? read.label : null}
        </View>
        <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: rule }}>
          <Text numberOfLines={2} style={[head(), { fontSize: 18, lineHeight: 18, letterSpacing: -0.09, color: ink }]}>
            {p.title}
          </Text>
          {p.caption || p.body ? (
            <Text numberOfLines={1} style={[capf(false, true), { fontSize: 15, lineHeight: 18, color: dim, marginTop: 4 }]}>
              {p.caption || p.body}
            </Text>
          ) : null}
        </View>
        {who.line ? (
          <View style={{ paddingVertical: 6, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: rule }}>
            <WhoReacted line={who.line} />
          </View>
        ) : null}
        <View style={{ height: 38, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: rule }}>
          {reactions.map((r) => (
            <Pressable key={r.emoji} accessibilityRole="button" {...who.chip(r)} accessibilityState={{ selected: r.mine }} onPress={() => onReact(r.emoji)} hitSlop={4}>
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
