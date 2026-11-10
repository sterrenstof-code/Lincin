import type { ReactNode } from "react";
import { Text } from "react-native";

import type { Regel } from "../Kaartje";
import { useCatNav } from "../nav";
import { Band } from "../Delen";
import { kaartjeTekst, tekst, useCat } from "../stijl";
import { EventsView, GesprekkenView, JijView, MeldingenView, type EventRij, type GesprekRij, type Ingang, type LincBeeld, type MeldingRij } from "./LijstViews";

/**
 * De koppeling tussen de bestaande schermen in app/(app) en de
 * catalogusweergaven. Elk scherm rekent zijn rijen zoals het dat voor
 * magazine en modern al deed; hier krijgen ze de vorm van catalogus.
 */

/** Een regel onderaan voor wat de app kan maar het ontwerp niet toont (een nieuwe groep, een event plannen). */
export function ExtraRegel({ label, rechts = "→", onPress }: { label: string; rechts?: string; onPress: () => void }) {
  const c = useCat();
  return (
    <Band hoogte={60} onPress={onPress} label={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
      <Text style={[tekst(15, 500), { color: c.inkt }]}>{label}</Text>
      <Text style={[kaartjeTekst, { color: c.label }]}>{rechts}</Text>
    </Band>
  );
}

/** Een regel tekst op de plek van de lijst: laden, fout, leeg. */
export function Stand({ tekst: t }: { tekst: string }) {
  const c = useCat();
  return (
    <Band style={{ padding: 12 }}>
      <Text style={[tekst(15, 400, 1.35), { color: c.tekstTweede }]}>{t}</Text>
    </Band>
  );
}

function useHoofd(regels: Regel[]) {
  const nav = useCatNav();
  return {
    regels,
    nieuweMeldingen: nav.nieuweMeldingen,
    ongelezen: nav.ongelezen,
    meldingen: nav.meldingen,
    nieuw: nav.nieuw,
    tab: nav.tab,
  };
}

export function GesprekkenCatalogus({
  rijen,
  ongelezen,
  stand,
  onderaan,
}: {
  rijen: GesprekRij[];
  ongelezen: number;
  stand: string | null;
  onderaan?: ReactNode;
}) {
  const hoofd = useHoofd([
    { label: "Lincin", waarde: "Gesprekken" },
    { label: "Nieuw", waarde: ongelezen ? `${ongelezen} ongelezen` : "—" },
    { label: "Totaal", waarde: `${rijen.length} ${rijen.length === 1 ? "gesprek" : "gesprekken"}` },
  ]);
  return <GesprekkenView hoofd={hoofd} rijen={rijen} stand={stand} onderaan={onderaan} />;
}

export function EventsCatalogus({ rijen, eerstvolgende, stand, onderaan }: { rijen: EventRij[]; eerstvolgende: string; stand: string | null; onderaan?: ReactNode }) {
  const gepland = rijen.filter((r) => !r.voorbij).length;
  const hoofd = useHoofd([
    { label: "Lincin", waarde: "Events" },
    { label: "Gepland", waarde: String(gepland) },
    { label: "Eerstvolgende", waarde: eerstvolgende || "—" },
  ]);
  return <EventsView hoofd={hoofd} rijen={rijen} stand={stand} onderaan={onderaan} />;
}

export function JijCatalogus({ beeld, regels, ingangen, themaStand }: { beeld: LincBeeld; regels: Regel[]; ingangen: Ingang[]; themaStand: string }) {
  const hoofd = useHoofd([
    { label: "Lincin", waarde: "Jij" },
    { label: "Thema", waarde: "Catalogus" },
    { label: "Stand", waarde: themaStand },
  ]);
  return <JijView hoofd={hoofd} beeld={beeld} regels={regels} ingangen={ingangen} />;
}

export function MeldingenCatalogus({
  rijen,
  nieuw,
  terug,
  allesGelezen,
  stand,
}: {
  rijen: MeldingRij[];
  nieuw: number;
  terug: () => void;
  allesGelezen: () => void;
  stand: string | null;
}) {
  return (
    <MeldingenView
      regels={[
        { label: "Lincin", waarde: "Meldingen" },
        { label: "Nieuw", waarde: String(nieuw) },
        { label: "Totaal", waarde: String(rijen.length) },
      ]}
      terug={terug}
      allesGelezen={allesGelezen}
      rijen={rijen}
      leeg={stand ?? undefined}
    />
  );
}
