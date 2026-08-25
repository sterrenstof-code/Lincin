# Lincin Design System — v4

Eén document waarmee we elke UI-wijziging aftoetsen. Dit beschrijft het
systeem **zoals de code het nu doet**, niet zoals het ooit bedoeld was.

> **Let op — de vorige versie van dit document is ongeldig.**
> Er circuleert een oudere `DESIGN.md` (te vinden in de git-historie als
> `_backup_feed_upgrade/DESIGN.md.bak`, commit `2074a4b`). Die beschrijft
> het pre-v3-systeem: perzik/crème papier, `rounded-3xl`, "pil is de norm",
> blauw als merkaccent. **Dat is allemaal vervangen.** De v3-uitrol hield
> de tokennamen aan maar verving hun wáárden. Wie dat document volgt,
> bouwt de verkeerde app.

---

## 1. Waar het systeem woont

Vier bestanden, en ze hangen aan elkaar. Verandert er iets aan kleur of
typografie, dan gebeurt dat daar en nergens anders.

| Bestand | Wat erin staat |
|---|---|
| `lib/design/theme.ts` | **De twee paletten**, met de reden per kleur. De bron. |
| `global.css` | Dezelfde waarden als CSS-variabelen: `:root` (licht) en `.dark:root` (donker) |
| `tailwind.config.js` | De tokens voor **klassen** (`bg-page`, `text-ink`) — allemaal verwijzingen naar die variabelen |
| `lib/design/type.ts` | Dezelfde tokens als **props** + de hele typeschaal |

Waarom klassen én props: NativeWind-klassen dekken achtergronden en tekst,
maar een `Ionicons`-kleur, een `tintColor` of een `borderColor` in een
style-object moet een echte waarde zijn. Die twee mogen **nooit** uit
elkaar lopen — dat was eerder wél zo (twee zwarten, vier hexpunten uit
elkaar) en het is onzichtbaar tot het niet meer klopt. Nu kán het niet
meer: allebei lezen ze dezelfde variabele.

Er staan daarom **geen hexwaarden meer** in `tailwind.config.js` of in
`lib/design/type.ts`. Wil je een kleur bijstellen, dan doe je dat in
`lib/design/theme.ts` én in `global.css` — die twee lijsten horen
letterlijk gelijk te zijn.

---

## 2. Twee standen

De app heeft **twee paletten** en verder één ontwerp. Vorm, ruimte, type,
beweging: allemaal identiek. Alleen de kleurwaarden schuiven.

| | |
|---|---|
| **Donker** | Lavendel blad, plum kaarten, crème tekst, één scherp drukwerkrood, oranje actie. Dit is de app zoals hij was — er is geen hex aan veranderd. |
| **Licht** | Vier soorten wit en grijs, inkt erop, en dezelfde oranje. Geen lavendel, geen plum, en geen rood: op een wit blad met verder alleen grijzen is rood náást de oranje balk één warme kleur te veel. |

De stand komt van het besturingssysteem (`Auto`) tenzij je hem zelf zet.
De schakelaar staat in het persoonlijke menu achter je avatar
(`components/ThemeSwitch.tsx`), dus vanaf élke pagina bereikbaar.

**Hoe het schuift.** Élk token wijst naar een CSS-variabele; de klasse
`dark` op `<html>` bepaalt welke set geldt. Op web hoeft er daardoor niets
te hertekenen — ook een kleur die als *prop* in een style-object staat is
daar letterlijk `rgb(var(--c-ink) / 1)`, dus de browser herberekent hem
mee. Op native bestaan variabelen niet: daar worden de bindingen in
`lib/design/type.ts` opnieuw opgebouwd en hertekent `ThemeGate` in
`app/_layout.tsx` de boom.

Een script in `app/+html.tsx` zet de klasse vóór het eerste beeld. Zonder
dat flitst er eerst een blad in de verkeerde stand.

### Drie paren die samen kantelen

Dit is het enige waar je bij een nieuw scherm over hoeft na te denken.
Sommige vlakken blijven in béide standen donker, en dan moet hun tekst dat
óók blijven. Andere vlakken kantelen, en dan kantelt hun tekst mee.

| Vlak | Tekst erop | Donker | Licht |
|---|---|---|---|
| `bg-shell`, `bg-ink`, `bg-flame`, `bg-announce` | `text-cream` | donker vlak, lichte tekst | **hetzelfde** |
| een foto met `<Scrim>` eroverheen | `creamOnDark` | licht op de sluier | **hetzelfde** |
| `bg-desk` (de niet-gemigreerde schermen, §8) | `text-desk-ink` / `desk.ink` | zwart met crème | blad met inkt |

De eerste twee rijen zijn vlakken die in béide standen donker blijven, dus
hun tekst blijft licht. De derde kantelt: vlak en tekst wisselen samen.

Zet je `feed.text` (de tekst op een kaart, dus inkt) op een gevulde zwarte
knop of op een foto, dan staat er in de lichte stand inkt op zwart. Dat is
de val in dit systeem, en hij is onzichtbaar in de stand waarin je
toevallig werkt — **kijk dus altijd even in de andere stand.**

### Het palet

### Vlakken
| Token | Donker | Licht | Waarvoor |
|---|---|---|---|
| `page` / `paper` | `#CDBEE3` | `#EFEFEC` | Het paginavlak |
| `page-alt` / `paper-soft` / `sheet` | `#EFE9F5` | `#FFFFFF` | Paneel, kaart, beeldkader |
| `paper-warm` | `#BFACDB` | `#E2E2DE` | Band, uitgeschakelde vulling |
| `paper-light` | `#F5F1FA` | `#F7F7F5` | Zacht vlak |
| `shell` | `#0B0A0C` | `#0B0A0C` | De balk — donker in béide standen |
| `shell-soft` | `#2E2138` | `#26262B` | Donker vlak bínnen die balk |
| `feed-post` | = `page` | = `page` | Élk kaartoppervlak — **geen eigen vulling**, zie §4 |
| `feed-fill` | `#BFACDB` | `#E7E7E3` | Beeldvlak in afwachting van de foto |
| `desk` | `#0B0A0C` | `#F7F7F5` | Het blad van een §8-scherm — **kantelt** |
| `desk-panel` | `#2E2138` | `#E2E2DE` | Gedempte vulling daarop |

### Tekst
| Token | Donker | Licht | Waarop |
|---|---|---|---|
| `ink` / `carbon` | `#0B0A0C` | `#0B0A0C` | Op het paginavlak |
| `ink-soft` | `#3A3540` | `#44444A` | Secundair |
| `ink-muted` | `#6B6474` | `#7A7A80` | Tertiair |
| `cream` | `#F3EDE4` | `#F7F7F5` | Op inkt, op de balk, op een gevulde knop |
| `cream-soft` / `cream-muted` | `#D9D2E4` / `#A79FB5` | `#DCDCD9` / `#A0A09C` | idem, zachter |
| `feed-text` | = `ink` | = `ink` | Op een kaart. Zelfde kleur als `ink`, andere bedoeling — zie §4 |
| `feed-dim` | inkt @62% | inkt @58% | Bijschrift op een kaart |
| `desk-ink` / `-soft` / `-muted` | `#F3EDE4` / `#D9D2E4` / `#A79FB5` | `#0B0A0C` / `#44444A` / `#7A7A80` | Op een §8-blad — **kantelt** |

### Accent
| Token | Waarde | Regel |
|---|---|---|
| `flame` | `#E63329` donker · `#D4551F` licht | Citaten, indexcijfers, vullingen, lijnwerk |
| `flame-deep` | `#A81C13` donker · `#A83E12` licht | **Alles onder ~16px** — de DEFAULT haalt op het blad geen 4.5:1 |
| `announce` | `#E66B3F` | De aankondigingsbalk **en de primaire actie** (delen, toevoegen, opties). `announceDeep` `#C4552C` is dezelfde kleur ingedrukt. |
| `brand` | `#5B8DEF` | Alleen het logo en de e2e-badge |
| `teal` / `gold` | `#4FBDB0` / `#E3A84B` | Alleen de tegels in de feed |

`flame` en `announce` hebben bewust aparte namen zodat een zoek-vervang op
het rood de oranje balk niet meeneemt.

De primaire actie stond eerder in flame-rood. Rood is hier het accent van
de redactie — citaten, indexcijfers, lijnwerk — en een knop die iets dóet
hoort niet dezelfde kleur te hebben als een aanhalingsteken. Er is er
hoogstens één per scherm.

---

## 3. Typografie

Twee stelsels die naast elkaar leven. Dat is een bewuste keuze, geen
overgangsrestant.

**`feedType` (Inter, sans)** — draagt de feed en alles wat sinds v3
herbouwd is. Ook brontitels krijgen hier géén serif.

**`type` (Didot / Bodoni / Playfair, serif)** — het affiche-systeem, voor
redactionele momenten: citaten, koppen van een vondst, onderschriften.

Beide staan in `lib/design/type.ts` met de volledige schaal
(`hero`, `tagline`, `cover`, `tile`, `pull`, `numeral`, `kicker`, `label`,
`micro`, `body`, `caption`). Gebruik een bestaande trede; voeg er liever
één toe dan dat je losse `fontSize`-waarden strooit.

Er worden **geen fontbestanden meegeleverd**. Web haalt Inter, Bodoni Moda
en Playfair op via de stylesheet in `app/+html.tsx`; iOS gebruikt het
ingebouwde Didot en San Francisco; Android valt terug op Noto Serif en
Roboto.

---

## 4. Vorm

### Een kaart heeft geen vulling

**Hiërarchie komt uit lijn en inspringing, niet uit een vlak.**

Dit systeem had al geen schaduwen — diepte kwam uit vlak en lijn. Die regel
gaat nu één stap verder: ook het vlak zelf is weg. Een vondst, een tegel,
een coverband staat rechtstreeks op het blad. Wat de opbouw draagt is:

1. **De lijn.** Een kaart is een stapel banden met een lijn ertussen:
   beeld · kop · herkomst. Zo zie je de opbouw voordat je leest.
2. **De inspringing.** Wat ondergeschikt is, staat een stap naar binnen.
   Wie iets deelde staat ónder de kop én inwaarts, en dan zie je aan de
   vorm al dat het tweede bij het eerste hoort in plaats van ernaast.
3. **Het gewicht van de lijn.** Een lijn bínnen een kaart (`feed-rule`) is
   zachter dan de lijn eromheen, en het kader om een rubriek (`rule.soft`)
   is zachter dan allebei. Anders leest één kaart als drie losse kaarten,
   of wint de doos van de inhoud.

De reden: een pagina met twintig gevulde vlakken leest als twintig dozen,
niet als een blad. `feed-post` en `feed-text` bestaan nog — ze wijzen nu
naar `page` en `ink` — omdat ~80 plekken ernaar verwijzen en omdat ze nog
steeds een bedoeling uitdrukken: dit is de tekst óp een kaart.

Twee uitzonderingen, en allebei omdat er anders een gat valt:

- `feed-fill` — het vak waar een foto nog moet landen.
- Een knop die iets dóet. Er is er hoogstens één per scherm, en hij is
  oranje.

### De rest

- **Alles is vierkant.** Geen `rounded-*` behalve `rounded-full` voor
  avatars en voor de deelknop (`ShareButton`). Die twee zijn met opzet de
  uitzondering: alles hier is een kader, een tegel of een vlak, dus een
  cirkel is per definitie géén van drieën — hij ligt erbovenop. Dat is
  precies wat een avatar en een primaire actie zijn. De pillen van het oude
  systeem zijn weg.
- **Kaders zijn echte lijnen**, geen haarlijnen: `FEED_BORDER = 1.5`.
  Het ontwerp leest als gedrukt raster.
- **Geen schaduwen.** Hiërarchie komt uit vlak en lijn, niet uit diepte.
- Breekpunten: `FEED_BREAKPOINT = 800` (feed valt naar één kolom),
  `WIDE_BREAKPOINT = 900` (affiche-tweekolomsstructuur).

---

## 4b. Ruimte

De maatlat staat in `lib/design/type.ts` en heet `space`. Alles is een
veelvoud van vier; gebruik een trede in plaats van een los getal, net als
bij de typeschaal.

| Trede | Waarde | Waarvoor |
|---|---|---|
| `xs` | 4 | Tussen twee dingen die bij elkaar hóren (icoon + label) |
| `sm` | 8 | Binnen één element |
| `md` | 12 | Tussen regels in een blok |
| `lg` | 16 | Tussen blokken; de marge op een telefoon |
| `xl` | 20 | Binnenmarge van een kaart |
| `xxl` | 24 | De marge op een breed scherm |
| `xxxl` | 32 | Binnenmarge van een kolom binnen een kader |
| `section` | 40 | Tussen twee rubrieken |

Daarnaast drie vaste maten:

- `gutter(wide)` — de marge tussen bladspiegel en vensterrand. **Kop én
  inhoud lezen deze.** Staan ze op verschillende waarden, dan begint de
  pagina naast zijn eigen kop.
- `CONTROL_H` (44) — de hoogte van élke knop en élk invoerveld. Eén maat,
  want een rij met een knop van 44, een van 52 en een veld dat met zijn
  inhoud meegroeit staat nergens op één lijn.
- `ROW_H` (60) — de hoogte van een rij in een lijst. Vast, zodat een naam
  die op twee regels valt de rij niet hoger maakt dan zijn buur.

Voor tekst over een foto: `Scrim` (`components/Scrim.tsx`). Geen schaduw —
die staan niet in dit systeem — maar een verloop in twaalf stappen. Drie
gestapelde vlakken, zoals het eerder ging, zie je als drie banden.

### Rubriekkoppen

De kop van een rubriek is een nummer, een woord en een lijn
(`components/SectionBand.tsx`) — samen de inhoudsopgave van de uitgave: in
één oogopslag zie je hoeveel rubrieken er zijn en waar je bent.

Geen vlak en geen eigen kleur. Dat is geprobeerd (volle gekleurde balken,
naar het voorbeeld van een inhoudsopgave die daaruit bestaat) en het deed
het werk wel, maar het bracht een tweede palet mee op een pagina die het
met lavendel, inkt en één rood afkan — en dan is de kop het luidste wat er
staat terwijl de vondsten eronder het onderwerp zijn.

---

## 5. Paginaopbouw

Elk v3-scherm heeft dezelfde ruggengraat:

```tsx
<SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
  <PageScroll wide={wide} {...chrome}>
    …inhoud…
  </PageScroll>
</SafeAreaView>
```

- `useChromeScroll()` levert de scroll-props en de inklapstand.
- `PageScroll` (uit `components/AppChrome.tsx`) is de scroller van de hele
  pagina; de kop staat eráchter, absoluut verankerd.
- De **grote kop staat alleen op de thuispagina** (`/feed`). Daar is het merk
  het onderwerp; overal elders is de pagina zelf het onderwerp. Elk ander
  scherm — de andere tabbladen én de detailpagina's — geeft `compact` mee en
  begint én blijft in de zwarte balk. Op detailpagina's vervangt een
  terug-knop de tabstrip binnen die balk.
- Onder 560px toont de compacte balk iconen in plaats van woorden: hij is de
  enige navigatie in de app, en vijf woorden passen naast het merk niet op
  een telefoon.
- Er is **geen** breedtebeperking. `ScreenContainer` (600px-kolom) is het
  oude patroon; nieuwe schermen gebruiken het niet.

---

## 6. Beweging

Zie `lib/page-transition.*` en de keyframes in `app/+html.tsx`.

| Waar | Wat |
|---|---|
| Paginawissel | Kruisvervagen + 12px stijging, 320ms, `cubic-bezier(0.22, 1, 0.36, 1)` |
| Terug | Dezelfde beweging, van de andere kant |
| Feed → post, events → event | Gedeelde-element-morph van het beeld, 520ms; de pagina blijft dan stil |
| De kop | Morpht mee bij élke navigatie, 380ms: de grote kop van de feed krimpt naar de balk in plaats van eronder weg te vallen |
| `prefers-reduced-motion` | Alles uit, directe wissel |

Eén beweging tegelijk. Morpht er een beeld, dan schuift het blad niet mee.

---

## 7. Wat NIET te doen

- Geen `rounded-2xl`/`rounded-3xl`/pillen. Vierkant.
- Geen schaduwen.
- Geen hex-waarden inline. Altijd een token uit §2.
- Geen `flame` op kleine tekst — dat is `flame-deep`.
- Geen warm oranje buiten de aankondigingsbalk.
- Geen `text-white`/`text-black`. Gebruik `text-cream` of `text-ink`.
- Geen `text-cream` op een kaart of een §8-blad — dat is `text-feed-text`
  respectievelijk `text-desk-ink`. Zie het kader in §2.
- Geen vulling onder een kaart. Hiërarchie komt uit lijn en inspringing —
  §4. Een gevuld vlak is de primaire actie, en verder niets.
- Geen `feed.text` op een foto of op een gevulde donkere knop. Dat is
  `creamOnDark`.
- Niets nakijken in één stand. Wat in de donkere klopt kan in de lichte
  onzichtbaar zijn, en andersom.
- Geen tweede navigatiebalk: de navigatie zit in de kop (`AppChrome`).

---

## 8. Wat nog niet gemigreerd is

Ongeveer twintig schermen draaien nog op het oude patroon
(`ScreenContainer`, 600px-kolom, pre-v3-vormen). Ze werken, maar ze volgen
dit document niet. Onder meer: `profile-edit`, `group/[id]`,
`group-create`, `event-create`, `post-compose`, `list/[id]`,
`qr-code`, `set-password`, `device-link`, `invite-email`.

Ze zijn wél op de twee standen gezet: hun zwarte paginavlak leest nu
`bg-desk` in plaats van `bg-shell`, en hun tekst `text-desk-ink` in plaats
van `text-cream`. Dat paar kantelt samen (zie §2), dus in de donkere stand
zijn ze exact wat ze waren en in de lichte stand worden ze een blad met
inkt erop. Dat is geen migratie — het is alleen niet-zwart-zijn.

Raak je zo'n scherm aan voor iets anders, migreer het dan meteen naar §5 —
dat is goedkoper dan een aparte migratieronde. Bij zo'n migratie
verdwijnen de `desk-*`-tokens vanzelf: een §5-scherm staat op `bg-page`
met `text-ink`, en die kantelen niet.
