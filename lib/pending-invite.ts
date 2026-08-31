/**
 * De uitnodiging die je nog niet kon aannemen.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * `/e/{code}` is de enige link die deze app naar buiten stuurt naar iemand
 * die er misschien nog niet in zit — dat is letterlijk waar hij voor
 * bedoeld is. En precies in dat geval ging hij verloren.
 *
 * Het scherm stuurde je bij een lege sessie door naar
 * `/(auth)/login?event=CODE`, met de opmerking "bewaar code voor na login
 * (eenvoudig: in URL via redirect)". Alleen: niets las die parameter ooit
 * uit. Het inlogscherm kent hem niet, `app/index.tsx` kent hem niet, en na
 * het inloggen vervangt de router de URL. Je kwam dus binnen op een lege
 * feed, en het event waarvoor je uitgenodigd was bestond nergens meer —
 * geen melding, geen spoor, en de link was eenmalig doorgestuurd.
 *
 * ---------------------------------------------------------------
 * WAAROM NIET IN DE URL
 * ---------------------------------------------------------------
 * De omweg langs de URL kán niet werken: tussen `/e/{code}` en het moment
 * dat er een sessie is, zitten op web een e-mailbevestiging en een
 * terugkeer vanaf een heel ander adres. Wat die reis overleeft is opslag,
 * niet een queryparameter.
 *
 * `localStorage` op web, en op native niets: daar komt de deep-link in
 * dezelfde app-sessie terug en blijft dit gewoon in het geheugen staan. Eén
 * variabele plus de opslag ernaast dekt allebei.
 *
 * De code wordt verbruikt zodra hij gebruikt is (`takePendingInvite`), niet
 * alleen gelezen. Anders sleept iedere volgende start je terug naar
 * hetzelfde event, ook nadat je er al in zat.
 */

const KEY = "lincin.pendingInvite";

let memory: string | null = null;

function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Privémodus of geblokkeerde opslag. Het geheugen draagt het dan.
    return null;
  }
}

/** Onthouden dat er nog een uitnodiging open staat. */
export function rememberPendingInvite(code: string): void {
  const clean = code.trim();
  if (!clean) return;
  memory = clean;
  try {
    store()?.setItem(KEY, clean);
  } catch {
    // Vol of geweigerd; `memory` blijft over.
  }
}

/**
 * De uitnodiging ophalen én meteen verbruiken.
 *
 * Geen aparte `peek`/`clear`: elke aanroeper die hem leest gaat er ook
 * naartoe navigeren, en een code die blijft staan stuurt je bij élke
 * volgende start opnieuw naar hetzelfde event.
 */
export function takePendingInvite(): string | null {
  let code = memory;
  if (!code) {
    try {
      code = store()?.getItem(KEY) ?? null;
    } catch {
      code = null;
    }
  }
  memory = null;
  try {
    store()?.removeItem(KEY);
  } catch {
    // Niets aan te doen, en de code is hierboven al uit het geheugen.
  }
  return code;
}
