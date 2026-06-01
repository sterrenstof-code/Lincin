import { useEffect, useState } from "react";
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
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth/provider";
import { createSharedList } from "@/lib/api/shared-lists";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";

const EMOJI_OPTIONS = ["📋", "🎯", "🌍", "🎁", "🛒", "🍕", "📚", "🎬", "🏕️", "💡"];

export default function ListComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyFriendships(myUserId).then((fs) => setFriends(fs.filter((f) => f.status === "accepted")));
  }, [myUserId]);

  const canSubmit = !submitting && title.trim().length > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createSharedList({ userId: myUserId, title: title.trim(), emoji, memberIds });
      await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Er ging iets mis.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenContainer>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
              <Pressable onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
                <Ionicons name="arrow-back" color="#F5E8D3" size={22} />
              </Pressable>
              <Text className="text-cream font-bold text-lg">Nieuwe lijst</Text>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-full ${canSubmit ? "bg-flame" : "bg-paper"}`}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#F5E8D3" />
                  : <Text className={`font-semibold text-sm ${canSubmit ? "text-cream" : "text-ink-muted"}`}>Aanmaken</Text>
                }
              </Pressable>
            </View>

            <View className="px-5 gap-4">
              {/* Emoji picker */}
              <View className="bg-paper-soft rounded-2xl p-4">
                <Text className="text-ink-muted text-xs mb-3">Icoon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EMOJI_OPTIONS.map((e) => (
                    <Pressable
                      key={e}
                      onPress={() => setEmoji(e)}
                      className={`w-10 h-10 items-center justify-center rounded-xl ${emoji === e ? "bg-flame/20 border border-flame/40" : "bg-paper"}`}
                    >
                      <Text style={{ fontSize: 20 }}>{e}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Title */}
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Naam van de lijst, bijv. Bucketlist"
                placeholderTextColor="#6B5E4E"
                autoFocus
                className="bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base"
                style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
              />

              {/* Leden uitnodigen */}
              {friends.length > 0 && (
                <View className="bg-paper-soft rounded-2xl p-4">
                  <Text className="text-ink-muted text-xs mb-3">Delen met</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {friends.map((f) => {
                      const p = f.other;
                      const selected = memberIds.includes(p.id);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => setMemberIds((prev) => selected ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                          className="items-center gap-1"
                        >
                          <View className={`rounded-full p-0.5 ${selected ? "bg-flame" : "bg-transparent"}`}>
                            <Avatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url ?? null} size="md" />
                          </View>
                          {selected && (
                            <View className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-flame rounded-full items-center justify-center">
                              <Ionicons name="checkmark" color="#F5E8D3" size={10} />
                            </View>
                          )}
                          <Text className={`text-[11px] max-w-[56px] text-center ${selected ? "text-flame font-semibold" : "text-cream-soft"}`} numberOfLines={1}>
                            {p.display_name ?? p.username}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {error && <Text className="text-red-400 text-sm">{error}</Text>}
            </View>
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
