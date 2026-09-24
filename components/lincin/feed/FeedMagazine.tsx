import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LincinScreen, useUnread, vfade } from "@/components/lincin/Chrome";
import { CircleGlyphBtn } from "@/components/lincin/chrome/Header";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import { OMSLAG, friendColor, useHueChoices } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

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

  const sticky: number[] = [];
  const children: ReactNode[] = [];

  if (feed.isLoading || noFriends) {
    // Leeg (prototype `magEmpty`): geen kopregel, maar de editie en het
    // grote woordmerk bovenaan — de omslag zonder foto.
    children.push(
      <View key="top" style={{ paddingTop: 8, paddingHorizontal: PAD, paddingBottom: 16, gap: 8 }}>
        <Label size={8.5} weight={500} ls={0.2} color={o.dim}>
          {t.edition}
          {f.edition ? ` · № ${f.edition}` : ""}
        </Label>
        <Wordmark size={108} />
      </View>,
    );
    children.push(
      feed.isLoading ? (
        <Label key="loading" size={9} weight={500} ls={0.2} color={o.dim} style={{ textAlign: "center", paddingVertical: 30 }}>
          {t.loading}
        </Label>
      ) : (
        <EmptyFeed key="empty" />
      ),
    );
  } else {
    if (cover) {
      children.push(<Cover key="cover" f={f} hero={hero!} />);
      children.push(<CoverCaption key="caption" f={f} hero={hero!} />);
    } else {
      children.push(<ViewHead key="head" f={f} />);
    }
    sticky.push(children.length);
    children.push(<Views key="views" f={f} />);
    if (view === "editie") children.push(<Edition key="body" f={f} alsoNew={ed.alsoNew} rest={ed.rest} />);
    else if (view === "friends") children.push(<ByFriend key="body" f={f} />);
    else children.push(<ByTime key="body" f={f} />);
    children.push(<End key="end" f={f} />);
  }

  return (
    // `tint` kleurt het blad niet (magazine tint niet), maar geeft de
    // rugstrook onderaan de kleur van de vriend op de cover.
    <LincinScreen tab="feed" header={cover || noFriends ? "none" : "default"} bleed={cover} tint={cover ? heroFill : null}>
      <ScrollView style={[{ flex: 1 }, cover ? null : vfade()]} stickyHeaderIndices={sticky} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
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
// Editie: ook nieuw, en de inhoud
// ---------------------------------------------------------------

function Edition({ f, alsoNew, rest }: { f: Feed; alsoNew: Tile[]; rest: Tile[] }) {
  const { t } = f;
  const o = useOmslag();
  return (
    <View>
      {alsoNew.length ? (
        <>
          <BlockHead
            f={f}
            fill={o.red}
            kicker={`${t.secNew} · ${alsoNew.length} ${alsoNew.length === 1 ? t.post1 : t.posts}`}
            kickRed
            name={t.alsoNew}
            nameSize={44}
            act={{ label: t.markAllRead, onPress: f.markAllRead }}
          />
          <Spreads f={f} posts={alsoNew} />
        </>
      ) : null}
      {rest.length ? (
        <>
          <BlockHead f={f} top={alsoNew.length ? 34 : SEAM} fill={o.ink} kicker={`${cap(t.alreadySeen)} · ${rest.length} ${rest.length === 1 ? t.post1 : t.posts}`} name={t.omContents} nameSize={44} />
          <Index f={f} posts={rest} />
        </>
      ) : null}
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

function Spreads({ f, posts }: { f: Feed; posts: Tile[] }) {
  const { t, lang } = f;
  const o = useOmslag();
  return (
    <View style={{ paddingTop: SEAM }}>
      {posts.map((p, i) => {
        const fc = friendColor(p.hue, o.scheme);
        return (
          // Bewust géén `accessibilityRole="button"`: op web wordt dat een
          // <button>, en daar mag de knop "Bericht" niet in.
          <Spread
            key={p.id}
            index={i}
            page="feed"
            fill={fc.fill}
            ink={fc.ink}
            rail={`№ ${f.numberOf(p.id)} · ${p.authorName} · ${timeLabel(p.createdAt, t, lang)}`}
            onPress={() => f.openPost(p)}
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
                  onPress={() => f.openPost(p)}
                  style={{ paddingVertical: 13, marginVertical: -13 }}
                >
                  <SpreadKicker ink={fc.ink}>
                    {t.comment}
                    {p.commentCount ? ` · ${p.commentCount}` : ""}
                  </SpreadKicker>
                </Pressable>
                {f.isMine(p.authorId) ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.privateMsg}
                    onPress={() => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)}
                    style={{ paddingVertical: 13, marginVertical: -13 }}
                  >
                    <SpreadKicker ink={fc.ink}>{t.privateShort}</SpreadKicker>
                  </Pressable>
                )}
              </View>
            </View>
          </Spread>
        );
      })}
    </View>
  );
}

/** Wat je al zag, en een ingeklapte vriend: rode nummers en titels, tussen lijnen van 2. */
function Index({ f, posts, withName = true }: { f: Feed; posts: CardPost[]; withName?: boolean }) {
  const { t, lang } = f;
  const o = useOmslag();
  const hueOf = new Map(f.groups.map((g) => [g.key, g.hue]));
  return (
    <View style={{ marginHorizontal: PAD - 6, marginTop: SEAM, borderBottomWidth: OMSLAG.rule, borderBottomColor: o.ink }}>
      {posts.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="link"
          accessibilityLabel={p.title}
          onPress={() => f.openPost(p)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "baseline", gap: 14, paddingTop: 12, paddingBottom: 11, borderTopWidth: OMSLAG.rule, borderTopColor: o.ink, opacity: pressed ? 0.7 : 1 })}
        >
          <Black size={30} f={0.8} ls={-0.04} style={{ width: 48 }}>
            {f.numberOf(p.id)}
          </Black>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {withName ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: friendColor(hueOf.get(p.authorId) ?? "orange", o.scheme).fill }} /> : null}
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
      ))}
    </View>
  );
}

// ---------------------------------------------------------------
// Per vriend en op tijd
// ---------------------------------------------------------------

function ByFriend({ f }: { f: Feed }) {
  const { t } = f;
  const o = useOmslag();
  const { neu, old } = f.sections;
  const all = [...neu, ...old];
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <View>
      {all.map((g, gi) => {
        const isNew = gi < neu.length;
        const first = gi === 0 || gi === neu.length;
        return (
          <View key={g.key}>
            {first ? (
              <View style={{ marginTop: isNew || !neu.length ? 18 : 34, marginHorizontal: PAD, marginBottom: 2, flexDirection: "row", alignItems: "center" }}>
                <Label size={11} ls={0.08} color={isNew ? o.red : o.ink} style={{ flex: 1 }}>
                  {isNew ? t.secNew : t.secSeen}
                </Label>
                {isNew ? (
                  <LabelLink size={9} onPress={f.markAllRead}>
                    {t.markAllRead}
                  </LabelLink>
                ) : null}
              </View>
            ) : null}
            <FriendBlock f={f} g={g} isNew={isNew} kicker={`${two(gi + 1)} / ${two(all.length)}`} />
          </View>
        );
      })}
    </View>
  );
}

function FriendBlock({ f, g, isNew, kicker }: { f: Feed; g: FriendGroup; isNew: boolean; kicker: string }) {
  const { t } = f;
  const o = useOmslag();
  const fc = friendColor(g.hue, o.scheme);
  const open = f.isOpen(g.key);
  const fresh = f.freshIn(g).length;
  const n = g.posts.length;
  const canPrivate = !g.isGroup && !f.isMine(g.authorId);
  const tiles: Tile[] = g.posts.map((p) => ({ ...p, hue: g.hue, isNew: !f.seen.has(p.id) }));
  return (
    <>
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
      {open ? <Spreads f={f} posts={tiles} /> : <Index f={f} posts={g.posts} withName={false} />}
    </>
  );
}

function ByTime({ f }: { f: Feed }) {
  const { t } = f;
  const o = useOmslag();
  const hueOf = new Map(f.groups.map((g) => [g.key, g.hue]));
  return (
    <View>
      {f.timeGroups.map((tg, i) => {
        const tiles: Tile[] = tg.posts.map((p) => ({ ...p, hue: hueOf.get(p.authorId) ?? "orange", isNew: !f.seen.has(p.id) }));
        const n = tiles.filter((p) => p.isNew).length;
        return (
          <View key={tg.key}>
            <BlockHead
              f={f}
              top={i ? 34 : SEAM}
              fill={o.ink}
              kicker={`${tg.range} · ${tg.posts.length} ${tg.posts.length === 1 ? t.post1 : t.posts}${n ? ` · ${n} ${t.new}` : ""}`}
              kickRed={n > 0}
              name={tg.label}
              nameSize={44}
            />
            <Spreads f={f} posts={tiles} />
          </View>
        );
      })}
    </View>
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
