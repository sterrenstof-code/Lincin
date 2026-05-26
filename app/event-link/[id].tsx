import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { contributeToEvent } from "@/lib/api/events";

export default function EventLinkComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;

  const [link, setLink] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !submitting && link.trim().length > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await contributeToEvent({
        eventId,
        userId: myUserId,
        linkUrl: link.trim(),
        caption: caption.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      await qc.invalidateQueries({ queryKey: ["event", eventId] });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Kon link niet toevoegen.");
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
            Voeg link toe
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
              {submitting ? "Bezig…" : "Plaats"}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View className="bg-paper rounded-3xl p-6">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Link
              </Text>
              <View className="flex-row items-center bg-paper-light rounded-full px-4 border border-line-paper">
                <Ionicons name="link" color="#8A7E6C" size={16} />
                <TextInput
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://…"
                  placeholderTextColor="#8A7E6C"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  className="flex-1 text-ink text-base py-3 pl-2"
                />
              </View>

              <View className="h-5" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Bijschrift (optioneel)
              </Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Wat is dit?"
                placeholderTextColor="#8A7E6C"
                multiline
                maxLength={300}
                className="bg-paper-light text-ink text-base px-4 py-3 rounded-2xl border border-line-paper"
                style={{ minHeight: 60, textAlignVertical: "top" }}
              />
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
