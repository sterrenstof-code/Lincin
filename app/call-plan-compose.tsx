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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { createCallPlan } from "@/lib/api/call-plans";
import { sendMessage } from "@/lib/api/messages";

type SlotDraft = {
  id: string;
  dayOffset: number;   // 0 = vandaag, 1 = morgen, 2 = overmorgen, etc.
  startHour: number;
  endHour: number;
};

const DAY_OPTIONS = [
  { offset: 1, label: "Morgen" },
  { offset: 2, label: "Overmorgen" },
  { offset: 3, label: "Over 3 dagen" },
  { offset: 5, label: "Over 5 dagen" },
  { offset: 7, label: "Over 1 week" },
  { offset: 14, label: "Over 2 weken" },
];

const HOUR_OPTIONS = [17, 18, 19, 20, 21, 22];

function newSlot(offset: number = 1): SlotDraft {
  return {
    id: Math.random().toString(36).slice(2),
    dayOffset: offset,
    startHour: 19,
    endHour: 21,
  };
}

function slotToDate(slot: SlotDraft): { starts_at: Date; ends_at: Date } {
  const start = new Date();
  start.setDate(start.getDate() + slot.dayOffset);
  start.setHours(slot.startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(slot.endHour, 0, 0, 0);
  return { starts_at: start, ends_at: end };
}

function formatSlotLabel(slot: SlotDraft): string {
  const d = new Date();
  d.setDate(d.getDate() + slot.dayOffset);
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" });
}

export default function CallPlanComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  // chatId is optioneel — als het er is sturen we het plan als chat-bericht
  const { chatId } = useLocalSearchParams<{ chatId?: string }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([newSlot(1), newSlot(2)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !submitting && title.trim().length > 0 && slots.length > 0;

  function addSlot() {
    if (slots.length >= 8) return;
    const usedOffsets = new Set(slots.map((s) => s.dayOffset));
    const nextOffset = DAY_OPTIONS.find((d) => !usedOffsets.has(d.offset))?.offset ?? slots.length + 1;
    setSlots([...slots, newSlot(nextOffset)]);
  }

  function removeSlot(id: string) {
    if (slots.length <= 1) return;
    setSlots(slots.filter((s) => s.id !== id));
  }

  function updateSlot(id: string, patch: Partial<SlotDraft>) {
    setSlots(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
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
        slots: slots.map(slotToDate),
      });

      // Als vanuit een chat: stuur het plan als bericht
      if (chatId) {
        await sendMessage({
          chatId,
          senderId: myUserId,
          call_plan_id: plan.id,
          text: `📅 ${plan.title}`,
        });
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
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenContainer>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
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

            {/* Onderwerp */}
            <Text className="text-cream-soft text-xs uppercase tracking-wider mb-2">Onderwerp</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Bijv. Wekelijkse catch-up"
              placeholderTextColor="#6B5E4E"
              className="bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base mb-4"
              style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
            />

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Toelichting (optioneel)"
              placeholderTextColor="#6B5E4E"
              multiline
              className="bg-paper-soft rounded-2xl px-4 py-3 text-ink text-base mb-6"
              style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
            />

            {/* Tijdsloten */}
            <Text className="text-cream-soft text-xs uppercase tracking-wider mb-2">Tijdsloten</Text>
            <Text className="text-ink-muted text-sm mb-3">
              Stel meerdere opties in — iedereen stemt op wanneer ze kunnen.
            </Text>

            <View className="gap-3 mb-3">
              {slots.map((slot, i) => (
                <View key={slot.id} className="bg-paper-soft rounded-2xl p-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-ink font-semibold text-sm">Optie {i + 1}</Text>
                    {slots.length > 1 && (
                      <Pressable onPress={() => removeSlot(slot.id)}>
                        <Ionicons name="close-circle-outline" color="#8A7E6C" size={20} />
                      </Pressable>
                    )}
                  </View>

                  {/* Dag kiezen */}
                  <View className="mb-3">
                    <Text className="text-ink-muted text-xs mb-2">Dag</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                      {DAY_OPTIONS.map((d) => (
                        <Pressable
                          key={d.offset}
                          onPress={() => updateSlot(slot.id, { dayOffset: d.offset })}
                          className={`px-3 py-1.5 rounded-full ${slot.dayOffset === d.offset ? "bg-flame" : "bg-paper"}`}
                        >
                          <Text className={`text-xs font-semibold ${slot.dayOffset === d.offset ? "text-cream" : "text-ink-muted"}`}>
                            {d.label}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Text className="text-ink-muted text-xs mt-1.5">{formatSlotLabel(slot)}</Text>
                  </View>

                  {/* Begintijd */}
                  <View className="mb-2">
                    <Text className="text-ink-muted text-xs mb-2">Begintijd</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {HOUR_OPTIONS.map((h) => (
                        <Pressable
                          key={h}
                          onPress={() => updateSlot(slot.id, { startHour: h, endHour: Math.max(h + 1, slot.endHour) })}
                          className={`px-3 py-1.5 rounded-full ${slot.startHour === h ? "bg-ink" : "bg-paper"}`}
                        >
                          <Text className={`text-xs font-semibold ${slot.startHour === h ? "text-cream" : "text-ink-muted"}`}>
                            {h}:00
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Eindtijd */}
                  <View>
                    <Text className="text-ink-muted text-xs mb-2">Eindtijd</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {HOUR_OPTIONS.filter((h) => h > slot.startHour).map((h) => (
                        <Pressable
                          key={h}
                          onPress={() => updateSlot(slot.id, { endHour: h })}
                          className={`px-3 py-1.5 rounded-full ${slot.endHour === h ? "bg-ink" : "bg-paper"}`}
                        >
                          <Text className={`text-xs font-semibold ${slot.endHour === h ? "text-cream" : "text-ink-muted"}`}>
                            {h}:00
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {slots.length < 8 && (
              <Pressable
                onPress={addSlot}
                className="flex-row items-center gap-2 py-3 px-4 bg-paper-soft rounded-2xl mb-6"
              >
                <Ionicons name="add-circle-outline" color="#8A7E6C" size={18} />
                <Text className="text-ink-muted text-sm">Tijdslot toevoegen</Text>
              </Pressable>
            )}

            {error && <Text className="text-red-400 text-sm">{error}</Text>}
          </ScrollView>
        </ScreenContainer>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
