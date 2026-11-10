import type { ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { Kaartje, type Regel } from "../Kaartje";
import { Kop, Meldingen, Plus } from "../Kop";
import { Ballon, Hart } from "../Pictogram";
import { Scherm, useVast } from "../Scherm";
import { kaartjeTekst, NAAD, tekst, titel, useCat } from "../stijl";
import { Tabbalk, type CatTab } from "../Tabbalk";
import { Raster, Vak } from "../Vak";

/**
 * Home (ontwerp 3e, schermen 01, 13, 17 en 18).
 *
 * Eén weergave: het uitgelichte stuk over de volle breedte, daaronder de
 * rest in twee kolommen. Tik op een vak opent de bijdrage; lang drukken
 * tilt het vak op met drie snelle handelingen (17). Wie op de home iets
 * leuk vond — dubbel tikken op het beeld of het hartje na lang drukken —
 * ziet daarna in elk vak het hartje en de reacties (18), zodat je verder
 * kunt reageren zonder te openen. Zonder bijdragen blijft het vak staan,
 * leeg, met één zin en één knop (13).
 */

export type HomeStuk = {
  id: string;
  voorwerp: ReactNode;
  /** Het kaartje onder het voorwerp. */
  regels: Regel[];
  /** Het kaartje in de hartjesstand: zonder de reacties-regel (de ballon telt ze). */
  regelsKort: Regel[];
  breed: boolean;
  label: string;
  hartjes: number | string;
  reacties: number | string;
  vindIkLeuk: boolean;
  /** Naam van de maker, voor "Bericht aan …". */
  wie: string;
  eigen: boolean;
};

export type HomeHandelingen = {
  open: (id: string) => void;
  leuk: (id: string) => void;
  dubbel: (id: string) => void;
  reageer: (id: string) => void;
  bericht: (id: string) => void;
  tilOp: (id: string) => void;
  zetNeer: () => void;
  meldingen: () => void;
  nieuw: () => void;
  tab: (t: CatTab) => void;
};

const HOOG_BREED = 440;
const HOOG = 300;
const HOOG_BREED_HART = 444;
const HOOG_HART = 330;

export function HomeView({
  regels,
  stukken,
  nieuweMeldingen,
  ongelezen,
  hartjesStand,
  opgetild,
  scrollY = 0,
  doe,
}: {
  regels: Regel[];
  stukken: HomeStuk[];
  nieuweMeldingen: number;
  ongelezen: boolean;
  hartjesStand: boolean;
  opgetild: string | null;
  scrollY?: number;
  doe: HomeHandelingen;
}) {
  const c = useCat();
  const vast = useVast();
  const { width } = useWindowDimensions();
  const kop = (
    <Kop
      regels={regels}
      rechts={
        <>
          <Meldingen nieuw={nieuweMeldingen} onPress={doe.meldingen} />
          <Plus onPress={doe.nieuw} />
        </>
      }
    />
  );
  const voet = <Tabbalk actief="feed" ongelezen={ongelezen} onKies={doe.tab} />;

  if (stukken.length === 0) {
    return (
      <Scherm kop={kop} voet={voet}>
        <View style={{ flex: 1, borderTopWidth: NAAD, borderTopColor: c.naad, padding: 12, alignItems: "center", justifyContent: "center", rowGap: 28 }}>
          <View style={{ width: 200, height: 250, borderWidth: 1, borderStyle: "dashed", borderColor: c.inkt }} />
          <Text style={[titel(34, 1), { color: c.inkt, textAlign: "center" }]}>{"Nog niets nieuws\nvandaag."}</Text>
          <Pressable accessibilityRole="button" onPress={doe.nieuw} style={{ height: 48, paddingHorizontal: 20, backgroundColor: c.inkt, justifyContent: "center" }}>
            <Text style={[kaartjeTekst, { color: c.tekstOpInkt }]}>+ Maak zelf iets</Text>
          </Pressable>
        </View>
      </Scherm>
    );
  }

  // Waar het opgetilde vak ligt, gerekend vanaf de bovenkant van het scherm.
  const kolom = (Math.min(width, 640) - NAAD) / 2;
  let rect: { x: number; y: number; b: number; h: number } | null = null;
  const stukOp = opgetild ? stukken.find((s) => s.id === opgetild) ?? null : null;
  if (stukOp) {
    let y = 56 + NAAD;
    let x = 0;
    let half = 0;
    const hoog = (s: HomeStuk) => (hartjesStand ? (s.breed ? HOOG_BREED_HART : HOOG_HART) : s.breed ? HOOG_BREED : HOOG);
    for (const s of stukken) {
      if (s.breed) {
        if (half) y += hoog(s) + NAAD;
        half = 0;
        if (s.id === stukOp.id) {
          rect = { x: 0, y, b: kolom * 2 + NAAD, h: hoog(s) };
          break;
        }
        y += hoog(s) + NAAD;
      } else {
        x = half ? kolom + NAAD : 0;
        if (s.id === stukOp.id) {
          rect = { x, y, b: kolom, h: hoog(s) };
          break;
        }
        half++;
        if (half === 2) {
          y += hoog(s) + NAAD;
          half = 0;
        }
      }
    }
    if (rect && !vast) rect.y -= scrollY;
  }

  const vak = (s: HomeStuk, opgetild = false, style?: object) =>
    hartjesStand ? (
      <HartVak key={s.id} s={s} doe={doe} breed={s.breed} opgetild={opgetild} style={style} />
    ) : (
      <Vak
        key={s.id}
        breed={s.breed}
        hoogte={s.breed ? HOOG_BREED : HOOG}
        regels={s.regels}
        label={s.label}
        opgetild={opgetild}
        style={style}
        onPress={() => doe.open(s.id)}
        onLongPress={() => doe.tilOp(s.id)}
      >
        <DubbelTik onDubbel={() => doe.dubbel(s.id)}>{s.voorwerp}</DubbelTik>
      </Vak>
    );

  const laag =
    stukOp && rect ? (
      <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
        <Pressable accessibilityLabel="Sluit" onPress={doe.zetNeer} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: c.dimlaag }} />
        {vak(stukOp, true, { position: "absolute", left: rect.x, top: rect.y, width: rect.b })}
        <View testID="actierij" style={{ position: "absolute", left: rect.x + 8, top: rect.y - 60, flexDirection: "row", columnGap: 2 }}>
          <SnelKnop label={stukOp.vindIkLeuk ? "Vind ik niet meer leuk" : "Vind ik leuk"} onPress={() => doe.leuk(stukOp.id)}>
            <Hart kleur={c.inkt} vol={stukOp.vindIkLeuk} vulling={c.accent} />
          </SnelKnop>
          <SnelKnop label="Reageer" onPress={() => doe.reageer(stukOp.id)}>
            <Ballon kleur={c.inkt} />
          </SnelKnop>
          {stukOp.eigen ? null : (
            <SnelKnop label={`Bericht aan ${stukOp.wie}`} onPress={() => doe.bericht(stukOp.id)}>
              <Text style={[tekst(20), { color: c.inkt }]}>→</Text>
            </SnelKnop>
          )}
        </View>
      </View>
    ) : null;

  // Het opgetilde vak ligt in de laag; op zijn plek in het raster blijft een leeg vlak.
  const plek = (s: HomeStuk) => (
    <View key={s.id} {...({ breed: s.breed } as object)} style={{ height: hartjesStand ? (s.breed ? HOOG_BREED_HART : HOOG_HART) : s.breed ? HOOG_BREED : HOOG, backgroundColor: c.vlak }} />
  );
  return (
    <Scherm kop={kop} voet={voet} laag={laag}>
      <Raster>{stukken.map((s) => (stukOp && rect && s.id === stukOp.id ? plek(s) : vak(s)))}</Raster>
    </Scherm>
  );
}

function SnelKnop({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const c = useCat();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 56, height: 56, backgroundColor: c.kaart, alignItems: "center", justifyContent: "center" }}>
      {children}
    </Pressable>
  );
}

/** Dubbel tikken op het beeld is een hartje; één tik gaat door naar het vak. */
function DubbelTik({ onDubbel, children }: { onDubbel: () => void; children: ReactNode }) {
  let laatst = 0;
  return (
    <View
      onStartShouldSetResponder={() => false}
      onTouchEnd={() => {
        const nu = Date.now();
        if (nu - laatst < 300) onDubbel();
        laatst = nu;
      }}
    >
      {children}
    </View>
  );
}

/** Het vak in de hartjesstand (18): kaartje met hartje en reacties ernaast of eronder. */
function HartVak({ s, doe, breed, opgetild, style }: { s: HomeStuk; doe: HomeHandelingen; breed: boolean; opgetild: boolean; style?: object }) {
  const c = useCat();
  const knoppen = (
    <>
      <TelKnop label={s.vindIkLeuk ? "Vind ik niet meer leuk" : "Vind ik leuk"} aan={s.vindIkLeuk} onPress={() => doe.leuk(s.id)}>
        <Hart maat={20} kleur={c.inkt} vol={s.vindIkLeuk} vulling={c.accent} />
        <Text style={[tekst(14, 600), { color: c.inkt }]}>{s.hartjes}</Text>
      </TelKnop>
      <TelKnop label="Reacties" onPress={() => doe.reageer(s.id)}>
        <Ballon maat={20} kleur={c.inkt} />
        <Text style={[tekst(14, 600), { color: c.inkt }]}>{s.reacties}</Text>
      </TelKnop>
    </>
  );
  return (
    <View
      testID="vak"
      style={[
        {
          height: breed ? HOOG_BREED_HART : HOOG_HART,
          backgroundColor: opgetild ? c.kaart : c.vlak,
          paddingTop: 12,
          paddingHorizontal: 12,
          paddingBottom: 4,
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.label}
        onPress={() => doe.open(s.id)}
        onLongPress={() => doe.tilOp(s.id)}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <DubbelTik onDubbel={() => doe.dubbel(s.id)}>{s.voorwerp}</DubbelTik>
      </Pressable>
      {breed ? (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", columnGap: 6 }}>
          <Pressable onPress={() => doe.open(s.id)} style={{ flex: 1, minWidth: 0, paddingBottom: 8 }}>
            <Kaartje regels={s.regelsKort} />
          </Pressable>
          <View testID="actierij" style={{ flexDirection: "row", marginRight: -8 }}>
            {knoppen}
          </View>
        </View>
      ) : (
        <View>
          <Pressable onPress={() => doe.open(s.id)} style={{ minWidth: 0, paddingTop: 8 }}>
            <Kaartje regels={s.regelsKort} />
          </Pressable>
          <View testID="actierij" style={{ flexDirection: "row", marginLeft: -8 }}>
            {knoppen}
          </View>
        </View>
      )}
    </View>
  );
}

export function TelKnop({ label, aan, onPress, children }: { label: string; aan?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={aan === undefined ? undefined : { selected: aan }}
      onPress={onPress}
      style={{ height: 44, minWidth: 44, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", columnGap: 6 }}
    >
      {children}
    </Pressable>
  );
}
