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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth/provider";
import { createCallPlan } from "@/lib/api/call-plans";
import { sendMessage } from "@/lib/api/messages";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";

type SlotDraft = {
  id: string;
  date: Date;       // concrete datum
  startHour: number;
};

// Genereer de volgende N dagen als keuze-opties
function buildDayOptions(n = 28): { date: Date; label: string; short: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return {
      date: new Date(d),
      label: d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" }),
      short: d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }),
    };
  });
}

const DAY_OPTIONS = buildDayOptions(28);
const HOUR_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function newSlot(): SlotDraft {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return { id: Math.random().toString(36).slice(2), date: new Date(d), startHour: 19 };
}

function slotToDateTimes(slot: SlotDraft): { starts_at: Date; ends_at: Date } {
  const start = new Date(slot.date);
  start.setHours(slot.startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(slot.startHour + 1, 0, 0, 0);
  return { starts_at: start, ends_at: end };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function CallPlanComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { chatId } = useLocalSearchParams<{ chatId?: string }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([newSlot()]);
  const [activeSlotId, setActiveSlotId] = useState<string>(slots[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);

  useEffect(() => {
    listMyFriendships(myUserId).then((fs) =>
      setFriends(fs.filter((f) => f.status === "accepted"))
    );
  }, [myUserId]);

  const canSubmit = !submitting && title.trim().length > 0 && slots.length > 0;
  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? slots[0];

  function addSlot() {
    if (slots.length >= 8) return;
    const s = newSlot();
    setSlots([...slots, s]);
    setActiveSlotId(s.id);
  }

  function removeSlot(id: string) {
    if (slots.length <= 1) return;
    const remaining = slots.filter((s) => s.id !== id);
    setSlots(remaining);
    if (activeSlotId === id) setActiveSlotId(remaining[0].id);
  }

  function updateActive(patch: Partial<SlotDraft>) {
    setSlots(slots.map((s) => (s.id === activeSlotId ? { ...s, ...patch } : s)));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const plan = await createCallPlan({
        userId: myUserId,
        title: title.trim(),
        description: description.trim() || null,
        slots: slots.map(slotToDateTimes),
        inviteeIds: invitedIds.length > 0 ? invitedIds : undefined,
      });
      if (chatId) {
        await sendMessage({ chatId, senderId: myUserId, call_plan_id: plan.id, text: `📅 ${plan.title}` });
        await qc.invalidateQueries({ queryKey: ["messages", chatId] });
      } else {
        await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
      }
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
              <Text className="text-cream font-bold text-lg">
                {chatId ? "Call plannen in chat" : "Videocall plannen"}
              </Text>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-full ${canSubmit ? "bg-flame" : "bg-paper"}`}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#F5E8D3" />
                  : <Text className={`font-semibold text-sm ${canSubmit ? "text-cream" : "text-ink-muted"}`}>
                      {chatId ? "Versturen" : "Plaatsen"}
                    </Text>
                }
              </Pressable>
            </View>

            <View className="px-5 gap-4">
              {/* Titel */}
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Onderwerp, bijv. Catch-up"
                placeholderTextColor="#6B5E4E"
                className="bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base"
                style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Toelichting (optioneel)"
                placeholderTextColor="#6B5E4E"
                multiline
                className="bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base"
                style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
              />
            </View>

            {/* Tijdsloten — tabbladen */}
            <View className="mt-5 px-5">
              <Text className="text-cream-soft text-xs uppercase tracking-wider mb-3">Tijdsloten</Text>

              {/* Slot tabs */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                {slots.map((slot, i) => {
                  const active = slot.id === activeSlotId;
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => setActiveSlotId(slot.id)}
                      className={`flex-row items-center gap-1.5 px-4 py-2 rounded-full border ${active ? "bg-cream border-cream" : "bg-paper-soft border-paper-soft"}`}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-ink" : "text-ink-muted"}`}>
                        {slot.date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })} · {slot.startHour}:00
                      </Text>
                      {slots.length > 1 && (
                        <Pressable onPress={() => removeSlot(slot.id)} hitSlop={8}>
                          <Ionicons name="close-circle" color={active ? "#5A4F40" : "#8A7E6C"} size={14} />
                        </Pressable>
                      )}
                    </Pressable>
                  );
                })}
                {slots.length < 8 && (
                  <Pressable onPress={addSlot} className="flex-row items-center gap-1.5 px-4 py-2 rounded-full bg-paper-soft border border-paper-soft">
                    <Ionicons name="add" color="#8A7E6C" size={16} />
                    <Text className="text-ink-muted text-sm font-semibold">Voeg toe</Text>
                  </Pressable>
                )}
              </ScrollView>

              {/* Datum-grid — volgende 28 dagen */}
              <View className="bg-paper-soft rounded-3xl p-4 mb-4">
                <Text className="text-ink-muted text-xs mb-3">Datum</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {DAY_OPTIONS.map((opt) => {
                    const selected = isSameDay(activeSlot.date, opt.date);
                    return (
                      <Pressable
                        key={opt.date.toISOString()}
                        onPress={() => updateActive({ date: new Date(opt.date) })}
                        className={`items-center px-3 py-2 rounded-2xl min-w-[52px] ${selected ? "bg-flame" : "bg-paper"}`}
                      >
                        <Text className={`text-[10px] font-semibold uppercase ${selected ? "text-cream/80" : "text-ink-muted"}`}>
                          {opt.date.toLocaleDateString("nl-NL", { weekday: "short" })}
                        </Text>
                        <Text className={`text-base font-bold mt-0.5 ${selected ? "text-cream" : "text-ink"}`}>
                          {opt.date.getDate()}
                        </Text>
                        <Text className={`text-[9px] ${selected ? "text-cream/70" : "text-ink-muted"}`}>
                          {opt.date.toLocaleDateString("nl-NL", { month: "short" })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Begintijd */}
              <View className="bg-paper-soft rounded-3xl p-4">
                <Text className="text-ink-muted text-xs mb-3">Begintijd</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {HOUR_OPTIONS.map((h) => {
                    const selected = activeSlot.startHour === h;
                    return (
                      <Pressable
                        key={h}
                        onPress={() => updateActive({ startHour: h })}
                        className={`px-4 py-2 rounded-full ${selected ? "bg-ink" : "bg-paper"}`}
                      >
                        <Text className={`text-sm font-semibold ${selected ? "text-cream" : "text-ink-muted"}`}>
                          {h}:00
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text className="text-ink-muted text-xs mt-2">
                  Duurt 1 uur · eindigt om {activeSlot.startHour + 1}:00
                </Text>
              </View>
            </View>

            {/* Uitnodigen — enkel zichtbaar als je vrienden hebt */}
            {friends.length > 0 && (
              <View className="mt-5 px-5">
                <Text className="text-cream-soft text-xs uppercase tracking-wider mb-3">
                  Uitnodigen
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {friends.map((f) => {
                    const p = f.other;
                    const selected = invitedIds.includes(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() =>
                          setInvitedIds((prev) =>
                            selected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )
                        }
                        className="items-center gap-1.5"
                      >
                        <View className={`rounded-full p-0.5 ${selected ? "bg-flame" : "bg-transparent"}`}>
                          <Avatar
                            name={p.display_name ?? p.username}
                            avatarUrl={p.avatar_url ?? null}
                            size="md"
                          />
                        </View>
                        <Text className={`text-[11px] font-semibold max-w-[56px] text-center ${selected ? "text-flame" : "text-cream-soft"}`} numberOfLines={1}>
                          {p.display_name ?? p.username}
                        </Text>
                        {selected && (
                          <View className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-flame rounded-full items-center justify-center">
                            <Ionicons name="checkmark" color="#F5E8D3" size={10} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {invitedIds.length > 0 && (
                  <Text className="text-cream-soft text-xs mt-2">
                    {invitedIds.length} {invitedIds.length === 1 ? "persoon" : "personen"} uitgenodigd · anderen zien deze call niet
                  </Text>
                )}
              </View>
            )}

            {error && <Text className="text-red-400 text-sm px-5 mt-3">{error}</Text>}
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
