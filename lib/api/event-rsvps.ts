import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { uniqueTopic } from "../supabase/channel";
import { supabase } from "../supabase/client";

/**
 * "Ik kom" / "Misschien" (0072). Eén antwoord per lid per event; geen rij
 * betekent dat je nog niets zei.
 */
export type RsvpStatus = "yes" | "maybe";

export type EventRsvp = { event_id: string; user_id: string; status: RsvpStatus };

/** Alle antwoorden bij deze events die jij mag zien (leden en host). */
export async function listRsvps(eventIds: string[]): Promise<EventRsvp[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase.from("event_rsvps").select("event_id, user_id, status").in("event_id", eventIds);
  if (error) throw error;
  return (data ?? []) as EventRsvp[];
}

/** Zet je antwoord, of wist het met `null`. */
export async function setRsvp(eventId: string, userId: string, status: RsvpStatus | null): Promise<void> {
  if (status === null) {
    const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("event_rsvps")
    .upsert({ event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Vast, zodat wie `rsvps` in een useMemo leest niet elke render opnieuw rekent. */
const NONE: EventRsvp[] = [];

/**
 * De antwoorden bij een reeks events, plus jouw antwoord zetten.
 *
 * Eén haak voor de lijst (desktop en telefoon) en de eventpagina, zodat
 * ze alle drie hetzelfde doen: meteen tonen wat je koos, de server daarna,
 * en bij een fout terug naar wat er stond (HANDOFF: "alle toggles
 * optimistic met rollback"). `eventIds` moet stabiel zijn (useMemo) — het
 * is een deel van de querysleutel.
 *
 * De lijst en de eventpagina hebben elk hun eigen sleutel (andere ids);
 * na een gelukte keuze worden de andere ongeldig, zodat je bij terugkeren
 * niet je oude antwoord ziet.
 */
export function useEventRsvps(eventIds: string[], myUserId: string, onError: (err: unknown) => void) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["event-rsvps", eventIds],
    queryFn: () => listRsvps(eventIds),
    enabled: eventIds.length > 0,
  });

  // Live (0087): een antwoord van iemand anders op een van deze events
  // haalt de lijst opnieuw. Je eigen antwoord staat er al (optimistisch).
  const idsKey = eventIds.join(",");
  useEffect(() => {
    if (!idsKey) return;
    const ids = new Set(idsKey.split(","));
    const ch = supabase
      .channel(uniqueTopic(`event-rsvps:${idsKey.slice(0, 40)}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, (p) => {
        const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as Partial<EventRsvp>;
        if (!row?.event_id || !ids.has(row.event_id) || row.user_id === myUserId) return;
        qc.invalidateQueries({ queryKey: ["event-rsvps"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [idsKey, myUserId, qc]);

  const answer = useCallback(
    async (eventId: string, next: RsvpStatus | null) => {
      const key = ["event-rsvps", eventIds];
      // Een refetch die nog onderweg is, mag de optimistische stand niet overschrijven.
      await qc.cancelQueries({ queryKey: key, exact: true });
      const prev = qc.getQueryData<EventRsvp[]>(key) ?? [];
      const rest = prev.filter((r) => !(r.event_id === eventId && r.user_id === myUserId));
      qc.setQueryData<EventRsvp[]>(key, next ? [...rest, { event_id: eventId, user_id: myUserId, status: next }] : rest);
      try {
        await setRsvp(eventId, myUserId, next);
        const self = JSON.stringify(key);
        qc.invalidateQueries({ queryKey: ["event-rsvps"], predicate: (q) => JSON.stringify(q.queryKey) !== self });
      } catch (err) {
        qc.setQueryData(key, prev);
        onError(err);
      }
    },
    [qc, eventIds, myUserId, onError],
  );

  const data = query.data;
  const mine = useCallback(
    (eventId: string): RsvpStatus | null => data?.find((r) => r.event_id === eventId && r.user_id === myUserId)?.status ?? null,
    [data, myUserId],
  );

  return { rsvps: data ?? NONE, isLoading: query.isLoading, mine, answer };
}
