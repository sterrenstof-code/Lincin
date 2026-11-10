import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";

import { NotificationsModern } from "@/components/lincin/modern/NotificationsModern";
import { NotificationsMagazine } from "@/components/lincin/magazine/Pages";
import { MeldingenCatalogus } from "@/components/lincin/catalogus/schermen/Lijsten";
import { lincKleur } from "@/components/lincin/catalogus/stijl";
import { useTerug } from "@/components/lincin/catalogus/nav";
import { MeldingenDesktopEcht } from "@/components/lincin/catalogus/desktop/echt";
import { useCatalogusDesktop } from "@/components/lincin/catalogus/desktop/weergave";
import { acceptFriendRequest, deleteFriendship, listMyFriendships } from "@/lib/api/friends";
import { useToast } from "@/lib/toast";
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
import { useClearNotificationsOnVisit } from "@/lib/lincin/unread";

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
  const catalogusDesktop = useCatalogusDesktop();

  const notes = useQuery({
    queryKey: ["notifications", myUserId],
    queryFn: () => listNotifications(myUserId),
    refetchOnWindowFocus: true,
  });
  useClearNotificationsOnVisit(myUserId, notes.isSuccess && !notes.isFetching);
  // Catalogus zet een linc-verzoek als melding met de keuze erin (ontwerp 08).
  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
    enabled: spec.layout === "catalogus",
  });
  const toast = useToast();
  const terug = useTerug("/feed");
  const data = useMemo(() => notes.data ?? [], [notes.data]);
  const unread = data.filter((n) => !n.read).length;

  const bump = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["notifications", myUserId] });
    qc.invalidateQueries({ queryKey: ["notifications-unread", myUserId] });
  }, [qc, myUserId]);

  /**
   * Stabiel (useCallback), net als de rijen hieronder: de lijst is
   * gevirtualiseerd en de rijen zijn `memo`. Met een nieuwe `onPress` bij
   * elke render tekende elke rij toch weer opnieuw.
   */
  const open = useCallback(async (item: NotificationWithDetails) => {
    if (!item.read) {
      qc.setQueryData<NotificationWithDetails[]>(["notifications", myUserId], (old) =>
        (old ?? []).map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      markNotificationRead(item.id).then(bump).catch(() => {});
    }
    const to = destinationFor(item);
    if (to) router.push(to as never);
  }, [qc, myUserId, bump, router]);

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

  const noteRows = useMemo(() => data.map((n, i) => ({
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
    // `dataUpdatedAt` erbij: bij een refetch zonder wijziging houdt React
    // Query dezelfde `data`, maar "5 min" moet dan wel "20 min" worden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [data, t, lang, open, notes.dataUpdatedAt]);

  if (spec.layout === "catalogus") {
    const verzoeken = (friendships.data ?? []).filter((f) => f.status === "pending" && f.addressee_id === myUserId);
    const kies = async (doe: () => Promise<void>) => {
      try {
        await doe();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.failed);
      }
      qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    };
    const rijen = [
          ...verzoeken.map((f) => {
            const naam = f.other.display_name ?? f.other.username ?? "Iemand";
            return {
              id: `verzoek:${f.id}`,
              linc: { beeld: f.other.avatar_url, kleur: lincKleur(f.other.id), initiaal: naam.slice(0, 1).toUpperCase() },
              naam,
              rest: " wil je linc worden",
              tijd: shortAgo(f.created_at, t, lang),
              nieuw: true,
              open: () => (f.other.username ? router.push(`/user/${f.other.username}` as never) : router.push("/friends")),
              keuze: {
                ja: "Accepteer",
                nee: "Negeer",
                doeJa: () => kies(() => acceptFriendRequest(f.id, myUserId, f.requester_id)),
                doeNee: () => kies(() => deleteFriendship(f.id)),
              },
            };
          }),
          ...data.map((n, i) => {
            const r = noteRows[i];
            return {
              id: n.id,
              linc: { beeld: r.avatarUrl, kleur: n.actor_id ? lincKleur(n.actor_id) : null, initiaal: (r.by || "?").slice(0, 1).toUpperCase() },
              naam: r.by,
              rest: r.by ? ` ${r.text}` : r.text,
              tijd: r.when,
              nieuw: r.unread,
              open: r.onPress,
            };
          }),
    ];
    const stand = notes.isLoading ? t.loading : notes.isError ? t.failed : data.length === 0 && verzoeken.length === 0 ? t.noNotes : null;
    // Desktop: dezelfde rijen in de opbouw van Gesprekken (components/lincin/catalogus/desktop).
    if (catalogusDesktop) {
      return <MeldingenDesktopEcht rijen={rijen} nieuw={unread + verzoeken.length} verzoeken={verzoeken.length} allesGelezen={markAll} stand={stand} />;
    }
    return <MeldingenCatalogus rijen={rijen} nieuw={unread + verzoeken.length} terug={terug} allesGelezen={markAll} stand={stand} />;
  }

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
