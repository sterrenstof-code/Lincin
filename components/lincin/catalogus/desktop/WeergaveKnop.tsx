import { Icoon } from "./Iconen";
import type { Stand, Weergave } from "./typen";

/**
 * De weergave in de bovenbalk: twee knoppen met elk hun schema, Wand en
 * Gloedraster, en daarnaast licht of donker. Eén klik wisselt meteen.
 *
 * Sinds nov 2026 alleen nog deze twee; Wand op blad en Lichtbak bestaan nog
 * als testpagina's (dev), maar je kiest ze niet meer.
 */

export const KEUZES: [Weergave, string][] = [
  ["wand", "Wand"],
  ["gloedraster", "Gloedraster"],
];

export function WeergaveKnop({
  weergave,
  kies,
  stand,
  kiesStand,
}: {
  weergave: Weergave;
  kies: (w: Weergave) => void;
  stand: Stand;
  kiesStand: (s: Stand) => void;
}) {
  const donker = stand === "donker";
  return (
    <span className="wk" data-meet="wk">
      <span className="wkgroep" role="radiogroup" aria-label="Weergave">
        {KEUZES.map(([k, naam]) => (
          <button
            key={k}
            className="wkbtn"
            role="radio"
            aria-checked={weergave === k}
            aria-label={naam}
            title={naam}
            onClick={() => weergave !== k && kies(k)}
            data-meet="wkkeuze"
            data-w={k}
          >
            <Icoon naam={k === "gloedraster" ? "gloedraster" : "wand"} />
          </button>
        ))}
      </span>
      <button
        className="ib"
        aria-label={donker ? "Licht" : "Donker"}
        title={donker ? "Licht" : "Donker"}
        onClick={() => kiesStand(donker ? "licht" : "donker")}
        data-meet="wkstand"
      >
        <Icoon naam={donker ? "zon" : "maan"} />
      </button>
    </span>
  );
}
