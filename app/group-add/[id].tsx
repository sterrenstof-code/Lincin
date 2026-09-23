import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { Avatar } from "@/components/Avatar";
import { bodyStyle, Button, labelStyle, ListRow, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import {
  addChatMember,
  getChatRow,
  listChatMembers,
} from "@/lib/api/chats";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";
import { rekeyMessagesForNewMember } from "@/lib/api/rekey";
import { color, friendColor, hueFor, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, sans, serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

/**
 * Leden toevoegen, in de vorm van het thema (components/lincin/SubPage) —
 * de pagina achter "Voeg toe" op Groep info (app/group/[id].tsx), in de
 * kleur van dezelfde groep.
 *
 * Je vrienden die nog niet in de groep zitten, als rijen. Wie je aanvinkt
 * krijgt zijn eigen kleur: een gevulde schijf (kleur: een vierkant) in
 * zijn vriendkleur, en in magazine kleurt de hele rij mee.
 */

export default function GroupAddMembersScreen() {
  usePageTitle("Leden toevoegen");
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id!;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
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

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  const friendsToAdd = useMemo(() => {
    const accepted = (friendships.data ?? []).filter((f) => f.status === "accepted");
    const memberIds = new Set((members.data ?? []).map((m) => m.user_id));
    return accepted.filter((f) => !memberIds.has(f.other.id));
  }, [friendships.data, members.data]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit = !submitting && selected.size > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Sequential — small batch (<20), simpler error reporting than Promise.all.
      for (const userId of selected) {
        await addChatMember(chatId, userId);
      }
      await qc.invalidateQueries({ queryKey: ["chat-members", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });

      // Re-keying: voeg enveloppen toe aan bestaande berichten voor elk nieuw lid.
      // Fire-and-forget — nooit blokkeren op de navigatie.
      for (const userId of selected) {
        rekeyMessagesForNewMember(chatId, userId, myUserId).catch(() => {});
      }

      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Kon leden niet toevoegen.");
    } finally {
      setSubmitting(false);
    }
  }

  const th = useThemeSpec().id;
  const loading = friendships.isLoading || members.isLoading;
  const empty = !loading && friendsToAdd.length === 0;

  return (
    <SubPage
      title="Leden toevoegen"
      kicker="Groep"
      sub={chat.data?.name ? `Naar "${chat.data.name}"` : "Naar groep"}
      back={`/group/${chatId}`}
      tab="chats"
      hue={hueFor(chatId)}
    >
      <Note>
        Selecteer vrienden om aan deze groep toe te voegen. Elk nieuw lid
        krijgt z&apos;n eigen versleutelde envelope op elk volgend bericht.
      </Note>

      <Section label={`Jouw vrienden · ${selected.size} geselecteerd`} pad={empty}>
        {loading ? (
          <ListRow title="Laden…" first />
        ) : empty ? (
          <Text style={bodyStyle(th, 14, color("ink", "inkDim"))}>
            Iedereen op je vriendenlijst zit al in deze groep. Voeg eerst nieuwe vrienden toe in de Vrienden-tab.
          </Text>
        ) : (
          friendsToAdd.map((f, i) => (
            <PickRow key={f.id} friend={f} first={i === 0} checked={selected.has(f.other.id)} onPress={() => toggle(f.other.id)} />
          ))
        )}
      </Section>

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label={submitting ? "Bezig…" : "Voeg toe"}
        tone="primary"
        icon="person-add-outline"
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
 * (Dezelfde rij als op Nieuwe groep, app/group-create.tsx.)
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
 * kleur van de vriend. Op een gekleurde rij (magazine) keert hij om.
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
