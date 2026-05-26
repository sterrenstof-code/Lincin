import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { createGroupChat } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";

export default function GroupCreateScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const accepted = useMemo(
    () => (friendships.data ?? []).filter((f) => f.status === "accepted"),
    [friendships.data]
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const trimmedName = name.trim();
  const canSubmit =
    !submitting && trimmedName.length > 0 && selectedIds.size >= 1;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const chatId = await createGroupChat(trimmedName, Array.from(selectedIds));
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      router.replace(`/chat/${chatId}`);
    } catch (e: any) {
      setError(e?.message ?? "Kon groep niet aanmaken.");
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
          Nieuwe groep
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
            {submitting ? "Bezig…" : "Aanmaken"}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Group name */}
          <View className="bg-paper rounded-3xl p-6">
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
              Groepsnaam
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="bv. Vrijdagavondbende"
              placeholderTextColor="#8A7E6C"
              maxLength={64}
              className="bg-paper-light text-ink text-base px-5 py-3 rounded-full border border-line-paper"
            />
            <Text className="text-ink-muted text-xs mt-2">
              Iedereen in de groep ziet deze naam.
            </Text>
          </View>

          {/* Members */}
          <View className="mt-5">
            <View className="flex-row items-end justify-between mb-3 px-1">
              <Text className="text-xs uppercase tracking-wider text-cream-muted">
                Vrienden toevoegen
              </Text>
              <Text className="text-cream-soft text-xs">
                {selectedIds.size} geselecteerd
              </Text>
            </View>

            {friendships.isLoading ? (
              <View className="bg-paper-soft rounded-2xl p-6 items-center">
                <ActivityIndicator color="#1A1714" />
              </View>
            ) : accepted.length === 0 ? (
              <View className="bg-paper-soft rounded-2xl p-5">
                <Text className="text-ink-soft text-sm leading-5">
                  Je hebt nog geen geaccepteerde vrienden. Voeg eerst iemand toe in de Vrienden-tab.
                </Text>
              </View>
            ) : (
              <View className="bg-paper-soft rounded-2xl overflow-hidden">
                {accepted.map((f, i) => {
                  const checked = selectedIds.has(f.other.id);
                  const isLast = i === accepted.length - 1;
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
