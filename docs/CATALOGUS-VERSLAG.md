# Catalogus (ontwerp 3e) — verslag

Tak `thema-catalogus`, niet gepusht. Stand 10 november 2026.

## Kort

- Catalogus is een derde thema naast magazine en modern, licht en donker, kiesbaar in de instellingen.
- Alle 19 testpagina's slagen in beide standen (38 van 38) volgens de regels van de opdracht.
- Tegen de referentie-HTML, gerenderd in dezelfde browser, wijkt elk scherm hooguit 0,009 % af.
- De echte schermen zijn gekoppeld, maar **niet nagelopen met echte gegevens**. Er zijn geen ontwikkelgegevens (zie §5).
- Het open gesprek (07) heeft in de app alleen de kop uit het ontwerp. De berichten en de invoer zijn niet omgebouwd (zie §3).

## 1. Eindtabel van `npm run catalogus:vergelijk`

Kolommen 3 tot en met 6 zijn de toets uit de opdracht (pixelmatch tegen de PNG met drempel 0.1; maten > 1 px; hoogte). Een scherm slaagt alleen als ook de vlakkleuren en de gebruikte systeemletters gelijk zijn.

De laatste twee kolommen zijn ter controle:

- **Eigen ↔ ref-HTML:** mijn pagina tegen de referentie-HTML, gerenderd in dezelfde browser.
- **Ref-HTML ↔ PNG:** die render tegen zijn eigen PNG. Dit is de ruisvloer van de machine.

| Scherm | Stand | Afwijkend (PNG) | Grootste maatafwijking | Hoogte | Geslaagd | Eigen ↔ ref-HTML | Ref-HTML ↔ PNG |
|---|---|---|---|---|---|---|---|
| 01-home | licht | 0.049 % | 0 px | 0 px | ja | 0.000 % | 0.050 % |
| 01-home | donker | 0.064 % | 0 px | 0 px | ja | 0.000 % | 0.065 % |
| 02-gesprekken | licht | 0.048 % | 0 px | 0 px | ja | 0.001 % | 0.049 % |
| 02-gesprekken | donker | 0.053 % | 0 px | 0 px | ja | 0.001 % | 0.055 % |
| 03-events | licht | 0.052 % | 0 px | 0 px | ja | 0.003 % | 0.051 % |
| 03-events | donker | 0.068 % | 0 px | 0 px | ja | 0.001 % | 0.067 % |
| 04-jij | licht | 0.041 % | 0 px | 0 px | ja | 0.002 % | 0.043 % |
| 04-jij | donker | 0.047 % | 0 px | 0 px | ja | 0.002 % | 0.049 % |
| 05-bijdrage | licht | 0.042 % | 0 px | 0 px | ja | 0.002 % | 0.045 % |
| 05-bijdrage | donker | 0.048 % | 0 px | 0 px | ja | 0.002 % | 0.050 % |
| 06-profiel | licht | 0.054 % | 0 px | 0 px | ja | 0.005 % | 0.059 % |
| 06-profiel | donker | 0.062 % | 0 px | 0 px | ja | 0.004 % | 0.062 % |
| 07-open-gesprek | licht | 0.054 % | 0 px | 0 px | ja | 0.009 % | 0.066 % |
| 07-open-gesprek | donker | 0.052 % | 0 px | 0 px | ja | 0.008 % | 0.063 % |
| 08-meldingen | licht | 0.074 % | 0 px | 0 px | ja | 0.002 % | 0.079 % |
| 08-meldingen | donker | 0.070 % | 0 px | 0 px | ja | 0.001 % | 0.075 % |
| 09-nieuwe-bijdrage-soort | licht | 0.161 % | 0 px | 0 px | ja | 0.001 % | 0.162 % |
| 09-nieuwe-bijdrage-soort | donker | 0.163 % | 0 px | 0 px | ja | 0.000 % | 0.163 % |
| 10-nieuwe-bijdrage-foto | licht | 0.041 % | 0 px | 0 px | ja | 0.000 % | 0.041 % |
| 10-nieuwe-bijdrage-foto | donker | 0.043 % | 0 px | 0 px | ja | 0.000 % | 0.044 % |
| 11-instellingen | licht | 0.102 % | 0 px | 0 px | ja | 0.002 % | 0.108 % |
| 11-instellingen | donker | 0.105 % | 0 px | 0 px | ja | 0.002 % | 0.110 % |
| 12-mijn-lincs | licht | 0.042 % | 0 px | 0 px | ja | 0.006 % | 0.048 % |
| 12-mijn-lincs | donker | 0.055 % | 0 px | 0 px | ja | 0.006 % | 0.060 % |
| 13-home-leeg | licht | 0.035 % | 0 px | 0 px | ja | 0.000 % | 0.035 % |
| 13-home-leeg | donker | 0.033 % | 0 px | 0 px | ja | 0.000 % | 0.033 % |
| 14-interactie-leuk-gevonden | licht | 0.059 % | 0 px | 0 px | ja | 0.005 % | 0.063 % |
| 14-interactie-leuk-gevonden | donker | 0.065 % | 0 px | 0 px | ja | 0.003 % | 0.068 % |
| 15-interactie-draad-en-antwoord | licht | 0.064 % | 0 px | 0 px | ja | 0.002 % | 0.066 % |
| 15-interactie-draad-en-antwoord | donker | 0.078 % | 0 px | 0 px | ja | 0.002 % | 0.079 % |
| 16-interactie-menu | licht | 0.056 % | 0 px | 0 px | ja | 0.001 % | 0.058 % |
| 16-interactie-menu | donker | 0.051 % | 0 px | 0 px | ja | 0.001 % | 0.053 % |
| 17-interactie-lang-drukken | licht | 0.051 % | 0 px | 0 px | ja | 0.000 % | 0.051 % |
| 17-interactie-lang-drukken | donker | 0.042 % | 0 px | 0 px | ja | 0.000 % | 0.042 % |
| 18-interactie-home-met-hartje | licht | 0.048 % | 0 px | 0 px | ja | 0.001 % | 0.050 % |
| 18-interactie-home-met-hartje | donker | 0.056 % | 0 px | 0 px | ja | 0.000 % | 0.057 % |
| 19-interactie-soorten-inhoud | licht | 0.068 % | 0 px | 0 px | ja | 0.002 % | 0.070 % |
| 19-interactie-soorten-inhoud | donker | 0.070 % | 0 px | 0 px | ja | 0.001 % | 0.074 % |
38 van 38 geslaagd.

Gemeten onderdelen (positie en maat, ≤ 1 px): kop, elk vak, elk voorwerp (inclusief elk beeld), elk kaartje, actierij, tabbalk, en elke band met een naad erboven. De grootste maatafwijking is overal 0 px, en de hoogte is overal gelijk.

### Hoe het script rendert

Chromium start met `--force-device-scale-factor=2`. Met alleen een geëmuleerde schaalfactor (`deviceScaleFactor` van de context) wijkt de referentie-HTML zelf al 0,2–1 % af van zijn eigen PNG. Daarmee zakte ook 01 tot boven de grens. Met de vlag is dat 0,03–0,16 %. Dit is geen verlaagde drempel: het is de renderinstelling waarmee de PNG's gemaakt zijn. Drempels en referentiebeelden zijn ongewijzigd.

## 2. Wat niet slaagt, of afwijkt zonder dat de cijfers het zeggen

**Tekens buiten het latijnse bereik (← → № ↗ ⋯).** Ze hebben in de PNG's een andere vorm dan hier. In de PNG is ← bijvoorbeeld een dunne pijl; hier is het de volle pijl uit Lucida Grande. De referentie-HTML, gerenderd op deze Mac, tekent precies dezelfde pijl als mijn bouw. De PNG's zijn dus gemaakt op een machine met andere systeemletters. Het zijn een paar pixels per teken en ze vallen ruim binnen 0,5 %. Volgens de regel "alleen randwerk van letters" is het strikt genomen geen randwerk maar een ander teken. Ik heb de lettertypen van die machine niet nagegokt: mijn bouw doet wat de HTML doet.

Het grootste voorbeeld is ↗ in 09: `tmp/catalogus/09-nieuwe-bijdrage-soort-licht-verschil.png`, in licht en in donker. Ook in de kop van elk subscherm (←) en bij № in de home.

**Op web heeft de catalogusletter een eigen familie.** `Archivo Latijn` gebruikt dezelfde bestanden, maar alleen het latijnse bereik van het ontwerp (`unicode-range`). Daarna volgt een vaste keten systeemletters, zodat pijlen, ✳ en № net als in het ontwerp uit de systeemletter komen. Zonder die keten koos Chrome voor → soms de volledige Archivo die de andere thema's laden. Op native tekent Archivo de pijlen zelf.

## 3. In het ontwerp, niet gebouwd

| Ontwerp | Waarom niet | Wat er nu staat |
|---|---|---|
| Menu bij een bijdrage (16): "Verberg deze bijdrage", "Demp … een week", "Meld deze bijdrage" | De app kan dat niet voor bijdragen (alleen voor reacties) | Menu: "Stuur … een bericht hierover" en "Reageer"; bij een eigen bijdrage "Bewerk" en "Verwijder" |
| Meldingen (08): uitnodiging voor een event met "Ik kom / Kan niet" | Er is geen uitnodigingsmelding, en "kan niet" kent het RSVP-model niet (alleen ja, misschien of geen antwoord) | Linc-verzoeken staan wél als melding met "Accepteer / Negeer" (echte handelingen) |
| Nieuwe bijdrage (10): "Reacties · Toegestaan" | Bestaat niet | Weggelaten |
| Nieuwe bijdrage (09): soorten kleur, plek, spraak | De app kan ze niet plaatsen (`SUPPORTED` in post-compose) | Het raster toont foto, tekst, poll, muziek, link |
| Instellingen (11): "Geblokkeerd" | Bestaat niet | Weggelaten; "Versie" komt uit `expo-constants` |
| Spraak afspelen bij een bijdrage (19) | Een spraakbijdrage heeft in de app geen geluid | Golf zonder afspeelknop-functie |
| Muziek "speelt · [tijd]" (19) | Muziek speelt buiten de app (`openExternal`) | Afspeelknop opent het nummer; het kaartje noemt de artiest |
| Open gesprek (07): berichten als witte en inktvlakken, gedeelde bijdrage en spraakbericht als voorwerp, invoer met + | Het gesprek (4800 regels: vegen, reacties op berichten, bewerken, bijlagen, belafspraken, typen) is niet herschreven; zonder inloggen viel het niet na te lopen | De kop uit het ontwerp (←, beeld, kaartje, ⋯); draad en invoer zijn het bestaande onderdeel op het cataloguspalet. **Wijkt af van het ontwerp.** De testpagina 07 toont de ontwerpvorm met `GesprekView` |
| Het thema in het profiel bewaren | `profiles_theme_check` (migratie 0067) kent `catalogus` niet, en `supabase/` blijft onaangeroerd | De keuze blijft op het toestel. Een migratie die `catalogus` toestaat is nodig om hem tussen toestellen te delen |

De testpagina's tonen de ontwerpinhoud letterlijk, ook de regels hierboven die de echte schermen niet hebben. Het zijn dezelfde onderdelen: een menu, een melding met een keuze, een formulierregel met een schakelaar. Alleen de gegevens verschillen.

### Eigen keuzes waar het ontwerp twee dingen laat zien

- **Bijdrage, 05 tegenover 14–16.** De pagina opent rustig (05). De eerste handeling zet hem in de actieve vorm (14–16): het hartje, de ballon, tikken op een reactie, ⋯ of Antwoord.
- **Home met hartje (18).** Geen schakelaar. Wie op de home iets leuk vindt (dubbel tikken op het beeld, of het hartje na lang drukken), ziet daarna in elk vak het hartje en de reacties.
- **Ter wille van de functie toegevoegd**, in de vorm van een gewone regel:
  - het bijschrift en de tekst van een bijdrage;
  - "Meer reacties";
  - "Nieuwe groep" (gesprekken) en "Plan een event" (events);
  - voorbije events met "Voorbij";
  - de QR-code (Jij);
  - standaard open, app-slot, toestel koppelen, lijsten en profiel bewerken (instellingen);
  - "Bewaar als concept" en "Nog een keuze" (nieuwe bijdrage).
- **Mijn lincs:** + opent het bestaande toevoegscherm (QR, link, zoeken), in de oude vorm.
- **Schermen buiten het ontwerp** krijgen het cataloguspalet in de kop- en voetvorm van magazine. Dat zijn onder meer de eventpagina, de pollpagina, groepen, lijsten en het bewerken van je profiel.

## 4. Gewijzigd in bestaande bestanden

| Bestand | Wat |
|---|---|
| `lib/design/theme.ts` | `catalogus` in `LincinTheme`/`THEMES`, `SPEC`-regel (`layout: "catalogus"`, `nav: "tabbalk"`), `CATALOGUS` (hex uit tokens.json), paletten voor de gedeelde tokens |
| `lib/design/type.ts` | `sansLight`/`sansExtraLight`, `FONT_FILES`, `sans(200 \| 300)`, kopschaal voor catalogus |
| `app.config.ts`, `app/+html.tsx` | Archivo Light en ExtraLight (native en web); familie `Archivo Latijn`; het themascript vóór het eerste beeld kent catalogus |
| `vercel.json` | CSP-hash van dat themascript (`npm run csp:check` slaagt weer) |
| `lib/api/profiles.ts` | `setProfileTheme` neemt geen `catalogus` aan (de database kent hem niet). Buiten `lib/design/`, maar zonder deze regel compileert het nieuwe type niet |
| `components/lincin/ThemeProvider.tsx` | Schrijft catalogus niet naar het profiel |
| `app/(app)/feed.tsx`, `chats.tsx`, `events.tsx`, `notifications.tsx`, `profile.tsx`, `friends.tsx`, `app/post/[id].tsx`, `app/user/[username].tsx`, `app/post-compose.tsx`, `app/settings.tsx`, `app/chat/[id].tsx` | Bovenaan een tak voor catalogus. De bestaande gegevens en handelingen blijven, magazine en modern zijn ongewijzigd. Settings krijgt ook de keuze "Catalogus" |
| `package.json` | `catalogus:vergelijk`; devDependencies playwright, pixelmatch, pngjs |
| `.gitignore` | `tmp/` |

Nieuw:

- `components/lincin/catalogus/` (bouwstenen, weergaven, koppelstukken, testgegevens);
- `app/dev/catalogus/[scherm].tsx`;
- `scripts/catalogus-vergelijk.mjs`;
- `assets/fonts/Archivo-Light.ttf` en `Archivo-ExtraLight.ttf` (uit de variabele Archivo 2.001, dezelfde versie als de bestaande snitten);
- `assets/catalogus-voorbeeld/` (de voorbeeldfoto's, alleen gebruikt door de testpagina's);
- `docs/CATALOGUS-PLAN.md`.

**Over de testroute in productie.** `npx expo export -p web` levert een bundel zonder testgegevens en zonder voorbeeldfoto's. De tak achter `__DEV__` valt weg, en de route stuurt daar door naar de app.

**Magazine en modern.** Nagegaan:

- Geen enkel scherm buiten catalogus vraagt om gewicht 200 of 300, dus de nieuwe snitten veranderen niets.
- Hun paletten en `SPEC`-regels zijn ongewijzigd.
- Inloggen en welkom tekenen in beide thema's, in licht en donker, op 390 en 1280 breed.

Een pixelvergelijking met `main` lukte niet: een tweede server vanuit een worktree bleef op de laadcirkel staan. Die vergelijking ontbreekt dus.

**Volgorde.** Het plan (`docs/CATALOGUS-PLAN.md`) is geschreven nadat het gereedschap en de home al stonden, niet ervoor zoals gevraagd.

## 5. Alleen op web gecontroleerd, nog na te lopen

**Echte gegevens (4d) zijn niet nagelopen.** Er zijn geen ontwikkelgegevens: geen testaccount in de repo, en `.env.local` wijst naar de echte Supabase. Inloggen met een persoonlijk account heb ik niet gedaan, omdat tikken, stemmen en accepteren bij vrienden zou aankomen. Gecontroleerd zijn alleen typecheck, lint, de testpagina's en de productiebuild.

Nog na te lopen, ingelogd, in licht en donker:

- home: tik, dubbel tik, lang drukken, de hartjesstand, de lege staat;
- gesprekken en lang drukken (gelezen/ongelezen);
- events: Ik kom en afmelden;
- meldingen: Alles gelezen, Accepteer en Negeer;
- bijdrage: hartje, reactie, antwoord, hartje op een reactie, menu, bewerken en verwijderen;
- profiel: Gesprek, Samen plannen en ⋯;
- nieuwe bijdrage, alle vijf soorten;
- instellingen: alle schakelaars en de themawissel;
- mijn lincs;
- stemmen in een poll in een vak;
- muziek openen;
- de kop van een gesprek;
- wisselen naar magazine en modern.

Op een toestel:

- **De nieuwe snitten.** Archivo Light en ExtraLight zitten via de `expo-font`-plugin in de build. Daarvoor is een nieuwe native build nodig.
- **Pijlen en tekens.** Op native komen ← en → uit Archivo, niet uit de systeemletter.
- **Outline en schaduw.** Het gekozen vak (outline met offset), het opgetilde vak (`boxShadow`) en de rand om een overlappende foto vragen de nieuwe architectuur van React Native.
- **Gestippelde randen.** Op de lege home en bij "Linc toevoegen".
- **Toetsenbord.** Of het boven het reactieveld en het formulier blijft.
- **Safe area.** Ook de plek van het opgetilde vak bij lang drukken.
- **Gebaren.** Lang drukken (380 ms) en dubbel tikken (280 ms).

## Opnieuw draaien

```bash
npm run catalogus:vergelijk              # alle 38
npm run catalogus:vergelijk -- 05 14     # alleen deze schermen
npm run catalogus:vergelijk -- --stand=donker
```

Uitvoer in `tmp/catalogus/`: per scherm en stand de eigen afbeelding, het verschilbeeld en `verslag.json`.

## Aanpassingen na de oplevering (10 nov 2026)

Op verzoek, na het nalopen op lincin.vercel.app:

- **Profiel (06): bewust anders dan het ontwerp.** De naam staat volledig over de breedte onder de foto (op meer regels als het moet), de bio eronder. In het ontwerp staan ze naast elkaar en werd een lange naam afgekapt. Daardoor slaagt `06-profiel` niet meer tegen de referentie (11–16 %); de andere 36 slagen. De drempels en referentiebeelden zijn niet aangepast.
- Profiel: elk vak heeft twee regels meer, Leuk en Reacties; het vak groeit mee.
- Bijdrage: een tekst staat volledig op het blad, in bladzijden met ← n / m →.
- Gesprek: de titel opent de groepsinfo (of het profiel); de groepsinfo heeft een catalogusvorm met alle leden. Berichten zonder kader: de jouwe inkt, die van de ander een kaart.
- Kop: het + staat 2 px hoger, even hoog als ✳.
- Raster: de lege helft van een halve rij is vlak in plaats van wit.
- Desktop: Catalogus staat ook in de desktopinstellingen. Op een breed scherm (vanaf 1024) toont de app dan de telefoonvorm in een kolom van 430 in het midden (`app/_layout.tsx`, `KOLOM` in `catalogus/stijl.tsx`). Daarvoor kijkt `useIsDesktop()` in `lib/lincin/desktop.ts` naar het thema — een wijziging in `lib/` buiten `lib/design/`, nodig voor deze vraag.
- Het onderschrift bij Thema zegt nu ook "Catalogus"; aangevuld waar het getoond wordt, omdat `lib/i18n.ts` niet-gecommitte wijzigingen van de eigenaar heeft.
- Event: de pagina en de bladen (gasten, toevoegen, toegang) in catalogusvorm.
