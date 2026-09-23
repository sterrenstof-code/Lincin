import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import { listEntityComments } from "@/lib/api/entity-comments";
import { OMSLAG, friendColor, type Hue } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { useLang, type Lang } from "@/lib/i18n";
import { displayName, timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

import { EmptyFeed } from "../feed/EmptyFeed";
import type { Feed } from "../feed/useFeed";
import { Black, Label, LabelLink, NewTag, PageTitle, Rail, RoundGlyph, SEAM, SPINE, Ser, Scrim, VText, Wordmark, useOmslag } from "../magazine/Omslag";
import type { EditionData, Tile } from "./DesktopFeed";
import { DesktopShell } from "./Shell";

/**
 * De feed van magazine op desktop: de OMSLAG (desktop-magazine-home.dc.html,
 * handoff 24 sep).
 *
 *   Editie      een tijdschriftcover van 960 hoog: de nieuwste foto die je
 *               nog niet zag, het rode woordmerk LINCIN in 340 erover met
 *               "& vrienden" verticaal ernaast, de rugtekst links, links
 *               "Jouw editie van vandaag" met de titel in serif cursief,
 *               rechts "Ook nieuw" met NAAM+ titel. Daaronder de nieuwe
 *               bijdragen als gekleurde spreads (om en om gespiegeld) en wat
 *               je al zag als "Inhoud", een index met rode nummers.
 *   Per vriend  een paginatitel **Per** *vriend*, dan per vriend een blok
 *               met een rug van 5 in zijn kleur, getint als er iets nieuw
 *               is. Twee groepen, Nieuw en Gezien. Standaard ingeklapt: de
 *               titels als index; open de spreads.
 *   Op tijd     **Op** *tijd*, per dagdeel een blok met spreads.
 *
 * De weergaven staan rechts in de balk (`navExtra`), met een rode streep
 * onder de actieve.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const COVER_H = 960;
const SPREAD_H = 340;
const webPointer = Platform.OS === "web" ? ({ cursor: "pointer" } as ViewStyle) : null;

export function DesktopFeedMagazine({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t, view, feed, sheet, setSheet } = f;
  const noFriends = f.empty && f.friendCount === 0;

  let body: ReactNode;
  if (feed.isLoading) body = <Note text={t.loading} />;
  else if (feed.isError) body = <Note text={t.failed} />;
  else if (noFriends) body = <EmptyFeed />;
  else if (view === "editie") body = <Edition f={f} ed={ed} />;
  else if (view === "friends") body = <ByFriend f={f} />;
  else body = <ByTime f={f} />;

  return (
    <DesktopShell active="feed" navExtra={<Views f={f} />}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {view !== "editie" && !noFriends && !feed.isLoading ? <ListHead f={f} /> : null}
        {body}
        {!feed.isLoading && !noFriends ? <End f={f} /> : null}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

// ---------------------------------------------------------------
// Weergaven, in de balk
// ---------------------------------------------------------------

function Views({ f }: { f: Feed }) {
  const { t, view, changeView } = f;
  const o = useOmslag();
  const options = [
    { value: "editie" as const, label: t.editie },
    { value: "friends" as const, label: t.perFriend },
    { value: "time" as const, label: t.byTime },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 24, alignSelf: "stretch" }}>
      {options.map((v) => {
        const on = view === v.value;
        return (
          <Pressable
            key={v.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => changeView(v.value)}
            style={[{ justifyContent: "center", borderTopWidth: 3, borderTopColor: "transparent", borderBottomWidth: 3, borderBottomColor: on ? o.red : "transparent" }, webPointer]}
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
// Editie: de cover
// ---------------------------------------------------------------

function useEditionLine() {
  const lang = useLang();
  const now = new Date();
  return {
    long: now.toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    short: now.toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, ""),
    year: now.getFullYear(),
  };
}

function Edition({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t } = f;
  const o = useOmslag();
  const seen = ed.rest;
  return (
    <View>
      {ed.hero ? <Cover f={f} ed={ed} hero={ed.hero} /> : null}
      {ed.alsoNew.length ? (
        <>
          <ChapterHead
            top={SEAM}
            fill={o.red}
            kicker={`${t.secNew} · ${ed.alsoNew.length} ${ed.alsoNew.length === 1 ? t.post1 : t.posts}`}
            kickRed
            name={t.alsoNew}
            nameSize={72}
            act={f.fresh ? { label: t.markAllRead, onPress: f.markAllRead } : undefined}
          />
          <Spreads f={f} posts={ed.alsoNew} />
        </>
      ) : null}
      {seen.length ? (
        <>
          <ChapterHead top={40} fill={o.ink} kicker={`${cap(t.alreadySeen)} · ${seen.length} ${seen.length === 1 ? t.post1 : t.posts}`} name={t.omContents} nameSize={72} />
          <Index f={f} posts={seen} />
        </>
      ) : null}
    </View>
  );
}

function Cover({ f, ed, hero: h }: { f: Feed; ed: EditionData; hero: Tile }) {
  const { t } = f;
  const o = useOmslag();
  const lang = useLang();
  const line = useEditionLine();
  const [w, setW] = useState(1428);
  const fc = friendColor(h.hue, o.scheme);
  const photo = h.media.kind === "foto" ? h.media : null;
  const fg = photo ? OMSLAG.onImage : fc.ink;
  const accent = photo ? OMSLAG.redOnImage : o.red;
  // Het woordmerk schaalt mee met de breedte; op 1428 is het 340.
  const k = Math.min(1, w / 1428);
  const mast = Math.round(340 * k);
  const top = 26 + Math.round(mast * 0.76) + 36;
  const roomy = w >= 1300;
  const comments = useQuery({
    queryKey: ["entity-comments", "post", h.id],
    queryFn: () => listEntityComments("post", h.id),
    enabled: h.commentCount > 0,
    staleTime: 60_000,
  });
  const cm = comments.data ?? [];
  const grouped = f.reactions.grouped(h.id);
  const spine = `${t.editie} ${line.short} ${line.year}${f.edition ? ` · ${t.omVol} ${f.edition}` : ""} · ${f.byTime.map((p) => `${p.authorName} — ${p.title}`).join(" / ")}`;
  // De covertitel op twee regels, zoals "Het licht / om 22:19".
  const words = h.title.split(" ");
  const half = Math.ceil(words.length / 2);
  return (
    <View style={{ paddingTop: SEAM, paddingHorizontal: SEAM }} onLayout={(e) => setW(e.nativeEvent.layout.width - SEAM * 2)}>
      <View style={{ height: COVER_H, overflow: "hidden", backgroundColor: fc.fill }}>
        {photo ? (
          <SafeImage uri={photo.uri} cacheKey={photo.cacheKey} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
        ) : null}
        {photo ? (
          <Scrim
            css="linear-gradient(90deg,rgba(20,10,8,.52),rgba(20,10,8,0) 46%,rgba(20,10,8,0) 70%,rgba(20,10,8,.38))"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : null}
        <Pressable accessibilityRole="link" accessibilityLabel={h.title} onPress={() => f.openPost(h)} style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, webPointer]} />
        <View style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, bottom: 0, width: SPINE, backgroundColor: fc.fill }} />

        <View style={{ pointerEvents: "none", position: "absolute", top: 14, right: 44 }}>
          <Label size={11} ls={0.06} color={accent}>
            {t.editie}
            {f.edition ? ` № ${f.edition}` : ""} · {line.long} · {t.omNoAlgo}
          </Label>
        </View>

        {/* het woordmerk, en "& vrienden" verticaal ernaast */}
        <View style={{ pointerEvents: "none", position: "absolute", left: 36, top: 26, flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
          <Wordmark size={mast} />
          <VText dir="down" length={Math.round(mast * 0.8)} thickness={Math.round(40 * k * 0.9)} style={[sans(900), { fontSize: Math.round(40 * k), letterSpacing: -0.8 * k, textTransform: "uppercase", color: o.red }]}>
            {t.omAndFriends}
          </VText>
        </View>

        {/* de rugtekst: alle titels van de editie */}
        <View style={{ pointerEvents: "none", position: "absolute", left: 14, top, bottom: 24, width: 16 }}>
          <VText length={COVER_H - top - 24} thickness={16} style={[sans(500), { fontSize: 12, letterSpacing: 0.48, textTransform: "uppercase", color: fg }]}>
            {spine}
          </VText>
        </View>

        {/* links: jouw editie van vandaag */}
        <Pressable accessibilityRole="link" onPress={() => f.openPost(h)} style={[{ position: "absolute", left: 52, top, width: 440 }, webPointer]}>
          <Text style={[sans(400), { fontSize: 40, lineHeight: 40, letterSpacing: -0.4, textTransform: "uppercase", color: fg }]}>{t.omCoverA}</Text>
          <Text style={[sans(800), { fontSize: 40, lineHeight: 40, letterSpacing: -0.4, textTransform: "uppercase", color: fg }]}>{t.omCoverB}</Text>
          <Text style={[sans(400), { marginTop: 6, fontSize: 15, lineHeight: 19, fontStyle: "italic", letterSpacing: 0.3, textTransform: "uppercase", color: fg }]}>
            {f.fresh ? `${f.fresh} ${t.new}` : t.upToDate} · {t.omFrom} {ed.friends} {ed.friends === 1 ? t.omFriend1 : t.omFriendsN}
          </Text>
          <Ser size={84} italic f={0.9} ls={-0.01} color={fg} numberOfLines={3} style={{ marginTop: 56 }}>
            {words.length > 1 ? `${words.slice(0, half).join(" ")}\n${words.slice(half).join(" ")}` : h.title}
          </Ser>
          <Text numberOfLines={4} style={[sans(400), { marginTop: 14, maxWidth: 380, fontSize: 17, lineHeight: 23, color: fg }]}>
            {h.authorName} · {h.kind} · {timeLabel(h.createdAt, t, lang)}.{h.caption ? ` ${h.caption}` : ""}
          </Text>
        </Pressable>

        {/* rechts: ook nieuw */}
        <View style={{ position: "absolute", right: 52, top, width: roomy ? 370 : 300, alignItems: "flex-end" }}>
          <Ser size={100} italic f={0.78} color={fg}>
            {t.alsoNew.split(" ")[0]}
          </Ser>
          <Ser size={64} italic f={0.9} color={fg} style={{ marginBottom: 22 }}>
            {t.alsoNew.split(" ").slice(1).join(" ")}
          </Ser>
          {ed.alsoNew.length ? (
            ed.alsoNew.slice(0, 5).map((p) => (
              <Pressable key={p.id} accessibilityRole="link" onPress={() => f.openPost(p)} style={[{ marginBottom: 16 }, webPointer]}>
                <Text numberOfLines={2} style={[sans(400), { fontSize: 19, lineHeight: 25, textAlign: "right", color: fg }]}>
                  <Text style={[sans(800), { color: accent, textTransform: "uppercase" }]}>{p.authorName}+</Text> {p.title}
                </Text>
              </Pressable>
            ))
          ) : (
            <Ser size={21} italic color={fg} style={{ marginBottom: 16, textAlign: "right" }}>
              {t.omRestSeen}
            </Ser>
          )}
          <View style={{ width: 160, height: 2, marginTop: 4, backgroundColor: o.red }} />
        </View>

        {/* de lopende tekst, met de eerste comments erin */}
        {roomy && (h.body || h.caption || cm.length) ? (
          <View style={{ pointerEvents: "none", position: "absolute", left: 560, top: top + 240, width: 320 }}>
            <Text numberOfLines={12} style={[serif(), { fontSize: 21, lineHeight: 27, color: fg, textAlign: "justify" }]}>
              {h.body || h.caption}
              {cm[0] ? (
                <>
                  {" "}
                  <Text style={[sans(400), { fontSize: 26, letterSpacing: 7.8, color: accent }]}>{displayName(cm[0].author).toUpperCase()}</Text> “{cm[0].body}”
                </>
              ) : null}
              {cm[1] ? ` ${displayName(cm[1].author)}: “${cm[1].body}”` : ""}
            </Text>
          </View>
        ) : null}

        {/* onderaan: open, en de reacties */}
        <View style={{ position: "absolute", left: 52, bottom: 40, flexDirection: "row", alignItems: "center", gap: 20 }}>
          <Pressable
            accessibilityRole="link"
            onPress={() => f.openPost(h)}
            style={(s) => {
              const hot = s.pressed || (s as { hovered?: boolean }).hovered;
              return [{ height: 48, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 28, backgroundColor: hot ? o.red : OMSLAG.onImage }, webPointer];
            }}
          >
            {(s) => {
              const hot = s.pressed || (s as { hovered?: boolean }).hovered;
              const c = hot ? OMSLAG.onImage : "#16160F";
              return (
                <>
                  <Label size={12} ls={0.08} color={c}>
                    {t.omOpenPost} № {f.numberOf(h.id)}
                  </Label>
                  <Text style={[sans(400), { fontSize: 18, lineHeight: 22, color: c }]}>→</Text>
                </>
              );
            }}
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {grouped.map((r) => (
              <Pressable key={r.emoji} accessibilityRole="button" accessibilityState={{ selected: r.mine }} onPress={() => f.reactions.toggle(h.id, r.emoji)} style={webPointer}>
                <Text style={[sans(600), { fontSize: 13, lineHeight: 17, letterSpacing: 0.5, color: fg, textDecorationLine: r.mine ? "underline" : "none" }]}>
                  {r.emoji} {r.count}
                </Text>
              </Pressable>
            ))}
            <Text style={[sans(600), { fontSize: 13, lineHeight: 17, letterSpacing: 0.5, color: fg }]}>
              {grouped.length ? "· " : ""}
              {t.comment} {h.commentCount}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// Een blokkop: rug, kicker, naam, en rechts een actie of +
// ---------------------------------------------------------------

function ChapterHead({
  top,
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
  top: number;
  fill: string;
  bg?: string;
  kicker: string;
  kickRed?: boolean;
  name: string;
  nameSize: number;
  onName?: () => void;
  sub?: string;
  act?: { label: string; onPress: () => void };
  toggle?: { open: boolean; onPress: () => void; label: string };
}) {
  const o = useOmslag();
  const nameEl = (
    <Ser size={nameSize} italic f={0.9} ls={-0.02} numberOfLines={1}>
      {name}
    </Ser>
  );
  return (
    <View
      style={{
        marginTop: top,
        marginHorizontal: SEAM,
        paddingTop: 22,
        paddingRight: 26,
        paddingBottom: 18,
        paddingLeft: 26 - SPINE,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 24,
        borderLeftWidth: SPINE,
        borderLeftColor: fill,
        backgroundColor: bg,
      }}
    >
      <View style={{ gap: 8, minWidth: 0, flexShrink: 1 }}>
        <Label size={11} color={kickRed ? o.red : o.ink}>
          {kicker}
        </Label>
        {onName ? (
          <Pressable accessibilityRole="link" onPress={onName} style={webPointer}>
            {nameEl}
          </Pressable>
        ) : (
          nameEl
        )}
      </View>
      <View style={{ flex: 1 }} />
      {sub ? (
        <Ser size={19} italic color={o.soft} numberOfLines={2} style={{ maxWidth: 360, textAlign: "right", opacity: 0.85 }}>
          {sub}
        </Ser>
      ) : null}
      {act ? <LabelLink onPress={act.onPress}>{act.label}</LabelLink> : null}
      {toggle ? <RoundGlyph glyph="+" size={40} fontSize={24} rotate={toggle.open ? 45 : 0} onPress={toggle.onPress} label={toggle.label} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------
// Spreads: twee per rij, om en om gespiegeld
// ---------------------------------------------------------------

function Spreads({ f, posts }: { f: Feed; posts: Tile[] }) {
  const [w, setW] = useState(0);
  const col = w ? (w - SEAM) / 2 : 0;
  const wide = posts.length === 1;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - SEAM * 2)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM, paddingTop: SEAM, paddingHorizontal: SEAM }}
    >
      {col ? posts.map((p, k) => <SpreadTile key={p.id} f={f} p={p} flip={k % 2 === 1} wide={wide} width={wide ? w : col} />) : null}
    </View>
  );
}

function SpreadTile({ f, p, flip, wide, width }: { f: Feed; p: Tile; flip: boolean; wide: boolean; width: number }) {
  const { t } = f;
  const o = useOmslag();
  const lang = useLang();
  const fc = friendColor(p.hue, o.scheme);
  const grouped = f.reactions.grouped(p.id).slice(0, 2);
  const align = flip ? "flex-end" : "flex-start";
  const title = p.untitled ? p.caption || p.kind : p.title;
  const titleSize = wide ? 60 : 44;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={() => f.openPost(p)}
      style={[{ width, height: SPREAD_H, flexDirection: flip ? "row-reverse" : "row", backgroundColor: fc.fill }, webPointer]}
    >
      <Rail text={`№ ${f.numberOf(p.id)} · ${p.authorName} · ${timeLabel(p.createdAt, t, lang)}`} color={fc.ink} />
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 24, paddingHorizontal: 22, justifyContent: "space-between", gap: 14, alignItems: align }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {p.isNew ? <NewTag label={t.new} /> : null}
          <Label size={10} ls={0.2} color={fc.ink}>
            {p.kind}
          </Label>
        </View>
        <Ser size={titleSize} f={0.96} ls={-0.025} color={fc.ink} numberOfLines={3} style={{ textAlign: flip ? "right" : "left" }}>
          {title}
        </Ser>
        <View style={{ gap: 12, alignItems: align }}>
          {p.caption && !p.untitled ? (
            <Ser size={18} italic f={1.3} color={fc.ink} numberOfLines={2} style={{ maxWidth: 380, opacity: 0.9, textAlign: flip ? "right" : "left" }}>
              {p.caption}
            </Ser>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Label size={10} ls={0.14} underline color={fc.ink}>
              {t.comment} · {p.commentCount}
            </Label>
            {grouped.map((r) => (
              <Pressable key={r.emoji} accessibilityRole="button" accessibilityState={{ selected: r.mine }} onPress={() => f.reactions.toggle(p.id, r.emoji)} hitSlop={8}>
                <Text style={{ fontSize: 13, lineHeight: 16, color: fc.ink, textDecorationLine: r.mine ? "underline" : "none" }}>
                  {r.emoji} {r.count}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={{ width: wide ? "56%" : "42%", overflow: "hidden", backgroundColor: o.paper }}>
        <Media media={p.media} height={SPREAD_H} hue={p.hue} postId={p.id} myUserId={f.myUserId} />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// De index: wat je al zag, en een ingeklapte vriend
// ---------------------------------------------------------------

function Index({ f, posts, hue }: { f: Feed; posts: CardPost[]; hue?: Hue }) {
  const { t } = f;
  const o = useOmslag();
  const lang = useLang();
  const hueOf = new Map(f.groups.map((g) => [g.key, g.hue]));
  return (
    <View style={{ marginHorizontal: 32, borderBottomWidth: OMSLAG.rule, borderBottomColor: o.ink }}>
      {posts.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="link"
          accessibilityLabel={p.title}
          onPress={() => f.openPost(p)}
          style={[{ flexDirection: "row", alignItems: "baseline", gap: 20, paddingTop: 16, paddingBottom: 14, borderTopWidth: OMSLAG.rule, borderTopColor: o.ink }, webPointer]}
        >
          {(s) => {
            const hot = s.pressed || (s as { hovered?: boolean }).hovered;
            return (
              <>
                <Black size={48} f={0.8} ls={-0.04} style={{ width: 90 }}>
                  {f.numberOf(p.id)}
                </Black>
                <View style={{ width: 150, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: friendColor(hue ?? hueOf.get(p.authorId) ?? "orange", o.scheme).fill }} />
                  <Label size={12} ls={0.08} color={hot ? o.red : o.ink} style={{ flexShrink: 1 }}>
                    {p.authorName}
                  </Label>
                </View>
                <Text numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[serif(true), { fontSize: 36, lineHeight: 38, color: hot ? o.red : o.ink }]}>{p.untitled ? p.caption || p.kind : p.title}</Text>
                  {p.caption && !p.untitled ? <Text style={[sans(400), { fontSize: 15, lineHeight: 20, color: o.dim }]}> {p.caption}</Text> : null}
                </Text>
                <Label size={11} ls={0.08} color={hot ? o.red : o.ink} style={{ width: 150, textAlign: "right" }}>
                  {p.kind} · {timeLabel(p.createdAt, t, lang)}
                </Label>
              </>
            );
          }}
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------
// Per vriend en op tijd
// ---------------------------------------------------------------

function ListHead({ f }: { f: Feed }) {
  const { t, view } = f;
  const o = useOmslag();
  const line = useEditionLine();
  const [a, ...b] = (view === "friends" ? t.perFriend : t.byTime).split(" ");
  return (
    <View
      style={{
        paddingTop: 40,
        paddingHorizontal: 40,
        paddingBottom: 28,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 40,
        borderBottomWidth: OMSLAG.rule,
        borderBottomColor: o.ink,
      }}
    >
      <PageTitle a={a} b={b.join(" ")} size={150} serifSize={110} />
      <View style={{ alignItems: "flex-end", gap: 6, paddingBottom: 6 }}>
        <Label size={12} ls={0.08}>
          {t.editie}
          {f.edition ? ` № ${f.edition}` : ""} · {line.short}
        </Label>
        <Label size={12} ls={0.08} color={o.red}>
          {f.fresh ? `${f.fresh} ${t.new}` : t.upToDate}
        </Label>
        <Label size={12} ls={0.08} weight={500}>
          {cap(t.omNoAlgo)}
        </Label>
      </View>
    </View>
  );
}

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
              <View style={{ marginTop: isNew || !neu.length ? 24 : 40, marginHorizontal: 32, marginBottom: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Label size={12} ls={0.08} color={isNew ? o.red : o.ink}>
                  {isNew ? t.secNew : t.secSeen}
                </Label>
                <View style={{ flex: 1 }} />
                {isNew ? <LabelLink onPress={f.markAllRead}>{t.markAllRead}</LabelLink> : null}
              </View>
            ) : null}
            <FriendChapter f={f} g={g} isNew={isNew} kicker={`${two(gi + 1)} / ${two(all.length)}`} />
          </View>
        );
      })}
    </View>
  );
}

function FriendChapter({ f, g, isNew, kicker }: { f: Feed; g: FriendGroup; isNew: boolean; kicker: string }) {
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
      <ChapterHead
        top={SEAM}
        fill={fc.fill}
        bg={isNew ? o.tint(fc.fill) : "transparent"}
        kicker={`${kicker} · ${isNew ? `${fresh} ${t.new}` : t.read} · ${n} ${n === 1 ? t.post1 : t.posts}`}
        kickRed={isNew}
        name={g.name}
        nameSize={isNew ? 72 : 48}
        onName={() => f.openProfile(g)}
        sub={g.bio || (g.isGroup ? t.group : undefined)}
        act={canPrivate ? { label: `${t.omPrivateTo} ${g.name}`, onPress: () => f.privateAbout(g) } : undefined}
        toggle={{ open, onPress: () => f.toggleOpen(g.key), label: open ? t.closeAll : t.openAll }}
      />
      {open ? <Spreads f={f} posts={tiles} /> : <Index f={f} posts={g.posts} hue={g.hue} />}
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
            <ChapterHead
              top={i ? 40 : SEAM}
              fill={o.ink}
              kicker={`${tg.range} · ${tg.posts.length} ${tg.posts.length === 1 ? t.post1 : t.posts}${n ? ` · ${n} ${t.new}` : ""}`}
              kickRed={n > 0}
              name={tg.label}
              nameSize={72}
            />
            <Spreads f={f} posts={tiles} />
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------
// Het einde
// ---------------------------------------------------------------

function End({ f }: { f: Feed }) {
  const { t } = f;
  const [a, ...b] = t.caughtUp.split(". ");
  return (
    <View style={{ paddingTop: 64, paddingHorizontal: 40, paddingBottom: 80, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.newPost} onPress={f.compose} style={[{ flexDirection: "row", alignItems: "baseline", gap: 24, flexWrap: "wrap", flexShrink: 1 }, webPointer]}>
        <Ser size={64} italic f={1}>
          {b.length ? `${a}.` : a}
        </Ser>
        {b.length ? (
          <Black size={64} f={1} ls={-0.04} upper>
            {b.join(". ")}
          </Black>
        ) : null}
      </Pressable>
      <Label size={11}>{t.omEnd}</Label>
    </View>
  );
}

// ---------------------------------------------------------------
// Klein
// ---------------------------------------------------------------

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function Note({ text }: { text: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <Label size={11} color={useOmslag().dim}>
        {text}
      </Label>
    </View>
  );
}
