import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Band, Invoer, Onderstreept } from "../Delen";
import { Kaartje, type Regel } from "../Kaartje";
import { Kop, Meer } from "../Kop";
import { Ballon, Hart } from "../Pictogram";
import { Scherm } from "../Scherm";
import { kaartjeTekst, tekst, titel, useCat } from "../stijl";
import { Naad } from "../Vak";
import { Linc } from "../Voorwerp";
import { TelKnop } from "./HomeView";
import type { LincBeeld } from "./LijstViews";

/**
 * Bijdrage (ontwerp 3e, schermen 05, 14, 15 en 16).
 *
 * Het stuk groot als voorwerp, het kaartje ernaast, en de reacties op
 * dezelfde pagina. (Maten zoals het ontwerp: een rand komt bovenop de
 * hoogte, vandaar de `+ 1` en `+ 2`.) De pagina opent rustig (05): een groot beeld, de reacties
 * zonder knoppen. De eerste handeling — het hartje, de ballon, een tik op
 * een reactie, ⋯ — zet haar in de actieve vorm (14–16): het beeld iets
 * kleiner, "Bericht aan …" in de actierij, wie het leuk vond eronder, en
 * per reactie een hartje en "Antwoord". Een antwoord springt in onder zijn
 * reactie; het invoerveld zegt op wie je antwoordt (15). ⋯ dimt de pagina
 * en schuift de handelingen van onder in beeld (16).
 */

export type Reactie = {
  id: string;
  naam: string;
  tijd: string;
  tekst: string;
  linc: LincBeeld;
  /** Een antwoord: ingesprongen, zonder naad erboven. */
  antwoord: boolean;
  hartjes: number;
  vindIkLeuk: boolean;
};

export type MenuRegel = { label: string; gevaar?: boolean; doe: () => void };

export type BijdrageDoe = {
  terug: () => void;
  meer: () => void;
  sluitMenu: () => void;
  leuk: () => void;
  reacties: () => void;
  bericht?: () => void;
  wakker: () => void;
  leukReactie: (id: string) => void;
  antwoord: (id: string) => void;
  stopAntwoord: () => void;
  tekst: (v: string) => void;
  stuur: () => void;
  openLeukDoor?: () => void;
};

export function BijdrageView({
  kop,
  voorwerp,
  titelTekst,
  regels,
  actief,
  hartjes,
  vindIkLeuk,
  aantalReacties,
  berichtAan,
  leukDoor,
  reacties,
  antwoordAan,
  invoer,
  menu,
  doe,
}: {
  kop: Regel[];
  /** Het voorwerp op zijn maat: 290 × 370 rustig, 270 × 340 actief. */
  voorwerp: ReactNode;
  titelTekst: string;
  regels: Regel[];
  actief: boolean;
  hartjes: number | string;
  vindIkLeuk: boolean;
  aantalReacties: number | string;
  /** De naam in "Bericht aan …"; leeg bij je eigen bijdrage. */
  berichtAan: string | null;
  leukDoor: { gezichten: LincBeeld[]; zin: string } | null;
  reacties: Reactie[];
  antwoordAan: string | null;
  invoer: string;
  menu: { kop: string; regels: MenuRegel[] } | null;
  doe: BijdrageDoe;
}) {
  const c = useCat();
  const knop = (aan: boolean, pictogram: ReactNode, getal: number | string, label: string, onPress: () => void) =>
    actief ? (
      <TelKnop label={label} aan={aan} onPress={onPress}>
        {pictogram}
        <Text style={[tekst(14, 600), { color: c.inkt }]}>{getal}</Text>
      </TelKnop>
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: aan }}
        onPress={onPress}
        style={{ height: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", columnGap: 8 }}
      >
        {pictogram}
        <Text style={[tekst(15, 600), { color: c.inkt }]}>{getal}</Text>
      </Pressable>
    );
  const hartKnop = knop(vindIkLeuk, <Hart kleur={c.inkt} vol={vindIkLeuk} vulling={c.accent} />, hartjes, vindIkLeuk ? "Vind ik niet meer leuk" : "Vind ik leuk", doe.leuk);
  const ballonKnop = knop(false, <Ballon kleur={c.inkt} />, aantalReacties, "Reacties", doe.reacties);

  const voet = (
    <>
      {antwoordAan ? (
        <View style={{ height: 36 + 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 12, paddingRight: 4, backgroundColor: c.kaart, borderBottomWidth: 1, borderBottomColor: c.vlak }}>
          <Text style={[kaartjeTekst, { color: c.inkt }]}>Antwoord aan {antwoordAan}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop met antwoorden" onPress={doe.stopAntwoord} style={{ width: 44, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Text style={[tekst(14), { color: c.inkt }]}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      <Invoer
        waarde={invoer}
        onWaarde={doe.tekst}
        plaatshouder={antwoordAan ? `Antwoord aan ${antwoordAan}` : "Schrijf een reactie"}
        onStuur={doe.stuur}
      />
    </>
  );

  const laag = menu ? (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <Pressable accessibilityLabel="Sluit het menu" onPress={doe.sluitMenu} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: c.dimlaag }} />
      <View accessibilityRole="menu" accessibilityLabel="Handelingen voor deze bijdrage" style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.kaart }}>
        <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 16 }}>
          <Text style={[kaartjeTekst, { color: c.label }]}>{menu.kop}</Text>
        </View>
        {menu.regels.map((m) => (
          <Pressable
            key={m.label}
            accessibilityRole="menuitem"
            onPress={m.doe}
            style={{ height: 56 + 1, justifyContent: "center", paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: c.vlak }}
          >
            <Text style={[tekst(16), { color: m.gevaar ? c.gevaar : c.inkt }]}>{m.label}</Text>
          </Pressable>
        ))}
        <Pressable testID="band" accessibilityRole="button" onPress={doe.sluitMenu} style={{ height: 60 + 2, alignItems: "center", justifyContent: "center", borderTopWidth: 2, borderTopColor: c.vlak }}>
          <Text style={[kaartjeTekst, { color: c.inkt }]}>Annuleer</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <Scherm kop={<Kop links="terug" onLinks={doe.terug} regels={kop} rechts={<Meer onPress={doe.meer} />} />} voet={voet} laag={laag}>
      <Band style={{ paddingTop: actief ? 24 : 28, paddingHorizontal: 12, paddingBottom: 12, alignItems: "center", rowGap: actief ? 20 : 24 }}>
        {voorwerp}
        <View style={{ alignSelf: "stretch", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", columnGap: 12 }}>
          <Text style={[titel(44, 0.9), { color: c.inkt, flexShrink: 1 }]}>{titelTekst}</Text>
          <View style={{ width: 150, flexShrink: 0 }}>
            <Kaartje regels={regels} />
          </View>
        </View>
      </Band>
      {actief ? (
        <Band testID="band actierij" hoogte={52} style={{ flexDirection: "row", alignItems: "center", columnGap: 6, paddingHorizontal: 4 }}>
          {hartKnop}
          {ballonKnop}
          <View style={{ flex: 1 }} />
          {berichtAan && doe.bericht ? <Onderstreept tekst={`Bericht aan ${berichtAan}`} onPress={doe.bericht} style={{ paddingHorizontal: 8 }} /> : null}
        </Band>
      ) : (
        <Band style={{ paddingHorizontal: 2 }}>
          <View testID="actierij" style={{ height: 52, flexDirection: "row", alignItems: "center", columnGap: 10, paddingHorizontal: 2 }}>
            {hartKnop}
            {ballonKnop}
          </View>
        </Band>
      )}
      {actief && leukDoor ? (
        <Band hoogte={52} onPress={doe.openLeukDoor} label={leukDoor.zin} style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: "row" }}>
            {leukDoor.gezichten.map((g, i) => (
              <Linc
                key={i}
                maat={28}
                letterMaat={11}
                {...g}
                testID={g.beeld ? "voorwerp" : "linc"}
                // Een foto schuift 6 over zijn voorganger, met een rand in het vlak die
                // (zoals een CSS-outline) boven zijn buren ligt.
                style={i > 0 && g.beeld ? ({ marginLeft: -6, zIndex: 1, outlineWidth: 2, outlineStyle: "solid", outlineColor: c.vlak } as object) : undefined}
              />
            ))}
          </View>
          <Text style={[tekst(13), { color: c.inkt, flexShrink: 1 }]}>{leukDoor.zin}</Text>
        </Band>
      ) : null}
      {reacties.map((r) => (actief ? <ReactieActief key={r.id} r={r} doe={doe} /> : <ReactieRustig key={r.id} r={r} onPress={doe.wakker} />))}
      {actief ? null : <Naad />}
    </Scherm>
  );
}

function Kopregel({ r }: { r: Reactie }) {
  const c = useCat();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={[kaartjeTekst, { color: c.inkt }]}>{r.naam}</Text>
      <Text style={[kaartjeTekst, { color: c.label }]}>{r.tijd}</Text>
    </View>
  );
}

function ReactieRustig({ r, onPress }: { r: Reactie; onPress: () => void }) {
  const c = useCat();
  return (
    <Band onPress={onPress} label={`${r.naam}: ${r.tekst}`} style={{ flexDirection: "row", columnGap: 12, padding: 12 }}>
      <Linc maat={36} letterMaat={12} {...r.linc} />
      <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
        <Kopregel r={r} />
        <Text style={[tekst(15, 400, 1.35), { color: c.inkt }]}>{r.tekst}</Text>
      </View>
    </Band>
  );
}

function ReactieActief({ r, doe }: { r: Reactie; doe: BijdrageDoe }) {
  const c = useCat();
  const inhoud = (
    <>
      <Linc maat={32} letterMaat={11} {...r.linc} />
      <View style={{ flex: 1, minWidth: 0, rowGap: 2 }}>
        <Kopregel r={r} />
        <Text style={[tekst(15, 400, 1.35), { color: c.inkt }]}>{r.tekst}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 4, marginLeft: -8 }}>
          <TelKnop label={r.vindIkLeuk ? "Vind reactie niet meer leuk" : "Vind reactie leuk"} aan={r.vindIkLeuk} onPress={() => doe.leukReactie(r.id)}>
            <Hart maat={18} kleur={c.inkt} vol={r.vindIkLeuk} vulling={c.accent} />
            {r.hartjes > 0 ? <Text style={[tekst(14, 600), { color: c.inkt }]}>{r.hartjes}</Text> : null}
          </TelKnop>
          <Onderstreept tekst="Antwoord" onPress={() => doe.antwoord(r.id)} style={{ paddingHorizontal: 8 }} label={`Antwoord aan ${r.naam}`} />
        </View>
      </View>
    </>
  );
  const vorm = { flexDirection: "row" as const, columnGap: 10, paddingTop: 10, paddingRight: 12, paddingBottom: 4, paddingLeft: r.antwoord ? 54 : 12 };
  return r.antwoord ? <View style={vorm}>{inhoud}</View> : <Band style={vorm}>{inhoud}</Band>;
}
