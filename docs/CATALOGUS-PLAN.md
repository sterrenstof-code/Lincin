# Catalogus (ontwerp 3e) — plan

Het derde thema naast magazine en modern. Bron: `design_handoff_lincin_3e/`
(19 schermen, licht en donker; de HTML is de bron van waarheid voor maten
en kleuren).

Dit plan is geschreven nadat het gereedschap en de home al stonden (zie
het verslag); het beschrijft de hele opbouw.

## Hoe het thema in de app hangt

- `lib/design/theme.ts`: `"catalogus"` in `LincinTheme`/`THEMES`, een
  `SPEC`-regel (`layout: "catalogus"`, `nav: "tabbalk"`, naad 2, geen
  ronding) en `CATALOGUS` met de hexwaarden uit `tokens.json`. Het palet op
  de gedeelde tokens (`CATALOGUS_LIGHT/DARK`) zorgt dat schermen zonder
  catalogusvorm erbij passen.
- `profiles.theme` kent `catalogus` niet (`profiles_theme_check`, 0067) en
  `supabase/` blijft onaangeroerd: de keuze blijft op het toestel en gaat
  niet naar het profiel. Een migratie die `catalogus` toestaat is nodig om
  hem tussen toestellen te delen.
- Elk scherm hieronder kiest bovenaan: `theme === "catalogus" && !desktop`
  → de catalogusweergave; anders blijft alles zoals het was. Desktop houdt
  zijn eigen vorm.
- De onderdelen staan in `components/lincin/catalogus/`: presentatie in
  `schermen/*View.tsx` (alleen props), de koppeling met echte gegevens in
  `schermen/*Catalogus.tsx` (hooks), zodat de testpagina's precies dezelfde
  onderdelen tonen als de echte schermen.

## Per ontwerpscherm

| Nr | Ontwerp | Vervangt / breidt uit | Gegevens | In het ontwerp, niet in de app | In de app, niet in het ontwerp |
|---|---|---|---|---|---|
| 01 | Home | `app/(app)/feed.tsx` (naast `FeedModern`/`FeedMagazine`) | `useFeed()`: `cards`, `heroPost` (uitgelicht), `edition`, `openPost`, `reactions` (hartje = `toggle(id, "❤️")`), `compose`; `useUnread()` voor ✳ en de tabbalk | — | weergaven (editie/vrienden/tijd), vrienden open/dicht, "gelezen" dimmen: één weergave, dus niet getoond |
| 02 | Gesprekken | `app/(app)/chats.tsx` | `["chats"]` → `listMyChats`, `useChatPreviews`, `unread_count`, `shortAgo` | — | "nieuwe groep", lincs zonder gesprek, lang drukken (gelezen/ongelezen) |
| 03 | Events | `app/(app)/events.tsx` | `listMyEvents`, `getProfiles`, `useEventRsvps` (`mine`, `answer(id,"yes")`) | — | "misschien", eventcode delen, een nieuw event plannen (bereikbaar via +) |
| 04 | Jij | `app/(app)/profile.tsx` | `getProfile`, `listUserPosts`, vriendschappen, `session.user.created_at` | "Thema en stand" als eigen ingang (gaat naar de instellingen) | meldingen-ingang, QR-code |
| 05 | Bijdrage | `app/post/[id].tsx` | `getPost`, `fromPost`, `usePostLikes`, `useComments` | — | emoji-lade, bewerken/verwijderen eigen bijdrage (in het menu), "◷ event" |
| 06 | Profiel van een vriend | `app/user/[username].tsx` | `getProfileByUsername`, vriendschap (`accepted_at` = "sinds"), `listUserPosts` | — | verzoek sturen/intrekken/accepteren (alleen getoond als je nog geen linc bent) |
| 07 | Open gesprek | breidt `app/chat/[id].tsx` uit: kop, berichten (wit van de ander, inkt van jou), gedeelde bijdrage, spraakbericht en invoer in catalogusvorm; ontsleutelen, realtime en versturen blijven waar ze zijn | `fetchMessages`, `subscribeToChatMessages`, `sendMessage`, gelezen-stand, `PostRefCard`-gegevens, `VoiceMessageBubble` | — | bijlagen, peilingen, plekken, belafspraken, reacties op berichten: in de bestaande vorm, op het cataloguspalet |
| 08 | Meldingen | `app/(app)/notifications.tsx` | `listNotifications`, `describe`, `destinationFor`, `markAllNotificationsRead` | knoppen in de regel (Ik kom / Kan niet, Accepteer / Negeer): de app kent geen uitnodigings- of vriendverzoekmelding | — |
| 09 | Nieuwe bijdrage · soort | `app/post-compose.tsx` | `useCompose()` | kleur, plek, spraak als soort om te maken: de app kan die niet plaatsen (`SUPPORTED`) | krabbel |
| 10 | Nieuwe bijdrage · foto | `app/post-compose.tsx` | `useCompose()`: `imageUris`, `title`, `caption`, `audience`, `publish` | "Reacties toegestaan": bestaat niet | meer foto's (album), kleur kiezen |
| 11 | Instellingen | `app/settings.tsx` | thema, stand, taal, pushvoorkeuren, sleutel/herstel, uitloggen | "Geblokkeerd": bestaat niet; "Versie": uit `expo-constants` | standaard open, app-slot, toestel koppelen, lijsten |
| 12 | Mijn lincs | `app/(app)/friends.tsx` | `useFriendsModel().accepted`, nieuw per linc uit de feed (`cards` per `authorId`) | — | zoeken, verzoeken, delen (achter +) |
| 13 | Home leeg | 01 zonder bijdragen | `useFeed().empty` | — | — |
| 14 | Leuk gevonden | toestand van 05 | `usePostLikes().liked/count/reactors` | — | — |
| 15 | Draad en antwoord | toestand van 05 | `useComments`: `roots`, `repliesOf`, `likesOf`, `toggleLike`, `send({parentId})` | — | — |
| 16 | Menu | toestand van 05 | `PrivateSheet`/gesprek, `deletePost`, `EditPost` | "Demp Mie een week", "Meld deze bijdrage", "Verberg deze bijdrage": bestaan niet voor bijdragen | bewerken/verwijderen van je eigen bijdrage |
| 17 | Lang drukken | toestand van 01 | `reactions.toggle`, `openPost`, `privateAbout` | — | — |
| 18 | Home met hartje | toestand van 01 | `reactions.grouped` | — | — |
| 19 | Soorten inhoud | de voorwerpen per soort, in elk raster | `CardMedia` (`lib/lincin/model.ts`), `usePoll().vote`, muziek via `openExternal` | spraak afspelen: een spraakbijdrage heeft in de app geen geluid (alleen in gesprekken) | video (getoond als foto), album |

## Regels die uit de beelden niet blijken

- Tikken op een heel vak opent de bijdrage; geen aparte knop.
- Reacties staan op dezelfde pagina als de bijdrage (05, 14, 15).
- Eén weergave op de home. Scherm 18 is een toestand, geen schakelaar: wie
  op de home iets leuk vond (dubbel tikken op het beeld, of het hartje na
  lang drukken) ziet daarna in elk vak het hartje en de reacties.
- ✳ is het pictogram voor meldingen, met een vierkantje in de accentkleur.
- Een linc zonder foto: een vierkant in zijn eigen kleur (één van de zeven
  uit `tokens.json`, vast per id) met zijn initiaal.
- Geen emoji als pictogram (hartje en ballon zijn getekend), rechte hoeken,
  raakvlak minstens 44.
- [n], [datum], [naam]: in de app echte gegevens; alleen de testpagina's
  tonen de haken, letterlijk zoals het ontwerp.

## Gereedschap

- `app/dev/catalogus/[scherm].tsx`: elk scherm met vaste
  voorbeeldgegevens, `?stand=licht|donker`. Alleen met `__DEV__`.
- `npm run catalogus:vergelijk`: zie het kopcommentaar van
  `scripts/catalogus-vergelijk.mjs`.
