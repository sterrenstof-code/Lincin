import { memo, useCallback, useMemo } from "react";
import { FlatList, Platform, Pressable, Text, View, type ListRenderItemInfo } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LincinScreen, useUnread, vfade } from "@/components/lincin/Chrome";
import { CircleGlyphBtn } from "@/components/lincin/chrome/Header";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import { OMSLAG, friendColor, useHueChoices } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";
import type { Dict, Lang } from "@/lib/i18n";
import type { Hue } from "@/lib/design/theme";

import { useEdition, type Tile } from "../desktop/DesktopFeed";
import { Black, Label, LabelLink, NewTag, RedButton, RoundGlyph, SEAM, SPINE, Scrim, Ser, Wordmark, useOmslag } from "../magazine/Omslag";
import { Spread, SpreadCaption, SpreadKicker, SpreadTitle } from "../magazine/Spread";
import { KindPreview } from "../modern/KindPreview";

import { EmptyFeed } from "./EmptyFeed";
import { useFeed, type Feed } from "./useFeed";

/**
 * De feed van magazine op de telefoon: de OMSLAG (mobile-app.dc.html
 * `FEED · MAGAZINE`, magazine-overzicht.dc.html, handoff 24 sep).
 *
 *   Editie      de cover van 540: de foto die je nog niet zag, het rode
 *               woordmerk LINCIN in 112 erover, onderaan "Jouw editie van
 *               vandaag" en de titel in serif cursief. Daaronder het
 *               bijschrift met de rug van de vriend, dan "Ook nieuw" als
 *               spreads en wat je al zag als "Inhoud" met rode nummers.
 *   Per vriend  **Per** *vriend*: een blok per vriend met een rug van 5,
 *               getint als er iets nieuw is, in twee groepen Nieuw en
 *               Gezien. Standaard ingeklapt — de titels als index.
 *   Op tijd     **Op** *tijd*: per dagdeel een blok met spreads.
 *
 * De weergaven staan in een kleefbalk onder de cover of de paginatitel.
 */

const COVER_H = 540;
const PAD = 24;

export function FeedMagazine() {
  const f = useFeed();
  const { t, feed, sheet, setSheet, view } = f;
  const ed = useEdition(f);
  const o = useOmslag();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();

  const noFriends = f.empty && f.friendCount === 0;
  const hero = ed.hero;
  const cover = view === "editie" && !!hero && !feed.isLoading && !noFriends;
  const heroFill = hero ? friendColor(hero.hue, o.scheme).fill : null;

  /**
   * De pagina als één platte reeks items, voor een `FlatList`.
   *
   * Dit was een ScrollView met álles erin: zestig spreads, elk met een
   * foto, gemount en gedecodeerd bij het openen — ook wat drie schermen
   * lager stond. Een `FlatList` tekent alleen wat (bijna) in beeld is.
   *
   * Daarvoor moest de geneste opbouw plat. De omhulsels die wegvielen
   * waren kale `View`s, met twee uitzonderingen die hun maat nu per item
   * meegeven: de spreads stonden in een doos met `paddingTop: SEAM` (nu
   * op de eerste spread), en de inhoudsopgave in een doos met marge en een
   * onderlijn (nu marge op elke rij, `marginTop` op de eerste, de lijn
   * onder de laatste). React Native kent geen samenvallende marges, dus
   * het resultaat staat op dezelfde pixel.
   *
   * De schakelbalk blijft kleven: `stickyHeaderIndices` werkt op een
   * FlatList net als op een ScrollView, en de lijst houdt een kleefkop
   * altijd getekend, ook als hij buiten het venster valt.
   */
  const { alsoNew, rest } = ed;
  const { sections, timeGroups, groups, seen, isOpen, freshIn, isMine } = f;
  const loading = feed.isLoading;
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (loading || noFriends) {
      // Leeg (prototype `magEmpty`): geen kopregel, maar de editie en het
      // grote woordmerk bovenaan — de omslag zonder foto.
      out.push({ type: "top", key: "top" });
      out.push(loading ? { type: "loading", key: "loading" } : { type: "empty", key: "empty" });
      return out;
    }
    if (cover) {
      out.push({ type: "cover", key: "cover" });
      out.push({ type: "caption", key: "caption" });
    } else {
      out.push({ type: "head", key: "head" });
    }
    out.push({ type: "views", key: "views" });
    if (view === "editie") {
      if (alsoNew.length) {
        out.push({ type: "block", key: "b:new", block: { kind: "alsoNew", count: alsoNew.length } });
        pushSpreads(out, "new", alsoNew);
      }
      if (rest.length) {
        out.push({ type: "block", key: "b:rest", block: { kind: "contents", count: rest.length, top: alsoNew.length ? 34 : SEAM } });
        pushIndex(out, "rest", rest, true);
      }
    } else if (view === "friends") {
      const all = [...sections.neu, ...sections.old];
      const two = (n: number) => String(n).padStart(2, "0");
      all.forEach((g, gi) => {
        const isNew = gi < sections.neu.length;
        const first = gi === 0 || gi === sections.neu.length;
        if (first) out.push({ type: "groupHead", key: `gh:${isNew ? "new" : "seen"}`, isNew, top: isNew || !sections.neu.length ? 18 : 34 });
        const open = isOpen(g.key);
        out.push({
          type: "block",
          key: `b:${g.key}`,
          block: { kind: "friend", g, isNew, open, fresh: freshIn(g).length, kicker: `${two(gi + 1)} / ${two(all.length)}` },
        });
        if (open) {
          const tiles: Tile[] = g.posts.map((p) => ({ ...p, hue: p.swatch ?? g.hue, isNew: !seen.has(p.id) }));
          pushSpreads(out, `f:${g.key}`, tiles);
        } else {
          pushIndex(out, `f:${g.key}`, g.posts, false);
        }
      });
    } else {
      const hueOf = new Map(groups.map((g) => [g.key, g.hue]));
      timeGroups.forEach((tg, i) => {
        const tiles: Tile[] = tg.posts.map((p) => ({ ...p, hue: p.swatch ?? hueOf.get(p.authorId) ?? "orange", isNew: !seen.has(p.id) }));
        const n = tiles.filter((p) => p.isNew).length;
        out.push({ type: "block", key: `b:${tg.key}`, block: { kind: "time", label: tg.label, range: tg.range, count: tg.posts.length, newCount: n, top: i ? 34 : SEAM } });
        pushSpreads(out, `t:${tg.key}`, tiles);
      });
    }
    out.push({ type: "end", key: "end" });
    return out;
  }, [loading, noFriends, cover, view, alsoNew, rest, sections, timeGroups, groups, seen, isOpen, freshIn]);
  const sticky = useMemo(() => {
    const i = items.findIndex((it) => it.type === "views");
    return i >= 0 ? [i] : [];
  }, [items]);

  // Wie bij de inhoudsopgave een stip in zijn kleur krijgt (`withName`).
  const hueOf = useMemo(() => new Map(groups.map((g) => [g.key, g.hue])), [groups]);
  const { lang, openPost, privateAbout, numberOf, markAllRead } = f;

  /**
   * Het item tekenen. Hangt bewust aan `f`, en `f` is elke render nieuw:
   * de cover, de koppen en het bijschrift tonen reacties, tellers en de
   * weergave, en moeten dus meetekenen — net als in de ScrollView. Wat
   * telt is wát er meetekent: alleen de items in het venster, en daarvan
   * slaan de spreads en de rijen van de opgave (`memo`, alleen stabiele
   * props) zichzelf over. Dat zijn de zware, met een foto.
   */
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Item>) => {
      switch (item.type) {
        case "top":
          return (
            <View style={{ paddingTop: 8, paddingHorizontal: PAD, paddingBottom: 16, gap: 8 }}>
              <Label size={8.5} weight={500} ls={0.2} color={o.dim}>
                {t.edition}
                {f.edition ? ` · № ${f.edition}` : ""}
              </Label>
              <Wordmark size={108} />
            </View>
          );
        case "loading":
          return (
            <Label size={9} weight={500} ls={0.2} color={o.dim} style={{ textAlign: "center", paddingVertical: 30 }}>
              {t.loading}
            </Label>
          );
        case "empty":
          return <EmptyFeed />;
        case "cover":
          return <Cover f={f} hero={hero!} />;
        case "caption":
          return <CoverCaption f={f} hero={hero!} />;
        case "head":
          return <ViewHead f={f} />;
        case "views":
          return <Views f={f} />;
        case "block":
          return <Block f={f} b={item.block} />;
        case "groupHead":
          return (
            <View style={{ marginTop: item.top, marginHorizontal: PAD, marginBottom: 2, flexDirection: "row", alignItems: "center" }}>
              <Label size={11} ls={0.08} color={item.isNew ? o.red : o.ink} style={{ flex: 1 }}>
                {item.isNew ? t.secNew : t.secSeen}
              </Label>
              {item.isNew ? (
                <LabelLink size={9} onPress={markAllRead}>
                  {t.markAllRead}
                </LabelLink>
              ) : null}
            </View>
          );
        case "spread":
          return (
            <SpreadRow
              p={item.p}
              index={item.index}
              first={item.first}
              number={numberOf(item.p.id)}
              mine={isMine(item.p.authorId)}
              onOpen={openPost}
              onPrivate={privateAbout}
              t={t}
              lang={lang}
            />
          );
        case "index":
          return (
            <IndexRow
              p={item.p}
              number={numberOf(item.p.id)}
              hue={item.withName ? (item.p.swatch ?? hueOf.get(item.p.authorId) ?? "orange") : null}
              first={item.first}
              last={item.last}
              onOpen={openPost}
              t={t}
              lang={lang}
            />
          );
        case "indexEmpty":
          return <View style={{ marginHorizontal: PAD - 6, marginTop: SEAM, borderBottomWidth: OMSLAG.rule, borderBottomColor: o.ink }} />;
        case "spacer":
          return <View style={{ paddingTop: SEAM }} />;
        case "end":
          return <End f={f} />;
      }
    },
    [f, o, t, lang, hero, hueOf, numberOf, isMine, openPost, privateAbout, markAllRead],
  );

  return (
    // `tint` kleurt het blad niet (magazine tint niet), maar geeft de
    // rugstrook onderaan de kleur van de vriend op de cover.
    <LincinScreen tab="feed" header={cover || noFriends ? "none" : "default"} bleed={cover} tint={cover ? heroFill : null}>
      <FlatList
        style={[{ flex: 1 }, cover ? null : vfade()]}
        data={items}
        renderItem={renderItem}
        keyExtractor={itemKey}
        stickyHeaderIndices={sticky}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        // Alleen native: op web doet hij niets nuttigs en kan hij bij snel
        // scrollen inhoud laten wegvallen.
        removeClippedSubviews={Platform.OS !== "web"}
      />
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

// ---------------------------------------------------------------
// De items van de lijst
// ---------------------------------------------------------------

type BlockSpec =
  | { kind: "alsoNew"; count: number }
  | { kind: "contents"; count: number; top: number }
  | { kind: "friend"; g: FriendGroup; isNew: boolean; open: boolean; fresh: number; kicker: string }
  | { kind: "time"; label: string; range: string; count: number; newCount: number; top: number };

type Item =
  | { type: "top" | "loading" | "empty" | "cover" | "caption" | "head" | "views" | "end" | "indexEmpty" | "spacer"; key: string }
  | { type: "block"; key: string; block: BlockSpec }
  | { type: "groupHead"; key: string; isNew: boolean; top: number }
  | { type: "spread"; key: string; p: Tile; index: number; first: boolean }
  | { type: "index"; key: string; p: CardPost; first: boolean; last: boolean; withName: boolean };

const itemKey = (it: Item) => it.key;

/** Spreads onder elkaar; de eerste draagt de `paddingTop: SEAM` van het oude omhulsel. */
function pushSpreads(out: Item[], prefix: string, posts: Tile[]) {
  if (!posts.length) {
    out.push({ type: "spacer", key: `${prefix}:spacer` });
    return;
  }
  posts.forEach((p, i) => out.push({ type: "spread", key: `${prefix}:s:${p.id}`, p, index: i, first: i === 0 }));
}

/** De inhoudsopgave als losse rijen; zie `IndexRow` voor de marges van het oude omhulsel. */
function pushIndex(out: Item[], prefix: string, posts: CardPost[], withName: boolean) {
  if (!posts.length) {
    out.push({ type: "indexEmpty", key: `${prefix}:empty` });
    return;
  }
  posts.forEach((p, i) => out.push({ type: "index", key: `${prefix}:i:${p.id}`, p, first: i === 0, last: i === posts.length - 1, withName }));
}

/** De blokkop van een item, met wat erbij hoort per soort. */
function Block({ f, b }: { f: Feed; b: BlockSpec }) {
  const { t } = f;
  const o = useOmslag();
  switch (b.kind) {
    case "alsoNew":
      return (
        <BlockHead
          f={f}
          fill={o.red}
          kicker={`${t.secNew} · ${b.count} ${b.count === 1 ? t.post1 : t.posts}`}
          kickRed
          name={t.alsoNew}
          nameSize={44}
          act={{ label: t.markAllRead, onPress: f.markAllRead }}
        />
      );
    case "contents":
      return <BlockHead f={f} top={b.top} fill={o.ink} kicker={`${cap(t.alreadySeen)} · ${b.count} ${b.count === 1 ? t.post1 : t.posts}`} name={t.omContents} nameSize={44} />;
    case "friend":
      return <FriendBlockHead f={f} g={b.g} isNew={b.isNew} open={b.open} fresh={b.fresh} kicker={b.kicker} />;
    case "time":
      return (
        <BlockHead
          f={f}
          top={b.top}
          fill={o.ink}
          kicker={`${b.range} · ${b.count} ${b.count === 1 ? t.post1 : t.posts}${b.newCount ? ` · ${b.newCount} ${t.new}` : ""}`}
          kickRed={b.newCount > 0}
          name={b.label}
          nameSize={44}
        />
      );
  }
}

// ---------------------------------------------------------------
// De cover
// ---------------------------------------------------------------

function Cover({ f, hero: h }: { f: Feed; hero: Tile }) {
  const { t, router } = f;
  const o = useOmslag();
  const insets = useSafeAreaInsets();
  const unread = useUnread();
  // De cover loopt onder de statusbalk door; de bovenregel staat 52 van
  // boven, zoals in het prototype (statusbalk 54). Een browser houdt dat aan.
  const top = Math.max(insets.top, 54) - 2;
  const fc = friendColor(h.hue, o.scheme);
  const photo = h.media.kind === "foto" ? h.media : null;
  const fg = photo ? OMSLAG.onImage : fc.ink;
  return (
    <View style={{ height: COVER_H, overflow: "hidden", backgroundColor: fc.fill }}>
      {photo ? <SafeImage uri={photo.uri} cacheKey={photo.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" /> : null}
      {photo ? (
        <>
          <Scrim css="linear-gradient(180deg,rgba(16,16,12,.66),rgba(16,16,12,.34) 46%,rgba(16,16,12,0))" style={{ left: 0, right: 0, top: 0, height: 270 }} />
          <Scrim css="linear-gradient(0deg,rgba(16,16,12,.62),rgba(16,16,12,0))" style={{ left: 0, right: 0, bottom: 0, height: 260 }} />
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.readPost}: ${h.title}`}
        onPress={() => f.openPost(h)}
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      />
      <View style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, bottom: 0, width: SPINE, backgroundColor: fc.fill }} />

      <View style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: top, paddingHorizontal: PAD }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Label size={8.5} weight={500} ls={0.2} color={fg}>
            {t.edition}
            {f.edition ? ` · № ${f.edition}` : ""}
          </Label>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <CircleGlyphBtn
              glyph="✳"
              fontSize={15}
              tone={fg}
              ringColor={fc.fill}
              badge={unread.notifications > 0}
              onPress={() => router.push("/notifications")}
              label={unread.notifications > 0 ? `${t.notifications}, ${unread.notifications} ${t.new}` : t.notifications}
            />
            <CircleGlyphBtn glyph="+" fontSize={19} tone={fg} onPress={f.compose} label={t.newPost} />
          </View>
        </View>
        <View style={{ pointerEvents: "none", marginTop: 8, marginLeft: -5 }}>
          <Wordmark size={112} />
        </View>
      </View>

      <View style={{ pointerEvents: "none", position: "absolute", left: PAD, right: PAD, bottom: 22 }}>
        <Text style={[sans(800), { fontSize: 13, lineHeight: 17, letterSpacing: 0.13, textTransform: "uppercase", color: fg }]}>
          {t.omCoverA} {t.omCoverB}
        </Text>
        <Ser size={54} italic f={0.9} ls={-0.01} color={fg} numberOfLines={3} style={{ marginTop: 10 }}>
          {h.title}
        </Ser>
      </View>
    </View>
  );
}

/** Onder de cover: wie, wat, wanneer, het bijschrift, en reageren of een bericht. */
function CoverCaption({ f, hero: h }: { f: Feed; hero: Tile }) {
  const { t, lang } = f;
  const o = useOmslag();
  const fc = friendColor(h.hue, o.scheme);
  const text = h.caption || h.body;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => f.openPost(h)}
      style={{ paddingTop: PAD, paddingRight: PAD, paddingBottom: PAD, paddingLeft: PAD - SPINE, borderLeftWidth: SPINE, borderLeftColor: fc.fill, gap: 14, backgroundColor: o.paper }}
    >
      <Label size={8.5} weight={500} ls={0.2} color={o.dim}>
        {h.authorName} · {h.kind} · {timeLabel(h.createdAt, t, lang)}
      </Label>
      {text ? (
        <Ser size={18} italic f={1.38} color={o.soft} numberOfLines={5}>
          {text}
        </Ser>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 2 }}>
        <Pressable accessibilityRole="button" onPress={() => f.openPost(h)} style={{ paddingVertical: 13, marginVertical: -13 }}>
          <Label size={9} weight={500} ls={0.16} color={o.dim} underline>
            {t.comment}
            {h.commentCount ? ` · ${h.commentCount}` : ""}
          </Label>
        </Pressable>
        {f.isMine(h.authorId) ? null : (
          <Pressable
            accessibilityRole="button"
            onPress={() => f.privateAbout({ authorId: h.authorId, name: h.authorName }, h)}
            style={{ paddingVertical: 13, marginVertical: -13 }}
          >
            <Label size={9} weight={500} ls={0.16} color={o.dim}>
              {t.privateShort}
            </Label>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {f.reactions.grouped(h.id).slice(0, 3).map((r) => (
          <Pressable key={r.emoji} accessibilityRole="button" accessibilityState={{ selected: r.mine }} onPress={() => f.reactions.toggle(h.id, r.emoji)} hitSlop={10}>
            <Text style={{ fontSize: 13, lineHeight: 16, color: o.ink, textDecorationLine: r.mine ? "underline" : "none" }}>
              {r.emoji} {r.count}
            </Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// De kop zonder cover, en de weergaven
// ---------------------------------------------------------------

function ViewHead({ f }: { f: Feed }) {
  const { t, view } = f;
  const o = useOmslag();
  const [a, ...b] = (view === "friends" ? t.perFriend : view === "time" ? t.byTime : t.editie).split(" ");
  return (
    <View style={{ paddingTop: 14, paddingHorizontal: PAD, paddingBottom: 20, gap: 8 }}>
      <Label size={8.5} weight={500} ls={0.2} color={o.dim}>
        {t.edition}
        {f.edition ? ` · № ${f.edition}` : ""} · {t.omNoAlgo}
      </Label>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Black size={50} f={0.84} ls={-0.055}>
          {a}
        </Black>
        {b.length ? (
          <Ser size={40} italic f={0.9}>
            {b.join(" ")}
          </Ser>
        ) : null}
      </View>
      <Ser size={17} italic f={1.35} color={o.dim}>
        {f.fresh ? `${f.fresh} ${t.new}` : t.upToDate}
      </Ser>
    </View>
  );
}

function Views({ f }: { f: Feed }) {
  const { t, view, changeView } = f;
  const o = useOmslag();
  const options = [
    { value: "editie" as const, label: t.editie },
    { value: "friends" as const, label: t.perFriend },
    { value: "time" as const, label: t.byTime },
  ];
  return (
    <View style={{ backgroundColor: o.paper, paddingHorizontal: PAD, flexDirection: "row", gap: 15, borderBottomWidth: OMSLAG.rule, borderBottomColor: o.ink }}>
      {options.map((v) => {
        const on = view === v.value;
        return (
          <Pressable
            key={v.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => changeView(v.value)}
            style={{ height: 44, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: on ? o.red : "transparent", marginBottom: -OMSLAG.rule }}
          >
            <Label size={12} ls={0.08} color={on ? o.red : o.ink}>
              {v.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------
// Blokkop, spreads en index — dezelfde vorm als desktop, op telefoonmaat
// ---------------------------------------------------------------

function BlockHead({
  f,
  top = SEAM,
  fill,
  bg = "transparent",
  kicker,
  kickRed = false,
  name,
  nameSize,
  onName,
  sub,
  act,
  toggle,
}: {
  f: Feed;
  top?: number;
  fill: string;
  bg?: string;
  kicker: string;
  kickRed?: boolean;
  name: string;
  nameSize: number;
  onName?: () => void;
  sub?: string;
  act?: { label: string; onPress: () => void };
  toggle?: { open: boolean; onPress: () => void };
}) {
  const o = useOmslag();
  const nameEl = (
    <Ser size={nameSize} italic f={0.95} ls={-0.02} numberOfLines={1}>
      {name}
    </Ser>
  );
  return (
    <View
      style={{
        marginTop: top,
        marginHorizontal: SEAM,
        paddingTop: 16,
        paddingRight: 14,
        paddingBottom: 14,
        paddingLeft: 18 - SPINE,
        borderLeftWidth: SPINE,
        borderLeftColor: fill,
        backgroundColor: bg,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Label size={9} ls={0.1} color={kickRed ? o.red : o.ink} style={{ flex: 1 }}>
          {kicker}
        </Label>
        {toggle ? <RoundGlyph glyph="+" size={34} fontSize={20} rotate={toggle.open ? 45 : 0} onPress={toggle.onPress} label={toggle.open ? f.t.closeAll : f.t.openAll} /> : null}
      </View>
      {onName ? (
        <Pressable accessibilityRole="link" onPress={onName}>
          {nameEl}
        </Pressable>
      ) : (
        nameEl
      )}
      {sub ? (
        <Ser size={15} italic f={1.3} color={o.dim} numberOfLines={2}>
          {sub}
        </Ser>
      ) : null}
      {act ? (
        <View style={{ flexDirection: "row", marginTop: 2 }}>
          <LabelLink size={9} onPress={act.onPress}>
            {act.label}
          </LabelLink>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Eén spread. `memo`, met alleen stabiele props: bij het openklappen van
 * een vriend of een nieuwe reactie hoeven de spreads die al stonden niet
 * opnieuw getekend.
 */
const SpreadRow = memo(function SpreadRow({
  p,
  index,
  first,
  number,
  mine,
  onOpen,
  onPrivate,
  t,
  lang,
}: {
  p: Tile;
  index: number;
  /** De eerste van een reeks: de `paddingTop: SEAM` van het oude omhulsel. */
  first: boolean;
  number: string;
  mine: boolean;
  onOpen: (p: CardPost) => void;
  onPrivate: (g: { authorId: string; name: string }, p?: CardPost) => void;
  t: Dict;
  lang: Lang;
}) {
  const o = useOmslag();
  const fc = friendColor(p.hue, o.scheme);
  return (
    <View style={first ? { paddingTop: SEAM } : null}>
      {/* Bewust géén `accessibilityRole="button"`: op web wordt dat een
          <button>, en daar mag de knop "Bericht" niet in. */}
      <Spread
        index={index}
        page="feed"
        fill={fc.fill}
        ink={fc.ink}
        rail={`№ ${number} · ${p.authorName} · ${timeLabel(p.createdAt, t, lang)}`}
        onPress={() => onOpen(p)}
        accessibilityLabel={p.title}
        media={<KindPreview post={p} scheme={o.scheme} variant="papier" />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {p.isNew ? <NewTag label={t.new} size={8} /> : null}
          <SpreadKicker ink={fc.ink}>{p.kind}</SpreadKicker>
        </View>
        <SpreadTitle ink={fc.ink}>{p.untitled ? p.caption || p.kind : p.title}</SpreadTitle>
        <View style={{ gap: 10 }}>
          {p.caption && !p.untitled ? (
            <SpreadCaption ink={fc.ink} numberOfLines={2}>
              {p.caption}
            </SpreadCaption>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t.comment} ${p.commentCount}`}
              onPress={() => onOpen(p)}
              style={{ paddingVertical: 13, marginVertical: -13 }}
            >
              <SpreadKicker ink={fc.ink}>
                {t.comment}
                {p.commentCount ? ` · ${p.commentCount}` : ""}
              </SpreadKicker>
            </Pressable>
            {mine ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.privateMsg}
                onPress={() => onPrivate({ authorId: p.authorId, name: p.authorName }, p)}
                style={{ paddingVertical: 13, marginVertical: -13 }}
              >
                <SpreadKicker ink={fc.ink}>{t.privateShort}</SpreadKicker>
              </Pressable>
            )}
          </View>
        </View>
      </Spread>
    </View>
  );
});

/**
 * Eén rij van de inhoudsopgave (wat je al zag, en een ingeklapte vriend):
 * rode nummers en titels, tussen lijnen van 2.
 *
 * Het omhulsel van de hele opgave (marge, `marginTop: SEAM`, de onderlijn)
 * staat nu per rij: marge op elke rij, de bovenmarge op de eerste en de
 * onderlijn onder de laatste. `hue` is `null` zonder naam (een ingeklapte
 * vriend: daar staat de naam al in de kop).
 */
const IndexRow = memo(function IndexRow({
  p,
  number,
  hue,
  first,
  last,
  onOpen,
  t,
  lang,
}: {
  p: CardPost;
  number: string;
  hue: Hue | null;
  first: boolean;
  last: boolean;
  onOpen: (p: CardPost) => void;
  t: Dict;
  lang: Lang;
}) {
  const o = useOmslag();
  const withName = hue !== null;
  return (
    <View
      style={{
        marginHorizontal: PAD - 6,
        ...(first ? { marginTop: SEAM } : null),
        ...(last ? { borderBottomWidth: OMSLAG.rule, borderBottomColor: o.ink } : null),
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={p.title}
        onPress={() => onOpen(p)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "baseline", gap: 14, paddingTop: 12, paddingBottom: 11, borderTopWidth: OMSLAG.rule, borderTopColor: o.ink, opacity: pressed ? 0.7 : 1 })}
      >
        <Black size={30} f={0.8} ls={-0.04} style={{ width: 48 }}>
          {number}
        </Black>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {withName ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: friendColor(hue, o.scheme).fill }} /> : null}
            <Label size={9} ls={0.08} style={{ flexShrink: 1 }}>
              {withName ? `${p.authorName} · ` : ""}
              {p.kind} · {timeLabel(p.createdAt, t, lang)}
            </Label>
          </View>
          <Ser size={22} italic f={1.05} numberOfLines={2}>
            {p.untitled ? p.caption || p.kind : p.title}
          </Ser>
        </View>
      </Pressable>
    </View>
  );
});

// ---------------------------------------------------------------
// Per vriend en op tijd
// ---------------------------------------------------------------

/** De kop van één vriend in Per vriend; zijn spreads of opgave volgen als losse items. */
function FriendBlockHead({ f, g, isNew, open, fresh, kicker }: { f: Feed; g: FriendGroup; isNew: boolean; open: boolean; fresh: number; kicker: string }) {
  const { t } = f;
  const o = useOmslag();
  const fc = friendColor(g.hue, o.scheme);
  const n = g.posts.length;
  const canPrivate = !g.isGroup && !f.isMine(g.authorId);
  return (
    <BlockHead
      f={f}
      fill={fc.fill}
      bg={isNew ? o.tint(fc.fill) : "transparent"}
      kicker={`${kicker} · ${isNew ? `${fresh} ${t.new}` : t.read} · ${n} ${n === 1 ? t.post1 : t.posts}`}
      kickRed={isNew}
      name={g.name}
      nameSize={isNew ? 40 : 30}
      onName={() => f.openProfile(g)}
      sub={g.bio || (g.isGroup ? t.group : undefined)}
      act={canPrivate && isNew ? { label: `${t.omPrivateTo} ${g.name}`, onPress: () => f.privateAbout(g) } : undefined}
      toggle={{ open, onPress: () => f.toggleOpen(g.key) }}
    />
  );
}

// ---------------------------------------------------------------
// Het einde: geen algoritme, geen oneindig scrollen
// ---------------------------------------------------------------

function End({ f }: { f: Feed }) {
  const { t } = f;
  const o = useOmslag();
  const [a, ...b] = t.caughtUp.split(". ");
  return (
    <View style={{ paddingTop: 34, paddingHorizontal: PAD, paddingBottom: 30, gap: 16 }}>
      <View>
        <Ser size={34} italic f={1}>
          {b.length ? `${a}.` : a}
        </Ser>
        {b.length ? (
          <Black size={34} f={1} ls={-0.04} upper>
            {b.join(". ")}
          </Black>
        ) : null}
      </View>
      <RedButton label={t.newPost} onPress={f.compose} style={{ alignSelf: "flex-start" }} />
      <Label size={9} weight={500} ls={0.2} color={o.dim} numberOfLines={2}>
        {t.endLine}
      </Label>
    </View>
  );
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
