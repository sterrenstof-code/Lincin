import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { Avatar } from "@/components/Avatar";
import { bodyStyle, Button, Field, labelStyle, ListRow, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { createGroupChat } from "@/lib/api/chats";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";
import { color, friendColor, hueFor, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, sans, serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

/**
 * Nieuwe groep, in de vorm van het thema (components/lincin/SubPage) —
 * een broer van Groep info (app/group/[id].tsx).
 *
 * Bovenaan de naam, daaronder je vrienden als rijen. Wie je aanvinkt
 * krijgt zijn eigen kleur: een gevulde schijf (kleur: een vierkant) in
 * zijn vriendkleur, en in magazine kleurt de hele rij mee. Onderaan
 * Aanmaken. Groepen zijn groen (README §01).
 */

export default function GroupCreateScreen() {
  usePageTitle("Nieuwe groep");
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const accepted = useMemo(
    () => (friendships.data ?? []).filter((f) => f.status === "accepted"),
    [friendships.data]
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const trimmedName = name.trim();
  const canSubmit =
    !submitting && trimmedName.length > 0 && selectedIds.size >= 1;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const chatId = await createGroupChat(trimmedName, Array.from(selectedIds));
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      router.replace(`/chat/${chatId}`);
    } catch (e: any) {
      setError(e?.message ?? "Kon groep niet aanmaken.");
    } finally {
      setSubmitting(false);
    }
  }

  const th = useThemeSpec().id;

  return (
    <SubPage
      title="Nieuwe groep"
      kicker="Groep"
      sub="Een naam en minstens één vriend."
      back="/(app)/chats"
      tab="chats"
      hue="green"
      keyboard
    >
      <Section pad>
        <Field
          label="Groepsnaam"
          hint="Iedereen in de groep ziet deze naam."
          value={name}
          onChangeText={setName}
          placeholder="bv. Vrijdagavondbende"
          maxLength={64}
          /* Het enige tekstveld op dit scherm, en Enter deed er niets.
             Met een toetsenbord moest je na het typen van de naam naar
             de muis om verder te komen. */
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canSubmit) void onSubmit();
          }}
        />
      </Section>

      <Section label={`Vrienden · ${selectedIds.size} geselecteerd`} pad={!friendships.isLoading && accepted.length === 0}>
        {friendships.isLoading ? (
          <ListRow title="Laden…" first />
        ) : accepted.length === 0 ? (
          <Text style={bodyStyle(th, 14, color("ink", "inkDim"))}>
            Je hebt nog geen geaccepteerde vrienden. Voeg eerst iemand toe in de Vrienden-tab.
          </Text>
        ) : (
          accepted.map((f, i) => (
            <PickRow key={f.id} friend={f} first={i === 0} checked={selectedIds.has(f.other.id)} onPress={() => toggle(f.other.id)} />
          ))
        )}
      </Section>

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label={submitting ? "Bezig…" : "Aanmaken"}
        tone="primary"
        icon="people-outline"
        busy={submitting}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </SubPage>
  );
}

/**
 * Een vriend om aan te vinken. Dezelfde maat en scheidingslijn als
 * `ListRow`, maar met een vinkje in de kleur van de vriend. Magazine zet
 * een gekozen rij helemaal in die kleur, met de inkt die erbij hoort.
 */
function PickRow({
  friend,
  first,
  checked,
  onPress,
}: {
  friend: FriendshipWithProfile;
  first: boolean;
  checked: boolean;
  onPress: () => void;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const scheme = useScheme();
  const fc = friendColor(hueFor(friend.other.id), scheme);
  const name = friend.other.display_name ?? friend.other.username;
  const band = th === "magazine" && checked;
  const ink = band ? fc.ink : color("ink");
  const dim = band ? fc.ink : color("ink", "inkDim");
  const rule: ViewStyle = first
    ? {}
    : th === "kleur"
      ? { borderTopWidth: spec.border, borderTopColor: color("ink") }
      : th === "magazine"
        ? { borderTopWidth: 1, borderTopColor: color("ink", "postRule") }
        : { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: color("ink", "dash") };
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: th === "magazine" ? 18 : 14,
        paddingVertical: 10,
        backgroundColor: band ? fc.fill : "transparent",
        opacity: pressed ? 0.75 : 1,
        ...rule,
      })}
    >
      <Avatar name={name} avatarUrl={friend.other.avatar_url} size="md" />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          numberOfLines={1}
          style={[
            th === "magazine"
              ? { ...serif(), fontSize: 21, lineHeight: 25 }
              : th === "modern"
                ? { ...sans(400), fontSize: 16, lineHeight: 20, letterSpacing: -0.3 }
                : { ...head(), fontSize: 19, lineHeight: 20 },
            { color: ink },
          ]}
        >
          {name}
        </Text>
        <Text numberOfLines={1} style={[labelStyle(th, 9, dim), band ? { opacity: 0.8 } : null]}>
          @{friend.other.username}
        </Text>
      </View>
      <CheckDisc checked={checked} fill={fc.fill} ink={fc.ink} onBand={band} />
    </Pressable>
  );
}

/**
 * Het vinkje: leeg een ring (kleur: een kader), gekozen gevuld in de
 * kleur van de vriend. Op een gekleurde rij (magazine) keert hij om:
 * de inkt van de kleur als vlak, het vinkje in de kleur zelf.
 */
function CheckDisc({ checked, fill, ink, onBand }: { checked: boolean; fill: string; ink: string; onBand: boolean }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const size = 26;
  const bg = !checked ? "transparent" : onBand ? ink : fill;
  const fg = onBand ? fill : ink;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: th === "kleur" ? 0 : size / 2,
        borderWidth: th === "kleur" ? spec.border : checked ? 0 : 1.5,
        borderColor: th === "kleur" ? color("ink") : color("ink", "postRule"),
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? <Ionicons name="checkmark" size={15} color={fg} /> : null}
    </View>
  );
}
