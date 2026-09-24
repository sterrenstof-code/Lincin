import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";

import { HuePicker } from "@/components/lincin/HuePicker";
import { SafeImage } from "@/components/SafeImage";
import { getOrCreateDirectChat, listMyChats } from "@/lib/api/chats";
import { acceptFriendRequest, deleteFriendship, listMyFriendships, sendFriendRequest } from "@/lib/api/friends";
import { listUserPosts } from "@/lib/api/posts";
import { getProfileByUsername } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { OMSLAG, RASTER, color, friendColor, hueFor, pageTint, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { bioLine, displayName, fromPost, timeLabel, type CardPost } from "@/lib/lincin/model";
import { useBackTarget } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { useSeenPosts } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

import { DesktopShell } from "./Shell";

/**
 * Het profiel van een vriend op desktop (desktop-*-pages.dc.html, VRIEND).
 *
 *   kleur     een band in zijn kleur: ← Terug, de naam in Archivo 900 smal
 *             168, de bio; rechts drie feiten en "Bericht aan …". Daaronder
 *             "Alle bijdragen" in vier kolommen met inktlijnen.
 *   magazine  een omslag van 600 (zijn plaat of nieuwste foto) met de naam
 *             in serif 236, rechts "Over …" en drie feiten; daaronder een
 *             raster van twaalf kolommen dat van maat wisselt.
 *   modern    een getinte tegel met avatar van 96 en de naam in 120, drie
 *             feittegels en "Bericht aan …"; tegels van een kwart breed.
 *
 * De feiten komen uit de echte gegevens: linc sinds (de vriendschap), het
 * aantal bijdragen, en de groepen die jullie delen. Wie (nog) geen linc is
 * krijgt de knoppen van de telefoon: verzoek sturen, intrekken, accepteren
 * of weigeren. De kleur die jij hem geeft kies je onder de bio.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };
const SEAM = RASTER.seam;

export function DesktopProfile({ username }: { username: string }) {
  const router = useRouter();
  const back = useBackTarget(router, "/feed");
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const { isSeen } = useSeenPosts();
  const [busy, setBusy] = useState(false);
  const [gridW, setGridW] = useState(0);

  const profile = useQuery({ queryKey: ["profile-by-username", username], queryFn: () => getProfileByUsername(username), enabled: !!username });
  usePageTitle(profile.data ? displayName(profile.data) : null);
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId), enabled: !!myUserId });
  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId), enabled: !!myUserId });
  const posts = useQuery({ queryKey: ["posts-by-user", profile.data?.id], queryFn: () => listUserPosts(profile.data!.id, 60), enabled: !!profile.data });
  const cards = useMemo(() => (posts.data ?? []).map(fromPost), [posts.data]);

  const p = profile.data;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const fc = friendColor(hueFor(p?.id), scheme);
  const name = p ? displayName(p) : username;
  const bio = bioLine(p?.bio);
  const friendship = p ? (friendships.data ?? []).find((x) => x.other.id === p.id) : undefined;
  const relation = !p
    ? null
    : p.id === myUserId
      ? { kind: "self" as const }
      : friendship?.status === "accepted"
        ? { kind: "friend" as const }
        : friendship?.status === "pending" && friendship.requester_id === myUserId
          ? { kind: "outgoing" as const, id: friendship.id }
          : friendship?.status === "pending"
            ? { kind: "incoming" as const, id: friendship.id, requesterId: friendship.requester_id }
            : { kind: "stranger" as const };

  // ---- de drie feiten ----
  const sinceIso = friendship?.status === "accepted" ? friendship.accepted_at : null;
  const since = sinceIso ? new Date(sinceIso).toLocaleDateString(LOCALE[lang], { month: "short", year: "numeric" }).replace(".", "") : "—";
  const together = (chats.data ?? []).filter((c) => c.type === "group" && p && c.members.some((m) => m.id === p.id)).map((c) => c.name ?? t.group);
  const stats = [
    { k: t.lincSince, v: since },
    { k: t.posts, v: String(cards.length) },
    { k: t.togetherIn, v: together[0] ?? "—" },
  ];
  const cover = p?.hero_url ?? cards.find((c) => c.media.kind === "foto" && c.media.uri)?.media;
  const coverUri = typeof cover === "string" ? cover : cover && cover.kind === "foto" ? cover.uri : null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  }
  const message = () => run(async () => p && router.push(`/chat/${await getOrCreateDirectChat(p.id)}` as never));
  /** De handeling op de plek van "Bericht aan …": wat bij de relatie hoort. */
  const actions: { label: string; onPress: () => void }[] =
    !p || !relation
      ? []
      : relation.kind === "friend"
        ? [{ label: `${t.messageTo} ${name}`, onPress: message }]
        : relation.kind === "self"
          ? [{ label: t.you, onPress: () => router.push("/profile") }]
          : relation.kind === "outgoing"
            ? [{ label: "Verzoek intrekken", onPress: () => run(() => deleteFriendship(relation.id)) }]
            : relation.kind === "incoming"
              ? [
                  { label: "Accepteer", onPress: () => run(() => acceptFriendRequest(relation.id, myUserId, relation.requesterId)) },
                  { label: "Weiger", onPress: () => run(() => deleteFriendship(relation.id)) },
                ]
              : [{ label: "Linc toevoegen", onPress: () => run(() => sendFriendRequest(myUserId, p.id)) }];

  const th = spec.id;
  const openPost = (c: CardPost) => router.push((c.href || `/post/${c.id}`) as never);
  const tiles = (width: number) =>
    cards.map((c, i) => {
      const isNew = c.authorId !== myUserId && !isSeen(c.id, c.createdAt);
      if (th === "magazine") {
        const spans = [6, 3, 3, 4, 4, 4, 6, 6];
        const k = i % spans.length;
        const unit = (width - SEAM * 11) / 12;
        const w = spans[k] * unit + (spans[k] - 1) * SEAM;
        return <TileMagazine key={c.id} c={c} width={w} tall={[0, 6, 7].includes(k)} isNew={isNew} fill={fc} onPress={() => openPost(c)} />;
      }
      const w = th === "modern" ? (width - SEAM * 3) / 4 : width / 4;
      return th === "modern" ? (
        <TileModern key={c.id} c={c} width={w} isNew={isNew} fill={fc} onPress={() => openPost(c)} />
      ) : (
        <TileKleur key={c.id} c={c} width={w} isNew={isNew} fill={fc} onPress={() => openPost(c)} />
      );
    });

  if (!p) {
    return (
      <DesktopShell active="feed">
        <Text style={[meta(10, color("ink", "inkDim")), { padding: 32 }]}>{profile.isLoading ? t.loading : t.failed}</Text>
      </DesktopShell>
    );
  }

  const ink = color("ink");
  const huePicker = relation && relation.kind !== "self" ? <HuePicker personId={p.id} ink={th === "kleur" ? fc.ink : ink} /> : null;

  // ---------------- KLEUR ----------------
  if (th === "kleur") {
    return (
      <DesktopShell active="feed">
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", backgroundColor: fc.fill, borderBottomWidth: spec.border, borderBottomColor: ink }}>
            <View style={{ flex: 1, minWidth: 0, paddingTop: 28, paddingHorizontal: 32, paddingBottom: 30, gap: 18 }}>
              <Pressable accessibilityRole="button" onPress={back.go} style={{ alignSelf: "flex-start", height: 34, paddingHorizontal: 12, justifyContent: "center", borderWidth: spec.border, borderColor: ink, backgroundColor: color("paper") }}>
                <Text style={[mono(600), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase", color: ink }]}>← {t.back}</Text>
              </Pressable>
              <FitName name={name} max={168} ratio={0.62} lead={0.81} style={[head(), { color: fc.ink }]} />
              {bio ? <Text style={[serif(), { maxWidth: 640, fontSize: 26, lineHeight: 31, color: fc.ink }]}>{bio}</Text> : null}
              {huePicker}
            </View>
            <View style={{ width: 360, borderLeftWidth: spec.border, borderLeftColor: ink }}>
              {stats.map((s) => (
                <View key={s.k} style={{ flex: 1, minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, borderBottomWidth: spec.border, borderBottomColor: ink }}>
                  <Text style={[mono(600), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: fc.ink }]}>{s.k}</Text>
                  <Text numberOfLines={1} style={[head(), { flexShrink: 1, marginLeft: 12, fontSize: 32, lineHeight: 32, color: fc.ink }]}>
                    {s.v}
                  </Text>
                </View>
              ))}
              {actions.map((a) => (
                <Pressable key={a.label} accessibilityRole="button" disabled={busy} onPress={a.onPress} style={{ height: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, backgroundColor: ink, opacity: busy ? 0.6 : 1 }}>
                  <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase", color: color("paper") }]}>{a.label}</Text>
                  <Text style={{ color: color("paper") }}>→</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ height: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 32, borderBottomWidth: spec.border, borderBottomColor: ink }}>
            <View style={{ width: 8, height: 8, backgroundColor: color("red") }} />
            <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase", color: ink }]}>{t.allPosts}</Text>
            <Text style={meta(11, color("ink", "inkDim"))}>{t.newestFirst}</Text>
          </View>
          <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {gridW ? tiles(gridW) : null}
          </View>
        </ScrollView>
      </DesktopShell>
    );
  }

  // ---------------- MAGAZINE ----------------
  if (th === "magazine") {
    return (
      <DesktopShell active="feed" tabTint={fc.fill}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: SEAM, padding: SEAM }}>
            <View style={{ flex: 1, minWidth: 0, height: 600, overflow: "hidden", backgroundColor: coverUri ? color("paper2") : fc.fill }}>
              {coverUri ? <SafeImage uri={coverUri} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" /> : null}
              <View
                pointerEvents="none"
                style={[
                  { position: "absolute", left: 0, right: 0, top: 0, height: 360 },
                  Platform.OS === "web"
                    ? ({ backgroundImage: "linear-gradient(180deg,rgba(16,16,12,.62),rgba(16,16,12,.3) 46%,rgba(16,16,12,0))" } as object)
                    : { backgroundColor: "rgba(16,16,12,.3)" },
                ]}
              />
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, backgroundColor: fc.fill }} />
              <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: 26, paddingHorizontal: 40 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 20 }}>
                  <Text style={magLabel(10, ON_PHOTO)}>{t.lincPortrait}</Text>
                  <Text style={magLabel(10, ON_PHOTO)}>
                    {cards.length} {t.posts}
                    {sinceIso ? ` · ${t.lincSince.toLowerCase()} ${new Date(sinceIso).getFullYear()}` : ""}
                  </Text>
                </View>
                {/* De omslag: de naam rood in Archivo 900, kapitaal, tot 300. */}
                <FitName name={name.toUpperCase()} max={300} ratio={0.84} lead={0.76} spacing={-0.05} style={[sans(900), { marginTop: 8, color: color("red") }]} />
              </View>
              <Pressable accessibilityRole="button" onPress={back.go} style={{ position: "absolute", left: 40, bottom: 24, height: 36, paddingHorizontal: 16, justifyContent: "center", backgroundColor: "rgba(16,16,12,.55)" }}>
                <Text style={magLabel(10, ON_PHOTO)}>← {t.back}</Text>
              </Pressable>
            </View>
            <View style={{ width: 480, gap: SEAM }}>
              <View style={{ flex: 1, paddingTop: 30, paddingRight: 32, paddingBottom: 28, paddingLeft: 27, borderLeftWidth: 5, borderLeftColor: fc.fill, gap: 18 }}>
                <Text style={magLabel(10, color("ink", "inkDim"))}>
                  {t.aboutTitle} {name}
                </Text>
                {bio ? <Text style={[serif(true), { fontSize: 30, lineHeight: 36, color: ink }]}>{bio}</Text> : null}
                {huePicker}
                <View style={{ flex: 1 }} />
                {actions.map((a) => (
                  <Pressable key={a.label} accessibilityRole="button" disabled={busy} onPress={a.onPress}>
                    <Text style={[serif(), { fontSize: 22, lineHeight: 27, color: ink, textDecorationLine: "underline", opacity: busy ? 0.6 : 1 }]}>{a.label} →</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: SEAM }}>
                {stats.map((s) => (
                  <View key={s.k} style={{ flex: 1, minWidth: 0, backgroundColor: color("paper2"), paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16, gap: 10 }}>
                    <Text style={magLabel(10, color("ink", "inkDim"))}>{s.k}</Text>
                    <Text numberOfLines={1} style={[serif(), { fontSize: 30, lineHeight: 30, color: ink }]}>
                      {s.v}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={{ marginHorizontal: SEAM, paddingTop: 14, paddingHorizontal: 26, paddingBottom: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", borderBottomWidth: OMSLAG.rule, borderBottomColor: ink }}>
            <Text style={[serif(), { fontSize: 30, lineHeight: 32, color: ink }]}>
              {t.allPosts} <Text style={serif(true)}>{t.fromName} {name}</Text>
            </Text>
            <Text style={magLabel(10, color("ink", "inkDim"))}>{t.newestFirst}</Text>
          </View>
          <View onLayout={(e) => setGridW(e.nativeEvent.layout.width - SEAM * 2)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM, padding: SEAM }}>
            {gridW ? tiles(gridW) : null}
          </View>
        </ScrollView>
      </DesktopShell>
    );
  }

  // ---------------- MODERN ----------------
  return (
    <DesktopShell active="feed" tint={fc.fill}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: SEAM }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: SEAM }}>
          <View style={{ flex: 2, minWidth: 0, minHeight: 340, padding: 26, gap: 18, borderRadius: RASTER.tileRadius, backgroundColor: pageTint(fc.fill, scheme, { light: 0.22, dark: 0.2 }) }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t.back} onPress={back.go} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ink, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16, lineHeight: 19, color: color("paper") }}>←</Text>
            </Pressable>
            <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "flex-end", gap: 20 }}>
              <View style={{ width: 96, height: 96, borderRadius: 48, overflow: "hidden", backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
                {p.avatar_url ? (
                  <SafeImage uri={p.avatar_url} style={{ width: 96, height: 96 }} contentFit="cover" />
                ) : (
                  <Text style={[sans(700), { fontSize: 34, lineHeight: 40, color: fc.ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <FitName name={name} max={120} ratio={0.6} lead={0.85} spacing={-0.06} style={[sans(400), { color: ink }]} />
              </View>
            </View>
            {bio ? <Text style={[sans(400), { maxWidth: 620, fontSize: 20, lineHeight: 28, color: color("ink", "inkDim") }]}>{bio}</Text> : null}
            {huePicker}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: SEAM }}>
            {stats.map((s) => (
              <View key={s.k} style={{ flex: 1, minHeight: 64, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill"), paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={meta(9, color("ink", "inkDim"), 1.44)}>{s.k}</Text>
                <Text numberOfLines={1} style={[sans(400), { flexShrink: 1, marginLeft: 12, fontSize: 30, lineHeight: 34, letterSpacing: -0.9, color: ink }]}>
                  {s.v}
                </Text>
              </View>
            ))}
            {actions.map((a) => (
              <Pressable key={a.label} accessibilityRole="button" disabled={busy} onPress={a.onPress} style={{ height: 64, borderRadius: RASTER.tileRadius, backgroundColor: ink, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: busy ? 0.6 : 1 }}>
                <Text style={meta(10, color("paper"), 1.2)}>{a.label}</Text>
                <Text style={{ color: color("paper") }}>→</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ marginTop: 22, height: 52, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill"), paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: fc.fill }} />
          <Text style={meta(9.5, ink, 1.5)}>{t.allPosts}</Text>
          <Text style={meta(9.5, color("ink", "inkDim"), 1.5)}>{t.newestFirst}</Text>
        </View>
        <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM }}>
          {gridW ? tiles(gridW) : null}
        </View>
      </ScrollView>
    </DesktopShell>
  );
}

const ON_PHOTO = "#F7F4EE";

/**
 * De naam zo groot als het ontwerp hem wil (168, 236, 120), maar nooit
 * breder dan zijn kolom: een lange gebruikersnaam wordt kleiner in plaats
 * van af te breken. `ratio` is de gemiddelde breedte van een letter in die
 * letter, als deel van de korps.
 */
function FitName({ name, max, ratio, lead, spacing = 0, style }: { name: string; max: number; ratio: number; lead: number; spacing?: number; style: TextStyle | TextStyle[] }) {
  const [w, setW] = useState(0);
  const size = w ? Math.max(28, Math.min(max, Math.floor(w / (Math.max(1, name.length) * (ratio + spacing))))) : max;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignSelf: "stretch" }}>
      <Text numberOfLines={1} style={[style, { fontSize: size, lineHeight: Math.round(size * lead) + 4, letterSpacing: size * spacing, opacity: w ? 1 : 0 }]}>
        {name}
      </Text>
    </View>
  );
}

function meta(size: number, c: string, spacing = size * 0.1): TextStyle {
  return { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

/** Het label van de omslag: Archivo 700, kapitaal, .1em. */
function magLabel(size: number, c: string, spacing = size * 0.1): TextStyle {
  return { ...sans(700), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

type TileProps = { c: CardPost; width: number; isNew: boolean; fill: { fill: string; ink: string }; onPress: () => void };

/** Het beeld van een tegel: de foto, of de tekst op het kleurvlak. */
function Area({ c, height, fill, text }: { c: CardPost; height: number; fill: { fill: string; ink: string }; text: (s: string) => ReactNode }) {
  const m = c.media;
  const uri = m.kind === "foto" ? m.uri : m.kind === "link" ? m.image : m.kind === "muziek" ? m.cover : null;
  return (
    <View style={{ height, overflow: "hidden", backgroundColor: uri ? color("paper2") : fill.fill }}>
      {uri ? (
        <SafeImage uri={uri} cacheKey={m.kind === "foto" ? m.cacheKey : undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        text(m.kind === "tekst" ? m.text : c.caption || c.title)
      )}
    </View>
  );
}

function TileKleur({ c, width, isNew, fill, onPress }: TileProps) {
  const t = useT();
  const lang = useLang();
  const spec = useThemeSpec();
  const ink = color("ink");
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={c.title} onPress={onPress} style={{ width, borderRightWidth: spec.border, borderBottomWidth: spec.border, borderColor: ink }}>
      <View style={{ borderBottomWidth: spec.border, borderBottomColor: ink }}>
        <Area
          c={c}
          height={220}
          fill={fill}
          text={(s) => (
            <Text numberOfLines={6} style={[serif(), { paddingTop: 48, paddingHorizontal: 18, fontSize: 22, lineHeight: 26, color: fill.ink }]}>
              {s}
            </Text>
          )}
        />
        {isNew ? (
          <View style={{ position: "absolute", top: 10, left: 10, height: 22, paddingHorizontal: 8, justifyContent: "center", backgroundColor: color("acid"), borderWidth: spec.border, borderColor: ink }}>
            <Text style={[mono(600), { fontSize: 9.5, lineHeight: 12, letterSpacing: 0.76, textTransform: "uppercase", color: "#141414" }]}>{t.new}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18, gap: 8, borderLeftWidth: 6, borderLeftColor: fill.fill }}>
        <Text style={[mono(600), { fontSize: 9.5, lineHeight: 12, letterSpacing: 0.76, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
          {c.kind} · {timeLabel(c.createdAt, t, lang)}
        </Text>
        <Text numberOfLines={2} style={[head(), { fontSize: 22, lineHeight: 21, color: ink }]}>
          {c.title}
        </Text>
      </View>
    </Pressable>
  );
}

function TileMagazine({ c, width, tall, isNew, fill, onPress }: TileProps & { tall: boolean }) {
  const t = useT();
  const lang = useLang();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={c.title} onPress={onPress} style={{ width, backgroundColor: color("paper2") }}>
      <View>
        <Area
          c={c}
          height={tall ? 380 : 260}
          fill={fill}
          text={(s) => (
            <Text numberOfLines={8} style={[serif(true), { paddingTop: 52, paddingHorizontal: 24, fontSize: 28, lineHeight: 33, color: fill.ink }]}>
              {s}
            </Text>
          )}
        />
        {isNew ? (
          <View style={{ position: "absolute", top: 12, left: 12, height: 24, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color("paper") }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color("red") }} />
            <Text style={magLabel(10, color("ink"))}>{t.new}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 16, paddingRight: 20, paddingBottom: 20, paddingLeft: 15, borderLeftWidth: 5, borderLeftColor: fill.fill, gap: 8 }}>
        <Text style={magLabel(10, color("ink", "inkDim"))}>
          {c.kind} · {timeLabel(c.createdAt, t, lang)}
        </Text>
        <Text numberOfLines={2} style={[serif(), { fontSize: 28, lineHeight: 29, color: color("ink") }]}>
          {c.title}
        </Text>
      </View>
    </Pressable>
  );
}

function TileModern({ c, width, isNew, fill, onPress }: TileProps) {
  const t = useT();
  const lang = useLang();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={c.title} onPress={onPress} style={{ width, borderRadius: RASTER.tileRadius, overflow: "hidden", backgroundColor: color("tile", "tileFill") }}>
      <View>
        <Area
          c={c}
          height={200}
          fill={fill}
          text={(s) => (
            <Text numberOfLines={7} style={[sans(400), { paddingTop: 48, paddingHorizontal: 18, fontSize: 17, lineHeight: 23, color: fill.ink }]}>
              {s}
            </Text>
          )}
        />
        {isNew ? (
          <View style={{ position: "absolute", top: 12, left: 12, height: 24, paddingHorizontal: 10, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(244,241,235,.9)" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color("red") }} />
            <Text style={meta(8.5, "#17170F", 1.2)}>{t.new}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 16, paddingHorizontal: 18, paddingBottom: 20, gap: 8 }}>
        <Text style={meta(8.5, color("ink", "inkDim"), 1.36)}>
          {c.kind} · {timeLabel(c.createdAt, t, lang)}
        </Text>
        <Text numberOfLines={2} style={[sans(500), { fontSize: 17, lineHeight: 21, letterSpacing: -0.25, color: color("ink") }]}>
          {c.title}
        </Text>
      </View>
    </Pressable>
  );
}
