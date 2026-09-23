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
