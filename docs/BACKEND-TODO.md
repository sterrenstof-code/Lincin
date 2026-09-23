# Wat de backend nog moet leveren (handoff 23 sep)

Bij het nabouwen van de prototypes in `lincin-handoff/` bleek een deel van
de voorbeelddata niet in de bestaande API te zitten. Waar dat zo is, toont
de app nu níets (geen verzonnen tekst); hieronder staat wat er nodig is om
het ontwerp volledig te vullen.

## Feed

| Wat het prototype toont | Waar | Nu | Nodig |
|---|---|---|---|
| Een regel over de vriend ("Fotografeert dijken en alles wat om half elf nog licht geeft.") | desktop magazine, Per vriend, links in elk hoofdstuk | leeg (groepen: "groep") | `bio` van de auteur mee in `listUnifiedFeed` (staat al op `profiles.bio`, zit niet in de feed-rij) |
| "Groep · 6 lincs" | band van een groep, alle thema's | alleen "groep" | aantal leden van de groep in de feed-rij |
| Editienummer "№ 38" | desktop kop en balk | weggelaten | een teller per gebruiker (bv. het aantal bezoeken sinds de eerste bijdrage) — of het ontwerp laat hem vallen |

## Voorkeuren — geleverd

`user_prefs` (migratie 0070) bewaart per gebruiker de weergave van de feed,
welke vrienden open staan, de taal en de schakelaars van Instellingen. De
gelezen-status blijft bewust lokaal (`lib/read-state.ts`): op de server zou
het een leesbevestiging worden.
