import { Ionicons } from "@expo/vector-icons";
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
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { feed, feed as feedColor, feedType, flameDeep } from "@/lib/design/type";
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

  // Log errors zodat we ze in de console kunnen zien tijdens debug
  if (events.isError) {
    // eslint-disable-next-line no-console
    console.error("[events.tsx] query failed:", events.error);
  }

  const data = events.data ?? [];
  const active = data.filter((e) => e.is_active);
  const upcoming = data.filter(
    (e) => !e.is_active && new Date(e.starts_at).getTime() > Date.now()
  );
  const past = data.filter(
    (e) => !e.is_active && new Date(e.ends_at).getTime() <= Date.now()
  );

  function renderBody() {
    // Error state — zichtbaar fout met retry
    if (events.isError) {
      const message = (events.error as Error | null)?.message ?? "Onbekende fout";
      return (
        <View className="bg-paper-soft p-6 mt-2">
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 bg-flame/20 items-center justify-center">
              <Ionicons name="alert-circle" color={flameDeep} size={18} />
            </View>
            <Text className="text-ink font-semibold ml-3">Kon events niet laden</Text>
          </View>
          <Text className="text-ink-soft text-sm leading-5 mb-3" selectable>
            {message}
          </Text>
          <Pressable
            onPress={() => events.refetch()}
            className="bg-ink active:bg-ink-soft py-2.5 items-center self-start px-5"
          >
            <Text className="text-cream font-semibold text-sm">Probeer opnieuw</Text>
          </Pressable>
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
        <View className="bg-paper-soft p-6 items-center mt-2">
          <View className="w-14 h-14 bg-flame items-center justify-center mb-3">
            <Ionicons name="sparkles" color={feed.text} size={24} />
          </View>
          <Text className="text-ink font-semibold text-base mb-1">
            Maak je eerste event
          </Text>
          <Text className="text-ink-soft text-sm text-center mb-4 leading-5">
            Een verjaardag, een trip, een diner — alle foto's van iedereen op één plek.
          </Text>
          <Pressable
            onPress={() => router.push("/event-create")}
            className="bg-ink active:bg-ink-soft px-5 py-3"
          >
            <Text className="text-cream font-semibold">Maak event</Text>
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
                  { fontSize: 13, fontWeight: "700", color: feedColor.text },
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 28 }}>
      <Text
        style={[
          feedType.kicker,
          { color: "#3A3540", letterSpacing: 0.55, marginBottom: 16 },
        ]}
      >
        {title.toUpperCase()}
      </Text>
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
