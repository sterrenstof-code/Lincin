import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useWide } from "@/components/Editorial";
import { eventStatusLabel, type EventWithMeta } from "@/lib/api/events";
import { useHeroTag, withHeroTransition } from "@/lib/hero-transition";
import { feed, FEED_BORDER, feedType, flame, flameDeep } from "@/lib/design/type";

/**
 * Een event als **cover-band**.
 *
 * Dit is dezelfde vorm als de cover-band in de feed (DESIGN.md §4,
 * "Layout, top to bottom", punt 3): tekstvlak links op `feed-post`, beeld
 * rechts, een kapitalenkop en een `(06)`-achtig indexcijfer in het rood.
 * Onder het breekpunt stapelt hij, tekst eerst.
 *
 * Waarom niet de oude kaart: die had een beeldstrook van 130px bovenaan,
 * een statusbadge, een voetbalk met een knop en drie icoonregels — vier
 * verschillende ritmes in één kaart. De cover-band zegt hetzelfde met de
 * opbouw die de rest van de app al gebruikt.
 *
 * `compact` laat het beeld weg; dat is de variant die tússen de vondsten in
 * de feed staat, waar een tweede grote afbeelding met de tegels zou vechten.
 */
export function EventCard({
  event,
  compact = false,
  /** Volgnummer in de uitgave. Puur redactioneel — geen ranking. */
  index,
}: {
  event: EventWithMeta;
  compact?: boolean;
  index?: number;
}) {
  const router = useRouter();
  const wide = useWide();
  const heroStyle = useHeroTag(`event-${event.id}`);
  const status = eventStatusLabel(event);
  const start = new Date(event.starts_at);

  const dateLabel = start.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = start.toLocaleTimeString("nl-BE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const showImage = !!event.cover_url && !compact;
  const twoColumn = wide && showImage;

  return (
    <Pressable
      // De cover van deze kaart en de hero van de eventpagina dragen dezelfde
      // `heroTag`; deze wikkel zegt de overgang dat het om een morph gaat.
      onPress={() =>
        withHeroTransition(() => router.push(`/event/${event.id}`))
      }
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        overflow: "hidden",
        flexDirection: twoColumn ? "row" : "column",
      }}
    >
      {/* ---- Tekstvlak ---- */}
      <View
        style={{
          backgroundColor: feed.post,
          padding: wide ? 30 : 22,
          justifyContent: "space-between",
          ...(twoColumn ? { flex: 1.1 } : null),
        }}
      >
        <View>
          {/* Kicker met de categoriestip. Vierkant, niet rond — de enige
              ronding in dit systeem is de avatar. */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
            <View
              style={{
                width: 6,
                height: 6,
                backgroundColor: event.is_active ? flame : feed.textDim,
                marginRight: 6,
              }}
            />
            <Text
              style={[feedType.kicker, { color: feed.text, letterSpacing: 0.5 }]}
              numberOfLines={1}
            >
              {event.is_active ? "EVENT · LIVE" : `EVENT · ${status.toUpperCase()}`}
            </Text>
          </View>

          <Text
            style={[wide ? feedType.cover : feedType.coverSmall, { color: feed.text }]}
            numberOfLines={3}
          >
            {event.name.toUpperCase()}
          </Text>

          {!compact && event.description ? (
            <Text
              style={[
                feedType.body,
                { fontSize: 13, lineHeight: 19, color: feed.textDim, marginTop: 12 },
              ]}
              numberOfLines={2}
            >
              {event.description}
            </Text>
          ) : null}
        </View>

        {/* Voet van het tekstvlak: de feiten links, het indexcijfer rechts. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: 20,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[feedType.label, { color: feed.text }]} numberOfLines={1}>
              {dateLabel}
            </Text>
            <Text style={[feedType.label, { color: feed.textDim, marginTop: 2 }]}>
              {`${timeLabel} · ${event.members_count} ${
                event.members_count === 1 ? "gast" : "gasten"
              } · ${event.contributions_count} foto's`}
            </Text>
            {event.is_host ? (
              <Text
                style={[feedType.kicker, { color: flame, letterSpacing: 0.55, marginTop: 8 }]}
              >
                {/* Openstaande verzoeken staan hier en niet in een apart
                    badge-bolletje: het is dezelfde regel die al zegt dat dit
                    jouw event is, en het is precies dáár dat je iets moet. */}
                {event.pending_requests_count > 0
                  ? `JIJ ORGANISEERT · ${event.pending_requests_count} VERZOEK${
                      event.pending_requests_count === 1 ? "" : "EN"
                    }`
                  : "JIJ ORGANISEERT"}
              </Text>
            ) : null}
            {event.join_policy === "closed" ? (
              <Text
                style={[feedType.kicker, { color: feed.textDim, letterSpacing: 0.55, marginTop: 6 }]}
              >
                GESLOTEN GROEP
              </Text>
            ) : null}
          </View>

          {typeof index === "number" ? (
            <Text
              style={[
                feedType.numeral,
                { fontSize: 24, lineHeight: 28, color: flame },
              ]}
            >
              {`(${String(index).padStart(2, "0")})`}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ---- Beeldvlak ---- */}
      {showImage ? (
        <View
          style={{
            backgroundColor: "#3A2A46",
            minHeight: 200,
            ...heroStyle,
            ...(twoColumn
              ? { flex: 1, borderLeftWidth: FEED_BORDER, borderLeftColor: feed.ink }
              : { borderTopWidth: FEED_BORDER, borderTopColor: feed.ink, aspectRatio: 16 / 9 }),
          }}
        >
          <Image
            source={{ uri: event.cover_url! }}
            style={{ width: "100%", height: "100%", minHeight: 200 }}
            contentFit="cover"
            transition={150}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * De rubriekregel boven een reeks events — hetzelfde etiket als
 * "MEER VONDSTEN DEZE WEEK" boven de compacte sectie in de feed.
 */
export function EventSectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={[
        feedType.kicker,
        { color: flameDeep, letterSpacing: 0.55, marginBottom: 18 },
      ]}
    >
      {children.toUpperCase()}
    </Text>
  );
}
