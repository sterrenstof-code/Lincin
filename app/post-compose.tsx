import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { createPost } from "@/lib/api/posts";

export default function PostComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkField, setShowLinkField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting && (imageUri || caption.trim() || linkUrl.trim());

  async function pickImage() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Geen toegang tot je foto's. Geef Lincin toegang in je systeeminstellingen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Geen camera-toegang. Geef Lincin toegang in je systeeminstellingen.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setImageUri(result.assets[0].uri);
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        userId: myUserId,
        imageUri: imageUri ?? undefined,
        caption: caption || null,
        linkUrl: linkUrl.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["feed", myUserId] });
      router.back();
    } catch (e: any) {
      setError(humanizePostError(e));
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
            Nieuwe post
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
              {submitting ? "Plaatsen…" : "Plaatsen"}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            {/* Caption — primary */}
            <View className="bg-paper rounded-3xl p-5">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Wat wil je delen?
              </Text>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Schrijf iets, of laat leeg…"
                placeholderTextColor="#8A7E6C"
                multiline
                maxLength={1000}
                className="text-ink text-base bg-paper-light border border-line-paper rounded-2xl px-4 py-3"
                style={{ minHeight: 100, textAlignVertical: "top" }}
              />
              <Text className="text-ink-muted text-xs mt-2 text-right">
                {caption.length}/1000
              </Text>
            </View>

            {/* Image preview / picker */}
            {imageUri ? (
              <View className="bg-paper-soft rounded-3xl overflow-hidden mt-4">
                <View className="bg-shell">
                  <Image
                    source={{ uri: imageUri }}
                    style={{ width: "100%", aspectRatio: 1 }}
                    contentFit="cover"
                    transition={150}
                  />
                </View>
                <View className="flex-row gap-2 p-3">
                  <Pressable
                    onPress={pickImage}
                    className="flex-1 flex-row items-center justify-center bg-paper-warm active:bg-paper rounded-full px-4 py-2.5"
                  >
                    <Ionicons name="images-outline" color="#1A1714" size={16} />
                    <Text className="text-ink font-semibold ml-2 text-sm">Wijzig</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setImageUri(null)}
                    className="flex-row items-center justify-center bg-paper-warm active:bg-paper rounded-full px-4 py-2.5"
                  >
                    <Ionicons name="trash-outline" color="#1A1714" size={16} />
                    <Text className="text-ink font-semibold ml-2 text-sm">Verwijder</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="flex-row gap-2 mt-4">
                <Pressable
                  onPress={pickImage}
                  className="flex-1 flex-row items-center justify-center bg-paper-soft active:bg-paper rounded-2xl px-4 py-3.5"
                >
                  <Ionicons name="images-outline" color="#1A1714" size={18} />
                  <Text className="text-ink font-semibold ml-2">Foto</Text>
                </Pressable>
                {Platform.OS !== "web" && (
                  <Pressable
                    onPress={takePhoto}
                    className="flex-1 flex-row items-center justify-center bg-paper-soft active:bg-paper rounded-2xl px-4 py-3.5"
                  >
                    <Ionicons name="camera-outline" color="#1A1714" size={18} />
                    <Text className="text-ink font-semibold ml-2">Camera</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setShowLinkField((s) => !s)}
                  className={`flex-1 flex-row items-center justify-center rounded-2xl px-4 py-3.5 ${
                    showLinkField || linkUrl.length > 0
                      ? "bg-ink"
                      : "bg-paper-soft active:bg-paper"
                  }`}
                >
                  <Ionicons
                    name="link-outline"
                    color={showLinkField || linkUrl.length > 0 ? "#F5E8D3" : "#1A1714"}
                    size={18}
                  />
                  <Text
                    className={`font-semibold ml-2 ${
                      showLinkField || linkUrl.length > 0 ? "text-cream" : "text-ink"
                    }`}
                  >
                    Link
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Link field — appears when toggled or already filled */}
            {(showLinkField || linkUrl.length > 0) && (
              <View className="bg-paper-soft rounded-2xl p-4 mt-4">
                <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                  Link toevoegen
                </Text>
                <View className="flex-row items-center bg-paper-light rounded-full px-4 border border-line-paper">
                  <Ionicons name="link" color="#8A7E6C" size={16} />
                  <TextInput
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                    placeholder="https://…"
                    placeholderTextColor="#8A7E6C"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    className="flex-1 text-ink text-base py-3 pl-2"
                  />
                  {linkUrl.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setLinkUrl("");
                        setShowLinkField(false);
                      }}
                      className="p-1"
                    >
                      <Ionicons name="close-circle" color="#8A7E6C" size={18} />
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {error && (
              <View className="bg-red-100 border border-red-300 rounded-2xl px-4 py-3 mt-4">
                <Text className="text-red-800 text-sm">{error}</Text>
              </View>
            )}

            {submitting && (
              <View className="items-center mt-6">
                <ActivityIndicator color="#F5E8D3" />
                <Text className="text-cream-soft text-xs mt-2">
                  {imageUri ? "Foto wordt geüpload…" : "Bezig…"}
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function humanizePostError(err: any): string {
  const msg = err?.message ?? String(err ?? "Onbekende fout");
  if (/schema is invalid|schema is incompatible/i.test(msg)) {
    return (
      "Supabase Storage gaf een schema-fout. Run `0003_storage_repair.sql` in de Supabase SQL Editor en probeer opnieuw."
    );
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return "Toegang geweigerd. Run de storage-repair migratie (0003_storage_repair).";
  }
  if (/mime type/i.test(msg)) {
    return "Dit bestandstype is niet toegelaten. Gebruik JPG, PNG, WebP of HEIC.";
  }
  return msg;
}
