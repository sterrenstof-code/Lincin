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
  /** 0055 — geüploade clip. `image_path` blijft het stilstaande voorblad. */
  video_path: string | null;
  /**
   * 0055 — `feed` gaat rond bij je lincs, `profile` staat alleen op je bord.
   *
   * Geen privé-vlag: wie je profiel bezoekt ziet hem gewoon. Het onderscheid
   * gaat over rondsturen, niet over verbergen — zie de migratie.
   */
  visibility: PostVisibility;
  /** 0055 — gevuld is vastgeprikt; de laatst vastgeprikte staat vooraan. */
  pinned_at: string | null;
  /** 0055 — maat op het moodboard, in rastercellen. */
  tile_span: TileSpan;
};

/** Waar een vondst terechtkomt. Zie `visibility` hierboven. */
export type PostVisibility = "feed" | "profile";

/**
 * De vier maten die een tegel op het moodboard kan hebben.
 *
 * Vier en niet meer: een bord leest als samengesteld doordat de dingen
 * verschillen in maat, en het valt uit elkaar zodra élk ding zijn eigen
 * maat heeft. Dezelfde afweging als de twee beeldverhoudingen van de tegel
 * in de feed.
 */
export type TileSpan = "1x1" | "2x1" | "1x2" | "2x2";

/** Breedte en hoogte in cellen, uit de opgeslagen tekst. */
export function spanCells(span: TileSpan): { w: number; h: number } {
  const [w, h] = span.split("x").map((n) => Number(n) || 1);
  return { w, h };
}

export type PostWithAuthor = PostRow & {
  author: Profile | null;
  /** Signed image URL — only present when image_path is set. */
  image_url: string | null;
  /**
   * Signed URL van de clip, als er een is.
   *
   * Ondertekend zónder beeldbewerking: de transformatie-endpoint van
   * Supabase geldt voor afbeeldingen, en een video daarlangs sturen levert
   * geen kleinere video maar een fout.
   */
  video_url: string | null;
  /** Aantal reacties op deze post (via embedded PostgREST count). */
  comment_count: number;
  /**
   * Alle foto's van een album, op volgorde, inclusief de omslag. Leeg bij
   * een vondst met één of geen foto — dan zegt `image_url` alles.
   */
  album_urls?: string[];
  /**
   * De opslagpaden van diezelfde foto's, in dezelfde volgorde.
   *
   * Nodig als **cachesleutel**, niet om iets mee op te halen. `PostCarousel`
   * had daar al een `cacheKeys`-prop voor, doorgegeven tot in `SafeImage` —
   * en geen enkele aanroeper vulde hem. De carrousel viel dus terug op de
   * URL zelf, en dat is precies de fout die lib/media.ts met zoveel woorden
   * beschrijft: een signed URL krijgt bij elke ondertekening een nieuw
   * token, dus dezelfde foto onder een andere sleutel, dus opnieuw
   * downloaden. Bij een album van tien foto's is dat tien keer.
   */
  album_paths?: string[];
  /** Hoeveel emoji er onder deze vondst staan. */
  reaction_count: number;
  /** Hoe vaak deze vondst omhoog geduwd is. */
  boost_count: number;
  /**
   * Reacties + emoji + duwen bij elkaar: hoeveel er met deze vondst gedáán
   * is. Een vondst met tien duimpjes en nul woorden is even goed waar het
   * over gaat als een met drie reacties.
   *
   * Een duw weegt zwaarder dan de rest — zie `INTERACTION_WEIGHTS`.
   */
  interaction_count: number;
};

const POSTS_BUCKET = "posts";

/**
 * Eén bron van waarheid voor de kolomlijst — anders vergeet je er altijd één.
 *
 * Geëxporteerd sinds de detailpagina haar eigen lijstje bijhield en daarin
 * `body_text` ontbrak. Zolang een notitie naar `caption` schreef viel dat
 * niet op; sinds notities opmaak kregen en naar `body_text` schrijven, was
 * de pagina leeg. Precies waar de zin hierboven voor waarschuwde.
 */
export const POST_COLUMNS =
  "id, user_id, image_path, caption, link_url, created_at, kind, source_title, source_author, body_text, tags, meta, video_path, visibility, pinned_at, tile_span";

/** Vult ontbrekende velden aan voor rijen van vóór migratie 0042. */
export function normalizeRow(row: any): PostRow {
  return {
    ...row,
    kind: (row.kind ?? (row.link_url ? "link" : row.image_path ? "image" : "note")) as FindKind,
    source_title: row.source_title ?? null,
    source_author: row.source_author ?? null,
    body_text: row.body_text ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    meta: row.meta && typeof row.meta === "object" ? row.meta : {},
    video_path: row.video_path ?? null,
    visibility: row.visibility === "profile" ? "profile" : "feed",
    pinned_at: row.pinned_at ?? null,
    tile_span: TILE_SPANS.includes(row.tile_span) ? row.tile_span : "1x1",
  };
}

/** De toegestane maten, als lijst — gelijk aan de check in 0055. */
export const TILE_SPANS: TileSpan[] = ["1x1", "2x1", "1x2", "2x2"];

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
    case "mp4":
    case "m4v":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "webm":
      return "video/webm";
    default:
      return "image/jpeg";
  }
}

/** De extensies die de bucket sinds 0055 als bewegend beeld aanneemt. */
const VIDEO_EXTS = new Set(["mp4", "m4v", "mov", "webm"]);

export function isVideoUri(uri: string): boolean {
  const m = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return !!m && VIDEO_EXTS.has(m[1].toLowerCase());
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
  /**
   * Meer foto's bij dezelfde vondst — een album. De eerste is de omslag en
   * belandt ook in `posts.image_path`, zodat alles wat één foto verwacht
   * ongewijzigd blijft werken.
   */
  imageUris?: string[];
  /**
   * Een geüploade clip. Los van `imageUris`, want hij is iets anders: die
   * lijst is een album om doorheen te bladeren, dit is bewegend beeld. Een
   * vondst mag allebei hebben — dan is de foto het voorblad.
   */
  videoUri?: string | null;
  caption?: string | null;
  linkUrl?: string | null;
  bodyText?: string | null;
  sourceTitle?: string | null;
  sourceAuthor?: string | null;
  tags?: string[] | null;
  meta?: Partial<LinkPreview> | null;
  /** Standaard `feed`; `profile` zet hem alleen op je eigen bord. */
  visibility?: PostVisibility;
}): Promise<PostRow> {
  const caption = args.caption?.trim() || null;
  const linkUrl = args.linkUrl?.trim() || null;
  const bodyText = args.bodyText?.trim() || null;
  const sourceTitle = args.sourceTitle?.trim() || null;
  const sourceAuthor = args.sourceAuthor?.trim() || null;
  const tags = normalizeTags(args.tags);

  if (!args.imageUri && !args.imageUris?.length && !args.videoUri && !caption && !linkUrl && !bodyText) {
    throw new Error("Lege vondst — voeg tekst, beeld, link of een fragment toe.");
  }

  const kind: FindKind =
    args.kind ?? (linkUrl ? "link" : args.imageUri ? "image" : bodyText ? "fragment" : "note");

  const postId = cryptoRandomId();
  let imagePath: string | null = null;

  const uris = args.imageUris?.length ? args.imageUris : args.imageUri ? [args.imageUri] : [];
  const uploadedPaths: string[] = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    const ext = extFromUri(uri);
    // De eerste houdt het pad dat hij altijd had; de volgende krijgen een
    // teller erachter. Zo blijft één-foto-per-vondst bit voor bit hetzelfde.
    const path = i === 0 ? `${args.userId}/${postId}.${ext}` : `${args.userId}/${postId}-${i}.${ext}`;
    const contentType = contentTypeForExt(ext);
    const bytes = await uriToBytes(uri);
    const blob = new Blob([bytes as any], { type: contentType });
    const { error: upErr } = await supabase.storage
      .from(POSTS_BUCKET)
      .upload(path, blob, { contentType, upsert: false });
    if (upErr) {
      // Wat al geüpload was weer weg: een halve vondst is geen vondst.
      await supabase.storage.from(POSTS_BUCKET).remove(uploadedPaths).catch(() => {});
      throw upErr;
    }
    uploadedPaths.push(path);
  }
  imagePath = uploadedPaths[0] ?? null;

  /**
   * De clip, als er een is.
   *
   * Ná de foto's en met dezelfde opruimregel: mislukt hij, dan gaat alles
   * wat er al stond ook weg. Een vondst met een voorblad maar zonder de
   * video die je bedoelde is erger dan geen vondst — die eerste ziet eruit
   * alsof hij klopt.
   */
  let videoPath: string | null = null;
  if (args.videoUri) {
    const ext = extFromUri(args.videoUri, "mp4");
    const path = `${args.userId}/${postId}-clip.${ext}`;
    const contentType = contentTypeForExt(ext);
    const bytes = await uriToBytes(args.videoUri);
    const blob = new Blob([bytes as any], { type: contentType });
    const { error: upErr } = await supabase.storage
      .from(POSTS_BUCKET)
      .upload(path, blob, { contentType, upsert: false });
    if (upErr) {
      await supabase.storage.from(POSTS_BUCKET).remove(uploadedPaths).catch(() => {});
      throw upErr;
    }
    uploadedPaths.push(path);
    videoPath = path;
  }

  const { data, error: insErr } = await supabase
    .from("posts")
    .insert({
      id: postId,
      user_id: args.userId,
      image_path: imagePath,
      video_path: videoPath,
      caption,
      link_url: linkUrl,
      kind,
      body_text: bodyText,
      source_title: sourceTitle,
      source_author: sourceAuthor,
      tags,
      meta: args.meta ?? {},
      visibility: args.visibility ?? "feed",
    })
    .select(POST_COLUMNS)
    .single();
  if (insErr) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(POSTS_BUCKET).remove(uploadedPaths).catch(() => {});
    }
    throw insErr;
  }

  // Een album legt álle foto's vast, ook de omslag: dan is er één lijst om
  // door te bladeren in plaats van "de omslag plus de rest".
  if (uploadedPaths.length > 1) {
    await supabase.from("post_images").insert(
      uploadedPaths.map((path, position) => ({ post_id: postId, image_path: path, position }))
    );
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

/**
 * De clips, ondertekend.
 *
 * Apart van `attachSignedUrls` en niet ernaast gepropt, omdat het één
 * belangrijk verschil heeft: géén `IMG.tile`. De transformatie-endpoint
 * van Supabase schaalt afbeeldingen; een video daarlangs sturen levert
 * geen kleinere video op maar een fout, en dan is de clip stuk terwijl het
 * voorblad het doet — het soort fout dat je pas op de detailpagina ziet.
 */
async function attachSignedVideos(rows: PostRow[]): Promise<Map<string, string>> {
  const paths = Array.from(
    new Set(rows.map((r) => r.video_path).filter((p): p is string => !!p))
  );
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await supabase.storage
    .from(POSTS_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}

/**
 * De extra foto's van albums, in één vraag voor de hele lijst.
 * Vondsten zonder album staan er niet in — die kosten dus ook niets.
 */
async function attachAlbums(
  postIds: string[]
): Promise<Map<string, { urls: string[]; paths: string[] }>> {
  const out = new Map<string, { urls: string[]; paths: string[] }>();
  if (postIds.length === 0) return out;
  const { data } = await supabase
    .from("post_images")
    .select("post_id, image_path, position")
    .in("post_id", postIds)
    .order("position", { ascending: true });
  if (!data || data.length === 0) return out;

  const urls = await signedImageUrls(POSTS_BUCKET, data.map((r) => r.image_path), IMG.tile);
  for (const row of data) {
    const url = urls.get(row.image_path);
    if (!url) continue;
    // URL en pad blijven per foto naast elkaar staan: de carrousel zoekt de
    // sleutel op index op, dus een foto die overgeslagen wordt mag de twee
    // lijsten niet uit de pas laten lopen.
    const entry = out.get(row.post_id) ?? { urls: [], paths: [] };
    entry.urls.push(url);
    entry.paths.push(row.image_path);
    out.set(row.post_id, entry);
  }
  return out;
}

/**
 * De foto's van één album, op detailmaat. Leeg als het geen album is.
 *
 * Geeft de paden erbij terug, om dezelfde reden als `attachAlbums`: de
 * carrousel heeft ze nodig als cachesleutel, en zonder die sleutel haalt
 * hij dezelfde foto opnieuw op zodra de ondertekening ververst.
 */
export async function getAlbumUrls(
  postId: string
): Promise<{ urls: string[]; paths: string[] }> {
  const { data } = await supabase
    .from("post_images")
    .select("image_path, position")
    .eq("post_id", postId)
    .order("position", { ascending: true });
  if (!data || data.length === 0) return { urls: [], paths: [] };
  const signed = await signedImageUrls(POSTS_BUCKET, data.map((r) => r.image_path), IMG.hero);
  const urls: string[] = [];
  const paths: string[] = [];
  for (const row of data) {
    const url = signed.get(row.image_path);
    if (!url) continue;
    urls.push(url);
    paths.push(row.image_path);
  }
  return { urls, paths };
}

/**
 * Wat een handeling meetelt voor "meeste interactie".
 *
 * ---------------------------------------------------------------
 * WAAROM EEN DUW ZWAARDER WEEGT
 * ---------------------------------------------------------------
 * Emoji en duwen telden allebei voor één. Maar ze zeggen niet hetzelfde:
 * een emoji is een reactie op wat je ziet ("leuk"), een duw is een oordeel
 * over wie het nog meer moet zien ("zet dit hoger"). Dat tweede is precies
 * de vraag die deze rubriek stelt, dus telt het zwaarder — één duw weegt
 * op tegen drie duimpjes.
 *
 * Een reactie in woorden weegt tussenin: er is meer moeite voor gedaan dan
 * voor een emoji, maar het zegt niets over wie het nog meer moet zien.
 */
const INTERACTION_WEIGHTS = { comment: 2, reaction: 1, boost: 3 } as const;

/** Emoji en duwen per vondst, allebei in één vraag voor de hele lijst. */
async function countSignals(
  postIds: string[]
): Promise<Map<string, { reactions: number; boosts: number }>> {
  const counts = new Map<string, { reactions: number; boosts: number }>();
  if (postIds.length === 0) return counts;

  const bump = (postId: string, key: "reactions" | "boosts") => {
    const entry = counts.get(postId) ?? { reactions: 0, boosts: 0 };
    entry[key] += 1;
    counts.set(postId, entry);
  };

  const [reactions, boosts] = await Promise.all([
    supabase.from("post_reactions").select("post_id").in("post_id", postIds),
    supabase.from("post_boosts").select("post_id").in("post_id", postIds),
  ]);
  for (const row of reactions.data ?? []) bump(row.post_id, "reactions");
  for (const row of boosts.data ?? []) bump(row.post_id, "boosts");
  return counts;
}

async function hydrate(rows: PostRow[]): Promise<PostWithAuthor[]> {
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const postIds = rows.map((r) => r.id);
  /**
   * Vijf vragen die niets van elkaar weten, dus vijf vragen tegelijk.
   *
   * Ze stonden achter elkaar met een `await` per regel: profielen, dan
   * beeld-URL's, dan albums, dan emoji en duwen, dan reacties. Geen van de
   * vijf heeft de uitkomst van een van de andere nodig, dus de wachttijd
   * was gewoon de som — vijf keer heen en weer naar Supabase voordat er ook
   * maar één pixel op het scherm kwam. Dat is de langzaamste plek in de
   * app, want dit is wat de feed laadt.
   *
   * Naast elkaar is de wachttijd die van de traagste.
   */
  const [authors, urlByPath, videoByPath, albums, signalCounts, commentCounts] =
    await Promise.all([
      getProfiles(authorIds),
      attachSignedUrls(rows),
      attachSignedVideos(rows),
      attachAlbums(postIds),
      countSignals(postIds),
      countCommentsByPost(postIds),
    ]);
  const byId = new Map(authors.map((a) => [a.id, a]));

  return rows.map((r) => ({
    ...r,
    author: byId.get(r.user_id) ?? null,
    image_url: r.image_path ? urlByPath.get(r.image_path) ?? null : null,
    video_url: r.video_path ? videoByPath.get(r.video_path) ?? null : null,
    comment_count: commentCounts.get(r.id) ?? 0,
    album_urls: albums.get(r.id)?.urls,
    album_paths: albums.get(r.id)?.paths,
    reaction_count: signalCounts.get(r.id)?.reactions ?? 0,
    boost_count: signalCounts.get(r.id)?.boosts ?? 0,
    interaction_count:
      (commentCounts.get(r.id) ?? 0) * INTERACTION_WEIGHTS.comment +
      (signalCounts.get(r.id)?.reactions ?? 0) * INTERACTION_WEIGHTS.reaction +
      (signalCounts.get(r.id)?.boosts ?? 0) * INTERACTION_WEIGHTS.boost,
  }));
}

export async function listFeedPosts(limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    // Alleen wat rond hoort te gaan. Wat je op je bord zet zonder het te
    // sturen staat op `profile` en hoort hier niet — zie 0055.
    .eq("visibility", "feed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate((data ?? []).map(normalizeRow));
}

/**
 * Iemands bord.
 *
 * Vastgeprikt eerst, en daarbinnen de laatst vastgeprikte vooraan; de rest
 * op tijd. `nullsFirst: false` is wat "vastgeprikt eerst" doet — zonder dat
 * sorteert Postgres NULL bovenaan bij aflopend en staat álles wat je níet
 * vastprikte juist bovenin.
 *
 * Er wordt hier niet op `visibility` gefilterd, en dat is de bedoeling: een
 * vondst die de feed niet in ging staat wél op je bord. Dat ís het verschil
 * tussen de twee waarden.
 */
export async function listUserPosts(userId: string, limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("user_id", userId)
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate((data ?? []).map(normalizeRow));
}

/**
 * De drie knoppen van het moodboard.
 *
 * Alle drie hetzelfde patroon: één kolom, `eq("user_id")` erbij zodat de
 * bewerking niet alleen door RLS maar ook door de query zelf begrensd is,
 * en de bijgewerkte rij terug zodat de aanroeper niet hoeft te raden wat
 * er nu staat. De policy uit 0053 maakt dit überhaupt mogelijk — vóór die
 * migratie weigerde RLS élke update op `posts` zonder een fout te geven.
 */
export async function setPostTileSpan(
  postId: string,
  userId: string,
  span: TileSpan
): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ tile_span: span })
    .eq("id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** `null` maakt hem los; een tijdstempel prikt hem vast. */
export async function setPostPinned(
  postId: string,
  userId: string,
  pinned: boolean
): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setPostVisibility(
  postId: string,
  userId: string,
  visibility: PostVisibility
): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({ visibility })
    .eq("id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Vondsten gefilterd op tag — voert de filterchips bovenaan de feed. */
export async function listPostsByTag(tag: string, limit = 50): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("visibility", "feed")
    .contains("tags", [tag.toLowerCase()])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate((data ?? []).map(normalizeRow));
}

/**
 * Een vondst bijwerken nadat hij geplaatst is.
 *
 * `updatePostCaption` hiernaast raakt alleen het onderschrift, en dat is
 * genoeg voor het snelle menu in de feed. Op de detailpagina moet je ook de
 * vóndst zelf kunnen bijstellen: sinds notities, ideeën en weetjes naar
 * `body_text` schrijven is het onderschrift daar de toelichting van de
 * deler en niet het stuk. Wie een typfout in zijn notitie zag, kon hem
 * alleen weggooien en opnieuw schrijven.
 *
 * Alleen wat je meegeeft wordt geschreven — een veld dat niet in het object
 * staat blijft wat het was. Zo kan een aanroeper die alleen de kop bijstelt
 * de tekst niet per ongeluk leegmaken.
 */
export async function updatePost(
  postId: string,
  fields: { caption?: string | null; body_text?: string | null }
): Promise<void> {
  const patch: { caption?: string | null; body_text?: string | null } = {};
  if ("caption" in fields) patch.caption = fields.caption?.trim() || null;
  if ("body_text" in fields) patch.body_text = fields.body_text?.trim() || null;
  if (Object.keys(patch).length === 0) return;

  /**
   * `select()` erachter, en niet omdat we de rij nodig hebben.
   *
   * Weigert row level security de update, dan is dat geen fout maar nul
   * geraakte rijen — PostgREST geeft netjes `error: null` terug en de app
   * meldt vrolijk dat het bewaard is. Precies wat er hier gebeurde zolang
   * `posts` geen update-policy had (zie migratie 0053). Door de rij terug
   * te vragen weten we of er echt iets veranderd is.
   */
  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", postId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Deze vondst kon niet bijgewerkt worden — is hij van jou?");
  }
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
      video_url: null,
      comment_count: 0,
      reaction_count: 0,
      boost_count: 0,
      interaction_count: 0,
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
