import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen, useUnread } from "@/components/lincin/Chrome";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { color, friendColor, hueFor, RASTER, useHueChoices, useScheme } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { timeLabel, type CardPost } from "@/lib/lincin/model";
import type { Dict, Lang } from "@/lib/i18n";

import { EmptyFeed } from "../feed/EmptyFeed";
import { useFeed } from "../feed/useFeed";
import { Bento, Counter, SEAM, Tile, TileMeta, TileTitle, TitleTile } from "./Bento";
import { KindPreview } from "./KindPreview";

/**
 * De feed van het thema modern (prototype `FEED · MODERN`, 2.2 §1).
 *
 * Een dicht bento-rooster waarin álles een tegel is:
 *
 *   1. de titeltegel — "Lincin" met de klok en de kicker rechts, daaronder
 *      de kop op 34 px;
 *   2. een rij met de vriendenchips (44 px rond, met het aantal nieuwe
 *      erop) en rechts twee knoppen van 56 px: meldingen en een nieuwe
 *      bijdrage;
 *   3. het hero — de bijdrage van het moment, 300 px hoog, met een
 *      verloop naar zwart en de titel eroverheen;
 *   4. de schakelaar "per vriend | op tijd" als een tegel van 52 px;
 *   5. de tegels zelf, twee per rij, beeld boven en tekst onder;
 *   6. de langere bijdragen als rijen over de volle breedte;
 *   7. de eindkaart in inkt: "niemand maakte iets nieuws — jij wel?".
 *
 * De kop van de app staat hier ín het rooster en niet in de kopregel;
 * `LincinScreen` krijgt daarom `header="none"`.
 */

/** Zoveel tegels voor het eerst een rij over de volle breedte wordt. */
const TILE_COUNT = 6;

export function FeedModern() {
  const f = useFeed();
  const { t, lang, feed, byTime, sheet, setSheet, seen, fresh } = f;
  const scheme = useScheme();
  useHueChoices();

  const hero = f.heroPost;
  const rest = useMemo(() => byTime.filter((p) => p.id !== hero?.id), [byTime, hero]);
  const tiles = rest.slice(0, TILE_COUNT);
  const rows = rest.slice(TILE_COUNT);

  const heroHue = hero ? friendColor(hueFor(hero.authorId), scheme) : null;
  // Het blad haast in de kleur van wie bovenaan staat.
  const tint = heroHue?.fill ?? null;

  return (
    <LincinScreen tab="feed" tint={tint} counter={t.tabFeed} header="none">
      <Bento>
        <TitleTile
          size={34}
          title={
            <View style={{ gap: 26 }}>
              <Text
                style={{
                  ...mono(500),
                  fontSize: 10,
                  lineHeight: 13,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: color("ink"),
                }}
              >
                Lincin
              </Text>
              <Text
                style={{
                  ...sans(400),
                  fontSize: 34,
                  lineHeight: 35,
                  letterSpacing: -1.19, // -.035em
                  color: color("ink"),
                }}
              >
                {t.feedA} {t.feedB}
              </Text>
            </View>
          }
          align="flex-end"
        >
          <Counter>
            {clock(lang)}
            {"\n"}
            {fresh > 0 ? `${fresh} ${t.new}` : t.tabFeed}
          </Counter>
        </TitleTile>

        {/* De vriendenchips, en rechts meldingen en een nieuwe bijdrage. */}
        <FriendChips f={f} />

        {hero ? <Hero post={hero} onPress={() => f.openPost(hero)} scheme={scheme} lang={lang} t={t} /> : null}

        {/* Per vriend | op tijd. */}
        <Tile span={2} pad={0} style={{ height: 52, paddingHorizontal: 20, justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => f.changeView("friends")}
              style={{ paddingVertical: 14, marginVertical: -14 }}
            >
              <Counter align="left">{f.view === "friends" ? t.perFriend : `${t.perFriend} →`}</Counter>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => f.changeView("time")}
              style={{ paddingVertical: 14, marginVertical: -14 }}
            >
              <Counter>{f.view === "time" ? t.byTime : `${t.byTime} →`}</Counter>
            </Pressable>
          </View>
        </Tile>

        {feed.isLoading ? (
          <Tile span={2}>
            <TileMeta>{t.loading}</TileMeta>
          </Tile>
        ) : null}

        {f.empty ? (
          <Tile span={2} pad={0}>
            <EmptyFeed />
          </Tile>
        ) : null}

        {tiles.map((p) => (
          <PostTile key={p.id} post={p} onPress={() => f.openPost(p)} scheme={scheme} lang={lang} t={t} seen={seen.has(p.id)} />
        ))}

        {rows.map((p) => (
          <PostRow key={p.id} post={p} onPress={() => f.openPost(p)} scheme={scheme} lang={lang} t={t} />
        ))}

        {!f.empty ? <EndTile onPress={f.compose} endLine={t.endLine} endTitle={t.endTitle} /> : null}
      </Bento>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

/** De tijd van nu, als "wo 16 sep · 22:41" — de regel rechtsboven. */
function clock(lang: string): string {
  const locale = lang === "en" ? "en-GB" : lang === "de" ? "de-DE" : "nl-BE";
  const now = new Date();
  const day = now.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

/**
 * De rij vriendenchips: één rond vlakje per vriend, met het aantal nieuwe
 * bijdragen erop. Ze schuiven horizontaal als er meer zijn dan er passen.
 * Rechts twee knoppen van 56 px — meldingen en een nieuwe bijdrage.
 */
function FriendChips({ f }: { f: ReturnType<typeof useFeed> }) {
  const scheme = useScheme();
  const unread = useUnread();
  const { groups, seen, t, router } = f;
  return (
    <View style={{ width: "100%", flexDirection: "row", gap: SEAM, minHeight: 56 }}>
      <Tile span={1} pad={0} style={{ paddingHorizontal: 12, paddingVertical: 8, justifyContent: "center" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "center" }}>
          {groups.map((g) => {
            const fc = friendColor(g.hue, scheme);
            const unseen = g.posts.filter((p) => !seen.has(p.id)).length;
            return (
              <Pressable
                key={g.key}
                accessibilityRole="button"
                accessibilityLabel={unseen > 0 ? `${g.name}, ${unseen} ${t.new}` : g.name}
                onPress={() => f.openProfile(g)}
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: fc.fill,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: unseen > 0 ? 1 : 0.72,
                }}
              >
                <Text style={{ ...sans(500), fontSize: 13, lineHeight: 16, color: fc.ink }}>{g.initial}</Text>
                {unseen > 0 ? (
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      minWidth: 16,
                      height: 16,
                      paddingHorizontal: 4,
                      borderRadius: 8,
                      backgroundColor: color("ink"),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ ...mono(500), fontSize: 9, lineHeight: 11, color: color("paper") }}>{unseen}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Tile>
      {/* De twee knoppen die in de modern-kopregel rechts staan; de feed
          heeft geen kopregel, dus ze staan hier als tegels van 56 px. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread.notifications > 0 ? `Meldingen, ${unread.notifications} ${t.new}` : t.notifications}
        onPress={() => router.push("/notifications")}
        style={({ pressed }) => ({
          flexShrink: 0,
          width: 56,
          borderRadius: RASTER.tileRadius,
          backgroundColor: color("tile", "tileFill"),
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Text style={{ fontSize: 17, lineHeight: 20, color: color("ink") }}>◔</Text>
        {unread.notifications > 0 ? (
          <View
            style={{ position: "absolute", top: 12, right: 14, width: 7, height: 7, borderRadius: 3.5, backgroundColor: color("red") }}
          />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.newPost}
        onPress={() => router.push("/post-compose")}
        style={({ pressed }) => ({
          flexShrink: 0,
          width: 56,
          borderRadius: RASTER.tileRadius,
          backgroundColor: color("ink"),
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <Text style={{ fontSize: 20, lineHeight: 24, color: color("paper") }}>+</Text>
      </Pressable>
    </View>
  );
}

/** Het hero: 300 px, beeld met een verloop naar zwart en de titel erop. */
function Hero({
  post,
  onPress,
  scheme,
  lang,
  t,
}: {
  post: CardPost;
  onPress: () => void;
  scheme: ReturnType<typeof useScheme>;
  lang: Lang;
  t: Dict;
}) {
  return (
    <Tile
      span={2}
      pad={0}
      onPress={onPress}
      accessibilityLabel={post.title}
      style={{ height: 300, justifyContent: "flex-end" }}
    >
      <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
        <KindPreview post={post} scheme={scheme} fill />
      </View>
      <View
        style={{
          padding: 18,
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 14,
          backgroundColor: "rgba(8,8,9,.62)",
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text
            style={{
              ...mono(500),
              fontSize: 9,
              lineHeight: 12,
              letterSpacing: 1.44,
              textTransform: "uppercase",
              color: "rgba(246,244,240,.72)",
            }}
          >
            {post.authorName} · {post.kind} · {timeLabel(post.createdAt, t, lang)}
          </Text>
          <Text numberOfLines={2} style={{ ...sans(500), fontSize: 22, lineHeight: 25, letterSpacing: -0.44, color: "#F8F6F2" }}>
            {post.untitled ? post.caption || post.kind : post.title}
          </Text>
        </View>
        <View
          style={{
            flexShrink: 0,
            width: 46,
            height: 46,
            borderRadius: 23,
            borderWidth: 1,
            borderColor: "rgba(248,246,242,.55)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 16, color: "#F8F6F2" }}>↗</Text>
        </View>
      </View>
    </Tile>
  );
}

/** Eén tegel: beeld van 128 px boven, meta en titel eronder. */
function PostTile({
  post,
  onPress,
  scheme,
  lang,
  t,
  seen,
}: {
  post: CardPost;
  onPress: () => void;
  scheme: ReturnType<typeof useScheme>;
  lang: Lang;
  t: Dict;
  seen: boolean;
}) {
  return (
    <Tile
      span={1}
      pad={0}
      onPress={onPress}
      accessibilityLabel={post.title}
      style={{ minHeight: 196, opacity: seen ? 0.82 : 1 }}
    >
      <View style={{ height: 128, overflow: "hidden" }}>
        <KindPreview post={post} scheme={scheme} />
      </View>
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18, gap: 8 }}>
        <TileMeta numberOfLines={1}>
          {post.authorName} · {timeLabel(post.createdAt, t, lang)}
        </TileMeta>
        <TileTitle>{post.untitled ? post.caption || post.kind : post.title}</TileTitle>
      </View>
    </Tile>
  );
}

/** Een rij over de volle breedte, voor wat na de tegels komt. */
function PostRow({
  post,
  onPress,
  scheme,
  lang,
  t,
}: {
  post: CardPost;
  onPress: () => void;
  scheme: ReturnType<typeof useScheme>;
  lang: Lang;
  t: Dict;
}) {
  const fc = friendColor(hueFor(post.authorId), scheme);
  return (
    <Tile
      span={2}
      pad={14}
      onPress={onPress}
      accessibilityLabel={post.title}
      style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
    >
      <View
        style={{
          flexShrink: 0,
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: fc.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ ...sans(500), fontSize: 15, lineHeight: 18, color: fc.ink }}>{post.initial}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <TileTitle numberOfLines={1}>{post.untitled ? post.caption || post.kind : post.title}</TileTitle>
        <TileMeta numberOfLines={1}>
          {post.authorName} · {post.kind} · {timeLabel(post.createdAt, t, lang)}
        </TileMeta>
      </View>
      <Text style={{ flexShrink: 0, fontSize: 15, color: color("ink", "inkDim"), paddingHorizontal: 6 }}>→</Text>
    </Tile>
  );
}

/** De eindkaart: een inktvlak met de oproep om zelf iets te maken. */
function EndTile({ onPress, endLine, endTitle }: { onPress: () => void; endLine: string; endTitle: string }) {
  return (
    <Tile
      span={2}
      pad={0}
      onPress={onPress}
      accessibilityLabel={endTitle}
      style={{
        backgroundColor: color("ink"),
        paddingVertical: 24,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Text
          style={{
            ...mono(500),
            fontSize: 9,
            lineHeight: 12,
            letterSpacing: 1.44,
            textTransform: "uppercase",
            color: color("paper"),
            opacity: 0.6,
          }}
        >
          {endLine}
        </Text>
        <Text style={{ ...sans(500), fontSize: 20, lineHeight: 22, letterSpacing: -0.4, color: color("paper") }}>
          {endTitle}
        </Text>
      </View>
      <View
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: color("paper"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 20, lineHeight: 24, color: color("ink") }}>+</Text>
      </View>
    </Tile>
  );
}

