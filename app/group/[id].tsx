import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton, SkeletonListCard } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import {
  getChatRow,
  leaveChat,
  listChatMembers,
  removeChatMember,
  renameChat,
  uploadGroupAvatar,
  type ChatMemberRow,
} from "@/lib/api/chats";
import { uriToBytes } from "@/lib/crypto/file";

export default function GroupInfoScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id!;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
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

  useEffect(() => {
    if (chat.data?.name) setNameDraft(chat.data.name);
  }, [chat.data?.name]);

  const myRole = (members.data ?? []).find((m) => m.user_id === myUserId)?.role;
  const isOwner = myRole === "owner";
  const isGroup = chat.data?.type === "group";

  const groupAvatarUrl = localAvatarUrl ?? chat.data?.avatar_url ?? null;

  async function onPickGroupAvatar() {
    if (!isOwner) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const bytes = await uriToBytes(asset.uri);
      const url = await uploadGroupAvatar(chatId, myUserId, bytes, asset.mimeType ?? "image/jpeg");
      setLocalAvatarUrl(url);
      await qc.invalidateQueries({ queryKey: ["chat-row", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats"] });
    } catch (e: any) {
      setError(e?.message ?? "Kon groepsfoto niet uploaden.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onSaveName() {
    if (!isOwner) return;
    setSavingName(true);
    setError(null);
    try {
      await renameChat(chatId, nameDraft);
      await qc.invalidateQueries({ queryKey: ["chat-row", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      setEditingName(false);
    } catch (e: any) {
      setError(e?.message ?? "Kon naam niet wijzigen.");
    } finally {
      setSavingName(false);
    }
  }

  async function onRemove(member: ChatMemberRow) {
    if (!isOwner || member.user_id === myUserId) return;
    const name = member.profile?.display_name ?? member.profile?.username ?? "Lid";
    const confirmed = await confirm(
      "Lid verwijderen",
      `Wil je ${name} uit de groep verwijderen?`
    );
    if (!confirmed) return;
    try {
      await removeChatMember(chatId, member.user_id);
      await qc.invalidateQueries({ queryKey: ["chat-members", chatId] });
    } catch (e: any) {
      setError(e?.message ?? "Kon lid niet verwijderen.");
    }
  }

  async function onLeave() {
    const confirmed = await confirm(
      "Verlaat groep",
      `Je verlaat "${chat.data?.name ?? "deze groep"}". Je kan oude berichten niet meer ophalen.`
    );
    if (!confirmed) return;
    try {
      await leaveChat(chatId, myUserId);
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      router.replace("/(app)/chats");
    } catch (e: any) {
      setError(e?.message ?? "Kon groep niet verlaten.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => safeBack(router, `/chat/${chatId}`)}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="chevron-back" color="#1A1714" size={20} />
        </Pressable>
        <Text className="flex-1 text-cream text-lg font-semibold ml-3">Groep info</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {/* Hero */}
          <View className="bg-paper rounded-3xl p-6 items-center">
            <Pressable
              onPress={onPickGroupAvatar}
              disabled={!isOwner}
              className="relative mb-3"
            >
              <View className="w-20 h-20 rounded-full bg-paper-warm items-center justify-center overflow-hidden">
                {groupAvatarUrl ? (
                  <Image
                    source={{ uri: groupAvatarUrl, cacheKey: groupAvatarUrl.split("?")[0] }}
                    cachePolicy="disk"
                    style={{ width: 80, height: 80 }}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="people" color="#1A1714" size={32} />
                )}
              </View>
              {isOwner && (
                <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ink border-2 border-paper items-center justify-center">
                  {avatarUploading
                    ? <ActivityIndicator size="small" color="#F5E8D3" />
                    : <Ionicons name="camera" color="#F5E8D3" size={14} />
                  }
                </View>
              )}
            </Pressable>

            {editingName ? (
              <View className="w-full">
                <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2 text-center">
                  Groepsnaam
                </Text>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  maxLength={64}
                  autoFocus
                  className="bg-paper-light text-ink text-center text-xl font-bold px-4 py-3 rounded-full border border-line-paper"
                />
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    onPress={() => {
                      setEditingName(false);
                      setNameDraft(chat.data?.name ?? "");
                      setError(null);
                    }}
                    className="flex-1 border border-ink/30 rounded-full py-2.5 items-center"
                  >
                    <Text className="text-ink font-semibold">Annuleer</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSaveName}
                    disabled={savingName}
                    className="flex-1 bg-ink active:bg-ink-soft rounded-full py-2.5 items-center"
                  >
                    <Text className="text-cream font-semibold">
                      {savingName ? "Bezig…" : "Bewaren"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : chat.isLoading ? (
              <Skeleton className="w-40 h-6 bg-paper-warm rounded-full" />
            ) : (
              <View className="flex-row items-center">
                <Text className="text-3xl font-bold tracking-tight text-ink">
                  {chat.data?.name ?? "Groep"}
                </Text>
                {isOwner && isGroup && (
                  <Pressable
                    onPress={() => setEditingName(true)}
                    hitSlop={8}
                    className="ml-2 p-1"
                  >
                    <Ionicons name="pencil" color="#5A4F40" size={18} />
                  </Pressable>
                )}
              </View>
            )}

            <Text className="text-ink-soft text-sm mt-1">
              {(members.data?.length ?? 0)} leden
            </Text>

            {!editingName && error && (
              <Text className="text-red-700 text-sm mt-3 text-center">{error}</Text>
            )}
          </View>

          {/* Members */}
          <View className="mt-6">
            <View className="flex-row items-end justify-between mb-3 px-1">
              <Text className="text-xs uppercase tracking-wider text-cream-muted">
                Leden
              </Text>
              {isOwner && isGroup && (
                <Pressable
                  onPress={() => router.push(`/group-add/${chatId}`)}
                  className="flex-row items-center bg-cream active:bg-cream-soft rounded-full px-3 py-1"
                >
                  <Ionicons name="person-add" color="#1A1714" size={14} />
                  <Text className="text-ink font-semibold text-xs ml-1.5">
                    Voeg toe
                  </Text>
                </Pressable>
              )}
            </View>

            {members.isLoading ? (
              <SkeletonListCard rows={3} />
            ) : (
              <View className="bg-paper-soft rounded-2xl overflow-hidden">
                {(members.data ?? []).map((m, i) => (
                  <MemberRow
                    key={m.user_id}
                    member={m}
                    isMe={m.user_id === myUserId}
                    canRemove={isOwner && isGroup && m.user_id !== myUserId}
                    isLast={i === (members.data?.length ?? 0) - 1}
                    onPress={() =>
                      m.profile?.username &&
                      router.push(`/user/${m.profile.username}`)
                    }
                    onRemove={() => onRemove(m)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Leave */}
          <View className="mt-8">
            <Pressable
              onPress={onLeave}
              className="bg-paper-soft border border-line-paper/80 rounded-2xl px-4 py-4 flex-row items-center justify-center"
            >
              <Ionicons name="exit-outline" color="#B23A1C" size={18} />
              <Text className="font-semibold ml-2" style={{ color: "#B23A1C" }}>
                Verlaat groep
              </Text>
            </Pressable>
            <Text className="text-cream-muted text-xs text-center mt-2 leading-5">
              Je oude berichten worden ontoegankelijk omdat je toestel ze niet meer kan ontsleutelen voor nieuwe sleutels.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function MemberRow({
  member,
  isMe,
  canRemove,
  isLast,
  onPress,
  onRemove,
}: {
  member: ChatMemberRow;
  isMe: boolean;
  canRemove: boolean;
  isLast: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const name =
    member.profile?.display_name ?? member.profile?.username ?? "Onbekend";
  return (
    <View
      className={`flex-row items-center px-4 py-3 ${
        isLast ? "" : "border-b border-line-paper/60"
      }`}
    >
      <Pressable onPress={onPress} className="flex-row items-center flex-1" hitSlop={4}>
        <Avatar name={name} avatarUrl={member.profile?.avatar_url} size="md" />
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className="text-ink font-semibold">{name}</Text>
            {isMe && (
              <View className="bg-paper-warm rounded-full px-2 py-0.5 ml-2">
                <Text className="text-ink text-[10px] font-bold uppercase tracking-wider">
                  Jij
                </Text>
              </View>
            )}
          </View>
          <Text className="text-ink-muted text-xs">
            @{member.profile?.username ?? "?"}
            {member.role === "owner" ? " • Eigenaar" : ""}
          </Text>
        </View>
      </Pressable>
      {canRemove && (
        <Pressable onPress={onRemove} hitSlop={8} className="p-2">
          <Ionicons name="remove-circle-outline" color="#B23A1C" size={20} />
        </Pressable>
      )}
    </View>
  );
}

function confirm(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Annuleer", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
