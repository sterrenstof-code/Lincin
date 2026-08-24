# Lincin Design System — v3

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

Er zijn precies twee bronbestanden. Verandert er iets aan kleur of
typografie, dan gebeurt dat daar en nergens anders.

| Bestand | Wat erin staat |
|---|---|
| `tailwind.config.js` | De kleurtokens voor **klassen** (`bg-page`, `text-ink`) |
| `lib/design/type.ts` | Dezelfde kleuren als **props** + de hele typeschaal |

Waarom twee: NativeWind-klassen dekken achtergronden en tekst, maar een
`Ionicons`-kleur, een `tintColor` of een `borderColor` in een style-object
moet een echte waarde zijn. Die twee mogen **nooit** uit elkaar lopen — dat
was eerder wél zo (twee zwarten, vier hexpunten uit elkaar) en het is
onzichtbaar tot het niet meer klopt.

---

## 2. Het palet

Lavendel/plum met inkt, en één scherp drukwerkrood. Geen warme tinten meer
behalve in de aankondigingsbalk.

### Vlakken
| Token | Waarde | Waarvoor |
|---|---|---|
| `page` | `#CDBEE3` | Het paginavlak — lavendel |
| `page-alt` / `paper-soft` | `#EFE9F5` | Lichter paneel, beeldkaders |
| `paper-warm` | `#BFACDB` | Iets dieper lavendel, voor banden |
| `paper-light` | `#F5F1FA` | Bijna wit met een lila zweem |
| `shell` | `#0B0A0C` | De donkere omlijsting |
| `shell-soft` / `feed-post` | `#2E2138` | Élk donker kaartoppervlak — plum |

### Tekst
| Token | Waarde | Waarop |
|---|---|---|
| `ink` / `carbon` | `#0B0A0C` | Op lavendel |
| `ink-soft` | `#3A3540` | Secundair |
| `ink-muted` | `#6B6474` | Tertiair |
| `cream` / `feed-text` | `#F3EDE4` | Op inkt of plum |
| `feed-textDim` | `rgba(243,237,228,0.62)` | Bijschrift op plum |

### Accent
| Token | Waarde | Regel |
|---|---|---|
| `flame` | `#E63329` | Citaten, indexcijfers, vullingen, lijnwerk |
| `flame-deep` | `#A81C13` | **Alles onder ~16px** — de DEFAULT haalt op lavendel geen 4.5:1 |
| `announce` | `#E66B3F` | Uitsluitend de aankondigingsbalk. Nergens anders. |
| `brand` | `#5B8DEF` | Alleen het logo en de e2e-badge |
| `teal` / `gold` | `#4FBDB0` / `#E3A84B` | Alleen de tegels in de feed |

`flame` en `announce` hebben bewust aparte namen zodat een zoek-vervang op
het rood de oranje balk niet meeneemt.

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

- **Alles is vierkant.** Geen `rounded-*` behalve `rounded-full` voor
  avatars. De pillen van het oude systeem zijn weg.
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
- Geen hex-waarden inline. Altijd een token uit §1.
- Geen `flame` op kleine tekst — dat is `flame-deep`.
- Geen warm oranje buiten de aankondigingsbalk.
- Geen `text-white`/`text-black`. Gebruik `text-cream` of `text-ink`.
- Geen tweede navigatiebalk: de navigatie zit in de kop (`AppChrome`).

---

## 8. Wat nog niet gemigreerd is

Ongeveer twintig schermen draaien nog op het oude patroon
(`ScreenContainer`, 600px-kolom, pre-v3-vormen). Ze werken, maar ze volgen
dit document niet. Onder meer: `profile-edit`, `group/[id]`,
`group-create`, `event-create`, `post-compose`, `list/[id]`,
`qr-code`, `set-password`, `device-link`, `invite-email`.

Raak je zo'n scherm aan voor iets anders, migreer het dan meteen naar §5 —
dat is goedkoper dan een aparte migratieronde.
