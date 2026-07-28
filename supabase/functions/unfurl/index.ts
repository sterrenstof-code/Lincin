/**
 * Edge Function: unfurl
 *
 * Zet een kale URL om in rijke metadata: titel, omschrijving, beeld, auteur,
 * speelduur en een iframe-bare embed-URL. Dit is het verschil tussen "iemand
 * dumpte een link" en "iemand deelde iets moois".
 *
 * Waarom server-side: de browser mag door CORS de meeste sites niet ophalen,
 * en we willen niet dat elke client van elke gebruiker het hele web afgaat.
 * De functie cachet in `link_previews`, dus de tweede persoon die dezelfde
 * link deelt krijgt het antwoord gratis en meteen.
 *
 * De client roept dit één keer aan bij het *plaatsen* van een vondst en
 * bewaart het resultaat in `posts.meta`. De feed leest dus nooit hierlangs.
 *
 * Deploy:
 *   supabase functions deploy unfurl
 *   (WEL met JWT-verificatie — dit is geen open proxy.)
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected).
 */

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore Deno
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-ignore Deno
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

/** Hoe lang een geslaagde preview vers blijft. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dagen
/** Mislukte fetches korter cachen — sites komen terug. */
const ERROR_TTL_MS = 6 * 60 * 60 * 1000; // 6 uur
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;

const UA =
  "Mozilla/5.0 (compatible; LincinBot/1.0; +https://lincin.vercel.app) AppleWebKit/537.36";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface Preview {
  url: string;
  canonical_url: string | null;
  provider: string;
  kind: "link" | "video" | "music";
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  author: string | null;
  embed_url: string | null;
  duration_s: number | null;
  favicon_url: string | null;
  word_count: number | null;
}

function emptyPreview(url: string): Preview {
  return {
    url,
    canonical_url: null,
    provider: "generic",
    kind: "link",
    title: null,
    description: null,
    image_url: null,
    site_name: null,
    author: null,
    embed_url: null,
    duration_s: null,
    favicon_url: null,
    word_count: null,
  };
}

// ---------------------------------------------------------------
// URL-normalisatie & veiligheid
// ---------------------------------------------------------------

/** Tracking-parameters die niets aan de inhoud veranderen. */
const JUNK_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^mc_(cid|eid)$/i,
  /^igshid$/i, /^ref_?src$/i, /^si$/i, /^_hs(enc|mi)$/i,
];

/**
 * Normaliseert een URL zodat twee mensen die dezelfde pagina delen op
 * dezelfde cache-sleutel uitkomen.
 */
function normalizeUrl(raw: string): string {
  let input = raw.trim();
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;
  const u = new URL(input);
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (JUNK_PARAMS.some((re) => re.test(key))) u.searchParams.delete(key);
  }
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}

/**
 * Basale SSRF-bescherming: geen andere schema's, geen loopback, geen
 * private ranges, geen cloud-metadata endpoints.
 */
function assertPublicUrl(u: URL): void {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Alleen http(s) URL's zijn toegelaten.");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("Interne host geweigerd.");
  }
  // IPv4-literals in private/link-local ranges
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      throw new Error("Privaat IP geweigerd.");
    }
  }
  if (host === "::1" || host.startsWith("[")) {
    throw new Error("IPv6-literal geweigerd.");
  }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------
// HTTP-helpers
// ---------------------------------------------------------------

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept, "accept-language": "nl,en;q=0.8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Leest maximaal MAX_HTML_BYTES — de <head> zit altijd vooraan. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* al gesloten */ }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(url, "application/json");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------
// HTML meta-parsing (regex — geen DOM nodig voor <head>-tags)
// ---------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function clean(s: string | null | undefined, max = 400): string | null {
  if (!s) return null;
  const out = decodeEntities(s).replace(/\s+/g, " ").trim();
  if (!out) return null;
  return out.length > max ? out.slice(0, max - 1).trimEnd() + "…" : out;
}

/** Zoekt <meta property|name="key" content="…"> in beide attribuutvolgordes. */
function metaTag(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*?content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name|itemprop)=["']${k}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function firstMeta(html: string, keys: string[]): string | null {
  for (const k of keys) {
    const v = metaTag(html, k);
    if (v) return v;
  }
  return null;
}

function absolutize(candidate: string | null, base: string): string | null {
  if (!candidate) return null;
  try { return new URL(candidate, base).toString(); } catch { return null; }
}

/** Ruwe woordentelling van de zichtbare tekst → leestijd in de UI. */
function estimateWordCount(html: string): number | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 200) return null;
  const words = text.split(" ").length;
  return words > 50 ? words : null;
}

/** ISO-8601 duration (PT4M13S) of kale seconden → seconden. */
function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const iso = raw.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) {
    return Number(iso[1] ?? 0) * 3600 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// ---------------------------------------------------------------
// Provider-specifieke unfurls
// ---------------------------------------------------------------

function youtubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (!host.endsWith("youtube.com") && host !== "youtube-nocookie.com") return null;
  const v = u.searchParams.get("v");
  if (v) return v;
  const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
  return m?.[1] ?? null;
}

async function unfurlYouTube(u: URL, base: Preview): Promise<Preview | null> {
  const id = youtubeId(u);
  if (!id) return null;
  const oe = await fetchJson(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
  );
  return {
    ...base,
    provider: "youtube",
    kind: "video",
    title: clean(oe?.title) ?? base.title,
    author: clean(oe?.author_name) ?? base.author,
    site_name: "YouTube",
    image_url: oe?.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embed_url: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`,
    canonical_url: `https://www.youtube.com/watch?v=${id}`,
  };
}

async function unfurlOEmbed(
  endpoint: string,
  u: URL,
  base: Preview,
  patch: Partial<Preview>
): Promise<Preview | null> {
  const oe = await fetchJson(`${endpoint}${encodeURIComponent(u.toString())}`);
  if (!oe) return null;
  const embedSrc = typeof oe.html === "string"
    ? oe.html.match(/src=["']([^"']+)["']/i)?.[1] ?? null
    : null;
  return {
    ...base,
    title: clean(oe.title) ?? base.title,
    author: clean(oe.author_name) ?? base.author,
    description: clean(oe.description) ?? base.description,
    image_url: oe.thumbnail_url ?? base.image_url,
    duration_s: typeof oe.duration === "number" ? Math.round(oe.duration) : base.duration_s,
    embed_url: embedSrc,
    site_name: clean(oe.provider_name) ?? base.site_name,
    ...patch,
  };
}

function spotifyEmbed(u: URL): string | null {
  const m = u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

async function unfurlGitHub(u: URL, base: Preview): Promise<Preview | null> {
  const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!m) return null;
  const repo = await fetchJson(`https://api.github.com/repos/${m[1]}/${m[2]}`);
  if (!repo) return null;
  return {
    ...base,
    provider: "github",
    kind: "link",
    title: repo.full_name ?? base.title,
    description: clean(repo.description) ?? base.description,
    author: repo.owner?.login ?? base.author,
    site_name: "GitHub",
    image_url: `https://opengraph.githubassets.com/1/${m[1]}/${m[2]}`,
  };
}

// ---------------------------------------------------------------
// Generieke OpenGraph-unfurl
// ---------------------------------------------------------------

async function unfurlGeneric(u: URL, base: Preview): Promise<Preview> {
  const res = await fetchWithTimeout(u.toString(), "text/html,application/xhtml+xml");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";
  const finalUrl = res.url || u.toString();

  // Direct beeld of media zonder HTML-wrapper
  if (/^image\//i.test(contentType)) {
    return { ...base, kind: "link", image_url: finalUrl, title: base.title ?? u.pathname.split("/").pop() ?? null };
  }
  if (!/html|xml/i.test(contentType)) {
    return { ...base, canonical_url: finalUrl };
  }

  const html = await readCapped(res);

  const title =
    clean(firstMeta(html, ["og:title", "twitter:title"]), 200) ??
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 200);

  const ogType = firstMeta(html, ["og:type"]) ?? "";
  const ogVideo = firstMeta(html, ["og:video:url", "og:video:secure_url", "og:video"]);
  const isVideo = /video/i.test(ogType) || !!ogVideo;
  const isMusic = /music|song|album/i.test(ogType);

  return {
    ...base,
    provider: "generic",
    kind: isVideo ? "video" : isMusic ? "music" : "link",
    title,
    description: clean(firstMeta(html, ["og:description", "twitter:description", "description"])),
    image_url: absolutize(firstMeta(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]), finalUrl),
    site_name: clean(firstMeta(html, ["og:site_name", "application-name"]), 80),
    author: clean(firstMeta(html, ["article:author", "author", "twitter:creator", "book:author"]), 120),
    canonical_url: absolutize(html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null, finalUrl) ?? finalUrl,
    favicon_url: absolutize(html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? "/favicon.ico", finalUrl),
    duration_s: parseDuration(firstMeta(html, ["og:video:duration", "video:duration", "music:duration", "duration"])),
    embed_url: isVideo ? absolutize(ogVideo, finalUrl) : null,
    word_count: estimateWordCount(html),
  };
}

// ---------------------------------------------------------------
// Router
// ---------------------------------------------------------------

async function buildPreview(normalized: string): Promise<Preview> {
  const u = new URL(normalized);
  assertPublicUrl(u);

  const base = emptyPreview(normalized);
  const host = u.hostname.replace(/^www\./, "");

  try {
    if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) {
      const yt = await unfurlYouTube(u, base);
      if (yt) return yt;
    }
    if (/(^|\.)vimeo\.com$/.test(host)) {
      const v = await unfurlOEmbed("https://vimeo.com/api/oembed.json?url=", u, base, {
        provider: "vimeo", kind: "video", site_name: "Vimeo",
      });
      if (v) return v;
    }
    if (/(^|\.)spotify\.com$/.test(host)) {
      const embed = spotifyEmbed(u);
      const s = await unfurlOEmbed("https://open.spotify.com/oembed?url=", u, base, {
        provider: "spotify", kind: "music", site_name: "Spotify", embed_url: embed,
      });
      if (s) return s;
    }
    if (/(^|\.)soundcloud\.com$/.test(host)) {
      const s = await unfurlOEmbed("https://soundcloud.com/oembed?format=json&url=", u, base, {
        provider: "soundcloud", kind: "music", site_name: "SoundCloud",
      });
      if (s) return s;
    }
    if (/(^|\.)music\.apple\.com$/.test(host)) {
      const generic = await unfurlGeneric(u, base);
      return {
        ...generic,
        provider: "applemusic",
        kind: "music",
        site_name: "Apple Music",
        embed_url: u.toString().replace("//music.apple.com", "//embed.music.apple.com"),
      };
    }
    if (/(^|\.)bandcamp\.com$/.test(host)) {
      const generic = await unfurlGeneric(u, base);
      return { ...generic, provider: "bandcamp", kind: "music", site_name: generic.site_name ?? "Bandcamp" };
    }
    if (host === "github.com") {
      const g = await unfurlGitHub(u, base);
      if (g) return g;
    }
  } catch {
    // Provider-pad faalde — val terug op de generieke unfurl hieronder.
  }

  return await unfurlGeneric(u, base);
}

// ---------------------------------------------------------------
// Handler
// ---------------------------------------------------------------

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let rawUrl: string;
  try {
    const body = await req.json();
    rawUrl = String(body?.url ?? "");
    if (!rawUrl) return json({ error: "url ontbreekt" }, 400);
  } catch {
    return json({ error: "Ongeldige body" }, 400);
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(rawUrl);
    assertPublicUrl(new URL(normalized));
  } catch (e) {
    return json({ error: (e as Error).message || "Ongeldige URL" }, 400);
  }

  const hash = await sha256Hex(normalized);

  // 1. Cache
  const { data: cached } = await admin
    .from("link_previews")
    .select("*")
    .eq("url_hash", hash)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    const ttl = cached.error ? ERROR_TTL_MS : CACHE_TTL_MS;
    if (age < ttl) {
      if (cached.error) return json({ preview: null, cached: true, error: cached.error });
      const { url_hash: _h, error: _e, fetched_at: _f, ...preview } = cached;
      return json({ preview, cached: true });
    }
  }

  // 2. Ophalen
  try {
    const preview = await buildPreview(normalized);
    await admin
      .from("link_previews")
      .upsert({ url_hash: hash, ...preview, error: null, fetched_at: new Date().toISOString() });
    return json({ preview, cached: false });
  } catch (e) {
    const message = (e as Error)?.message ?? "Onbekende fout";
    // Negative caching, zodat een dode link niet elke keer 8s kost.
    await admin
      .from("link_previews")
      .upsert({ url_hash: hash, url: normalized, kind: "link", provider: "generic", error: message, fetched_at: new Date().toISOString() })
      .then(() => {}, () => {});
    return json({ preview: null, error: message });
  }
});
