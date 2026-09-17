import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { ModernBackdrop } from "@/components/lincin/Chrome";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import { friendColor, GLASS, hueFor, useScheme } from "@/lib/design/theme";
import { mono, serif } from "@/lib/design/type";
import { type Lang } from "@/lib/i18n";
import { timeLabel, type CardPost } from "@/lib/lincin/model";
import { useUnread } from "@/lib/lincin/unread";

import { useFeed } from "../feed/useFeed";
import { ChatList, ChatListHead } from "./ChatList";

/**
 * De feed op desktop, thema modern (Lincin Desktop Opties #1c): het warme
 * verloop met korrel over het hele venster; linksboven "● Lincin" met de
 * navigatie in mono eronder, rechtsboven de datum en "n nieuw · n lincs",
 * linksonder de leus, rechtsonder "Nieuwe bijdrage (+)". In het midden het
 * mozaïek (drie kolommen, de eerste tegel 2×2), rechts een glazen paneel
 * van 380 met de gesprekken. Een bijdrage of gesprek opent op volle
 * breedte in de desktopschil (model 3c/3d).
 */

const INK = "#F2EFE8";
const MUSIC = "#7A1E1E";
const NAV_W = 220;
const GLASS_W = 380;
const MARGIN = 32;
const TOP = 96;
const BOTTOM = 80;
const GAP = 6;
const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export function DesktopModern() {
  const f = useFeed();
  const { t, lang, byTime, groups, sheet, setSheet, friendCount, fresh } = f;
  const scheme = useScheme();
  const router = useRouter();
  const unread = useUnread();
  const { width, height } = useWindowDimensions();
  const hueOf = (p: CardPost) => groups.find((g) => g.key === p.authorId)?.hue ?? hueFor(p.authorId);
  const mosaicW = Math.max(300, width - NAV_W - GLASS_W - MARGIN * 2);
  const cols = mosaicW >= 900 ? 4 : 3;
  const cell = (mosaicW - GAP * (cols - 1)) / cols;
  const rowH = Math.max(150, Math.min(cell, (height - TOP - BOTTOM - GAP * 3) / 4));
  const tiles = useMemo(() => pack(byTime, cols), [byTime, cols]);
  const rows = tiles.reduce((m, tl) => Math.max(m, tl.row + tl.h), 0);
  const today = new Date().toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short", year: "numeric" });
  const label = (s: string, extra: object = {}) => (
    <Text style={[mono(500), { fontSize: 11, lineHeight: 20, letterSpacing: 1.54, textTransform: "uppercase", color: INK }, extra]}>{s}</Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#1A1210" }}>
      <ModernBackdrop width={width} height={height} />
      {/* linksboven: merk en navigatie */}
      <Pressable accessibilityRole="link" onPress={() => router.push("/feed")} style={{ position: "absolute", top: 26, left: MARGIN, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: INK }} />
        <Text style={[serif(), { fontSize: 26, lineHeight: 28, color: INK }]}>Lincin</Text>
      </Pressable>
      <View style={{ position: "absolute", top: TOP, left: MARGIN, gap: 14 }}>
        {label(t.tabFeed)}
        <Pressable accessibilityRole="link" onPress={() => router.push("/chats")}>{label(unread.chats ? `${t.chats} · ${unread.chats}` : t.chats, { opacity: 0.5 })}</Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push("/events")}>{label(t.tabEvents, { opacity: 0.5 })}</Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push("/profile")}>{label(t.you, { opacity: 0.5 })}</Pressable>
      </View>
      <View style={{ position: "absolute", top: 26, right: MARGIN, alignItems: "flex-end", opacity: 0.8 }}>
        {label(today)}
        {label(`${fresh} ${t.new} · ${friendCount} lincs`)}
      </View>
      <View style={{ position: "absolute", left: MARGIN, bottom: 28, maxWidth: 220, opacity: 0.7 }}>
        <Text style={[mono(500), { fontSize: 10, lineHeight: 18, letterSpacing: 1.4, textTransform: "uppercase", color: INK }]}>
          {t.feedA} {t.feedB}.{"\n"}
          {t.noAlgo}.
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={f.compose} style={{ position: "absolute", right: MARGIN, bottom: 28, opacity: 0.7 }}>
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textTransform: "uppercase", color: INK }]}>{t.newPost} (+)</Text>
      </Pressable>

      {/* het mozaïek */}
      <ScrollView style={{ position: "absolute", left: NAV_W, top: TOP, width: mosaicW, bottom: BOTTOM }} showsVerticalScrollIndicator={false}>
        <View style={{ width: mosaicW, height: rows * rowH + (rows - 1) * GAP }}>
          {tiles.map((tl) => (
            <Tile
              key={tl.post.id}
              post={tl.post}
              fc={friendColor(hueOf(tl.post), scheme)}
              style={{ position: "absolute", left: tl.col * (cell + GAP), top: tl.row * (rowH + GAP), width: cell * tl.w + GAP * (tl.w - 1), height: rowH * tl.h + GAP * (tl.h - 1) }}
              onOpen={() => f.openPost(tl.post)}
              caption={`${tl.post.authorName} · ${tl.post.untitled ? timeLabel(tl.post.createdAt, t, lang) : tl.post.title}`}
            />
          ))}
        </View>
      </ScrollView>

      {/* het glazen paneel */}
      <View
        style={[
          { position: "absolute", right: MARGIN, top: TOP, bottom: BOTTOM, width: GLASS_W, backgroundColor: GLASS.fill, borderWidth: 1, borderColor: GLASS.edge, overflow: "hidden" },
          Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object) : null,
        ]}
      >
        <ChatListHead link />
        <ChatList activeId={null} onOpen={(id) => router.push(`/chat/${id}` as never)} />
      </View>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}

type Placed = { post: CardPost; col: number; row: number; w: number; h: number };

/** De eerste tegel 2×2, de rest vult de cellen op volgorde (#1c). */
function pack(posts: CardPost[], cols: number): Placed[] {
  const taken = new Set<string>();
  const out: Placed[] = [];
  const free = (c: number, r: number, w: number, h: number) => {
    if (c + w > cols) return false;
    for (let x = c; x < c + w; x++) for (let y = r; y < r + h; y++) if (taken.has(`${x},${y}`)) return false;
    return true;
  };
  const take = (c: number, r: number, w: number, h: number) => {
    for (let x = c; x < c + w; x++) for (let y = r; y < r + h; y++) taken.add(`${x},${y}`);
  };
  posts.forEach((post, i) => {
    const w = i === 0 && cols >= 3 ? 2 : 1;
    const h = i === 0 && cols >= 3 ? 2 : 1;
    let r = 0;
    for (;;) {
      let placed = false;
      for (let c = 0; c < cols; c++) {
        if (free(c, r, w, h)) {
          take(c, r, w, h);
          out.push({ post, col: c, row: r, w, h });
          placed = true;
          break;
        }
      }
      if (placed) break;
      r++;
    }
  });
  return out;
}

function Tile({ post: p, fc, style, onOpen, caption }: { post: CardPost; fc: { fill: string; ink: string }; style: object; onOpen: () => void; caption: string }) {
  const m = p.media;
  const isImg = m.kind === "foto" || (m.kind === "link" && !!m.image);
  const bg = isImg ? "rgba(0,0,0,.2)" : m.kind === "muziek" ? MUSIC : m.kind === "kleur" ? m.hex : GLASS.fill;
  return (
    <Pressable
      accessibilityLabel={`${p.title}, ${p.authorName}`}
      onPress={onOpen}
      style={[{ overflow: "hidden", backgroundColor: bg }, style, !isImg && m.kind !== "muziek" && Platform.OS === "web" ? ({ backdropFilter: "blur(10px)" } as object) : null]}
    >
      {m.kind === "foto" ? (
        <SafeImage uri={m.uri} cacheKey={m.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
      ) : m.kind === "link" && m.image ? (
        <SafeImage uri={m.image} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
      ) : m.kind === "muziek" ? (
        <View style={{ flex: 1, padding: 14, justifyContent: "flex-end" }}>
          <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: INK, opacity: 0.7 }]} numberOfLines={1}>
            {m.artist}
          </Text>
          <Text style={[serif(), { fontSize: 22, lineHeight: 26, color: INK, marginTop: 6 }]} numberOfLines={2}>
            {m.track}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
          <Text style={[serif(), { fontSize: 17, lineHeight: 22, color: INK }]} numberOfLines={5}>
            {m.kind === "tekst" ? m.text : m.kind === "poll" ? p.title : m.kind === "plek" ? m.place : m.kind === "link" ? m.title : p.title}
          </Text>
          <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: INK, opacity: 0.6, marginTop: 10 }]} numberOfLines={1}>
            {p.authorName} · {p.kind}
          </Text>
        </View>
      )}
      <View style={{ position: "absolute", top: 10, left: 10, width: 13, height: 13, borderRadius: 7, backgroundColor: "rgba(0,0,0,.25)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: fc.fill }} />
      </View>
      {isImg ? (
        <Text numberOfLines={1} style={[mono(500), { position: "absolute", left: 14, right: 14, bottom: 12, fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: INK, textShadowColor: "rgba(0,0,0,.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }]}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}
