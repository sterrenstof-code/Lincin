/**
 * Unieke naam voor een realtime-kanaal.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT MOET — en waarom een vaste naam de app laat crashen
 * ---------------------------------------------------------------
 * `supabase.channel(topic)` maakt geen nieuw kanaal als er al één met
 * dezelfde naam bestaat: hij geeft het **bestaande** terug (zie
 * `RealtimeClient.channel`). En `.on("postgres_changes", …)` op een kanaal
 * dat al `subscribe()` heeft gehad gooit:
 *
 *     cannot add `postgres_changes` callbacks for realtime:chat:… after
 *     `subscribe()`.
 *
 * Die fout ontstaat tijdens een effect, dus de ErrorBoundary dekt de hele
 * app af met "Er ging iets mis" — een witte pagina voor iets wat alleen
 * een live-update betrof.
 *
 * Twee abonnees op dezelfde naam is geen randgeval:
 *
 *   · Een stack houdt een scherm gemount als je er bovenop navigeert. Ga
 *     je van een gesprek via een tussenscherm terug naar hetzelfde
 *     gesprek, dan staan er twee exemplaren van dat scherm in de boom.
 *   · Eén onderdeel staat vaak op twee plekken tegelijk. De reacties en
 *     het reactieblok van een vondst staan zowel in de feed als op de
 *     detailpagina van diezelfde vondst.
 *
 * Elke abonnee krijgt daarom zijn eigen naam. Dat kost een kanaal per
 * abonnee op dezelfde websocket — de prijs voor een abonnement dat altijd
 * werkt in plaats van meestal.
 *
 * UITZONDERING: kanalen die `broadcast` of `presence` gebruiken om
 * gebruikers mét elkaar te verbinden (zoals "aan het typen…") moeten juist
 * wél dezelfde naam delen — anders zit iedereen in zijn eigen kamer. Die
 * gebruiken deze helper bewust niet.
 */
export function uniqueTopic(base: string): string {
  return `${base}:${Math.random().toString(36).slice(2, 10)}`;
}
