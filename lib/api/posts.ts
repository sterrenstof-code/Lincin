import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { listFeedPolls, type PollWithDetails } from "./polls";
import { listFeedCallPlans, type CallPlanWithDetails } from "./call-plans";
import { listFeedActivityEvents, listMemoryPosts, type ActivityEventWithActor } from "./activity-events";
import { listMySharedLists, type SharedListWithDetails } from "./shared-lists";

export type PostRow = {
  id: string;
  user_id: string;
  image_path: string | null;
  caption: string | null;
  link_url: string | null;
  created_at: string;
};

export type PostWithAuthor = PostRow & {
  author: Profile | null;
  /** Signed image URL — only present when image_path is set. */
  image_url: string | null;
  /** Aantal reacties op deze post (via embedded PostgREST count). */
  comment_count: number;
};

const POSTS_BUCKET = "posts";

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

/**
 * Maak een nieuwe post. Minstens één van imageUri, caption of linkUrl
 * is vereist. Image upload gebeurt cross-platform via blob fetch.
 */
export async function createPost(args: {
  userId: string;
  imageUri?: string;
  caption?: string | null;
  linkUrl?: string | null;
}): Promise<PostRow> {
  const caption = args.caption?.trim() || null;
  const linkUrl = args.linkUrl?.trim() || null;

  if (!args.imageUri && !caption && !linkUrl) {
    throw new Error("Lege post — voeg tekst, foto of link toe.");
  }

  const postId = cryptoRandomId();
  let imagePath: string | null = null;

  if (args.imageUri) {
    const ext = extFromUri(args.imageUri);
    imagePath = `${args.userId}/${postId}.${ext}`;
    const response = await fetch(args.imageUri);
    const blob = await response.blob();
    const contentType = blob.type || contentTypeForExt(ext);
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
    })
    .select("id, user_id, image_path, caption, link_url, created_at")
    .single();
  if (insErr) {
    if (imagePath) {
      await supabase.storage.from(POSTS_BUCKET).remove([imagePath]).catch(() => {});
    }
    throw insErr;
  }
  // Activiteitsmoment registreren — fire-and-forget
  createActivityEvent({ actorId: args.userId, kind: "post_created", postId: (data as PostRow).id }).catch(() => {});
  return data as PostRow;
}

async function attachSignedUrls(rows: PostRow[]): Promise<Map<string, string>> {
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  if (paths.length === 0) return new Map();
  const { data: signed, error: sErr } = await supabase.storage
    .from(POSTS_BUCKET)
    .createSignedUrls(paths, 60 * 60 * 24); // 24u — cache overleeft een dag navigeren
  if (sErr) throw sErr;
  return new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]));
}

export async function listFeedPosts(limit = 50): Promise<PostWithAuthor[]> {
  // comments(count) is een PostgREST embedded aggregate — geeft [{count: N}] per rij.
  // RLS op comments piggybacks op posts, dus de count respecteert bestaande visibility-regels.
  const { data, error } = await supabase
    .from("posts")
    .select("id, user_id, image_path, caption, link_url, created_at, comments(count)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as (PostRow & { comments: { count: number }[] })[];
  if (rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const authors = await getProfiles(authorIds);
  const byId = new Map(authors.map((a) => [a.id, a]));
  const urlByPath = await attachSignedUrls(rows);

  return rows.map((r) => ({
    ...r,
    author: byId.get(r.user_id) ?? null,
    image_url: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
    comment_count: (r.comments?.[0]?.count as number) ?? 0,
  }));
}

export async function listUserPosts(userId: string, limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, user_id, image_path, caption, link_url, created_at, comments(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as (PostRow & { comments: { count: number }[] })[];
  if (rows.length === 0) return [];

  const authors = await getProfiles([userId]);
  const author = authors[0] ?? null;
  const urlByPath = await attachSignedUrls(rows);

  return rows.map((r) => ({
    ...r,
    author,
    image_url: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
    comment_count: (r.comments?.[0]?.count as number) ?? 0,
  }));
}

export async function updatePostCaption(postId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ caption: caption.trim() || null })
    .eq("id", postId);
  if (error) throw error;
}

export async function deletePost(post: PostRow): Promise<void> {
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
    for (const a of activity.value) {
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
    const urlByPath = await attachSignedUrls(memoryRaw.value as PostRow[]);
    const authors = await getProfiles([myUserId]);
    const author = authors[0] ?? null;
    const memPost = memoryRaw.value[0] as PostRow;
    const memItem: PostWithAuthor = {
      ...memPost,
      author,
      image_url: memPost.image_path ? urlByPath.get(memPost.image_path) ?? null : null,
      comment_count: 0,
    };
    // Zet herinneringen bovenaan
    items.unshift({ type: "memory", id: `memory-${memPost.id}`, created_at: new Date().toISOString(), data: memItem });
  }

  // Sorteer op created_at aflopend (behalve memories die al bovenaan staan)
  const memories = items.filter((i) => i.type === "memory");
  const rest = items
    .filter((i) => i.type !== "memory")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return [...memories, ...rest];
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
