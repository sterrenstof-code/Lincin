# Claude Code — opdracht: Lincin 2.2 (mobiel + desktop)

Je werkt in `comm-app` (Expo / React Native + web, Supabase). Voer designronde 2.2 door: **drie thema's — Kleur, Magazine, Modern — op elk scherm, mobiel én desktop.** Lees eerst, bouw daarna.

## 1 · Lees in deze volgorde
1. `design_handoff_lincin_mobile/WIJZIGINGEN-2.2.md` — de delta 2.1 → 2.2 met alle waarden. Overschrijft HANDOFF.md waar ze verschillen.
2. `design_handoff_lincin_mobile/HANDOFF.md` — volledige specificatie 2.1 (schermen, routering, datamodel, mediasoorten, i18n). Alles daarin geldt nog.
3. `LincinApp.dc.html` — mobiel prototype, bron van waarheid (402 × 874). Template, logica en NL/EN/DE-woordenboeken in één bestand.
4. `Lincin Desktop.dc.html` — desktop prototype, nu met dezelfde drie thema's.
5. `Lincin Magazine Navigaties.dc.html` — vijf navigatievarianten; **1d (rugstrook)** is gekozen en staat al in het prototype.

Neem waarden letterlijk over: kleuren, maten, spatiëring, tekst. Verzin niets dat de prototypes niet tonen — vraag het liever.

## 2 · Wat je NIET doet
- Geen HTML-runtime porten (`support.js`, `image-slot.js`, `ios-frame.jsx`).
- Geen nieuwe schermen of features. 2.2 is een skin- en navigatieronde; schermvoorraad (11), routering, datamodel en sessiestatus blijven.
- De ademende tintlaag en de oude icoon-tabbalk niet terugbouwen.

## 3 · Het uitgangspunt: één tokenstelsel, drie thema's
Beide prototypes werken met **CSS-variabelen op de root** (`data-thema` × `data-stand`). Neem dit model over: één themaobject, elk scherm leest alleen tokens, nergens een hardgecodeerde kleur, randdikte of lettertype.

**Kleurtokens** (licht / donker):
| token | kleur | magazine | modern |
|---|---|---|---|
| `paper` | #F6F3ED / #1A1917 | #F7F4EE / #14120E | #F4F1EB / #0C0C0D |
| `paper2` | #EFEBE3 / #211F1B | #F1EDE3 / #1B1813 | #EAE7DF / #151517 |
| `ink` | #231F1A / #EDE8DC | #16160F / #EFE7D6 | #17170F / #EFECE6 |
| `dim` | ink 56 % | ink 52 % / 54 % | ink 56 % / 58 % |
| `rule` | ink 13 % | ink 13 % / 14 % | ink 12 % / 14 % |
| `accent` | — | #F06A2B / #D9A05B | #17170F / #EFECE6 |
| `red` | — | #C2604E | #C0503A / #E4674E |

**Vormtokens**:
| token | kleur | magazine | modern |
|---|---|---|---|
| randdikte `bw` | 1.5px | 1px | 1px |
| randkleur `bc` | ink | ink | rule |
| radius `r` | 0 | 0 | 14px (mobiel 18px op tegels) |
| naad `gap` | 10px | 6px | 6px |
| kaartvlak `card` | paper | paper | rgba(255,255,255,.82) / rgba(24,24,26,.9) |
| kaartrand `cardbd` | 1.5px ink | 1px ink | geen |
| lijstnaad `listgap` | 1px haarlijn | 1px haarlijn | 6px, geen haarlijn |

**Typografietokens** — één schaal, drie invullingen. Kleur = Archivo 900 condensed (stretch 72–75 %) uppercase; Magazine = Instrument Serif regular, gemengde kast, ±20 % groter; Modern = Archivo 500, gemengde kast, normale breedte. Definieer per maat (`h11 h12 h15 h18 h19 h26 h30 h34 h44 h52`) plus `hstr` (stretch), `htt` (transform), `hf` (koplettertype) en `capf` (onderschrift: serif in Kleur/Magazine, Archivo in Modern). Meta blijft overal IBM Plex Mono 8–10 px, `letter-spacing` .14–.24em, uppercase.

## 4 · Mobiel — volgorde van werken

**Stap 1 — tokens + ThemeProvider.** `theme: 'kleur' | 'magazine' | 'modern'`, drie opties in Instellingen, bewaard op `profiles.theme` met lokale cache. Een keuze van de gebruiker wint altijd van een standaard- of externe waarde; wisselen zonder herladen. Dit was stuk in 2.1 — test het expliciet.

**Stap 2 — gedeelde chrome.**
- Terugknop in de kopregel, links, op elk subscherm (bijdrage, profiel, gesprek, instellingen, meldingen, nieuwe bijdrage): rond, 44 px, inktvlak, papierkleurige pijl. Verwijder de losse "← terug"-regels.
- Modern-kopregel rechts: twee ronde knoppen van 44 px op tegelvlak — meldingen (bel + rode stip) en nieuwe bijdrage (plus).
- Fade van 18 px bovenaan elke hoofdscroller.
- Navigatie altijd zichtbaar, boven inhoud en korrellaag.
- "Trek om te vernieuwen" alleen tijdens trekken (scroll < 44 px) of verversen.

**Stap 3 — Modern als bento-rooster.** 2 kolommen, gap 6, buitenmarge 6, tegels radius 18, binnenpadding 18–22. Elke pagina opent met een titeltegel over twee kolommen: kop 30 px Archivo, teller rechts in mono. Scheidingen bínnen een tegel gestippeld (`1px dashed ink 26 %`), nooit een harde rand. Bouw: feed → gesprekken → events → jij → meldingen → instellingen.

**Stap 4 — Magazine als poster-spreads.** Omslag en hero blijven. Daaronder per item een volvlaks kleurvlak, naad 6 px, verticale metarail van 26 px (Archivo 8 px, .24em, uppercase) die per item van kant wisselt, serif-kop, cursief onderschrift. Hoogtes wisselen (elk derde item hoog): feed 228/300, events 212/258, gesprekken 146/182, meldingen 126/158. Feed heeft een beeldkolom van 138 px; niet-fotobijdragen tonen hun eigen preview op papier (golfvorm, pollbalken, plattegrondraster, tekstfragment). **Elk kleurvlak draagt de bijbehorende inktkleur van die vriendkleur** — nooit de globale inkt op een kleurvlak.

**Stap 5 — navigatie Magazine (1d).** Vier tegels, `repeat(4,1fr)`, gap 6, padding `6 6 28`, hoogte 58. Actieve tegel in de kleur van de pagina (vriendkleur in beeld, anders inkt), inactief op paper2. Woord onderaan uitgelijnd: actief Instrument Serif 17 px cursief, inactief 15 px op 62 %. Rode stip van 5 px bij ongelezen gesprekken.

**Stap 6 — Kleur.** Achtergrond is kleur als licht van boven: vriendkleur bovenaan, uitdovend naar papier met stops op 0 %, 18 %, 42 % (halve tint), 72 %. De tweede kleurband onderin vervalt.

## 5 · Desktop — zelfde tokens, alle schermen
`Lincin Desktop.dc.html` draagt nu dezelfde drie thema's; schakelaar in de rail onder taal en licht/donker.

- **Alle** schermen lezen de tokens: feed, bijdrage op volle breedte, gesprekken (lijst + thread), profiel, events, jij, nieuwe bijdrage. Geen scherm mag een eigen lettertype, randdikte of radius hardcoderen — dat was de fout die we eruit hebben gehaald.
- Bento-rooster van de feed blijft (12 kolommen, vaste patronen per groepsgrootte); alleen naad en kaartvorm volgen het thema.
- Vriendenband: naam volgt de kopschaal; in Modern krijgt de band radius en 6 px zijmarge zodat hij als tegel leest.
- Chatlijstrijen: in Kleur/Magazine haarlijn tussen de rijen, in Modern 6 px naad, radius en geen haarlijn; de kleurrug van 10 × 38 px volgt de radius.
- Alleen Kleur tint de achtergrond met de vriend in beeld; Magazine en Modern staan op papier.
- Kaartrug 34 px in Kleur/Magazine, 26 px in Modern.
- Scrollfade van 18 px bovenaan de feed.

## 6 · Teksten
Verwijder "privaat"/"privé" overal: "Privaat bericht" → **"Bericht"**, "Privégesprek" → **"Gesprek"**, label "Privaat" → **"Bericht"**, melding "begon een privégesprek" → "begon een gesprek". In NL, EN en DE, mobiel én desktop. Magazine-lijstrijen krijgen naast "Bericht" ook "Comment" met het aantal reacties. **Open vraag:** moet "Comment" in NL "Reactie" worden? Vraag dit voordat je vertaalt.

## 7 · Kwaliteitseisen
- Raakvlakken minimaal 44 px; kleinere zichtbare vorm mag, met het raakvlak op een wrapper en compenserende negatieve marge.
- Tekstcontrast minimaal 4,5:1 — ook mono-labels van 8 px op kleurvlakken. Op elk gekleurd vlak de bijbehorende inktkleur gebruiken.
- Drie thema's × licht/donker × alle schermen werken. Licht/donker volgt standaard het toestel, met override in Instellingen.
- Vergelijk mobiel op 402 × 874 met het prototype; desktop bij 1280 en 1600 breed.
- Zoek na afloop het hele project af op hardgecodeerde hex-kleuren, `Instrument Serif`, `Archivo 900` en radiuswaarden buiten het tokenstelsel; die horen er niet meer te staan.

## 8 · Oplevering
Per stap een commit met een korte samenvatting. Meld aan het eind welke punten je hebt moeten interpreteren en wat nog open staat.
