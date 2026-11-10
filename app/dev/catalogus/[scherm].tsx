import { Redirect } from "expo-router";
import type { ComponentType } from "react";

/**
 * De testpagina's van catalogus (ontwerp 3e): elk van de 19 schermen met
 * vaste voorbeeldgegevens, voor `npm run catalogus:vergelijk`.
 *
 * Alleen in ontwikkeling. In een productiebuild is `__DEV__` false; Metro
 * vouwt de tak weg vóór hij afhankelijkheden verzamelt, dus de pagina, de
 * voorbeeldgegevens en de voorbeeldfoto's komen niet in de bundel en deze
 * route stuurt door naar de app.
 */
const Pagina: ComponentType = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@/components/lincin/catalogus/dev/DevScherm").DevScherm
  : function Geen() {
      return <Redirect href="/" />;
    };

export default Pagina;
