import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { EmptyState } from "@/components/EmptyState";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { useAuth } from "@/lib/auth/provider";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationWithDetails,
} from "@/lib/api/notifications";
import { usePageTitle } from "@/lib/page-title";
import { carbon, feed, FEED_BORDER, feedType, flame } from "@/lib/design/type";
import { NL } from "@/lib/locale";

export default function NotificationsScreen() {
  usePageTitle("Meldingen");
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["notifications", myUserId],
    queryFn: () => listNotifications(myUserId),
    refetchOnWindowFocus: true,
  });

  // Mark all as read when this screen is opened
  useEffect(() => {
    markAllNotificationsRead(myUserId)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["notifications-unread", myUserId] });
      })
      // Zonder dit was een mislukte update een onafgevangen rejection: het
      // bolletje in de tabstrip bleef staan en niets zei waarom. Er valt
      // hier niets te herstellen — de volgende opening probeert het opnieuw
      // — maar stil doorlopen is precies wat §4b verbiedt, dus staat het
      // tenminste in de console van wie het bugbord leest.
      .catch((e) => {
        console.warn("markAllNotificationsRead", e?.message ?? e);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId]);

  async function onRefresh() {
    await qc.invalidateQueries({ queryKey: ["notifications", myUserId] });
  }

  async function onPressNotification(item: NotificationWithDetails) {
    const to = destinationFor(item);
    if (!to) return;
    if (!item.read) {
      markNotificationRead(item.id);
    }
    router.push(to as never);
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        contentStyle={{ paddingVertical: 28, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={onRefresh}
            tintColor={feed.ink}
          />
        }
      >
        {/* De opbouw stond hier uitgeschreven en op twee andere tabs niet —
            zie components/PageHead.tsx. */}
        <PageHead
          kicker="Wat er speelt"
          title="Meldingen"
          intro="Nieuwe vondsten uit je kring, en elke beweging op een vondst waar jij iets mee gedaan hebt."
          wide={wide}
        />

        {/**
          * Stilte en leegte lezen niet hetzelfde — de uitleg waarom staat nu
          * in `components/QueryError.tsx`, want vier andere schermen hadden
          * dezelfde val en dit was het enige scherm met de oplossing.
          */}
        {isError ? (
          <QueryError
            title="Meldingen konden niet geladen worden"
            error={error}
            onRetry={() => refetch()}
          />
        ) : (data ?? []).length === 0 ? (
          isLoading ? null : (
            /* Vierde variant van dezelfde lege lijst — kader, vulling, eigen
               maatvoering. Staat nu in één onderdeel; zie
               components/EmptyState.tsx. Geen knop: er valt hier niets te
               doen dan wachten tot iemand iets doet. */
            <EmptyState
              title="Nog geen meldingen"
              body="Zodra iemand uit je kring iets deelt, of reageert op een vondst waar jij iets mee gedaan hebt, verschijnt het hier."
            />
          )
        ) : (
          /* Eén gekaderd blok met scheidingslijnen — geen zwevende kaartjes
             met tussenruimte. Zelfde vorm als de chatlijst. */
          <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>
            {(data ?? []).map((item, i) => (
              <NotificationRow
                key={item.id}
                item={item}
                isLast={i === (data ?? []).length - 1}
                onPress={() => onPressNotification(item)}
              />
            ))}
          </View>
        )}
      </PageScroll>
    </SafeAreaView>
  );
}

/**
 * Waar deze melding je heen brengt, of niets.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT NAAR DE KOLOMMEN KIJKT EN NIET NAAR HET SOORT
 * ---------------------------------------------------------------
 * Er zijn zeventien soorten melding en er waren drie bestemmingen. Vijf
 * soorten — `mention`, `invited_to_list`, `invited_to_call`, `vote_on_poll`
 * en `vote_on_call` — wezen nergens heen, want de rij draagt geen `list_id`
 * en geen `chat_id`. Ze kregen wél een chevron, en dat pijltje is in deze
 * app de belofte dat er iets achter zit. Je tikte, er gebeurde niets, en
 * dat leest als een kapotte app.
 *
 * Wat die vijf soorten echt nodig hebben is een kolom in de tabel, en dat
 * is een migratie. Tot die er is hoort het pijltje er niet te staan.
 *
 * Deze functie kijkt daarom naar de kolommen die er zijn en niet naar het
 * soort: een `mention` in een reactie ónder een vondst heeft wél een
 * `post_id` en gaat dus gewoon ergens heen. Een lijst met soorten zou dat
 * geval verkeerd afstraffen, en zou opnieuw fout staan zodra er een soort
 * bijkomt.
 */
function destinationFor(item: NotificationWithDetails): string | null {
  if (item.bug_report_id) return "/bugs";
  if (item.event_id) return `/event/${item.event_id}`;
  if (item.post_id) return `/post/${item.post_id}`;
  return null;
}

function NotificationRow({
  item,
  onPress,
  isLast = false,
}: {
  item: NotificationWithDetails;
  onPress: () => void;
  /** Laatste rij krijgt geen scheidingslijn — het kader sluit al af. */
  isLast?: boolean;
}) {
  // Geen bestemming: dan is dit een mededeling en geen ingang. Hij blijft
  // leesbaar — er stáát iets — maar hij doet niet alsof hij een knop is.
  const to = destinationFor(item);
  const actorName =
    item.actor?.display_name ?? item.actor?.username ?? "Iemand";

  const eventName = item.event_name ? `"${item.event_name}"` : "je event";

  // Waar de melding over gaat, in één woordgroep. De brontitel gaat voor
  // op de toelichting van de deler: bij een link of een boekfragment is
  // die herkenbaarder dan wat iemand er zelf bij typte.
  const subject = item.post_source_title
    ? `„${truncate(item.post_source_title, 32)}”`
    : "een vondst";

  const label =
    // Een afgehandelde bug heeft geen handelende persoon die je wil zien —
    // `actor_id` is de melder, en bij je eigen melding ben jij dat zelf.
    item.type === "bug_resolved"      ? "Je bugmelding is afgehandeld" :
    item.type === "friend_post"       ? `${actorName} deelde ${subject}` :
    item.type === "comment_on_post"   ? `${actorName} reageerde op jouw vondst` :
    item.type === "comment_on_thread" ? `${actorName} reageerde ook op ${subject}` :
    item.type === "post_reaction"     ? `${actorName} gaf ${item.detail ?? "een reactie"} aan jouw vondst` :
    item.type === "thread_reaction"   ? `${actorName} gaf ${item.detail ?? "een reactie"} aan ${subject}` :
    item.type === "thread_boost"      ? `${actorName} duwde ${subject} omhoog` :
    item.type === "vote_on_poll"      ? `${actorName} stemde op jouw stemming` :
    item.type === "vote_on_call"      ? `${actorName} koos een tijdslot voor jouw call` :
    item.type === "invited_to_list"   ? `${actorName} nodigde je uit voor een lijst` :
    item.type === "invited_to_call"   ? `${actorName} nodigde je uit voor een videocall` :
    item.type === "event_join"        ? `${actorName} nam deel aan ${eventName}` :
    item.type === "event_join_request" ? `${actorName} vraagt toegang tot ${eventName}` :
    item.type === "event_join_approved" ? `${actorName} liet je toe tot ${eventName}` :
    item.type === "event_contribution" ? `${actorName} plaatste iets in ${eventName}` :
    item.type === "mention"           ? `${actorName} noemde je` :
    item.type === "post_boost"        ? `${actorName} duwde jouw vondst omhoog` :
    item.type === "followed_post_comment" ? `${actorName} reageerde op een vondst die je volgt` :
    `${actorName} deed iets`;

  // Prefer the comment body as snippet (especially useful for emoji-only comments).
  // Fall back to post caption, then image indicator.
  const rawSnippet = item.comment_body ?? item.post_caption;
  const snippet = rawSnippet
    ? rawSnippet.length > 60
      ? rawSnippet.slice(0, 60) + "…"
      : rawSnippet
    : item.post_image_path
    ? "📷 foto"
    : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!to}
      accessibilityRole={to ? "button" : "text"}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: item.read ? feed.panel : feed.lav,
        // Geen aparte kleur maar minder dekking, net als een al gelezen
        // tegel in de feed: de regel blijft leesbaar, hij belooft alleen
        // niets meer.
        opacity: to ? 1 : 0.62,
        ...(isLast ? null : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }),
      }}
    >
      {/* Ongelezen-markering: vierkant, in het rood. */}
      <View style={{ width: 6, height: 6, backgroundColor: item.read ? "transparent" : flame }} />

      <Avatar
        name={item.actor?.display_name ?? item.actor?.username}
        avatarUrl={item.actor?.avatar_url ?? null}
        size="sm"
      />

      <View className="flex-1">
        <Text
          style={[
            feedType.body,
            { fontSize: 14, color: feed.ink, fontWeight: item.read ? "400" : "700" },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {snippet ? (
          <Text
            style={[feedType.label, { color: feed.inkDim, marginTop: 3 }]}
            numberOfLines={1}
          >
            {snippet}
          </Text>
        ) : null}
        <Text style={[feedType.kicker, { color: carbon.soft, letterSpacing: 0.5, marginTop: 4 }]}>
          {formatRelativeTime(item.created_at).toUpperCase()}
        </Text>
      </View>

      {/* De miniatuur komt nu mee uit de query — één ondertekening voor de
          hele lijst in plaats van veertig naast elkaar bij het openen van
          de tab. Zie lib/api/notifications.ts. */}
      {item.post_image_url ? (
        <Image
          source={{
            uri: item.post_image_url,
            // Op het pad en niet op de URL: een signed URL krijgt bij elke
            // aanroep een nieuw token, en dan haalt de cache dezelfde foto
            // toch opnieuw op. Zie lib/media.ts.
            cacheKey: item.post_image_path ?? undefined,
          }}
          cachePolicy="disk"
          // Alles in dit systeem is vierkant (§7); dit was de enige
          // afronding op het scherm.
          style={{ width: 40, height: 40 }}
          contentFit="cover"
        />
      ) : null}

      {/* Alleen waar er ook echt iets achter zit — zie destinationFor. */}
      {to ? <Ionicons name="chevron-forward" color={feed.inkDim} size={14} /> : null}
    </Pressable>
  );
}

/** Kort in op een woordgrens — een half woord leest slordig. */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "…";
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(NL, { day: "numeric", month: "short" });
}
