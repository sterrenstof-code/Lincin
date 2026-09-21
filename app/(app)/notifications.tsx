import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen, TopRow, vfade } from "@/components/lincin/Chrome";
import { NotificationsModern } from "@/components/lincin/modern/NotificationsModern";
import { BORDER, Box, Btn, DashedCard, GUTTER, Mono, Serif, line } from "@/components/lincin/ui";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationWithDetails,
} from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { shortAgo } from "@/lib/lincin/model";
import { usePageTitle } from "@/lib/page-title";

/**
 * Meldingen (README §09).
 *
 * Eén kader met rijen: links een balkje van 10 in de kleur van wie het
 * deed, dan de naam vet en wat er gebeurde, en de tijd in mono. Wat je nog
 * niet las heeft een lichte inkttint; een tik leest het en gaat erheen.
 */

export default function NotificationsScreen() {
  usePageTitle("Meldingen");
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();

  const notes = useQuery({
    queryKey: ["notifications", myUserId],
    queryFn: () => listNotifications(myUserId),
    refetchOnWindowFocus: true,
  });
  const data = notes.data ?? [];
  const unread = data.filter((n) => !n.read).length;

  function bump() {
    qc.invalidateQueries({ queryKey: ["notifications", myUserId] });
    qc.invalidateQueries({ queryKey: ["notifications-unread", myUserId] });
  }

  async function open(item: NotificationWithDetails) {
    if (!item.read) {
      qc.setQueryData<NotificationWithDetails[]>(["notifications", myUserId], (old) =>
        (old ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      markNotificationRead(item.id).then(bump).catch(() => {});
    }
    const to = destinationFor(item);
    if (to) router.push(to as never);
  }

  async function readAll() {
    await markAllNotificationsRead(myUserId).catch(() => {});
    bump();
  }

  if (spec.layout === "bento") {
    return (
      <NotificationsModern
        rows={data.map((n) => ({
          key: n.id,
          actorId: n.actor_id,
          // `bug_resolved` heeft geen afzender; dan staat de zin alleen.
          by: n.type === "bug_resolved" ? "" : n.actor?.display_name ?? n.actor?.username ?? "Iemand",
          text: describe(n).text,
          when: shortAgo(n.created_at, t, lang),
          unread: !n.read,
          onPress: () => open(n),
        }))}
        unread={unread}
        scheme={scheme}
        t={t}
        state={notes.isLoading ? t.loading : notes.isError ? t.failed : null}
        emptyLabel="Nog geen meldingen"
        onEmptyPress={() => router.push("/profile")}
      />
    );
  }

  return (
    <LincinScreen
      tab="you"
      counter={t.notifications}
      back="/profile"
      header={
        <TopRow
          center={<Serif variant="pageTitleLarge">{t.notifications}</Serif>}
          right={unread > 0 ? <Btn label="Alles gelezen" height={30} onPress={readAll} /> : null}
        />
      }
    >
      <ScrollView style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ padding: GUTTER, paddingTop: 16, paddingBottom: 20 }}>
        {notes.isLoading ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
            {t.loading}
          </Mono>
        ) : notes.isError ? (
          <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 30 }}>
            {t.failed}
          </Mono>
        ) : data.length === 0 ? (
          <DashedCard>Nog geen meldingen</DashedCard>
        ) : (
          <Box style={{ borderBottomWidth: 0 }}>
            {data.map((n) => (
              <Row key={n.id} item={n} onPress={() => open(n)} />
            ))}
          </Box>
        )}
      </ScrollView>
    </LincinScreen>
  );
}

function destinationFor(item: NotificationWithDetails): string | null {
  if (item.event_id) return `/event/${item.event_id}`;
  if (item.post_id) return `/post/${item.post_id}`;
  return null;
}

function Row({ item, onPress }: { item: NotificationWithDetails; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  // De ongelezen-tint volgt het blad, niet de stand: magazine is altijd
  // licht, ook als de stand donker is.
  const darkPaper = useThemeSpec().dark;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const fc = friendColor(hueFor(item.actor_id), scheme);
  const name = item.actor?.display_name ?? item.actor?.username ?? "Iemand";
  const { text } = describe(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${text}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        padding: 12,
        borderBottomWidth: BORDER,
        borderBottomColor: line(),
        backgroundColor: item.read ? "transparent" : darkPaper ? "rgba(237,232,221,.07)" : "rgba(20,20,20,.05)",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 10, backgroundColor: fc.fill, borderWidth: BORDER, borderColor: line() }} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[lincinType.bodySmall, { fontSize: 14, lineHeight: 19, color: color("ink") }]}>
          <Text style={{ fontFamily: lincinType.button.fontFamily, fontWeight: lincinType.button.fontWeight }}>
            {item.type === "bug_resolved" ? "" : name}
          </Text>
          {item.type === "bug_resolved" ? text : ` ${text}`}
        </Text>
        <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
          {shortAgo(item.created_at, t, lang)}
        </Mono>
      </View>
    </Pressable>
  );
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

/** Wat er gebeurde, zónder de naam — die staat er vet voor. */
function describe(item: NotificationWithDetails): { text: string } {
  const eventName = item.event_name ? `«${item.event_name}»` : "je event";
  const subject = item.post_source_title
    ? `«${truncate(item.post_source_title, 32)}»`
    : item.post_caption
      ? `«${truncate(item.post_caption, 32)}»`
      : "een bijdrage";
  switch (item.type) {
    case "bug_resolved": return { text: "Je bugmelding is afgehandeld" };
    case "friend_post": return { text: `deelde ${subject}` };
    case "comment_on_post": return { text: `reageerde op jouw bijdrage${item.comment_body ? `: ${truncate(item.comment_body, 48)}` : ""}` };
    case "comment_on_thread": return { text: `reageerde ook op ${subject}` };
    case "post_reaction": return { text: `reageerde ${item.detail ?? ""} op jouw bijdrage`.replace("  ", " ") };
    case "thread_reaction": return { text: `reageerde ${item.detail ?? ""} op ${subject}`.replace("  ", " ") };
    case "thread_boost": return { text: `duwde ${subject} omhoog` };
    case "vote_on_poll": return { text: "stemde op jouw poll" };
    case "vote_on_call": return { text: "koos een tijdslot voor jouw call" };
    case "invited_to_list": return { text: "nodigde je uit voor een lijst" };
    case "invited_to_call": return { text: "nodigde je uit voor een videocall" };
    case "event_join": return { text: `nam deel aan ${eventName}` };
    case "event_join_request": return { text: `vraagt toegang tot ${eventName}` };
    case "event_join_approved": return { text: `liet je toe tot ${eventName}` };
    case "event_contribution": return { text: `plaatste iets in ${eventName}` };
    case "mention": return { text: "noemde je" };
    case "post_boost": return { text: "duwde jouw bijdrage omhoog" };
    case "followed_post_comment": return { text: "reageerde op een bijdrage die je volgt" };
    default: return { text: "deed iets" };
  }
}
