import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { SafeImage } from "@/components/SafeImage";
import { VerticalLabel } from "@/components/lincin/ui";
import { useQuery } from "@tanstack/react-query";
import { chatTitle, listMyChats } from "@/lib/api/chats";
import { useAuth } from "@/lib/auth/provider";
import { useChatPreviews } from "@/lib/chat-preview";
import { color, friendColor, hueFor, useHueChoices, useScheme } from "@/lib/design/theme";
import { lincinType, mono, serif } from "@/lib/design/type";
import { useT, type Lang } from "@/lib/i18n";
import { timeLabel, type CardPost } from "@/lib/lincin/model";
import { useReactionWho } from "@/lib/lincin/reactors";
import { useUnread } from "@/lib/lincin/unread";

import { SEEN_OPACITY } from "../feed/FeedMagazine";
import { useFeed } from "../feed/useFeed";

/**
 * De feed op desktop, thema magazine (Lincin Desktop Opties #1b): één
 * hero-bijdrage over het hele linkervlak met het masthead van 250px in de
 * vriendkleur eroverheen, de titel en het bijschrift links, de lopende
 * tekst in een kolom van 280, "Op spotlight" rechts, en onderaan de
 * reacties als chips. Rechts een kolom van 380 met de inhoudsopgave en,
 * onderaan, de gesprekken. Een bijdrage of gesprek opent op volle
 * breedte in de desktopschil (model 3c/3d), net als in kleur.
 */

const ON_IMAGE = "#F2EFE8";
const SIDE_W = 380;
const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const BLEND: ViewStyle = { mixBlendMode: "difference" } as ViewStyle;

export function DesktopMagazine() {
  const f = useFeed();
  const { t, lang, byTime, groups, reactions, sheet, setSheet, numberOf, friendCount } = f;
  const scheme = useScheme();
  const router = useRouter();
  const unread = useUnread();
  // Het hero: de foto met de meeste interacties deze maand (useFeed).
  const hero = f.heroPost;
  const rest = useMemo(() => byTime.filter((p) => p.id !== hero?.id), [byTime, hero]);
  const spotlight = rest.slice(0, 4);
  // De inhoudsopgave van nieuw naar oud; wat je al zag staat gedempt.
  const toc = rest;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const hueOf = (p: CardPost) => groups.find((g) => g.key === p.authorId)?.hue ?? hueFor(p.authorId);
  const heroColor = hero ? friendColor(hueOf(hero), scheme) : friendColor("orange", scheme);
  const heroImg = hero && hero.media.kind === "foto" ? hero.media : null;
  const today = new Date();
  const edition = `${t.edition} ${today.toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long" })} · № ${isoWeek(today)}`;
  const grouped = hero ? reactions.grouped(hero.id) : [];
  const who = useReactionWho(grouped);
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const nav: { label: string; href: string }[] = [
    { label: t.tabFeed, href: "/feed" },
    { label: unread.chats ? `${t.chats} (${unread.chats})` : t.chats, href: "/chats" },
    { label: t.tabEvents, href: "/events" },
    { label: t.you, href: "/profile" },
  ];

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: color("paper") }}>
      {/* het hero */}
      <View style={{ flex: 1, minWidth: 0, borderRightWidth: 1.5, borderRightColor: ink, overflow: "hidden", backgroundColor: heroColor.fill }}>
        {heroImg ? <SafeImage uri={heroImg.uri} cacheKey={heroImg.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" /> : null}
        <Svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <Defs>
            <LinearGradient id="lincin-mag-d" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={heroColor.fill} stopOpacity={0.15} />
              <Stop offset="0.4" stopColor={heroColor.fill} stopOpacity={0} />
              <Stop offset="1" stopColor="#141414" stopOpacity={0.08} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#lincin-mag-d)" />
        </Svg>
        <View style={[{ position: "absolute", top: 22, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", zIndex: 2 }, BLEND]}>
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textTransform: "uppercase", color: ON_IMAGE }]}>{edition}</Text>
          <View style={{ flexDirection: "row", gap: 0 }}>
            {nav.map((n, i) => (
              <Pressable key={n.href} accessibilityRole="link" onPress={() => router.push(n.href as never)}>
                <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textTransform: "uppercase", color: ON_IMAGE, textDecorationLine: i === 0 ? "underline" : "none" }]}>
                  {i ? " · " : ""}
                  {n.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text numberOfLines={1} style={[lincinType.masthead, { pointerEvents: "none", position: "absolute", top: 44, left: 28, fontSize: 250, lineHeight: 205, letterSpacing: -10, color: heroColor.fill }]}>
          Lincin
        </Text>
        {hero ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => f.openPost(hero)} style={[{ position: "absolute", top: 262, left: 32, maxWidth: 300 }, BLEND]}>
              <Text style={[lincinType.cardTitle, { fontSize: 30, lineHeight: 29, letterSpacing: 0, color: ON_IMAGE }]}>{hero.title}</Text>
              {hero.caption ? <Text style={[serif(true), { fontSize: 18, lineHeight: 22, marginTop: 8, color: ON_IMAGE }]}>{hero.caption}</Text> : null}
            </Pressable>
            {hero.body ? (
              <View style={[{ position: "absolute", top: 380, left: 32, width: 280 }, BLEND]}>
                <Text numberOfLines={8} style={[serif(), { fontSize: 15, lineHeight: 21, color: ON_IMAGE }]}>
                  {hero.body}
                </Text>
              </View>
            ) : null}
            <View style={[{ position: "absolute", right: 32, top: 300, width: 200, alignItems: "flex-end" }, BLEND]}>
              <Text style={[serif(), { fontSize: 44, lineHeight: 44, color: ON_IMAGE, textAlign: "right" }]}>
                {t.spotA} <Text style={serif(true)}>{t.spotB}</Text>
              </Text>
              <View style={{ marginTop: 14, alignItems: "flex-end" }}>
                {spotlight.map((p) => (
                  <Pressable key={p.id} accessibilityRole="button" onPress={() => f.openPost(p)}>
                    <Text numberOfLines={1} style={[mono(500), { fontSize: 11, lineHeight: 22, letterSpacing: 1.1, textTransform: "uppercase", color: ON_IMAGE }]}>
                      {p.authorName} · {p.untitled ? p.kind : p.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={[{ position: "absolute", left: 32, right: 32, bottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, BLEND]}>
              {/* Prototype #1b: `writing-mode: vertical-rl; rotate(180deg);
                  height: 150px` — te lezen van onder naar boven. Een gedraaide
                  Text van 150 breed in een doosje van 14 mat 13 × 14; de
                  VerticalLabel van de bladzijde doet het wél goed: een doos
                  van 134 breed, 90° gedraaid en absoluut in zijn vak gezet. */}
              <View style={{ height: 150, width: 14, overflow: "hidden" }}>
                <VerticalLabel text={`${t.noAlgo} · ${friendCount} lincs`} width={14} height={150} color={ON_IMAGE} style={{ letterSpacing: 1.4 }} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {grouped.map((r) => (
                  <Pressable key={r.emoji} accessibilityRole="button" {...who.chip(r)} onPress={() => reactions.toggle(hero.id, r.emoji)} style={[chip, { backgroundColor: r.mine ? "rgba(242,239,232,.25)" : "transparent" }]}>
                    <Text style={[mono(600), { fontSize: 12, lineHeight: 15, color: ON_IMAGE }]}>
                      {r.emoji} {r.count}
                    </Text>
                  </Pressable>
                ))}
                <Pressable accessibilityRole="button" onPress={() => f.openPost(hero)} style={chip}>
                  <Text style={[mono(600), { fontSize: 12, lineHeight: 15, textTransform: "uppercase", color: ON_IMAGE }]}>
                    {t.comment}
                    {hero.commentCount ? ` · ${hero.commentCount}` : ""}
                  </Text>
                </Pressable>
                {f.isMine(hero.authorId) ? null : (
                  <Pressable accessibilityRole="button" onPress={() => f.privateAbout({ authorId: hero.authorId, name: hero.authorName }, hero)} style={chip}>
                    <Text style={[mono(600), { fontSize: 12, lineHeight: 15, textTransform: "uppercase", color: ON_IMAGE }]}>{t.privateMsg}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        ) : null}
      </View>

      {/* rechts: inhoudsopgave en gesprekken */}
      <View style={{ width: SIDE_W, backgroundColor: color("paper") }}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingTop: 26, paddingHorizontal: 26, paddingBottom: 18, borderBottomWidth: 1.5, borderBottomColor: ink }}>
            <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textTransform: "uppercase", color: dim }]}>
              {t.editionA} {t.editionB}
            </Text>
            <Text style={[serif(), { fontSize: 34, lineHeight: 34, color: ink, marginTop: 6 }]}>
              {t.feedA} <Text style={serif(true)}>{t.feedB}</Text>
            </Text>
          </View>
          {toc.map((p, i) => {
            const fc = friendColor(hueOf(p), scheme);
            return (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={p.title} onPress={() => f.openPost(p)} style={{ flexDirection: "row", gap: 14, paddingVertical: 16, paddingHorizontal: 26, borderBottomWidth: i < toc.length - 1 ? 1 : 0, borderBottomColor: rule, opacity: f.seen.has(p.id) ? SEEN_OPACITY : 1 }}>
                <View style={{ width: 8, backgroundColor: fc.fill }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>
                    {p.authorName} · {p.kind} · {timeLabel(p.createdAt, t, lang)}
                  </Text>
                  {p.untitled && p.media.kind === "foto" ? (
                    <View style={{ marginTop: 6, width: 88, height: 52, borderWidth: 1, borderColor: rule, backgroundColor: color("paper2"), overflow: "hidden" }}>
                      <SafeImage uri={p.media.uri} cacheKey={p.media.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
                    </View>
                  ) : (
                    <Text numberOfLines={2} style={[serif(), { fontSize: 22, lineHeight: 23, marginTop: 4, color: ink }]}>
                      {p.title}
                    </Text>
                  )}
                </View>
                <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: ink }]}>№ {numberOf(p.id)}</Text>
              </Pressable>
            );
          })}
          <ChatsSummary onOpen={(id) => router.push(`/chat/${id}` as never)} />
        </ScrollView>
      </View>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}

const chip = { borderWidth: 1.5, borderColor: ON_IMAGE, paddingVertical: 8, paddingHorizontal: 12 } as const;

/** Onderaan de kolom: "Gesprekken · n ongelezen" en de laatste gesprekken. */
function ChatsSummary({ onOpen }: { onOpen: (chatId: string) => void }) {
  const t = useT();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId), enabled: !!session, staleTime: 30_000 });
  const previews = useChatPreviews();
  const list = [...(chats.data ?? [])].sort((a, b) => (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at)).slice(0, 4);
  const unread = (chats.data ?? []).reduce((n, c) => n + (c.unread_count ?? 0), 0);
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  return (
    <View style={{ borderTopWidth: 1.5, borderTopColor: ink, paddingVertical: 18, paddingHorizontal: 26, gap: 10 }}>
      <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textTransform: "uppercase", color: dim }]}>
        {t.chats} · {unread} {t.unread}
      </Text>
      {list.map((c) => {
        const pv = previews[c.id];
        return (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => onOpen(c.id)} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <Text numberOfLines={1} style={[serif(), { fontSize: 18, lineHeight: 22, color: ink, flexShrink: 1 }]}>
              {chatTitle(c, myUserId)}
              {pv ? <Text style={[serif(true), { color: dim }]}> — {pv.text}</Text> : null}
            </Text>
            {c.unread_count ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: color("red") }]}>{c.unread_count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
