import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, type TextStyle } from "react-native";

import { describe, destinationFor } from "@/app/(app)/notifications";
import { SafeImage } from "@/components/SafeImage";
import { listMyFriendships } from "@/lib/api/friends";
import { listNotifications, markAllNotificationsRead, markNotificationRead, type NotificationWithDetails } from "@/lib/api/notifications";
import { listUserPosts } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { OMSLAG, RASTER, color, friendColor, hueFor, pageTint, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { displayName, fromPost, shortAgo, timeLabel, type CardPost } from "@/lib/lincin/model";

import { DesktopShell } from "./Shell";
import { Black } from "../magazine/Omslag";

/**
 * Jij op desktop (desktop-*-pages.dc.html, JIJ): links jouw band en jouw
 * bijdragen, rechts de meldingen. Instellingen hebben een eigen pagina
 * (`/settings` → DesktopSettings); de ◉ in de balk komt hier uit.
 *
 *   kleur     een band in jouw kleur met avatar van 96, "Jij" in 56 en
 *             Instellingen →; bijdragen in drie kolommen; meldingen als
 *             rijen met een gekleurd blok.
 *   magazine  "Jij" in serif 220 op het tweede papier met je rug, drie
 *             feiten, meldingen met een kleurstreep; bijdragen in een raster
 *             dat van maat wisselt.
 *   modern    een getinte tegel met avatar van 80, tegels, meldingen als
 *             kleine tegels.
 */

const SEAM = RASTER.seam;
const WEEK = 7 * 24 * 3600 * 1000;

export function DesktopYou() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();
  useHueChoices();
  const th = spec.id;
  const [gridW, setGridW] = useState(0);

  const profile = useQuery({ queryKey: ["profile", myUserId], queryFn: () => getProfile(myUserId) });
  const posts = useQuery({ queryKey: ["posts-by-user", myUserId], queryFn: () => listUserPosts(myUserId, 60) });
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });
  const notes = useQuery({ queryKey: ["notifications", myUserId], queryFn: () => listNotifications(myUserId), refetchOnWindowFocus: true });
  const cards = useMemo(() => (posts.data ?? []).map(fromPost), [posts.data]);
  const name = displayName(profile.data ?? { username: session!.user.email ?? "" });
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;
  const now = Date.now();
  const week = cards.filter((c) => now - new Date(c.createdAt).getTime() < WEEK).length;
  const comments = cards.reduce((n, c) => n + c.commentCount, 0);
  const mine = friendColor(hueFor(myUserId), scheme);
  const statLine = `${lincs} lincs · ${week} ${week === 1 ? t.post1 : t.posts} ${t.thisWeek.toLowerCase()}`;
  const stats = [
    { k: "Lincs", v: String(lincs) },
    { k: t.thisWeek, v: String(week) },
    { k: t.comments, v: String(comments) },
  ];

  const list = notes.data ?? [];
  const unread = list.filter((n) => !n.read).length;
  const bump = () => {
    qc.invalidateQueries({ queryKey: ["notifications", myUserId] });
    qc.invalidateQueries({ queryKey: ["notifications-unread", myUserId] });
  };
  const openNote = (n: NotificationWithDetails) => {
    if (!n.read) {
      qc.setQueryData<NotificationWithDetails[]>(["notifications", myUserId], (old) => (old ?? []).map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).then(bump).catch(() => {});
    }
    const to = destinationFor(n);
    if (to) router.push(to as never);
  };
  const readAll = async () => {
    await markAllNotificationsRead(myUserId).catch(() => {});
    bump();
  };

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const openPost = (c: CardPost) => router.push((c.href || `/post/${c.id}`) as never);
  const toSettings = () => router.push("/settings");

  // ---- de meldingen ----
  const noteRows = list.slice(0, 12).map((n) => {
    const by = n.type === "bug_resolved" ? "" : n.actor?.display_name ?? n.actor?.username ?? "Iemand";
    const fc = friendColor(hueFor(n.actor_id), scheme);
    return { n, by, text: describe(n).text, when: shortAgo(n.created_at, t, lang), fc, initial: (by || "·").slice(0, 1).toUpperCase() };
  });
  const notesBlock = (
    <View
      style={[
        th === "kleur" ? { width: 460 } : null,
        th === "magazine" ? { width: 480, backgroundColor: color("paper2"), paddingTop: 22, paddingHorizontal: 28, paddingBottom: 20, gap: 12 } : null,
        th === "modern" ? { width: 460, padding: 18, gap: 6, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") } : null,
      ]}
    >
      <View
        style={[
          { flexDirection: "row", alignItems: th === "magazine" ? "baseline" : "center", justifyContent: "space-between" },
          th === "kleur" ? { height: 52, paddingHorizontal: 24, borderBottomWidth: spec.border, borderBottomColor: ink } : null,
          th === "modern" ? { paddingHorizontal: 4, paddingBottom: 8 } : null,
        ]}
      >
        {th === "magazine" ? (
          // De omslag: "Meldingen" rood in Archivo 900 van 40.
          <Black size={40} f={0.85}>
            {t.notifications}
          </Black>
        ) : (
          <Text style={meta(th === "kleur" ? 11 : 9, ink, th === "kleur" ? 600 : 500)}>{t.notifications}</Text>
        )}
        {unread ? (
          <Pressable accessibilityRole="button" onPress={readAll}>
            <Text style={[th === "magazine" ? magLabel(9, ink) : meta(th === "kleur" ? 10 : 9, dim, 500), { textDecorationLine: "underline" }]}>{th === "magazine" ? t.markAllRead : t.allRead}</Text>
          </Pressable>
        ) : null}
      </View>
      {noteRows.length === 0 ? (
        <Text style={[sans(), { padding: th === "kleur" ? 24 : 4, fontSize: 15, lineHeight: 20, color: dim }]}>{notes.isLoading ? t.loading : t.noNotes}</Text>
      ) : (
        noteRows.map((r) =>
          th === "magazine" ? (
            <Pressable key={r.n.id} accessibilityRole="link" onPress={() => openNote(r.n)} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: rule }}>
              <View style={{ width: 6, alignSelf: "stretch", backgroundColor: r.fc.fill }} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={magLabel(9, r.n.read ? dim : color("red"))}>
                  {r.by ? `${r.by} · ` : ""}
                  {r.when}
                </Text>
                <Text style={[serif(), { fontSize: 21, lineHeight: 23, color: ink }]}>{r.text}</Text>
              </View>
              {!r.n.read ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color("red") }} /> : null}
            </Pressable>
          ) : (
            <Pressable
              key={r.n.id}
              accessibilityRole="link"
              onPress={() => openNote(r.n)}
              style={[
                { flexDirection: "row", alignItems: "center", gap: 14 },
                th === "kleur"
                  ? { paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: rule, backgroundColor: r.n.read ? "transparent" : color("ink", "pillSoft") }
                  : { padding: 12, borderRadius: 14, backgroundColor: r.n.read ? "transparent" : color("paper") },
              ]}
            >
              <View
                style={[
                  { width: th === "kleur" ? 40 : 44, height: th === "kleur" ? 40 : 44, backgroundColor: r.fc.fill, alignItems: "center", justifyContent: "center" },
                  th === "kleur" ? { borderWidth: spec.border, borderColor: ink } : { borderRadius: 22 },
                ]}
              >
                <Text style={[th === "kleur" ? head() : sans(700), { fontSize: th === "kleur" ? 20 : 14, lineHeight: th === "kleur" ? 20 : 17, color: r.fc.ink }]}>{r.initial}</Text>
              </View>
              <Text style={[sans(), { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, color: ink }]}>
                {r.by ? <Text style={th === "kleur" ? [head(), { fontSize: 15 }] : sans(700)}>{r.by} </Text> : null}
                {r.text}
              </Text>
              <Text style={meta(th === "kleur" ? 10 : 8.5, r.n.read ? dim : color("red"), th === "kleur" ? 600 : 500)}>{r.when}</Text>
            </Pressable>
          ),
        )
      )}
    </View>
  );

  // ---- jouw bijdragen ----
  const cols = 3;
  const tileW = (w: number) => (th === "kleur" ? w / cols : (w - SEAM * (cols - 1)) / cols);
  const postTiles = (w: number) =>
    cards.map((c, i) => {
      if (th === "magazine") {
        const spans = [6, 3, 3];
        const k = i % 3;
        const unit = (w - SEAM * 11) / 12;
        const width = spans[k] * unit + (spans[k] - 1) * SEAM;
        return <MyTile key={c.id} c={c} width={width} height={k === 0 ? 380 : 260} fill={mine} onPress={() => openPost(c)} />;
      }
      return <MyTile key={c.id} c={c} width={tileW(w)} height={th === "kleur" ? 200 : 220} fill={mine} onPress={() => openPost(c)} />;
    });

  const avatar = (size: number) => (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: th === "kleur" ? color("paper") : mine.fill }, th === "kleur" ? { borderWidth: spec.border, borderColor: ink } : null]}>
      {profile.data?.avatar_url ? (
        <SafeImage uri={profile.data.avatar_url} style={{ width: size, height: size }} contentFit="cover" />
      ) : (
        <Text style={[th === "kleur" ? head() : sans(700), { fontSize: size / 2, lineHeight: size / 2 + 4, color: th === "kleur" ? ink : mine.ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );

  // ---------------- KLEUR ----------------
  if (th === "kleur") {
    return (
      <DesktopShell active="you">
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", minHeight: 732 }}>
            <View style={{ flex: 1, minWidth: 0, borderRightWidth: spec.border, borderRightColor: ink }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 24, paddingVertical: 28, paddingHorizontal: 32, backgroundColor: mine.fill, borderBottomWidth: spec.border, borderBottomColor: ink }}>
                <Pressable accessibilityRole="link" onPress={() => router.push((profile.data?.username ? `/user/${profile.data.username}` : "/profile-edit") as never)}>
                  {avatar(96)}
                </Pressable>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Text style={[head(), { fontSize: 56, lineHeight: 48, color: mine.ink }]}>{t.me}</Text>
                  <Text style={meta(10, mine.ink, 600)}>{statLine}</Text>
                </View>
                <Pressable accessibilityRole="link" onPress={toSettings} style={{ height: 40, paddingHorizontal: 16, justifyContent: "center", backgroundColor: color("paper"), borderWidth: spec.border, borderColor: ink }}>
                  <Text style={meta(11, ink, 600)}>{t.settings} →</Text>
                </Pressable>
              </View>
              <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, borderBottomWidth: spec.border, borderBottomColor: ink }}>
                <Text style={meta(11, ink, 600)}>{t.myPosts}</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push("/post-compose")}>
                  <Text style={[meta(10, ink, 500), { textDecorationLine: "underline" }]}>{t.newPost} +</Text>
                </Pressable>
              </View>
              <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {gridW ? postTiles(gridW) : null}
              </View>
            </View>
            {notesBlock}
          </View>
        </ScrollView>
      </DesktopShell>
    );
  }

  // ---------------- MAGAZINE ----------------
  if (th === "magazine") {
    return (
      <DesktopShell active="you" tabTint={mine.fill}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: SEAM, padding: SEAM }}>
            <View style={{ flex: 1, minWidth: 0, gap: SEAM }}>
              <View style={{ minHeight: 360, paddingTop: 30, paddingRight: 32, paddingBottom: 28, paddingLeft: 27, borderLeftWidth: 5, borderLeftColor: mine.fill, backgroundColor: color("paper2"), justifyContent: "space-between", gap: 24 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 20 }}>
                  <Text style={magLabel(10, dim)}>{t.yourPage}</Text>
                  <Pressable accessibilityRole="link" onPress={toSettings}>
                    <Text style={[magLabel(10, ink), { textDecorationLine: "underline" }]}>{t.settings} →</Text>
                  </Pressable>
                </View>
                {/* De omslag: JIJ rood in Archivo 900 van 260. */}
                <Black size={260} f={0.76} upper nowrap>
                  {t.me}
                </Black>
              </View>
              <View style={{ flexDirection: "row", gap: SEAM }}>
                {stats.map((s) => (
                  <View key={s.k} style={{ flex: 1, backgroundColor: color("paper2"), paddingTop: 18, paddingHorizontal: 22, paddingBottom: 16, gap: 10 }}>
                    <Text style={magLabel(8.5, dim)}>{s.k}</Text>
                    <Text style={[serif(), { fontSize: 34, lineHeight: 34, color: ink }]}>{s.v}</Text>
                  </View>
                ))}
              </View>
            </View>
            {notesBlock}
          </View>
          <View style={{ marginHorizontal: SEAM, paddingTop: 14, paddingHorizontal: 26, paddingBottom: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", borderBottomWidth: OMSLAG.rule, borderBottomColor: ink }}>
            <Text style={[serif(), { fontSize: 30, lineHeight: 32, color: ink }]}>
              {t.myPosts.split(" ")[0]} <Text style={serif(true)}>{t.myPosts.split(" ").slice(1).join(" ")}</Text>
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push("/post-compose")}>
              <Text style={[magLabel(9, ink), { textDecorationLine: "underline" }]}>{t.newPost} +</Text>
            </Pressable>
          </View>
          <View onLayout={(e) => setGridW(e.nativeEvent.layout.width - SEAM * 2)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM, padding: SEAM }}>
            {gridW ? postTiles(gridW) : null}
          </View>
        </ScrollView>
      </DesktopShell>
    );
  }

  // ---------------- MODERN ----------------
  return (
    <DesktopShell active="you" tint={mine.fill}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: SEAM, minHeight: 680 }}>
          <View style={{ flex: 1, minWidth: 0, gap: SEAM }}>
            <View style={{ padding: 22, flexDirection: "row", alignItems: "center", gap: 20, borderRadius: RASTER.tileRadius, backgroundColor: pageTint(mine.fill, scheme, { light: 0.22, dark: 0.2 }) }}>
              {avatar(80)}
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Text style={[sans(400), { fontSize: 48, lineHeight: 48, letterSpacing: -2.2, color: ink }]}>{t.me}</Text>
                <Text style={meta(8.5, dim, 500)}>{statLine}</Text>
              </View>
              <Pressable accessibilityRole="link" onPress={toSettings} style={{ height: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(255,255,255,.8)" }}>
                <Text style={meta(9.5, "#17170F", 500)}>{t.settings} →</Text>
              </Pressable>
            </View>
            <View onLayout={(e) => setGridW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: SEAM }}>
              {gridW ? postTiles(gridW) : null}
            </View>
          </View>
          {notesBlock}
        </View>
      </ScrollView>
    </DesktopShell>
  );
}

function meta(size: number, c: string, weight: 500 | 600): TextStyle {
  return { ...mono(weight), fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: size * 0.12, textTransform: "uppercase", color: c };
}

/** Het label van de omslag: Archivo 700, kapitaal, .1em. */
function magLabel(size: number, c: string): TextStyle {
  return { ...sans(700), fontSize: Math.max(10, size), lineHeight: Math.round(Math.max(10, size) * 1.35), letterSpacing: Math.max(10, size) * 0.1, textTransform: "uppercase", color: c };
}

/** Eén van jouw bijdragen: het beeld (of je kleur) en soort · wanneer · reacties, de titel. */
function MyTile({ c, width, height, fill, onPress }: { c: CardPost; width: number; height: number; fill: { fill: string; ink: string }; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const m = c.media;
  const uri = m.kind === "foto" ? m.uri : m.kind === "link" ? m.image : m.kind === "muziek" ? m.cover : null;
  const line = `${c.kind} · ${timeLabel(c.createdAt, t, lang)} · ${c.commentCount} ${c.commentCount === 1 ? t.comment.toLowerCase() : t.comments.toLowerCase()}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={c.title}
      onPress={onPress}
      style={[
        { width, overflow: "hidden" },
        th === "kleur" ? { borderRightWidth: spec.border, borderBottomWidth: spec.border, borderColor: ink } : null,
        th === "magazine" ? { backgroundColor: color("paper2") } : null,
        th === "modern" ? { borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") } : null,
      ]}
    >
      <View style={[{ height, overflow: "hidden", backgroundColor: uri ? color("paper2") : fill.fill }, th === "kleur" ? { borderBottomWidth: spec.border, borderBottomColor: ink } : null]}>
        {uri ? (
          <SafeImage uri={uri} cacheKey={m.kind === "foto" ? m.cacheKey : undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : m.kind === "tekst" ? (
          <Text numberOfLines={6} style={[th === "modern" ? sans(400) : serif(), { padding: 18, paddingTop: 40, fontSize: 20, lineHeight: 25, color: fill.ink }]}>
            {m.text}
          </Text>
        ) : null}
      </View>
      <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 18, gap: 8, borderLeftWidth: th === "modern" ? 0 : th === "magazine" ? 5 : 6, borderLeftColor: fill.fill }}>
        <Text numberOfLines={1} style={th === "magazine" ? magLabel(9, color("ink", "inkDim")) : meta(th === "kleur" ? 9.5 : 8.5, color("ink", "inkDim"), th === "kleur" ? 600 : 500)}>
          {line}
        </Text>
        <Text numberOfLines={2} style={[th === "kleur" ? head() : th === "magazine" ? serif() : sans(500), { fontSize: th === "kleur" ? 22 : th === "magazine" ? 28 : 17, lineHeight: th === "kleur" ? 21 : th === "magazine" ? 29 : 21, color: ink }]}>
          {c.title}
        </Text>
      </View>
    </Pressable>
  );
}
