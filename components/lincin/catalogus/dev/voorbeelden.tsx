import type { ReactNode } from "react";

import { Foto, Plaatshouder } from "../Voorwerp";
import { HomeView, type HomeHandelingen, type HomeStuk } from "../schermen/HomeView";

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

export type Voorbeeld = { hoogte?: number; render: () => ReactNode };

export const VOORBEELDEN: Record<string, Voorbeeld> = {
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
