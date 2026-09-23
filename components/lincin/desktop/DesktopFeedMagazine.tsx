import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { color, friendColor, pageTint, useScheme, type Hue } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { useLang } from "@/lib/i18n";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

import { EmptyFeed } from "../feed/EmptyFeed";
import type { Feed } from "../feed/useFeed";
import type { EditionData, Tile } from "./DesktopFeed";
import { DesktopShell } from "./Shell";

/**
 * De feed van magazine op desktop (desktop-magazine-home.dc.html).
 *
 *   Editie      een voorpagina van 640 hoog: het beeld van de nieuwste
 *               ongeziene bijdrage met "Lincin" in 236 er overheen, rechts
 *               de titel in 72 en "Ook nieuw" op het tweede vlak. Daaronder
 *               een kleefbalk "In deze editie", de nieuwe bijdragen als
 *               kleurvlakken (spreads) die van kant wisselen, en de rest als
 *               inhoudsopgave.
 *   Per vriend  een hoofdstuk per vriend, getint in zijn kleur (14% als er
 *               iets nieuw is, 7% gezien): links naam, feitjes en Privé,
 *               rechts ingeklapt de titels of open de kaarten.
 *   Op tijd     per dagdeel een kop en de spreads.
 *
 * Magazine kent geen kaders: vlakken met een naad van 6, haarlijnen, en de
 * kleurrug van 5 links.
 */

const SEAM = 6;

export function DesktopFeedMagazine({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t, view, feed, sheet, setSheet } = f;
  const scheme = useScheme();
  const noFriends = f.empty && f.friendCount === 0;
  const hero = ed.hero;
  const tabTint = view === "editie" && hero ? friendColor(hero.hue, scheme).fill : null;

  const children: ReactNode[] = [];
  const sticky: number[] = [];

  if (feed.isLoading) children.push(<Note key="l" text={t.loading} />);
  else if (noFriends) children.push(<EmptyFeed key="e" />);
  else {
    if (view === "editie" && hero) children.push(<Front key="front" f={f} ed={ed} hero={hero} />);
    else children.push(<ListHead key="lh" f={f} />);
    sticky.push(children.length);
    children.push(<Bar key="bar" f={f} />);
    if (view === "editie") children.push(<EditionBody key="body" f={f} ed={ed} />);
    else if (view === "friends") children.push(<Chapters key="body" f={f} />);
    else children.push(<TimeBody key="body" f={f} />);
    children.push(<End key="end" f={f} />);
  }

  return (
    <DesktopShell active="feed" tabTint={tabTint} hideMark={view === "editie"}>
      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={sticky} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

// ---------------------------------------------------------------
// De voorpagina
// ---------------------------------------------------------------

function Front({ f, ed, hero: h }: { f: Feed; ed: EditionData; hero: Tile }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(h.hue, scheme);
  const photo = h.media.kind === "foto" ? h.media.uri : null;
  return (
    <View style={{ flexDirection: "row", gap: SEAM, padding: SEAM }}>
      <Pressable accessibilityRole="link" accessibilityLabel={h.title} onPress={() => f.openPost(h)} style={{ flex: 1, minWidth: 0, height: 640, overflow: "hidden", backgroundColor: photo ? color("paper2") : fc.fill }}>
        {photo ? <SafeImage uri={photo} cacheKey={h.media.kind === "foto" ? h.media.cacheKey : undefined} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
        <Shade from="top" height={380} />
        <Shade from="bottom" height={140} />
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: fc.fill }} />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: 30, paddingHorizontal: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 20 }}>
            <Text style={label(10, PAPER_ON_PHOTO)}>
              {t.feedA} {t.feedB} · {ed.total} {t.postsFrom} {ed.friends} {t.friends}
            </Text>
            <Text style={label(10, PAPER_ON_PHOTO)}>{f.fresh ? `${f.fresh} ${t.new}` : t.upToDate}</Text>
          </View>
          <Text style={[serif(), { marginTop: 8, fontSize: 236, lineHeight: 198, letterSpacing: -9.4, color: PAPER_ON_PHOTO }]}>Lincin</Text>
        </View>
        <View pointerEvents="none" style={{ position: "absolute", left: 40, bottom: 26, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: h.isNew ? color("acid") : PAPER_ON_PHOTO }} />
          <Text style={label(10, PAPER_ON_PHOTO)}>{h.isNew ? t.newFront : t.seenFront}</Text>
        </View>
      </Pressable>

      <View style={{ width: 480, gap: SEAM }}>
        <Pressable
          accessibilityRole="link"
          onPress={() => f.openPost(h)}
          style={{ flex: 1, paddingTop: 32, paddingRight: 32, paddingBottom: 30, paddingLeft: 27, borderLeftWidth: 5, borderLeftColor: fc.fill, gap: 18, backgroundColor: color("paper") }}
        >
          <Text style={label(10, color("ink", "inkDim"))}>
            № {f.numberOf(h.id)} · {h.authorName} · {h.kind} · {timeLabel(h.createdAt, t, lang)}
          </Text>
          <Text numberOfLines={4} style={[serif(), { fontSize: 72, lineHeight: 68, letterSpacing: -2.2, color: color("ink") }]}>
            {h.title}
          </Text>
          {h.caption ? (
            <Text numberOfLines={4} style={[serif(true), { fontSize: 22, lineHeight: 30, color: color("ink", "inkDim") }]}>
              {h.caption}
            </Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <Text style={[label(10, color("ink"), 1.6), { textDecorationLine: "underline" }]}>
              {t.comment} · {h.commentCount}
            </Text>
            {f.isMine(h.authorId) ? null : (
              <Pressable accessibilityRole="button" onPress={() => f.privateAbout({ authorId: h.authorId, name: h.authorName }, h)}>
                <Text style={label(10, color("ink", "inkDim"), 1.6)}>{t.privateMsg}</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Reacts list={f.reactions.grouped(h.id)} onReact={(e) => f.reactions.toggle(h.id, e)} />
          </View>
        </Pressable>
        <View style={{ backgroundColor: color("paper2"), paddingTop: 22, paddingHorizontal: 28, paddingBottom: 20, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={[serif(), { fontSize: 26, lineHeight: 28, color: color("ink") }]}>
              {t.alsoNew.split(" ")[0]} <Text style={serif(true)}>{t.alsoNew.split(" ").slice(1).join(" ")}</Text>
            </Text>
            {f.fresh ? (
              <Pressable accessibilityRole="button" onPress={f.markAllRead}>
                <Text style={[label(9, color("ink")), { textDecorationLine: "underline" }]}>{t.markAllRead}</Text>
              </Pressable>
            ) : null}
          </View>
          {ed.alsoNew.length ? (
            ed.alsoNew.slice(0, 5).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="link"
                onPress={() => f.openPost(p)}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: color("ink", "linePaper") }}
              >
                <View style={{ width: 6, alignSelf: "stretch", backgroundColor: friendColor(p.hue, scheme).fill }} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text numberOfLines={1} style={label(9, color("ink", "inkDim"))}>
                    {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
                  </Text>
                  <Text numberOfLines={1} style={[serif(), { fontSize: 22, lineHeight: 23, color: color("ink") }]}>
                    {p.title}
                  </Text>
                </View>
                <Text style={label(9, color("ink", "inkDim"))}>№ {f.numberOf(p.id)}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={[serif(true), { paddingVertical: 10, borderTopWidth: 1, borderTopColor: color("ink", "linePaper"), fontSize: 19, lineHeight: 24, color: color("ink", "inkDim") }]}>
              {t.upToDateDot} {t.allSeenBelow}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** De tekst op een foto: het papier van magazine. */
const PAPER_ON_PHOTO = "#F7F4EE";

function Shade({ from, height }: { from: "top" | "bottom"; height: number }) {
  const web =
    Platform.OS === "web"
      ? ({
          backgroundImage:
            from === "top"
              ? "linear-gradient(180deg,rgba(16,16,12,.66),rgba(16,16,12,.34) 46%,rgba(16,16,12,0))"
              : "linear-gradient(0deg,rgba(16,16,12,.4),rgba(16,16,12,0))",
        } as object)
      : { backgroundColor: "rgba(16,16,12,.25)" };
  return <View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, height, [from]: 0 }, web]} />;
}

// ---------------------------------------------------------------
// Kop en kleefbalk
// ---------------------------------------------------------------

function ListHead({ f }: { f: Feed }) {
  const { t, view } = f;
  const [a, ...b] = (view === "friends" ? t.perFriend : t.byTime).split(" ");
  return (
    <View style={{ paddingTop: 40, paddingHorizontal: 32, paddingBottom: 26, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
      <View style={{ gap: 12 }}>
        <Text style={label(10, color("ink", "inkDim"))}>
          {t.editie}
          {f.edition ? ` · № ${f.edition}` : ""} · {f.fresh ? `${f.fresh} ${t.new}` : t.upToDate}
        </Text>
        <Text numberOfLines={1} style={[serif(), { fontSize: 96, lineHeight: 84, letterSpacing: -3.4, color: color("ink") }]}>
          {a} <Text style={serif(true)}>{b.join(" ")}</Text>
        </Text>
      </View>
      <Views f={f} size={11} />
    </View>
  );
}

function Views({ f, size }: { f: Feed; size: number }) {
  const { t, view, changeView } = f;
  const options = [
    { value: "editie" as const, label: t.editie },
    { value: "friends" as const, label: t.perFriend },
    { value: "time" as const, label: t.byTime },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 22, paddingBottom: 10 }}>
      {options.map((o) => {
        const on = view === o.value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => changeView(o.value)}>
            <Text style={[label(size, color("ink"), 1.6), { opacity: on ? 1 : 0.5, textDecorationLine: on ? "underline" : "none" }, underlineOffset(6)]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Bar({ f }: { f: Feed }) {
  const { t, view } = f;
  const n = f.byTime.length;
  const title =
    view === "editie"
      ? t.restOfEdition
      : view === "friends"
        ? `${f.groups.length} ${t.friends}`
        : `${f.timeGroups.length} ×`;
  return (
    // De wikkel dekt de naad links en rechts, zodat wat eronder doorschuift niet naast de balk uitsteekt.
    <View style={{ backgroundColor: color("paper"), paddingHorizontal: SEAM }}>
    <View style={{ paddingTop: 14, paddingHorizontal: 26, paddingBottom: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 24, borderBottomWidth: 1.5, borderBottomColor: color("ink") }}>
      <Text numberOfLines={1} style={[serif(), { fontSize: 30, lineHeight: 32, color: color("ink") }]}>
        {view === "editie" ? (
          <>
            {t.inThisA} <Text style={serif(true)}>{t.inThisB}</Text>
          </>
        ) : (
          title
        )}
      </Text>
      {view === "editie" ? (
        <Views f={f} size={10} />
      ) : (
        <Text style={label(9, color("ink", "inkDim"))}>
          {n} {t.posts} · {f.fresh ? `${f.fresh} ${t.new}` : t.allRead}
        </Text>
      )}
    </View>
    </View>
  );
}

// ---------------------------------------------------------------
// De editie: spreads en inhoudsopgave
// ---------------------------------------------------------------

function EditionBody({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t } = f;
  return (
    <View>
      {ed.alsoNew.length ? <Spreads f={f} posts={ed.alsoNew} /> : null}
      {ed.rest.length ? (
        <>
          <ChapterHead kicker={`${t.alreadySeen} · ${ed.rest.length} ${t.posts}`} name={t.restOfEdition} size={40} top={40} />
          <Toc f={f} posts={ed.rest} />
        </>
      ) : null}
    </View>
  );
}

function ChapterHead({ kicker, name, size, top }: { kicker: string; name: string; size: number; top: number }) {
  return (
    <View style={{ marginTop: top, marginHorizontal: SEAM, paddingTop: 18, paddingRight: 26, paddingBottom: 16, paddingLeft: 21, borderLeftWidth: 5, borderLeftColor: color("ink"), gap: 8 }}>
      <Text style={[label(9, color("ink")), { opacity: 0.8 }]}>{kicker}</Text>
      <Text numberOfLines={1} style={[serif(), { fontSize: size, lineHeight: size * 0.95, letterSpacing: -size * 0.03, color: color("ink") }]}>
        {name}
      </Text>
    </View>
  );
}

/** Kleurvlakken van twee per rij; de metarail en het beeld wisselen van kant. */
function Spreads({ f, posts }: { f: Feed; posts: Tile[] }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const [w, setW] = useState(0);
  const col = w ? (w - SEAM) / 2 : 0;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - SEAM * 2)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM, paddingTop: SEAM, paddingHorizontal: SEAM }}
    >
      {(col ? posts : []).map((p, k) => {
        const fc = friendColor(p.hue, scheme);
        const flip = k % 2 === 1;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="link"
            accessibilityLabel={p.title}
            onPress={() => f.openPost(p)}
            style={{ width: col, height: 320, flexDirection: flip ? "row-reverse" : "row", backgroundColor: fc.fill }}
          >
            <View style={{ width: 30, alignItems: "center", justifyContent: "center" }}>
              <Vertical text={`№ ${f.numberOf(p.id)} · ${p.authorName} · ${timeLabel(p.createdAt, t, lang)}`} color={fc.ink} length={300} />
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingVertical: 24, paddingHorizontal: 22, justifyContent: "space-between", gap: 14, alignItems: flip ? "flex-end" : "flex-start" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: 0.85 }}>
                {p.isNew ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fc.ink }} /> : null}
                <Text style={label(9, fc.ink, 2.2)}>{p.isNew ? `${t.new} · ${p.kind}` : p.kind}</Text>
              </View>
              <Text numberOfLines={4} style={[serif(), { fontSize: 40, lineHeight: 38, letterSpacing: -1, color: fc.ink, textAlign: flip ? "right" : "left" }]}>
                {p.title}
              </Text>
              <View style={{ gap: 12, alignItems: flip ? "flex-end" : "flex-start" }}>
                {p.caption ? (
                  <Text numberOfLines={3} style={[serif(true), { maxWidth: 360, fontSize: 17, lineHeight: 22, color: fc.ink, opacity: 0.88, textAlign: flip ? "right" : "left" }]}>
                    {p.caption}
                  </Text>
                ) : null}
                <Text style={[label(9, fc.ink), { opacity: 0.85, textDecorationLine: "underline" }]}>
                  {t.comment} · {p.commentCount}
                </Text>
              </View>
            </View>
            <View style={{ width: "42%", overflow: "hidden", backgroundColor: color("paper") }}>
              <Media media={p.media} height={320} hue={p.hue} postId={p.id} myUserId={f.myUserId} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Toc({ f, posts }: { f: Feed; posts: Tile[] }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  return (
    <View style={{ marginHorizontal: SEAM, paddingHorizontal: 26 }}>
      {posts.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="link"
          accessibilityLabel={p.title}
          onPress={() => f.openPost(p)}
          style={{ minHeight: 68, flexDirection: "row", alignItems: "center", gap: 22, borderBottomWidth: 1, borderBottomColor: color("ink", "linePaper") }}
        >
          <View style={{ width: 6, alignSelf: "stretch", marginVertical: 14, backgroundColor: friendColor(p.hue, scheme).fill }} />
          <Text numberOfLines={1} style={[label(9, color("ink", "inkDim")), { width: 220 }]}>
            {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
          </Text>
          <Text numberOfLines={1} style={[serif(), { flex: 1, minWidth: 0, fontSize: 26, lineHeight: 28, color: color("ink") }]}>
            {p.title}
            {p.caption ? <Text style={[serif(true), { fontSize: 17, color: color("ink", "inkDim") }]}> — {p.caption}</Text> : null}
          </Text>
          <Text style={[label(9, color("ink", "inkDim")), { width: 120, textAlign: "right" }]}>
            {t.comment} · {p.commentCount}
          </Text>
          <Text style={[serif(), { width: 80, textAlign: "right", fontSize: 22, lineHeight: 24, color: color("ink", "inkDim") }]}>№ {f.numberOf(p.id)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------
// Per vriend: hoofdstukken
// ---------------------------------------------------------------

function Chapters({ f }: { f: Feed }) {
  const { t } = f;
  const { neu, old } = f.sections;
  const all = [...neu, ...old];
  return (
    <View>
      {all.map((g, gi) => {
        const isNew = gi < neu.length;
        const first = gi === 0 || gi === neu.length;
        return (
          <View key={g.key}>
            {first ? (
              <SectionLabel
                isNew={isNew}
                label={isNew ? t.secNew : neu.length ? t.secSeen : t.allRead}
                action={isNew ? t.markAllRead : undefined}
                onAction={isNew ? f.markAllRead : undefined}
                top={isNew || !neu.length ? 22 : 40}
              />
            ) : null}
            <Chapter f={f} g={g} isNew={isNew} idx={gi} total={all.length} />
          </View>
        );
      })}
    </View>
  );
}

function SectionLabel({ isNew, label: text, action, onAction, top }: { isNew: boolean; label: string; action?: string; onAction?: () => void; top: number }) {
  return (
    <View style={{ marginTop: top, marginHorizontal: 32, marginBottom: 4, height: 34, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: isNew ? color("acid") : color("ink", "inkDim"), backgroundColor: isNew ? color("acid") : "transparent" }} />
      <Text style={label(10, color("ink"))}>{text}</Text>
      <View style={{ flex: 1 }} />
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={[label(9, color("ink")), { textDecorationLine: "underline" }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Chapter({ f, g, isNew, idx, total }: { f: Feed; g: FriendGroup; isNew: boolean; idx: number; total: number }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(g.hue, scheme);
  const open = f.isOpen(g.key);
  const fresh = f.freshIn(g);
  const bg = pageTint(fc.fill, scheme, isNew ? { light: 0.14, dark: 0.12 } : { light: 0.07, dark: 0.06 });
  const facts = isNew
    ? [
        { k: t.secNew, v: `${fresh.length} / ${g.posts.length}` },
        { k: "·", v: timeLabel(g.latest, t, lang) },
      ]
    : [{ k: t.read, v: `${g.posts.length} ${g.posts.length === 1 ? t.post1 : t.posts}` }];
  const two = (n: number) => String(n).padStart(2, "0");
  return (
    <View
      style={{
        marginTop: SEAM,
        marginHorizontal: SEAM,
        flexDirection: "row",
        gap: 40,
        paddingVertical: open ? 24 : 20,
        paddingHorizontal: 26,
        borderLeftWidth: 5,
        borderLeftColor: fc.fill,
        backgroundColor: bg,
      }}
    >
      <View style={{ width: 300, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={label(10, color("ink", "inkDim"))}>
            {two(idx + 1)} / {two(total)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={open ? t.closeAll : t.openAll}
            onPress={() => f.toggleOpen(g.key)}
            style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: color("ink"), alignItems: "center", justifyContent: "center", transform: [{ rotate: open ? "45deg" : "0deg" }] }}
          >
            <Text style={[serif(), { fontSize: 20, lineHeight: 22, color: color("ink") }]}>+</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="link" onPress={() => f.openProfile(g)} style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: fc.fill, transform: [{ translateY: -4 }] }} />
          <Text numberOfLines={1} style={[serif(), { flexShrink: 1, fontSize: isNew ? 56 : 36, lineHeight: (isNew ? 56 : 36) * 1.05, letterSpacing: isNew ? -1.4 : -0.9, color: color("ink") }]}>
            {g.name}
          </Text>
        </Pressable>
        {g.bio || g.isGroup ? (
          <Text numberOfLines={3} style={[serif(true), { fontSize: 17, lineHeight: 22, color: color("ink", "inkDim") }]}>
            {g.bio || t.group}
          </Text>
        ) : null}
        <View style={{ borderTopWidth: 1, borderTopColor: color("ink", "linePaper") }}>
          {facts.map((fa) => (
            <View key={fa.k} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: color("ink", "linePaper") }}>
              <Text style={label(9, color("ink", "inkDim"))}>{fa.k}</Text>
              <Text style={label(9, isNew ? color("ink") : color("ink", "inkDim"))}>{fa.v}</Text>
            </View>
          ))}
        </View>
        {isNew && !g.isGroup && !f.isMine(g.authorId) ? (
          <Pressable accessibilityRole="button" onPress={() => f.privateAbout(g)}>
            <Text style={[serif(), { marginTop: 4, fontSize: 18, lineHeight: 22, color: color("ink"), textDecorationLine: "underline" }]}>
              {t.privateMsg} · {g.name} →
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Dicht is dicht: geen lijst met titels, alleen de kop. */}
        {open ? <ChapterCards f={f} g={g} /> : null}
      </View>
    </View>
  );
}

function ChapterCards({ f, g }: { f: Feed; g: FriendGroup }) {
  const [w, setW] = useState(0);
  const col = w ? (w - SEAM) / 2 : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM }}>
      {col ? g.posts.map((p) => <ChapterCard key={p.id} f={f} p={p} hue={g.hue} width={g.posts.length === 1 ? w : col} />) : null}
    </View>
  );
}

function ChapterCard({ f, p, hue, width }: { f: Feed; p: CardPost; hue: Hue; width: number }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const isNew = !f.seen.has(p.id);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.title}
      onPress={() => f.openPost(p)}
      style={{ width, height: 300, backgroundColor: color("paper"), borderTopWidth: 4, borderTopColor: friendColor(hue, scheme).fill }}
    >
      <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
        <View style={{ width: "46%", overflow: "hidden" }}>
          <Media media={p.media} height={256} hue={hue} postId={p.id} myUserId={f.myUserId} />
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingVertical: 20, paddingHorizontal: 22, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isNew ? (
              <>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color("acid") }} />
                <Text style={label(9, color("ink"))}>{t.new} ·</Text>
              </>
            ) : null}
            <Text style={label(9, color("ink", "inkDim"))}>{p.kind}</Text>
          </View>
          <Text numberOfLines={3} style={[serif(), { fontSize: 34, lineHeight: 33, letterSpacing: -0.7, color: color("ink") }]}>
            {p.title}
          </Text>
          {p.caption ? (
            <Text numberOfLines={3} style={[serif(true), { fontSize: 16, lineHeight: 21, color: color("ink", "inkDim") }]}>
              {p.caption}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 22, borderTopWidth: 1, borderTopColor: color("ink", "linePaper") }}>
        <Text style={label(9, color("ink", "inkDim"))}>№ {f.numberOf(p.id)}</Text>
        <Text style={label(9, color("ink", "inkDim"))}>{timeLabel(p.createdAt, t, lang)}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[label(9, color("ink")), { textDecorationLine: "underline" }]}>
          {t.comment} · {p.commentCount}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// Op tijd
// ---------------------------------------------------------------

function TimeBody({ f }: { f: Feed }) {
  const { t } = f;
  const hueOf = new Map(f.groups.map((g) => [g.key, g.hue]));
  return (
    <View>
      {f.timeGroups.map((tg, i) => (
        <View key={tg.key}>
          <ChapterHead kicker={`${tg.range} · ${tg.posts.length} ${t.posts}`} name={tg.label} size={56} top={i ? 40 : SEAM} />
          <Spreads f={f} posts={tg.posts.map((p) => ({ ...p, hue: hueOf.get(p.authorId) ?? "orange", isNew: !f.seen.has(p.id) }))} />
        </View>
      ))}
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
    <View style={{ paddingTop: 48, paddingHorizontal: 32, paddingBottom: 70, flexDirection: "row", alignItems: "flex-end", gap: 32 }}>
      <Text style={[label(9, color("ink", "inkDim")), { flex: 1 }]}>{f.view === "editie" ? t.editionEnd : t.endLine}</Text>
      <Pressable accessibilityRole="button" onPress={f.compose} style={{ flex: 1, gap: 10 }}>
        <Text style={[serif(), { fontSize: 44, lineHeight: 43, letterSpacing: -0.9, color: color("ink") }]}>
          {b.length ? `${a}. ` : a}
          {b.length ? <Text style={serif(true)}>{b.join(". ")}</Text> : null}
        </Text>
        <Text style={[label(10, color("acid"), 1.6), { textDecorationLine: "underline" }]}>{t.newPost} →</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------
// Klein
// ---------------------------------------------------------------

/** Archivo 500, kapitaal, ruim gespatieerd: de labels van magazine. */
function label(size: number, c: string, spacing = size * 0.2): TextStyle {
  return { ...sans(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

function underlineOffset(n: number): TextStyle | null {
  return Platform.OS === "web" ? ({ textUnderlineOffset: n } as TextStyle) : null;
}

function Reacts({ list, onReact }: { list: GroupedPostReaction[]; onReact: (emoji: string) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {list.slice(0, 4).map((r) => (
        <Pressable key={r.emoji} accessibilityRole="button" accessibilityState={{ selected: r.mine }} onPress={() => onReact(r.emoji)}>
          <Text style={{ fontSize: 13, lineHeight: 16, color: r.mine ? color("ink") : color("ink", "inkDim"), textDecorationLine: r.mine ? "underline" : "none" }}>
            {r.emoji} {r.count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Vertical({ text, color: c, length }: { text: string; color: string; length: number }) {
  const style = label(9, c, 2.2);
  if (Platform.OS === "web") {
    return (
      <Text numberOfLines={1} style={[style, { maxHeight: length, writingMode: "vertical-rl", transform: [{ rotate: "180deg" }] } as TextStyle]}>
        {text}
      </Text>
    );
  }
  return (
    <View style={{ width: 14, height: length, alignItems: "center", justifyContent: "center" }}>
      <Text numberOfLines={1} style={[style, { width: length, textAlign: "center", transform: [{ rotate: "-90deg" }] }]}>
        {text}
      </Text>
    </View>
  );
}

function Note({ text }: { text: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <Text style={label(10, color("ink", "inkDim"))}>{text}</Text>
    </View>
  );
}
