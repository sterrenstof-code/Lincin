import { AppState, Platform } from "react-native";

/**
 * Kijkt de gebruiker nu naar de app?
 *
 * Een open gesprek markeerde elk binnenkomend bericht meteen als gelezen —
 * ook in een tab op de achtergrond, of een venster op je tweede scherm
 * terwijl je in een andere app zat. Er kwam dan nooit een teller, nooit een
 * `(1)` in de tabtitel: het "loste zichzelf op" voor je het zag. Open is
 * niet hetzelfde als gezien; gelezen hoort pas te gebeuren als de pagina
 * zichtbaar is én de focus heeft (web) of de app actief is (native — ook
 * de app-wisselaar en het vergrendelscherm zijn `inactive`).
 */
export function isAttentive(): boolean {
  if (Platform.OS === "web") {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible" && document.hasFocus();
  }
  return AppState.currentState === "active";
}

/** Roept `cb` aan als dat antwoord verandert; geeft de opruimfunctie terug. */
export function subscribeAttention(cb: (attentive: boolean) => void): () => void {
  let last = isAttentive();
  const check = () => {
    const now = isAttentive();
    if (now === last) return;
    last = now;
    cb(now);
  };

  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof document === "undefined") return () => {};
    // Een tik later: tijdens `blur` is de focus soms nog onderweg (naar een
    // iframe in dezelfde pagina bijvoorbeeld), en dan gaf `hasFocus()` even
    // het verkeerde antwoord zonder dat er nog een event volgde.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        check();
      }, 0);
    };
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("focus", onChange);
    window.addEventListener("blur", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("blur", onChange);
    };
  }

  const sub = AppState.addEventListener("change", check);
  return () => sub.remove();
}
