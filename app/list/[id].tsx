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
import { DetailState } from "@/components/DetailState";
import { IconButton } from "@/components/IconButton";
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
import { confirm } from "@/lib/confirm";
import { safeBack } from "@/lib/nav";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast";
import { creamOnDark, desk, feed } from "@/lib/design/type";

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const inputRef = useRef<TextInput>(null);

  const [list, setList] = useState<SharedListWithDetails | null>(null);
  /**
   * Drie standen, geen booleaan. `loading` alleen kon niet uitdrukken dat
   * het ophalen *mislukt* was: `load()` had geen `catch`, dus een fout liet
   * `setLoading(false)` nooit lopen en de spinner draaide tot je de app
   * afsloot — zonder terug-knop, want die tak tekende alleen een spinner.
   * Zie components/DetailState.tsx.
   */
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading"
  );
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function load() {
    if (!id) return;
    try {
      const data = await getSharedListWithDetails(id);
      setList(data);
      setStatus(data ? "ready" : "missing");
    } catch (e) {
      setError(e);
      setStatus("error");
    }
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
    const text = draft.trim();
    try {
      await addListItem({ listId: id, userId: myUserId, text });
      setDraft("");
      await load();
    } catch {
      toast.error("Item niet toegevoegd.", {
        action: { label: "Opnieuw", onPress: () => void onAddItem() },
      });
    } finally {
      setAdding(false);
    }
  }

  /**
   * Afvinken. Het vinkje verschuift meteen en de server volgt — andersom
   * voelt een boodschappenlijst traag. Faalt hij, dan gaat het vinkje
   * terug én staat er wát er misging: een vinkje dat uit zichzelf
   * terugspringt leest als een kapotte app (§4b).
   */
  function applyToggle(itemId: string, checked: boolean) {
    setList((prev) => prev ? {
      ...prev,
      items: prev.items.map((i) => i.id === itemId ? { ...i, checked, checked_by: checked ? myUserId : null } : i),
      checked_count: prev.items.filter((i) => i.id === itemId ? checked : i.checked).length,
    } : prev);
  }

  async function onToggle(item: ListItem) {
    const next = !item.checked;
    applyToggle(item.id, next);
    try {
      await toggleListItem({ itemId: item.id, userId: myUserId, checked: next });
    } catch {
      applyToggle(item.id, item.checked);
      toast.error(next ? "Afvinken lukte niet." : "Vinkje weghalen lukte niet.", {
        action: { label: "Opnieuw", onPress: () => void onToggle(item) },
      });
    }
  }

  async function onDelete(itemId: string) {
    const item = list?.items.find((i) => i.id === itemId);
    if (!item) return;
    const ok = await confirm(
      "Item verwijderen?",
      `"${item.text}" verdwijnt voor iedereen op deze lijst.`,
      { affirmativeLabel: "Verwijder", destructive: true }
    );
    if (!ok) return;

    const index = list?.items.findIndex((i) => i.id === itemId) ?? -1;
    setList((prev) => prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId), item_count: prev.item_count - 1 } : prev);
    try {
      await deleteListItem(itemId);
    } catch {
      // Terug op zijn eigen plek — een item dat na een mislukte
      // verwijdering onderaan opduikt leest als een tweede fout.
      setList((prev) => {
        if (!prev || prev.items.some((i) => i.id === itemId)) return prev;
        const items = [...prev.items];
        items.splice(index < 0 ? items.length : index, 0, item);
        return { ...prev, items, item_count: prev.item_count + 1 };
      });
      toast.error("Item niet verwijderd.", {
        action: { label: "Opnieuw", onPress: () => void onDelete(itemId) },
      });
    }
  }

  if (status !== "ready" || !list) {
    return (
      <DetailState
        kind={status === "ready" ? "missing" : status}
        subject="Deze lijst"
        error={error}
        onRetry={() => {
          setStatus("loading");
          void load();
        }}
        backLabel="Terug"
        onBack={() => safeBack(router, "/(app)/chats")}
      />
    );
  }

  const total = list.items.length;
  const done = list.items.filter((i) => i.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isOwner = list.user_id === myUserId;

  const unchecked = list.items.filter((i) => !i.checked);
  const checked = list.items.filter((i) => i.checked);

  return (
    <SafeAreaView className="flex-1 bg-desk" edges={["top"]}>
      <ScreenContainer>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>

            {/* Header */}
            <View className="flex-row items-center mb-4 gap-3">
              <Pressable
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Terug"
                onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
                <Ionicons name="arrow-back" color={desk.ink} size={22} />
              </Pressable>
              <Text style={{ fontSize: 28 }}>{list.emoji}</Text>
              <Text className="text-desk-ink font-bold text-xl flex-1" numberOfLines={2}>{list.title}</Text>
            </View>

            {/* Progress */}
            {total > 0 && (
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-1.5">
                  <Text className="text-desk-soft text-xs">{done} van {total} gedaan</Text>
                  <Text className="text-desk-soft text-xs font-bold">{pct}%</Text>
                </View>
                <View className="h-2 bg-paper overflow-hidden">
                  <View className="h-full bg-teal-500" style={{ width: `${pct}%` }} />
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
          <View className="absolute bottom-0 left-0 right-0 bg-desk border-t border-line px-4 py-3 flex-row items-center gap-3">
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Voeg item toe…"
              placeholderTextColor={feed.inkDim}
              returnKeyType="done"
              onSubmitEditing={onAddItem}
              className="flex-1 bg-paper-soft px-4 py-2.5 text-ink text-sm"
              style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
            />
            <Pressable
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Item toevoegen"
              onPress={onAddItem}
              disabled={!draft.trim() || adding}
              className={`w-10 h-10 items-center justify-center ${draft.trim() ? "bg-flame" : "bg-paper-soft"}`}
            >
              {adding ? <ActivityIndicator size="small" color={creamOnDark.DEFAULT} /> : <Ionicons name="add" color={draft.trim() ? creamOnDark.DEFAULT : feed.inkDim} size={20} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function ItemRow({ item, onToggle, onDelete, canDelete }: { item: ListItem; onToggle: () => void; onDelete: () => void; canDelete: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3 ${item.checked ? "bg-paper-soft/50" : "bg-paper-soft"}`}>
      <Pressable
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.text} — ${
          item.checked ? "vinkje weghalen" : "afvinken"
        }`}
        onPress={onToggle} className={`w-5 h-5 border-2 items-center justify-center ${item.checked ? "bg-teal-500 border-teal-500" : "border-ink-muted"}`}>
        {item.checked && <Ionicons name="checkmark" color="#fff" size={11} />}
      </Pressable>
      <Text className={`flex-1 text-sm ${item.checked ? "text-ink-muted line-through" : "text-ink"}`}>
        {item.text}
      </Text>
      {canDelete && (
        <IconButton
          name="trash-outline"
          label="Item verwijderen"
          onPress={onDelete}
          size={15}
          color={feed.inkDim}
          dense
        />
      )}
    </View>
  );
}
