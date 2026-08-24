import { supabase } from "../supabase/client";
import { IMG, signedImageUrls } from "../media";
import { uriToBytes } from "../crypto/file";
import { getProfiles, type Profile } from "./profiles";
import { listFeedPolls, type PollWithDetails } from "./polls";
import { listFeedCallPlans, type CallPlanWithDetails } from "./call-plans";
import { createActivityEvent, listFeedActivityEvents, listMemoryPosts, type ActivityEventWithActor } from "./activity-events";
import { listMySharedLists, type SharedListWithDetails } from "./shared-lists";
import type { LinkPreview } from "./unfurl";

/**
 * Vondsten ("finds") — de inhoud van de feed.
 *
 * Een vondst is niet hetzelfde als een post: ze heeft een *bron* naast een
 * *deler*. Wie het gemaakt heeft (`source_author`, `source_title`) staat los
 * van wie het meebracht (`user_id`). Dat onderscheid is de hele reden dat de
 * feed als ontdekplek kan werken in plaats van als etalage.
 *
 * De unfurl-metadata wordt bij het plaatsen als momentopname in `meta`
 * bewaard — zie migratie 0042 voor het waarom.
 */

export type FindKind =
  | "note"      // losse gedachte
  | "image"     // eigen foto
  | "link"      // artikel, site, repo
  | "video"     // YouTube, Vimeo, …
  | "music"     // Spotify, Bandcamp, …
  | "fragment"  // citaat uit een boek/artikel
  | "fact"      // weetje
  | "idea";     // bouw-/ontwerpidee

/** Labels voor de kicker-regel boven elke vondst. */
export const KIND_LABELS: Record<FindKind, string> = {
  note: "Notitie",
  image: "Beeld",
  link: "Artikel",
  video: "Video",
  music: "Muziek",
  fragment: "Fragment",
  fact: "Weetje",
  idea: "Idee",
};

export type PostRow = {
  id: string;
  user_id: string;
  image_path: string | null;
  caption: string | null;
  link_url: string | null;
  created_at: string;
  kind: FindKind;
  source_title: string | null;
  source_author: string | null;
  body_text: string | null;
  tags: string[];
  meta: Partial<LinkPreview>;
};

export type PostWithAuthor = PostRow & {
  author: Profile | null;
  /** Signed image URL — only present when image_path is set. */
  image_url: string | null;
  /** Aantal reacties op deze post (via embedded PostgREST count). */
  comment_count: number;
};

const POSTS_BUCKET = "posts";

/** Eén bron van waarheid voor de kolomlijst — anders vergeet je er altijd één. */
const POST_COLUMNS =
  "id, user_id, image_path, caption, link_url, created_at, kind, source_title, source_author, body_text, tags, meta";

/** Vult ontbrekende velden aan voor rijen van vóór migratie 0042. */
function normalizeRow(row: any): PostRow {
  return {
    ...row,
    kind: (row.kind ?? (row.link_url ? "link" : row.image_path ? "image" : "note")) as FindKind,
    source_title: row.source_title ?? null,
    source_author: row.source_author ?? null,
    body_text: row.body_text ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    meta: row.meta && typeof row.meta === "object" ? row.meta : {},
  };
}

function extFromUri(uri: string, fallback = "jpg"): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  if (!match) return fallback;
  const ext = match[1].toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) return ext;
  return fallback;
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
    case "heif":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

/** Normaliseert tags: kleine letters, ontdubbeld, max 6. */
function normalizeTags(tags?: string[] | null): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase().replace(/^#/, "").slice(0, 24);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}

// -------------------------------------------------------
// Aanmaken
// -------------------------------------------------------

/**
 * Plaats een vondst. Minstens één van imageUri, caption, linkUrl of bodyText
 * is vereist.
 *
 * Let op de upload: `uriToBytes` in plaats van `fetch(uri).blob()`. Dat laatste
 * levert op iOS/Android lege bestanden op — dezelfde bug die eerder bij events
 * is gefixt.
 */
export async function createFind(args: {
  userId: string;
  kind?: FindKind;
  imageUri?: string;
  caption?: string | null;
  linkUrl?: string | null;
  bodyText?: string | null;
  sourceTitle?: string | null;
  sourceAuthor?: string | null;
  tags?: string[] | null;
  meta?: Partial<LinkPreview> | null;
}): Promise<PostRow> {
  const caption = args.caption?.trim() || null;
  const linkUrl = args.linkUrl?.trim() || null;
  const bodyText = args.bodyText?.trim() || null;
  const sourceTitle = args.sourceTitle?.trim() || null;
  const sourceAuthor = args.sourceAuthor?.trim() || null;
  const tags = normalizeTags(args.tags);

  if (!args.imageUri && !caption && !linkUrl && !bodyText) {
    throw new Error("Lege vondst — voeg tekst, beeld, link of een fragment toe.");
  }

  const kind: FindKind =
    args.kind ?? (linkUrl ? "link" : args.imageUri ? "image" : bodyText ? "fragment" : "note");

  const postId = cryptoRandomId();
  let imagePath: string | null = null;

  if (args.imageUri) {
    const ext = extFromUri(args.imageUri);
    imagePath = `${args.userId}/${postId}.${ext}`;
    const contentType = contentTypeForExt(ext);
    const bytes = await uriToBytes(args.imageUri);
    const blob = new Blob([bytes as any], { type: contentType });
    const { error: upErr } = await supabase.storage
      .from(POSTS_BUCKET)
      .upload(imagePath, blob, { contentType, upsert: false });
    if (upErr) throw upErr;
  }

  const { data, error: insErr } = await supabase
    .from("posts")
    .insert({
      id: postId,
      user_id: args.userId,
      image_path: imagePath,
      caption,
      link_url: linkUrl,
      kind,
      body_text: bodyText,
      source_title: sourceTitle,
      source_author: sourceAuthor,
      tags,
      meta: args.meta ?? {},
    })
    .select(POST_COLUMNS)
    .single();
  if (insErr) {
    if (imagePath) {
      await supabase.storage.from(POSTS_BUCKET).remove([imagePath]).catch(() => {});
    }
    throw insErr;
  }
  // Activiteitsmoment registreren — fire-and-forget
  createActivityEvent({ actorId: args.userId, kind: "post_created", postId: (data as any).id }).catch(() => {});
  return normalizeRow(data);
}

/** @deprecated Gebruik `createFind`. Blijft bestaan voor oudere callers. */
export async function createPost(args: {
  userId: string;
  imageUri?: string;
  caption?: string | null;
  linkUrl?: string | null;
}): Promise<PostRow> {
  return createFind(args);
}

// -------------------------------------------------------
// Lezen
// -------------------------------------------------------

/**
 * Telt reacties per post uit de universele `entity_comments` tabel
 * (entity_type = 'post'). Dit is dezelfde bron die CommentsSection en de
 * post-detailpagina tonen, zodat het badge-aantal klopt met wat zichtbaar is.
 */
async function countCommentsByPost(
  postIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("entity_comments")
    .select("entity_id")
    .eq("entity_type", "post")
    .in("entity_id", postIds);
  if (error) throw error;
  for (const row of (data ?? []) as { entity_id: string }[]) {
    counts.set(row.entity_id, (counts.get(row.entity_id) ?? 0) + 1);
  }
  return counts;
}

async function attachSignedUrls(rows: PostRow[]): Promise<Map<string, string>> {
  // Tegelformaat, niet het origineel: een telefoonfoto van 5 MB in een
  // tegel van 300 px was de reden dat de feed traag laadde. `signedImageUrls`
  // onthoudt de URL ook, zodat dezelfde foto bij een tabwissel niet opnieuw
  // gedownload wordt — zie lib/media.ts.
  return signedImageUrls(POSTS_BUCKET, rows.map((r) => r.image_path), IMG.tile);
}

async function hydrate(rows: PostRow[]): Promise<PostWithAuthor[]> {
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const authors = await getProfiles(authorIds);
  const byId = new Map(authors.map((a) => [a.id, a]));
  const urlByPath = await attachSignedUrls(rows);
  const commentCounts = await countCommentsByPost(rows.map((r) => r.id));

  return rows.map((r) => ({
    ...r,
    author: byId.get(r.user_id) ?? null,
    image_url: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
    comment_count: commentCounts.get(r.id) ?? 0,
  }));
}

export async function listFeedPosts(limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate((data ?? []).map(normalizeRow));
}

export async function listUserPosts(userId: string, limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate((data ?? []).map(normalizeRow));
}

/** Vondsten gefilterd op tag — voert de filterchips bovenaan de feed. */
export async function listPostsByTag(tag: string, limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .contains("tags", [tag.toLowerCase()])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate((data ?? []).map(normalizeRow));
}

export async function updatePostCaption(postId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ caption: caption.trim() || null })
    .eq("id", postId);
  if (error) throw error;
}

/** Accepteert elk object met minstens id + image_path — callers geven vaak een hele rij mee. */
export async function deletePost(post: {
  id: string;
  image_path?: string | null;
  [extra: string]: unknown;
}): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", post.id);
  if (error) throw error;
  if (post.image_path) {
    await supabase.storage.from(POSTS_BUCKET).remove([post.image_path]).catch(() => {});
  }
}

// -------------------------------------------------------
// Unified feed
// -------------------------------------------------------

export type FeedItem =
  | { type: "post";        id: string; created_at: string; data: PostWithAuthor }
  | { type: "poll";        id: string; created_at: string; data: PollWithDetails }
  | { type: "call_plan";   id: string; created_at: string; data: CallPlanWithDetails }
  | { type: "activity";    id: string; created_at: string; data: ActivityEventWithActor }
  | { type: "memory";      id: string; created_at: string; data: PostWithAuthor }
  | { type: "shared_list"; id: string; created_at: string; data: SharedListWithDetails };

export async function listUnifiedFeed(myUserId: string, limit = 60): Promise<FeedItem[]> {
  const [posts, polls, callPlans, activity, memoryRaw, sharedLists] = await Promise.allSettled([
    listFeedPosts(limit),
    listFeedPolls(20),
    listFeedCallPlans(10),
    listFeedActivityEvents(30),
    listMemoryPosts(myUserId),
    listMySharedLists(myUserId),
  ]);

  const items: FeedItem[] = [];

  if (posts.status === "fulfilled") {
    for (const p of posts.value) {
      items.push({ type: "post", id: p.id, created_at: p.created_at, data: p });
    }
  }
  if (polls.status === "fulfilled") {
    for (const p of polls.value) {
      items.push({ type: "poll", id: p.id, created_at: p.created_at, data: p });
    }
  }
  if (callPlans.status === "fulfilled") {
    for (const p of callPlans.value) {
      items.push({ type: "call_plan", id: p.id, created_at: p.created_at, data: p });
    }
  }
  if (activity.status === "fulfilled") {
    /**
     * "X heeft een foto geplaatst" naast diezelfde foto is dezelfde
     * gebeurtenis twee keer, en de kale melding is de mindere van de twee:
     * de vondst zelf toont het beeld, de titel en wie het deelde.
     *
     * De activiteitsregel is er voor wat je **niet** al ziet — een nieuwe
     * vriendschap, een event dat is aangemaakt — en voor vondsten die
     * buiten de opgehaalde pagina vallen. Staat de post er wél bij, dan
     * laten we de melding weg.
     */
    const shownPostIds = new Set(
      items.filter((i) => i.type === "post").map((i) => i.id)
    );
    for (const a of activity.value) {
      if (a.post_id && shownPostIds.has(a.post_id)) continue;
      items.push({ type: "activity", id: a.id, created_at: a.created_at, data: a });
    }
  }
  if (sharedLists.status === "fulfilled") {
    for (const l of sharedLists.value) {
      items.push({ type: "shared_list", id: l.id, created_at: l.created_at, data: l });
    }
  }

  // Herinneringen bovenaan plaatsen als aparte kaart (max 1)
  if (memoryRaw.status === "fulfilled" && memoryRaw.value.length > 0) {
    const memPost = normalizeRow(memoryRaw.value[0]);
    const urlByPath = await attachSignedUrls([memPost]);
    const authors = await getProfiles([myUserId]);
    const author = authors[0] ?? null;
    const memItem: PostWithAuthor = {
      ...memPost,
      author,
      image_url: memPost.image_path ? urlByPath.get(memPost.image_path) ?? null : null,
      comment_count: 0,
    };
    items.unshift({ type: "memory", id: `memory-${memPost.id}`, created_at: new Date().toISOString(), data: memItem });
  }

  // Sorteer op created_at aflopend (behalve memories die al bovenaan staan)
  const memories = items.filter((i) => i.type === "memory");
  const rest = items
    .filter((i) => i.type !== "memory")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return [...memories, ...rest];
}

/** Alle tags die in de zichtbare feed voorkomen, op frequentie gesorteerd. */
export function collectTags(items: FeedItem[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.type !== "post" && item.type !== "memory") continue;
    for (const tag of item.data.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

function cryptoRandomId(): string {
  if (typeof (globalThis.crypto as any)?.randomUUID === "function") {
    return (globalThis.crypto as any).randomUUID();
  }
  const bytes = new Uint8Array(16);
  (globalThis.crypto as any).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" +
    hex.slice(20)
  );
}
