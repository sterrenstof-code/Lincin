# Catalogus op desktop — plan

Tak `thema-catalogus`. Stand 10 november 2026. Hoort bij
`design_handoff_lincin_3e/desktop/` (briefing, prototype, staten.json).

## Wanneer de desktopvorm geldt

`useCatalogusDesktop()` (nieuw, `components/lincin/catalogus/desktop/scherm.ts`):
thema catalogus, web, en venster vanaf 1024 breed. `useIsDesktop()` blijft
`false` voor catalogus, zodat magazine- en moderndesktop er niets van merken.

`app/_layout.tsx` zet catalogus op een breed scherm nu altijd in de kolom van
430. Dat blijft voor de schermen die op desktop niet ontworpen zijn (Jij,
Meldingen, Nieuwe bijdrage en alles daarachter). Voor Feed, Gesprekken, Events,
een bijdrage (`/post/[id]`) en een gesprek (`/chat/[id]`) gaat de kolom open
naar de volle breedte. Dezelfde twee `View`s blijven staan en alleen hun breedte
wisselt, zodat de navigator niet opnieuw begint.

## Hoe het getekend wordt

De desktopweergaven zijn webonderdelen: gewone DOM-elementen met één
stijlblad (`desktop/stijl.ts`). Ze bestaan alleen op web (zie hierboven), en
alleen zo zijn de overgangen, `:hover`, `filter`, de keyframes en
`prefers-reduced-motion` exact de waarden uit de briefing. De maten en het
gedrag komen uit het prototype, de opbouw niet: het zijn React-onderdelen
met props, geen HTML-strings.

De letter is `Archivo Latijn` (dezelfde bestanden als mobiel), daarna
`system-ui`, net als het prototype. De kleuren zijn de hex uit `CATALOGUS`
(tokens.json) als CSS-variabelen op het kader, per stand.

## Per weergave

| Weergave | Hergebruikt | Nieuw |
|---|---|---|
| `wand` | `useFeed`, `titelVan`/`datumVan`/`soortVan` (kaart.tsx), `CardVoorwerp` voor stukken zonder foto | `Wand` (de wand met schuiven, wiel, ← →), de bovenbalk `Kop` |
| `blad` | als wand; de wand zelf is hetzelfde onderdeel | `Blad`: tafel, tabbladen, het blad met zijn eigen kop |
| `lichtbak` | als wand | `Lichtbak`: drie kolommen en de strook; `Kleurveld` |
| `gloedraster` | als wand | `Gloedraster`; `Kleurveld` |

Gedeeld door alle vier:

- `FeedDesktop`: de toestand (gekozen, open, menu), de toetsen, en welk kader
  en welke weergave er staan. De weergaven leveren alleen hun opstelling en een
  verwijzing naar de foto van het gekozen stuk.
- `useNaarMidden` (één hook): meet de foto en het vlak van de weergave en geeft
  de verschuiving en schaal die de foto naar het midden van de vrije ruimte
  links van het paneel brengen (briefing §4, schaal per weergave). Wand en blad
  passen de horizontale verschuiving toe op de hele wand ("de wand schuift naar
  het gekozen stuk") en de rest op de foto; de andere twee alles op de foto.
- `Paneel`: één onderdeel, 440 breed, over de volle hoogte, één vlak dat als
  geheel in- en uitschuift.
- `WeergaveKnop`: de knop en het menu, in de bovenbalk of onderaan de
  tabbladen.
- `Kleurveld`: twee lagen die kruisen, voor lichtbak en gloedraster.

**Vertikaal midden bij wand en blad.** Het prototype rekent daar de hoogte van
de foto vanaf de bovenkant van het stuk en niet van de wand, waardoor de foto
6vh (54 px) onder het midden eindigt. Bij lichtbak en gloedraster klopt het
wel. De briefing (§4: "horizontaal en verticaal") en het gedragsscript vragen
het midden. Ik volg de briefing. Daardoor wijken `wand-open`,
`wand-open-donker` en `blad-open` 54 px af van hun PNG. Dat staat straks in het
verslag, met de verschilbeelden.

**Sluiten bij wand en blad.** De wand schuift bij sluiten terug naar waar hij
stond, zodat de foto terug op zijn plek staat (briefing §4, "de foto krimpt
terug naar zijn plek"). In het prototype blijft de wand staan.

## Waar de keuze van de weergave wordt bewaard

Op dezelfde manier als het thema catalogus: op het toestel, per gebruiker,
in `localStorage` (`lincin.weergave.<gebruiker>`). Ik lees het synchroon, zodat
het eerste beeld meteen goed is. Standaard is `wand`. Het thema catalogus zelf
staat ook alleen op het toestel, omdat de database `catalogus` niet kent (zie
CATALOGUS-VERSLAG §3). `user_prefs` zou ook kunnen zonder migratie, maar dat
vraagt een wijziging in `lib/lincin/prefs.ts`, en daar staan niet-gecommitte
wijzigingen van de eigenaar. De keuze geldt alleen in `FeedDesktop`, dus
alleen op desktop en alleen in catalogus.

## Een geopend stuk en de route van een bijdrage

- Op `/feed` opent een klik het stuk in de feed zelf. De URL verandert niet,
  zodat de overgang niet onderbroken wordt door een nieuw scherm.
- `/post/[id]` (een gedeelde link, een melding) toont op desktop dezelfde
  `FeedDesktop` in de gekozen weergave, met dat stuk open. Sluiten speelt de
  overgang af en gaat daarna naar `/feed` (`replace`). De stand van de wand
  wordt buiten het onderdeel bewaard, zodat hij niet terugspringt.
- Het paneel gebruikt de inhoud van de bijdragepagina van catalogus. Die haal
  ik uit `BijdrageCatalogus` in een hook, `useBijdrage(id)`: dezelfde query's,
  likes, reacties, antwoorden, concept en privébericht. Mobiel tekent die hook
  met `BijdrageView` (ongewijzigd), desktop met `Paneel`, zonder het beeld.
- Antwoorden: een klik op een reactie maakt er een antwoord van. Boven het
  invoerveld komt dan een regel "Antwoord aan … ✕". In rust is het paneel
  precies het ontwerp.

## Gesprekken en Events

`app/(app)/chats.tsx` en `events.tsx` rekenen hun rijen voor catalogus al uit.
Daar komt een tak bij voor desktop, die dezelfde rijen aan
`GesprekkenDesktop` en `EventsDesktop` geeft, binnen het kader van de gekozen
weergave (bovenbalk, of de tabbladen met het blad). Het gesprek in het midden
is de bestaande draad (`ChatDetail` ingebed, versleuteling en al). De
testpagina toont de ontwerpvorm met vaste berichten. `/chat/[id]` toont op
desktop Gesprekken met dat gesprek gekozen.

## Testpagina's en gereedschap

- `app/dev/catalogus-desktop/[staat].tsx`, alleen in `__DEV__`, zoals de
  mobiele route. De voorbeeldgegevens volgen het prototype letterlijk (acht
  stukken, beelden uit `desktop/prototype/img/` naar
  `assets/catalogus-desktop-voorbeeld/`).
- `scripts/catalogus-vergelijk.mjs --desktop`, en
  `npm run catalogus:vergelijk:desktop`.
- `scripts/catalogus-desktop-gedrag.mjs`, het gedragsscript.

## Niet aangeraakt

`supabase/`, versleuteling, magazine en modern. Jij, Meldingen en Nieuwe
bijdrage houden op desktop de kolom.
