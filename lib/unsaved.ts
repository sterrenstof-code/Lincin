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
 *
 * ---------------------------------------------------------------
 * EEN BEWAKING DIE AANSLOEG NÁ HET PLAATSEN
 * ---------------------------------------------------------------
 * De composeschermen zetten `dirty` op `!submitting && (er staat tekst)`,
 * en `submitting` ging in een `finally` weer uit. Op web betekende dat een
 * vraag over verlies bij een vondst die allang geplaatst wás: teruggaan is
 * daar een `history.back()`, de browser meldt de pop een tel later, en in
 * die tel had `finally` de bewaking alweer aangezet. Je kreeg "je vondst
 * is nog niet geplaatst" over een scherm dat op weg was naar buiten, en
 * de vondst stond intussen gewoon in de feed.
 *
 * Vandaar de regel in die schermen: `submitting` gaat alléén terug uit als
 * het versturen mislukte. Lukt het, dan blijft hij aan tot het scherm weg
 * is — er valt op dat moment ook niets meer te verliezen.
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
