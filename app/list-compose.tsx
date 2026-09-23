import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar } from "@/components/Avatar";
import { Button, Field, labelStyle, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { createSharedList } from "@/lib/api/shared-lists";
import { listMyFriendships, type FriendshipWithProfile } from "@/lib/api/friends";
import { color, friendColor, hueFor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { safeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { usePageTitle } from "@/lib/page-title";

/**
 * Nieuwe lijst, in de vorm van het thema (components/lincin/SubPage).
 *
 * Een icoon, een naam en met wie je hem deelt. Het gekozen icoon staat in
 * de kleur van de pagina; een gekozen vriend krijgt een ring en een vinkje
 * in zijn eigen kleur.
 */

const EMOJI_OPTIONS = ["📋", "🎯", "🌍", "🎁", "🛒", "🍕", "📚", "🎬", "🏕️", "💡"];

/** De kleur van deze pagina: een lijst heeft nog geen id. */
const PAGE_HUE: Hue = "ochre";

export default function ListComposeScreen() {
  usePageTitle("Nieuwe lijst");
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

  /**
   * Weglopen met tekst die nog nergens staat.
   *
   * Er was geen enkele bewaking op verlaten in de hele app, en juist hier
   * doet dat pijn: de tekst bestaat nergens anders dan in dit veld — er is
   * geen concept op de server, want de server ziet alleen ciphertext.
   * Tijdens het versturen staat de bewaking uit, anders houdt hij de
   * navigatie tegen die het versturen zelf veroorzaakt.
   */
  useUnsavedGuard(!submitting && title.trim().length > 0, {
    message: "Deze lijst is nog niet aangemaakt. Weggaan betekent dat je hem kwijt bent.",
  });

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
      await qc.invalidateQueries({ queryKey: ["shared-lists", myUserId] });
      safeBack(router, "/lists");
    } catch (e: any) {
      setError(e.message ?? "Er ging iets mis.");
      // Mislukt: pas hier mag de knop weer aan, en de bewaking dus ook.
      setSubmitting(false);
    }
  }

  return (
    <SubPage
      title="Nieuwe lijst"
      kicker="Lijst"
      sub="Een lijst die je samen afvinkt."
      back="/lists"
      tab="feed"
      hue={PAGE_HUE}
      keyboard
      right={<Text style={{ fontSize: 40, lineHeight: 48 }}>{emoji}</Text>}
    >
      <Section label="Icoon" pad>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {EMOJI_OPTIONS.map((e) => (
            <EmojiTile key={e} emoji={e} selected={emoji === e} onPress={() => setEmoji(e)} />
          ))}
        </ScrollView>
      </Section>

      <Section pad>
        <Field
          label="Naam"
          value={title}
          onChangeText={setTitle}
          placeholder="Naam van de lijst, bijv. Bucketlist"
          autoFocus
        />
      </Section>

      {/* Leden uitnodigen */}
      {friends.length > 0 && (
        <Section label={memberIds.length > 0 ? `Delen met · ${memberIds.length}` : "Delen met"} pad>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 4 }}>
            {friends.map((f) => {
              const p = f.other;
              const selected = memberIds.includes(p.id);
              return (
                <PersonChip
                  key={p.id}
                  friend={f}
                  selected={selected}
                  onPress={() => setMemberIds((prev) => selected ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                />
              );
            })}
          </ScrollView>
        </Section>
      )}

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label="Aanmaken"
        tone="primary"
        icon="list-outline"
        busy={submitting}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </SubPage>
  );
}

/** Een icoon om te kiezen: gekozen staat het in de kleur van de pagina. */
function EmojiTile({ emoji, selected, onPress }: { emoji: string; selected: boolean; onPress: () => void }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const fc = friendColor(PAGE_HUE, useScheme());
  return (
    <Pressable
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`Icoon ${emoji}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: th === "modern" ? 12 : th === "magazine" ? 22 : 0,
        borderWidth: th === "kleur" ? spec.border : selected ? 0 : 1,
        borderColor: th === "kleur" ? color("ink") : color("ink", "postRule"),
        backgroundColor: selected ? fc.fill : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
    </Pressable>
  );
}

/**
 * Een vriend om mee te delen: zijn avatar met de naam eronder. Gekozen
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
