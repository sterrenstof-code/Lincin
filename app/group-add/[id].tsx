import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SkeletonListCard } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import {
  addChatMember,
  getChatRow,
  listChatMembers,
} from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";

export default function GroupAddMembersScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id!;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chat = useQuery({
    queryKey: ["chat-row", chatId],
    queryFn: () => getChatRow(chatId),
    enabled: !!chatId,
  });

  const members = useQuery({
    queryKey: ["chat-members", chatId],
    queryFn: () => listChatMembers(chatId),
    enabled: !!chatId,
  });

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const friendsToAdd = useMemo(() => {
    const accepted = (friendships.data ?? []).filter((f) => f.status === "accepted");
    const memberIds = new Set((members.data ?? []).map((m) => m.user_id));
    return accepted.filter((f) => !memberIds.has(f.other.id));
  }, [friendships.data, members.data]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit = !submitting && selected.size > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Sequential — small batch (<20), simpler error reporting than Promise.all.
      for (const userId of selected) {
        await addChatMember(chatId, userId);
      }
      await qc.invalidateQueries({ queryKey: ["chat-members", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Kon leden niet toevoegen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="close" color="#1A1714" size={20} />
        </Pressable>
        <Text className="flex-1 text-cream text-lg font-semibold ml-3">
          Leden toevoegen
        </Text>
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          className={`rounded-full px-4 py-2 ${
            canSubmit ? "bg-cream active:bg-cream-soft" : "bg-shell-soft"
          }`}
        >
          <Text
            className={`font-semibold ${
              canSubmit ? "text-ink" : "text-cream-muted"
            }`}
          >
            {submitting ? "Bezig…" : "Voeg toe"}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <View className="bg-paper rounded-3xl p-5">
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
              {chat.data?.name ? `Naar "${chat.data.name}"` : "Naar groep"}
            </Text>
            <Text className="text-ink-soft text-sm">
              Selecteer vrienden om aan deze groep toe te voegen. Elk nieuw lid
              krijgt z'n eigen versleutelde envelope op elk volgend bericht.
            </Text>
          </View>

          <View className="mt-5">
            <View className="flex-row items-end justify-between mb-3 px-1">
              <Text className="text-xs uppercase tracking-wider text-cream-muted">
                Jouw vrienden
              </Text>
              <Text className="text-cream-soft text-xs">
                {selected.size} geselecteerd
              </Text>
            </View>

            {friendships.isLoading || members.isLoading ? (
              <SkeletonListCard rows={3} />
            ) : friendsToAdd.length === 0 ? (
              <View className="bg-paper-soft rounded-2xl p-5">
                <Text className="text-ink-soft text-sm leading-5">
                  Iedereen op je vriendenlijst zit al in deze groep. Voeg eerst nieuwe vrienden toe in de Vrienden-tab.
                </Text>
              </View>
            ) : (
              <View className="bg-paper-soft rounded-2xl overflow-hidden">
                {friendsToAdd.map((f, i) => {
                  const checked = selected.has(f.other.id);
                  const isLast = i === friendsToAdd.length - 1;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => toggle(f.other.id)}
                      className={`flex-row items-center px-4 py-3 ${
                        isLast ? "" : "border-b border-line-paper/60"
                      } ${checked ? "bg-paper" : ""}`}
                    >
                      <Avatar
                        name={f.other.display_name ?? f.other.username}
                        size="md"
                      />
                      <View className="flex-1 ml-3">
                        <Text className="text-ink font-semibold">
                          {f.other.display_name ?? f.other.username}
                        </Text>
                        <Text className="text-ink-muted text-xs">
                          @{f.other.username}
                        </Text>
                      </View>
                      <Ionicons
                        name={checked ? "checkmark-circle" : "ellipse-outline"}
                        color={checked ? "#1A1714" : "#8A7E6C"}
                        size={24}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {error && (
            <View className="bg-red-100 border border-red-300 rounded-2xl px-4 py-3 mt-4">
              <Text className="text-red-800 text-sm">{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}
