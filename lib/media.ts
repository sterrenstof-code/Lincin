import { supabase } from "./supabase/client";

/**
 * Beeld-URL's: klein maken en hergebruiken.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT BESTAAT
 * ---------------------------------------------------------------
 * Een telefoonfoto die iemand deelt is 3 tot 8 MB. Die werd hier
 * ongewijzigd in een tegel van 300 pixels gezet — twintig tegels in de
 * feed betekende tientallen megabytes voor beeld dat op geen enkel scherm
 * scherper wordt dan zijn eigen tegel. Supabase kan het formaat zelf
 * omrekenen (`/render/image/…`); dat doet deze module, één plek voor alle
 * buckets.
 *
 * ---------------------------------------------------------------
 * EN WAAROM DE URL ONTHOUDEN WORDT
 * ---------------------------------------------------------------
 * Een signed URL krijgt bij élke aanroep een nieuw token. De browser ziet
 * dan een andere URL en haalt dezelfde foto opnieuw op — dát was de reden
 * dat beeld bij elke tabwissel opnieuw stond te laden. We bewaren de
 * uitgegeven URL per pad, zolang hij geldig is, zodat dezelfde foto ook
 * dezelfde URL houdt en de cache van de browser (en van expo-image) hem
 * herkent.
 *
 * De sleutel bevat het formaat: een tegel en een detailplaat zijn twee
 * verschillende bestanden en mogen elkaars plek in de cache niet innemen.
 */

/** Hoe lang een signed URL geldig is. Ruim, want de cache leeft ervan. */
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dagen
/** Marge: een URL die bijna verloopt geven we niet meer uit. */
const REFRESH_MARGIN_MS = 60 * 60 * 1000; // 1 uur

export type ImageSize = {
  width: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

/**
 * De maten die de app gebruikt. Bewust weinig varianten: elke extra maat
 * is een extra bestand om te downloaden en te bewaren.
 */
export const IMG = {
  /** Avatars en andere kleine ronde beelden — 2× voor retina. */
  avatar: (px: number): ImageSize => ({ width: px * 2, height: px * 2, resize: "cover", quality: 70 }),
  /** Tegel in een raster of een strook. */
  tile: { width: 900, quality: 68 } as ImageSize,
  /** Grote plaat op een detailpagina. */
  hero: { width: 1600, quality: 76 } as ImageSize,
};

function params(size: ImageSize): string {
  const q = new URLSearchParams();
  q.set("width", String(Math.round(size.width)));
  if (size.height) q.set("height", String(Math.round(size.height)));
  if (size.resize) q.set("resize", size.resize);
  q.set("quality", String(size.quality ?? 72));
  return q.toString();
}

function sizeKey(size: ImageSize): string {
  return `${size.width}x${size.height ?? 0}${size.resize ?? ""}q${size.quality ?? 72}`;
}

// ---------------------------------------------------------------
// Publieke buckets — puur een URL herschrijven
// ---------------------------------------------------------------

/**
 * Zet een publieke storage-URL om naar zijn verkleinde variant.
 *
 * Herkent alleen het patroon `/storage/v1/object/public/…`. Alles wat daar
 * niet op lijkt (een externe URL, een data-URI, een leeg veld) komt
 * ongewijzigd terug — dit mag nooit een beeld stukmaken dat het al deed.
 */
export function resizedPublicUrl(
  url: string | null | undefined,
  size: ImageSize
): string | null | undefined {
  if (!url || !url.includes("/storage/v1/object/public/")) return url;
  const [base, query] = url.split("?");
  const rendered = base.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  // De cache-buster (`?t=…`) van een net geüploade avatar moet mee, anders
  // blijft de oude foto staan.
  const keep = query ? `&${query}` : "";
  return `${rendered}?${params(size)}${keep}`;
}

/** Sleutel voor de schijfcache: los van token en cache-buster. */
export function stableCacheKey(url: string | null | undefined, size?: ImageSize): string | undefined {
  if (!url) return undefined;
  const base = url.split("?")[0];
  return size ? `${base}|${sizeKey(size)}` : base;
}


/**
 * HEIC en HEIF laten we met rust. Ze mogen de bucket in (een iPhone levert
 * ze aan) maar de beeldomzetter hoeft ze niet te kennen; een foto die
 * daarop stukloopt is erger dan een foto die groot is. Alles wat we wél
 * zeker weten, gaat door de omzetter.
 */
function transformable(path: string): boolean {
  return /\.(jpe?g|png|webp|avif|gif)$/i.test(path);
}

// ---------------------------------------------------------------
// Privébuckets — signed URL's, onthouden zolang ze geldig zijn
// ---------------------------------------------------------------

type Entry = { url: string; expiresAt: number };

const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

const STORE_PREFIX = "lincin.img.";

/**
 * Web onthoudt de URL ook over een paginaverversing heen: zonder dat komt
 * de gebruiker na elke F5 terug op een nieuw token en dus een nieuwe
 * download van dezelfde foto. Native heeft dit niet nodig — expo-image
 * bewaart daar op `cacheKey` en niet op URL.
 */
const store =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined"
    ? window.localStorage
    : null;

function readStored(key: string): Entry | null {
  if (!store) return null;
  try {
    const raw = store.getItem(STORE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    if (!parsed?.url || typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(key: string, entry: Entry): void {
  if (!store) return;
  try {
    store.setItem(STORE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Vol of geweigerd (privémodus). De cache in het geheugen blijft werken.
  }
}

function fresh(entry: Entry | null | undefined): string | null {
  if (!entry) return null;
  return entry.expiresAt - REFRESH_MARGIN_MS > Date.now() ? entry.url : null;
}

/**
 * Signed URL voor één bestand, verkleind en onthouden.
 * Geeft `null` terug als het bestand niet te ondertekenen is — de
 * aanroeper toont dan zijn eigen plaatshouder.
 */
export async function signedImageUrl(
  bucket: string,
  path: string | null | undefined,
  size: ImageSize
): Promise<string | null> {
  if (!path) return null;
  const key = `${bucket}|${path}|${sizeKey(size)}`;

  const cached = fresh(memory.get(key)) ?? fresh(readStored(key));
  if (cached) {
    if (!memory.has(key)) memory.set(key, { url: cached, expiresAt: Date.now() + TTL_SECONDS * 1000 });
    return cached;
  }

  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, TTL_SECONDS, transformable(path)
        ? { transform: { width: size.width, height: size.height, resize: size.resize, quality: size.quality ?? 72 } }
        : undefined);
    if (error || !data?.signedUrl) return null;
    const entry: Entry = { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 };
    memory.set(key, entry);
    writeStored(key, entry);
    return entry.url;
  })().finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

/**
 * Hetzelfde voor een lijst paden. Wat al in de cache zit kost niets; de
 * rest wordt naast elkaar opgehaald in plaats van na elkaar.
 */
export async function signedImageUrls(
  bucket: string,
  paths: (string | null | undefined)[],
  size: ImageSize
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const out = new Map<string, string>();
  await Promise.all(
    unique.map(async (p) => {
      const url = await signedImageUrl(bucket, p, size);
      if (url) out.set(p, url);
    })
  );
  return out;
}
