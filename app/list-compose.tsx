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
import { FormError } from "@/components/FormError";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth/provider";
import { createSharedList } from "@/lib/api/shared-lists";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";
import { creamOnDark, desk, feed } from "@/lib/design/type";
import { safeBack } from "@/lib/nav";

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
      safeBack(router, "/(app)/feed");
    } catch (e: any) {
      setError(e.message ?? "Er ging iets mis.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-desk" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenContainer>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
              <Pressable
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel="Terug"
                onPress={() => safeBack(router, "/(app)/feed")} className="w-10 h-10 items-center justify-center">
                <Ionicons name="arrow-back" color={desk.ink} size={22} />
              </Pressable>
              <Text className="text-desk-ink font-bold text-lg">Nieuwe lijst</Text>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 ${canSubmit ? "bg-flame" : "bg-paper"}`}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={creamOnDark.DEFAULT} />
                  : <Text className={`font-semibold text-sm ${canSubmit ? "text-cream" : "text-ink-muted"}`}>Aanmaken</Text>
                }
              </Pressable>
            </View>

            <View className="px-5 gap-4">
              {/* Emoji picker */}
              <View className="bg-paper-soft p-4">
                <Text className="text-ink-muted text-xs mb-3">Icoon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EMOJI_OPTIONS.map((e) => (
                    <Pressable
                      hitSlop={4}
                      key={e}
                      onPress={() => setEmoji(e)}
                      className={`w-10 h-10 items-center justify-center ${emoji === e ? "bg-flame/20 border border-flame/40" : "bg-paper"}`}
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
                placeholderTextColor={feed.inkDim}
                autoFocus
                className="bg-paper-soft px-4 py-3 text-ink text-base"
                style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
              />

              {/* Leden uitnodigen */}
              {friends.length > 0 && (
                <View className="bg-paper-soft p-4">
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
                          <View className={` p-0.5 ${selected ? "bg-flame" : "bg-transparent"}`}>
                            <Avatar name={p.display_name ?? p.username} avatarUrl={p.avatar_url ?? null} size="md" />
                          </View>
                          {selected && (
                            <View className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-flame items-center justify-center">
                              <Ionicons name="checkmark" color={creamOnDark.DEFAULT} size={10} />
                            </View>
                          )}
                          <Text className={`text-[11px] max-w-[56px] text-center ${selected ? "text-flame font-semibold" : "text-desk-soft"}`} numberOfLines={1}>
                            {p.display_name ?? p.username}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {error ? <FormError tone="desk">{error}</FormError> : null}
            </View>
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
