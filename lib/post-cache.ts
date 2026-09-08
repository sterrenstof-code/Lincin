import type { QueryClient } from "@tanstack/react-query";

/**
 * Waar een vondst overal in de cache staat.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN FUNCTIE IS EN GEEN REGEL PER SCHERM
 * ---------------------------------------------------------------
 * De detailpagina ruimde na verwijderen `["feed"]` en `["posts-by-user"]`
 * op. Die eerste sleutel bestaat niet: de thuispagina heet sinds de
 * samengevoegde stroom `["unified-feed", userId]`. Je verwijderde dus een
 * notitie, ging terug, en hij stond er nog — tot je verver-de, want dan
 * werd de lijst opnieuw opgehaald. Een sleutel die nergens meer bij hoort
 * geeft geen fout; react-query ruimt gewoon niets op.
 *
 * Dat is precies het soort verschil dat vanzelf blijft bestaan als elk
 * scherm zijn eigen lijstje opruimt (DESIGN.md §8). Dus staat de lijst
 * hier, één keer, en roept iedereen die een vondst maakt, wijzigt of
 * weggooit hem aan.
 *
 * Zonder gebruikers-id: react-query matcht op voorvoegsel, dus
 * `["unified-feed"]` raakt élke gebruiker die in deze sessie geladen is —
 * en dat is precies de bedoeling op een gedeeld toestel.
 */
export function invalidatePostCaches(qc: QueryClient): Promise<unknown> {
  return Promise.all([
    // De thuispagina.
    qc.invalidateQueries({ queryKey: ["unified-feed"] }),
    // Het profiel en het bord van een ander.
    qc.invalidateQueries({ queryKey: ["posts-by-user"] }),
    // De strook "wat er over jou gebeurd is".
    qc.invalidateQueries({ queryKey: ["interaction-summary"] }),
    // En de telling van wat jíj deed, in diezelfde band.
    qc.invalidateQueries({ queryKey: ["my-activity"] }),
  ]);
}
