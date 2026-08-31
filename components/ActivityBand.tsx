import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import {
  listNotifications,
  markNotificationRead,
  type NotificationWithDetails,
} from "@/lib/api/notifications";
import type { FeedItem } from "@/lib/api/posts";
import type { Profile } from "@/lib/api/profiles";
import { announce, feed, FEED_BORDER, feedType, rule, space } from "@/lib/design/type";
import { NL } from "@/lib/locale";

/**
 * Wat er sinds je laatste bezoek over jóu gebeurd is, bovenaan de feed.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT HIER STAAT EN NIET ALLEEN OP /notifications
 * ---------------------------------------------------------------
 * Meldingen zaten opgevouwen achter je avatar, met een stipje als er iets
 * lag. Dat stipje vertelt je dát er iets is en verder niets, en dus moest
 * je een pagina verder om te zien of het de moeite was. In de praktijk
 * betekent dat: je kijkt niet, en een reactie op je vondst blijft twee
 * dagen liggen.
 *
 * Deze band zet het op de pagina waar je toch al bent. Hij is bewust
 * gedimd — vier regels, geen vlak, geen kleur behalve het merkteken links
 * bij wat je nog niet gezien hebt. De vondsten eronder blijven het
 * onderwerp van de pagina; dit is de rand van de krant waar staat wie er
 * iets van jou vond.
 *
 * Hij is er niet als er niets is. Een lege band die "geen meldingen" zegt
 * is een regel die elke dag om aandacht vraagt om te melden dat er niets
 * te melden valt.
 */

/** Hoeveel regels er hoogstens staan. Meer dan dit is een pagina, geen band. */
const MAX_ROWS = 4;

/** Hoeveel gezichten er hoogstens in de rij "deelde iets" passen. */
const MAX_FACES = 6;

export function ActivityBand({
  myUserId,
  items,
}: {
  myUserId: string;
  /** De feed zelf — hieruit komt wie er onlangs iets deelde. */
  items: FeedItem[] | undefined;
}) {
  const router = useRouter();

  const notifications = useQuery({
    queryKey: ["notifications", myUserId],
    queryFn: () => listNotifications(myUserId, 12),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const rows = (notifications.data ?? []).slice(0, MAX_ROWS);
  const sharers = recentSharers(items, myUserId);

  if (rows.length === 0 && sharers.length === 0) return null;

  async function open(item: NotificationWithDetails) {
    if (!item.read) markNotificationRead(item.id).catch(() => {});
    if (item.event_id) router.push(`/event/${item.event_id}`);
    else if (item.post_id) router.push(`/post/${item.post_id}`);
    else router.push("/notifications");
  }

  return (
    <View
      style={{
        marginBottom: space.section,
        borderWidth: FEED_BORDER,
        // Dezelfde zachte lijn als de rubrieken eronder: dit blok mag niet
        // harder staan dan de uitgave zelf.
        borderColor: rule.soft,
      }}
    >
      {/* De kop. Geen nummer, want dit is geen rubriek van de uitgave —
          het gaat over jou, en dat staat buiten de inhoudsopgave. */}
      <Pressable
        onPress={() => router.push("/notifications")}
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          borderBottomWidth: FEED_BORDER,
          borderBottomColor: feed.ink,
        }}
      >
        <Text
          style={[
            feedType.label,
            { fontSize: 13, fontWeight: "800", letterSpacing: 0.6, color: feed.ink, flex: 1 },
          ]}
          numberOfLines={1}
        >
          VOOR JOU
        </Text>
        <Text style={[feedType.label, { fontSize: 12, color: feed.inkDim }]}>
          Alles bekijken →
        </Text>
      </Pressable>

      {sharers.length > 0 ? <SharersRow sharers={sharers} /> : null}

      {rows.map((item, i) => (
        <NotificationLine
          key={item.id}
          item={item}
          onPress={() => open(item)}
          isLast={i === rows.length - 1}
        />
      ))}
    </View>
  );
}

/**
 * Wie er onlangs iets deelde, als rij gezichten.
 *
 * Dit is de enige regel hier die niet uit je meldingen komt: dat je vriend
 * iets gedeeld heeft is geen melding — het staat gewoon in de feed — maar
 * je ziet in één oogopslag wíe er deze week iets liet zien, en dat is
 * precies wat je van een klein netwerk wil weten.
 */
function SharersRow({ sharers }: { sharers: Profile[] }) {
  const shown = sharers.slice(0, MAX_FACES);
  const names = shown
    .slice(0, 2)
    .map((p) => p.display_name ?? p.username ?? "iemand")
    .join(", ");
  const rest = sharers.length - Math.min(2, shown.length);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: rule.soft,
      }}
    >
      {/* De gezichten overlappen: het is één groep, geen lijst.
          Elk krijgt een ring in de kleur van het blad, anders snijden een
          foto en een letter in elkaar en wordt de rij een vlek in plaats
          van een stapel. De ring is precies daarom géén lijn uit het
          raster: hij hoort bij de cirkel, en de cirkel is in dit ontwerp
          het enige dat érop ligt in plaats van erin (DESIGN.md §4). */}
      <View style={{ flexDirection: "row" }}>
        {shown.map((p, i) => (
          <View
            key={p.id}
            style={{
              marginLeft: i === 0 ? 0 : -10,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: feed.lav,
              backgroundColor: feed.lav,
            }}
          >
            <Avatar name={p.display_name ?? p.username ?? "?"} avatarUrl={p.avatar_url} size="xs" />
          </View>
        ))}
      </View>
      <Text style={[feedType.label, { color: feed.inkDim, flex: 1 }]} numberOfLines={1}>
        {rest > 0 ? `${names} en ${rest} ander${rest === 1 ? "" : "en"} deelden iets` : `${names} deelde iets`}
      </Text>
    </View>
  );
}

function NotificationLine({
  item,
  onPress,
  isLast,
}: {
  item: NotificationWithDetails;
  onPress: () => void;
  isLast: boolean;
}) {
  const actor = item.actor?.display_name ?? item.actor?.username ?? "Iemand";
  const snippet = snippetFor(item);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        ...(isLast
          ? null
          : { borderBottomWidth: FEED_BORDER, borderBottomColor: rule.soft }),
      }}
    >
      {/* Het merkteken voor wat je nog niet gezien hebt. Een streep en geen
          stip: hij hoort bij de regel ernaast, niet bij de tekst erin. */}
      <View
        style={{
          width: 3,
          alignSelf: "stretch",
          backgroundColor: item.read ? "transparent" : announce,
        }}
      />
      <Avatar
        name={actor}
        avatarUrl={item.actor?.avatar_url ?? null}
        size="sm"
      />
      {/* De regel eindigt waar de zin eindigt.
          De tijd stond rechts uitgelijnd en de pijl daarnaast, en op een
          breed scherm gaapt daar duizend pixels niets tussen: dan leest de
          band als een tabel in plaats van als een kolom kort nieuws. De
          tijd hoort bij de zin, dus staat hij erachter. De pijl is weg —
          de hele regel is aanklikbaar, en een pijl op élke regel zegt dat
          twaalf keer. */}
      <View style={{ flex: 1 }}>
        <Text style={[feedType.label, { fontSize: 12, color: feed.ink }]} numberOfLines={1}>
          {labelFor(item, actor)}
          <Text style={{ color: feed.inkDim }}>{`  ${relativeTime(item.created_at)}`}</Text>
        </Text>
        {snippet ? (
          <Text
            style={[feedType.body, { fontSize: 12, color: feed.inkDim, marginTop: 2 }]}
            numberOfLines={1}
          >
            {snippet}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// Tekst
// ---------------------------------------------------------------

function labelFor(item: NotificationWithDetails, actor: string): string {
  const event = item.event_name ? `"${item.event_name}"` : "je event";
  switch (item.type) {
    case "comment_on_post": return `${actor} reageerde op jouw vondst`;
    case "comment_on_thread": return `${actor} reageerde ook`;
    case "followed_post_comment": return `${actor} reageerde op een vondst die je volgt`;
    case "mention": return `${actor} noemde je`;
    case "post_boost": return `${actor} duwde jouw vondst omhoog`;
    case "vote_on_poll": return `${actor} stemde op jouw stemming`;
    case "vote_on_call": return `${actor} koos een tijdslot`;
    case "invited_to_list": return `${actor} nodigde je uit voor een lijst`;
    case "invited_to_call": return `${actor} nodigde je uit voor een videocall`;
    case "event_join": return `${actor} nam deel aan ${event}`;
    case "event_join_request": return `${actor} vraagt toegang tot ${event}`;
    case "event_join_approved": return `${actor} liet je toe tot ${event}`;
    case "event_contribution": return `${actor} plaatste iets in ${event}`;
    default: return `${actor} deed iets`;
  }
}

function snippetFor(item: NotificationWithDetails): string | null {
  const raw = item.comment_body ?? item.post_caption;
  if (raw) return raw.length > 70 ? `${raw.slice(0, 70)}…` : raw;
  return item.post_image_path ? "Beeld" : null;
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(NL, { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------
// Wie er onlangs deelde
// ---------------------------------------------------------------

/**
 * De makers van de laatste vondsten, ontdubbeld en zonder jezelf.
 *
 * Uit dezelfde lijst waar de feed zelf op staat, dus dit kost geen extra
 * verzoek.
 */
function recentSharers(items: FeedItem[] | undefined, myUserId: string): Profile[] {
  if (!items?.length) return [];
  const out: Profile[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.type !== "post" && item.type !== "memory") continue;
    const author = item.data.author;
    if (!author || author.id === myUserId || seen.has(author.id)) continue;
    seen.add(author.id);
    out.push(author);
    if (out.length >= MAX_FACES + 4) break;
  }
  return out;
}
