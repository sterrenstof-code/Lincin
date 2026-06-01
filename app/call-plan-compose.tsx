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
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { createCallPlan } from "@/lib/api/call-plans";

type SlotDraft = {
  id: string;
  date: Date;
  startHour: number;
  endHour: number;
};

function newSlot(): SlotDraft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  return {
    id: Math.random().toString(36).slice(2),
    date: tomorrow,
    startHour: 19,
    endHour: 21,
  };
}

export default function CallPlanComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>([newSlot()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<{ id: string; mode: "date" | "time-start" | "time-end" } | null>(null);

  const canSubmit = !submitting && title.trim().length > 0 && slots.length > 0;

  function addSlot() {
    if (slots.length >= 8) return;
    setSlots([...slots, newSlot()]);
  }

  function removeSlot(id: string) {
    if (slots.length <= 1) return;
    setSlots(slots.filter((s) => s.id !== id));
  }

  function updateSlot(id: string, patch: Partial<SlotDraft>) {
    setSlots(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function slotToDateTimes(slot: SlotDraft): { starts_at: Date; ends_at: Date } {
    const start = new Date(slot.date);
    start.setHours(slot.startHour, 0, 0, 0);
    const end = new Date(slot.date);
    end.setHours(slot.endHour, 0, 0, 0);
    return { starts_at: start, ends_at: end };
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCallPlan({
        userId: myUserId,
        title: title.trim(),
        description: description.trim() || null,
        slots: slots.map(slotToDateTimes),
      });
      await qc.invalidateQueries({ queryKey: ["unified-feed"] });
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
              <Text className="text-cream font-bold text-lg">Videocall plannen</Text>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-full ${canSubmit ? "bg-flame" : "bg-paper"}`}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#F5E8D3" />
                  : <Text className={`font-semibold text-sm ${canSubmit ? "text-cream" : "text-ink-muted"}`}>Versturen</Text>
                }
              </Pressable>
            </View>

            {/* Titel */}
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
            <Text className="text-ink-muted text-sm mb-3">Stel meerdere opties in — iedereen stemt op wanneer ze kunnen.</Text>

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

                  {/* Datum */}
                  <View className="flex-row items-center gap-3 mb-2">
                    <Ionicons name="calendar-outline" color="#8A7E6C" size={16} />
                    {Platform.OS !== "web" ? (
                      <DateTimePicker
                        value={slot.date}
                        mode="date"
                        display="compact"
                        minimumDate={new Date()}
                        onChange={(_, d) => d && updateSlot(slot.id, { date: d })}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <Text className="text-ink text-sm">
                        {slot.date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}
                      </Text>
                    )}
                  </View>

                  {/* Tijden */}
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="time-outline" color="#8A7E6C" size={16} />
                    <View className="flex-row items-center gap-2 flex-1">
                      {/* Start uur — simpele knoppen */}
                      {[18, 19, 20, 21, 22].map((h) => (
                        <Pressable
                          key={h}
                          onPress={() => updateSlot(slot.id, { startHour: h, endHour: Math.max(h + 1, slot.endHour) })}
                          className={`px-2 py-1 rounded-lg ${slot.startHour === h ? "bg-flame" : "bg-paper"}`}
                        >
                          <Text className={`text-xs font-semibold ${slot.startHour === h ? "text-cream" : "text-ink-muted"}`}>
                            {h}:00
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-3 mt-2 ml-6">
                    <Text className="text-ink-muted text-xs">tot</Text>
                    {[slot.startHour + 1, slot.startHour + 2, slot.startHour + 3].map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => updateSlot(slot.id, { endHour: h })}
                        className={`px-2 py-1 rounded-lg ${slot.endHour === h ? "bg-ink" : "bg-paper"}`}
                      >
                        <Text className={`text-xs font-semibold ${slot.endHour === h ? "text-cream" : "text-ink-muted"}`}>
                          {h}:00
                        </Text>
                      </Pressable>
                    ))}
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
