import type { ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextStyle } from "react-native";

import { Band, Knop, Onderstreept, Schakelaar } from "../Delen";
import { Kaartje, type Regel } from "../Kaartje";
import { Kop, Meer } from "../Kop";
import { Speel } from "../Pictogram";
import { Scherm } from "../Scherm";
import { kaartjeTekst, NAAD, tekst, titel, useCat } from "../stijl";
import { Naad, Raster, Vak } from "../Vak";
import { Foto, Golf, Linc, type Beeld } from "../Voorwerp";
import type { LincBeeld } from "./LijstViews";

/**
 * De overige pagina's van catalogus: Profiel van een vriend (06), Open
 * gesprek (07), Nieuwe bijdrage in twee stappen (09, 10), Instellingen (11)
 * en de soorten inhoud (19).
 */

// ---------------------------------------------------------------
// 06 · Profiel van een vriend
// ---------------------------------------------------------------

export type ProfielStuk = { id: string; voorwerp: ReactNode; regels: Regel[]; label: string; open: () => void };

export function ProfielView({
  kop,
  terug,
  meer,
  beeld,
  naam,
  bio,
  knoppen,
  stukken,
}: {
  kop: Regel[];
  terug: () => void;
  meer?: () => void;
  beeld: LincBeeld;
  naam: string;
  bio: string;
  /** Twee knoppen: de eerste gevuld (Gesprek), de tweede als vlak (Samen plannen). */
  knoppen: { tekst: string; doe: () => void }[];
  stukken: ProfielStuk[];
}) {
  const c = useCat();
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={kop} rechts={meer ? <Meer onPress={meer} /> : undefined} />}>
      <Band style={{ height: 330, padding: 12, justifyContent: "space-between" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {beeld.beeld ? <Foto b={160} h={210} beeld={beeld.beeld} /> : <Linc maat={160} letterMaat={52} {...beeld} style={{ height: 210 }} testID="voorwerp" />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", columnGap: 12 }}>
          <Text numberOfLines={1} style={[titel(52, 0.86), { color: c.inkt, flexShrink: 1 }]}>
            {naam}
          </Text>
          <Text numberOfLines={4} style={[tekst(13, 400, 1.35), { color: c.inkt, width: 170, flexShrink: 0 }]}>
            {bio}
          </Text>
        </View>
      </Band>
      {knoppen.length ? (
        <View testID="band" style={{ flexDirection: "row", columnGap: NAAD, backgroundColor: c.naad, borderTopWidth: NAAD, borderTopColor: c.naad }}>
          {knoppen.map((k, i) => (
            <Knop key={k.tekst} tekst={k.tekst} hoogte={52} soort={i === 0 ? "vol" : "vlak"} onPress={k.doe} style={{ flex: 1 }} />
          ))}
        </View>
      ) : null}
      <Raster>
        {stukken.map((s) => (
          <Vak key={s.id} hoogte={280} regels={s.regels} label={s.label} onPress={s.open}>
            {s.voorwerp}
          </Vak>
        ))}
      </Raster>
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 07 · Open gesprek
// ---------------------------------------------------------------

// De maten van het ontwerp gelden voor de inhoud; de marge komt erbij.

export type Bericht =
  | { soort: "dag"; id: string; tekst: string }
  | { soort: "tekst"; id: string; mijn: boolean; tekst: string; onder?: string }
  | { soort: "bijdrage"; id: string; mijn: boolean; beeld: Beeld; regels: Regel[]; open: () => void }
  | { soort: "spraak"; id: string; mijn: boolean; golf: number[]; duur: string; speelt: boolean; speel: () => void };

export function GesprekView({
  kop,
  avatar,
  terug,
  meer,
  berichten,
  invoer,
}: {
  kop: Regel[];
  avatar: LincBeeld;
  terug: () => void;
  meer?: () => void;
  berichten: Bericht[];
  /** De invoerregel; een gesprek levert zijn eigen veld (zie app/chat). */
  invoer: ReactNode;
}) {
  const c = useCat();
  return (
    <Scherm
      kop={
        <>
          <Kop links="terug" onLinks={terug} avatar={<Linc maat={36} letterMaat={12} {...avatar} />} regels={kop} rechts={meer ? <Meer onPress={meer} /> : undefined} />
          <Naad />
        </>
      }
      voet={invoer}
    >
      {berichten.map((b) => {
        if (b.soort === "dag") {
          return (
            <View key={b.id} style={{ height: 36, alignItems: "center", justifyContent: "center" }}>
              <Text style={[kaartjeTekst, { color: c.label }]}>{b.tekst}</Text>
            </View>
          );
        }
        if (b.soort === "tekst") {
          return (
            <View key={b.id} style={{ alignItems: b.mijn ? "flex-end" : "flex-start", rowGap: 4, paddingHorizontal: 12 }}>
              <View style={{ maxWidth: 270 + 24, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: b.mijn ? c.inkt : c.kaart }}>
                <Text selectable style={[tekst(15, 400, 1.35), { color: b.mijn ? c.tekstOpInkt : c.inkt }]}>
                  {b.tekst}
                </Text>
              </View>
              {b.onder ? <Text style={[kaartjeTekst, { color: c.label }]}>{b.onder}</Text> : null}
            </View>
          );
        }
        if (b.soort === "bijdrage") {
          return (
            <View key={b.id} style={{ paddingVertical: 8, paddingHorizontal: 12, alignItems: b.mijn ? "flex-end" : "flex-start" }}>
              <Pressable accessibilityRole="link" onPress={b.open} style={{ width: 230 + 20, backgroundColor: c.kaart, padding: 10, flexDirection: "row", columnGap: 10, alignItems: "flex-end" }}>
                <Foto b={84} h={106} beeld={b.beeld} />
                <Kaartje regels={b.regels} />
              </Pressable>
            </View>
          );
        }
        return (
          <View key={b.id} style={{ paddingVertical: 8, paddingHorizontal: 12, alignItems: b.mijn ? "flex-end" : "flex-start" }}>
            <View style={{ width: 250 + 20, backgroundColor: c.kaart, padding: 10, flexDirection: "row", alignItems: "center", columnGap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={b.speelt ? "Pauzeer spraakbericht" : "Speel spraakbericht af"}
                onPress={b.speel}
                style={{ width: 44, height: 44, flexShrink: 0, backgroundColor: c.inkt, alignItems: "center", justifyContent: "center" }}
              >
                <Speel kleur={c.tekstOpInkt} />
              </Pressable>
              <Golf hoogtes={b.golf} kleur={c.inkt} hoogte={34} />
              <Text style={[kaartjeTekst, { color: c.inkt }]}>{b.duur}</Text>
            </View>
          </View>
        );
      })}
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 09 · Nieuwe bijdrage, stap 1: de soort
// ---------------------------------------------------------------

export type Soort = "foto" | "tekst" | "poll" | "muziek" | "kleur" | "link" | "plek" | "spraak";

const GOLF_KLEIN = [8, 16, 26, 14, 30, 20, 10, 24, 34, 18];

/** Het voorwerp van een soort, als keuze. */
export function SoortTeken({ soort, beeld }: { soort: Soort; beeld?: Beeld }) {
  const c = useCat();
  switch (soort) {
    case "foto":
      return <Foto b={60} h={76} beeld={beeld} />;
    case "tekst":
      return <Text testID="voorwerp" style={[titel(52, 1), { color: c.inkt }]}>Aa</Text>;
    case "poll":
      return (
        <View testID="voorwerp" style={{ width: 84, rowGap: 6 }}>
          <View style={{ height: 14, width: "100%", backgroundColor: c.inkt }} />
          <View style={{ height: 14, width: "60%", backgroundColor: c.inkt }} />
        </View>
      );
    case "muziek":
      return (
        <View testID="voorwerp" style={{ width: 60, height: 60, borderWidth: 1, borderColor: c.inkt, alignItems: "center", justifyContent: "center" }}>
          <Speel maat={18} kleur={c.inkt} />
        </View>
      );
    case "kleur":
      return <View testID="voorwerp" style={{ width: 60, height: 76, backgroundColor: c.accent }} />;
    case "link":
      return <Text testID="voorwerp" style={[titel(52, 1), { color: c.inkt }]}>↗</Text>;
    case "plek":
      return <View testID="voorwerp" style={{ width: 22, height: 22, backgroundColor: c.inkt, transform: [{ rotate: "45deg" }] }} />;
    case "spraak":
      return (
        <View testID="voorwerp" style={{ flexDirection: "row" }}>
          <Golf hoogtes={GOLF_KLEIN} kleur={c.inkt} hoogte={40} tussen={4} />
        </View>
      );
  }
}

export function NieuwSoortView({
  kop,
  sluit,
  soorten,
  gekozen,
  kies,
  verder,
  verderTekst,
  beeld,
}: {
  kop: Regel[];
  sluit: () => void;
  soorten: Soort[];
  gekozen: Soort;
  kies: (s: Soort) => void;
  verder: () => void;
  verderTekst: string;
  beeld?: Beeld;
}) {
  const c = useCat();
  return (
    <Scherm
      kop={<Kop links="sluiten" onLinks={sluit} regels={kop} />}
      voet={
        <View style={{ height: 64, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 12, backgroundColor: c.kaart }}>
          <Knop tekst={verderTekst} onPress={verder} style={{ paddingHorizontal: 18 }} />
        </View>
      }
    >
      <Raster>
        {soorten.map((s) => (
          <Vak key={s} hoogte={158} gekozen={s === gekozen} label={s} onPress={() => kies(s)} regels={[{ label: "Soort", waarde: s }]}>
            <SoortTeken soort={s} beeld={beeld} />
          </Vak>
        ))}
      </Raster>
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 10 · Nieuwe bijdrage, stap 2: het formulier
// ---------------------------------------------------------------

export type Veldregel =
  | { soort: "invoer"; label: string; waarde: string; plaatshouder: string; zet: (v: string) => void; regels?: number }
  | { soort: "keuze"; label: string; waarde: string; open: () => void }
  | { soort: "schakelaar"; label: string; waarde: string; aan: boolean; zet: (v: boolean) => void };

/** Een regel van het formulier: hetzelfde kaartje, nu invulbaar (86 | waarde | pijl of schakelaar). */
export function FormRegel({ r }: { r: Veldregel }) {
  const c = useCat();
  const label = <Text style={[kaartjeTekst, { color: c.label, width: 86 }]}>{r.label}</Text>;
  const vorm = { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 12 };
  if (r.soort === "invoer") {
    return (
      <Band hoogte={60} style={vorm}>
        {label}
        <TextInput
          value={r.waarde}
          onChangeText={r.zet}
          placeholder={r.plaatshouder}
          placeholderTextColor={c.tekstTweede}
          accessibilityLabel={r.label}
          style={
            {
              flex: 1,
              minWidth: 0,
              height: 44,
              borderBottomWidth: 1,
              borderBottomColor: c.inkt,
              backgroundColor: "transparent",
              color: c.inkt,
              paddingHorizontal: 2,
              paddingVertical: 1,
              ...tekst(16),
              outlineStyle: "none",
            } as unknown as TextStyle
          }
        />
      </Band>
    );
  }
  if (r.soort === "keuze") {
    return (
      <Band hoogte={60} onPress={r.open} label={`${r.label}: ${r.waarde}`} style={vorm}>
        {label}
        <Text style={[tekst(16), { color: c.inkt, flex: 1 }]}>{r.waarde}</Text>
        <Text style={[tekst(16), { color: c.inkt }]}>→</Text>
      </Band>
    );
  }
  return (
    <Band hoogte={60} style={vorm}>
      {label}
      <Text style={[tekst(16), { color: c.inkt, flex: 1 }]}>{r.waarde}</Text>
      <Schakelaar aan={r.aan} onWissel={r.zet} label={r.label} />
    </Band>
  );
}

export function NieuwFotoView({
  kop,
  terug,
  deel,
  kanDelen,
  beeld,
  anderBeeld,
  regels,
}: {
  kop: Regel[];
  terug: () => void;
  deel: () => void;
  kanDelen: boolean;
  beeld: Beeld;
  anderBeeld: () => void;
  regels: Veldregel[];
}) {
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={kop} rechts={<Knop tekst="Deel" onPress={deel} uit={!kanDelen} style={{ marginRight: 12, paddingHorizontal: 18 }} />} />}>
      <Band style={{ height: 400, padding: 12, alignItems: "center", justifyContent: "center", rowGap: 14 }}>
        <Foto b={240} h={300} beeld={beeld} />
        <Onderstreept tekst="Kies een ander beeld" onPress={anderBeeld} style={{ paddingHorizontal: 14 }} />
      </Band>
      {regels.map((r) => (
        <FormRegel key={r.label} r={r} />
      ))}
      <Naad />
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 11 · Instellingen
// ---------------------------------------------------------------

export type Instelling =
  | { soort: "groep"; titel: string }
  | { soort: "regel"; label: string; waarde: string; open?: () => void; pijl?: boolean }
  | { soort: "schakelaar"; label: string; waarde: string; aan: boolean; zet: (v: boolean) => void }
  | { soort: "keuze"; label: string; opties: { label: string; aan: boolean; kies: () => void }[] };

export function InstellingenView({ kop, terug, regels }: { kop: Regel[]; terug: () => void; regels: Instelling[] }) {
  const c = useCat();
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={kop} />}>
      {regels.map((r, i) => {
        if (r.soort === "groep") {
          return (
            // 40 hoog plus 8 marge eronder: in het ontwerp komt de marge bovenop de hoogte.
            <Band key={i} hoogte={40 + 8} style={{ justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 8 }}>
              <Text accessibilityRole="header" style={[kaartjeTekst, { color: c.inkt }]}>
                {r.titel}
              </Text>
            </Band>
          );
        }
        const label = <Text style={[kaartjeTekst, { color: c.label, width: 120 }]}>{r.label}</Text>;
        const vorm = { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: 12 };
        if (r.soort === "keuze") {
          return (
            <Band key={i} hoogte={56} style={vorm}>
              {label}
              <View accessibilityRole="radiogroup" accessibilityLabel={r.label} style={{ flexDirection: "row" }}>
                {r.opties.map((o) => (
                  <Pressable
                    key={o.label}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: o.aan }}
                    onPress={o.kies}
                    style={{ height: 36, paddingHorizontal: 14, justifyContent: "center", ...(o.aan ? { backgroundColor: c.inkt } : { borderWidth: 1, borderColor: c.inkt }) }}
                  >
                    <Text style={[kaartjeTekst, { color: o.aan ? c.tekstOpInkt : c.inkt }]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Band>
          );
        }
        if (r.soort === "schakelaar") {
          return (
            <Band key={i} hoogte={56} style={vorm}>
              {label}
              <Text style={[tekst(15), { color: c.inkt, flex: 1 }]}>{r.waarde}</Text>
              <Schakelaar aan={r.aan} onWissel={r.zet} label={r.label} />
            </Band>
          );
        }
        return (
          <Band key={i} hoogte={56} onPress={r.open} label={`${r.label} ${r.waarde}`.trim()} style={vorm}>
            {label}
            <Text style={[tekst(15), { color: c.inkt, flex: 1 }]}>{r.waarde}</Text>
            {r.pijl === false ? null : <Text style={[tekst(16), { color: c.inkt }]}>→</Text>}
          </Band>
        );
      })}
      <Naad />
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 19 · Soorten inhoud en hun toestand
// ---------------------------------------------------------------

export function SoortenView({ kop, terug, vakken }: { kop: Regel[]; terug: () => void; vakken: { key: string; voorwerp: ReactNode; regels: Regel[] }[] }) {
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={kop} />}>
      <Raster>
        {vakken.map((v) => (
          <Vak key={v.key} hoogte={300} tussen={10} regels={v.regels}>
            {v.voorwerp}
          </Vak>
        ))}
      </Raster>
    </Scherm>
  );
}

