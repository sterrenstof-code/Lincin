import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "../supabase/client";
import { uriToBytes } from "../crypto/file";
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
  /** Signed URL for the cover image (null if no cover / not readable). */
  cover_url: string | null;
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
  /** "image" | "video" for media, or null for text/link-only contributions. */
  media_type: "image" | "video" | null;
};

const EVENT_BUCKET = "event-photos";
/** Signed-URL lifetime. Long enough that a screen left open doesn't break. */
const SIGNED_URL_TTL = 60 * 60 * 6; // 6 uur

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

const VIDEO_EXTS = new Set(["mp4", "mov", "m4v", "webm", "qt"]);

/** Guess whether a stored path points at a video, from its extension. */
export function isVideoPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const m = path.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return m ? VIDEO_EXTS.has(m[1].toLowerCase()) : false;
}

function mediaTypeFor(path: string | null): "image" | "video" | null {
  if (!path) return null;
  return isVideoPath(path) ? "video" : "image";
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

function guessExt(mime: string | undefined, uri: string): string {
  if (mime) {
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("heic") || mime.includes("heif")) return "heic";
    if (mime.includes("quicktime")) return "mov";
    if (mime.includes("m4v")) return "m4v";
    if (mime.includes("webm")) return "webm";
    if (mime.includes("mp4")) return "mp4";
  }
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return m ? m[1].toLowerCase() : "jpg";
}

/**
 * Upload een lokale media-URI naar de event-photos bucket op het opgegeven pad.
 * Leest de bytes cross-platform (native: expo-file-system base64, web: fetch)
 * zodat de upload ook op iOS/Android betrouwbaar is (een kale fetch(uri).blob()
 * levert daar vaak lege bestanden op).
 */
async function uploadToEventBucket(
  path: string,
  uri: string,
  mimeType: string | undefined
): Promise<void> {
  const bytes = await uriToBytes(uri);
  const contentType = mimeType || "application/octet-stream";
  const blob = new Blob([bytes as any], { type: contentType });
  const { error } = await supabase.storage
    .from(EVENT_BUCKET)
    .upload(path, blob, { contentType });
  if (error) throw error;
}

// ---------- API ----------

/** Maak een nieuw event. Host wordt als member geinsert; optioneel met cover. */
export async function createEvent(args: {
  hostUserId: string;
  name: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  reveal: EventRevealMode;
  revealDelayHours?: number;
  maxGuests?: number;
  coverUri?: string | null;
  coverMimeType?: string | null;
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

  let coverPath: string | null = null;
  if (args.coverUri) {
    try {
      const ext = guessExt(args.coverMimeType ?? undefined, args.coverUri);
      coverPath = `${data.id}/cover/${randomId()}.${ext}`;
      await uploadToEventBucket(coverPath, args.coverUri, args.coverMimeType ?? "image/jpeg");
      const { error: upErr } = await supabase
        .from("events")
        .update({ cover_image_path: coverPath })
        .eq("id", data.id);
      if (upErr) throw upErr;
    } catch (e) {
      // Cover is optioneel — laat event-creatie niet falen op een cover-fout.
      console.warn("[events] cover upload failed", e);
      coverPath = null;
    }
  }

  // Activiteitsmoment — fire-and-forget
  createActivityEvent({ actorId: args.hostUserId, kind: "event_created", eventId: data.id }).catch(() => {});

  return { ...(data as EventRow), cover_image_path: coverPath ?? data.cover_image_path };
}

async function signCoverUrls(
  paths: (string | null)[]
): Promise<Map<string, string | null>> {
  const real = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (real.length === 0) return new Map();
  const { data } = await supabase.storage
    .from(EVENT_BUCKET)
    .createSignedUrls(real, SIGNED_URL_TTL);
  return new Map((data ?? []).map((s) => [s.path ?? "", s.signedUrl]));
}

/** Events I host or am a member of, with derived state. Counts come from a
 * SECURITY DEFINER RPC so they stay correct even when contributions are
 * reveal-gated by RLS. */
export async function listMyEvents(myUserId: string): Promise<EventWithMeta[]> {
  const { data, error } = await supabase.rpc("list_my_events");
  if (error) throw error;
  const rows = (data ?? []) as (EventRow & {
    members_count: number;
    contributions_count: number;
  })[];
  if (rows.length === 0) return [];

  const coverUrls = await signCoverUrls(rows.map((r) => r.cover_image_path));

  return rows.map((e) => ({
    ...e,
    members_count: Number(e.members_count ?? 0),
    contributions_count: Number(e.contributions_count ?? 0),
    is_revealed: isRevealed(e, myUserId),
    is_active: isActive(e),
    is_host: e.host_user_id === myUserId,
    cover_url: e.cover_image_path ? coverUrls.get(e.cover_image_path) ?? null : null,
  }));
}

export async function getEvent(
  eventId: string,
  _myUserId: string
): Promise<EventWithMeta | null> {
  const { data, error } = await supabase
    .rpc("get_event_meta", { p_event_id: eventId })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as EventRow & {
    members_count: number;
    contributions_count: number;
    is_revealed: boolean;
    is_active: boolean;
    is_host: boolean;
  };

  let coverUrl: string | null = null;
  if (row.cover_image_path) {
    const { data: signed } = await supabase.storage
      .from(EVENT_BUCKET)
      .createSignedUrl(row.cover_image_path, SIGNED_URL_TTL);
    coverUrl = signed?.signedUrl ?? null;
  }

  return {
    ...row,
    members_count: Number(row.members_count ?? 0),
    contributions_count: Number(row.contributions_count ?? 0),
    is_revealed: !!row.is_revealed,
    is_active: !!row.is_active,
    is_host: !!row.is_host,
    cover_url: coverUrl,
  };
}

/** Join an event by its join_code (from QR or shared link). Returns the event_id.
 * The host notification is created server-side inside the join_event RPC. */
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

/** Upload een foto/video naar de event-photos bucket + insert contribution row. */
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
    await uploadToEventBucket(imagePath, args.imageUri, args.mimeType);
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

/** Verwijder een bijdrage (eigenaar of host, afgedwongen door RLS). Ruimt ook
 * het opslagbestand op (best-effort). */
export async function deleteContribution(args: {
  contributionId: string;
  imagePath?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("event_contributions")
    .delete()
    .eq("id", args.contributionId);
  if (error) throw error;
  if (args.imagePath) {
    await supabase.storage.from(EVENT_BUCKET).remove([args.imagePath]).catch(() => {});
  }
}

/** List contributions for an event. Reveal is enforced server-side by RLS;
 * `revealed` reflects whether the current viewer may see everyone's content. */
export async function listEventContributions(
  eventId: string,
  myUserId: string
): Promise<{ contributions: ContributionWithAuthor[]; revealed: boolean }> {
  const event = await getEvent(eventId, myUserId);
  if (!event) return { contributions: [], revealed: false };

  const revealed = event.is_revealed;

  // RLS returns only the rows this viewer may see (own always; everyone's once
  // revealed; host all). Before reveal, non-hosts get just their own rows,
  // which the UI keeps behind the lock screen anyway.
  const { data, error } = await supabase
    .from("event_contributions")
    .select("id, event_id, user_id, image_path, caption, link_url, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ContributionRow[];

  // Only surface everyone's content once revealed (host is always revealed).
  const visibleRows = revealed ? rows : [];
  if (visibleRows.length === 0) return { contributions: [], revealed };

  const authorIds = Array.from(new Set(visibleRows.map((r) => r.user_id)));
  const authors = await getProfiles(authorIds);
  const byId = new Map(authors.map((a) => [a.id, a]));

  const paths = visibleRows.map((r) => r.image_path).filter((p): p is string => !!p);
  let urlByPath = new Map<string, string | null>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(EVENT_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
  }

  const contributions: ContributionWithAuthor[] = visibleRows.map((r) => ({
    ...r,
    author: byId.get(r.user_id) ?? null,
    image_url: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
    media_type: mediaTypeFor(r.image_path),
  }));

  return { contributions, revealed };
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
