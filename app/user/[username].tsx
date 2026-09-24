import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen, TopRow, vfade } from "@/components/lincin/Chrome";
import { PostCard } from "@/components/lincin/PostCard";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
import { HuePicker } from "@/components/lincin/HuePicker";
import { Box, Btn, GAP, GUTTER, Head, Initial, Mono, Serif } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import { getOrCreateDirectChat } from "@/lib/api/chats";
import {
  acceptFriendRequest,
  deleteFriendship,
  listMyFriendships,
  sendFriendRequest,
} from "@/lib/api/friends";
import { listUserPosts } from "@/lib/api/posts";
import { getProfileByUsername } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { Label as OLabel, Ser } from "@/components/lincin/magazine/Omslag";
import { useLang, useT } from "@/lib/i18n";
import { displayName, fromPost, shortDate, type CardPost } from "@/lib/lincin/model";
import { usePostReactions } from "@/lib/lincin/reactions";
import { DesktopProfile } from "@/components/lincin/desktop/DesktopProfile";
import { openPost as openPostAnywhere, openThread, useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

/**
 * Het profiel van een vriend (README §03).
 *
 * Een kaart in zijn kleur: avatar, "linc sinds … / n bijdragen", de naam
 * groot, de bio cursief, en twee knoppen. Daaronder alles wat hij maakte
 * als kaarten op de volle breedte. Het blad kleurt mee.
 *
 * Wie nog geen linc is ziet dezelfde kaart met een verzoekknop in plaats
 * van het gesprek; je eigen profiel wijst naar "Jij".
 */

type Relation =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "self" }
  | { kind: "friend"; friendshipId: string; since: string | null }
  | { kind: "outgoing"; friendshipId: string }
  | { kind: "incoming"; friendshipId: string; requesterId: string }
  | { kind: "stranger" };

/** Op desktop hetzelfde scherm in zijn desktopvorm (`DesktopProfile`); daaronder de telefoon, onveranderd. */
export default function UserProfileRoute(props: { username?: string; embedded?: boolean } = {}) {
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  const desktop = useIsDesktop();
  if (desktop && !props.embedded) return <DesktopProfile username={(props.username ?? raw ?? "").toString().trim().toLowerCase()} />;
  return <UserProfileScreen {...props} />;
}

export function UserProfileScreen({ username: usernameProp, embedded = false }: { username?: string; embedded?: boolean } = {}) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const { username: raw } = useLocalSearchParams<{ username: string }>();
  // Ingebed komt de handle als prop; als scherm uit de route.
  const username = (usernameProp ?? raw ?? "").toString().trim().toLowerCase();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);

  const profile = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: () => getProfileByUsername(username),
    enabled: !!username,
  });
  usePageTitle(profile.data ? displayName(profile.data) : null);

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
    enabled: !!myUserId,
  });

  const posts = useQuery({
    queryKey: ["posts-by-user", profile.data?.id],
    queryFn: () => listUserPosts(profile.data!.id, 60),
    enabled: !!profile.data,
  });

  const relation: Relation = useMemo(() => {
    if (profile.isLoading) return { kind: "loading" };
    if (!profile.data) return { kind: "not-found" };
    if (profile.data.id === myUserId) return { kind: "self" };
    const f = (friendships.data ?? []).find((x) => x.other.id === profile.data!.id);
    if (f?.status === "accepted") return { kind: "friend", friendshipId: f.id, since: f.accepted_at };
    if (f?.status === "pending" && f.requester_id === myUserId) return { kind: "outgoing", friendshipId: f.id };
    if (f?.status === "pending") return { kind: "incoming", friendshipId: f.id, requesterId: f.requester_id };
    return { kind: "stranger" };
  }, [profile.isLoading, profile.data, friendships.data, myUserId]);

  const cards = useMemo<CardPost[]>(() => (posts.data ?? []).map(fromPost), [posts.data]);
  const postIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const reactions = usePostReactions(postIds, myUserId);

  const p = profile.data;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const hue = hueFor(p?.id);
  const fc = friendColor(hue, scheme);
  const name = p ? displayName(p) : username;
  const initial = name.slice(0, 1).toUpperCase();
  const mag = useThemeSpec().id === "magazine";

  async function run(fn: () => Promise<void>) {
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

  async function openChat() {
    if (!p) return;
    setBusy(true);
    try {
      const chatId = await getOrCreateDirectChat(p.id);
      openThread(chatId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  /** De handelingen op deze kaart; `primary` is het gevulde vlak. */
  type Act = { label: string; onPress: () => void; primary?: boolean; busy?: boolean };
  const acts: Act[] = (() => {
    switch (relation.kind) {
      case "friend":
        return [
          { label: `${t.privateChat} →`, onPress: openChat, primary: true, busy: true },
          { label: t.planTogether, onPress: () => router.push("/event-create") },
        ];
      case "self":
        return [{ label: t.you, onPress: () => router.push("/profile"), primary: true }];
      case "outgoing":
        return [{ label: "Verzoek intrekken", onPress: () => run(() => deleteFriendship(relation.friendshipId)), busy: true }];
      case "incoming":
        return [
          { label: "Accepteer", onPress: () => run(() => acceptFriendRequest(relation.friendshipId, myUserId, relation.requesterId)), primary: true, busy: true },
          { label: "Weiger", onPress: () => run(() => deleteFriendship(relation.friendshipId)), busy: true },
        ];
      case "stranger":
        return [{ label: "Linc toevoegen", onPress: () => run(() => sendFriendRequest(myUserId, p!.id)), primary: true, busy: true }];
      default:
        return [];
    }
  })();
  const buttons = acts.map((a) =>
    a.primary ? (
      <Btn key={a.label} label={a.label} fill flex={1} onPress={a.onPress} disabled={(a.busy && busy) || !p} />
    ) : (
      <Btn key={a.label} label={a.label} flex={1} bg="transparent" fg={fc.ink} style={{ borderColor: fc.ink }} onPress={a.onPress} disabled={a.busy && busy} />
    ),
  );
  const since = relation.kind === "friend" && relation.since ? `${t.lincSince} ${shortDate(relation.since, lang)}` : null;
  const count = `${cards.length} ${cards.length === 1 ? t.post1 : t.posts}`;

  /**
   * Magazine (de omslag, mobile-app.dc.html VRIEND): een lijn, de rug van 5
   * in zijn kleur, de initiaal rood in Archivo 900 van 72 met de rest van de
   * naam in serif, de bio cursief, en de handelingen als kaders in serif.
   */
  const magHead = (
    <View style={{ marginHorizontal: -GUTTER, borderTopWidth: 1, borderTopColor: color("ink", "postRule") }}>
      <View style={{ height: 1.5, backgroundColor: color("ink") }} />
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 5, backgroundColor: fc.fill }} />
        <View style={{ flex: 1, minWidth: 0, paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 19, gap: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <OLabel size={8.5} weight={500} ls={0.2} color={color("ink", "inkDim")}>
              {t.scrProfile}
            </OLabel>
            <OLabel size={8.5} weight={500} ls={0.2} color={color("ink", "inkDim")}>
              {since ? `${since} · ` : ""}
              {count}
            </OLabel>
          </View>
          <Text numberOfLines={2}>
            <Text style={[sans(900), { fontSize: 72, lineHeight: 72, letterSpacing: -3.6, color: color("red") }]}>{initial}</Text>
            <Text style={[serif(), { fontSize: 40, letterSpacing: -0.6, color: color("ink") }]}>{name.slice(1)}</Text>
          </Text>
          {p?.bio ? (
            <Ser size={19} italic f={1.35} color={color("inkSoft")} numberOfLines={4}>
              {p.bio}
            </Ser>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 2 }}>
            {acts.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                onPress={a.onPress}
                disabled={a.busy && busy}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: color("ink", a.primary ? "postDim" : "postRule"),
                  backgroundColor: a.primary ? color("paper2") : "transparent",
                  opacity: a.busy && busy ? 0.6 : 1,
                }}
              >
                <Ser size={16} color={a.primary ? color("ink") : color("ink", "inkDim")}>
                  {a.label}
                </Ser>
              </Pressable>
            ))}
          </View>
          {p && relation.kind !== "self" ? <HuePicker personId={p.id} ink={color("ink")} /> : null}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: color("ink") }} />
    </View>
  );

  return (
    <LincinScreen
      tab="feed"
      tint={p ? fc.fill : null}
      counter={t.scrProfile}
      embedded={embedded}
      back="/feed"
      header={
        <TopRow
          right={
            <Mono variant="micro" tone="dim">
              {t.scrProfile}
            </Mono>
          }
        />
      }
    >
      <ScrollView style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, gap: GAP }}>
        {relation.kind === "not-found" ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
            {t.failed}
          </Mono>
        ) : mag ? (
          magHead
        ) : (
          <Box fill="none" style={{ backgroundColor: fc.fill, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              {p?.avatar_url ? (
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    overflow: "hidden",
                    backgroundColor: color("paper"),
                  }}
                >
                  <SafeImage uri={p.avatar_url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                </View>
              ) : (
                <Initial letter={initial} size={56} bg={color("paper")} fg={color("ink")} fontSize={28} border={false} style={{ borderRadius: 28 }} />
              )}
              <View style={{ alignItems: "flex-end" }}>
                {since ? (
                  <Mono variant="micro" color={fc.ink} style={{ opacity: 0.85, letterSpacing: 0 }}>
                    {since}
                  </Mono>
                ) : null}
                <Mono variant="micro" color={fc.ink} style={{ opacity: 0.85, letterSpacing: 0 }}>
                  {count}
                </Mono>
              </View>
            </View>
            <Head variant="profileName" color={fc.ink} numberOfLines={2}>
              {name}
            </Head>
            {p?.bio ? (
              <Serif variant="aside" color={fc.ink} numberOfLines={4}>
                {p.bio}
              </Serif>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>{buttons}</View>
            {p && relation.kind !== "self" ? (
              <View style={{ marginTop: 4 }}>
                <HuePicker personId={p.id} ink={fc.ink} />
              </View>
            ) : null}
          </Box>
        )}

        {cards.length > 0 ? (
          mag ? (
            <View style={{ marginTop: 26, paddingBottom: 7, borderBottomWidth: 2, borderBottomColor: color("ink") }}>
              <OLabel size={11}>
                {t.allFrom} {name}
              </OLabel>
            </View>
          ) : (
            <Mono variant="micro" tone="dim" style={{ marginTop: 6 }}>
              {t.allFrom} {name}
            </Mono>
          )
        ) : null}
        {cards.map((c) => (
          <PostCard
            key={c.id}
            post={c}
            bleed
            hue={hue}
            myUserId={myUserId}
            reactions={reactions.grouped(c.id)}
            onReact={(emoji) => reactions.toggle(c.id, emoji)}
            onOpen={() => {
              markSeen(c.id);
              openPostAnywhere(c.id);
            }}
            onPrivate={() =>
              setSheet({
                friendId: c.authorId,
                friendName: name,
                quote: c.caption || c.title,
                postId: c.id,
                postTitle: c.title,
              })
            }
            onProfile={() => {}}
          />
        ))}
        {posts.isLoading ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 20 }}>
            {t.loading}
          </Mono>
        ) : null}
      </ScrollView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}
