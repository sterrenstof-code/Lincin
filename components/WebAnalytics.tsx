/**
 * Vercel Analytics — de native kant: niets.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN APART BESTAND IS EN GEEN `Platform.OS`-CHECK
 * ---------------------------------------------------------------
 * `@vercel/analytics` bepaalt met `typeof window !== "undefined"` of het in
 * een browser draait. React Native definieert `window` (het is een alias
 * voor `global`), maar géén `document`. De bibliotheek concludeert dus
 * "browser", pakt vervolgens `document.head` — en dat bestaat niet. Een
 * ReferenceError in een useEffect in de wortel van de app: crash bij het
 * opstarten, op iOS én Android.
 *
 * Een `Platform.OS`-check in `_layout.tsx` zou de crash voorkomen, maar de
 * bibliotheek blijft dan in de native bundel zitten voor niets. Twee
 * bestanden houden hem er helemaal uit — hetzelfde als bij Embed, LogoMark
 * en VideoCallModal.
 */
export function WebAnalytics() {
  return null;
}
