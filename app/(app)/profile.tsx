import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { LincinScreen, useUnread } from "@/components/lincin/Chrome";
import { BORDER, Box, GUTTER, Head, Initial, Mono, Serif, VerticalLabel, line } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import { listMyFriendships } from "@/lib/api/friends";
import { listUserPosts, type PostWithAuthor } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useScheme } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { displayName, fromPost } from "@/lib/lincin/model";
import { DesktopYou } from "@/components/lincin/desktop/DesktopYou";
import { openPost, useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";

/**
 * Jij (README §07).
 *
 * Je naam in serif op twee regels (de achternaam cursief, gedempt) naast
 * je avatar; drie cijfers in één kader; je laatste bijdragen als smalle
 * posters met een gedraaide titel; en de lijst: Instellingen, Meldingen,
 * Lincs & uitnodigingen, Mijn QR-code.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export default function YouScreen() {
  usePageTitle("Jij");
  const desktop = useIsDesktop();
  if (desktop) return <DesktopYou />;
  return <YouMobile />;
}

function YouMobile() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const unread = useUnread();

  const profile = useQuery({ queryKey: ["profile", myUserId], queryFn: () => getProfile(myUserId) });
  const posts = useQuery({ queryKey: ["posts-by-user", myUserId], queryFn: () => listUserPosts(myUserId, 60) });
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });

  const p = profile.data;
  const name = displayName(p ?? { username: session!.user.email ?? "" });
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ");
  const fc = friendColor(hueFor(myUserId), scheme);
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;
  const pendingIn = (friendships.data ?? []).filter((f) => f.status === "pending" && f.addressee_id === myUserId).length;
  const since = new Date(session!.user.created_at);
  const yy = `'${String(since.getFullYear()).slice(2)}`;
  const mon = since.toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "");

  return (
    <LincinScreen tab="you" counter={t.tabYou}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Serif variant="ownName" numberOfLines={1}>
              {first}
            </Serif>
            {last ? (
              <Serif variant="ownNameItalic" tone="dim" numberOfLines={1}>
                {last}
              </Serif>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Profiel bewerken" onPress={() => router.push("/profile-edit")}>
            {p?.avatar_url ? (
              <View style={{ width: 72, height: 72, borderRadius: 36, overflow: "hidden", borderWidth: BORDER, borderColor: line() }}>
                <SafeImage uri={p.avatar_url} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </View>
            ) : (
              <Initial letter={name.slice(0, 1).toUpperCase()} size={72} bg={fc.fill} fg={fc.ink} fontSize={34} />
            )}
          </Pressable>
        </View>

        <Box style={{ flexDirection: "row", marginTop: 16 }}>
          <Stat n={String(posts.data?.length ?? 0)} label={t.posts} />
          <Stat n={String(lincs)} label="lincs" />
          <Stat n={yy} label={`${t.sinceMar} ${mon}`} last />
        </Box>

        <Mono variant="micro" tone="dim" style={{ marginTop: 18, marginBottom: 8 }}>
          {t.yourLatest}
        </Mono>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -GUTTER }}
          contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 10 }}
        >
          {(posts.data ?? []).slice(0, 8).map((post) => (
            <Mini key={post.id} post={post} fill={fc.fill} ink={fc.ink} onPress={() => openPost(post.id)} />
          ))}
          {posts.data && posts.data.length === 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/post-compose")}
              style={{ width: 150, height: 190, borderWidth: BORDER, borderStyle: "dashed", borderColor: line(), alignItems: "center", justifyContent: "center", padding: 12 }}
            >
              <Serif variant="aside" tone="dim" style={{ textAlign: "center" }}>
                {t.emptyCompose}
              </Serif>
            </Pressable>
          ) : null}
        </ScrollView>

        <Box style={{ marginTop: 18 }}>
          <Row label={t.settings} right="→" onPress={() => router.push("/settings" as never)} />
          <Row
            label={t.notifications}
            right={unread.notifications > 0 ? `${unread.notifications} ${t.new} →` : "→"}
            red={unread.notifications > 0}
            onPress={() => router.push("/notifications")}
          />
          <Row
            label={t.lincsInvites}
            right={pendingIn > 0 ? `${pendingIn} ${t.waitsForYou} →` : `${lincs} →`}
            red={pendingIn > 0}
            onPress={() => router.push("/friends")}
          />
          <Row label={t.myQr} right="→" onPress={() => router.push("/qr-code")} last />
        </Box>
      </ScrollView>
    </LincinScreen>
  );
}

function Stat({ n, label, last = false }: { n: string; label: string; last?: boolean }) {
  return (
    <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRightWidth: last ? 0 : BORDER, borderRightColor: line() }}>
      <Head variant="numeralSmall">{n}</Head>
      <Mono variant="micro" tone="dim">
        {label}
      </Mono>
    </View>
  );
}

function Mini({ post, fill, ink, onPress }: { post: PostWithAuthor; fill: string; ink: string; onPress: () => void }) {
  const card = fromPost(post);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={card.title} onPress={onPress} style={{ width: 150, height: 190, borderWidth: BORDER, borderColor: line(), flexDirection: "row" }}>
      <View style={{ width: 44, backgroundColor: fill, borderRightWidth: BORDER, borderRightColor: line(), overflow: "hidden" }}>
        <VerticalLabel text={card.title} width={44} height={187} color={ink} style={{ fontFamily: lincinType.numeralTiny.fontFamily, fontSize: 20, lineHeight: 14, textTransform: "uppercase" }} />
      </View>
      <View style={{ flex: 1, backgroundColor: color("paper2") }}>
        {post.image_url ? (
          <SafeImage uri={post.image_url} cacheKey={post.image_path ?? undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : card.media.kind === "tekst" && card.media.text ? (
          // Een tekstbijdrage toont de tekst zelf, niet het woord "tekst".
          <View style={{ flex: 1, padding: 10, justifyContent: "center" }}>
            <Serif variant="caption" numberOfLines={7} style={{ fontSize: 14, lineHeight: 17 }}>
              {card.media.text}
            </Serif>
          </View>
        ) : card.media.kind === "muziek" || card.media.kind === "link" ? (
          <View style={{ flex: 1, padding: 10, justifyContent: "flex-end", gap: 4 }}>
            <Serif variant="caption" numberOfLines={3} style={{ fontSize: 14, lineHeight: 17 }}>
              {card.media.kind === "muziek" ? card.media.track : card.media.title}
            </Serif>
            <Mono variant="tiny" tone="dim">
              {card.media.kind === "muziek" ? card.media.artist : card.media.site}
            </Mono>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 8 }}>
            <Mono variant="tiny" tone="dim">
              {card.kind}
            </Mono>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Row({ label, right, red = false, onPress, last = false }: { label: string; right: string; red?: boolean; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: last ? 0 : BORDER,
        borderBottomColor: line(),
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Serif variant="row">{label}</Serif>
      <Mono variant="meta" tone={red ? "red" : "ink"} style={{ textTransform: "none" }}>
        {right}
      </Mono>
    </Pressable>
  );
}
