import type { FeedItem, PostWithAuthor } from "@/lib/api/posts";
import type { PollWithDetails } from "@/lib/api/polls";
import { hueFor, type Hue } from "@/lib/design/theme";
import { getLang, type Dict, type Lang } from "@/lib/i18n";

/**
 * Van wat de backend geeft naar wat een kaart nodig heeft.
 *
 * De feed levert `FeedItem`s van zes soorten; de v2-kaart (README §Post
 * card) kent titel, bijschrift, een medium en een metakolom. Dit bestand
 * is de brug, zodat de kaart zelf niets over Supabase hoeft te weten.
 */

export type CardMedia =
  | { kind: "foto"; uri: string | null; cacheKey?: string; video?: boolean }
  | { kind: "tekst"; text: string }
  | { kind: "poll"; poll: PollWithDetails }
  | { kind: "muziek"; cover: string | null; track: string; artist: string; url: string | null }
  | { kind: "kleur"; hex: string }
  | { kind: "link"; image: string | null; title: string; site: string; url: string }
  | { kind: "plek"; place: string; coords: string }
  | { kind: "spraak"; duration: string };

export type CardPost = {
  id: string;
  /** Route van de bladzijde; leeg als er geen is (een poll). */
  href: string;
  /** De SOORT in de metakolom: "foto", "tekst", … */
  kind: string;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  initial: string;
  avatarUrl: string | null;
  createdAt: string;
  title: string;
  /**
   * De bijdrage had zelf geen titel of tekst; `title` is dan een terugval
   * (de datum voor beeld, de soort voor de rest). Wie het beeld al toont
   * — een tegel, een inhoudsopgave — laat zo'n titel beter weg.
   */
  untitled: boolean;
  caption: string;
  /** De lopende tekst onder het bijschrift (bladzijde, magazine-hero). */
  body: string;
  media: CardMedia;
  commentCount: number;
  /** Alleen een post heeft emoji-reacties; een poll stemt. */
  reactable: boolean;
};

/** De naam zoals hij op de band staat. */
export function displayName(p: { display_name?: string | null; username?: string | null } | null | undefined): string {
  return p?.display_name?.trim() || p?.username || "?";
}

const KIND_LABEL: Record<PostWithAuthor["kind"], string> = {
  image: "foto",
  video: "video",
  note: "tekst",
  link: "link",
  music: "muziek",
  fragment: "fragment",
  fact: "weetje",
  idea: "idee",
  quote: "citaat",
  swatch: "kleur",
};

const TITLE_MAX = 56;

/**
 * Een vondst heeft geen titel; een v2-kaart wel.
 *
 * Bronvermelding wint. Anders is de titel de eerste zin (of regel) van het
 * bijschrift, afgekapt op een woordgrens, en is de rest het bijschrift.
 */
export function splitTitle(p: PostWithAuthor): { title: string; caption: string; untitled?: boolean } {
  const caption = (p.caption ?? "").trim();
  const body = (p.body_text ?? "").trim();
  if (p.source_title) {
    return { title: p.source_title.trim(), caption: caption || firstLine(body) };
  }
  const base = caption || body;
  // Zonder tekst: een foto krijgt zijn datum als kop ("27 aug"), de rest
  // zijn soort. Een strook met "FOTO" boven een foto zegt niets.
  if (!base) {
    const image = !!p.image_url && (p.kind === "image" || p.kind === "video");
    return { title: image ? shortDate(p.created_at, getLang()) : KIND_LABEL[p.kind] ?? "", caption: "", untitled: true };
  }
  const m = base.match(/^(.+?[.!?…])(\s+|$)/s);
  const nl = base.indexOf("\n");
  let head = m ? m[1] : nl > 0 ? base.slice(0, nl) : base;
  let rest = base.slice(head.length).trim();
  if (head.length > TITLE_MAX) {
    const cut = head.lastIndexOf(" ", TITLE_MAX);
    const short = head.slice(0, cut > 20 ? cut : TITLE_MAX).replace(/[,;:\s]+$/, "");
    rest = (head.slice(short.length).trim() + (rest ? " " + rest : "")).trim();
    head = short + "…";
  }
  if (!rest && caption && body && body !== caption) rest = firstLine(body);
  return { title: head.replace(/[.]$/, ""), caption: rest };
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i > 0 ? s.slice(0, i) : s;
}

function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function postMedia(p: PostWithAuthor): CardMedia {
  const meta = p.meta ?? {};
  switch (p.kind) {
    case "music":
      return {
        kind: "muziek",
        cover: meta.image_url ?? p.image_url ?? null,
        track: meta.title ?? p.source_title ?? p.caption ?? "",
        artist: meta.author ?? p.source_author ?? meta.site_name ?? "",
        url: p.link_url,
      };
    case "link":
    case "video":
      if (p.kind === "video" && p.image_url) {
        return { kind: "foto", uri: p.image_url, cacheKey: p.image_path ?? undefined, video: true };
      }
      return {
        kind: "link",
        image: meta.image_url ?? p.image_url ?? null,
        title: meta.title ?? p.source_title ?? p.link_url ?? "",
        site: meta.site_name ?? hostOf(p.link_url),
        url: p.link_url ?? "",
      };
    case "swatch":
      return { kind: "kleur", hex: p.swatch_hex ?? "#E7E3D8" };
    default:
      if (p.image_url) {
        return { kind: "foto", uri: p.image_url, cacheKey: p.image_path ?? undefined };
      }
      return { kind: "tekst", text: (p.body_text ?? p.caption ?? "").trim() };
  }
}

export function fromPost(p: PostWithAuthor): CardPost {
  const { title, caption, untitled } = splitTitle(p);
  const media = postMedia(p);
  const name = displayName(p.author);
  return {
    id: p.id,
    href: `/post/${p.id}`,
    kind: KIND_LABEL[p.kind] ?? p.kind,
    authorId: p.user_id,
    authorName: name,
    authorUsername: p.author?.username ?? null,
    initial: name.slice(0, 1).toUpperCase(),
    avatarUrl: p.author?.avatar_url ?? null,
    createdAt: p.created_at,
    title,
    untitled: !!untitled,
    // Een tekstkaart toont de tekst zelf al als medium; dan niet nog eens
    // als bijschrift eronder.
    caption: media.kind === "tekst" && caption === media.text ? "" : caption,
    body: media.kind === "tekst" ? "" : (p.body_text ?? "").trim(),
    media,
    commentCount: p.comment_count ?? 0,
    reactable: true,
  };
}

export function fromPoll(p: PollWithDetails, t: Dict): CardPost {
  const name = displayName(p.author);
  return {
    id: p.id,
    href: "",
    kind: "poll",
    authorId: p.user_id,
    authorName: name,
    authorUsername: p.author?.username ?? null,
    initial: name.slice(0, 1).toUpperCase(),
    avatarUrl: p.author?.avatar_url ?? null,
    createdAt: p.created_at,
    title: p.question,
    untitled: false,
    caption: `${p.total_votes} ${t.votes}`,
    body: "",
    media: { kind: "poll", poll: p },
    commentCount: 0,
    reactable: false,
  };
}

/** Eén feed-item als kaart; `null` voor wat de kaart (nog) niet draagt. */
export function toCardPost(item: FeedItem, t: Dict): CardPost | null {
  switch (item.type) {
    case "post":
      return fromPost(item.data);
    case "poll":
      return fromPoll(item.data, t);
    default:
      // memory (je eigen herinnering), activiteit, belafspraak, lijst:
      // niet in het schrift van je vrienden.
      return null;
  }
}

// ---------------------------------------------------------------
// Per vriend
// ---------------------------------------------------------------

export type FriendGroup = {
  key: string;
  authorId: string;
  name: string;
  username: string | null;
  initial: string;
  avatarUrl: string | null;
  hue: Hue;
  isGroup: boolean;
  posts: CardPost[];
  /** Tijd van de nieuwste bijdrage. */
  latest: string;
};

/** Eén groep per vriend, nieuwste vriend eerst; binnen de groep op tijd. */
export function groupByFriend(cards: CardPost[]): FriendGroup[] {
  const map = new Map<string, FriendGroup>();
  for (const c of cards) {
    let g = map.get(c.authorId);
    if (!g) {
      g = {
        key: c.authorId,
        authorId: c.authorId,
        name: c.authorName,
        username: c.authorUsername,
        initial: c.initial,
        avatarUrl: c.avatarUrl,
        hue: hueFor(c.authorId),
        isGroup: false,
        posts: [],
        latest: c.createdAt,
      };
      map.set(c.authorId, g);
    }
    g.posts.push(c);
    if (c.createdAt > g.latest) g.latest = c.createdAt;
  }
  const groups = Array.from(map.values());
  for (const g of groups) g.posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return groups.sort((a, b) => (a.latest < b.latest ? 1 : -1));
}

// ---------------------------------------------------------------
// Op tijd
// ---------------------------------------------------------------

export type TimeGroup = { key: string; label: string; range: string; posts: CardPost[] };

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "22:41" vandaag, "gisteren 08:20", "ma 07:55", "12 sep". */
export function timeLabel(iso: string, t: Dict, lang: Lang): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return hhmm(iso);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `${t.yesterday.toLowerCase()} ${hhmm(iso)}`;
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 7) return `${d.toLocaleDateString(LOCALE[lang], { weekday: "short" })} ${hhmm(iso)}`;
  return d.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
}

export function shortDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short" });
}

/** Vandaag · gisteren · deze week · eerder, nieuwste eerst. */
export function groupByTime(cards: CardPost[], t: Dict, lang: Lang): TimeGroup[] {
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const buckets: Record<string, CardPost[]> = { today: [], yesterday: [], week: [], earlier: [] };
  for (const c of cards) {
    const d = new Date(c.createdAt);
    if (sameDay(d, now)) buckets.today.push(c);
    else if (sameDay(d, y)) buckets.yesterday.push(c);
    else if ((now.getTime() - d.getTime()) / 86_400_000 < 7) buckets.week.push(c);
    else buckets.earlier.push(c);
  }
  const out: TimeGroup[] = [];
  const push = (key: string, label: string, list: CardPost[], range: (oldest: CardPost, newest: CardPost) => string) => {
    if (!list.length) return;
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    out.push({ key, label, posts: list, range: range(list[list.length - 1], list[0]) });
  };
  push("today", t.today, buckets.today, (o) => `${hhmm(o.createdAt)} – ${t.now}`);
  push("yesterday", t.yesterday, buckets.yesterday, (o, n) => `${hhmm(o.createdAt)} – ${hhmm(n.createdAt)}`);
  push("week", t.thisWeek, buckets.week, (o, n) => `${shortDate(o.createdAt, lang)} – ${shortDate(n.createdAt, lang)}`);
  push("earlier", t.earlier, buckets.earlier, (o, n) => `${shortDate(o.createdAt, lang)} – ${shortDate(n.createdAt, lang)}`);
  return out;
}

/**
 * Het nummer van elke bijdrage: "01" is de oudste in de feed, zoals het
 * prototype telt. De feeds én de bladzijde lezen dezelfde tabel, zodat
 * "№ 07" op de bladzijde is wat de inhoudsopgave ook zei.
 */
export function numberMap(cards: CardPost[]): Map<string, string> {
  const asc = [...cards].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const m = new Map<string, string>();
  asc.forEach((c, i) => m.set(c.id, String(i + 1).padStart(2, "0")));
  return m;
}

/** "2m", "38m", "3u", "gisteren", "4d", "12 sep" — de tijd in een lijst. */
export function shortAgo(iso: string, t: Dict, lang: Lang): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t.now;
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t.yesterday.toLowerCase();
  if (days < 7) return `${days}d`;
  return shortDate(iso, lang);
}

/** "01" */
export function two(n: number): string {
  return pad(n);
}

/** Vaste golfvorm per bijdrage: dezelfde balken bij elke tekening. */
export function waveform(seedText: string, n = 28): number[] {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  const s = (seed % 97) / 10;
  return Array.from({ length: n }, (_, i) => {
    const h = 20 + Math.abs(Math.sin(i * 1.7 + s) * 70 + Math.cos(i * 0.6) * 10);
    return Math.min(100, h);
  });
}
