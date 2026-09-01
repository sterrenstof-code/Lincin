import { supabase } from "../supabase/client";

/**
 * Wat je de laatste tijd gedaan hebt, in getallen.
 *
 * ---------------------------------------------------------------
 * WAAROM TELLEN EN NIET OPSOMMEN
 * ---------------------------------------------------------------
 * `ActivityHistory` bestaat al en toont je laatste handelingen als lijst.
 * Dit is de andere vraag: niet "wat deed ik" maar "hoeveel". Een lijst
 * beantwoordt de eerste; om de tweede te beantwoorden moet je hem zelf
 * zitten tellen, en dat doet niemand.
 *
 * De twee bijten elkaar niet — ze staan naast elkaar op het profiel, de
 * getallen als samenvatting en de lijst als het verhaal eronder.
 *
 * ---------------------------------------------------------------
 * WAAROM ZES QUERIES EN GEEN VIEW
 * ---------------------------------------------------------------
 * Elke telling is `head: true` met `count: "exact"`: dan komt er géén rij
 * terug, alleen het getal uit de `Content-Range`-header. Zes van die
 * verzoeken parallel is goedkoper dan het klinkt — er reist geen data, en
 * ze wachten niet op elkaar.
 *
 * Een database-view of RPC zou het één ronde maken, maar dan staat de
 * definitie van "een interactie" in SQL en moet er een migratie langs
 * zodra we er iets aan toevoegen. Hier staat hij in TypeScript, naast de
 * plek waar hij getoond wordt.
 *
 * ---------------------------------------------------------------
 * WAT TELT ALS INTERACTIE
 * ---------------------------------------------------------------
 * Alleen dingen die jíj deed, en alleen dingen die een ander kan merken.
 * Een vondst openen telt niet; een reactie eronder wel. Dat onderscheid is
 * de reden dat dit iets zegt: het is geen gebruiksstatistiek maar een
 * weergave van wat je bijgedragen hebt.
 *
 * `comments` en `entity_comments` staan er allebei in en worden opgeteld:
 * dat zijn reacties op een vondst en reacties op al de rest (een event,
 * een lijst), en voor wie ernaar kijkt is dat één ding.
 */
export type InteractionSummary = {
  /** Over hoeveel dagen terug geteld is. */
  days: number;
  posts: number;
  comments: number;
  reactions: number;
  boosts: number;
  photos: number;
  /** De vijf hierboven bij elkaar. */
  total: number;
};

/** Eén telling. Faalt er één, dan telt die als nul in plaats van de hele kaart te slopen. */
async function countSince(
  table: "posts" | "comments" | "entity_comments" | "post_reactions" | "post_boosts" | "event_contributions",
  userId: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

export async function getInteractionSummary(
  userId: string,
  days = 30
): Promise<InteractionSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [posts, comments, entityComments, reactions, boosts, photos] =
    await Promise.all([
      countSince("posts", userId, since),
      countSince("comments", userId, since),
      countSince("entity_comments", userId, since),
      countSince("post_reactions", userId, since),
      countSince("post_boosts", userId, since),
      countSince("event_contributions", userId, since),
    ]);

  const merged = {
    days,
    posts,
    comments: comments + entityComments,
    reactions,
    boosts,
    photos,
  };

  return {
    ...merged,
    total:
      merged.posts + merged.comments + merged.reactions + merged.boosts + merged.photos,
  };
}
