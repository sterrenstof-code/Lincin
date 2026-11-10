# Catalogus op desktop — verslag

Tak `thema-catalogus`, niet gepusht. Stand 10 november 2026. Hoort bij
`design_handoff_lincin_3e/desktop/` en `docs/CATALOGUS-DESKTOP-PLAN.md`.

## Kort

- Catalogus heeft vanaf 1024 breed (web) vier weergaven van de feed: `wand` (standaard), `blad`, `lichtbak` en `gloedraster`. Je kiest met de knop Weergave, en de keuze wordt per gebruiker bewaard.
- Ze delen één manier van openen: één paneel en één hook die de foto naar het midden brengt.
- Gesprekken en Events hebben de desktopvorm uit het ontwerp, in het kader van de gekozen weergave.
- **14 van 17 staten slagen.** De drie andere (`wand-open`, `wand-open-donker`, `blad-open`) wijken 54 px af. Dat is een bewuste keuze: het prototype zet de foto daar 6vh onder het midden, en de briefing en het gedragsscript vragen het midden (§3).
- **Het gedragsscript slaagt: 162 van 162 controles**, ook voor bewerken en verwijderen van je eigen bijdrage.
- **Responsive:** `node scripts/catalogus-desktop-maten.mjs` loopt 12 staten na in 10 vensters, van 1024 × 768 tot 2560 × 1440, ook staand en laag. Alle 120 combinaties kloppen (§2b). Op 1440 × 900 is alles pixelgelijk aan het ontwerp gebleven.
- Mobiel is ongewijzigd: `npm run catalogus:vergelijk` geeft 34 van 38, hetzelfde als vóór dit werk. Wat daar afwijkt (06 en 11) zijn de bewuste afwijkingen uit CATALOGUS-VERSLAG.md.
- **De echte schermen zijn niet ingelogd nagelopen.** Er is geen testaccount en `.env.local` wijst naar de echte Supabase (§6). Wel nagelopen: typecheck, lint, de productiebuild, 1100 px breed, en dat magazine en modern pixel voor pixel gelijk zijn aan vóór dit werk op de pagina's die zonder inloggen te zien zijn.

## 1. Eindtabel van `npm run catalogus:vergelijk:desktop`

Venster 1440 × 900, schaal 1, minder beweging. De vergelijking gebruikt pixelmatch tegen `desktop/png/<naam>.png` met drempel 0.1. Gemeten is de positie en maat van:

- de kop, of de tabbladen met elk tabblad, het blad en zijn kop;
- elk stuk en elke foto, en de vakjes van de strook;
- het paneel en zijn blokken;
- de knop, het menu en zijn rijen;
- de kolommen en rijen van Gesprekken en Events.

Daarnaast controleert de vergelijking:

- het kleurveld apart (alles erboven onzichtbaar): het gemiddelde verschil per kanaal tegen het prototype;
- de vlakkleuren: een punt in elk vlak dat in de referentie een zuivere vlakkleur heeft, tegen de token uit `tokens.json`.

De laatste twee kolommen zijn ter controle:

- **Eigen ↔ prototype:** mijn pagina tegen het prototype, gerenderd in dezelfde browser.
- **Prototype ↔ PNG:** het prototype tegen zijn eigen PNG. Dit is de ruisvloer van de machine.

| Staat | Afwijkend (PNG) | Grootste maatafwijking | Kleurveld (R/G/B) | Geslaagd | Eigen ↔ prototype | Prototype ↔ PNG |
|---|---|---|---|---|---|---|
| wand-dicht | 0.104 % | 0 px | — | ja | 0.004 % | 0.107 % |
| wand-open | 9.473 % | 54 px | — | **nee** | 9.378 % | 0.108 % |
| wand-dicht-donker | 0.126 % | 0 px | — | ja | 0.003 % | 0.124 % |
| wand-open-donker | 9.677 % | 54 px | — | **nee** | 9.573 % | 0.113 % |
| blad-dicht | 0.100 % | 0 px | — | ja | 0.002 % | 0.098 % |
| blad-open | 9.478 % | 54 px | — | **nee** | 9.375 % | 0.107 % |
| blad-dicht-donker | 0.115 % | 0 px | — | ja | 0.001 % | 0.113 % |
| lichtbak-dicht | 0.139 % | 0 px | 0.00 / 0.00 / 0.00 % | ja | 0.018 % | 0.125 % |
| lichtbak-open | 0.121 % | 0 px | 0.00 / 0.00 / 0.00 % | ja | 0.006 % | 0.121 % |
| lichtbak-dicht-donker | 0.143 % | 0 px | 0.00 / 0.00 / 0.00 % | ja | 0.021 % | 0.126 % |
| gloedraster-dicht | 0.291 % | 0 px | 0.00 / 0.00 / 0.00 % | ja | 0.009 % | 0.293 % |
| gloedraster-open | 0.213 % | 0.5 px | 0.00 / 0.00 / 0.00 % | ja | 0.165 % | 0.058 % |
| gloedraster-dicht-donker | 0.291 % | 0 px | 0.00 / 0.00 / 0.00 % | ja | 0.009 % | 0.293 % |
| weergaveknop-menu | 0.189 % | 0 px | — | ja | 0.008 % | 0.193 % |
| weergaveknop-menu-blad | 0.169 % | 0 px | — | ja | 0.006 % | 0.169 % |
| gesprekken | 0.144 % | 0 px | — | ja | 0.013 % | 0.151 % |
| events | 0.160 % | 0 px | — | ja | 0.007 % | 0.166 % |

14 van 17 geslaagd. Bij de geslaagde staten ligt het percentage tegen de PNG steeds op de ruisvloer van het prototype zelf (laatste kolom). Wat afwijkt is randwerk van letters. Het kleurveld is gelijk, omdat de testpagina's dezelfde vooraf vervaagde beelden gebruiken als het prototype. Alle gemeten vlakkleuren zijn exact de token.

Uitvoer: `tmp/catalogus-desktop/` (eigen beeld, verschilbeeld, `verslag.json`, `tabel.md`).

## 2. Gedrag en beweging (`node scripts/catalogus-desktop-gedrag.mjs`)

Met beweging aan, 1440 × 900, op de testpagina's. **162 van 162 controles kloppen.** "—" betekent dat de controle niet voor die weergave geldt.

| Controle | wand | blad | lichtbak | gloedraster |
|---|---|---|---|---|
| Foto in het midden van de vrije ruimte (±1 px, horizontaal en verticaal) | ja | ja | ja | ja |
| Schaal uit §4 (1,7 · 1,7 · 1,424 · 3,2 bij deze stukken) | ja | ja | ja | ja |
| Paneel 440 breed, boven- en onderrand, rechts tegen de rand | ja | ja | ja | ja |
| Paneel ligt over de kop | ja | ja | ja | ja |
| Paneel bevat geen beeld van het stuk | ja | ja | ja | ja |
| Opname 0 / 150 / 350 / 700 ms en na afloop: foto één richting, geen sprong, op het doel | ja | ja | ja | ja |
| Idem voor het paneel | ja | ja | ja | ja |
| Foto naar het midden: 0,7 s cubic-bezier(.2,.8,.2,1) | ja | ja | ja | ja |
| Paneel in: 0,42 s cubic-bezier(.3,.7,.25,1) | ja | ja | ja | ja |
| Paneel weg: 0,36 s cubic-bezier(.3,.7,.25,1) | ja | ja | ja | ja |
| Andere stukken (strook) verbleken: 0,45 s standaard, tot 14 % | ja | ja | ja | ja |
| Paneel als één vlak: geen overgang op de blokken erin | ja | ja | ja | ja |
| Sluiten met een klik links, Esc of het kruisje: foto terug op zijn plek (±1 px) | ja | ja | ja | ja |
| ← → open: vorig en volgend stuk, ook met de pijlen in het paneel | ja | ja | ja | ja |
| Enter opent het gekozen stuk | ja | ja | ja | ja |
| Menu: 340 breed, vier rijen ≥ 60, `menuitemradio`, knop 36 met `aria-haspopup`/`aria-expanded` | ja | ja | ja | ja |
| Menu verschijnt: 0,2 s, 12 px omhoog | ja | ja | ja | ja |
| Esc en een klik erbuiten sluiten het menu | ja | ja | ja | ja |
| Menu wisselt de weergave, sluit, en de keuze staat er na herladen nog | ja | ja | ja | ja |
| Minder beweging: geen enkele overgang of animatie, meteen de eindtoestand, ook bij sluiten | ja | ja | ja | ja |
| Wand schuift: 0,7 s; ← → dicht: 380 px; stopt aan beide einden; het wiel schuift zijwaarts | ja | ja | — | — |
| Stuk onder de muis: 0,3 s, 8 px omhoog met schaduw | ja | ja | — | — |
| Kleurveld kruist: 0,9 s | — | — | ja | ja |
| Nieuw stuk verschijnt: 0,35 s, 12 px omhoog en invagen | — | — | ja | — |
| ← → dicht en de strook kiezen het stuk; het kleurveld wisselt mee | — | — | ja | — |
| Stuk onder de muis: 0,7 s, 8 % groter, 6 px omhoog | — | — | — | ja |
| Kleurveld wisselt met het vak onder de muis | — | — | — | ja |
| Bijdrage van een ander: geen ⋯; je eigen: ⋯ (44 × 44, `aria-haspopup`) en geen "Bericht aan" | ja | ja | ja | ja |
| ⋯ toont Bewerk en Verwijder; Esc sluit dat menu en niet het paneel | ja | ja | ja | ja |
| Bewerk: het formulier in het paneel, zonder reactieveld; Bewaar zet de nieuwe titel | ja | ja | ja | ja |
| Verwijder: paneel dicht, stuk weg | ja | ja | ja | ja |

Twee kanttekeningen:

- "Paneel als één vlak" slaat het hartje in de actierij over. Dat wordt 0,18 s groter terwijl je drukt (`.act:active`), net als in het prototype. Het is een reactie op een klik, geen beweging van het paneel.
- Het doel in de controle "foto in het midden" rekent het script zelf uit volgens §4. Het neemt dus niet de waarde van de app over.

Bewerken en verwijderen staan op de testpagina met `?eigen=1`: daar is elk stuk van jou. In de app is het formulier het bestaande `EditPost`, en verwijderen vraagt eerst bevestiging (`useBijdrage`, dezelfde handeling als op de telefoon). Daarna sluit het paneel; op `/post/[id]` ga je naar `/feed`.

## 2b. Responsive (`node scripts/catalogus-desktop-maten.mjs`)

De maten van het ontwerp gelden bij 900 hoog. Daarbuiten:

| Onderdeel | Hoe het meegaat |
|---|---|
| Wand en blad | De stukken schalen met de vensterhoogte (`hoogte / 900`). De zone van 58 % krimpt als de wand te laag wordt, zodat de bovenmarge, de vloerlijn en een bijschrift van twee regels er altijd in passen. Elk stuk past onder zijn nummer |
| Lichtbak | De foto is 54 % hoog in 7 : 9, maar nooit breder dan 30 % van het venster en nooit hoger dan het vlak boven de strook. De titel schaalt mee (`min(8vw, 12.8vh)`, 48–120 px), breekt alleen tussen woorden en houdt na vier regels op. De strook schuift als hij breder is dan het venster, vanaf het eerste vakje |
| Gloedraster | Elk voorwerp op de helft van zijn maat, meeschalend met de hoogte, en altijd binnen zijn vak, tussen nummer en titel |
| Blad | Bij een laag venster minder ruimte boven de tabbladen (16–96) en lagere tabbladen (56–88), zodat + en de knop Weergave niet overlappen |
| Events | Drie rijen per scherm, elk minstens 230 hoog; meer schuift. Minder dan drie: de lege rijen in het vlak |
| Openen | Het midden en de schaal rekenen met het vlak en het venster van dat moment, ook na een venster dat van maat verandert |

Vensters: 1024 × 768, 1024 × 1366, 1280 × 720, 1280 × 800, 1366 × 768, 1440 × 620, 1440 × 900, 1680 × 1050, 1920 × 1080, 2560 × 1440. Per venster lopen alle 12 staten door het script (dicht, open, menu, Gesprekken, Events). Het script controleert:

- de pagina schuift niet zijwaarts en de kop past;
- er loopt niets over en er overlapt niets (zie de tabel hierboven);
- een geopende foto staat binnen 1 px in het midden van de vrije ruimte, met de schaal uit §4, helemaal in beeld;
- het paneel is 440 breed en raakt boven- en onderrand;
- het menu blijft binnen het venster.

**120 van 120 kloppen.** Beelden: `tmp/catalogus-desktop/maten/`.

Onder 1024 breed is het de telefoonvorm, zoals tot nu toe.

Grenzen:

- Een titel van drie of meer regels op een smal stuk van de wand kan nog onder de wand vallen.
- Op heel brede schermen groeit het midden van Gesprekken mee; de berichten blijven hoogstens 420 breed.

## 3. Wat niet slaagt, en waarom

**`wand-open`, `wand-open-donker`, `blad-open`: de foto staat 54 px hoger dan in de PNG.**

- Verschilbeelden: `tmp/catalogus-desktop/wand-open-verschil.png`, `wand-open-donker-verschil.png` en `blad-open-verschil.png`.
- Oorzaak: het prototype rekent bij wand en blad de verticale verschuiving vanaf de bovenkant van het stuk, niet van de wand. Het open stuk krijgt `position: relative` en wordt zo de `offsetParent` van de foto. Daardoor eindigt de foto 6vh (de bovenmarge van de wand, 54 px bij 900) onder het midden. Bij lichtbak en gloedraster rekent het prototype wel vanaf het vlak, en daar staat de foto in het midden.
- De briefing §4 zegt "naar het midden van de vrije ruimte, horizontaal en verticaal", en het gedragsscript vraagt dat binnen 1 px. Bij twijfel wint de briefing, dus ik volg die.
- Nagegaan: met de offset van het prototype slagen alle drie (0,103 %, 0,114 % en 0,107 %, 0 px). Het gedragsscript faalt dan op "het midden" bij wand en blad. Beide tegelijk kan niet. Als Tom de vorm van het prototype wil, is het één regel in `Wand.tsx` (`dy + 6vh`). Dan slagen alle 17 en wijkt het gedrag 54 px af van de briefing.

Drempels en referentiebeelden zijn niet aangepast.

## 4. In het ontwerp, niet (zo) gebouwd

| Ontwerp | Wat er nu staat |
|---|---|
| Wand: bij sluiten blijft de wand in het prototype staan waar het open stuk hing | De wand schuift terug naar waar hij stond, zodat de foto terug op zijn plek staat (briefing §4) |
| Wand en blad: de foto 6vh onder het midden (prototype) | In het midden (§3) |
| Gesprekken: "Gedeeld in dit gesprek" in de zijkolom | Alleen op de testpagina. De app heeft geen lijst van wat in een gesprek gedeeld is, dus op echte gegevens valt het blok weg |
| Gesprekken: berichten als witte en inktvlakken, invoer van 72 | Op echte gegevens is het midden de bestaande draad (`ChatDetail`, ingebed) met zijn eigen invoer. De vorm daarvan heb ik niet nagelopen (§6) |
| Events: drie rijen die de hoogte vullen | Met drie of minder events precies zo. Met meer schuift de lijst, drie per scherm. Voorbije events staan onderaan, gedempt, met "Voorbij" |
| Events: de maand | De maand van vandaag, met een punt op elke dag van een event in de kleur van wie het maakt |
| Stukken met eigen formaat (vaste maten in het prototype) | De hoogtes wisselen zoals in het prototype (440, 320, 340, 280, 360, 300, 300, 330). De breedte volgt de verhouding van de foto (180–460). Een stuk zonder foto is het mobiele voorwerp op zijn eigen maat |
| Kleurveld: vooraf vervaagde foto van 96 px | Op echte gegevens maakt de app die zelf (canvas, 96 breed, 2 px vervaagd). Laat een beeld geen CORS toe, dan is het de foto zelf onder dezelfde vervaging |
| Paneel: geen ⋯-menu | Toegevoegd, alleen bij je eigen bijdrage: ⋯ vóór het kruisje, met "Bewerk deze bijdrage" en "Verwijder deze bijdrage" (in de gevaarkleur uit tokens.json). Bewerken toont `EditPost` op de plek van de draad; verwijderen vraagt eerst bevestiging. Bij de bijdrage van een ander is het paneel precies het ontwerp |
| Paneel: geen hartje per reactie | Niet gebouwd. Op mobiel blijft het |
| Antwoorden: niet getekend | Een klik op een reactie maakt er een antwoord van. Boven het invoerveld staat dan "Antwoord aan …" met ✕. In rust is het paneel precies het ontwerp |
| Polls | Een poll opent zijn eigen pagina (zoals mobiel), niet het paneel |
| Jij, Meldingen, Nieuwe bijdrage | Niet ontworpen op desktop: ze staan in de kolom van 430, zoals tot nu toe. Ook alles daarachter (instellingen, profiel, event, groep) |
| URL | Een stuk openen in de feed verandert de URL niet. `/post/[id]` opent de feed met dat stuk open, en sluiten gaat dan naar `/feed`. Een bijdrage die niet in de feed staat (ouder), toont de bijdragepagina in de kolom |
| Tablet (native) | Niet ontworpen: daar blijft de kolom. De desktopvorm is alleen voor web |

## 5. Gewijzigd in bestaande bestanden

| Bestand | Wat |
|---|---|
| `app/_layout.tsx` | De kolom van 430 alleen nog voor de schermen zonder desktopvorm (`heeftDesktopVorm`). Dezelfde twee `View`s, alleen de breedte wisselt, zodat de navigator niet opnieuw begint |
| `app/(app)/feed.tsx` | Catalogus op desktop → `FeedDesktopEcht` |
| `app/post/[id].tsx` | Catalogus op desktop → de feed met dat stuk open |
| `app/(app)/chats.tsx` | Prop `gekozen`; tak voor catalogus op desktop met dezelfde rijen, en `ChatDetail` ingebed |
| `app/chat/[id].tsx` | Catalogus op desktop → Gesprekken met dat gesprek |
| `app/(app)/events.tsx` | Tak voor catalogus op desktop met dezelfde rijen |
| `components/lincin/catalogus/schermen/BijdrageCatalogus.tsx` | De gegevens en handelingen zitten nu in `useBijdrage.ts` (nieuw); de pagina zelf is gelijk gebleven |
| `components/lincin/catalogus/schermen/FeedCatalogus.tsx` | `vandaag()` geëxporteerd |
| `components/lincin/catalogus/schermen/useBijdrage.ts` | Geeft ook `verwijder` terug, voor ⋯ in het paneel |
| `scripts/catalogus-vergelijk.mjs` | Vlag `--desktop` (`vergelijkDesktop`); `vergelijkDelen` kan in DOM-volgorde meten |
| `package.json` | `catalogus:vergelijk:desktop` |

Magazine en modern: `useIsDesktop()` is ongewijzigd en blijft `false` voor catalogus. Elke nieuwe tak vraagt eerst of het thema catalogus is.

De niet-gecommitte wijzigingen van de eigenaar staan in tien bestanden:

- `Header.tsx`, `DesktopPost.tsx`, `Shell.tsx`, `FeedMagazine.tsx`, `useFeed.ts`;
- `Comments.tsx`, `Reactions.tsx`;
- `i18n.ts`, `comments.ts`, `prefs.ts`.

Die zijn niet aangeraakt en niet meegecommit. Daarom staat de weergave niet in `user_prefs`: dat vroeg een wijziging in `prefs.ts`.

Nieuw:

- `components/lincin/catalogus/desktop/`. Daarin:
  - `stijl.ts`, `typen.ts`, `weergave.ts`, `Delen.tsx`, `Kader.tsx`, `Wortel.tsx`, `Pagina.tsx`;
  - `WeergaveKnop.tsx`, `Paneel.tsx`, `naarMidden.ts`, `Kleurveld.tsx`;
  - `Wand.tsx`, `Lichtbak.tsx`, `Gloedraster.tsx`, `FeedDesktop.tsx`, `GesprekkenDesktop.tsx`, `EventsDesktop.tsx`;
  - `echt.tsx` (de echte gegevens);
  - `dev/` (de testgegevens en de testpagina).
- `components/lincin/catalogus/schermen/useBijdrage.ts`.
- `app/dev/catalogus-desktop/[staat].tsx`: alleen in `__DEV__`, zoals de mobiele testroute.
- `assets/catalogus-desktop-voorbeeld/`: de raket en de vervaagde beelden uit het prototype. De andere zeven foto's waren er al (`assets/catalogus-voorbeeld/`).
- `scripts/catalogus-desktop-gedrag.mjs` en `scripts/catalogus-desktop-maten.mjs`.
- `docs/CATALOGUS-DESKTOP-PLAN.md` en dit verslag.

**Productiebuild.** `npx expo export -p web` slaagt. De bundel bevat de weergaven, maar geen testgegevens en geen voorbeeldbeelden: daarop is gezocht naar "Toysman de creator", "voorbeeld 06" en `blur-*`.

## 6. Nagelopen, en wat niet

**Gedaan, alleen in Chromium (Playwright), op macOS:**

- Alle 17 staten en het gedragsscript, op 1440 × 900.
- Tien vensters van 1024 × 768 tot 2560 × 1440, alle staten (§2b), en een paar uitersten op het oog.
- 1100 × 800: een staat van elke weergave, met Gesprekken, Events en het menu, in licht en donker. Gemeten: geen horizontale schuifbalk, en de kop past. Het paneel en de foto in het midden heb ik op het oog bekeken, niet gemeten. Beelden: `tmp/catalogus-desktop/1100-*.png`.
- Magazine, modern en catalogus tegen de stand vóór dit werk (`1fa9611` plus de niet-gecommitte wijzigingen van de eigenaar, in een tweede werkmap). Welkom en inloggen, licht en donker, op 390 en 1280 breed: 24 van 24 met 0 px verschil.
- Telefoonbreedte: de mobiele testpagina's (`npm run catalogus:vergelijk`) geven 34 van 38, gelijk aan vóór dit werk. De desktopvorm geldt pas vanaf 1024 (`useCatalogusDesktop`).

**Niet gedaan: de echte schermen ingelogd (4e).** Er is geen testaccount en `.env.local` wijst naar de echte Supabase. Daarom heb ik niet nagelopen:

- de feed, Gesprekken en Events in de vier weergaven op echte gegevens, in licht en donker;
- hartje, reageren, antwoorden en "Bericht aan …" vanuit het paneel;
- bewerken en verwijderen op een echte eigen bijdrage: opslaan naar de database en de bevestiging bij verwijderen. **De vorm is wel nagelopen:** het echte `EditPost` in het paneel, met een nagemaakte bijdrage van drie foto's (`/dev/catalogus-desktop/wand-open?eigen=echt`), in licht op 1440 × 900 en in donker op 1024 × 768. Foto's, titel, onderschrift en Annuleer/Bewaar passen binnen de 440. De fotostrook schuift zijwaarts, net als op de telefoon, dus het vak "+ foto" staat bij drie of meer foto's half buiten beeld. Beelden: `tmp/catalogus-desktop/bewerk-*.png`;
- een gedeelde link `/post/[id]`, ook naar een bijdrage die niet in de feed staat;
- `/chat/[id]` en het wisselen van gesprek, en hoe de ingebedde draad er in catalogus uitziet;
- Ik kom en afmelden vanuit Events;
- het kleurveld van echte foto's: werkt CORS op de opslag, of valt het terug op de foto zelf;
- magazine en modern op desktop ná het inloggen (feed, gesprekken, events). Hun code is niet geraakt, maar hun schermen heb ik niet gezien.

Alleen in Chrome bekeken (net als het prototype zelf): alles hierboven. Safari en Firefox zijn niet gecontroleerd. Daar kunnen vooral `color-mix` (de rij onder de muis), de vervaging van het kleurveld en de letters verschillen.

## Opnieuw draaien

```bash
npm run catalogus:vergelijk:desktop                  # alle 17 staten
npm run catalogus:vergelijk:desktop -- wand-open     # alleen deze
node scripts/catalogus-desktop-gedrag.mjs            # gedrag, alle vier
node scripts/catalogus-desktop-gedrag.mjs lichtbak   # alleen deze
node scripts/catalogus-desktop-maten.mjs             # responsive, 10 vensters
node scripts/catalogus-desktop-maten.mjs 1024x768    # alleen dit venster
npm run catalogus:vergelijk                          # mobiel
```

De vergelijking start de webversie zelf als er op poort 8081 niets draait. Het gedragsscript verwacht hem daar al. Start de server zelf zonder `CI=1`, anders ziet Metro geen wijzigingen.
