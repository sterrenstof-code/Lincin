import { useMemo, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { LincinScreen, useUnread } from "@/components/lincin/Chrome";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { BORDER, GUTTER, line, Mono, Serif } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import { color, friendColor, hueFor, useScheme } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import type { Lang } from "@/lib/i18n";
import { timeLabel, type CardPost } from "@/lib/lincin/model";

import { EmptyFeed } from "./FeedKleur";
import { useFeed } from "./useFeed";

/**
 * De feed van het thema magazine (HANDOFF §Magazine feed, prototype
 * `FEED · MAGAZINE`, referentie Desktop Opties #2a).
 *
 * Eén hero — de nieuwste bijdrage — van 520 hoog met het masthead
 * "LINCIN" in de vriendkleur eroverheen, de titel en het bijschrift links,
 * "Op spotlight" rechts met vier regels, de lopende tekst eronder, en
 * onderaan de reacties als chips. Alles op het beeld staat in papier met
 * `difference` als mengmodus. Daaronder een kleefbalk "In deze editie" en
 * de inhoudsopgave: kleurbalk, regel, titel in serif, het nummer.
 *
 * Geen kop "Lincin · ◉ · +": die zit in de bovenregel van het hero.
 */

const HERO_H = 520;
const PAD = 16;
const ON_IMAGE = "#F2EFE8";
const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export function FeedMagazine() {
  const f = useFeed();
  const { t, lang, router, feed, byTime, groups, reactions, sheet, setSheet, numberOf } = f;
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const unread = useUnread();
  /**
   * Het hero loopt onder de statusbalk door; de bovenregel staat 2px
   * onder die balk (prototype: top 56 bij een balk van 54). In een browser
   * is er geen balk, en dan houden we dezelfde 54 aan zodat het masthead
   * op dezelfde plek in het beeld valt als op een telefoon.
   */
  const top = Math.max(insets.top, 54);

  const hero = byTime[0];
  const spotlight = byTime.slice(1, 5);
  const toc = useMemo(() => [...byTime.slice(1)].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)), [byTime]);
  const hueOf = (p: CardPost) => groups.find((g) => g.key === p.authorId)?.hue ?? hueFor(p.authorId);
  const heroColor = hero ? friendColor(hueOf(hero), scheme) : friendColor("orange", scheme);
  const heroImg = hero && hero.media.kind === "foto" ? hero.media : null;

  // "Editie wo 16 sep · № 38": vandaag, en het nummer van de week.
  const today = new Date();
  const edition = `${t.edition} ${today.toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "")} · № ${isoWeek(today)}`;

  const noFriends = f.empty && f.friendCount === 0;
  const grouped = hero ? reactions.grouped(hero.id) : [];
  const commentsLabel = hero?.commentCount ? ` · ${hero.commentCount}` : "";

  const sticky: number[] = [];
  const children: ReactNode[] = [];

  if (feed.isLoading || noFriends || !hero) {
    children.push(
      <View key="top" style={{ paddingTop: top + 8, paddingHorizontal: GUTTER, paddingBottom: 14 }}>
        <Text style={[lincinType.masthead, { color: heroColor.fill, fontSize: 96, lineHeight: 80, letterSpacing: -3.8 }]}>Lincin</Text>
      </View>,
    );
    children.push(
      feed.isLoading ? (
        <Mono key="loading" variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
          {t.loading}
        </Mono>
      ) : (
        <EmptyFeed key="empty" />
      ),
    );
  } else {
    children.push(
      <View key="hero" style={{ height: HERO_H, overflow: "hidden", backgroundColor: heroColor.fill }}>
        {heroImg ? (
          <SafeImage uri={heroImg.uri} cacheKey={heroImg.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
        ) : null}
        {/* de sluier: 25% inkt boven, niets in het midden, 15% onder */}
        <Svg pointerEvents="none" width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="lincin-mag" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#141414" stopOpacity={0.25} />
              <Stop offset="0.45" stopColor="#141414" stopOpacity={0} />
              <Stop offset="1" stopColor="#141414" stopOpacity={0.15} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lincin-mag)" />
        </Svg>

        {/* de bovenregel: editie · ◉ + */}
        <View style={[{ position: "absolute", top: top + 2, left: PAD, right: PAD, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 2 }, blend()]}>
          <Mono variant="tiny" color={ON_IMAGE} style={{ letterSpacing: 1.26 }}>
            {edition}
          </Mono>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t.notifications} onPress={() => router.push("/notifications")} style={onImageBtn}>
              <Text style={{ color: ON_IMAGE, fontSize: 13, lineHeight: 15 }}>◉</Text>
              {unread.notifications > 0 ? <View style={{ position: "absolute", top: -4, right: -4, width: 9, height: 9, backgroundColor: color("red") }} /> : null}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t.newPost} onPress={f.compose} style={onImageBtn}>
              <Text style={{ color: ON_IMAGE, fontSize: 17, lineHeight: 19 }}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* het masthead */}
        <Text pointerEvents="none" numberOfLines={1} style={[lincinType.masthead, { position: "absolute", top: top + 16, left: 8, right: 0, color: heroColor.fill }]}>
          Lincin
        </Text>

        {/* links: titel en bijschrift */}
        <Pressable accessibilityRole="button" onPress={() => f.openPost(hero)} style={[{ position: "absolute", top: top + 136, left: PAD, maxWidth: 220 }, blend()]}>
          <Text style={[lincinType.cardTitle, { fontSize: 26, lineHeight: 25, letterSpacing: 0, color: ON_IMAGE }]}>{hero.title}</Text>
          {hero.caption ? (
            <Text style={[lincinType.asideSmall, { fontSize: 15, lineHeight: 19, marginTop: 8, color: ON_IMAGE }]}>{hero.caption}</Text>
          ) : null}
        </Pressable>

        {/* rechts: op spotlight */}
        <View style={[{ position: "absolute", right: PAD, top: top + 146, width: 120, alignItems: "flex-end" }, blend()]}>
          <Text style={[lincinType.eventTitle, { fontSize: 24, lineHeight: 24, letterSpacing: 0, color: ON_IMAGE, textAlign: "right" }]}>
            {t.spotA} <Text style={lincinType.asideSmall}>{t.spotB}</Text>
          </Text>
          <View style={{ marginTop: 10, alignItems: "flex-end" }}>
            {spotlight.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => f.openPost(p)}>
                <Mono variant="tiny" color={ON_IMAGE} numberOfLines={1} style={{ lineHeight: 17, letterSpacing: 0.72 }}>
                  {p.authorName} · {p.kind}
                </Mono>
              </Pressable>
            ))}
          </View>
        </View>

        {/* de lopende tekst */}
        {hero.body ? (
          <Text
            numberOfLines={5}
            style={[lincinType.caption, { position: "absolute", left: PAD, top: top + 276, maxWidth: 250, fontSize: 14, lineHeight: 20, color: ON_IMAGE }, blend()]}
          >
            {hero.body}
          </Text>
        ) : null}

        {/* onderaan: reacties · comment · privaat */}
        <View style={[{ position: "absolute", left: PAD, right: PAD, bottom: 14, flexDirection: "row", gap: 6, alignItems: "center" }, blend()]}>
          {grouped.map((r) => (
            <Pressable
              key={r.emoji}
              accessibilityRole="button"
              accessibilityState={{ selected: r.mine }}
              onPress={() => reactions.toggle(hero.id, r.emoji)}
              style={[onImageChip, { backgroundColor: r.mine ? "rgba(242,239,232,.25)" : "transparent" }]}
            >
              <Text style={[lincinType.monoBody, { fontSize: 11, lineHeight: 14, color: ON_IMAGE }]}>
                {r.emoji} {r.count}
              </Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" onPress={() => f.openPost(hero)} style={onImageChip}>
            <Mono variant="action" color={ON_IMAGE} style={{ fontSize: 11, lineHeight: 14 }}>
              {t.comment}
              {commentsLabel}
            </Mono>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => f.privateAbout({ authorId: hero.authorId, name: hero.authorName }, hero)} style={onImageChip}>
            <Mono variant="action" color={ON_IMAGE} style={{ fontSize: 11, lineHeight: 14 }}>
              {t.privateShort}
            </Mono>
          </Pressable>
        </View>
      </View>,
    );

    sticky.push(children.length);
    children.push(
      <View
        key="toc-head"
        style={{
          paddingTop: 14,
          paddingHorizontal: PAD,
          paddingBottom: 10,
          borderBottomWidth: BORDER,
          borderBottomColor: line(),
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          backgroundColor: color("paper"),
        }}
      >
        <Serif variant="eventTitle" style={{ letterSpacing: 0 }}>
          {t.editionA} <Serif variant="asideSmall" style={{ fontSize: 24, lineHeight: 24 }}>{t.editionB}</Serif>
        </Serif>
        <Mono variant="tiny" tone="dim" style={{ letterSpacing: 0.9 }}>
          {byTime.length} {byTime.length === 1 ? t.post1 : t.posts}
        </Mono>
      </View>,
    );

    toc.forEach((p) => {
      const fc = friendColor(hueOf(p), scheme);
      children.push(
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={p.title}
          onPress={() => f.openPost(p)}
          style={({ pressed }) => ({
            flexDirection: "row",
            gap: 12,
            paddingVertical: 12,
            paddingHorizontal: PAD,
            borderBottomWidth: 1,
            borderBottomColor: color("ink", "postRule"),
            alignItems: "stretch",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ width: 6, backgroundColor: fc.fill }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Mono variant="tiny" tone="dim" numberOfLines={1} style={{ fontSize: 8, lineHeight: 11, letterSpacing: 0.96 }}>
              {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
            </Mono>
            <Serif variant="row" numberOfLines={2} style={{ lineHeight: 20, marginTop: 3 }}>
              {p.title}
            </Serif>
          </View>
          <View style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
            <Mono variant="tiny" style={{ textTransform: "none", letterSpacing: 0 }}>
              № {numberOf(p.id)}
            </Mono>
            <Pressable accessibilityRole="button" accessibilityLabel={t.privateMsg} onPress={() => f.privateAbout({ authorId: p.authorId, name: p.authorName }, p)} hitSlop={6}>
              <Mono variant="tiny" tone="dim" style={{ textDecorationLine: "underline", letterSpacing: 0.54 }}>
                {t.privateShort}
              </Mono>
            </Pressable>
          </View>
        </Pressable>,
      );
    });

    children.push(
      <Mono key="end" variant="tiny" tone="dim" style={{ textAlign: "center", paddingTop: 22, paddingHorizontal: PAD, paddingBottom: 30, letterSpacing: 1.08, textTransform: "none" }}>
        {t.endLine}
      </Mono>,
    );
  }

  return (
    <LincinScreen tab="feed" header="none" bleed>
      <ScrollView style={{ flex: 1 }} stickyHeaderIndices={sticky} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

/** Tekst op het beeld: papier, gemengd met `difference` zodat hij op licht én donker leest. */
function blend(): object {
  return Platform.OS === "web" ? { mixBlendMode: "difference" } : { mixBlendMode: "difference" };
}

const onImageBtn = {
  width: 30,
  height: 30,
  borderWidth: 1.5,
  borderColor: ON_IMAGE,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const onImageChip = {
  borderWidth: 1.5,
  borderColor: ON_IMAGE,
  paddingVertical: 7,
  paddingHorizontal: 9,
};

/** Het weeknummer (ISO 8601) — het "№" van de editie. */
function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
