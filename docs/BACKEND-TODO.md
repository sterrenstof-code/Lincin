# Wat de backend nog moet leveren (handoff 23 sep)

Bij het nabouwen van de prototypes in `lincin-handoff/` bleek een deel van
de voorbeelddata niet in de app te zitten. Waar dat zo is, toont de app
níets (geen verzonnen tekst). Hieronder wat er was, en wat ermee gebeurde.

## Feed

| Wat het prototype toont | Stand |
|---|---|
| Een regel over de vriend ("Fotografeert dijken…"), desktop magazine, Per vriend | **Geleverd.** `profiles.bio` kwam al mee met de feed (`getProfiles`); hij loopt nu door als `CardPost.authorBio` en `FriendGroup.bio` (eerste regel, zonder markdown, `bioLine` in `lib/lincin/model.ts`). |
| Editienummer "№ 38" | **Geleverd.** Een teller per gebruiker in `user_prefs.prefs.edition`: de hoeveelste dag dat je Lincin opent. Hij telt verder op een tweede toestel. Bestaande gebruikers beginnen bij № 1. |
| "Groep · 6 lincs" op de band van een groep | **Niet van toepassing.** De feed bevat geen groepsbijdragen: elke band is één persoon (`groupByFriend` zet `isGroup` altijd op `false`). Groepen bestaan alleen als gesprek. Komen er ooit bijdragen in een groep, dan moet de feed-rij het aantal leden meekrijgen. |

## Events

| Wat het prototype toont | Stand |
|---|---|
| "Ik kom" / "Misschien" en wie er komt ("jij, Noor, Sem") | **Geleverd.** Tabel `event_rsvps` (0072): één antwoord per lid per event, leesbaar voor leden en host (`lib/api/event-rsvps.ts`). Wie "ik kom" zei, staat bij het event; zonder antwoorden het aantal leden. |
| De plek ("◎ Marken") | **Geleverd.** `events.place` (0073, vrije tekst, hoogstens 80), een veld "Plek" bij Nieuw event, en mee in `list_my_events` / `get_event_meta`. Oudere events zonder plek tonen de eerste regel van hun beschrijving. |
| Wie uitnodigt ("Noor nodigt uit") | **Geleverd** uit bestaande data: de naam van de host via `getProfiles`. |

## Voorkeuren

`user_prefs` (migratie 0070) bewaart per gebruiker de weergave van de feed,
welke vrienden open staan, de taal, de schakelaars van Instellingen en het
editienummer. De gelezen-status blijft bewust lokaal (`lib/read-state.ts`):
op de server zou het een leesbevestiging worden.
