import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { HuePicker } from "@/components/lincin/HuePicker";
import { SafeImage } from "@/components/SafeImage";
import { getOrCreateDirectChat } from "@/lib/api/chats";
import { acceptFriendRequest, deleteFriendship, listMyFriendships, sendFriendRequest } from "@/lib/api/friends";
import { listUnifiedFeed, listUserPosts } from "@/lib/api/posts";
import { getProfileByUsername } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { displayName, fromPost, numberMap, timeLabel, toCardPost, type CardPost } from "@/lib/lincin/model";
import { usePageTitle } from "@/lib/page-title";
import { useToast } from "@/lib/toast";

import { DesktopShell, MonoLink, TopBar } from "./Shell";

/**
 * Het profiel van een vriend op desktop (Lincin Desktop.dc.html, PROFIEL).
 *
 * Een balk van 56 met `← Feed` en "Profiel · naam"; dan een vlak in zijn
 * kleur met de naam in Archivo 900 van 52, de bio cursief, en rechts
 * BERICHT →. Daaronder "Alles van … · n bijdragen" en een raster
 * van kaarten (minstens 240 breed, 200 hoog). Het blad kleurt mee.
 *
 * Wie (nog) geen linc is krijgt op die plek de knoppen van de telefoon:
 * een verzoek sturen, intrekken, accepteren of weigeren.
 */

const MIN_CARD = 240;

export function DesktopProfile({ username }: { username: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const [busy, setBusy] = useState(false);
  const [gridW, setGridW] = useState(0);

  const profile = useQuery({ queryKey: ["profile-by-username", username], queryFn: () => getProfileByUsername(username), enabled: !!username });
  usePageTitle(profile.data ? displayName(profile.data) : null);
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId), enabled: !!myUserId });
  const posts = useQuery({ queryKey: ["posts-by-user", profile.data?.id], queryFn: () => listUserPosts(profile.data!.id, 60), enabled: !!profile.data });
  // Hetzelfde № als in de feed, voor wat daar ook staat.
  const feed = useQuery({ queryKey: ["unified-feed", myUserId], queryFn: () => listUnifiedFeed(myUserId), enabled: !!myUserId, staleTime: 30_000 });
  const numbers = useMemo(
    () => numberMap((feed.data ?? []).map((i) => toCardPost(i, t)).filter((c): c is CardPost => !!c)),
    [feed.data, t],
  );
  const cards = useMemo(() => (posts.data ?? []).map(fromPost), [posts.data]);

  const p = profile.data;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const fc = friendColor(hueFor(p?.id), scheme);
  const name = p ? displayName(p) : username;
  const relation = useMemo(() => {
    if (!p) return null;
    if (p.id === myUserId) return { kind: "self" as const };
    const f = (friendships.data ?? []).find((x) => x.other.id === p.id);
    if (f?.status === "accepted") return { kind: "friend" as const };
    if (f?.status === "pending" && f.requester_id === myUserId) return { kind: "outgoing" as const, id: f.id };
    if (f?.status === "pending") return { kind: "incoming" as const, id: f.id, requesterId: f.requester_id };
    return { kind: "stranger" as const };
  }, [p, friendships.data, myUserId]);

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

  const button = (label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" disabled={busy} onPress={onPress} style={{ borderWidth: spec.border, borderColor: fc.ink, paddingVertical: 10, paddingHorizontal: 14, opacity: busy ? 0.6 : 1 }}>
      <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: fc.ink }]}>{label}</Text>
    </Pressable>
  );
  const buttons = !p || !relation
    ? null
    : relation.kind === "friend"
      ? [button(`${t.privateMsg} →`, () => run(async () => router.push(`/chat/${await getOrCreateDirectChat(p.id)}` as never)))]
      : relation.kind === "self"
        ? [button(`${t.you} →`, () => router.push("/profile"))]
        : relation.kind === "outgoing"
          ? [button("Verzoek intrekken", () => run(() => deleteFriendship(relation.id)))]
          : relation.kind === "incoming"
            ? [button("Accepteer", () => run(() => acceptFriendRequest(relation.id, myUserId, relation.requesterId))), button("Weiger", () => run(() => deleteFriendship(relation.id)))]
            : [button("Linc toevoegen", () => run(() => sendFriendRequest(myUserId, p.id)))];

  const cols = Math.max(1, Math.floor((gridW + 1) / (MIN_CARD + 1)));
  const cardW = gridW ? (gridW - (cols - 1)) / cols : MIN_CARD;
  const dim = color("ink", "inkDim");

  return (
    <DesktopShell active="feed" tint={p ? fc.fill : null}>
      <TopBar
        left={
          <>
            <MonoLink label={`← ${t.tabFeed}`} active onPress={() => router.navigate("/feed")} />
            <MonoLink numberOfLines={1} label={`${t.scrProfile} · ${name}`} />
          </>
        }
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
        {profile.isLoading ? (
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim }]}>{t.loading}</Text>
        ) : !p ? (
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim }]}>{t.failed}</Text>
        ) : (
          <>
            <View style={{ backgroundColor: fc.fill, paddingVertical: 26, paddingHorizontal: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Text style={[head(), { fontSize: 52, lineHeight: 47, color: fc.ink }]}>{name}</Text>
                {p.bio ? (
                  <Text numberOfLines={3} style={[serif(true), { fontSize: 19, lineHeight: 24, marginTop: 8, color: fc.ink }]}>
                    {p.bio.split("\n")[0]}
                  </Text>
                ) : null}
                {relation && relation.kind !== "self" ? (
                  <View style={{ marginTop: 14 }}>
                    <HuePicker personId={p.id} ink={fc.ink} />
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>{buttons}</View>
            </View>

            <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim, marginTop: 20, marginBottom: 10 }]}>
              {t.allFrom} {name} · {cards.length} {cards.length === 1 ? t.post1 : t.posts}
            </Text>
            <View
              onLayout={(e) => setGridW(e.nativeEvent.layout.width - 2)}
              style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, backgroundColor: color("ink", "postRule"), borderWidth: 1, borderColor: color("ink", "postRule") }}
            >
              {cards.map((c) => (
                <Card key={c.id} post={c} width={cardW} number={numbers.get(c.id) ?? null} onPress={() => router.push(`/post/${c.id}` as never)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </DesktopShell>
  );
}

function Card({ post: c, width, number, onPress }: { post: CardPost; width: number; number: string | null; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const m = c.media;
  const image = m.kind === "foto" ? m : null;
  const dim = color("ink", "inkDim");
  return (
    <Pressable accessibilityLabel={c.title} onPress={onPress} style={{ width, height: 200, backgroundColor: color("paper") }}>
      <View style={{ flex: 1, minHeight: 0, backgroundColor: color("paper2"), alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {image ? (
          <SafeImage uri={image.uri} cacheKey={image.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
        ) : m.kind === "tekst" && m.text ? (
          // Een tekst toont zijn begin, zoals een tekstkaart in de feed.
          <Text numberOfLines={5} style={[serif(), { alignSelf: "stretch", paddingHorizontal: 14, fontSize: 15, lineHeight: 19, color: color("ink") }]}>
            {m.text}
          </Text>
        ) : m.kind === "link" && m.image ? (
          <SafeImage uri={m.image} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
        ) : (
          <Text style={[mono(500), { fontSize: 10, lineHeight: 13, textTransform: "uppercase", color: dim }]}>{c.kind}</Text>
        )}
      </View>
      <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: color("ink", "postRule") }}>
        <Text numberOfLines={1} style={[head(), { fontSize: 15, lineHeight: 15, color: color("ink") }]}>
          {c.title}
        </Text>
        <Text numberOfLines={1} style={[mono(500), { fontSize: 9, lineHeight: 12, textTransform: "uppercase", color: dim, marginTop: 3 }]}>
          {number ? `№ ${number} · ` : ""}
          {c.kind} · {timeLabel(c.createdAt, t, lang)}
        </Text>
      </View>
    </Pressable>
  );
}
