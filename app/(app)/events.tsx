import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EventCard } from "@/components/EventCard";
import { SectionMark } from "@/components/IndexGrid";
import { QueryError } from "@/components/QueryError";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import {
  announce,
  announceDeep,
  CONTROL_H,
  creamOnDark,
  feed as feedColor,
  FEED_BORDER,
  feedType,
  flameDeep,
  space,
} from "@/lib/design/type";
import { useWide } from "@/components/Editorial";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { listMyEvents } from "@/lib/api/events";

export default function EventsScreen() {
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const events = useQuery({
    queryKey: ["events", myUserId],
    queryFn: () => listMyEvents(myUserId),
    // Keep "Live"/"Komt eraan" buckets and counts fresh without a manual pull.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const data = events.data ?? [];
  const active = data.filter((e) => e.is_active);
  const upcoming = data.filter(
    (e) => !e.is_active && new Date(e.starts_at).getTime() > Date.now()
  );
  const past = data.filter(
    (e) => !e.is_active && new Date(e.ends_at).getTime() <= Date.now()
  );

  function renderBody() {
    // Stond hier als eigen blok, met een eigen vorm en een eigen tekst.
    // Vier schermen hadden er een en ze zagen er alle vier anders uit.
    if (events.isError) {
      return (
        <View style={{ marginTop: space.sm }}>
          <QueryError
            title="Events konden niet geladen worden"
            error={events.error}
            onRetry={() => events.refetch()}
          />
        </View>
      );
    }

    // Loading state — slechts één compacte placeholder
    if (events.isLoading && !events.data) {
      return <SkeletonEventCard />;
    }

    // Empty state
    if (data.length === 0) {
      return (
        <View
          style={{
            marginTop: space.sm,
            borderWidth: FEED_BORDER,
            borderColor: feedColor.ink,
            padding: space.xxxl,
          }}
        >
          <Text
            style={[feedType.tile, { fontSize: 20, color: feedColor.ink, marginBottom: space.sm }]}
          >
            Maak je eerste event
          </Text>
          <Text
            style={[feedType.body, { color: feedColor.inkDim, maxWidth: 440, marginBottom: space.xl }]}
          >
            Een verjaardag, een trip, een diner — alle foto&apos;s van iedereen op
            één plek.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Maak event"
            onPress={() => router.push("/event-create")}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              height: CONTROL_H,
              paddingHorizontal: space.xl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? announceDeep : announce,
            })}
          >
            <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
              Maak event
            </Text>
          </Pressable>
        </View>
      );
    }

    // Data state — secties tonen. De nummering loopt dóór over de secties
    // heen, zoals de paginering van een uitgave; hij zegt niets over rang.
    let n = 0;
    return (
      <>
        {active.length > 0 && (
          <Section title="Nu live">
            {active.map((e) => (
              <EventCard key={e.id} event={e} index={++n} />
            ))}
          </Section>
        )}
        {upcoming.length > 0 && (
          <Section title="Komt eraan">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} index={++n} />
            ))}
          </Section>
        )}
        {past.length > 0 && (
          <Section title="Afgelopen">
            {past.map((e) => (
              <EventCard key={e.id} event={e} index={++n} />
            ))}
          </Section>
        )}
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* Eén scroller voor de hele pagina; de kop plakt bovenaan.
          Geen ScreenContainer meer: dit ontwerp gebruikt de volle
          breedte tot PAGE_MAX. */}
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        refreshControl={
          <RefreshControl
            refreshing={events.isFetching && !events.isLoading}
            onRefresh={() =>
              qc.invalidateQueries({ queryKey: ["events", myUserId] })
            }
            tintColor={feedColor.ink}
          />
        }
      >
        <View style={{ paddingVertical: 28, paddingBottom: 80 }}>
          {/* Paginakop: kicker, kop, ondertitel — dezelfde opbouw als de
              hero van een vondst, één maat kleiner. */}
          <Text
            style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 10 }]}
          >
            SAMEN VASTGELEGD
          </Text>
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              justifyContent: "space-between",
              alignItems: wide ? "flex-end" : "flex-start",
              marginBottom: 10,
            }}
          >
            <Text
              style={[
                wide ? feedType.hero : feedType.heroSmall,
                { color: feedColor.ink, maxWidth: 620 },
              ]}
            >
              Events
            </Text>
            <Pressable
              onPress={() => router.push("/event-create")}
              style={({ pressed }) => ({
                backgroundColor: pressed ? flameDeep : feedColor.ink,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginTop: wide ? 0 : 16,
              })}
            >
              <Text
                style={[
                  feedType.label,
                  { fontSize: 13, fontWeight: "700", color: creamOnDark.DEFAULT },
                ]}
              >
                Nieuw event
              </Text>
            </Pressable>
          </View>
          <Text
            style={[feedType.body, { color: feedColor.inkDim, maxWidth: 560, marginBottom: 34 }]}
          >
            Maak momenten samen. Foto's worden onthuld op het juiste moment.
          </Text>
          {renderBody()}
        </View>
      </PageScroll>
    </SafeAreaView>
  );
}

/**
 * Een rubriek in de agenda.
 *
 * Gebruikt `SectionMark` uit de rasterlaag: schijf, woord, zware lijn. Dit
 * scherm is de directe tegenhanger van waar dat patroon vandaan komt — een
 * agenda met een lopende en een afgesloten afdeling — en het was hier een
 * los kickertje van 10 punten dat je makkelijk oversloeg. Drie rubrieken op
 * een pagina is precies waar deze kop voor bedoeld is; meer zou schreeuwen.
 *
 * Het teken in de schijf is de eerste letter van de rubriek. Geen icoon:
 * een letter zegt wélke rubriek, een pictogram alleen dát het er een is.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      <SectionMark glyph={title.charAt(0).toUpperCase()} label={title} />
      <View style={{ gap: 16 }}>{children}</View>
    </View>
  );
}

/** Compacte event-skeleton (geen vierkante image-area — past bij EventCard). */
function SkeletonEventCard() {
  return (
    <View className="bg-paper-soft p-6 mt-2">
      <View className="flex-row items-center mb-3">
        <Skeleton className="w-9 h-9 bg-paper-warm" />
        <View className="flex-1 ml-3">
          <Skeleton className="w-24 h-3 bg-paper-warm" />
        </View>
      </View>
      <Skeleton className="w-3/4 h-6 bg-paper-warm" />
      <View className="h-2" />
      <Skeleton className="w-1/2 h-3 bg-paper-warm" />
    </View>
  );
}
