/**
 * Wat een gebruiker te zien krijgt als er iets misgaat, en wat niet.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * Er stonden drie van deze functies in de app en ze verschilden op precies
 * de plek waar het telt: de laatste regel. `humanizeContributeError` in
 * `event/[id]` deed het goed — hij logt het technische detail en geeft een
 * gewone zin terug. De twee andere eindigden op `return msg`, en dan staat
 * er in een Nederlandse app opeens dit:
 *
 *     new row violates row-level security policy for table "posts"
 *
 * En erger dan Engels: er stonden **migratie-instructies** in. Letterlijk
 * "Run migratie 0038_entity_comments.sql", "Migratie 0042 is nog niet
 * toegepast in Supabase", "Run `0003_storage_repair.sql` en probeer
 * opnieuw." Dat is een opdracht aan de ontwikkelaar die in het scherm van
 * de vriendenkring terechtkwam — mensen die geen Supabase-project hebben en
 * er ook niets aan kunnen doen.
 *
 * ---------------------------------------------------------------
 * DE REGEL
 * ---------------------------------------------------------------
 * Het technische detail gaat naar de console, waar het bugbord het leest.
 * Het scherm krijgt een zin die zegt wat er niet gelukt is en of het zin
 * heeft om het opnieuw te proberen. Nooit allebei door elkaar.
 *
 * Eén uitzondering, en die staat elders: `QueryError` toont de ruwe melding
 * wél, maar klein en ónder een gewone zin. Dat is een blok met een rode
 * omlijning waar je nadrukkelijk naar kijkt omdat er iets stuk is; dit hier
 * is een regel onder een knop die je net indrukte.
 */

/** De laatste zin, als geen enkele regel past. */
const FALLBACK = "Er ging iets mis. Probeer het opnieuw.";

type Rule = { match: RegExp; say: string };

/**
 * Wat we herkennen, en wat we er dan over zeggen.
 *
 * Bewust weinig regels. Elke regel is een belofte dat we wéten wat er aan
 * de hand is; raden we ernaast, dan is een preciezere zin erger dan de
 * algemene, want dan stuurt hij iemand de verkeerde kant op.
 */
const RULES: Rule[] = [
  {
    // Zowel de tabel die er niet is als de kolom die ontbreekt: allebei
    // "de server kent dit nog niet". Voor de lezer is dat hetzelfde feit.
    match: /relation .* does not exist|column .* does not exist|schema is invalid|schema is incompatible|_check\b/i,
    say: "Dit onderdeel is nog niet klaar op de server. Er is niets kapot aan wat je typte — probeer het straks opnieuw.",
  },
  {
    match: /row-level security|permission denied|not authorized/i,
    say: "Je hebt hier geen toegang (meer) toe. Misschien ben je uit de groep of het event gehaald.",
  },
  {
    match: /mime type|not supported|invalid file/i,
    say: "Dit bestandstype werkt niet. Gebruik een foto (JPG, PNG, HEIC of WebP) of een video (MP4, MOV of WebM).",
  },
  {
    match: /exceeded|too large|payload too large|413/i,
    say: "Dit bestand is te groot. De limiet is 100 MB.",
  },
  {
    match: /network|fetch failed|failed to fetch|timeout|ECONN/i,
    say: "Geen verbinding met de server. Controleer je netwerk en probeer opnieuw.",
  },
  {
    // PostgREST geeft dit als de rij wél geschreven werd maar niet
    // teruggelezen mag worden. Dat is verwarrend: er stáát iets, en je ziet
    // het niet.
    match: /PGRST116|PGRST204/i,
    say: "Het is misschien wél gelukt, maar de server gaf niets terug. Ververs even om te kijken.",
  },
];

/**
 * Een fout omzetten naar één zin die je aan iemand kunt laten lezen.
 *
 * `context` is puur voor de console — het zegt wélke handeling faalde, want
 * "row-level security" zonder plaats is in een logboek net zo nutteloos als
 * op het scherm.
 *
 * `fallback` overschrijft de laatste zin voor wie iets preciezers weet te
 * zeggen ("De toelichting kon niet bewaard worden"). Hij vervangt nooit een
 * regel die wél matcht: die is specifieker dan wat de aanroeper weet.
 */
export function humanizeError(
  err: unknown,
  context: string,
  fallback: string = FALLBACK
): string {
  const raw =
    (err as { message?: string } | null)?.message ??
    String(err ?? "onbekende fout");
  const code = (err as { code?: string } | null)?.code ?? "";

  // Naar de console en niet naar het scherm. Zie de kop van dit bestand.
  console.warn(`[${context}]`, code ? `${code} ${raw}` : raw);

  const haystack = `${code} ${raw}`;
  for (const rule of RULES) {
    if (rule.match.test(haystack)) return rule.say;
  }
  return fallback;
}
