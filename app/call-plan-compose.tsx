import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar } from "@/components/Avatar";
import { Button, Field, labelStyle, Note, Section, SubPage, titleStyle } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { createCallPlan } from "@/lib/api/call-plans";
import { sendMessage } from "@/lib/api/messages";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";
import { color, friendColor, hueFor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { safeBack } from "@/lib/nav";
import { NL } from "@/lib/locale";
import { usePageTitle } from "@/lib/page-title";

/**
 * Een videocall plannen, in de vorm van het thema
 * (components/lincin/SubPage). Vanuit een chat in de kleur van die chat.
 *
 * Onderwerp en toelichting, dan de tijdsloten als tabs: het actieve slot
 * kies je met een datum (de dag in de kleur van de pagina) en een
 * begintijd. Onderaan wie je uitnodigt — een gekozen vriend krijgt een
 * ring en een vinkje in zijn eigen kleur.
 */

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
      label: d.toLocaleDateString(NL, { weekday: "long", day: "numeric", month: "long" }),
      short: d.toLocaleDateString(NL, { weekday: "short", day: "numeric", month: "short" }),
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
  usePageTitle("Videocall plannen");
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
        chatId: chatId ?? null,
      });
      if (chatId) {
        await sendMessage({ chatId, senderId: myUserId, call_plan_id: plan.id, text: `📅 ${plan.title}` });
        await qc.invalidateQueries({ queryKey: ["messages", chatId] });
      } else {
        await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
      }
      safeBack(router, chatId ? `/chat/${chatId}` : "/(app)/feed");
    } catch (e: any) {
      setError(e.message ?? "Er ging iets mis.");
    } finally {
      setSubmitting(false);
    }
  }

  const hue = hueFor(chatId);

  return (
    <SubPage
      title={chatId ? "Call plannen in chat" : "Videocall plannen"}
      kicker="Videocall"
      sub="Stel een paar momenten voor; de anderen kiezen."
      back={chatId ? `/chat/${chatId}` : "/(app)/feed"}
      tab={chatId ? "chats" : "feed"}
      hue={hue}
      keyboard
    >
      <Section label="Onderwerp" pad>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Onderwerp, bijv. Catch-up"
        />
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="Toelichting (optioneel)"
          multiline
        />
      </Section>

      {/* Tijdsloten — tabbladen */}
      <Section
        label={`Tijdsloten · ${slots.length}`}
        action={slots.length < 8 ? { label: "Voeg toe", icon: "add", onPress: addSlot } : undefined}
        pad
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {slots.map((slot) => {
            const active = slot.id === activeSlotId;
            return (
              <Chip
                key={slot.id}
                selected={active}
                onPress={() => setActiveSlotId(slot.id)}
                trailing={
                  slots.length > 1 ? (
                    <Pressable
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Dit tijdslot verwijderen"
                      onPress={() => removeSlot(slot.id)}
                    >
                      <Ionicons name="close-circle" size={15} color={active ? color("paper") : color("ink", "inkDim")} />
                    </Pressable>
                  ) : null
                }
              >
                {slot.date.toLocaleDateString(NL, { weekday: "short", day: "numeric", month: "short" })} · {slot.startHour}:00
              </Chip>
            );
          })}
        </ScrollView>
      </Section>

      {/* Datum — volgende 28 dagen */}
      <Section label="Datum" pad>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {DAY_OPTIONS.map((opt) => (
            <DayTile
              key={opt.date.toISOString()}
              date={opt.date}
              hue={hue}
              selected={isSameDay(activeSlot.date, opt.date)}
              onPress={() => updateActive({ date: new Date(opt.date) })}
            />
          ))}
        </ScrollView>
      </Section>

      {/* Begintijd */}
      <Section label="Begintijd" pad>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {HOUR_OPTIONS.map((h) => (
            <Chip key={h} selected={activeSlot.startHour === h} onPress={() => updateActive({ startHour: h })}>
              {`${h}:00`}
            </Chip>
          ))}
        </ScrollView>
        <Note>Duurt 1 uur · eindigt om {activeSlot.startHour + 1}:00</Note>
      </Section>

      {/* Uitnodigen — enkel zichtbaar als je vrienden hebt */}
      {friends.length > 0 && (
        <Section label={invitedIds.length > 0 ? `Uitnodigen · ${invitedIds.length}` : "Uitnodigen"} pad>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 4 }}>
            {friends.map((f) => {
              const p = f.other;
              const selected = invitedIds.includes(p.id);
              return (
                <PersonChip
                  key={p.id}
                  friend={f}
                  selected={selected}
                  onPress={() =>
                    setInvitedIds((prev) =>
                      selected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                    )
                  }
                />
              );
            })}
          </ScrollView>
          {invitedIds.length > 0 && (
            <Note>
              {invitedIds.length} {invitedIds.length === 1 ? "persoon" : "personen"} uitgenodigd · anderen zien deze call niet
            </Note>
          )}
        </Section>
      )}

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label={chatId ? "Versturen" : "Plaatsen"}
        tone="primary"
        icon="videocam-outline"
        busy={submitting}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </SubPage>
  );
}

/**
 * Een keuze in een rij: een tijdslot, een uur. Gekozen in inkt. Een kader
 * zonder ronding in kleur, een pil in magazine en modern.
 */
function Chip({
  selected,
  onPress,
  trailing,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: th === "kleur" ? 0 : 999,
        borderWidth: th === "kleur" ? spec.border : 1,
        borderColor: selected ? ink : th === "kleur" ? ink : color("ink", "postRule"),
        backgroundColor: selected ? ink : pressed ? color("ink", "postRule") : "transparent",
      })}
    >
      <Text numberOfLines={1} style={labelStyle(th, 9.5, selected ? color("paper") : ink)}>
        {children}
      </Text>
      {trailing}
    </Pressable>
  );
}

/** Een dag om te kiezen: gekozen in de kleur van de pagina. */
function DayTile({ date, hue, selected, onPress }: { date: Date; hue: Hue; selected: boolean; onPress: () => void }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const fc = friendColor(hue, useScheme());
  const fg = selected ? fc.ink : color("ink");
  const dim = selected ? fc.ink : color("ink", "inkDim");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={date.toLocaleDateString(NL, { weekday: "long", day: "numeric", month: "long" })}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 54,
        paddingHorizontal: 8,
        paddingVertical: 8,
        alignItems: "center",
        gap: 2,
        borderRadius: th === "modern" ? 14 : 0,
        borderWidth: th === "kleur" ? spec.border : selected ? 0 : 1,
        borderColor: th === "kleur" ? color("ink") : color("ink", "postRule"),
        backgroundColor: selected ? fc.fill : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={labelStyle(th, 8.5, dim)}>{date.toLocaleDateString(NL, { weekday: "short" })}</Text>
      <Text style={titleStyle(th, 22, fg)}>{date.getDate()}</Text>
      <Text style={labelStyle(th, 8, dim)}>{date.toLocaleDateString(NL, { month: "short" })}</Text>
    </Pressable>
  );
}

/**
 * Een vriend om uit te nodigen: zijn avatar met de naam eronder. Gekozen
 * krijgt hij een ring en een vinkje in zijn eigen vriendkleur.
 */
function PersonChip({ friend, selected, onPress }: { friend: FriendshipWithProfile; selected: boolean; onPress: () => void }) {
  const th = useThemeSpec().id;
  const fc = friendColor(hueFor(friend.other.id), useScheme());
  const name = friend.other.display_name ?? friend.other.username;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", gap: 6, width: 60, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ padding: 2, borderRadius: 999, borderWidth: 2, borderColor: selected ? fc.fill : "transparent" }}>
        <Avatar name={name} avatarUrl={friend.other.avatar_url ?? null} size="md" />
      </View>
      {selected ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 4,
            width: 18,
            height: 18,
            borderRadius: th === "kleur" ? 0 : 9,
            backgroundColor: fc.fill,
            borderWidth: 1.5,
            borderColor: th === "kleur" ? color("ink") : color("paper"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="checkmark" color={fc.ink} size={11} />
        </View>
      ) : null}
      <Text numberOfLines={1} style={[labelStyle(th, 8.5, selected ? color("ink") : color("ink", "inkDim")), { maxWidth: 60, textAlign: "center" }]}>
        {name}
      </Text>
    </Pressable>
  );
}
