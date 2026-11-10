import type { ReactNode } from "react";

import { CATALOGUS } from "@/lib/design/theme";

import { Invoer } from "../Delen";
import { Plus } from "../Kop";
import { Foto, KleurVlak, LinkBlad, MuziekBlad, Plaatshouder, PlekKaart, PollBlad, SpraakBlad, TekstBlad } from "../Voorwerp";
import { View } from "react-native";
import { GesprekView, InstellingenView, NieuwFotoView, NieuwSoortView, ProfielView, SoortenView, type Soort } from "../schermen/OverigeViews";
import { HomeView, type HomeHandelingen, type HomeStuk } from "../schermen/HomeView";
import { BijdrageView, type BijdrageDoe, type Reactie } from "../schermen/BijdrageView";
import { EventsView, GesprekkenView, JijView, LincsView, MeldingenView, type Hoofd } from "../schermen/LijstViews";
import { GroepView } from "../schermen/GroepView";

/**
 * De voorbeeldgegevens van de testpagina's: exact de inhoud van het ontwerp
 * (design_handoff_lincin_3e/schermen), met de plaatshouders letterlijk,
 * haken en al. Alleen voor app/dev/catalogus.
 */

export const BEELD = {
  drank: require("@/assets/catalogus-voorbeeld/post-drank.jpg"),
  kamer: require("@/assets/catalogus-voorbeeld/post-kamer.jpg"),
  tafel: require("@/assets/catalogus-voorbeeld/post-tafel.jpg"),
  katHero: require("@/assets/catalogus-voorbeeld/prop-kat-hero.jpg"),
  kat: require("@/assets/catalogus-voorbeeld/prop-kat.jpg"),
  koffie: require("@/assets/catalogus-voorbeeld/prop-koffie.jpg"),
  sterren: require("@/assets/catalogus-voorbeeld/prop-sterren.jpg"),
};

const niets = () => {};

const HOME_DOE: HomeHandelingen = {
  open: niets,
  leuk: niets,
  dubbel: niets,
  reageer: niets,
  bericht: niets,
  tilOp: niets,
  zetNeer: niets,
  meldingen: niets,
  nieuw: niets,
  tab: niets,
};

const HOME_KOP = [
  { label: "Lincin", waarde: "Editie № 34" },
  { label: "Datum", waarde: "ma 9 nov 2026" },
  { label: "Inhoud", waarde: "3 bijdragen" },
];

function homeStukken(hart: boolean): HomeStuk[] {
  const stuk = (
    id: string,
    voorwerp: ReactNode,
    wie: string,
    titel: string,
    breed = false,
    hartjes: number | string = "[n]",
    reacties: number | string = "[n]",
  ): HomeStuk => ({
    id,
    voorwerp,
    regels: breed
      ? [
          { label: "Wie", waarde: wie },
          { label: "Soort", waarde: "foto · uitgelicht" },
          { label: "Datum", waarde: "18 okt" },
          { label: "Reacties", waarde: "2" },
        ]
      : [
          { label: "Wie", waarde: wie },
          { label: "Titel", waarde: titel },
          { label: "Datum", waarde: "[datum]" },
        ],
    regelsKort: breed
      ? [
          { label: "Wie", waarde: wie },
          { label: "Soort", waarde: "foto · uitgelicht" },
          { label: "Datum", waarde: "18 okt" },
        ]
      : [
          { label: "Wie", waarde: wie },
          { label: "Titel", waarde: titel },
        ],
    breed,
    label: titel,
    hartjes,
    reacties,
    vindIkLeuk: breed && hart,
    wie,
    eigen: false,
  });
  const lijst = [
    stuk("mie", <Foto b={250} h={300} beeld={BEELD.drank} />, "Mie", "18 okt", true, 3, 2),
    stuk("herfst", <Foto b={132} h={168} beeld={BEELD.kamer} />, "johanna.coysman", "Herfst :)"),
    stuk("vuu", <Foto b={132} h={168} beeld={BEELD.tafel} />, "johanna.coysman", "Vuu…"),
  ];
  if (hart) return lijst;
  return lijst.concat([
    stuk("a", <Plaatshouder b={132} h={168} woord="[beeld]" />, "[naam]", "[bijdrage]"),
    stuk("b", <Plaatshouder b={132} h={168} woord="[beeld]" />, "[naam]", "[bijdrage]"),
  ]);
}

const HOOFD = (regels: { label: string; waarde: string }[]): Hoofd => ({
  regels,
  nieuweMeldingen: 2,
  ongelezen: true,
  meldingen: niets,
  nieuw: niets,
  tab: niets,
});

const K = { oranje: "#C1724E", groen: "#8A9273", blauw: "#6E8A97", oker: "#C9B77F", rood: "#A9503F", zuur: "#DDEE3C", fris: "#34C47A" };

const BIJDRAGE_DOE: BijdrageDoe = {
  terug: niets,
  meer: niets,
  sluitMenu: niets,
  leuk: niets,
  reacties: niets,
  bericht: niets,
  wakker: niets,
  leukReactie: niets,
  antwoord: niets,
  stopAntwoord: niets,
  tekst: niets,
  stuur: niets,
};
const BIJDRAGE_KOP = [
  { label: "Bijdrage", waarde: "18 okt" },
  { label: "Wie", waarde: "Mie" },
  { label: "Soort", waarde: "foto" },
];
const BIJDRAGE_REGELS = [
  { label: "Wie", waarde: "Mie" },
  { label: "Soort", waarde: "foto" },
  { label: "Datum", waarde: "18 okt" },
  { label: "Reacties", waarde: "2" },
];
const reactie = (id: string, naam: string, tekst: string, linc: Reactie["linc"], hartjes = 0, vindIkLeuk = false, antwoord = false): Reactie => ({
  id,
  naam,
  tijd: "[tijd]",
  tekst,
  linc,
  antwoord,
  hartjes,
  vindIkLeuk,
});

function bijdrage(vorm: "rust" | "leuk" | "draad" | "menu") {
  const actief = vorm !== "rust";
  const vraag = { kleur: null, initiaal: "?" };
  const reacties =
    vorm === "rust"
      ? [reactie("1", "[naam]", "Sante he vanuit Spanje!", vraag), reactie("2", "Toysman de creator", "Sante!", { kleur: K.blauw, initiaal: "T" })]
      : vorm === "leuk"
        ? [reactie("1", "[naam]", "Sante he vanuit Spanje!", vraag, 1)]
        : vorm === "draad"
          ? [
              reactie("1", "[naam]", "Sante he vanuit Spanje!", vraag, 2, true),
              reactie("2", "Toysman de creator", "Sante!", { kleur: K.blauw, initiaal: "T" }, 1, false, true),
              reactie("3", "Mie", "[antwoord van Mie]", { kleur: K.fris, initiaal: "M" }, 0, false, true),
              reactie("4", "johanna.coysman", "[reactie]", { kleur: K.zuur, initiaal: "J" }),
            ]
          : [];
  return (
    <BijdrageView
      kop={BIJDRAGE_KOP}
      voorwerp={<Foto b={actief ? 270 : 290} h={actief ? 340 : 370} beeld={BEELD.drank} />}
      titelTekst="18 okt"
      regels={BIJDRAGE_REGELS}
      actief={actief}
      hartjes={vorm === "leuk" ? 3 : "[n]"}
      vindIkLeuk={vorm === "leuk"}
      aantalReacties={2}
      berichtAan="Mie"
      leukDoor={
        vorm === "leuk"
          ? {
              gezichten: [
                { kleur: K.zuur, initiaal: "J" },
                { beeld: BEELD.kat, initiaal: "N" },
                { kleur: null, initiaal: "jij" },
              ],
              zin: "Leuk gevonden door johanna.coysman, Noor en jou",
            }
          : null
      }
      reacties={reacties}
      antwoordAan={vorm === "draad" ? "[naam]" : null}
      invoer=""
      menu={
        vorm === "menu"
          ? {
              kop: "18 okt · Mie",
              regels: [
                { label: "Stuur Mie een bericht hierover", doe: niets },
                { label: "Reageer", doe: niets },
                { label: "Verberg deze bijdrage", doe: niets },
                { label: "Demp Mie een week", doe: niets },
                { label: "Meld deze bijdrage", gevaar: true, doe: niets },
              ],
            }
          : null
      }
      doe={BIJDRAGE_DOE}
    />
  );
}

export type Voorbeeld = { hoogte?: number; render: (stand: "light" | "dark") => ReactNode };

const GOLF = [8, 16, 26, 14, 30, 20, 10, 24, 34, 18, 12, 28, 16, 8, 22, 12, 26, 14];
const SOORTEN: Soort[] = ["foto", "tekst", "poll", "muziek", "kleur", "link", "plek", "spraak"];

export const VOORBEELDEN: Record<string, Voorbeeld> = {
  "06-profiel": {
    render: () => (
      <ProfielView
        kop={[
          { label: "Linc", waarde: "Mie" },
          { label: "Sinds", waarde: "[jaar]" },
          { label: "Bijdragen", waarde: "[n]" },
        ]}
        terug={niets}
        meer={niets}
        beeld={{ beeld: BEELD.katHero, initiaal: "M" }}
        naam="Mie"
        bio="[bio van Mie, één of twee regels]"
        knoppen={[
          { tekst: "Gesprek", doe: niets },
          { tekst: "Samen plannen", doe: niets },
        ]}
        stukken={[
          {
            id: "1",
            voorwerp: <Foto b={120} h={150} beeld={BEELD.drank} />,
            regels: [
              { label: "Titel", waarde: "18 okt" },
              { label: "Soort", waarde: "foto" },
              { label: "Datum", waarde: "18 okt" },
            ],
            label: "18 okt",
            open: niets,
          },
          ...["2", "3", "4"].map((id) => ({
            id,
            voorwerp: <Plaatshouder b={120} h={150} woord="[beeld]" />,
            regels: [
              { label: "Titel", waarde: "[bijdrage]" },
              { label: "Soort", waarde: "[soort]" },
              { label: "Datum", waarde: "[datum]" },
            ],
            label: "[bijdrage]",
            open: niets,
          })),
        ]}
      />
    ),
  },
  "07-open-gesprek": {
    hoogte: 844,
    render: () => (
      <GesprekView
        kop={[
          { label: "Gesprek", waarde: "Noor" },
          { label: "Lincs sinds", waarde: "[jaar]" },
          { label: "Slot", waarde: "versleuteld" },
        ]}
        avatar={{ beeld: BEELD.kat, initiaal: "N" }}
        terug={niets}
        meer={niets}
        berichten={[
          { soort: "dag", id: "d", tekst: "Vandaag" },
          { soort: "tekst", id: "1", mijn: false, tekst: "Heb je die van Mie gezien?" },
          {
            soort: "bijdrage",
            id: "2",
            mijn: false,
            beeld: BEELD.drank,
            regels: [
              { label: "Bijdrage", waarde: "18 okt" },
              { label: "Wie", waarde: "Mie" },
              { label: "Soort", waarde: "foto" },
            ],
            open: niets,
          },
          { soort: "tekst", id: "3", mijn: true, tekst: "Ja! Zin in.", onder: "gelezen" },
          { soort: "spraak", id: "4", mijn: false, golf: GOLF, duur: "0:41", speelt: false, speel: niets },
          { soort: "tekst", id: "5", mijn: false, tekst: "zondag 10:00 bij de pont?", onder: "2 m" },
        ]}
        invoer={<Invoer waarde="" onWaarde={niets} plaatshouder="Schrijf een bericht" onStuur={niets} voor={<Plus klein label="Voeg iets toe" onPress={niets} />} />}
      />
    ),
  },
  "09-nieuwe-bijdrage-soort": {
    hoogte: 844,
    render: () => (
      <NieuwSoortView
        kop={[
          { label: "Nieuw", waarde: "Bijdrage" },
          { label: "Stap", waarde: "1 van 2" },
          { label: "Kies", waarde: "een soort" },
        ]}
        sluit={niets}
        soorten={SOORTEN}
        gekozen="foto"
        kies={niets}
        verder={niets}
        verderTekst="Verder met foto →"
        beeld={BEELD.kamer}
      />
    ),
  },
  "10-nieuwe-bijdrage-foto": {
    hoogte: 844,
    render: () => (
      <NieuwFotoView
        kop={[
          { label: "Nieuw", waarde: "foto" },
          { label: "Stap", waarde: "2 van 2" },
          { label: "Zichtbaar", waarde: "alle lincs" },
        ]}
        terug={niets}
        deel={niets}
        kanDelen
        voorwerp={<Foto b={240} h={300} beeld={BEELD.kamer} />}
        beeldKnop={{ tekst: "Kies een ander beeld", doe: niets }}
        regels={[
          { soort: "invoer", label: "Titel", waarde: "Herfst :)", plaatshouder: "Titel", zet: niets },
          { soort: "invoer", label: "Bijschrift", waarde: "", plaatshouder: "Schrijf er iets bij", zet: niets },
          { soort: "keuze", label: "Voor wie", waarde: "Alle lincs", open: niets },
          { soort: "schakelaar", label: "Reacties", waarde: "Toegestaan", aan: true, zet: niets },
        ]}
      />
    ),
  },
  "11-instellingen": {
    hoogte: 844,
    render: (stand) => (
      <InstellingenView
        kop={[
          { label: "Lincin", waarde: "Instellingen" },
          { label: "Versie", waarde: "[versie]" },
          { label: "Account", waarde: "[jouw naam]" },
        ]}
        terug={niets}
        regels={[
          { soort: "groep", titel: "Uiterlijk" },
          { soort: "regel", label: "Thema", waarde: "Catalogus", open: niets },
          {
            soort: "keuze",
            label: "Stand",
            opties: [
              { label: "Licht", aan: stand === "light", kies: niets },
              { label: "Donker", aan: stand === "dark", kies: niets },
            ],
          },
          { soort: "regel", label: "Taal", waarde: "Nederlands", open: niets },
          { soort: "groep", titel: "Meldingen" },
          { soort: "schakelaar", label: "Nieuwe bijdragen", waarde: "Van al je lincs", aan: true, zet: niets },
          { soort: "schakelaar", label: "Reacties", waarde: "Op jouw bijdragen", aan: true, zet: niets },
          { soort: "schakelaar", label: "Events", waarde: "Uitnodigingen", aan: false, zet: niets },
          { soort: "groep", titel: "Privé" },
          { soort: "regel", label: "Versleuteling", waarde: "Alleen jij en je lincs", open: niets, pijl: false },
          { soort: "regel", label: "Sleutel", waarde: "Back-up maken", open: niets },
          { soort: "regel", label: "Geblokkeerd", waarde: "[n]", open: niets },
          { soort: "groep", titel: "Account" },
          { soort: "regel", label: "Uitloggen", waarde: "", open: niets },
        ]}
      />
    ),
  },
  "19-interactie-soorten-inhoud": {
    render: () => (
      <SoortenView
        kop={[
          { label: "Lincin", waarde: "Soorten inhoud" },
          { label: "Aantal", waarde: "8" },
          { label: "Toestand", waarde: "zie kaartje" },
        ]}
        terug={niets}
        vakken={[
          { key: "foto", voorwerp: <Foto b={132} h={168} beeld={BEELD.drank} />, regels: [{ label: "Soort", waarde: "foto" }, { label: "Wie", waarde: "Mie" }] },
          { key: "tekst", voorwerp: <TekstBlad tekst="[korte tekst, een gedachte van een paar regels]" />, regels: [{ label: "Soort", waarde: "tekst" }, { label: "Lengte", waarde: "[n] tekens" }] },
          {
            key: "poll",
            voorwerp: (
              <PollBlad
                vraag="[vraag?]"
                opties={[
                  { id: "1", label: "[optie 1]", procent: 62, gekozen: true, tekst: "[n]%" },
                  { id: "2", label: "[optie 2]", procent: 38, gekozen: false, tekst: "[n]%" },
                ]}
              />
            ),
            regels: [{ label: "Soort", waarde: "poll" }, { label: "Toestand", waarde: "jij stemde" }],
          },
          { key: "muziek", voorwerp: <MuziekBlad nummer="[nummer]" artiest="[artiest]" speelt voortgang={0.45} />, regels: [{ label: "Soort", waarde: "muziek" }, { label: "Toestand", waarde: "speelt · [tijd]" }] },
          { key: "kleur", voorwerp: <KleurVlak hex="#2448E0" />, regels: [{ label: "Soort", waarde: "kleur" }, { label: "Naam", waarde: "[naam van de kleur]" }] },
          { key: "link", voorwerp: <LinkBlad beeld={BEELD.tafel} titel="[titel van de pagina]" />, regels: [{ label: "Soort", waarde: "link" }, { label: "Bron", waarde: "[domein]" }] },
          { key: "plek", voorwerp: <PlekKaart />, regels: [{ label: "Soort", waarde: "plek" }, { label: "Waar", waarde: "[plaats]" }] },
          { key: "spraak", voorwerp: <SpraakBlad golf={GOLF.slice(0, 14)} duur="0:41" speelt={false} />, regels: [{ label: "Soort", waarde: "spraak" }, { label: "Toestand", waarde: "nieuw" }] },
        ]}
      />
    ),
  },
  "05-bijdrage": { hoogte: 900, render: () => bijdrage("rust") },
  "14-interactie-leuk-gevonden": { hoogte: 900, render: () => bijdrage("leuk") },
  "15-interactie-draad-en-antwoord": { render: () => bijdrage("draad") },
  "16-interactie-menu": { hoogte: 900, render: () => bijdrage("menu") },
  "02-gesprekken": {
    hoogte: 844,
    render: () => (
      <GesprekkenView
        hoofd={HOOFD([
          { label: "Lincin", waarde: "Gesprekken" },
          { label: "Nieuw", waarde: "2 ongelezen" },
          { label: "Totaal", waarde: "5 gesprekken" },
        ])}
        rijen={[
          { id: "1", naam: "Noor", regel: "zondag 10:00 bij de pont?", tijd: "2 m", nieuw: 2, linc: { beeld: BEELD.kat, initiaal: "N" }, open: niets },
          { id: "2", naam: "Kamp '26", regel: "Daan: wie neemt de tent", tijd: "38 m", nieuw: 1, linc: { kleur: K.groen, initiaal: "K" }, open: niets },
          { id: "3", naam: "Sem", regel: "Jij: haha ja precies", tijd: "3 u", nieuw: 0, linc: { kleur: K.blauw, initiaal: "S" }, open: niets },
          { id: "4", naam: "Lotte", regel: "Lotte: spraakbericht", tijd: "1 d", nieuw: 0, linc: { beeld: BEELD.koffie, initiaal: "L" }, open: niets },
          { id: "5", naam: "Yusuf", regel: "Nog geen berichten", tijd: "4 d", nieuw: 0, linc: { kleur: K.rood, initiaal: "Y" }, open: niets },
        ]}
      />
    ),
  },
  "03-events": {
    hoogte: 844,
    render: () => {
      const jij = { kleur: null, initiaal: "J", naam: "jij" };
      return (
        <EventsView
          hoofd={HOOFD([
            { label: "Lincin", waarde: "Events" },
            { label: "Gepland", waarde: "3" },
            { label: "Eerstvolgende", waarde: "15 nov" },
          ])}
          rijen={[
            {
              id: "1",
              dag: "15",
              maand: "nov",
              titel: "Naar de dijk bij Marken",
              regels: [
                { label: "Wanneer", waarde: "zo · 14:00" },
                { label: "Waar", waarde: "Marken" },
                { label: "Van", waarde: "Noor" },
              ],
              komen: [{ kleur: K.oranje, initiaal: "N", naam: "Noor" }, { kleur: K.blauw, initiaal: "S", naam: "Sem" }, jij],
              jijKomt: true,
              open: niets,
              kom: niets,
              komNiet: niets,
            },
            {
              id: "2",
              dag: "28",
              maand: "nov",
              titel: "Kamp '26, de generale",
              regels: [
                { label: "Wanneer", waarde: "vr tot zo" },
                { label: "Waar", waarde: "Twiske" },
                { label: "Van", waarde: "Daan" },
              ],
              komen: [
                { kleur: K.groen, initiaal: "D", naam: "Daan" },
                { kleur: K.blauw, initiaal: "S", naam: "Sem" },
                { kleur: K.oranje, initiaal: "N", naam: "Noor" },
                { kleur: K.oker, initiaal: "L", naam: "Lotte" },
                jij,
              ],
              jijKomt: true,
              open: niets,
              kom: niets,
              komNiet: niets,
            },
            {
              id: "3",
              dag: "12",
              maand: "dec",
              titel: "Beach House, Paradiso",
              regels: [
                { label: "Wanneer", waarde: "do · 20:30" },
                { label: "Waar", waarde: "Amsterdam" },
                { label: "Van", waarde: "Yusuf" },
              ],
              komen: [{ kleur: K.rood, initiaal: "Y", naam: "Yusuf" }],
              jijKomt: false,
              open: niets,
              kom: niets,
              komNiet: niets,
            },
          ]}
        />
      );
    },
  },
  "04-jij": {
    hoogte: 844,
    render: (stand) => (
      <JijView
        hoofd={HOOFD([
          { label: "Lincin", waarde: "Jij" },
          { label: "Thema", waarde: "Catalogus" },
          { label: "Stand", waarde: stand === "dark" ? "Donker" : "Licht" },
        ])}
        beeld={{ beeld: BEELD.sterren, initiaal: "J" }}
        regels={[
          { label: "Naam", waarde: "[jouw naam]" },
          { label: "Lincs", waarde: "[n]" },
          { label: "Bijdragen", waarde: "[n]" },
          { label: "Sinds", waarde: "[jaar]" },
        ]}
        ingangen={[
          { label: "Mijn bijdragen", rechts: "[n] →", open: niets },
          { label: "Mijn lincs", rechts: "[n] →", open: niets },
          { label: "Thema en stand", rechts: "Catalogus →", open: niets },
          { label: "Instellingen", rechts: "Privé, meldingen →", open: niets },
        ]}
      />
    ),
  },
  "08-meldingen": {
    hoogte: 844,
    render: () => (
      <MeldingenView
        regels={[
          { label: "Lincin", waarde: "Meldingen" },
          { label: "Nieuw", waarde: "2" },
          { label: "Totaal", waarde: "5" },
        ]}
        terug={niets}
        allesGelezen={niets}
        rijen={[
          {
            id: "1",
            linc: { kleur: K.oranje, initiaal: "N" },
            naam: "Noor",
            rest: " nodigt je uit: Naar de dijk bij Marken, zo 15 nov",
            tijd: "2 m",
            nieuw: true,
            open: niets,
            keuze: { ja: "Ik kom", nee: "Kan niet", doeJa: niets, doeNee: niets },
          },
          { id: "2", linc: { kleur: null, initiaal: "?" }, naam: "[naam]", rest: " reageerde op 18 okt: “Sante he vanuit Spanje!”", tijd: "[tijd]", nieuw: true, open: niets },
          { id: "3", linc: { beeld: BEELD.katHero, initiaal: "M" }, naam: "Mie", rest: " vond je reactie leuk", tijd: "[tijd]", nieuw: false, open: niets },
          { id: "4", linc: { kleur: K.zuur, initiaal: "J" }, naam: "johanna.coysman", rest: " deelde Herfst :)", tijd: "[tijd]", nieuw: false, open: niets },
          {
            id: "5",
            linc: { kleur: K.groen, initiaal: "D" },
            naam: "Daan",
            rest: " wil je linc worden",
            tijd: "[tijd]",
            nieuw: false,
            open: niets,
            keuze: { ja: "Accepteer", nee: "Negeer", doeJa: niets, doeNee: niets },
          },
        ]}
      />
    ),
  },
  "12-mijn-lincs": {
    hoogte: 844,
    render: (stand) => (
      <LincsView
        regels={[
          { label: "Lincin", waarde: "Mijn lincs" },
          { label: "Aantal", waarde: "[n]" },
          { label: "Nieuw", waarde: "3 bijdragen" },
        ]}
        terug={niets}
        toevoegen={niets}
        lincs={[
          { id: "1", naam: "Mie", nieuw: "1", linc: { beeld: BEELD.katHero, initiaal: "M" }, open: niets },
          { id: "2", naam: "johanna.coysman", nieuw: "2", linc: { kleur: K.zuur, initiaal: "J" }, open: niets },
          { id: "3", naam: "Noor", nieuw: "—", linc: { beeld: BEELD.kat, initiaal: "N" }, open: niets },
          { id: "4", naam: "Sem", nieuw: "—", linc: { kleur: K.blauw, initiaal: "S", letterKleur: CATALOGUS[stand].tekstOpInkt }, open: niets },
          { id: "5", naam: "Lotte", nieuw: "—", linc: { beeld: BEELD.koffie, initiaal: "L" }, open: niets },
        ]}
      />
    ),
  },
  // Geen ontwerp en geen referentie: een lange tekst in bladzijden, zoals op de bijdrage.
  "tekst-bladen": {
    render: () => (
      <View style={{ padding: 28, alignItems: "center", backgroundColor: "transparent" }}>
        <TekstBlad
          pagineer
          maat={{ b: 260, h: 312 }}
          tekst={
            "Eigelijk schrijf ik u enkel omdat er grote dingen staan te gebeuren en wel door toedoen van het echtpaar Röhrig.\n    Je moet weten dat de poes van de grootouders van mijn vrouw gestorven is. Een droevige zaak, maar het leven gaat door, en zo kwam het dat de vossen op een ochtend aan de deur stonden met een thermos en drie bekers. Niemand had ze uitgenodigd. Niemand durfde ze weg te sturen.\n    Ze zetten koffie, sterk en zonder suiker, en vertelden over de winter die eraan kwam. EINDE."
          }
        />
      </View>
    ),
  },
  // Geen ontwerp en geen referentie: alleen om de groepspagina te bekijken.
  groep: {
    render: () => (
      <GroepView
        kop={[
          { label: "Groep", waarde: "Fotodump" },
          { label: "Leden", waarde: "4" },
          { label: "Slot", waarde: "versleuteld" },
        ]}
        terug={niets}
        beeld={{ kleur: K.groen, initiaal: "F" }}
        regels={[
          { label: "Naam", waarde: "Fotodump" },
          { label: "Leden", waarde: "4 leden" },
          { label: "Eigenaar", waarde: "jij" },
          { label: "Sinds", waarde: "sep 2026" },
        ]}
        beeldWijzigen={niets}
        naamWijzigen={niets}
        leden={[
          { id: "1", naam: "Tom (jij)", gebruiker: "@tom", rol: "eigenaar", sinds: "2 sep", linc: { beeld: BEELD.katHero, initiaal: "T" }, open: niets },
          { id: "2", naam: "Mie", gebruiker: "@mie", rol: "lid", sinds: "2 sep", linc: { kleur: K.zuur, initiaal: "M" }, open: niets, verwijder: niets },
          { id: "3", naam: "johanna.coysman", gebruiker: "@johanna.coysman", rol: "lid", sinds: "4 sep", linc: { beeld: BEELD.kat, initiaal: "J" }, open: niets, verwijder: niets },
          { id: "4", naam: "Sem", gebruiker: "@sem", rol: "lid", sinds: "18 okt", linc: { kleur: K.blauw, initiaal: "S" }, open: niets, verwijder: niets },
        ]}
        toevoegen={niets}
        verlaat={niets}
      />
    ),
  },
  "01-home": {
    render: () => (
      <HomeView regels={HOME_KOP} stukken={homeStukken(false)} nieuweMeldingen={2} ongelezen hartjesStand={false} opgetild={null} doe={HOME_DOE} />
    ),
  },
  "13-home-leeg": {
    hoogte: 844,
    render: () => (
      <HomeView
        regels={[
          { label: "Lincin", waarde: "Editie № 35" },
          { label: "Datum", waarde: "[datum]" },
          { label: "Inhoud", waarde: "0 bijdragen" },
        ]}
        stukken={[]}
        nieuweMeldingen={2}
        ongelezen
        hartjesStand={false}
        opgetild={null}
        doe={HOME_DOE}
      />
    ),
  },
  "17-interactie-lang-drukken": {
    hoogte: 900,
    render: () => (
      <HomeView regels={HOME_KOP} stukken={homeStukken(false).slice(0, 3)} nieuweMeldingen={2} ongelezen hartjesStand={false} opgetild="herfst" doe={HOME_DOE} />
    ),
  },
  "18-interactie-home-met-hartje": {
    hoogte: 900,
    render: () => (
      <HomeView regels={HOME_KOP} stukken={homeStukken(true)} nieuweMeldingen={2} ongelezen hartjesStand opgetild={null} doe={HOME_DOE} />
    ),
  },
};
