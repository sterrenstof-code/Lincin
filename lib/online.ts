import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Of er verbinding is.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * De app wist het niet. Geen `NetInfo`, geen `navigator.onLine`, nergens.
 * Elke mislukking zag er daardoor hetzelfde uit — een toast met "niet
 * verstuurd" — of je nu in een tunnel zat of de server een fout gaf.
 *
 * Dat verschil is precies wat je wil weten. Bij het tweede probeer je het
 * opnieuw; bij het eerste heeft dat geen zin tot je weer bereik hebt, en
 * dan is een knop "Opnieuw" die weer faalt erger dan geen knop.
 *
 * ---------------------------------------------------------------
 * WAT DIT NIET IS
 * ---------------------------------------------------------------
 * `navigator.onLine` weet alleen of er een netwerkinterface is, niet of
 * er iets achter zit: een wifi zonder internet leest als online. Dat is
 * een bekende beperking en geen reden om het weg te laten — de valse
 * "online" is precies het geval waarin de gewone foutmelding alsnog het
 * juiste antwoord is. De valse *offline* bestaat niet, en dat is de kant
 * waar we een uitspraak op baseren.
 *
 * Er wordt bewust geen `@react-native-community/netinfo` bijgehaald: dat
 * is een native module met een config-plugin voor één booleaan, en web is
 * hier het hoofdplatform. Op native staat dit daarom altijd op `true` —
 * daar draagt de gewone foutafhandeling het.
 */
export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    // De beginstand pas hier, niet in `useState`: op de server bestaat
    // `navigator` niet, en dan valt de hele pagina om op de eerste render.
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
