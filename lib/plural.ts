/**
 * Eén ding of meer dan één.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN MODULE IS
 * ---------------------------------------------------------------
 * Meervoud werd op drie manieren gedaan en op twee daarvan fout. De
 * eventkaart schreef `${n} foto's` en gaf dus "1 foto's"; de eventpagina
 * schreef `${n} gasten` en gaf "1 gasten". Alleen één regel in `EventCard`
 * deed het goed, met een ternary ter plekke.
 *
 * Dat is precies het soort ding dat op de volgende plek weer misgaat: de
 * regel staat nergens, dus wie een nieuwe teller toevoegt kiest opnieuw. En
 * "1 gasten" is klein maar het is wél het eerste wat je leest op een event
 * waar nog niemand bij is — dus juist op het moment dat het opvalt.
 *
 * Geen `Intl.PluralRules`: Nederlands kent maar twee vormen en de enige
 * onregelmatigheid zit in het zelfstandig naamwoord zelf ("foto" →
 * "foto's"), niet in de regel. Een tabel met twee kolommen is hier
 * eerlijker dan een API die net doet alsof het ingewikkelder is.
 */

/**
 * `plural(1, "gast", "gasten")` → `"1 gast"`.
 *
 * Het getal staat er standaard bij, want dat is wat élke aanroeper wilde.
 * Wie alleen het woord nodig heeft geeft `withCount: false` mee.
 */
export function plural(
  count: number,
  one: string,
  many: string,
  { withCount = true }: { withCount?: boolean } = {}
): string {
  const word = count === 1 ? one : many;
  return withCount ? `${count} ${word}` : word;
}
