import { useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import {
  getSharedListWithDetails,
  addListItem,
  toggleListItem,
  deleteListItem,
  subscribeToListItems,
  type SharedListWithDetails,
  type ListItem,
} from "@/lib/api/shared-lists";
import { supabase } from "@/lib/supabase/client";

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const inputRef = useRef<TextInput>(null);

  const [list, setList] = useState<SharedListWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!id) return;
    const data = await getSharedListWithDetails(id);
    setList(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = subscribeToListItems(id!, load);
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onAddItem() {
    if (!draft.trim() || !id) return;
    setAdding(true);
    try {
      await addListItem({ listId: id, userId: myUserId, text: draft.trim() });
      setDraft("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function onToggle(item: ListItem) {
    await toggleListItem({ itemId: item.id, userId: myUserId, checked: !item.checked });
    setList((prev) => prev ? {
      ...prev,
      items: prev.items.map((i) => i.id === item.id ? { ...i, checked: !item.checked, checked_by: !item.checked ? myUserId : null } : i),
      checked_count: prev.items.filter((i) => i.id === item.id ? !item.checked : i.checked).length,
    } : prev);
  }

  async function onDelete(itemId: string) {
    await deleteListItem(itemId);
    setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId), item_count: prev.item_count - 1 } : prev);
  }

  if (loading || !list) {
    return (
      <SafeAreaView className="flex-1 bg-shell items-center justify-center">
        <ActivityIndicator color="#F5E8D3" />
      </SafeAreaView>
    );
  }

  const total = list.items.length;
  const done = list.items.filter((i) => i.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isOwner = list.user_id === myUserId;

  const unchecked = list.items.filter((i) => !i.checked);
  const checked = list.items.filter((i) => i.checked);

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

            {/* Header */}
            <View className="flex-row items-center mb-4 gap-3">
              <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
                <Ionicons name="arrow-back" color="#F5E8D3" size={22} />
              </Pressable>
              <Text style={{ fontSize: 28 }}>{list.emoji}</Text>
              <Text className="text-cream font-bold text-xl flex-1" numberOfLines={2}>{list.title}</Text>
            </View>

            {/* Progress */}
            {total > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-cream-soft text-xs">{done} van {total} gedaan</Text>
                  <Text className="text-cream-soft text-xs font-bold">{pct}%</Text>
                </View>
                <View className="h-2 bg-paper rounded-full overflow-hidden">
                  <View className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                </View>
              </View>
            )}

            {/* Members */}
            <View className="flex-row items-center gap-1.5 mb-5">
              {[list.author, ...list.members].filter(Boolean).map((p, i) => (
                <Avatar key={p!.id} name={p!.display_name ?? p!.username} avatarUrl={p!.avatar_url ?? null} size="xs" lastSeenAt={p!.last_seen_at} />
              ))}
            </View>

            {/* Items — unchecked first */}
            <View className="gap-2 mb-4">
              {unchecked.map((item) => (
                <ItemRow key={item.id} item={item} onToggle={() => onToggle(item)} onDelete={() => onDelete(item.id)} canDelete={isOwner || item.user_id === myUserId} />
              ))}
            </View>

            {/* Checked items */}
            {checked.length > 0 && (
              <View>
                <Text className="text-ink-muted text-xs uppercase tracking-wider mb-2">Gedaan</Text>
                <View className="gap-2 opacity-60">
                  {checked.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={() => onToggle(item)} onDelete={() => onDelete(item.id)} canDelete={isOwner || item.user_id === myUserId} />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Add item bar */}
          <View className="absolute bottom-0 left-0 right-0 bg-shell border-t border-line px-4 py-3 flex-row items-center gap-3">
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Voeg item toe…"
              placeholderTextColor="#6B5E4E"
              returnKeyType="done"
              onSubmitEditing={onAddItem}
              className="flex-1 bg-paper-soft rounded-full px-4 py-2.5 text-ink text-sm"
              style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
            />
            <Pressable
              onPress={onAddItem}
              disabled={!draft.trim() || adding}
              className={`w-10 h-10 rounded-full items-center justify-center ${draft.trim() ? "bg-flame" : "bg-paper-soft"}`}
            >
              {adding ? <ActivityIndicator size="small" color="#F5E8D3" /> : <Ionicons name="add" color={draft.trim() ? "#F5E8D3" : "#8A7E6C"} size={20} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function ItemRow({ item, onToggle, onDelete, canDelete }: { item: ListItem; onToggle: () => void; onDelete: () => void; canDelete: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3 rounded-2xl ${item.checked ? "bg-paper-soft/50" : "bg-paper-soft"}`}>
      <Pressable onPress={onToggle} className={`w-5 h-5 rounded-full border-2 items-center justify-center ${item.checked ? "bg-teal-500 border-teal-500" : "border-ink-muted"}`}>
        {item.checked && <Ionicons name="checkmark" color="#fff" size={11} />}
      </Pressable>
      <Text className={`flex-1 text-sm ${item.checked ? "text-ink-muted line-through" : "text-ink"}`}>
        {item.text}
      </Text>
      {canDelete && (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" color="#8A7E6C" size={15} />
        </Pressable>
      )}
    </View>
  );
}
