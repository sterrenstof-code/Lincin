import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
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
import { sendEmailInvite } from "@/lib/api/invites";

export default function InviteEmailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | { kind: "error"; message: string }
  >("idle");

  const submitting = status === "sending";

  async function onSubmit() {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) {
      setStatus({ kind: "error", message: "Geef een geldig e-mailadres." });
      return;
    }
    setStatus("sending");
    try {
      await sendEmailInvite(clean);
      await qc.invalidateQueries({ queryKey: ["pending-invites"] });
      setStatus("sent");
    } catch (e: any) {
      setStatus({ kind: "error", message: e?.message ?? "Onbekende fout" });
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
            Iemand uitnodigen
          </Text>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View className="bg-paper rounded-3xl p-6">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                Vriend nog niet op Lincin?
              </Text>
              <Text className="text-2xl font-bold tracking-tight text-ink mb-2">
                Nodig ze uit via e-mail
              </Text>
              <Text className="text-ink-soft text-sm leading-5 mb-5">
                We sturen hen een uitnodiging om hun eigen Lincin-account te maken.
                Zodra ze aanmelden, zijn jullie automatisch vrienden.
              </Text>

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                E-mailadres
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="vriend@voorbeeld.be"
                placeholderTextColor="#8A7E6C"
                editable={!submitting}
                onSubmitEditing={onSubmit}
                className="bg-paper-light text-ink text-base px-5 py-3.5 rounded-full border border-line-paper"
              />

              {typeof status === "object" && status.kind === "error" && (
                <Text className="text-red-700 text-sm mt-3">{status.message}</Text>
              )}

              {status === "sent" ? (
                <View className="mt-5 bg-paper-light border border-line-paper rounded-2xl px-5 py-4">
                  <Text className="text-ink font-semibold text-base mb-1">
                    Uitnodiging verstuurd
                  </Text>
                  <Text className="text-ink-soft text-sm leading-5">
                    {email} kreeg een mail om een account aan te maken. Zodra ze inloggen, verschijnen ze in je vrienden-lijst.
                  </Text>
                  <View className="flex-row gap-2 mt-4">
                    <Pressable
                      onPress={() => {
                        setEmail("");
                        setStatus("idle");
                      }}
                      className="flex-1 border border-ink/30 rounded-full py-2.5 items-center"
                    >
                      <Text className="text-ink font-semibold text-sm">
                        Nog iemand uitnodigen
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.back()}
                      className="flex-1 bg-ink active:bg-ink-soft rounded-full py-2.5 items-center"
                    >
                      <Text className="text-cream font-semibold text-sm">Klaar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={onSubmit}
                  disabled={submitting}
                  className="mt-5 bg-ink active:bg-ink-soft rounded-full py-3.5 items-center"
                >
                  <Text className="text-cream font-semibold text-base">
                    {submitting ? "Bezig…" : "Stuur uitnodiging"}
                  </Text>
                </Pressable>
              )}
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}
