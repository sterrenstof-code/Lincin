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

type ImageSize = {
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
  tile: { width: 900, resize: "contain", quality: 68 } as ImageSize,
  /** Grote plaat op een detailpagina. */
  hero: { width: 1600, resize: "contain", quality: 76 } as ImageSize,
};
/*
 * `resize: "contain"` bij tile en hero is geen stijlkeuze maar de reden dat
 * foto's heel blijven.
 *
 * Zonder `resize` gebruikt de transformatie van Supabase `cover`, en zonder
 * `height` houdt hij dan de hoogte van het origineel aan. Een staande foto
 * van 1680×2670 kwam daardoor terug als 900×2670: dezelfde hoogte, en
 * van de breedte alleen het middelste stuk — bijna de helft van de foto
 * weg, al op de server, nog vóór de app er iets mee deed. Elke foto die
 * breder was dan 900 werd zo een smalle strook; kleinere werden niet
 * geschaald en bleven gaaf, wat het lastig maakte om te zien.
 *
 * Met `contain` schaalt hij de breedte naar 900 en de hoogte mee:
 * 900×1430. Omdat `resize` in de cachesleutel zit (`sizeKey`), worden oude,
 * bijgesneden URL's niet meer hergebruikt.
 */

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

/**
 * Sleutel voor de schijfcache: los van het token, wél met de versie.
 *
 * Het token van een signed URL verandert bij elke aanvraag; houd je het in
 * de sleutel, dan cachet er niets. Maar de `?t=…` die een upload aan een
 * groeps- of profielfoto hangt (zelfde pad, nieuwe foto) is juist de
 * versie. Die viel eerst óók weg, en dan bleef de oude foto uit de cache
 * staan tot de app van het toestel verdween.
 */
export function stableCacheKey(url: string | null | undefined, size?: ImageSize): string | undefined {
  if (!url) return undefined;
  const [path, query] = url.split("?");
  const version = query?.match(/(?:^|&)t=([^&]*)/)?.[1];
  const base = version ? `${path}?t=${version}` : path;
  return size ? `${base}|${sizeKey(size)}` : base;
}

/**
 * Sleutel voor de schijfcache van een privébeeld: het pad plús de maat.
 *
 * Het kale pad was de sleutel, en dezelfde foto wordt in twee maten
 * gevraagd: de feed tekent een tegel (`IMG.tile`), de bijdrage zelf een
 * plaat (`IMG.hero`). expo-image gaf dan wat het eerst binnenkwam aan
 * allebei — een tegel van 900 opgeblazen op de detailpagina, of de plaat
 * van 1600 in elke tegel van de feed. Wie de URL ondertekent, kent de maat
 * en maakt dus ook de sleutel; zie `lib/api/posts.ts`.
 */
export function sizedCacheKey(path: string | null | undefined, size: ImageSize): string | undefined {
  return path ? `${path}|${sizeKey(size)}` : undefined;
}


/**
 * HEIC en HEIF laten we met rust. Ze mogen de bucket in (een iPhone levert
 * ze aan) maar de beeldomzetter hoeft ze niet te kennen; een foto die
 * daarop stukloopt is erger dan een foto die groot is. Alles wat we wél
 * zeker weten, gaat door de omzetter.
 */
function transformable(path: string): boolean {
  // Gif er nadrukkelijk niet bij: de omzetter levert één beeld terug en
  // dan staat een bewegende gif stil. Dat is precies wat je er niet mee
  // wil. Ze zijn meestal ook al klein.
  return /\.(jpe?g|png|webp|avif)$/i.test(path);
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

function cacheKey(bucket: string, path: string, size: ImageSize): string {
  return `${bucket}|${path}|${sizeKey(size)}`;
}

/** Een nog geldige URL uit het geheugen of van schijf, anders `null`. */
function fromCache(key: string): string | null {
  const cached = fresh(memory.get(key)) ?? fresh(readStored(key));
  if (cached && !memory.has(key)) {
    memory.set(key, { url: cached, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  }
  return cached;
}

function remember(key: string, url: string): string {
  const entry: Entry = { url, expiresAt: Date.now() + TTL_SECONDS * 1000 };
  memory.set(key, entry);
  writeStored(key, entry);
  return url;
}

/** Zoveel paden per `createSignedUrls`-aanroep; ruim onder wat de API aankan. */
const SIGN_BATCH = 100;

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
  const key = cacheKey(bucket, path, size);

  const cached = fromCache(key);
  if (cached) return cached;

  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, TTL_SECONDS, transformable(path)
        ? { transform: { width: size.width, height: size.height, resize: size.resize, quality: size.quality ?? 72 } }
        : undefined);
    if (error || !data?.signedUrl) return null;
    return remember(key, data.signedUrl);
  })().finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

/**
 * Hetzelfde voor een lijst paden. Wat al in de cache zit kost niets.
 *
 * Bestanden die niet verkleind worden (gif, heic, …) gaan per honderd in
 * één `createSignedUrls`. De rest kan dat niet: die batch-aanroep van
 * Supabase Storage kent geen `transform`, en een signed URL zonder
 * transform levert het origineel — precies de foto van 5 MB in een tegel
 * die deze module moest voorkomen. Die blijven dus één aanroep per pad,
 * naast elkaar, en daarna zeven dagen uit de cache.
 *
 * Een pad dat niet lukt valt alleen zelf weg, niet de hele lijst; net als
 * bij `signedImageUrl` krijgt de aanroeper dan geen URL en toont hij zijn
 * eigen plaatshouder.
 */
export async function signedImageUrls(
  bucket: string,
  paths: (string | null | undefined)[],
  size: ImageSize
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const out = new Map<string, string>();
  const waits: Promise<void>[] = [];
  const toSign: string[] = [];
  const collect = (p: string, task: Promise<string | null>) =>
    waits.push(task.then((url) => { if (url) out.set(p, url); }));

  for (const p of unique) {
    if (transformable(p)) {
      collect(p, signedImageUrl(bucket, p, size));
      continue;
    }
    const key = cacheKey(bucket, p, size);
    const cached = fromCache(key);
    if (cached) {
      out.set(p, cached);
      continue;
    }
    const running = inflight.get(key);
    if (running) collect(p, running);
    else toSign.push(p);
  }

  for (let i = 0; i < toSign.length; i += SIGN_BATCH) {
    const chunk = toSign.slice(i, i + SIGN_BATCH);
    const batch = (async () => {
      const signed = new Map<string, string>();
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrls(chunk, TTL_SECONDS);
        if (error) return signed;
        for (const row of data ?? []) {
          // Per pad een eigen `error`: dat ene bestand valt weg, de rest niet.
          if (row.path && row.signedUrl && !row.error) signed.set(row.path, row.signedUrl);
        }
      } catch {
        // Netwerkfout: geen URL's, de aanroepers tonen hun plaatshouder.
      }
      return signed;
    })();
    for (const p of chunk) {
      const key = cacheKey(bucket, p, size);
      const task = batch
        .then((signed) => {
          const url = signed.get(p);
          return url ? remember(key, url) : null;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, task);
      collect(p, task);
    }
  }

  await Promise.all(waits);
  return out;
}
