import { useState } from "react";
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
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { createPoll } from "@/lib/api/polls";
import { createActivityEvent } from "@/lib/api/activity-events";

export default function PollComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= 2;

  function addOption() {
    if (options.length >= 6) return;
    setOptions([...options, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    setOptions(options.map((o, i) => (i === index ? value : o)));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const poll = await createPoll({
        userId: myUserId,
        question: question.trim(),
        options: options.filter((o) => o.trim().length > 0),
      });
      await createActivityEvent({ actorId: myUserId, kind: "post_created", postId: poll.id });
      await qc.invalidateQueries({ queryKey: ["unified-feed"] });
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Er ging iets mis.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenContainer>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
              <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                <Ionicons name="arrow-back" color="#F5E8D3" size={22} />
              </Pressable>
              <Text className="text-cream font-bold text-lg">Nieuwe stemming</Text>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-full ${canSubmit ? "bg-flame" : "bg-paper"}`}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#F5E8D3" />
                  : <Text className={`font-semibold text-sm ${canSubmit ? "text-cream" : "text-ink-muted"}`}>Plaatsen</Text>
                }
              </Pressable>
            </View>

            {/* Vraag */}
            <Text className="text-cream-soft text-xs uppercase tracking-wider mb-2">Vraag</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Stel je vraag…"
              placeholderTextColor="#6B5E4E"
              multiline
              className="bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base mb-6"
              style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
            />

            {/* Opties */}
            <Text className="text-cream-soft text-xs uppercase tracking-wider mb-2">Opties</Text>
            <View className="gap-2 mb-3">
              {options.map((opt, i) => (
                <View key={i} className="flex-row items-center gap-2">
                  <TextInput
                    value={opt}
                    onChangeText={(v) => updateOption(i, v)}
                    placeholder={`Optie ${i + 1}`}
                    placeholderTextColor="#6B5E4E"
                    className="flex-1 bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base"
                    style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
                  />
                  {options.length > 2 && (
                    <Pressable
                      onPress={() => removeOption(i)}
                      className="w-9 h-9 items-center justify-center bg-paper-soft rounded-full"
                    >
                      <Ionicons name="close" color="#8A7E6C" size={16} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {options.length < 6 && (
              <Pressable
                onPress={addOption}
                className="flex-row items-center gap-2 py-3 px-4 bg-paper-soft rounded-2xl mb-6"
              >
                <Ionicons name="add-circle-outline" color="#8A7E6C" size={18} />
                <Text className="text-ink-muted text-sm">Optie toevoegen</Text>
              </Pressable>
            )}

            {error && (
              <Text className="text-red-400 text-sm mt-2">{error}</Text>
            )}
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
