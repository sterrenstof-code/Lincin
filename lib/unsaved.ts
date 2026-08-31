import { usePreventRemove, useNavigation } from "@react-navigation/native";
import { useEffect } from "react";
import { Platform } from "react-native";

import { confirm } from "@/lib/confirm";

/**
 * Waarschuwen voordat een half getypte tekst verdwijnt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * Er was in de hele app geen enkele bewaking op weglopen uit een
 * formulier — `beforeRemove`, `usePreventRemove`, `beforeunload`: geen
 * van drieën kwam ergens voor. Tweeduizend tekens in een vondst typen,
 * per ongeluk op terug drukken, en alles is weg zonder dat er iets
 * gevraagd wordt.
 *
 * Dat weegt hier zwaarder dan in de meeste apps. De composeschermen zijn
 * waar het werk gebeurt — een vondst met een toelichting, een event met
 * een beschrijving — en de tekst bestaat nergens anders: er is geen
 * concept op de server, want de server ziet alleen ciphertext.
 *
 * ---------------------------------------------------------------
 * TWEE MANIEREN OM WEG TE GAAN
 * ---------------------------------------------------------------
 * **Binnen de app** — terug-knop, een tabblad, een link. Dat vangt
 * `usePreventRemove` af. React Navigation geeft de actie mee die het
 * tegenhield; zeg je "tóch weg", dan dispatchen we diezelfde actie
 * opnieuw en gaat de navigatie alsnog door. De vraag stellen we met
 * dezelfde `confirm()` als elke andere onomkeerbare actie in de app.
 *
 * **Weg van de app** — de tab sluiten, verversen, de URL veranderen. Daar
 * kan alleen `beforeunload` bij, en die mag geen eigen tekst zetten: elke
 * browser toont sinds jaar en dag zijn eigen standaardzin. `preventDefault()`
 * plus een `returnValue` is het hele gebaar.
 *
 * De twee samen dekken wat er op web kan gebeuren; op native bestaat de
 * tweede niet en doet die tak niets.
 */
export function useUnsavedGuard(
  /** Staat er iets in dat verloren zou gaan? */
  dirty: boolean,
  {
    title = "Niet opgeslagen",
    message = "Je hebt tekst staan die nog niet verstuurd is. Weggaan betekent dat je hem kwijt bent.",
    affirmativeLabel = "Weggaan",
  }: { title?: string; message?: string; affirmativeLabel?: string } = {}
) {
  const navigation = useNavigation();

  usePreventRemove(dirty, ({ data }) => {
    void (async () => {
      const ok = await confirm(title, message, {
        affirmativeLabel,
        destructive: true,
      });
      // Dezelfde actie opnieuw: de bewaking staat nu niet meer in de weg
      // omdat de gebruiker net gezegd heeft dat het mag.
      if (ok) navigation.dispatch(data.action);
    })();
  });

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // De browser schrijft de tekst; wij zeggen alleen dát er iets te
      // vragen valt. Een eigen string wordt sinds Chrome 51 genegeerd.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
