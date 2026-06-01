import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createActivityEvent } from "./activity-events";

export type EventRevealMode = "during" | "after" | "delayed";

export type EventRow = {
  id: string;
  host_user_id: string;
  name: string;
  description: string | null;
  cover_image_path: string | null;
  starts_at: string;
  ends_at: string;
  reveal: EventRevealMode;
  reveal_delay_hours: number;
  max_guests: number;
  join_code: string;
  created_at: string;
};

export type EventWithMeta = EventRow & {
  members_count: number;
  contributions_count: number;
  /** Computed: is content revealed for the current viewer? Hosts always see. */
  is_revealed: boolean;
  /** Convenience: is this event currently happening? */
  is_active: boolean;
  is_host: boolean;
};

export type ContributionRow = {
  id: string;
  event_id: string;
  user_id: string;
  image_path: string | null;
  caption: string | null;
  link_url: string | null;
  created_at: string;
};

export type ContributionWithAuthor = ContributionRow & {
  author: Profile | null;
  image_url: string | null;
};

const EVENT_BUCKET = "event-photos";

// ---------- helpers ----------

function randomId(): string {
  if (typeof (globalThis.crypto as any)?.randomUUID === "function") {
    return (globalThis.crypto as any).randomUUID();
  }
  const bytes = new Uint8Array(16);
  (globalThis.crypto as any).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
    "-" + hex.slice(16, 20) + "-" + hex.slice(20)
  );
}

function isRevealed(event: EventRow, viewerUserId: string): boolean {
  if (event.host_user_id === viewerUserId) return true;
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  switch (event.reveal) {
    case "during":
      return now >= start;
    case "after":
      return now >= end;
    case "delayed":
      return now >= end + event.reveal_delay_hours * 3_600_000;
    default:
      return false;
  }
}

function isActive(event: EventRow): boolean {
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  return now >= start && now <= end;
}

// ---------- API ----------

/** Maak een nieuw event. Host wordt automatisch als member geinsert via trigger. */
export async function createEvent(args: {
  hostUserId: string;
  name: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  reveal: EventRevealMode;
  revealDelayHours?: number;
  maxGuests?: number;
}): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      host_user_id: args.hostUserId,
      name: args.name.trim(),
      description: args.description?.trim() || null,
      starts_at: args.startsAt.toISOString(),
      ends_at: args.endsAt.toISOString(),
      reveal: args.reveal,
      reveal_delay_hours:
        args.reveal === "delayed" ? (args.revealDelayHours ?? 24) : 0,
      max_guests: args.maxGuests ?? 100,
    })
    .select(
      "id, host_user_id, name, description, cover_image_path, starts_at, ends_at, reveal, reveal_delay_hours, max_guests, join_code, created_at"
    )
    .single();
  if (error) throw error;

  // Insert host as event_member
  const { error: memErr } = await supabase.from("event_members").insert({
    event_id: data.id,
    user_id: args.hostUserId,
    role: "host",
  });
  if (memErr && !/duplicate/i.test(memErr.message)) throw memErr;

  // Activiteitsmoment — fire-and-forget
  createActivityEvent({ actorId: args.hostUserId, kind: "event_created", eventId: data.id }).catch(() => {});

  return data as EventRow;
}

/** Events I host or am a member of, with derived state. */
export async function listMyEvents(myUserId: string): Promise<EventWithMeta[]> {
  // Member-rows for me to get event_ids
  const { data: myMemberships, error: mErr } = await supabase
    .from("event_members")
    .select("event_id")
    .eq("user_id", myUserId);
  if (mErr) throw mErr;
  const eventIds = (myMemberships ?? []).map((m: any) => m.event_id);
  if (eventIds.length === 0) return [];

  const { data: events, error } = await supabase
    .from("events")
    .select(
      "id, host_user_id, name, description, cover_image_path, starts_at, ends_at, reveal, reveal_delay_hours, max_guests, join_code, created_at"
    )
    .in("id", eventIds)
    .order("starts_at", { ascending: false });
  if (error) throw error;

  const rows = (events ?? []) as EventRow[];
  if (rows.length === 0) return [];

  // Bulk counts
  const { data: memberCounts } = await supabase
    .from("event_members")
    .select("event_id")
    .in("event_id", eventIds);
  const memberCountByEvent = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    const eid = (m as any).event_id;
    memberCountByEvent.set(eid, (memberCountByEvent.get(eid) ?? 0) + 1);
  }

  const { data: contribs } = await supabase
    .from("event_contributions")
    .select("event_id")
    .in("event_id", eventIds);
  const contribCountByEvent = new Map<string, number>();
  for (const c of contribs ?? []) {
    const eid = (c as any).event_id;
    contribCountByEvent.set(eid, (contribCountByEvent.get(eid) ?? 0) + 1);
  }

  return rows.map((e) => ({
    ...e,
    members_count: memberCountByEvent.get(e.id) ?? 0,
    contributions_count: contribCountByEvent.get(e.id) ?? 0,
    is_revealed: isRevealed(e, myUserId),
    is_active: isActive(e),
    is_host: e.host_user_id === myUserId,
  }));
}

export async function getEvent(eventId: string, myUserId: string): Promise<EventWithMeta | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, host_user_id, name, description, cover_image_path, starts_at, ends_at, reveal, reveal_delay_hours, max_guests, join_code, created_at"
    )
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const event = data as EventRow;

  const [{ count: membersCount }, { count: contribCount }] = await Promise.all([
    supabase
      .from("event_members")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("event_contributions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
  ]);

  return {
    ...event,
    members_count: membersCount ?? 0,
    contributions_count: contribCount ?? 0,
    is_revealed: isRevealed(event, myUserId),
    is_active: isActive(event),
    is_host: event.host_user_id === myUserId,
  };
}

/** Join an event by its join_code (from QR or shared link). Returns the event_id. */
export async function joinEventByCode(joinCode: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_event", { p_join_code: joinCode });
  if (error) throw error;
  const eventId = data as string;
  // Activiteitsmoment — fire-and-forget
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) createActivityEvent({ actorId: user.id, kind: "event_joined", eventId }).catch(() => {});
  });
  return eventId;
}

/** Upload a photo to event-photos bucket + insert contribution row. */
export async function contributeToEvent(args: {
  eventId: string;
  userId: string;
  imageUri?: string;
  mimeType?: string;
  caption?: string | null;
  linkUrl?: string | null;
}): Promise<ContributionRow> {
  const caption = args.caption?.trim() || null;
  const linkUrl = args.linkUrl?.trim() || null;
  let imagePath: string | null = null;

  if (args.imageUri) {
    const ext = guessExt(args.mimeType, args.imageUri);
    imagePath = `${args.eventId}/${args.userId}/${randomId()}.${ext}`;
    const response = await fetch(args.imageUri);
    const blob = await response.blob();
    const { error: upErr } = await supabase.storage
      .from(EVENT_BUCKET)
      .upload(imagePath, blob, {
        contentType: blob.type || args.mimeType || "image/jpeg",
      });
    if (upErr) throw upErr;
  }

  if (!imagePath && !caption && !linkUrl) {
    throw new Error("Lege bijdrage — voeg foto, tekst of link toe.");
  }

  const { data, error: insErr } = await supabase
    .from("event_contributions")
    .insert({
      event_id: args.eventId,
      user_id: args.userId,
      image_path: imagePath,
      caption,
      link_url: linkUrl,
    })
    .select("id, event_id, user_id, image_path, caption, link_url, created_at")
    .single();
  if (insErr) {
    if (imagePath) {
      await supabase.storage.from(EVENT_BUCKET).remove([imagePath]).catch(() => {});
    }
    throw insErr;
  }
  return data as ContributionRow;
}

function guessExt(mime: string | undefined, uri: string): string {
  if (mime) {
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("heic") || mime.includes("heif")) return "heic";
  }
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return m ? m[1].toLowerCase() : "jpg";
}

/** List contributions for an event, respecting reveal-rules client-side. */
export async function listEventContributions(
  eventId: string,
  myUserId: string
): Promise<{ contributions: ContributionWithAuthor[]; revealed: boolean }> {
  const event = await getEvent(eventId, myUserId);
  if (!event) return { contributions: [], revealed: false };

  // Always allow host to see; otherwise honor reveal
  const canSeeContent = event.is_revealed;

  const { data, error } = await supabase
    .from("event_contributions")
    .select("id, event_id, user_id, image_path, caption, link_url, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ContributionRow[];

  if (rows.length === 0) return { contributions: [], revealed: canSeeContent };

  // If not revealed yet, return rows BUT strip image_url and content (the
  // caller can show counts/silhouettes only). For host, we always provide.
  const visibleRows = canSeeContent ? rows : [];

  const authorIds = Array.from(new Set(visibleRows.map((r) => r.user_id)));
  const authors = await getProfiles(authorIds);
  const byId = new Map(authors.map((a) => [a.id, a]));

  const paths = visibleRows.map((r) => r.image_path).filter((p): p is string => !!p);
  let urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(EVENT_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  }

  const contributions: ContributionWithAuthor[] = visibleRows.map((r) => ({
    ...r,
    author: byId.get(r.user_id) ?? null,
    image_url: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
  }));

  return { contributions, revealed: canSeeContent };
}

/** Subscribe to new contributions on an event (realtime). */
export function subscribeToEventContributions(
  eventId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`event-contrib:${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "event_contributions",
        filter: `event_id=eq.${eventId}`,
      },
      () => onChange()
    )
    .subscribe();
}

export function buildEventJoinUrl(joinCode: string): string {
  const base =
    process.env.EXPO_PUBLIC_PUBLIC_URL ??
    (typeof window !== "undefined" && (window as any).location?.origin
      ? (window as any).location.origin
      : "https://lincin.app");
  return `${base}/e/${encodeURIComponent(joinCode)}`;
}

/** Format a relative status string for an event card. */
export function eventStatusLabel(event: EventWithMeta): string {
  const now = Date.now();
  const start = new Date(event.starts_at).getTime();
  const end = new Date(event.ends_at).getTime();
  if (now < start) {
    return relativeFuture(start - now);
  }
  if (now <= end) {
    return `${formatDuration(end - now)} over`;
  }
  if (event.reveal === "delayed") {
    const revealAt = end + event.reveal_delay_hours * 3_600_000;
    if (now < revealAt) return `Onthulling over ${formatDuration(revealAt - now)}`;
  }
  return "Afgelopen";
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return "< 1 min";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function relativeFuture(ms: number): string {
  return `Start over ${formatDuration(ms)}`;
}
