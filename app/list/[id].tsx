import { useEffect, useState } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Avatar } from "@/components/Avatar";
import { DetailState } from "@/components/DetailState";
import { bodyStyle, Button, Field, Section, SubPage } from "@/components/lincin/SubPage";
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
import { color, friendColor, hueFor, RASTER, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { safeBack } from "@/lib/nav";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/lib/toast";
import { usePageTitle } from "@/lib/page-title";

/**
 * Een gedeelde lijst, in de vorm van het thema (components/lincin/SubPage),
 * in de kleur van de lijst.
 *
 * De kop is de lijst zelf: titel, hoeveel er gedaan is, het icoon ernaast.
 * Daaronder een veld om iets toe te voegen, de voortgang met wie er
 * meedoet, de open items en onderaan wat al gedaan is. Een afgevinkt item
 * krijgt de kleur van de lijst.
 */


export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const myUserId = session!.user.id;

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

  usePageTitle(list?.title?.trim() || "Lijst");

  // Het overzicht (`/lists`) blijft gemount onder dit scherm en toont per
  // lijst "3 van 5". Zonder dit stond daar na terugkeren nog de stand van
  // vóór je iets toevoegde of afvinkte.
  const qc = useQueryClient();
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: ["shared-lists", myUserId] });
    };
  }, [qc, myUserId]);

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
        onBack={() => safeBack(router, "/lists")}
      />
    );
  }

  const total = list.items.length;
  const done = list.items.filter((i) => i.checked).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isOwner = list.user_id === myUserId;

  const unchecked = list.items.filter((i) => !i.checked);
  const checked = list.items.filter((i) => i.checked);

  const hue = hueFor(list.id);
  const people = [list.author, ...list.members].filter(Boolean);

  return (
    <SubPage
      title={list.title}
      kicker="Lijst"
      sub={total > 0 ? `${done} van ${total} gedaan` : "Nog leeg"}
      back="/lists"
      tab="feed"
      hue={hue}
      keyboard
      right={<Text style={{ fontSize: 40, lineHeight: 48 }}>{list.emoji}</Text>}
    >
      <Section pad>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Field
              value={draft}
              onChangeText={setDraft}
              placeholder="Voeg item toe…"
              returnKeyType="done"
              onSubmitEditing={onAddItem}
            />
          </View>
          <Button
            label="Voeg toe"
            icon="add"
            tone="primary"
            busy={adding}
            disabled={!draft.trim() || adding}
            onPress={onAddItem}
          />
        </View>
      </Section>

      <Section label={total > 0 ? `Voortgang · ${pct}%` : "Leden"} pad>
        {total > 0 ? <Progress pct={pct} hue={hue} /> : null}
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
          {people.map((p) => (
            <Avatar key={p!.id} name={p!.display_name ?? p!.username} avatarUrl={p!.avatar_url ?? null} size="xs" lastSeenAt={p!.last_seen_at} />
          ))}
        </View>
      </Section>

      {/* Open items eerst */}
      {unchecked.length > 0 ? (
        <Section label={`Te doen · ${unchecked.length}`}>
          {unchecked.map((item, i) => (
            <ItemRow key={item.id} item={item} hue={hue} first={i === 0} onToggle={() => onToggle(item)} onDelete={() => onDelete(item.id)} canDelete={isOwner || item.user_id === myUserId} />
          ))}
        </Section>
      ) : null}

      {/* Afgevinkte items */}
      {checked.length > 0 ? (
        <Section label={`Gedaan · ${checked.length}`}>
          <View style={{ opacity: 0.6 }}>
            {checked.map((item, i) => (
              <ItemRow key={item.id} item={item} hue={hue} first={i === 0} onToggle={() => onToggle(item)} onDelete={() => onDelete(item.id)} canDelete={isOwner || item.user_id === myUserId} />
            ))}
          </View>
        </Section>
      ) : null}
    </SubPage>
  );
}

/**
 * De voortgangsbalk in de kleur van de lijst: een kader van 1.5 (kleur),
 * een platte strook (magazine), een pil (modern).
 */
function Progress({ pct, hue }: { pct: number; hue: Hue }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const fill = friendColor(hue, useScheme()).fill;
  const h = th === "kleur" ? 14 : th === "magazine" ? RASTER.seam * 2 : 8;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{
        height: h,
        overflow: "hidden",
        borderRadius: th === "modern" ? h / 2 : 0,
        borderWidth: th === "kleur" ? spec.border : 0,
        borderColor: color("ink"),
        backgroundColor: th === "kleur" ? color("paper") : color("ink", "postRule"),
      }}
    >
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: fill }} />
    </View>
  );
}

function ItemRow({
  item,
  hue,
  first,
  onToggle,
  onDelete,
  canDelete,
}: {
  item: ListItem;
  hue: Hue;
  first: boolean;
  onToggle: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const fc = friendColor(hue, useScheme());
  const dim = color("ink", "inkDim");
  const box = 24;
  // Dezelfde scheidingslijn als `ListRow`.
  const rule: ViewStyle = first
    ? {}
    : th === "kleur"
      ? { borderTopWidth: spec.border, borderTopColor: color("ink") }
      : th === "magazine"
        ? { borderTopWidth: 1, borderTopColor: color("ink", "postRule") }
        : { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: color("ink", "dash") };
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: th === "magazine" ? 0 : 14,
        marginHorizontal: th === "magazine" ? 18 : 0,
        paddingVertical: 10,
        ...rule,
      }}
    >
      <Pressable
        hitSlop={12}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={`${item.text} — ${
          item.checked ? "vinkje weghalen" : "afvinken"
        }`}
        onPress={onToggle}
        style={{
          width: box,
          height: box,
          borderRadius: th === "kleur" ? 0 : box / 2,
          borderWidth: th === "kleur" ? spec.border : item.checked ? 0 : 1.5,
          borderColor: th === "kleur" ? color("ink") : dim,
          backgroundColor: item.checked ? fc.fill : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.checked ? <Ionicons name="checkmark" color={fc.ink} size={14} /> : null}
      </Pressable>
      <Text
        style={[
          bodyStyle(th, 15, item.checked ? dim : color("ink")),
          { flex: 1, minWidth: 0 },
          item.checked ? { textDecorationLine: "line-through" } : null,
        ]}
      >
        {item.text}
      </Text>
      {canDelete ? (
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Item verwijderen"
          onPress={onDelete}
          style={({ pressed }) => ({ width: 32, height: 32, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="trash-outline" size={16} color={dim} />
        </Pressable>
      ) : null}
    </View>
  );
}
