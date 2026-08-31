import { useIsFocused } from "@react-navigation/native";
import { useEffect } from "react";

/**
 * Wat er in de browsertab staat.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN MODULE IS EN GEEN REGEL PER SCHERM
 * ---------------------------------------------------------------
 * Er waren twee dingen die allebei die ene string wilden schrijven, en
 * maar één van de twee deed het.
 *
 * `app/(app)/_layout.tsx` zet het ongelezen-aantal ervoor: `(3) Lincin`,
 * zodat je in een andere tab ziet dat er iets is. Dat is de "poor-man's
 * web push" die daar met zoveel woorden zo genoemd wordt, en hij werkt.
 *
 * Wat ontbrak was de andere helft: wélke pagina dit is. Elke vondst, elk
 * event, elk gesprek en elk profiel heette `Lincin`. Zeven tabs open in
 * je browser en ze zijn alle zeven niet uit elkaar te houden; je
 * geschiedenis is een kolom met twintig keer hetzelfde woord; en deel je
 * een link, dan is de titel die de ontvanger ziet even nietszeggend.
 *
 * Twee schrijvers op één `document.title` gaat mis zodra ze elkaar niet
 * kennen — de laatste die rendert wint, en dat wisselt per navigatie.
 * Vandaar één schrijver hier, met twee ingangen die allebei alleen hún
 * stuk bijwerken.
 *
 * Native heeft geen document; daar is dit stil. De hook wordt toch
 * onvoorwaardelijk aangeroepen, want een hook die soms wel en soms niet
 * loopt is een hook-volgordefout.
 */

const BASE = "Lincin";

let unread = 0;
let page: string | null = null;

function render() {
  if (typeof document === "undefined") return;
  const badge = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ` : "";
  document.title = page ? `${badge}${page} · ${BASE}` : `${badge}${BASE}`;
}

/** Aangeroepen door de tab-layout zodra het aantal verandert. */
export function setUnreadBadge(count: number) {
  unread = count;
  render();
}

/**
 * De naam van dit scherm, zolang je ernaar kijkt.
 *
 * `useIsFocused` en niet alleen mount/unmount: een navigator houdt
 * schermen gemount, dus zonder dat blijft de titel van het scherm waar je
 * vandaan komt staan — of erger, overschrijft het bij een refetch de
 * titel van het scherm dat je nú aankijkt.
 *
 * Geef `null` zolang de naam nog niet bekend is (een detailpagina die nog
 * laadt). Dan blijft er `Lincin` staan in plaats van "undefined".
 */
export function usePageTitle(title: string | null | undefined) {
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) return;
    page = title ?? null;
    render();
    return () => {
      // Alleen opruimen als jij nog de laatste schrijver bent. Bij een
      // navigatie krijgt het nieuwe scherm de focus vóórdat het oude hem
      // verliest; zonder deze vergelijking wist het vertrekkende scherm de
      // titel die zijn opvolger net gezet had.
      if (page === (title ?? null)) {
        page = null;
        render();
      }
    };
  }, [focused, title]);
}
