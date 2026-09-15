# Lincin — Test plan

Pragmatische aanpak voor een MVP voor vrienden & familie. Vijf lagen, in volgorde van belangrijkheid. Loop ze door voor je naar productie deployt, en herhaal de eerste twee voor elke significante wijziging.

| Laag | Wat | Frequentie | Tijd |
|------|-----|-----------|------|
| 1 | Manual smoke checklist | Voor elke deploy | 15-20 min |
| 2 | Crypto-roundtrip (geautomatiseerd) | Voor elke crypto-wijziging | 5 sec |
| 3 | RLS isolatie-verificatie | Eenmalig + na schema-wijzigingen | 20 min |
| 4 | Performance check met realistische data | Eenmalig vóór alpha | 30 min |
| 5 | Alpha test met 1-2 vrienden | 1 week vóór bredere release | 1 week |

---

## Laag 1 — Manual smoke checklist

Vink af terwijl je doorgaat. Doe deze in **twee browservensters tegelijk**: normaal venster met je hoofdaccount, incognito venster met een tweede testaccount. Op die manier kan je realtime synchronisatie en perspectief-wisselingen direct verifiëren.

### Auth & onboarding

- [ ] Login-scherm laadt, logo en typografie correct
- [ ] E-mail met `@` ontbrekend → toont validatie-error in cream-text op paper-card
- [ ] Magic-link verstuurd → "Check je inbox" card verschijnt
- [ ] Mail komt binnen (in spam check)
- [ ] Klik in mail opent web → automatisch ingelogd
- [ ] Eerste login: profielrij wordt aangemaakt, keypair in IndexedDB/Keychain
- [ ] Profiel-tab toont email, handle (afgeleid van email), en X25519 pubkey
- [ ] Uitloggen werkt, daarna terug login-scherm

### Profielbewerking

- [ ] Profiel → Bewerk profiel → handle wijzigen naar leesbare naam, bewaren
- [ ] Validatie: handle < 3 chars → error; speciale tekens → error; reeds gebruikte handle → "Deze gebruikersnaam is al bezet"
- [ ] Display name aanpassen, bewaren → terug op profielscherm, nieuwe naam zichtbaar in hero

### Linking suite

- [ ] Profiel → "Deel link" → native share sheet opent (Mac/iOS) of clipboard fallback (Chrome on desktop)
- [ ] "Kopieer @" → clipboard bevat `@handle`, korte hint "Handle gekopieerd" verschijnt en verdwijnt
- [ ] "Kopieer link" → clipboard bevat volledige URL
- [ ] QR-code icoontje → opent QR-modal met groot Lincin-logo in het midden
- [ ] Vanuit tweede account: plak de share-URL → `/user/{handle}` scherm opent met "Voeg toe" knop
- [ ] Verzoek versturen → eerste account ziet badge op Vrienden-tab binnen 30 seconden
- [ ] Accepteren in eerste account → tweede account ziet "Stuur bericht" knop op profielpagina

### Vrienden

- [ ] Vrienden-tab: zoek met < 2 letters → geen resultaten
- [ ] Zoek met 2+ letters → vindt match, toont met avatar + handle, "Toevoegen" pill
- [ ] Inkomend verzoek → "Verzoeken voor jou (1)" sectie verschijnt met Accepteer + Weiger pillen
- [ ] Uitgaand verzoek → "Verzonden" sectie verschijnt met Annuleer-pill
- [ ] Geaccepteerde vriend → komt in "Jouw vrienden" sectie, Verwijder-actie werkt
- [ ] Tap op naam/avatar in elke sectie → opent `/user/{handle}` met de juiste relatie-status

### 1-op-1 chat

- [ ] Chats-tab → "Start een chat met X" rij toont vrienden zonder bestaande chat
- [ ] Tap op vriend → chat opent, header toont naam + "End-to-end versleuteld"
- [ ] Stuur bericht → verschijnt direct als donkere bubble rechts met tijd
- [ ] Tweede account ziet bericht realtime in paper-soft bubble links
- [ ] **Belangrijk**: in Supabase Table Editor → `messages` is `recipient_payloads` een base64-blob, niet leesbare tekst
- [ ] Typing indicator: typ in account A → account B ziet "X is aan het typen…" verschijnen
- [ ] Stop typen → indicator verdwijnt na ~4 sec
- [ ] Tap op header avatar/naam (direct chat) → `/user/{handle}` opent

### Groepchats

- [ ] Chats → rond zwart icoontje rechts naast filter → groep-creatie modal
- [ ] Geef naam, vink 2+ vrienden aan, "Aanmaken"
- [ ] Komt direct in chat-detail met "X leden • E2E" subtitle
- [ ] Info-cirkel rechts in header → groep-info scherm
- [ ] Owner: pencil naast naam → inline edit, bewaren werkt
- [ ] "Voeg toe" pill → add-members modal, alleen vrienden niet in groep zichtbaar
- [ ] Remove-icon naast lid → bevestigingsdialoog → lid is weg
- [ ] Niet-owner: geen pencil, geen remove-icons, geen "Voeg toe"
- [ ] Iedereen kan "Verlaat groep" gebruiken
- [ ] Berichten in groep: realtime bij alle deelnemers, in DB nog steeds ondoorzoekbare ciphertext

### Foto's & feed

- [ ] Feed → "Plaats een moment" → modal opent
- [ ] Kies foto uit galerij → preview verschijnt vierkant
- [ ] Caption tikken → 500 char counter live
- [ ] Plaatsen → terug op feed, post verschijnt bovenaan met avatar + "Jij" badge
- [ ] In Supabase Storage → `posts/{user_id}/{post_id}.jpg` staat de file
- [ ] Vanuit tweede account (vriend): zelfde post zichtbaar in hun feed
- [ ] Niet-bevriend derde account: post **niet** zichtbaar in hun feed
- [ ] Tap op foto → foto-detail opent
- [ ] Reactie schrijven → verschijnt onder de foto met avatar + tijd
- [ ] Tweede account ziet reactie realtime
- [ ] Reactie verwijderen werkt (auteur of post-owner)

### Ongelezen-teller

- [ ] Stuur uit account A een bericht in een bestaande chat
- [ ] Account B (niet in die chat actief): Chats-tab toont oranje badge "1" naast die chat
- [ ] Tap chat → badge verdwijnt direct
- [ ] Vrienden-tab: badge op de tab zelf telt openstaande verzoeken

### Visueel & polish

- [ ] Skeleton-animaties verschijnen kort bij first-load van feed/chats/vrienden
- [ ] Geen koud-blauwe kleuren ergens (alles paper-cream/ink/cream-on-shell)
- [ ] Geen kapotte layout bij smalle vensters (mobile-first design test)
- [ ] Geen unhandled promise warnings in browser console
- [ ] Tab-bar werkt vlot tussen Feed / Chats / Vrienden / Profiel

---

## Laag 2 — Crypto roundtrip (geautomatiseerd)

Dit is de **belangrijkste geautomatiseerde test**. Hij bewijst dat de E2E-encryptie wiskundig correct is. Eens dit slaagt, weet je dat berichten end-to-end versleuteld worden en alleen door de juiste ontvanger ontsleuteld kunnen worden — onafhankelijk van wat de UI doet.

```bash
cd "Comm project/comm-app"
npm run test:crypto
```

Wat hij test:

1. **1-op-1 roundtrip**: A versleutelt voor B → B kan ontsleutelen → plaintext matcht
2. **A kan niet ontsleutelen**: zelfs als A de ciphertext heeft, ontsleutelen met A's eigen sleutel faalt
3. **Multi-recipient (groep)**: A versleutelt voor B+C+D → elk kan alleen z'n eigen envelope ontsleutelen, niet die van een ander
4. **Tamper detection**: één byte van de ciphertext wijzigen → ontsleutelen faalt (auth tag mismatch)
5. **Tamper detection op nonce**: nonce wijzigen → faalt
6. **Unicode + lange berichten**: emoji en lange teksten gaan correct door

Het script exit met code 0 als alles slaagt, anders ≠ 0 zodat het bruikbaar is in CI later. Output toont per test case.

Loop dit altijd door na:
- Een wijziging in `lib/crypto/*`
- Een library upgrade (@stablelib of @supabase)
- Vóór elke productie-deploy

---

## Laag 3 — RLS isolatie-verificatie

Manueel maar essentieel. Database-permissies zijn de tweede verdedigingslinie: zelfs als een kwaadwillende gebruiker rauwe API-calls naar Supabase doet vanuit de browser-console, zou hij geen data van anderen mogen kunnen ophalen.

Setup: twee testaccounts A en B die **geen vrienden zijn**.

### Posts isolatie

In een browser ingelogd als A, open de devtools console en run:

```js
// Probeer posts van iedereen op te halen
const { data, error } = await window._supabase
  ?.from('posts').select('*');
console.log({ data, error });
```

Verwacht: enkel jouw eigen posts. Geen posts van B (want geen vriend).

> Heb je `window._supabase` niet beschikbaar? Voeg tijdelijk toe in `lib/supabase/client.ts`: `if (typeof window !== "undefined") (window as any)._supabase = supabase;` voor dev-only.

### Messages isolatie

```js
// Probeer messages van een chat waar je niet in zit
const { data, error } = await window._supabase
  ?.from('messages').select('*').limit(50);
console.log({ data, error });
```

Verwacht: alleen messages uit chats waar je member van bent. Plus: de `recipient_payloads` zijn altijd base64-blobs, nooit plaintext.

### Friendships isolatie

```js
const { data } = await window._supabase
  ?.from('friendships').select('*');
console.log(data);
```

Verwacht: alleen rijen waar je `requester_id` of `addressee_id` bent.

### Profile updates

Probeer iemand anders' profiel te updaten:

```js
const { error } = await window._supabase
  ?.from('profiles')
  .update({ username: 'gehackt' })
  .eq('id', '<ID-VAN-B>');
console.log(error); // moet "violates row-level security policy" zijn
```

Verwacht: error, geen update. Refresh op B's profielscherm → unchanged.

### Storage isolatie

In Supabase Storage dashboard ingelogd als A, probeer een file van B te downloaden via API:

```js
const { data, error } = await window._supabase
  ?.storage.from('posts')
  .createSignedUrl('<USER_ID_B>/<POST_ID>.jpg', 60);
console.log({ data, error });
```

Verwacht: error of een URL die zelf 403't bij download (want B is geen vriend).

### Groep-membership

Probeer jezelf toe te voegen aan een groep waar A niet in zit:

```js
const { error } = await window._supabase
  ?.rpc('add_chat_member', {
    p_chat_id: '<CHAT_ID_VAN_GROEP_ZONDER_A>',
    p_user_id: '<ID_VAN_A>'
  });
console.log(error); // moet "not owner of this chat" zijn
```

Verwacht: RPC werpt exception.

---

## Laag 4 — Performance check met realistische data

Voor je naar productie gaat: vul de database met realistische data en verifieer dat schermen vlot laden.

```sql
-- In Supabase SQL Editor — alleen op dev/test project!
-- Maak 50 nep-profielen
insert into profiles (id, username, identity_pubkey)
select 
  gen_random_uuid(),
  'tester_' || generate_series,
  encode(gen_random_bytes(32), 'base64')
from generate_series(1, 50);

-- Vriendschappen tussen jezelf en 30 random testers
-- (vervang JOUW_USER_ID)
insert into friendships (requester_id, addressee_id, status, accepted_at)
select 
  'JOUW_USER_ID'::uuid,
  id,
  'accepted',
  now()
from profiles 
where username like 'tester_%' 
order by random() 
limit 30;

-- 200 random posts
insert into posts (user_id, image_path, caption)
select 
  (select id from profiles where username like 'tester_%' order by random() limit 1),
  'fake/' || gen_random_uuid() || '.jpg',
  'Test post #' || generate_series
from generate_series(1, 200);
```

Daarna in de app:

- [ ] Feed laadt binnen 1.5 sec (eerste paint)
- [ ] Scroll door 100+ posts blijft 60 fps
- [ ] Vrienden-tab toont 30 vrienden, search blijft snel responsief
- [ ] Chats-tab opent vlot (queries op `my_chat_unread_counts` schalen ok)

Cleanup achteraf:

```sql
delete from posts where image_path like 'fake/%';
delete from friendships where requester_id = 'JOUW_USER_ID' 
  and addressee_id in (select id from profiles where username like 'tester_%');
delete from profiles where username like 'tester_%';
```

---

## Laag 5 — Alpha test met 1-2 vrienden

Het belangrijkste type test: een mens die je app NIET gemaakt heeft, die instructies leest en dingen probeert. Tests die jij zelf doet missen vrijwel altijd de domste UX-fouten.

### Setup

1. Kies 1-2 mensen die je vertrouwt voor eerlijke feedback. Idealiter ander dan jij (techniciteit, leeftijd, device).
2. Deploy naar Vercel als preview (`vercel.app` URL is goed genoeg).
3. Stuur ze één bericht: "Test Lincin met mij — open [URL] en probeer er chat met me te starten. Laat me weten wat verwarrend was."

### Wat je hen vraagt

- Account aanmaken zonder uitleg van jou — kan dat zelfstandig?
- Profielfoto/handle instellen — vinden ze waar dat moet?
- Jou toevoegen — kunnen ze je vinden via de link die jij stuurt?
- Een chat starten en een paar berichten heen-en-weer
- Een foto plaatsen
- (Voor de meest tech-savvy) een groep aanmaken met jou + iemand anders

### Wat jij doet

- Schrijf op wat ze vragen of waar ze stoppen — dat zijn de UX-gaten
- Vraag NIET "vond je het mooi", vraag wel "wat was onverwacht"
- Fix de top 3 issues vóór je breder uitnodigt

Reken op 3-5 ronden van fix + retesten voor de UX echt zit. Dat is normaal en gezond.

---

## Wat te checken na elke deploy

Snel sanity-check na elke `git push` naar main:

1. Vercel build succesvol (geen rode kruisen in dashboard)
2. Open de productie-URL in incognito → login-scherm laadt
3. Login werkt, profiel-tab toont je pubkey
4. Eén bericht sturen in een bestaande chat
5. Eén foto-feed scroll

Als al die werken, is de release waarschijnlijk fine. Zo niet: zelf via DevTools de console-errors checken, of Vercel build-logs nakijken voor missing env vars of build-failures.

---

## Wat we NIET doen (en waarom)

- **Geen end-to-end browser-tests (Playwright/Cypress)**: voor een MVP voor 100 gebruikers is de onderhouds-overhead te hoog. Komt later als we naar publieke release gaan.
- **Geen unit tests op UI-components**: React Native + NativeWind componenten testen vraagt veel mocking en levert weinig vangst voor onze grootte. Manual + alpha vangt meer bugs per uur.
- **Geen load-test tools**: Supabase free tier handelt makkelijk je gebruikersaantal. Alleen relevant als we groeien naar 10k+ gebruikers.

Als we naar publieke release gaan, voegen we hier minstens een Playwright-suite voor de happy paths aan toe. Voor nu: focus op laag 1-5.
