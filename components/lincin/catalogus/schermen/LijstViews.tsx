import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Band, Knop, MetNaam, OnderstreeptTekst } from "../Delen";
import { Kaartje, type Regel } from "../Kaartje";
import { Kop, Meldingen, Plus, TekstKnop } from "../Kop";
import { Scherm } from "../Scherm";
import { kaartjeTekst, NAAD, tekst, titel, useCat } from "../stijl";
import { Tabbalk, type CatTab } from "../Tabbalk";
import { Naad, Raster, Vak } from "../Vak";
import { Foto, Linc, type Beeld } from "../Voorwerp";

/**
 * De lijstpagina's van catalogus: Gesprekken (02), Events (03), Jij (04),
 * Meldingen (08) en Mijn lincs (12). Alleen weergave; de gegevens komen uit
 * de schermen in app/ (of uit de voorbeelden van de testpagina's).
 */

export type Hoofd = {
  regels: Regel[];
  nieuweMeldingen: number;
  ongelezen: boolean;
  meldingen: () => void;
  nieuw: () => void;
  tab: (t: CatTab) => void;
};

function HoofdKop({ h }: { h: Hoofd }) {
  return (
    <Kop
      regels={h.regels}
      rechts={
        <>
          <Meldingen nieuw={h.nieuweMeldingen} onPress={h.meldingen} />
          <Plus onPress={h.nieuw} />
        </>
      }
    />
  );
}

/** Een linc als klein beeld: zijn foto of zijn kleur met initiaal. */
export type LincBeeld = { beeld?: Beeld; kleur?: string | null; initiaal: string; letterKleur?: string };

// ---------------------------------------------------------------
// 02 · Gesprekken
// ---------------------------------------------------------------

export type GesprekRij = {
  id: string;
  naam: string;
  regel: string;
  tijd: string;
  nieuw: number;
  linc: LincBeeld;
  open: () => void;
  lang?: () => void;
};

export function GesprekkenView({ hoofd, rijen, stand, onderaan }: { hoofd: Hoofd; rijen: GesprekRij[]; stand?: string | null; onderaan?: ReactNode }) {
  const c = useCat();
  return (
    <Scherm kop={<HoofdKop h={hoofd} />} voet={<Tabbalk actief="chats" ongelezen={hoofd.ongelezen} onKies={hoofd.tab} />}>
      {rijen.map((r) => {
        const vet = r.nieuw > 0;
        return (
          <Band
            key={r.id}
            onPress={r.open}
            label={`${r.naam}${vet ? `, ${r.nieuw} nieuw` : ""}`}
            onLongPress={r.lang}
            hoogte={88}
            style={{ flexDirection: "row", alignItems: "center", columnGap: 12, paddingHorizontal: 12 }}
          >
            <Linc maat={56} letterMaat={18} {...r.linc} />
            <View style={{ flex: 1, minWidth: 0, rowGap: 4 }}>
              <Text numberOfLines={1} style={[tekst(16, vet ? 600 : 500), { color: c.inkt }]}>
                {r.naam}
              </Text>
              <Text numberOfLines={1} style={[tekst(13, vet ? 600 : 400), { color: vet ? c.inkt : c.tekstTweede }]}>
                {r.regel}
              </Text>
            </View>
            <View style={{ width: 92, flexShrink: 0 }}>
              <Kaartje
                regels={[
                  { label: "Tijd", waarde: r.tijd },
                  { label: "Nieuw", waarde: vet ? String(r.nieuw) : "—" },
                ]}
              />
            </View>
          </Band>
        );
      })}
      {stand ? <StandRegel tekst={stand} /> : null}
      {onderaan}
      <Naad />
    </Scherm>
  );
}

function StandRegel({ tekst: t }: { tekst: string }) {
  const c = useCat();
  return (
    <Band style={{ padding: 12 }}>
      <Text style={[tekst(15, 400, 1.35), { color: c.tekstTweede }]}>{t}</Text>
    </Band>
  );
}

// ---------------------------------------------------------------
// 03 · Events
// ---------------------------------------------------------------

export type EventRij = {
  id: string;
  dag: string;
  maand: string;
  titel: string;
  regels: Regel[];
  komen: (LincBeeld & { naam: string })[];
  jijKomt: boolean;
  /** Voorbij: geen antwoord meer, alleen het woord. */
  voorbij?: boolean;
  open: () => void;
  kom: () => void;
  komNiet: () => void;
};

export function EventsView({ hoofd, rijen, stand, onderaan }: { hoofd: Hoofd; rijen: EventRij[]; stand?: string | null; onderaan?: ReactNode }) {
  const c = useCat();
  return (
    <Scherm kop={<HoofdKop h={hoofd} />} voet={<Tabbalk actief="events" ongelezen={hoofd.ongelezen} onKies={hoofd.tab} />}>
      {rijen.map((e) => (
        <View key={e.id} testID="band" style={{ flexShrink: 0, flexDirection: "row", columnGap: NAAD, backgroundColor: c.naad, borderTopWidth: NAAD, borderTopColor: c.naad }}>
          <Pressable
            testID="vak"
            accessibilityRole="button"
            accessibilityLabel={`${e.titel}, ${e.dag} ${e.maand}`}
            onPress={e.open}
            style={{ width: 132, height: 196, backgroundColor: c.vlak, alignItems: "center", justifyContent: "center" }}
          >
            <View testID="voorwerp" style={{ width: 96, height: 120, backgroundColor: c.kaart, alignItems: "center", justifyContent: "center", rowGap: 4 }}>
              <Text style={[titel(64, 0.8), { color: c.inkt }]}>{e.dag}</Text>
              <Text style={[kaartjeTekst, { color: c.inkt }]}>{e.maand}</Text>
            </View>
          </Pressable>
          <View testID="vak" style={{ flex: 1, minWidth: 0, backgroundColor: c.vlak, padding: 12, justifyContent: "space-between" }}>
            <Pressable accessibilityRole="link" onPress={e.open}>
              <Text style={[titel(26, 1), { color: c.inkt }]}>{e.titel}</Text>
            </Pressable>
            <Kaartje regels={e.regels} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View accessibilityRole="image" accessibilityLabel={`Wie komt er: ${e.komen.map((k) => k.naam).join(", ")}`} style={{ flexDirection: "row", columnGap: 3 }}>
                {e.komen.map((k, i) => (
                  <Linc key={i} maat={24} letterMaat={8} {...k} />
                ))}
              </View>
              {e.voorbij ? (
                <Text style={[kaartjeTekst, { color: c.label }]}>Voorbij</Text>
              ) : e.jijKomt ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Je komt. Tik om af te melden." onPress={e.komNiet} style={{ minHeight: 44, justifyContent: "center", marginVertical: -15 }}>
                  <OnderstreeptTekst tekst="Je komt" />
                </Pressable>
              ) : (
                <Knop tekst="Ik kom" soort="lijn" onPress={e.kom} style={{ paddingHorizontal: 16 }} />
              )}
            </View>
          </View>
        </View>
      ))}
      {stand ? <StandRegel tekst={stand} /> : null}
      {onderaan}
      <Naad />
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 04 · Jij
// ---------------------------------------------------------------

export type Ingang = { label: string; rechts: string; open: () => void };

export function JijView({ hoofd, beeld, regels, ingangen }: { hoofd: Hoofd; beeld: LincBeeld; regels: Regel[]; ingangen: Ingang[] }) {
  const c = useCat();
  return (
    <Scherm kop={<HoofdKop h={hoofd} />} voet={<Tabbalk actief="you" ongelezen={hoofd.ongelezen} onKies={hoofd.tab} />}>
      <Band style={{ height: 300, padding: 12, justifyContent: "space-between" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {beeld.beeld ? <Foto b={150} h={190} beeld={beeld.beeld} /> : <Linc maat={150} letterMaat={48} {...beeld} style={{ height: 190 }} testID="voorwerp" />}
        </View>
        <Kaartje regels={regels} />
      </Band>
      {ingangen.map((g) => (
        <Band key={g.label} onPress={g.open} label={g.label} hoogte={60} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 }}>
          <Text style={[tekst(15, 500), { color: c.inkt }]}>{g.label}</Text>
          <Text style={[kaartjeTekst, { color: c.label }]}>{g.rechts}</Text>
        </Band>
      ))}
      <Naad />
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 08 · Meldingen
// ---------------------------------------------------------------

export type MeldingRij = {
  id: string;
  linc: LincBeeld;
  naam: string;
  rest: string;
  tijd: string;
  nieuw: boolean;
  open: () => void;
  /** Een keuze in de regel zelf (een linc-verzoek). */
  keuze?: { ja: string; nee: string; doeJa: () => void; doeNee: () => void };
};

export function MeldingenView({
  regels,
  terug,
  allesGelezen,
  rijen,
  leeg,
}: {
  regels: Regel[];
  terug: () => void;
  allesGelezen: () => void;
  rijen: MeldingRij[];
  leeg?: string;
}) {
  const c = useCat();
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={regels} rechts={<TekstKnop tekst="Alles gelezen" onPress={allesGelezen} />} />}>
      {rijen.map((m) => (
        <View key={m.id}>
          <Band
            onPress={m.open}
            label={`${m.naam}${m.rest}, ${m.tijd}${m.nieuw ? ", nieuw" : ""}`}
            style={{ flexDirection: "row", columnGap: 12, paddingTop: 14, paddingHorizontal: 12, paddingBottom: m.keuze ? 12 : 14 }}
          >
            <Linc maat={44} letterMaat={14} {...m.linc} />
            <View style={{ flex: 1, minWidth: 0, rowGap: 8 }}>
              <MetNaam naam={m.naam} rest={m.rest} />
            </View>
            <View style={{ alignItems: "flex-end", rowGap: 8 }}>
              <Text style={[kaartjeTekst, { color: c.label }]}>{m.tijd}</Text>
              {m.nieuw ? <View accessibilityLabel="nieuw" style={{ width: 8, height: 8, backgroundColor: c.accent }} /> : null}
            </View>
          </Band>
          {m.keuze ? (
            <View testID="band" style={{ flexDirection: "row", columnGap: NAAD, backgroundColor: c.naad, borderTopWidth: NAAD, borderTopColor: c.naad }}>
              <Knop tekst={m.keuze.ja} pijl hoogte={48} onPress={m.keuze.doeJa} style={{ flex: 1 }} />
              <Knop tekst={m.keuze.nee} soort="vlak" hoogte={48} onPress={m.keuze.doeNee} style={{ flex: 1 }} />
            </View>
          ) : null}
        </View>
      ))}
      {rijen.length === 0 && leeg ? (
        <Band style={{ padding: 12 }}>
          <Text style={[tekst(15, 400, 1.35), { color: c.tekstTweede }]}>{leeg}</Text>
        </Band>
      ) : null}
      <Naad />
    </Scherm>
  );
}

// ---------------------------------------------------------------
// 12 · Mijn lincs
// ---------------------------------------------------------------

export type LincVak = { id: string; naam: string; nieuw: string; linc: LincBeeld; open: () => void };

export function LincsView({ regels, terug, toevoegen, lincs }: { regels: Regel[]; terug: () => void; toevoegen: () => void; lincs: LincVak[] }) {
  const c = useCat();
  return (
    <Scherm kop={<Kop links="terug" onLinks={terug} regels={regels} rechts={<Plus klein label="Linc toevoegen" onPress={toevoegen} />} />}>
      <Raster>
        {lincs
          .map((l) => (
            <Vak
              key={l.id}
              hoogte={190}
              label={l.naam}
              onPress={l.open}
              regels={[
                { label: "Naam", waarde: l.naam },
                { label: "Nieuw", waarde: l.nieuw },
              ]}
            >
              <Linc maat={88} letterMaat={29} testID="voorwerp" {...l.linc} />
            </Vak>
          ))
          .concat(
            <Vak key="+" hoogte={190} label="Linc toevoegen" onPress={toevoegen} regels={[{ label: "Nieuw", waarde: "Linc toevoegen" }]}>
              <View testID="voorwerp" style={{ width: 88, height: 88, borderWidth: 1, borderStyle: "dashed", borderColor: c.inkt, alignItems: "center", justifyContent: "center" }}>
                <Text style={[tekst(30, 200), { color: c.inkt }]}>+</Text>
              </View>
            </Vak>,
          )}
      </Raster>
    </Scherm>
  );
}
