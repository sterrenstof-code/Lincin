import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DesktopLists } from "@/components/lincin/desktop/DesktopLists";
import { QueryError } from "@/components/QueryError";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonListCard } from "@/components/Skeleton";
import { listMySharedLists, type SharedListWithDetails } from "@/lib/api/shared-lists";
import { useAuth } from "@/lib/auth/provider";
import { desk } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/**
 * Waar je lijsten wonen.
 *
 * Er was geen zo'n plek. `list-compose` maakte er een aan en stuurde je
 * daarna terug naar de feed, waar hij niet getekend werd; `list/[id]` kon
 * je alleen bereiken als iemand je uitnodigde en je de melding aantikte.
 * Een ding dat je kunt maken maar nooit meer terugvinden is geen functie,
 * en dit scherm is de ontbrekende helft ervan.
 */
export default function ListsScreen() {
  usePageTitle("Mijn lijsten");
  const desktop = useIsDesktop();
  if (desktop) return <DesktopLists />;
  return <ListsMobile />;
}

function ListsMobile() {
  const router = useRouter();
  const t = useT();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const lists = useQuery({
    queryKey: ["shared-lists", myUserId],
    queryFn: () => listMySharedLists(myUserId),
  });

  return (
    <SafeAreaView className="flex-1 bg-desk" edges={["top"]}>
      <ScreenContainer>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View className="flex-row items-center mb-5 gap-3">
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.back}
              onPress={() => safeBack(router, "/(app)/profile")}
              className="w-9 h-9 items-center justify-center"
            >
              <Ionicons name="arrow-back" color={desk.ink} size={22} />
            </Pressable>
            <Text className="text-desk-ink font-bold text-xl flex-1">{t.myLists}</Text>
            <Pressable
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.newList}
              onPress={() => router.push("/list-compose")}
              className="w-9 h-9 items-center justify-center"
            >
              <Ionicons name="add" color={desk.ink} size={24} />
            </Pressable>
          </View>

          {lists.isLoading ? (
            <>
              <SkeletonListCard />
              <SkeletonListCard />
            </>
          ) : lists.isError ? (
            <QueryError title={t.failed} error={lists.error} onRetry={() => lists.refetch()} />
          ) : (lists.data ?? []).length === 0 ? (
            <Empty onPress={() => router.push("/list-compose")} label={t.noListsYet} action={t.newList} />
          ) : (
            (lists.data ?? []).map((l) => <Row key={l.id} list={l} />)
          )}
        </ScrollView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function Empty({ label, action, onPress }: { label: string; action: string; onPress: () => void }) {
  return (
    <View className="items-center py-12">
      <Text className="text-desk-soft text-sm mb-4">{label}</Text>
      <Pressable onPress={onPress} className="bg-ink active:bg-ink-soft px-6 py-3">
        <Text className="text-cream font-semibold">{action}</Text>
      </Pressable>
    </View>
  );
}

function Row({ list: l }: { list: SharedListWithDetails }) {
  const router = useRouter();
  const t = useT();
  const total = l.item_count;
  const done = l.checked_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={l.title}
      onPress={() => router.push(`/list/${l.id}` as never)}
      className="flex-row items-center gap-3 py-3 border-b border-paper"
    >
      <Text style={{ fontSize: 26 }}>{l.emoji}</Text>
      <View className="flex-1 min-w-0">
        <Text className="text-desk-ink font-semibold" numberOfLines={1}>
          {l.title}
        </Text>
        <Text className="text-desk-soft text-xs mt-0.5">
          {total === 0 ? t.listEmpty : `${done} ${t.ofWord} ${total} · ${pct}%`}
          {` · ${l.members.length + 1} ${l.members.length + 1 === 1 ? "linc" : "lincs"}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" color={desk.soft} size={18} />
    </Pressable>
  );
}
