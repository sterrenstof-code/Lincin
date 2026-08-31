import { Text, View } from "react-native";

import { useScheme } from "@/lib/design/theme";
import {
  desk as deskColor,
  feed,
  FEED_BORDER,
  feedType,
  flame,
  flameDeep,
  space,
} from "@/lib/design/type";

/**
 * Wat er staat als een formulier niet door kan.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN ONDERDEEL IS
 * ---------------------------------------------------------------
 * `QueryError` dekte de mislukte *query* en `useToast()` de mislukte
 * *mutatie ná een optimistische update* (DESIGN.md §4b). Wat daar tussenin
 * viel — "dit veld klopt niet", "dit opslaan lukte niet" — had geen huis,
 * en dus schreef elk scherm zijn eigen versie: `text-red-700`,
 * `text-red-400`, `bg-red-100 border-red-300`, `text-red-800`. Dat is
 * Tailwinds eigen rood, een tweede rood naast `flame`, en §7 laat er maar
 * één toe.
 *
 * Het was ook niet alleen een stijlkwestie. `text-red-400` (#F87171) stond
 * op `bg-desk`, en `bg-desk` kantelt: in de lichte stand is dat blad
 * `#F7F7F5`, en dan haalt die tekst nog geen 2.5:1. De melding die zegt
 * dát er iets mis is was precies in de stand waarin je hem het hardst
 * nodig hebt niet te lezen. Exact de val uit §2 — nooit in één stand
 * nakijken.
 *
 * ---------------------------------------------------------------
 * WELK ROOD, EN WAAROM HET ER TWEE ZIJN
 * ---------------------------------------------------------------
 * Op het paginavlak is het antwoord `flameDeep`: deze meldingen zijn klein
 * en §2 zegt dat de DEFAULT onder ~16px geen 4.5:1 haalt.
 *
 * Op een §8-blad ligt het andersom, en dat is precies waarom `tone` hier
 * bestaat. `bg-desk` kantelt — zwart in de donkere stand, papier in de
 * lichte — dus het rood erop moet mee kantelen. `flameDeep` (#A81C13) op
 * het zwarte blad is donkerrood op bijna-zwart en leest niet; daar is
 * `flame` de juiste. In de lichte stand geldt weer de gewone regel.
 *
 * Dat wordt hier met `useScheme()` opgelost en niet met een nieuw token.
 * Een `deskFlame` in `theme.ts` zou de palettabel laten groeien voor
 * schermen die volgens §8 juist wegmigreren — dan is het token er nog
 * lang nadat het laatste blad verdwenen is. Zo staat het op één plek en
 * verdwijnt het vanzelf mee.
 */
function useErrorInk(tone: "page" | "desk"): string {
  const scheme = useScheme();
  if (tone === "desk") return scheme === "dark" ? flame : flameDeep;
  return flameDeep;
}

/** Eén regel onder een veld: "Minstens 8 tekens", "Bevestiging matcht niet". */
export function FieldError({
  children,
  tone = "page",
  style,
}: {
  children: string;
  tone?: "page" | "desk";
  style?: object;
}) {
  const ink = useErrorInk(tone);
  return (
    <Text
      accessibilityRole="alert"
      style={[feedType.caption, { color: ink, marginTop: space.sm }, style]}
    >
      {children}
    </Text>
  );
}

/**
 * Het blok boven of onder een knop: "Opslaan lukte niet".
 *
 * Dezelfde rode omlijning als `QueryError`, want het zegt hetzelfde soort
 * ding: aan de vorm zie je al dat er iets mis is voordat je leest. Geen
 * vulling — §4, een gevuld vlak is de primaire actie en verder niets.
 */
export function FormError({
  children,
  tone = "page",
  style,
}: {
  children: string;
  tone?: "page" | "desk";
  style?: object;
}) {
  const edge = useErrorInk(tone);
  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          borderWidth: FEED_BORDER,
          borderColor: edge,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          marginTop: space.lg,
        },
        style,
      ]}
    >
      <Text
        style={[
          feedType.body,
          { color: tone === "desk" ? deskColor.ink : feed.ink },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
