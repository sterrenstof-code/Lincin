import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ActivityCard } from "@/components/ActivityCard";
import { Skeleton } from "@/components/Skeleton";
import { listActivityByActor } from "@/lib/api/activity-events";
import { feed } from "@/lib/design/type";

const PAGE = 20;

/**
 * Alles wat iemand op Lincin gedaan heeft, nieuwste eerst.
 *
 * Per bladzijde van twintig, met een knop eronder. Niet oneindig
 * doorladen bij het scrollen: dit staat onderaan een profiel dat zelf al
 * scrollt, en een lijst die uit zichzelf blijft groeien maakt de bodem van
 * die pagina onbereikbaar.
 */
export function ActivityHistory({
  userId,
  title = "Activiteit",
  emptyLabel = "Nog niets gedaan.",
}: {
  userId: string;
  title?: string;
  emptyLabel?: string;
}) {
  const q = useInfiniteQuery({
    queryKey: ["activity-by-actor", userId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listActivityByActor(userId, { limit: PAGE, offset: pageParam }),
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE : undefined),
    enabled: !!userId,
  });

  const events = q.data?.pages.flatMap((p) => p.events) ?? [];

  return (
    <View>
      <Text className="text-xs uppercase tracking-wider text-ink-muted mt-6 mb-3 px-1">
        {title}
      </Text>

      {q.isLoading ? (
        <View className="gap-2">
          <Skeleton className="bg-paper-soft h-16" />
          <Skeleton className="bg-paper-soft h-16" />
        </View>
      ) : events.length === 0 ? (
        <View className="bg-paper-soft p-5">
          <Text className="text-ink-soft text-sm leading-5">{emptyLabel}</Text>
        </View>
      ) : (
        <View className="gap-2">
          {events.map((event) => (
            <ActivityCard key={event.id} event={event} />
          ))}
        </View>
      )}

      {q.hasNextPage ? (
        <Pressable
          onPress={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="items-center justify-center py-3.5 mt-2 border border-line-paper active:bg-paper-soft"
        >
          {q.isFetchingNextPage ? (
            <ActivityIndicator size="small" color={feed.inkDim} />
          ) : (
            <Text className="text-ink font-semibold text-sm">Meer laden</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
