import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { Media } from "@/components/lincin/Media";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import { RASTER, color, friendColor, pageTint, useScheme, type Hue } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { useLang } from "@/lib/i18n";
import { timeLabel, type CardPost, type FriendGroup } from "@/lib/lincin/model";

import { EmptyFeed } from "../feed/EmptyFeed";
import type { Feed } from "../feed/useFeed";
import type { EditionData, Tile } from "./DesktopFeed";
import { UpToDateMark } from "@/components/lincin/UpToDateMark";
import { DesktopShell } from "./Shell";

/**
 * De feed van modern op desktop (desktop-modern-home.dc.html): een raster
 * van twaalf kolommen met een naad van 6, alles losse tegels van 82% wit
 * met een ronding van 18 op de kleurhaze van de vriend.
 *
 *   Editie      links de titeltegel en "Ook nieuw", rechts het beeld van 520
 *               met de titel erin; daaronder Gezien als vier tegels en de
 *               rest als rijen van een halve breedte.
 *   Per vriend  een rij per vriend over de volle breedte, getint (22% nieuw,
 *               10% gezien); ingeklapt alleen naam en status, open de
 *               tegels eronder.
 *   Op tijd     een sectietegel per dagdeel en de tegels.
 */

const SEAM = RASTER.seam;
const R = RASTER.tileRadius;

export function DesktopFeedModern({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t, view, feed, sheet, setSheet } = f;
  const scheme = useScheme();
  const [w, setW] = useState(0);
  const unit = w ? (w - SEAM * 11) / 12 : 0;
  const span = (n: number) => n * unit + (n - 1) * SEAM;
  const noFriends = f.empty && f.friendCount === 0;
  const hero = view === "editie" ? ed.hero : null;
  const firstNew = f.sections.neu[0];
  const bloom = hero ? friendColor(hero.hue, scheme).fill : firstNew ? friendColor(firstNew.hue, scheme).fill : null;

  const blocks: ReactNode[] = [];
  if (unit && !feed.isLoading && !noFriends) {
    if (view === "editie") {
      if (ed.rest.length) {
        blocks.push(<Section key="s-seen" width={span(12)} label={t.secSeen} top={28} />);
        ed.rest.slice(0, 4).forEach((p) => blocks.push(<PostTile key={p.id} f={f} p={p} hue={p.hue} width={span(3)} />));
        ed.rest.slice(4).forEach((p) => blocks.push(<PostRow key={p.id} f={f} p={p} width={span(6)} />));
      }
    } else if (view === "friends") {
      const { neu, old } = f.sections;
      if (neu.length) blocks.push(<Section key="s-new" width={span(12)} label={t.secNew} isNew action={t.allRead} onAction={f.markAllRead} />);
      neu.forEach((g) => pushFriend(blocks, f, g, true, span));
      if (old.length) blocks.push(<Section key="s-old" width={span(12)} label={neu.length ? t.secSeen : t.allRead} top={neu.length ? 28 : 0} />);
      old.forEach((g) => pushFriend(blocks, f, g, false, span));
    } else {
      const hueOf = new Map(f.groups.map((g) => [g.key, g.hue]));
      f.timeGroups.forEach((tg, i) => {
        blocks.push(
          <Section key={`s-${tg.key}`} width={span(12)} label={tg.label} meta={`${tg.range} · ${tg.posts.length} ${t.posts}`} solid top={i ? 28 : 0} />,
        );
        tg.posts.forEach((p) => blocks.push(<PostTile key={p.id} f={f} p={p} hue={hueOf.get(p.authorId) ?? "orange"} width={span(3)} />));
      });
    }
  }

  return (
    <DesktopShell active="feed" tint={bloom}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM, alignContent: "flex-start" }}>
          {feed.isLoading ? (
            <Note text={t.loading} />
          ) : noFriends ? (
            <EmptyFeed />
          ) : unit ? (
            <>
              {hero ? (
                <>
                  <View style={{ width: span(4), gap: SEAM }}>
                    <TitleTile f={f} size={46} />
                    <AlsoNew f={f} ed={ed} />
                  </View>
                  <Hero f={f} p={hero} width={span(8)} />
                </>
              ) : (
                <TitleTile f={f} size={64} width={span(12)} />
              )}
              {blocks}
              <End f={f} width={span(12)} />
            </>
          ) : null}
        </View>
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </DesktopShell>
  );
}

function pushFriend(out: ReactNode[], f: Feed, g: FriendGroup, isNew: boolean, span: (n: number) => number) {
  const open = f.isOpen(g.key);
  out.push(<FriendRow key={`f-${g.key}`} f={f} g={g} isNew={isNew} open={open} width={span(12)} />);
  if (open) g.posts.forEach((p) => out.push(<PostTile key={p.id} f={f} p={p} hue={g.hue} width={span(g.posts.length === 1 ? 6 : 3)} />));
}

// ---------------------------------------------------------------
// Tegels
// ---------------------------------------------------------------

const tile = (): ViewStyle => ({
  borderRadius: R,
  backgroundColor: color("tile", "tileFill"),
  ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)" } as ViewStyle) : null),
});

function TitleTile({ f, size, width }: { f: Feed; size: number; width?: number }) {
  const { t, view, changeView, fresh } = f;
  const options = [
    { value: "editie" as const, label: t.editie },
    { value: "friends" as const, label: t.perFriend },
    { value: "time" as const, label: t.byTime },
  ];
  return (
    <View style={[tile(), { width, paddingTop: 26, paddingHorizontal: 26, paddingBottom: 22, justifyContent: "space-between", gap: 28 }]}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: fresh ? color("red") : color("ink", "inkDim"), backgroundColor: fresh ? color("red") : "transparent" }} />
          <Text style={meta(9, color("ink", "inkDim"))}>{fresh ? `${fresh} ${t.new}` : t.upToDate}</Text>
        </View>
        <Text style={[sans(400), { fontSize: size, lineHeight: size, letterSpacing: -size * 0.045, color: color("ink") }]}>
          {t.feedA} {t.feedB}
        </Text>
      </View>
      <View style={{ flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: color("paper"), alignSelf: "flex-start" }}>
        {options.map((o) => {
          const on = view === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => changeView(o.value)}
              style={{ height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", backgroundColor: on ? color("ink") : "transparent" }}
            >
              <Text style={meta(9.5, on ? color("paper") : color("ink"), 1.14)}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Hero({ f, p, width }: { f: Feed; p: Tile; width: number }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(p.hue, scheme);
  const photo = p.media.kind === "foto" ? p.media.uri : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.title}
      onPress={() => f.openPost(p)}
      style={{ width, height: 520, borderRadius: R, overflow: "hidden", backgroundColor: fc.fill }}
    >
      {photo ? (
        <SafeImage uri={photo} cacheKey={p.media.kind === "foto" ? p.media.cacheKey : undefined} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
      ) : (
        <Text numberOfLines={8} style={[sans(400), { padding: 40, fontSize: 34, lineHeight: 39, letterSpacing: -1, color: fc.ink }]}>
          {p.body || p.caption || p.title}
        </Text>
      )}
      <View
        style={[
          { position: "absolute", top: 16, left: 16, height: 28, paddingHorizontal: 12, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(244,241,235,.86)" },
          Platform.OS === "web" ? ({ backdropFilter: "blur(10px)" } as ViewStyle) : null,
        ]}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.isNew ? color("red") : color("ink", "inkDim") }} />
        <Text style={meta(9, INK_ON_CHIP, 1.26)}>{p.isNew ? t.newFront : t.seenFront}</Text>
      </View>
      <View
        pointerEvents="none"
        style={[
          { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 28, paddingHorizontal: 28, paddingBottom: 26, flexDirection: "row", alignItems: "flex-end", gap: 20 },
          Platform.OS === "web"
            ? ({ backgroundImage: "linear-gradient(180deg,rgba(8,8,9,0) 0%,rgba(8,8,9,.86) 62%)" } as ViewStyle)
            : { backgroundColor: "rgba(8,8,9,.6)" },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
          <Text style={meta(9, "rgba(246,244,240,.72)")}>
            {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
          </Text>
          <Text numberOfLines={3} style={[sans(400), { fontSize: 44, lineHeight: 46, letterSpacing: -1.76, color: ON_PHOTO }]}>
            {p.title}
          </Text>
          {p.caption ? (
            <Text numberOfLines={2} style={[sans(400), { maxWidth: 560, fontSize: 16, lineHeight: 22, color: "rgba(248,246,242,.8)" }]}>
              {p.caption}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: "rgba(248,246,242,.55)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 18, lineHeight: 22, color: ON_PHOTO }}>↗</Text>
        </View>
      </View>
    </Pressable>
  );
}

const ON_PHOTO = "#F8F6F2";
const INK_ON_CHIP = "#17170F";

function AlsoNew({ f, ed }: { f: Feed; ed: EditionData }) {
  const { t } = f;
  return (
    <View style={[tile(), { flex: 1, padding: 18, gap: SEAM }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingBottom: 8 }}>
        <Text style={meta(9, color("ink"))}>{t.alsoNew}</Text>
        {f.fresh ? (
          <Pressable accessibilityRole="button" onPress={f.markAllRead}>
            <Text style={[meta(9, color("ink", "inkDim")), { textDecorationLine: "underline" }]}>{t.allRead}</Text>
          </Pressable>
        ) : null}
      </View>
      {ed.alsoNew.length ? (
        ed.alsoNew.slice(0, 4).map((p) => <MiniRow key={p.id} f={f} p={p} size={44} radius={12} bg={color("paper")} />)
      ) : (
        <UpToDateMark />
      )}
    </View>
  );
}

/** Een regel met een kleurvlakje en de initiaal: Ook nieuw en de rijen onder Gezien. */
function MiniRow({ f, p, size, radius, bg, width }: { f: Feed; p: Tile; size: number; radius: number; bg: string; width?: number }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(p.hue, scheme);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={p.title}
      onPress={() => f.openPost(p)}
      style={[{ width, flexDirection: "row", alignItems: "center", gap: 14, padding: 10, borderRadius: 14, backgroundColor: bg }]}
    >
      <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
        <Text style={[sans(700), { fontSize: 14, lineHeight: 17, color: fc.ink }]}>{p.initial}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={1} style={[sans(500), { fontSize: 15, lineHeight: 18, letterSpacing: -0.15, color: color("ink") }]}>
          {p.title}
        </Text>
        <Text numberOfLines={1} style={meta(8.5, color("ink", "inkDim"))}>
          {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
        </Text>
      </View>
      <Text style={{ color: color("ink", "inkDim"), paddingHorizontal: 8 }}>→</Text>
    </Pressable>
  );
}

function PostRow({ f, p, width }: { f: Feed; p: Tile; width: number }) {
  return (
    <View style={[tile(), { width, padding: 4 }]}>
      <MiniRow f={f} p={p} size={52} radius={14} bg="transparent" />
    </View>
  );
}

function PostTile({ f, p, hue, width }: { f: Feed; p: CardPost; hue: Hue; width: number }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const isNew = !f.seen.has(p.id);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={p.title} onPress={() => f.openPost(p)} style={[tile(), { width, overflow: "hidden" }]}>
      <View style={{ height: 200, overflow: "hidden", borderTopLeftRadius: R, borderTopRightRadius: R, backgroundColor: friendColor(hue, scheme).fill }}>
        <Media media={p.media} height={200} hue={hue} postId={p.id} myUserId={f.myUserId} />
        {isNew ? (
          <View style={{ position: "absolute", top: 12, left: 12, height: 24, paddingHorizontal: 10, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(244,241,235,.9)" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color("red") }} />
            <Text style={meta(8.5, INK_ON_CHIP, 1.2)}>{t.new}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 16, paddingHorizontal: 18, paddingBottom: 20, gap: 8 }}>
        <Text numberOfLines={1} style={meta(8.5, color("ink", "inkDim"))}>
          {p.authorName} · {timeLabel(p.createdAt, t, lang)}
        </Text>
        <Text numberOfLines={2} style={[sans(500), { fontSize: 17, lineHeight: 21, letterSpacing: -0.25, color: color("ink") }]}>
          {p.title}
        </Text>
        {p.caption ? (
          <Text numberOfLines={2} style={[sans(400), { fontSize: 13, lineHeight: 18, color: color("ink", "inkDim") }]}>
            {p.caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Section({
  width,
  label: text,
  meta: m,
  isNew = false,
  solid = false,
  action,
  onAction,
  top = 0,
}: {
  width: number;
  label: string;
  meta?: string;
  isNew?: boolean;
  solid?: boolean;
  action?: string;
  onAction?: () => void;
  top?: number;
}) {
  const dot = isNew ? color("red") : solid ? color("ink") : "transparent";
  const dotBd = isNew ? color("red") : solid ? color("ink") : color("ink", "inkDim");
  return (
    <View style={[tile(), { width, marginTop: top, height: 52, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12 }]}>
      <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: dotBd, backgroundColor: dot }} />
      <Text style={meta(9.5, color("ink"))}>{text}</Text>
      {m ? <Text style={meta(9.5, color("ink", "inkDim"))}>{m}</Text> : null}
      <View style={{ flex: 1 }} />
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={meta(9.5, color("ink", "inkDim"))}>{action} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FriendRow({ f, g, isNew, open, width }: { f: Feed; g: FriendGroup; isNew: boolean; open: boolean; width: number }) {
  const { t } = f;
  const scheme = useScheme();
  const lang = useLang();
  const fc = friendColor(g.hue, scheme);
  const fresh = f.freshIn(g);
  const n = g.posts.length;
  const status = [
    g.isGroup ? t.group : null,
    // Alleen iets zeggen als er iets nieuw is; "gelezen" is de gewone stand.
    isNew ? `${fresh.length} ${t.new}` : null,
    `${n} ${n === 1 ? t.post1 : t.posts}`,
    timeLabel(g.latest, t, lang),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${g.name}, ${open ? t.closeAll : t.openAll}`}
      onPress={() => f.toggleOpen(g.key)}
      style={[
        tile(),
        {
          width,
          minHeight: 76,
          paddingVertical: 12,
          paddingRight: 12,
          paddingLeft: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          backgroundColor: pageTint(fc.fill, scheme, isNew ? { light: 0.22, dark: 0.2 } : { light: 0.1, dark: 0.1 }),
        },
      ]}
    >
      <Pressable accessibilityRole="link" onPress={() => f.openProfile(g)} style={{ width: 48, height: 48, borderRadius: g.isGroup ? 14 : 24, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
        {g.avatarUrl && !g.isGroup ? (
          <SafeImage uri={g.avatarUrl} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" />
        ) : (
          <Text style={[sans(700), { fontSize: 16, lineHeight: 19, color: fc.ink }]}>{g.initial}</Text>
        )}
        {isNew ? (
          <View style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999, backgroundColor: color("ink"), alignItems: "center", justifyContent: "center" }}>
            <Text style={[mono(600), { fontSize: 9, lineHeight: 11, color: color("paper") }]}>{fresh.length}</Text>
          </View>
        ) : null}
      </Pressable>
      <View style={{ width: 240, gap: 5 }}>
        <Text numberOfLines={1} style={[sans(500), { fontSize: 24, lineHeight: 26, letterSpacing: -0.72, color: color("ink") }]}>
          {g.name}
        </Text>
        <Text numberOfLines={1} style={meta(8.5, color("ink", "inkDim"))}>
          {status}
        </Text>
      </View>
      {/* Dicht is dicht: naam en status, geen titels. Die staan in de tegels als je openklapt. */}
      <View style={{ flex: 1 }} />
      {g.isGroup || f.isMine(g.authorId) ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => f.privateAbout(g)}
          style={{ height: 40, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(255,255,255,.7)" }}
        >
          <Text style={meta(9.5, INK_ON_CHIP, 1.14)}>{t.privateMsg}</Text>
        </Pressable>
      )}
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color("ink"), alignItems: "center", justifyContent: "center", transform: [{ rotate: open ? "45deg" : "0deg" }] }}>
        <Text style={{ fontSize: 18, lineHeight: 22, color: color("paper") }}>+</Text>
      </View>
    </Pressable>
  );
}

function End({ f, width }: { f: Feed; width: number }) {
  const { t } = f;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.newPost}
      onPress={f.compose}
      style={{ width, marginTop: 34, marginBottom: 24, padding: 28, borderRadius: R, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, backgroundColor: color("ink") }}
    >
      <View style={{ gap: 8, flexShrink: 1 }}>
        <Text style={[meta(9, color("paper")), { opacity: 0.6 }]}>{t.endLine}</Text>
        <Text style={[sans(400), { fontSize: 30, lineHeight: 33, letterSpacing: -0.9, color: color("paper") }]}>{t.caughtUp}</Text>
      </View>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color("paper"), alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 22, lineHeight: 26, color: color("ink") }}>+</Text>
      </View>
    </Pressable>
  );
}

function meta(size: number, c: string, spacing = size * 0.16): TextStyle {
  return { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

function Note({ text }: { text: string }) {
  return (
    <View style={{ padding: 40, alignItems: "center", width: "100%" }}>
      <Text style={meta(10, color("ink", "inkDim"))}>{text}</Text>
    </View>
  );
}
