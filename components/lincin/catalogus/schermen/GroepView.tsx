import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Band, Knop, Onderstreept, Veld } from "../Delen";
import { Kaartje, type Regel } from "../Kaartje";
import { Kop } from "../Kop";
import { Scherm } from "../Scherm";
import { kaartjeTekst, tekst, useCat } from "../stijl";
import { Naad } from "../Vak";
import { Foto, Linc } from "../Voorwerp";
import type { LincBeeld } from "./LijstViews";

/**
 * De details van een groepsgesprek in catalogus: de groep als voorwerp met
 * haar kaartje, daaronder alle leden als rijen, en wat je met de groep kunt
 * (naam en foto wijzigen, iemand toevoegen of verwijderen, verlaten).
 * Het ontwerp heeft dit scherm niet; het volgt Jij (04) en Instellingen (11).
 */

export type GroepLid = {
  id: string;
  naam: string;
  gebruiker: string;
  rol: string;
  sinds: string;
  linc: LincBeeld;
  open: () => void;
  verwijder?: () => void;
};

export type GroepNaam = { waarde: string; zet: (v: string) => void; bewaar: () => void; annuleer: () => void; bezig: boolean };

export function GroepView({
  kop,
  terug,
  beeld,
  regels,
  beeldWijzigen,
  beeldBezig,
  naamWijzigen,
  naam,
  leden,
  toevoegen,
  verlaat,
  fout,
  laden,
}: {
  kop: Regel[];
  terug: () => void;
  beeld: LincBeeld;
  regels: Regel[];
  beeldWijzigen?: () => void;
  beeldBezig?: boolean;
  naamWijzigen?: () => void;
  /** Gezet terwijl de eigenaar de naam bewerkt. */
  naam?: GroepNaam | null;
  leden: GroepLid[];
  toevoegen?: () => void;
  verlaat: () => void;
  fout?: string | null;
  laden?: boolean;
}) {
  const c = useCat();
  const voorwerp: ReactNode = beeld.beeld ? (
    <Foto b={150} h={150} beeld={beeld.beeld} />
  ) : (
    <Linc maat={150} letterMaat={48} {...beeld} testID="voorwerp" />
  );
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={kop} />}>
      <Band style={{ height: 260, padding: 12, justifyContent: "space-between" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {beeldWijzigen ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Groepsfoto wijzigen" onPress={beeldWijzigen}>
              {voorwerp}
              {beeldBezig ? (
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: c.dimlaag }}>
                  <ActivityIndicator color={c.kaart} />
                </View>
              ) : null}
            </Pressable>
          ) : (
            voorwerp
          )}
        </View>
        <Kaartje regels={regels} />
      </Band>

      {naam ? (
        <Band style={{ padding: 12, rowGap: 8 }}>
          <Veld waarde={naam.waarde} onWaarde={naam.zet} plaatshouder="Groepsnaam" onStuur={naam.bewaar} autoFocus />
          <View style={{ flexDirection: "row", columnGap: 8 }}>
            <Knop tekst="Annuleer" soort="lijn" onPress={naam.annuleer} style={{ flex: 1 }} />
            <Knop tekst={naam.bezig ? "Bezig" : "Bewaar"} onPress={naam.bewaar} uit={naam.bezig || !naam.waarde.trim()} style={{ flex: 1 }} />
          </View>
        </Band>
      ) : null}
      {!naam && naamWijzigen ? <Actie label="Naam wijzigen" onPress={naamWijzigen} /> : null}
      {beeldWijzigen ? <Actie label="Groepsfoto wijzigen" onPress={beeldWijzigen} /> : null}
      {fout ? (
        <Band style={{ padding: 12 }}>
          <Text style={[tekst(15, 400, 1.35), { color: c.gevaar }]}>{fout}</Text>
        </Band>
      ) : null}

      {/* 40 hoog plus 8 marge eronder, zoals een groep in Instellingen (11). */}
      <Band hoogte={40 + 8} style={{ justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 8 }}>
        <Text accessibilityRole="header" style={[kaartjeTekst, { color: c.inkt }]}>
          {`Leden · ${leden.length}`}
        </Text>
      </Band>
      {laden ? (
        <Band style={{ padding: 12 }}>
          <Text style={[tekst(15, 400, 1.35), { color: c.tekstTweede }]}>Laden</Text>
        </Band>
      ) : (
        leden.map((l) => (
          <Band
            key={l.id}
            onPress={l.open}
            label={`${l.naam}, ${l.rol}`}
            hoogte={72}
            style={{ flexDirection: "row", alignItems: "center", columnGap: 12, paddingHorizontal: 12 }}
          >
            <Linc maat={48} letterMaat={16} {...l.linc} />
            <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
              <Text numberOfLines={1} style={[tekst(16, 500), { color: c.inkt }]}>
                {l.naam}
              </Text>
              <Text numberOfLines={1} style={[tekst(13), { color: c.tekstTweede }]}>
                {l.gebruiker}
              </Text>
            </View>
            {l.verwijder ? (
              <Onderstreept tekst="Verwijder" label={`${l.naam} uit de groep verwijderen`} onPress={l.verwijder} />
            ) : (
              <View style={{ width: 128, flexShrink: 0 }}>
                <Kaartje
                  regels={[
                    { label: "Rol", waarde: l.rol },
                    { label: "Sinds", waarde: l.sinds },
                  ]}
                />
              </View>
            )}
          </Band>
        ))
      )}
      {toevoegen ? <Actie label="Voeg iemand toe" rechts="+" onPress={toevoegen} /> : null}

      <Band hoogte={60} onPress={verlaat} label="Verlaat groep" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
        <Text style={[tekst(15, 500), { color: c.gevaar }]}>Verlaat groep</Text>
        <Text style={[kaartjeTekst, { color: c.gevaar }]}>→</Text>
      </Band>
      <Band style={{ padding: 12 }}>
        <Text style={[tekst(13, 400, 1.35), { color: c.tekstTweede }]}>
          Verlaat je de groep, dan kun je de oude berichten niet meer openen: je toestel krijgt de nieuwe sleutels niet.
        </Text>
      </Band>
      <Naad />
    </Scherm>
  );
}

function Actie({ label, rechts = "→", onPress }: { label: string; rechts?: string; onPress: () => void }) {
  const c = useCat();
  return (
    <Band hoogte={60} onPress={onPress} label={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
      <Text style={[tekst(15, 500), { color: c.inkt }]}>{label}</Text>
      <Text style={[kaartjeTekst, { color: c.label }]}>{rechts}</Text>
    </Band>
  );
}
