import type { ReactNode } from "react";

import { Kleurveld } from "./Kleurveld";
import { CSS } from "./stijl";
import type { Stand } from "./typen";

/**
 * De wortel van elke desktoppagina van catalogus: het stijlblad, de stand,
 * en bij lichtbak en gloedraster het kleurveld onder alles.
 */
export function Wortel({ stand, veld, children }: { stand: Stand; veld?: string | null | false; children: ReactNode }) {
  const glow = veld !== undefined && veld !== false;
  return (
    <div className={glow ? "cd glowt" : "cd"} data-stand={stand} data-testid="desktop">
      <style>{CSS}</style>
      {glow ? <Kleurveld beeld={veld || null} /> : null}
      <div className="app">{children}</div>
    </div>
  );
}
