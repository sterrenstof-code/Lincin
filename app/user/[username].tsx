import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

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
import { color, friendColor, hueFor, useHueChoices, useScheme } from "@/lib/design/theme";
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

  const buttons = (() => {
    switch (relation.kind) {
      case "friend":
        return (
          <>
            <Btn label={`${t.privateChat} →`} fill flex={1} onPress={openChat} disabled={busy} />
            <Btn label={t.planTogether} flex={1} bg="transparent" fg={fc.ink} style={{ borderColor: fc.ink }} onPress={() => router.push("/event-create")} />
          </>
        );
      case "self":
        return <Btn label={t.you} fill flex={1} onPress={() => router.push("/profile")} />;
      case "outgoing":
        return (
          <Btn
            label="Verzoek intrekken"
            flex={1}
            disabled={busy}
            onPress={() => run(() => deleteFriendship(relation.friendshipId))}
          />
        );
      case "incoming":
        return (
          <>
            <Btn
              label="Accepteer"
              fill
              flex={1}
              disabled={busy}
              onPress={() => run(() => acceptFriendRequest(relation.friendshipId, myUserId, relation.requesterId))}
            />
            <Btn label="Weiger" flex={1} disabled={busy} onPress={() => run(() => deleteFriendship(relation.friendshipId))} />
          </>
        );
      case "stranger":
        return (
          <Btn
            label="Linc toevoegen"
            fill
            flex={1}
            disabled={busy || !p}
            onPress={() => run(() => sendFriendRequest(myUserId, p!.id))}
          />
        );
      default:
        return null;
    }
  })();

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
                {relation.kind === "friend" && relation.since ? (
                  <Mono variant="micro" color={fc.ink} style={{ opacity: 0.85, letterSpacing: 0 }}>
                    {t.lincSince} {shortDate(relation.since, lang)}
                  </Mono>
                ) : null}
                <Mono variant="micro" color={fc.ink} style={{ opacity: 0.85, letterSpacing: 0 }}>
                  {cards.length} {cards.length === 1 ? t.post1 : t.posts}
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
          <Mono variant="micro" tone="dim" style={{ marginTop: 6 }}>
            {t.allFrom} {name}
          </Mono>
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
