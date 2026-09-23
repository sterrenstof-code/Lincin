import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { color, friendColor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { capf, head, mono, sans } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

import { EmptyFeed } from "../feed/EmptyFeed";
import { useFeed, type Feed } from "../feed/useFeed";
import { DesktopFeedMagazine } from "./DesktopFeedMagazine";
import { DesktopFeedModern } from "./DesktopFeedModern";
import { DesktopShell } from "./Shell";

/**
 * De feed op desktop (desktop-kleur-home.dc.html, handoff 23 sep).
 *
 * Drie weergaven, onthouden per gebruiker:
 *
 *   Editie      de voorpagina: de nieuwste foto die je nog niet zag groot,
 *               rechts "Ook nieuw" als genummerde regels, daaronder de rest
 *               van de editie in vier kolommen. Standaard op desktop.
 *   Per vriend  twee groepen, Nieuw en Gezien. Elke vriend een band in zijn
 *               kleur; ingeklapt zie je naam, status en titels, open de
 *               kaarten in een raster van vier. Een geziene vriend is
 *               ingeklapt één rij met zijn bijdragen als labels.
 *   Op tijd     inktbanden per dag, kaarten nieuwste eerst.
 *
 * Onderaan het einde: geen algoritme, geen oneindig scrollen, en de oproep
 * "Je bent helemaal bij. Jouw beurt?".
 *
 * Thema-onafhankelijk opgebouwd: de rand, de ronding, de koppen en of een
 * strook gevuld is komen uit `useThemeSpec()`.
 */

const PAD = 32;
const CARD_H = 430;

export function DesktopFeed() {
  const f = useFeed();
  const { t, view, feed, sheet, setSheet } = f;
  const scheme = useScheme();
  const spec = useThemeSpec();
  const ed = useEdition(f);

  if (spec.id === "magazine") return <DesktopFeedMagazine f={f} ed={ed} />;
  if (spec.id === "modern") return <DesktopFeedModern f={f} ed={ed} />;

  const noFriends = f.empty && f.friendCount === 0;
  const firstNew = f.sections.neu[0];
  // Per vriend kleurt het blad met de eerste nieuwe vriend (kleur); de editie
  // blijft papier.
  const tint = view === "friends" && firstNew ? friendColor(firstNew.hue, scheme).fill : null;

  let body: ReactNode;
  if (feed.isLoading) body = <Note text={t.loading} />;
  else if (feed.isError) body = <Note text={t.failed} />;
  else if (noFriends) body = <EmptyFeed />;
  else if (view === "editie") body = <Edition f={f} ed={ed} />;
  else if (view === "friends") body = <ByFriend f={f} />;
  else body = <ByTime f={f} />;

  return (
    <DesktopShell active="feed" tint={tint}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Head f={f} />
        {body}
        {!feed.isLoading && !noFriends ? <End onCompose={f.compose} editie={view === "editie"} /> : null}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

// ---------------------------------------------------------------
// De editie: wat er op de voorpagina staat
// ---------------------------------------------------------------

export type Tile = CardPost & { hue: Hue; isNew: boolean };

function useEdition(f: Feed) {
  const { byTime, groups, seen, isMine } = f;
  return useMemo(() => {
    const hueOf = new Map(groups.map((g) => [g.key, g.hue]));
    const tiles: Tile[] = byTime
      .filter((c) => !isMine(c.authorId))
      .map((c) => ({ ...c, hue: hueOf.get(c.authorId) ?? "orange", isNew: !seen.has(c.id) }));
    const unread = tiles.filter((p) => p.isNew);
    const hero = unread.find((p) => p.media.kind === "foto") ?? unread[0] ?? tiles[0] ?? null;
    const alsoNew = unread.filter((p) => p !== hero);
    const rest = tiles.filter((p) => !p.isNew && p !== hero);
    return { hero, alsoNew, rest, friends: new Set(tiles.map((p) => p.authorId)).size, total: tiles.length };
  }, [byTime, groups, seen, isMine]);
}

export type EditionData = ReturnType<typeof useEdition>;

// ---------------------------------------------------------------
// De kop: kicker, titel, teller en de weergaveschakelaar
// ---------------------------------------------------------------

function Head({ f }: { f: Feed }) {
  const { t, view, changeView, fresh } = f;
  const spec = useThemeSpec();
  const lang = useLang();
  const now = new Date();
  const date = now.toLocaleDateString(lang === "nl" ? "nl-BE" : lang === "de" ? "de-DE" : "en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  const kicker =
    view === "editie"
      ? `${t.editie} ${date} · ${f.byTime.length} ${t.postsFrom} ${f.groups.length} ${t.friends}`
      : view === "friends"
        ? t.kickerFriends
        : t.kickerTime;
  return (
    <View
      style={{
        paddingTop: 36,
        paddingHorizontal: PAD,
        paddingBottom: 24,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 32,
        borderBottomWidth: view === "editie" ? spec.border : 0,
        borderBottomColor: color("ink"),
      }}
    >
      <View style={{ gap: 12, flexShrink: 1 }}>
        <Text style={metaStyle(10, color("ink", "inkDim"), 1.2, 500)}>{kicker}</Text>
        <Text numberOfLines={1} style={[capf(false, true), { fontSize: 56, lineHeight: 56, letterSpacing: -1.1, color: color("ink") }]}>
          {t.feedA} <Text style={capf(true, true)}>{t.feedB}</Text>
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Dot on={fresh > 0} size={8} />
          <Text style={metaStyle(11, color("ink"), 0.88, 600)}>{fresh ? `${fresh} ${t.new}` : t.upToDate}</Text>
        </View>
        <ViewSwitch
          value={view}
          onChange={changeView}
          options={[
            { value: "editie", label: t.editie },
            { value: "friends", label: t.perFriend },
            { value: "time", label: t.byTime },
          ]}
        />
      </View>
    </View>
  );
}

/** De weergaveschakelaar op desktop: 36 hoog, een haarlijn, mono 600 10. */
function ViewSwitch<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const spec = useThemeSpec();
  const round = spec.id === "modern";
  return (
    <View
      style={{
        flexDirection: "row",
        height: 36,
        borderWidth: 1,
        borderColor: color("ink", "linePaper"),
        borderRadius: round ? 999 : 0,
        overflow: "hidden",
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              paddingHorizontal: 14,
              justifyContent: "center",
              backgroundColor: on ? color("ink") : "transparent",
              borderRadius: round ? 999 : 0,
              borderLeftWidth: i && !round ? 1 : 0,
              borderLeftColor: color("ink", "linePaper"),
            }}
          >
            <Text style={metaStyle(10, on ? color("paper") : color("ink"), 0.8, 600)}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------
// EDITIE
// ---------------------------------------------------------------

function Edition({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t } = f;
  const spec = useThemeSpec();
  const scheme = useScheme();
  const lang = useLang();
  const line = color("ink");
  const h = ed.hero;
  if (!h) return null;
  const fc = friendColor(h.hue, scheme);
  const bandBg = spec.stripFilled ? fc.fill : color("paper");
  const bandInk = spec.stripFilled ? fc.ink : color("ink");
  const n = ed.alsoNew.length + (h.isNew ? 1 : 0);
  return (
    <View>
      <View style={{ flexDirection: "row", borderBottomWidth: spec.border, borderBottomColor: line }}>
        {/* De voorpagina */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={h.title}
          onPress={() => f.openPost(h)}
          style={{ flex: 8, minWidth: 0, borderRightWidth: spec.border, borderRightColor: line }}
        >
          <View style={{ height: 440, overflow: "hidden" }}>
            <Media media={h.media} height={440} hue={h.hue} postId={h.id} myUserId={f.myUserId} size="page" />
            <Chip
              style={{ position: "absolute", top: 16, left: PAD }}
              bg={h.isNew ? color("red") : color("ink")}
              fg={color("paper")}
              label={h.isNew ? t.newFront : t.seenFront}
            />
          </View>
          <View
            style={{
              backgroundColor: bandBg,
              borderTopWidth: spec.border,
              borderTopColor: line,
              borderLeftWidth: spec.stripFilled ? 0 : 6,
              borderLeftColor: fc.fill,
              paddingTop: 22,
              paddingHorizontal: PAD,
              paddingBottom: 24,
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 32,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
              <Text style={metaStyle(10, bandInk, 1.2, 600)}>
                № {f.numberOf(h.id)} · {h.authorName} · {h.kind} · {timeLabel(h.createdAt, t, lang)}
              </Text>
              <Text numberOfLines={3} style={[head(), { fontSize: 84, lineHeight: 72, letterSpacing: -1.26, color: bandInk }]}>
                {h.title}
              </Text>
            </View>
            <View style={{ width: 300, gap: 14 }}>
              {h.caption ? <Text style={[capf(), { fontSize: 21, lineHeight: 25, color: bandInk }]}>{h.caption}</Text> : null}
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                <Reacts list={f.reactions.grouped(h.id)} onReact={(e) => f.reactions.toggle(h.id, e)} ink={bandInk} />
                <Text style={[metaStyle(10, bandInk, 0.6, 600), { marginLeft: 6, textDecorationLine: "underline" }]}>
                  {t.comment} · {h.commentCount}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Ook nieuw */}
        <View style={{ flex: 4, minWidth: 0 }}>
          <View style={{ paddingTop: 20, paddingHorizontal: 24, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: spec.border, borderBottomColor: line }}>
            <View style={{ width: 8, height: 8, backgroundColor: color("red") }} />
            <Text style={metaStyle(11, color("ink"), 1.1, 600)}>{t.alsoNew}</Text>
          </View>
          {ed.alsoNew.length ? (
            ed.alsoNew.slice(0, 4).map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="link"
                accessibilityLabel={p.title}
                onPress={() => f.openPost(p)}
                style={{ flex: 1, flexDirection: "row", gap: 16, paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: color("ink", "linePaper") }}
              >
                <Text style={[head(), { width: 56, fontSize: 48, lineHeight: 40, color: friendColor(p.hue, scheme).fill }]}>{f.numberOf(p.id)}</Text>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Text numberOfLines={1} style={metaStyle(9, color("ink", "inkDim"), 0.9, 600)}>
                    {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
                  </Text>
                  <Text numberOfLines={2} style={[head(), { fontSize: 30, lineHeight: 28, color: color("ink") }]}>
                    {p.title}
                  </Text>
                  {p.caption ? (
                    <Text numberOfLines={2} style={[capf(), { fontSize: 16, lineHeight: 20, color: color("ink", "inkDim") }]}>
                      {p.caption}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          ) : (
            <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 10 }}>
              <Text style={[head(), { fontSize: 32, lineHeight: 30, color: color("ink") }]}>{t.upToDateDot}</Text>
              <Text style={[capf(true), { fontSize: 18, lineHeight: 22, color: color("ink", "inkDim") }]}>{t.allSeenBelow}</Text>
            </View>
          )}
          <View style={{ paddingVertical: 16, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={metaStyle(10, color("ink", "inkDim"), 0.8, 500)}>{n ? `${n} ${t.unreadN}` : t.allRead}</Text>
            {n ? (
              <Pressable accessibilityRole="button" onPress={f.markAllRead}>
                <Text style={[metaStyle(10, color("ink"), 0.8, 500), { textDecorationLine: "underline" }]}>{t.markAllRead}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {ed.rest.length ? (
        <>
          <View style={{ paddingTop: 28, paddingHorizontal: PAD, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Dot on={false} size={9} />
            <Text style={metaStyle(11, color("ink"), 1.1, 600)}>{t.restOfEdition}</Text>
            <Text style={metaStyle(11, color("ink", "inkDim"), 0.66, 500)}>
              {t.alreadySeen} · {ed.rest.length}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: color("ink", "linePaper") }} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", borderTopWidth: spec.border, borderBottomWidth: spec.border, borderColor: line }}>
            {ed.rest.map((p) => (
              <RestTile key={p.id} f={f} p={p} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function RestTile({ f, p }: { f: Feed; p: Tile }) {
  const scheme = useScheme();
  const lang = useLang();
  const { t } = f;
  const rule = color("ink", "linePaper");
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.title}
      onPress={() => f.openPost(p)}
      style={[{ width: "25%", borderRightWidth: 1, borderBottomWidth: 1, borderColor: rule }, hover()]}
    >
      <View style={{ height: 6, backgroundColor: friendColor(p.hue, scheme).fill }} />
      <View style={{ height: 190, overflow: "hidden", borderBottomWidth: 1, borderBottomColor: rule }}>
        <Media media={p.media} height={190} hue={p.hue} postId={p.id} myUserId={f.myUserId} />
      </View>
      <View style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}>
        <Text numberOfLines={1} style={metaStyle(9, color("ink", "inkDim"), 0.9, 600)}>
          № {f.numberOf(p.id)} · {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
        </Text>
        <Text numberOfLines={2} style={[head(), { fontSize: 26, lineHeight: 24, color: color("ink") }]}>
          {p.title}
        </Text>
        {p.caption ? (
          <Text numberOfLines={2} style={[capf(), { fontSize: 16, lineHeight: 20, color: color("ink", "inkDim") }]}>
            {p.caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// PER VRIEND
// ---------------------------------------------------------------

function ByFriend({ f }: { f: Feed }) {
  const { t } = f;
  const { neu, old } = f.sections;
  const nNew = neu.reduce((s, g) => s + f.freshIn(g).length, 0);
  const nOld = old.reduce((s, g) => s + g.posts.length, 0);
  const anyOpen = old.some((g) => f.isOpen(g.key));
  const out: ReactNode[] = [];

  if (neu.length) {
    out.push(
      <SectionHead
        key="h-new"
        isNew
        label={t.secNew}
        meta={`${nNew} ${t.posts} · ${neu.length} ${t.friends}`}
        action={t.markAllRead}
        onAction={f.markAllRead}
      />,
    );
    neu.forEach((g, gi) => {
      const open = f.isOpen(g.key);
      out.push(<Band key={`b-${g.key}`} f={f} g={g} isNew open={open} />);
      if (open) out.push(<Cards key={`c-${g.key}`} f={f} g={g} heroFirst={gi === 0} />);
    });
  }
  if (old.length) {
    out.push(
      <SectionHead
        key="h-old"
        label={neu.length ? t.secSeen : t.allRead}
        meta={`${nOld} ${t.posts} · ${old.length} ${t.friends}`}
        action={anyOpen ? t.closeAll : t.openAll}
        onAction={() => f.setAllOpen(old.map((g) => g.key), !anyOpen)}
        style={{ marginTop: neu.length ? 40 : 0 }}
      />,
    );
    old.forEach((g, gi) => {
      if (f.isOpen(g.key)) {
        out.push(<Band key={`b-${g.key}`} f={f} g={g} isNew={false} open />);
        out.push(<Cards key={`c-${g.key}`} f={f} g={g} heroFirst={false} />);
      } else {
        out.push(<SeenRow key={`r-${g.key}`} f={f} g={g} top={gi === 0 || f.isOpen(old[gi - 1].key)} />);
      }
    });
  }
  return <View style={{ paddingTop: 8 }}>{out}</View>;
}

function SectionHead({
  label,
  meta,
  isNew = false,
  action,
  onAction,
  style,
}: {
  label: string;
  meta: string;
  isNew?: boolean;
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  const spec = useThemeSpec();
  return (
    <View style={[{ height: 40, paddingHorizontal: PAD, flexDirection: "row", alignItems: "center", gap: 12 }, style]}>
      <Dot on={isNew} size={9} />
      <Text style={metaStyle(11, color("ink"), 1.1, 600)}>{label}</Text>
      <Text style={metaStyle(11, color("ink", "inkDim"), 0.66, 500)}>{meta}</Text>
      <View style={{ flex: 1, height: isNew ? spec.border : 1, backgroundColor: isNew ? color("ink") : color("ink", "linePaper") }} />
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={[metaStyle(10, color("ink"), 0.8, 500), { textDecorationLine: "underline" }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** De band van een vriend: initiaal, naam, status, aantal, Bericht, +. */
function Band({ f, g, isNew, open }: { f: Feed; g: FriendGroup; isNew: boolean; open: boolean }) {
  const { t } = f;
  const spec = useThemeSpec();
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(g.hue, scheme);
  const filled = isNew && spec.bandFilled;
  const bg = filled ? fc.fill : spec.cardFill === "tile" ? color("tile", "tileFill") : color("paper");
  const ink = filled ? fc.ink : color("ink");
  const fresh = f.freshIn(g);
  const status = isNew
    ? [`${fresh.length} ${t.new}`, ...fresh.map((p) => p.title || `${p.kind} ${timeLabel(p.createdAt, t, lang)}`)].join(" · ")
    : t.read;
  const n = g.posts.length;
  const mine = f.isMine(g.authorId);
  return (
    <View
      style={{
        marginTop: 14,
        marginHorizontal: PAD,
        height: 56,
        paddingLeft: 16,
        paddingRight: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: bg,
        borderWidth: spec.cardBorder,
        borderColor: color("ink"),
        borderLeftWidth: filled ? spec.cardBorder : 6,
        borderLeftColor: filled ? color("ink") : fc.fill,
        borderRadius: spec.cardRadius,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: g.isGroup ? 0 : 16,
          backgroundColor: isNew ? color("paper") : fc.fill,
          borderWidth: spec.border,
          borderColor: color("ink"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={[sans(700), { fontSize: 14, lineHeight: 17, color: isNew ? color("ink") : fc.ink }]}>{g.initial}</Text>
      </View>
      <Pressable accessibilityRole="link" onPress={() => f.openProfile(g)}>
        <Text numberOfLines={1} style={[head(), { fontSize: 26, lineHeight: 26, color: ink, textDecorationLine: "underline" }]}>
          {g.name}
        </Text>
      </Pressable>
      {g.isGroup ? (
        <View style={{ borderWidth: 1.5, borderColor: ink, paddingHorizontal: 5, paddingVertical: 2 }}>
          <Text style={metaStyle(9, ink, 0.72, 600)}>{t.group}</Text>
        </View>
      ) : null}
      <Text numberOfLines={1} style={[metaStyle(10, ink, 1, 600), { flexShrink: 1, minWidth: 0 }]}>
        {status}
      </Text>
      <View style={{ flex: 1 }} />
      <Text style={[metaStyle(10, ink, 0.6, 500), { opacity: 0.8 }]}>
        {n} {n === 1 ? t.post1 : t.posts}
      </Text>
      {mine ? null : (
        <Pressable accessibilityRole="button" onPress={() => f.privateAbout(g)}>
          <Text style={[metaStyle(10, ink, 0.8, 600), { textDecorationLine: "underline" }]}>{t.privateMsg}</Text>
        </Pressable>
      )}
      <Toggle open={open} ink={ink} onPress={() => f.toggleOpen(g.key)} label={open ? t.closeAll : t.openAll} />
    </View>
  );
}

/** Het raster van kaarten onder een open band: vier kolommen, de eerste van de eerste nieuwe vriend dubbel. */
function Cards({ f, g, heroFirst }: { f: Feed; g: FriendGroup; heroFirst: boolean }) {
  const [w, setW] = useState(0);
  const gap = 16;
  const col = w ? (w - gap * 3) / 4 : 0;
  const mine = f.isMine(g.authorId);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - PAD * 2)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap, paddingTop: 16, paddingHorizontal: PAD, paddingBottom: 10 }}
    >
      {col
        ? g.posts.map((p, k) => {
            const hero = heroFirst && k === 0;
            return <Card key={p.id} f={f} p={p} hue={g.hue} width={hero ? col * 2 + gap : col} hero={hero} />;
          })
        : null}
      {col && !mine ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => f.privateAbout(g)}
          style={{ width: col, minHeight: 120, borderWidth: 1.5, borderStyle: "dashed", borderColor: color("ink", "inkDim"), alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <Text style={[capf(true), { fontSize: 20, lineHeight: 24, textAlign: "center", color: color("ink", "inkDim") }]}>
            {f.t.sayTo} {g.name} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Een kaart van 430 hoog: de kleurrug van 34 met het № en "wie · soort ·
 * tijd" gedraaid, het beeld, de titelstrook, het bijschrift, en een voet
 * met de reacties en Comment · n. De dubbele kaart legt beeld en tekst naast
 * elkaar, met de lopende tekst eronder.
 */
function Card({ f, p, hue, width, hero }: { f: Feed; p: CardPost; hue: Hue; width: number; hero: boolean }) {
  const { t } = f;
  const spec = useThemeSpec();
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(hue, scheme);
  const line = color("ink");
  const isNew = !f.seen.has(p.id);
  const spine = spec.spine;
  const stripBg = spec.stripFilled ? fc.fill : "transparent";
  const stripInk = spec.stripFilled ? fc.ink : color("ink");
  const mediaW = hero ? (width - spine) * 0.48 : width - spine;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.title}
      onPress={() => f.openPost(p)}
      style={{
        width,
        height: CARD_H,
        flexDirection: "row",
        borderWidth: spec.cardBorder,
        borderColor: line,
        borderRadius: spec.cardRadius,
        overflow: "hidden",
        backgroundColor: spec.cardFill === "tile" ? color("tile", "tileFill") : color("paper"),
      }}
    >
      <View style={{ width: spine, backgroundColor: fc.fill, alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderRightWidth: spec.cardBorder, borderRightColor: line }}>
        <Text style={metaStyle(10, fc.ink, 0, 600)}>{f.numberOf(p.id)}</Text>
        <Vertical text={`${p.authorName} · ${p.kind} · ${timeLabel(p.createdAt, t, lang)}`} color={fc.ink} length={CARD_H - 70} />
      </View>
      <View style={{ flex: 1, minWidth: 0, flexDirection: hero ? "row" : "column" }}>
        <View style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden", borderRightWidth: hero ? spec.cardBorder : 0, borderRightColor: line }}>
          <Media media={p.media} height={hero ? CARD_H : 230} hue={hue} postId={p.id} myUserId={f.myUserId} />
          {isNew ? <Chip style={{ position: "absolute", top: 10, left: 10 }} bg={color("red")} fg={color("paper")} label={t.new} /> : null}
        </View>
        <View style={{ flex: hero ? 1 : undefined, width: hero ? undefined : mediaW, minWidth: 0 }}>
          <View
            style={{
              backgroundColor: stripBg,
              borderLeftWidth: spec.stripFilled ? 0 : 6,
              borderLeftColor: fc.fill,
              borderTopWidth: hero ? 0 : spec.cardBorder,
              borderTopColor: line,
              paddingVertical: hero ? 18 : 12,
              paddingHorizontal: hero ? 20 : 14,
            }}
          >
            <Text numberOfLines={hero ? 3 : 2} style={[head(), { fontSize: hero ? 44 : 24, lineHeight: hero ? 40 : 22, color: stripInk }]}>
              {p.title}
            </Text>
          </View>
          <View style={{ flex: hero ? 1 : undefined, paddingVertical: 10, paddingHorizontal: 14, minHeight: 58, overflow: "hidden" }}>
            {p.caption ? (
              <Text numberOfLines={hero ? 4 : 2} style={[capf(), { fontSize: hero ? 21 : 16, lineHeight: hero ? 26 : 19.5, color: color("ink", "inkDim") }]}>
                {p.caption}
              </Text>
            ) : null}
            {hero && p.body ? (
              <Text numberOfLines={6} style={[sans(400), { fontSize: 14, lineHeight: 19.6, marginTop: 10, color: color("ink") }]}>
                {p.body}
              </Text>
            ) : null}
          </View>
          <View style={{ height: 44, flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, borderTopColor: color("ink", "linePaper") }}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, overflow: "hidden" }}>
              {p.reactable ? <Reacts list={f.reactions.grouped(p.id)} onReact={(e) => f.reactions.toggle(p.id, e)} ink={color("ink")} /> : null}
            </View>
            <View style={{ paddingHorizontal: 12, justifyContent: "center", borderLeftWidth: 1, borderLeftColor: color("ink", "linePaper") }}>
              <Text style={metaStyle(10, color("ink"), 0.6, 600)}>
                {t.comment} · {p.commentCount}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Een geziene vriend, ingeklapt: naam, zijn bijdragen als labels, "Gelezen · n", +. */
function SeenRow({ f, g, top }: { f: Feed; g: FriendGroup; top: boolean }) {
  const { t } = f;
  const spec = useThemeSpec();
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(g.hue, scheme);
  const rule = color("ink", "linePaper");
  const n = g.posts.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${g.name}, ${t.openAll}`}
      onPress={() => f.toggleOpen(g.key)}
      style={[
        {
          marginHorizontal: PAD,
          minHeight: 76,
          flexDirection: "row",
          alignItems: "center",
          gap: 24,
          borderBottomWidth: 1,
          borderBottomColor: rule,
          borderTopWidth: top ? spec.border : 0,
          borderTopColor: color("ink"),
        },
        hover(),
      ]}
    >
      <View style={{ width: 240, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: g.isGroup ? 0 : 16, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
          <Text style={[sans(700), { fontSize: 14, lineHeight: 17, color: fc.ink }]}>{g.initial}</Text>
        </View>
        <Text numberOfLines={1} style={[head(), { flexShrink: 1, fontSize: 24, lineHeight: 24, color: color("ink") }]}>
          {g.name}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", gap: 10, overflow: "hidden" }}>
        {g.posts.slice(0, 6).map((p) => (
          <View
            key={p.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
              paddingLeft: 8,
              paddingRight: 12,
              borderWidth: 1,
              borderColor: rule,
              borderRadius: spec.cardRadius,
              backgroundColor: spec.cardFill === "tile" ? color("tile", "tileFill") : color("paper"),
            }}
          >
            <View style={{ width: 28, height: 28, borderRadius: spec.cardRadius ? 8 : 0, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
              <Text style={metaStyle(9, fc.ink, 0, 600)}>{f.numberOf(p.id)}</Text>
            </View>
            <Text style={metaStyle(9, color("ink", "inkDim"), 0.72, 500)}>
              {p.kind} · {timeLabel(p.createdAt, t, lang)}
            </Text>
            {p.untitled ? null : (
              <Text numberOfLines={1} style={[capf(), { maxWidth: 220, fontSize: 17, lineHeight: 19, color: color("ink") }]}>
                {p.title}
              </Text>
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Text style={metaStyle(10, color("ink", "inkDim"), 0.6, 500)}>
          {t.read} · {n} {n === 1 ? t.post1 : t.posts}
        </Text>
        <Toggle open={false} ink={color("ink")} label={t.openAll} />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// OP TIJD
// ---------------------------------------------------------------

function ByTime({ f }: { f: Feed }) {
  const { t } = f;
  const spec = useThemeSpec();
  const hueOf = new Map(f.groups.map((g) => [g.key, g.hue]));
  return (
    <View style={{ paddingTop: 8 }}>
      {f.timeGroups.map((tg) => {
        const fresh = tg.posts.filter((p) => !f.seen.has(p.id)).length;
        return (
          <View key={tg.key}>
            <View
              style={{
                marginTop: 14,
                marginHorizontal: PAD,
                height: 56,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                backgroundColor: color("ink"),
                borderRadius: spec.cardRadius,
              }}
            >
              <Text style={[head(), { fontSize: 26, lineHeight: 26, color: color("paper") }]}>{tg.label}</Text>
              <Text style={metaStyle(10, color("paper"), 1, 600)}>{tg.range}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[metaStyle(10, color("paper"), 0.6, 500), { opacity: 0.8 }]}>
                {tg.posts.length} {tg.posts.length === 1 ? t.post1 : t.posts}
                {fresh ? ` · ${fresh} ${t.new}` : ""}
              </Text>
            </View>
            <TimeCards f={f} posts={tg.posts} hueOf={hueOf} />
          </View>
        );
      })}
    </View>
  );
}

function TimeCards({ f, posts, hueOf }: { f: Feed; posts: CardPost[]; hueOf: Map<string, Hue> }) {
  const [w, setW] = useState(0);
  const gap = 16;
  const col = w ? (w - gap * 3) / 4 : 0;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - PAD * 2)}
      style={{ flexDirection: "row", flexWrap: "wrap", gap, paddingTop: 16, paddingHorizontal: PAD, paddingBottom: 10 }}
    >
      {col ? posts.map((p) => <Card key={p.id} f={f} p={p} hue={hueOf.get(p.authorId) ?? "orange"} width={col} hero={false} />) : null}
    </View>
  );
}

// ---------------------------------------------------------------
// Het einde
// ---------------------------------------------------------------

function End({ onCompose, editie }: { onCompose: () => void; editie: boolean }) {
  const t = useT();
  const spec = useThemeSpec();
  return (
    <View style={{ paddingTop: 48, paddingHorizontal: PAD, paddingBottom: 64, flexDirection: "row", alignItems: "center", gap: 32 }}>
      <Text style={[metaStyle(10, color("ink", "inkDim"), 1, 500), { flex: 1 }]}>{editie ? t.editionEnd : t.endLine}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.newPost}
        onPress={onCompose}
        style={{
          flex: 1,
          padding: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          backgroundColor: color("acid"),
          borderWidth: spec.cardBorder,
          borderColor: color("ink"),
          borderRadius: spec.cardRadius,
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={[head(), { fontSize: 30, lineHeight: 29, color: ACID_INK }]}>{t.caughtUp}</Text>
          <Text style={[capf(true), { fontSize: 17, lineHeight: 21, marginTop: 6, color: ACID_INK }]}>{t.endSub}</Text>
        </View>
        <View style={{ width: 48, height: 48, backgroundColor: ACID_INK, borderRadius: spec.cardRadius, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 24, lineHeight: 28, color: color("acid") }}>+</Text>
        </View>
      </Pressable>
    </View>
  );
}

/** De inkt op de oproepkaart: het prototype zet er altijd #141414 op. */
const ACID_INK = "#141414";

// ---------------------------------------------------------------
// Kleine onderdelen
// ---------------------------------------------------------------

function metaStyle(size: number, c: string, spacing: number, weight: 500 | 600): TextStyle {
  return { ...mono(weight), fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

/** Het blokje voor Nieuw (rood, gevuld) of Gezien (een lege omtrek). */
function Dot({ on, size }: { on: boolean; size: number }) {
  return <View style={{ width: size, height: size, borderWidth: 1.5, borderColor: on ? color("red") : color("ink", "inkDim"), backgroundColor: on ? color("red") : "transparent" }} />;
}

function Chip({ label, bg, fg, style }: { label: string; bg: string; fg: string; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: bg, paddingVertical: 3, paddingHorizontal: 6 }, style]}>
      <Text style={metaStyle(9, fg, 0.9, 600)}>{label}</Text>
    </View>
  );
}

function Toggle({ open, ink, onPress, label }: { open: boolean; ink: string; onPress?: () => void; label: string }) {
  const spec = useThemeSpec();
  const box = (
    <View
      style={{
        width: 30,
        height: 30,
        borderWidth: 1.5,
        borderColor: ink,
        borderRadius: spec.id === "modern" ? 15 : 0,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: open ? "45deg" : "0deg" }],
      }}
    >
      <Text style={{ fontSize: 16, lineHeight: 18, color: ink }}>+</Text>
    </View>
  );
  if (!onPress) return box;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {box}
    </Pressable>
  );
}

function Reacts({ list, onReact, ink }: { list: GroupedPostReaction[]; onReact: (emoji: string) => void; ink: string }) {
  return (
    <>
      {list.slice(0, 4).map((r) => (
        <Pressable
          key={r.emoji}
          accessibilityRole="button"
          accessibilityState={{ selected: r.mine }}
          onPress={() => onReact(r.emoji)}
          style={{ height: 28, paddingHorizontal: 5, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: r.mine ? ink : "transparent" }}
        >
          <Text style={{ fontSize: 12, lineHeight: 15 }}>{r.emoji}</Text>
          <Text style={metaStyle(10, r.mine ? color("paper") : ink, 0, 600)}>{r.count}</Text>
        </Pressable>
      ))}
    </>
  );
}

/** Een regel die van onder naar boven leest, in de kleurrug. */
function Vertical({ text, color: c, length }: { text: string; color: string; length: number }) {
  if (Platform.OS === "web") {
    return (
      <Text
        numberOfLines={1}
        style={[metaStyle(10, c, 1, 600), { maxHeight: length, writingMode: "vertical-rl", transform: [{ rotate: "180deg" }] } as TextStyle]}
      >
        {text}
      </Text>
    );
  }
  return (
    <View style={{ width: 14, height: length, alignItems: "center", justifyContent: "flex-end" }}>
      <Text numberOfLines={1} style={[metaStyle(10, c, 1, 600), { width: length, transform: [{ rotate: "-90deg" }] }]}>
        {text}
      </Text>
    </View>
  );
}

function hover(): ViewStyle | null {
  return Platform.OS === "web" ? ({ cursor: "pointer" } as ViewStyle) : null;
}

function Note({ text }: { text: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <Text style={metaStyle(10, color("ink", "inkDim"), 0.8, 500)}>{text}</Text>
    </View>
  );
}
