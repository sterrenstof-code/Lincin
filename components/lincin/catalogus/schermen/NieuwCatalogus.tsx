import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import type { Compose } from "@/app/post-compose";

import { useTerug } from "../nav";
import { Foto, Plaatshouder } from "../Voorwerp";
import { ExtraRegel, Stand } from "./Lijsten";
import { NieuwFotoView, NieuwSoortView, SoortTeken, type Soort, type Veldregel } from "./OverigeViews";

/**
 * Nieuwe bijdrage (ontwerp 09 en 10) op `useCompose()` uit
 * app/post-compose.tsx: eerst de soort, dan het formulier.
 *
 * Alleen de soorten die de app kan plaatsen staan in het raster (foto,
 * tekst, poll, muziek, link). Kleur, plek en spraak uit het ontwerp kan de
 * app (nog) niet maken; die staan er niet.
 */
const SOORTEN = ["foto", "tekst", "poll", "muziek", "link"] as const satisfies readonly Soort[];
type Maakbaar = (typeof SOORTEN)[number];

export function NieuwCatalogus({ c }: { c: Compose }) {
  const [stap, setStap] = useState<1 | 2>(1);
  const sluit = useTerug("/feed");
  const soort: Maakbaar = (SOORTEN as readonly string[]).includes(c.kind) ? (c.kind as Maakbaar) : "foto";

  if (stap === 1) {
    return (
      <NieuwSoortView
        kop={[
          { label: "Nieuw", waarde: "Bijdrage" },
          { label: "Stap", waarde: "1 van 2" },
          { label: "Kies", waarde: "een soort" },
        ]}
        sluit={sluit}
        soorten={[...SOORTEN]}
        gekozen={soort}
        kies={(s) => c.setKind(s as Maakbaar)}
        verder={() => setStap(2)}
        verderTekst={`Verder met ${soort} →`}
        beeld={c.imageUri}
      />
    );
  }

  // "Voor wie": alle lincs of een groep; een poll gaat altijd naar al je lincs.
  const volgendePubliek = () => {
    const i = c.audiences.findIndex((a) => a.id === c.audience);
    const n = c.audiences[(i + 1) % Math.max(1, c.audiences.length)];
    if (n) c.setAudience(n.id);
  };
  const voorWie: Veldregel = { soort: "keuze", label: "Voor wie", waarde: c.audienceLabel, open: soort === "poll" ? () => {} : volgendePubliek };
  const veld = (label: string, waarde: string, zet: (v: string) => void, plaatshouder: string): Veldregel => ({ soort: "invoer", label, waarde, zet, plaatshouder });

  const regels: Veldregel[] =
    soort === "foto"
      ? [veld("Titel", c.title, c.setTitle, "Titel"), veld("Bijschrift", c.caption, c.setCaption, "Schrijf er iets bij"), voorWie]
      : soort === "tekst"
        ? [veld("Titel", c.title, c.setTitle, "Titel"), veld("Tekst", c.body, c.setBody, "Wat wil je zeggen?"), voorWie]
        : soort === "poll"
          ? [
              veld("Vraag", c.title, c.setTitle, "Wat wil je weten?"),
              ...c.pollOptions.map((o, i) => veld(`Keuze ${i + 1}`, o, (v) => c.setPollOption(i, v), `Keuze ${i + 1}`)),
              voorWie,
            ]
          : [veld("Adres", c.url, c.setUrl, "https://"), veld("Titel", c.title, c.setTitle, "Titel"), veld("Bijschrift", c.caption, c.setCaption, "Schrijf er iets bij"), voorWie];

  const voorwerp =
    soort === "foto" ? (
      c.imageUri ? <Foto b={240} h={300} beeld={c.imageUri} /> : <Plaatshouder b={240} h={300} woord="Nog geen beeld" />
    ) : soort === "link" || soort === "muziek" ? (
      c.slotImage ? <Foto b={240} h={160} beeld={c.slotImage} /> : <SoortTeken soort={soort} />
    ) : (
      <SoortTeken soort={soort} />
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <NieuwFotoView
        kop={[
          { label: "Nieuw", waarde: soort },
          { label: "Stap", waarde: "2 van 2" },
          { label: "Zichtbaar", waarde: c.audienceLabel },
        ]}
        terug={() => setStap(1)}
        deel={c.publish}
        deelTekst={c.published ? "Gedeeld" : c.submitting ? "Bezig" : "Deel"}
        kanDelen={c.canSubmit && !c.published}
        voorwerp={voorwerp}
        hoogte={soort === "foto" ? 400 : 260}
        beeldKnop={soort === "foto" ? { tekst: c.imageUri ? "Kies een ander beeld" : "Kies een beeld", doe: c.addPhotos } : undefined}
        regels={regels}
        onderaan={
          <>
            {soort === "poll" && c.pollOptions.length < 4 ? <ExtraRegel label="Nog een keuze" rechts="+" onPress={c.addPollOption} /> : null}
            {c.error ? <Stand tekst={c.error} /> : null}
            {c.dirty && !c.published ? <ExtraRegel label="Bewaar als concept" onPress={c.keep} /> : null}
          </>
        }
      />
    </KeyboardAvoidingView>
  );
}

