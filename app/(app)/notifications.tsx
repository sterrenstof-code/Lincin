import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";

import { NotificationsModern } from "@/components/lincin/modern/NotificationsModern";
import { NotificationsMagazine } from "@/components/lincin/magazine/Pages";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationWithDetails,
} from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/provider";
import { useScheme, useThemeSpec } from "@/lib/design/theme";
import { useLang, useT } from "@/lib/i18n";
import { shortAgo } from "@/lib/lincin/model";
import { usePageTitle } from "@/lib/page-title";
import { useIsDesktop } from "@/lib/lincin/desktop";

/**
 * Meldingen (README §09, mobile-app.dc.html → meldingen).
 *
 * Magazine: rijen met een rug in de kleur van wie het deed, initiaal of
 * foto, naam en tijd, de zin in serif en een rode stip. Modern: een tegel
 * per melding. Een tik leest hem en gaat erheen; "Alles gelezen" leest
 * alles in één keer.
 */

export default function NotificationsScreen() {
  usePageTitle("Meldingen");
  // Op desktop staan de meldingen op Jij (desktop-*-pages, JIJ); de ◉ komt daar uit.
  if (useIsDesktop()) return <Redirect href="/profile" />;
  return <NotificationsPhone />;
}

function NotificationsPhone() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();

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

  /**
   * Alles gelezen, optimistisch: de lijst en de teller (tabbalk, ◉) gaan
   * meteen naar gelezen/0, de server volgt. Zegt die nee, dan zetten we
   * beide terug zoals ze waren en halen daarna de waarheid op.
   */
  async function markAll() {
    const listKey = ["notifications", myUserId];
    const countKey = ["notifications-unread", myUserId];
    // Een refetch die nog onderweg is mag de optimistische stand niet overschrijven.
    await Promise.all([qc.cancelQueries({ queryKey: listKey }), qc.cancelQueries({ queryKey: countKey })]);
    const prevList = qc.getQueryData<NotificationWithDetails[]>(listKey);
    const prevCount = qc.getQueryData<number>(countKey);
    qc.setQueryData<NotificationWithDetails[]>(listKey, (old) => (old ?? []).map((n) => (n.read ? n : { ...n, read: true })));
    qc.setQueryData<number>(countKey, 0);
    try {
      await markAllNotificationsRead(myUserId);
    } catch {
      qc.setQueryData(listKey, prevList);
      qc.setQueryData(countKey, prevCount);
    }
    bump();
  }

  const noteRows = data.map((n, i) => ({
    key: n.id,
    actorId: n.actor_id,
    avatarUrl: n.type === "bug_resolved" ? null : n.actor?.avatar_url ?? null,
    // `bug_resolved` heeft geen afzender; dan staat de zin alleen.
    by: n.type === "bug_resolved" ? "" : n.actor?.display_name ?? n.actor?.username ?? "Iemand",
    text: describe(n).text,
    when: shortAgo(n.created_at, t, lang),
    no: String(data.length - i).padStart(2, "0"),
    unread: !n.read,
    onPress: () => open(n),
  }));

  if (spec.layout === "spread") {
    return (
      <NotificationsMagazine
        rows={noteRows}
        unread={unread}
        scheme={scheme}
        t={t}
        state={notes.isLoading ? t.loading : notes.isError ? t.failed : data.length === 0 ? t.noNotes : null}
        onMarkAll={markAll}
      />
    );
  }

  return (
    <NotificationsModern
      rows={noteRows}
      unread={unread}
      scheme={scheme}
      t={t}
      state={notes.isLoading ? t.loading : notes.isError ? t.failed : null}
      emptyLabel={t.noNotes}
      onEmptyPress={() => router.push("/profile")}
      onMarkAll={markAll}
    />
  );
}

export function destinationFor(item: NotificationWithDetails): string | null {
  if (item.event_id) return `/event/${item.event_id}`;
  // Over een reactie: de draad open en de reactie even gemarkeerd (?c=).
  const c = item.entity_comment_id ? `?c=${item.entity_comment_id}` : "";
  if (item.post_id) return `/post/${item.post_id}${c}`;
  if (item.poll_id) return `/poll/${item.poll_id}${c}`;
  if (item.list_id) return `/list/${item.list_id}`;
  // Een call heeft geen eigen bladzijde; hij leeft in het gesprek.
  if (item.call_chat_id) return `/chat/${item.call_chat_id}`;
  return null;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

/** Wat er gebeurde, zónder de naam — die staat er vet voor. */
export function describe(item: NotificationWithDetails): { text: string } {
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
    case "friend_poll": return { text: item.poll_question ? `vraagt: «${truncate(item.poll_question, 48)}»` : "startte een poll" };
    case "vote_on_poll": return { text: item.poll_question ? `stemde op «${truncate(item.poll_question, 40)}»` : "stemde op jouw poll" };
    case "vote_on_call": return { text: "koos een tijdslot voor jouw call" };
    case "invited_to_list": return { text: item.target_title ? `nodigde je uit voor «${truncate(item.target_title, 40)}»` : "nodigde je uit voor een lijst" };
    case "invited_to_call": return { text: "nodigde je uit voor een videocall" };
    case "event_join": return { text: `nam deel aan ${eventName}` };
    case "event_join_request": return { text: `vraagt toegang tot ${eventName}` };
    case "event_join_approved": return { text: `liet je toe tot ${eventName}` };
    case "event_contribution": return { text: `plaatste iets in ${eventName}` };
    case "mention": return { text: "noemde je" };
    case "comment_reply": return { text: `antwoordde op je reactie${item.comment_body ? `: ${truncate(item.comment_body, 48)}` : ""}` };
    // Met het fragment van jóúw reactie erbij: wie veel reageert weet anders niet welke.
    case "comment_like": {
      const which = item.comment_body ? ` «${truncate(item.comment_body, 40)}»` : "";
      return { text: item.detail && item.detail !== "❤️" ? `reageerde ${item.detail} op je reactie${which}` : `vond je reactie${which} leuk` };
    }
    case "post_boost": return { text: "duwde jouw bijdrage omhoog" };
    case "followed_post_comment": return { text: "reageerde op een bijdrage die je volgt" };
    default: return { text: "deed iets" };
  }
}
