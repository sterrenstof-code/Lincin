import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Band, Knop } from "../Delen";
import { Kaartje, type Regel } from "../Kaartje";
import { Kop } from "../Kop";
import { Scherm } from "../Scherm";
import { kaartjeTekst, tekst, titel, useCat } from "../stijl";
import { Naad, Raster, Vak } from "../Vak";
import { Foto, Linc } from "../Voorwerp";
import type { LincBeeld } from "./LijstViews";

/**
 * Een event in catalogus. Het ontwerp heeft dit scherm niet; het volgt de
 * bijdrage (05) en Events (03): de cover of het datumblad als voorwerp met
 * het kaartje ernaast, wie er komt, je antwoord, wat je kunt doen, en de
 * bijdragen in het raster van de home.
 */

export type EventBijdrage = {
  id: string;
  /** Een foto, een video (als voorwerp) of een tekst/link. */
  voorwerp: ReactNode;
  regels: Regel[];
  label: string;
  open?: () => void;
  verwijder?: () => void;
};

export type EventHandeling = { label: string; rechts?: string; doe: () => void; uit?: boolean };

export function EventView({
  kop,
  terug,
  cover,
  dag,
  maand,
  titelTekst,
  regels,
  omschrijving,
  gasten,
  gastenOpen,
  antwoord,
  kom,
  misschien,
  telling,
  voorbij,
  voegToe,
  voegToeTekst,
  voegToeUit,
  handelingen,
  fout,
  melding,
  bijdragen,
  leeg,
  lagen,
}: {
  kop: Regel[];
  terug: () => void;
  cover?: { beeld: string; open: () => void } | null;
  dag: string;
  maand: string;
  titelTekst: string;
  regels: Regel[];
  omschrijving?: string | null;
  gasten: (LincBeeld & { naam: string })[];
  gastenOpen: () => void;
  antwoord: "yes" | "maybe" | null;
  kom: () => void;
  misschien: () => void;
  telling: string;
  voorbij: boolean;
  voegToe: () => void;
  voegToeTekst: string;
  voegToeUit?: boolean;
  handelingen: EventHandeling[];
  fout?: string | null;
  melding: string;
  bijdragen: EventBijdrage[];
  /** Tekst als er (nog) niets te zien is: vergrendeld of leeg. */
  leeg?: { titel: string; tekst: string } | null;
  /** Bladen die over het scherm schuiven (gasten, instellingen, toevoegen). */
  lagen?: ReactNode;
}) {
  const c = useCat();
  const keuze = (label: string, aan: boolean, doe: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="radio"
      accessibilityState={{ selected: aan, disabled: voorbij }}
      disabled={voorbij}
      onPress={doe}
      style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", opacity: voorbij ? 0.5 : 1, ...(aan ? { backgroundColor: c.inkt } : { borderWidth: 1, borderColor: c.inkt }) }}
    >
      <Text style={[kaartjeTekst, { color: aan ? c.tekstOpInkt : c.inkt }]}>{label}</Text>
    </Pressable>
  );
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={kop} />}>
      <Band style={{ paddingTop: 28, paddingHorizontal: 12, paddingBottom: 12, alignItems: "center", rowGap: 24 }}>
        {cover ? (
          <Pressable accessibilityRole="imagebutton" accessibilityLabel={titelTekst} onPress={cover.open}>
            <Foto b={250} h={300} beeld={cover.beeld} />
          </Pressable>
        ) : (
          <View testID="voorwerp" style={{ width: 160, height: 200, backgroundColor: c.kaart, alignItems: "center", justifyContent: "center", rowGap: 6 }}>
            <Text style={[titel(96, 0.8), { color: c.inkt }]}>{dag}</Text>
            <Text style={[kaartjeTekst, { color: c.inkt }]}>{maand}</Text>
          </View>
        )}
        <View style={{ alignSelf: "stretch", rowGap: 12 }}>
          <Text accessibilityRole="header" style={[titel(44, 0.92), { color: c.inkt }]}>
            {titelTekst}
          </Text>
          <Kaartje regels={regels} />
          {omschrijving ? <Text style={[tekst(15, 400, 1.35), { color: c.inkt }]}>{omschrijving}</Text> : null}
        </View>
      </Band>

      <Band hoogte={60} onPress={gastenOpen} label={`Gasten, ${gasten.length}`} style={{ flexDirection: "row", alignItems: "center", columnGap: 12, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: "row", columnGap: 3 }}>
          {gasten.slice(0, 7).map((g, i) => (
            <Linc key={i} maat={28} letterMaat={10} {...g} />
          ))}
        </View>
        <Text numberOfLines={1} style={[tekst(15, 500), { color: c.inkt, flex: 1 }]}>
          {gasten.length > 7 ? `+${gasten.length - 7}` : ""}
        </Text>
        <Text style={[kaartjeTekst, { color: c.label }]}>{`Gasten · ${gasten.length} →`}</Text>
      </Band>

      <Band style={{ padding: 12, rowGap: 8 }}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Kom je?" style={{ flexDirection: "row", columnGap: 8 }}>
          {keuze("Ik kom", antwoord === "yes", kom)}
          {keuze("Misschien", antwoord === "maybe", misschien)}
        </View>
        <Text style={[kaartjeTekst, { color: c.label }]}>{voorbij ? "Voorbij" : telling || "Nog niemand antwoordde"}</Text>
      </Band>

      <Band style={{ padding: 12 }}>
        <Knop tekst={voegToeTekst} pijl onPress={voegToe} uit={voegToeUit} breedte="100%" />
      </Band>
      {handelingen.map((h) => (
        <Band key={h.label} hoogte={60} onPress={h.uit ? undefined : h.doe} label={h.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, opacity: h.uit ? 0.5 : 1 }}>
          <Text style={[tekst(15, 500), { color: c.inkt }]}>{h.label}</Text>
          <Text style={[kaartjeTekst, { color: c.label }]}>{h.rechts ?? "→"}</Text>
        </Band>
      ))}
      {fout ? (
        <Band style={{ padding: 12 }}>
          <Text style={[tekst(15, 400, 1.35), { color: c.gevaar }]}>{fout}</Text>
        </Band>
      ) : null}

      {/* 40 hoog plus 8 marge eronder, zoals een groep in Instellingen (11). */}
      <Band hoogte={40 + 8} style={{ justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 8 }}>
        <Text accessibilityRole="header" style={[kaartjeTekst, { color: c.inkt }]}>
          {`Bijdragen · ${bijdragen.length}`}
        </Text>
      </Band>
      {leeg ? (
        <Band style={{ padding: 12, rowGap: 6 }}>
          <Text style={[tekst(16, 500), { color: c.inkt }]}>{leeg.titel}</Text>
          <Text style={[tekst(14, 400, 1.35), { color: c.tekstTweede }]}>{leeg.tekst}</Text>
        </Band>
      ) : (
        <Raster>
          {bijdragen.map((b) => (
            <Vak key={b.id} hoogte={248} regels={b.regels} label={b.label} onPress={b.open} onLongPress={b.verwijder}>
              {b.voorwerp}
            </Vak>
          ))}
        </Raster>
      )}
      <Band style={{ padding: 12 }}>
        <Text style={[tekst(13, 400, 1.35), { color: c.tekstTweede }]}>{melding}</Text>
      </Band>
      <Naad />
      {lagen}
    </Scherm>
  );
}

