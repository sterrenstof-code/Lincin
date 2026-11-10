import { useState, type ReactNode } from "react";

import { Kader } from "./Kader";
import { WeergaveKnop } from "./WeergaveKnop";
import { Wortel } from "./Wortel";
import type { KaderNav, Stand, Tab, Weergave } from "./typen";

/**
 * Een pagina buiten de feed (Gesprekken, Events): hetzelfde kader als de feed
 * in de gekozen weergave, met de knop Weergave. Kiezen gaat naar de feed in
 * die weergave, zoals in het prototype.
 */
export function DesktopPagina({
  weergave,
  kiesWeergave,
  stand,
  kiesStand,
  nav,
  actief,
  startMenu = false,
  children,
}: {
  weergave: Weergave;
  kiesWeergave: (w: Weergave) => void;
  stand: Stand;
  kiesStand: (s: Stand) => void;
  nav: KaderNav;
  actief: Tab | null;
  startMenu?: boolean;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(startMenu);
  return (
    <Wortel stand={stand}>
      <Kader
        weergave={weergave}
        actief={actief}
        nav={nav}
        knop={(links) => <WeergaveKnop weergave={weergave} open={menu} zetOpen={setMenu} kies={kiesWeergave} stand={stand} kiesStand={kiesStand} links={links} />}
      >
        {children}
      </Kader>
    </Wortel>
  );
}
