/**
 * Hoe lang een leesvraag mag duren voor we hem opgeven.
 *
 * supabase-js kent geen time-out: een verzoek dat op een halfdode
 * verbinding blijft hangen (telefoon die van wifi naar 4G springt, een tab
 * die uit de slaap komt) hangt voor altijd, en het scherm blijft op zijn
 * laadbalkjes staan. React Query probeert opnieuw na een fout, maar een
 * verzoek dat nooit terugkomt is geen fout. Met een time-out wordt het er
 * een, en kan hij opnieuw geprobeerd worden.
 *
 * Alleen voor lezen: een upload van een video mag langer duren.
 */
export const READ_TIMEOUT_MS = 12_000;

export function timeoutSignal(ms = READ_TIMEOUT_MS): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
