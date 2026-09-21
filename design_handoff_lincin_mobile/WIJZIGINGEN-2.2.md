# Lincin — wijzigingen 2.1 → 2.2

**Versie 2.2 · 21 september 2026.** Bron van waarheid blijft `LincinApp.dc.html` (402 × 874, drie thema's, licht/donker, NL/EN/DE).
Lees dit bestand naast `HANDOFF.md`: alles in HANDOFF.md geldt nog, behalve waar hieronder een punt het overschrijft.

## Kort
Er zijn geen nieuwe schermen of features. 2.2 is een **skin- en navigatieronde**: Modern is terug als volwaardig derde thema met een bento-rooster, Magazine is herzien naar poster-spreads met 6 px naden, en een reeks kleine correcties (terugknop, leesbaarheid, woordgebruik).

---

## 1 · Thema Modern — terug, als bento-rooster
Modern is opnieuw ingevoerd (in 2.1 stond hij als verwijderd) en is nu **rasterbased**, niet kaartbased.

- **Rooster**: 2 kolommen, `gap: 6px`, buitenmarge 6 px, tegels `border-radius: 18px`, binnenpadding 18–22 px. Tegels vullen 1 of 2 kolommen.
- **Tegelvlak**: `rgba(255,255,255,.82)` op licht, `rgba(24,24,26,.9)` op donker (token `tileBg`).
- **Tokens** (root-variabelen):
  - licht `--p:#F4F1EB · --p2:#EAE7DF · --i:#17170F · --dim:rgba(23,23,15,.56) · --rule:rgba(23,23,15,.12) · --red:#C0503A`
  - donker `--p:#0C0C0D · --p2:#151517 · --i:#EFECE6 · --dim:rgba(239,236,230,.58) · --rule:rgba(239,236,230,.14) · --red:#E4674E`
- **Typografie**: Archivo (400/500/600) voor koppen, `letter-spacing:-.02em/-.03em`; IBM Plex Mono 8,5–9,5 px, `letter-spacing:.16em`, uppercase voor meta.
- **Scheidingen bínnen een tegel**: gestippelde lijn `1px dashed color-mix(in oklch, var(--i) 26%, transparent)` — geen harde randen.
- **Toegepast op**: feed, gesprekken, events, jij, meldingen, instellingen. Elke pagina opent met een titeltegel (2 kolommen breed, kop 30 px, teller rechts in mono).

## 2 · Thema Magazine — poster-spreads
De feed onder de omslag en alle subpagina's volgen nu één model.

- **Spread**: volvlaks kleurvlak van de vriend, `margin: 0 6px`, naad 6 px, geen radius.
- **Metaregel**: verticale rail van 26 px links of rechts (`writing-mode: vertical-rl; rotate(180deg)`), Archivo 8 px, `letter-spacing:.24em`, uppercase — draagt `№ · auteur · tijd`.
- **Ritme**: richting wisselt per item (`row` / `row-reverse`), hoogte wisselt (elk derde item hoger): feed 228/300 px, events 212/258 px, gesprekken 146/182 px, meldingen 126/158 px.
- **Koppen**: Instrument Serif, feed 30 px, subpagina's 24–30 px, `line-height:.98`; onderschrift cursief 14–15 px.
- **Beeldkolom** (alleen feed): 138 px breed; niet-fotobijdragen tonen hun eigen preview op papier (golfvorm, pollbalken, plattegrondraster, tekstfragment).
- **Omslag en hero blijven ongewijzigd** t.o.v. 2.1: masthead over het heldbeeld, daaronder de heldkop op papier met 5 px kleurrug.
- **Donkere palet herzien**: `--p:#14120E · --p2:#1B1813 · --i:#EFE7D6 · --dim:rgba(239,231,214,.54) · --rule:rgba(239,231,214,.14) · --acid:#D9A05B · --red:#C2604E` (was het grijsbruine #282520/#DAD4C6).
- Licht ongewijzigd: `--p:#F7F4EE · --i:#16160F · --acid:#F06A2B`.

## 3 · Navigatie Magazine — model "rugstrook" (1d)
Vervangt de inktstrook uit 2.1.

- Vier tegels in een `grid-template-columns: repeat(4,1fr)`, `gap: 6px`, padding `6px 6px 28px`, tegelhoogte 58 px.
- Actieve tegel draagt de **kleur van de pagina** (vriendkleur van de bijdrage/het gesprek in beeld; valt terug op inkt waar geen vriend in beeld is), inactieve tegels `--p2`.
- Woord onderaan uitgelijnd: Instrument Serif, actief 17 px cursief, inactief 15 px op `opacity:.62`.
- Rode stip van 5 px achter "Gesprekken" bij ongelezen berichten.
- Vijf onderzochte varianten staan in `Lincin Magazine Navigaties.dc.html` (1a inktstrook · 1b colofonregel · 1c genummerde katernen · **1d rugstrook, gekozen** · 1e zwevende duimindex).

## 4 · Thema Kleur — kleur als licht van boven
- De achtergrond is niet langer één vlak of een verloop tussen twee vriendkleuren. De kleur van de vriend in beeld ligt **bovenaan** en dooft uit naar papier: stops op 0 %, 18 %, 42 % (halve tint) en 72 % papier.
- De tweede kleurband onderin (kleur van de vólgende vriend) is **weg** — die concurreerde met de tekst.

## 5 · Chrome, alle thema's
- **Terugknop** staat in de kopregel, links, en verschijnt op elk subscherm (bijdrage, profiel, gesprek, instellingen, meldingen, nieuwe bijdrage). Ronde knop 44 px in inkt met papierkleurige pijl-SVG; dezelfde vorm als de ronde knoppen rechts. De losse "← terug"-regels in de pagina's zijn verwijderd.
- **Kopregel Modern** heeft rechts twee ronde knoppen van 44 px op tegelvlak: meldingen (belicoon + rode stip bij nieuw) en nieuwe bijdrage (plus).
- **Scrollrand**: elke hoofdscroller heeft een maskerfade van 18 px bovenaan, zodat inhoud oplost onder de kopregel in plaats van er hard tegenaan te lopen (`.vfade`).
- **Navigatie blijft altijd in beeld**: de app-hoogte is `min(874px, 100dvh)`, de footer ligt op `z-index: 12` boven inhoud en korrellaag.
- **Trek om te vernieuwen** toont zijn regel alleen tijdens trekken (scrollpositie < 44 px) of tijdens verversen — ingeklapt blijft de strook leeg.
- **Lincs-strip** in het profiel schuift horizontaal als er meer lincs zijn dan er passen.
- **Vermeldingenstrip** in het gesprek volgt in Modern het rastermodel: geen kader, horizontaal mono-label, kaartjes 130 × 60 met 14 px radius zonder rug.

## 6 · Instellingen
- De themaschakelaar toont **drie** opties: Kleur · Magazine · Modern (ondertitel in NL/EN/DE bijgewerkt).
- Bug verholpen: een keuze in de app werd overschreven door de externe themawaarde; een eigen keuze wint nu en wordt in `localStorage` (`lincin-thema`) bewaard.

## 7 · Woordgebruik
- "Privaat bericht" → **"Bericht"**, "Privégesprek" → **"Gesprek"**, korte label "Privaat" → **"Bericht"**, melding "begon een privégesprek" → "begon een gesprek". Doorgevoerd in NL, EN en DE.
- In de magazine-lijstrijen staat naast "Bericht" nu ook **"Comment"** met het aantal reacties; beide raakvlakken 44 px.
- Nog open: in de Nederlandse teksten staat "Comment/Comments" nog Engels — vervangen door "Reactie/Reacties" zodra het woord definitief is.

## 8 · Poll (uit de vorige ronde, behouden)
Kind `poll` in Nieuwe bijdrage heeft een echte keuze-editor: 2–4 genummerde keuzes, toevoegen/verwijderen, schakelaar één stem ↔ meerdere keuzes. De vraag is de titel van de bijdrage.

---

## Wat is ongewijzigd
Schermvoorraad (11 schermen), routering, datamodel, sessiestatus, de zeven mediasoorten, feedgroepering, leesstatus, eindkaart, lightbox, reacties op reacties, meerdere foto's per bijdrage, NL/EN/DE-woordenboeken, raakvlakminimum van 44 px, en het hele Kleur-thema buiten punt 4.

## Bestanden in dit pakket
| Bestand | Wat |
|---|---|
| `LincinApp.dc.html` | Prototype, bron van waarheid (versie 2.2) |
| `Lincin Magazine Navigaties.dc.html` | Vijf navigatievarianten, 1d is gekozen |
| `HANDOFF.md` | Volledige specificatie 2.1 — geldt nog, met dit bestand als delta |
| `screenshots/` | Opnamen van 2.1; nog niet opnieuw gemaakt voor Magazine/Modern 2.2 |
| `oud-designsysteem/` | 2.0-systeem uit de codebase, voor diffing |
