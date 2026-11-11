import type { ReactNode } from "react";

import { Kader } from "./Kader";
import { WeergaveKnop } from "./WeergaveKnop";
import { Wortel } from "./Wortel";
import type { KaderNav, Stand, Tab, Weergave } from "./typen";

/**
 * Een pagina buiten de feed (Gesprekken, Events): hetzelfde kader als de feed
 * in de gekozen weergave, met de knoppen voor de weergave. Kiezen gaat naar de feed in
 * die weergave, zoals in het prototype.
 */
export function DesktopPagina({
  weergave,
  kiesWeergave,
  stand,
  kiesStand,
  nav,
  actief,
  children,
}: {
  weergave: Weergave;
  kiesWeergave: (w: Weergave) => void;
  stand: Stand;
  kiesStand: (s: Stand) => void;
  nav: KaderNav;
  actief: Tab | null;
  children: ReactNode;
}) {
  return (
    <Wortel stand={stand}>
      <Kader
        weergave={weergave}
        actief={actief}
        nav={nav}
        knop={() => <WeergaveKnop weergave={weergave} kies={kiesWeergave} stand={stand} kiesStand={kiesStand} />}
      >
        {children}
      </Kader>
    </Wortel>
  );
}
