import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EventCard } from "@/components/EventCard";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { listMyEvents } from "@/lib/api/events";

export default function EventsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const events = useQuery({
    queryKey: ["events", myUserId],
    queryFn: () => listMyEvents(myUserId),
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
        <View className="bg-paper-soft rounded-3xl p-6 mt-2">
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 rounded-full bg-flame/20 items-center justify-center">
              <Ionicons name="alert-circle" color="#E66B3F" size={18} />
            </View>
            <Text className="text-ink font-semibold ml-3">Kon events niet laden</Text>
          </View>
          <Text className="text-ink-soft text-sm leading-5 mb-3" selectable>
            {message}
          </Text>
          <Pressable
            onPress={() => events.refetch()}
            className="bg-ink active:bg-ink-soft rounded-full py-2.5 items-center self-start px-5"
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
        <View className="bg-paper-soft rounded-3xl p-6 items-center mt-2">
          <View className="w-14 h-14 rounded-full bg-flame items-center justify-center mb-3">
            <Ionicons name="sparkles" color="#F5E8D3" size={24} />
          </View>
          <Text className="text-ink font-semibold text-base mb-1">
            Maak je eerste event
          </Text>
          <Text className="text-ink-soft text-sm text-center mb-4 leading-5">
            Een verjaardag, een trip, een diner — alle foto's van iedereen op één plek.
          </Text>
          <Pressable
            onPress={() => router.push("/event-create")}
            className="bg-ink active:bg-ink-soft rounded-full px-5 py-3"
          >
            <Text className="text-cream font-semibold">Maak event</Text>
          </Pressable>
        </View>
      );
    }

    // Data state — secties tonen
    return (
      <>
        {active.length > 0 && (
          <Section title="Nu live">
            {active.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </Section>
        )}
        {upcoming.length > 0 && (
          <Section title="Komt eraan">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </Section>
        )}
        {past.length > 0 && (
          <Section title="Afgelopen">
            {past.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </Section>
        )}
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
        <FlatList
          data={[] as never[]}
          keyExtractor={() => "_"}
          renderItem={null as never}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={events.isFetching && !events.isLoading}
              onRefresh={() =>
                qc.invalidateQueries({ queryKey: ["events", myUserId] })
              }
              tintColor="#F5E8D3"
            />
          }
          ListHeaderComponent={
            <View>
              <View className="flex-row items-end justify-between mb-1">
                <Text className="text-3xl font-bold tracking-tight text-cream">
                  Events
                </Text>
                <Pressable
                  onPress={() => router.push("/event-create")}
                  className="bg-cream active:bg-cream-soft rounded-full flex-row items-center px-4 py-2"
                >
                  <Ionicons name="add" color="#1A1714" size={18} />
                  <Text className="text-ink font-semibold ml-1 text-sm">
                    Nieuw event
                  </Text>
                </Pressable>
              </View>
              <Text className="text-cream-soft text-base mb-5">
                Maak momenten samen. Foto's worden onthuld op het juiste moment.
              </Text>
              {renderBody()}
            </View>
          }
        />
      </ScreenContainer>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <Text className="text-xs uppercase tracking-wider text-cream-muted mb-3 px-1">
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

/** Compacte event-skeleton (geen vierkante image-area — past bij EventCard). */
function SkeletonEventCard() {
  return (
    <View className="bg-paper-soft rounded-3xl p-6 mt-2">
      <View className="flex-row items-center mb-3">
        <Skeleton className="w-9 h-9 bg-paper-warm rounded-full" />
        <View className="flex-1 ml-3">
          <Skeleton className="w-24 h-3 bg-paper-warm rounded-full" />
        </View>
      </View>
      <Skeleton className="w-3/4 h-6 bg-paper-warm rounded-full" />
      <View className="h-2" />
      <Skeleton className="w-1/2 h-3 bg-paper-warm rounded-full" />
    </View>
  );
}
