import { Redirect } from "expo-router";
import type { ComponentType } from "react";

/**
 * De desktoptestpagina's van catalogus (design_handoff_lincin_3e/desktop):
 * elke staat uit staten.json met vaste voorbeeldgegevens, voor
 * `npm run catalogus:vergelijk:desktop` en het gedragsscript.
 *
 * Alleen in ontwikkeling, zoals app/dev/catalogus: in een productiebuild
 * valt de tak weg en stuurt de route door naar de app.
 */
const Pagina: ComponentType = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/components/lincin/catalogus/desktop/dev/DevDesktop").DevDesktop
  : function Geen() {
      return <Redirect href="/" />;
    };

export default Pagina;
