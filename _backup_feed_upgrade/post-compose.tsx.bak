import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
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
import { SmartTextInput } from "@/components/SmartTextInput";
import { useAuth } from "@/lib/auth/provider";
import { createPost } from "@/lib/api/posts";

type PostType = "tekst" | "foto" | "video" | "link";

const POST_TYPES: { id: PostType; label: string; icon: any }[] = [
  { id: "tekst",  label: "Tekst",      icon: "text-outline" },
  { id: "foto",   label: "Afbeelding", icon: "image-outline" },
  { id: "video",  label: "Video",      icon: "videocam-outline" },
  { id: "link",   label: "Link",       icon: "link-outline" },
];

export default function PostComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [postType, setPostType] = useState<PostType>("tekst");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [caption, setCaption] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !submitting && (() => {
    switch (postType) {
      case "tekst":  return caption.trim().length > 0;
      case "foto":   return !!mediaUri && !mediaIsVideo;
      case "video":  return !!mediaUri && mediaIsVideo;
      case "link":   return linkUrl.trim().length > 0;
    }
  })();

  async function pickMedia(type: "foto" | "video") {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Geen toegang tot je mediabibliotheek."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "video" ? ["videos"] : ["images"],
      quality: type === "video" ? 0.7 : 0.85,
      allowsEditing: false,
      selectionLimit: 1,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets[0]) return;
    setMediaUri(result.assets[0].uri);
    setMediaIsVideo(result.assets[0].type === "video");
  }

  async function takeMedia(type: "foto" | "video") {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setError("Geen camera-toegang."); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: type === "video" ? ["videos"] : ["images"],
      quality: type === "video" ? 0.7 : 0.85,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets[0]) return;
    setMediaUri(result.assets[0].uri);
    setMediaIsVideo(result.assets[0].type === "video");
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPost({
        userId: myUserId,
        imageUri: mediaUri ?? undefined,
        caption: caption.trim() || null,
        linkUrl: postType === "link" ? linkUrl.trim() || null : null,
      });
      await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
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
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 80 }}
          >
            {/* Header */}
            <View className="flex-row items-center px-4 pt-2 pb-1.5">
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
                className={`rounded-full px-4 py-2 ${canSubmit ? "bg-cream active:bg-cream-soft" : "bg-shell-soft"}`}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#1A1714" />
                  : <Text className={`font-semibold ${canSubmit ? "text-ink" : "text-cream-muted"}`}>Plaatsen</Text>
                }
              </Pressable>
            </View>

            {/* Type picker — scrollbare pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
            >
              {POST_TYPES.map((t) => {
                const active = postType === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => { setPostType(t.id); setError(null); setMediaUri(null); }}
                    className={`flex-row items-center gap-2 px-4 py-2 rounded-full border ${
                      active ? "bg-cream border-cream" : "bg-paper-soft border-paper-soft"
                    }`}
                  >
                    <Ionicons name={t.icon} size={15} color={active ? "#1A1714" : "#8A7E6C"} />
                    <Text className={`text-sm font-semibold ${active ? "text-ink" : "text-ink-muted"}`}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => router.replace("/list-compose")}
                className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-paper-soft border border-paper-soft"
              >
                <Ionicons name="checkmark-circle-outline" size={15} color="#8A7E6C" />
                <Text className="text-sm font-semibold text-ink-muted">Lijst</Text>
              </Pressable>
            </ScrollView>

            <View className="px-5 pt-3">

            {/* TEKST */}
            {postType === "tekst" && (
              <View>
                <SmartTextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Schrijf iets…"
                  placeholderTextColor="#8A7E6C"
                  multiline
                  maxLength={1000}
                  autoFocus
                  inputClassName="bg-paper rounded-3xl text-ink text-base px-5 py-4"
                  style={{ minHeight: 160, textAlignVertical: "top" }}
                />
                <Text className="text-ink-muted text-xs mt-2 text-right px-1">{caption.length}/1000</Text>
              </View>
            )}

            {/* FOTO */}
            {postType === "foto" && (
              <View>
                {mediaUri && !mediaIsVideo ? (
                  <View className="rounded-3xl overflow-hidden bg-shell mb-3">
                    <Image source={{ uri: mediaUri }} style={{ width: "100%", aspectRatio: 1 }} contentFit="cover" />
                    <View className="flex-row gap-2 p-3">
                      <Pressable onPress={() => pickMedia("foto")} className="flex-1 flex-row items-center justify-center bg-paper-warm rounded-full px-4 py-2.5">
                        <Ionicons name="images-outline" color="#1A1714" size={16} />
                        <Text className="text-ink font-semibold ml-2 text-sm">Wijzig</Text>
                      </Pressable>
                      <Pressable onPress={() => setMediaUri(null)} className="flex-row items-center justify-center bg-paper-warm rounded-full px-4 py-2.5">
                        <Ionicons name="trash-outline" color="#B23A1C" size={16} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-3 mb-4">
                    <Pressable onPress={() => pickMedia("foto")} className="flex-1 items-center justify-center bg-paper-soft rounded-3xl py-10 gap-2">
                      <Ionicons name="images-outline" color="#8A7E6C" size={32} />
                      <Text className="text-ink-muted font-semibold text-sm">Kies foto</Text>
                    </Pressable>
                    {Platform.OS !== "web" && (
                      <Pressable onPress={() => takeMedia("foto")} className="flex-1 items-center justify-center bg-paper-soft rounded-3xl py-10 gap-2">
                        <Ionicons name="camera-outline" color="#8A7E6C" size={32} />
                        <Text className="text-ink-muted font-semibold text-sm">Camera</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <SmartTextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Bijschrift (optioneel)…"
                  placeholderTextColor="#8A7E6C"
                  multiline
                  maxLength={500}
                  inputClassName="bg-paper rounded-2xl text-ink text-base px-4 py-3"
                  style={{ minHeight: 80, textAlignVertical: "top" }}
                />
              </View>
            )}

            {/* VIDEO */}
            {postType === "video" && (
              <View>
                {mediaUri && mediaIsVideo ? (
                  <View className="rounded-3xl overflow-hidden bg-shell mb-3">
                    <Video
                      source={{ uri: mediaUri }}
                      style={{ width: "100%", aspectRatio: 16 / 9 }}
                      resizeMode={ResizeMode.CONTAIN}
                      useNativeControls
                      isLooping={false}
                    />
                    <View className="flex-row gap-2 p-3">
                      <Pressable onPress={() => pickMedia("video")} className="flex-1 flex-row items-center justify-center bg-paper-warm rounded-full px-4 py-2.5">
                        <Ionicons name="videocam-outline" color="#1A1714" size={16} />
                        <Text className="text-ink font-semibold ml-2 text-sm">Andere video</Text>
                      </Pressable>
                      <Pressable onPress={() => setMediaUri(null)} className="flex-row items-center justify-center bg-paper-warm rounded-full px-4 py-2.5">
                        <Ionicons name="trash-outline" color="#B23A1C" size={16} />
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-3 mb-4">
                    <Pressable onPress={() => pickMedia("video")} className="flex-1 items-center justify-center bg-paper-soft rounded-3xl py-10 gap-2">
                      <Ionicons name="film-outline" color="#8A7E6C" size={32} />
                      <Text className="text-ink-muted font-semibold text-sm">Kies video</Text>
                      <Text className="text-ink-muted text-xs">max. 2 min</Text>
                    </Pressable>
                    {Platform.OS !== "web" && (
                      <Pressable onPress={() => takeMedia("video")} className="flex-1 items-center justify-center bg-paper-soft rounded-3xl py-10 gap-2">
                        <Ionicons name="videocam-outline" color="#8A7E6C" size={32} />
                        <Text className="text-ink-muted font-semibold text-sm">Opnemen</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <SmartTextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Bijschrift (optioneel)…"
                  placeholderTextColor="#8A7E6C"
                  multiline
                  maxLength={500}
                  inputClassName="bg-paper rounded-2xl text-ink text-base px-4 py-3"
                  style={{ minHeight: 80, textAlignVertical: "top" }}
                />
              </View>
            )}

            {/* LINK */}
            {postType === "link" && (
              <View className="gap-4">
                <View className="bg-paper rounded-3xl p-5">
                  <Text className="text-xs uppercase tracking-wider text-ink-muted mb-3">URL</Text>
                  <View className="flex-row items-center bg-paper-light rounded-2xl border border-line-paper px-4">
                    <Ionicons name="link" color="#8A7E6C" size={16} />
                    <TextInput
                      value={linkUrl}
                      onChangeText={setLinkUrl}
                      placeholder="https://…"
                      placeholderTextColor="#8A7E6C"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      autoFocus
                      className="flex-1 text-ink text-base py-3 pl-2"
                      style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
                    />
                    {linkUrl.length > 0 && (
                      <Pressable onPress={() => setLinkUrl("")} className="p-1">
                        <Ionicons name="close-circle" color="#8A7E6C" size={18} />
                      </Pressable>
                    )}
                  </View>
                </View>
                <SmartTextInput
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Toelichting (optioneel)…"
                  placeholderTextColor="#8A7E6C"
                  multiline
                  maxLength={500}
                  inputClassName="bg-paper rounded-3xl text-ink text-base px-5 py-4"
                  style={{ minHeight: 100, textAlignVertical: "top" }}
                />
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
                  {mediaUri ? "Media wordt geüpload…" : "Bezig…"}
                </Text>
              </View>
            )}
            </View>{/* /px-5 pt-3 */}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function humanizePostError(err: any): string {
  const msg = err?.message ?? String(err ?? "Onbekende fout");
  if (/schema is invalid|schema is incompatible/i.test(msg)) {
    return "Supabase Storage gaf een schema-fout. Run `0003_storage_repair.sql` en probeer opnieuw.";
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return "Toegang geweigerd. Run de storage-repair migratie.";
  }
  if (/mime type/i.test(msg)) {
    return "Dit bestandstype is niet toegelaten. Gebruik JPG, PNG, WebP, HEIC of MP4.";
  }
  return msg;
}
