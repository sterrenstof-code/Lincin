import { supabase } from "../supabase/client";

/**
 * Unfurl-client.
 *
 * Roept de `unfurl` edge function aan die serverside OpenGraph/oEmbed
 * ophaalt. Bewust alleen gebruikt bij het *plaatsen* van een vondst: het
 * resultaat gaat als momentopname mee in `posts.meta`, zodat de feed nooit
 * per item een netwerkcall hoeft te doen — en zodat een vondst haar titel
 * behoudt ook als de bronpagina later verdwijnt.
 */

export type LinkProvider =
  | "youtube" | "vimeo" | "spotify" | "soundcloud"
  | "applemusic" | "bandcamp" | "github" | "generic";

export type LinkPreview = {
  url: string;
  canonical_url: string | null;
  provider: LinkProvider;
  /** Grove indeling die bepaalt welke kaart getoond wordt. */
  kind: "link" | "video" | "music";
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  /** De maker van de bron — niet de deler. */
  author: string | null;
  /** iframe-bare speler-URL, indien beschikbaar. */
  embed_url: string | null;
  duration_s: number | null;
  favicon_url: string | null;
  word_count: number | null;
};

/** Ruwe URL-detectie in vrije tekst. */
const URL_RE = /(https?:\/\/[^\s<>"']+|(?:^|\s)(?:www\.)[^\s<>"']+\.[a-z]{2,}[^\s<>"']*)/i;

/** Geeft de eerste URL in een tekst, of null. */
export function findUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  const raw = m[0].trim().replace(/[.,;:!?)\]]+$/, "");
  return raw.length > 4 ? raw : null;
}

/**
 * Haalt metadata op voor een URL. Faalt zacht: bij een fout krijg je null
 * terug en kan de vondst alsnog geplaatst worden als kale link.
 */
export async function unfurl(url: string): Promise<LinkPreview | null> {
  try {
    const { data, error } = await supabase.functions.invoke("unfurl", {
      body: { url },
    });
    if (error) {
      console.warn("unfurl", error.message);
      return null;
    }
    const preview = (data as any)?.preview;
    if (!preview || typeof preview !== "object") return null;
    return preview as LinkPreview;
  } catch (e: any) {
    console.warn("unfurl", e?.message ?? e);
    return null;
  }
}
