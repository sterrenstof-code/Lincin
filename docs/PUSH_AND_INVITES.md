# Lincin — Deploy gids voor invites & push

Twee Edge Functions + één Webhook erbij ten opzichte van het basis-deploy. Werkt het beste **na** je eerste Vercel deploy. Volg deze gids stap voor stap, in deze volgorde.

---

## Stap 0 — Supabase CLI installeren

```bash
npm install -g supabase
supabase login          # opent browser, log in met je Supabase account
cd "Comm project/comm-app"
supabase link --project-ref vipflmocnubcqcfnqcqs
```

`project-ref` haal je uit je Supabase URL: `https://<PROJECT-REF>.supabase.co`.

---

## Stap 1 — Migraties 0009 + 0010

Open in Supabase SQL Editor en run achter elkaar:

1. `supabase/migrations/0009_invites.sql` — pending_invites tabel + trigger die invites materialiseert tot vriendschappen
2. `supabase/migrations/0010_devices.sql` — user_devices tabel voor push tokens

Of via CLI:

```bash
supabase db push
```

(Vereist dat alle vorige migraties al lokaal vergelijkbaar zijn — als je daar twijfelt, gewoon de SQL editor.)

---

## Stap 2 — Edge Function: invite-by-email

```bash
cd "Comm project/comm-app"
supabase functions deploy invite-by-email --no-verify-jwt
```

De function gebruikt automatisch `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` als secrets (door Supabase ingeladen).

> **`--no-verify-jwt` is niet optioneel.** Deze stap stond hier eerder zonder
> die vlag, en dat botste met de deploy-regel in `index.ts` zelf.
>
> Zonder de vlag zet het Supabase-platform er een eigen JWT-poort vóór jouw
> code. Die poort antwoordt bij een afgekeurd of verlopen token met een 401
> **zonder CORS-headers** — de browser blokkeert dat antwoord, `fetch` faalt,
> en supabase-js rapporteert het als *"Failed to send a request to the Edge
> Function"*. Je ziet dus nooit een statuscode en nooit de echte reden, en de
> fout lijkt alsof de function niet bestaat.
>
> De function controleert zelf al of de aanroeper ingelogd is (hij haalt de
> user uit de meegestuurde `Authorization`-header en geeft anders
> `{ error: "Niet ingelogd" }` terug) — mét CORS-headers, dus leesbaar in de
> app. De platformpoort voegt niets toe behalve een onleesbare faalmodus.

**Test**: in de app als ingelogde user, ga naar **Vrienden → mail-icoon rechts** → typ een test-email die nog geen account heeft → "Stuur uitnodiging". Het email arriveert via Supabase's mailer (rate-limit gelimiteerd zonder Resend SMTP — zie DEPLOY.md voor Resend setup).

**Verificatie**: Supabase Studio → Authentication → Users → de invitee staat er nu met status "invited". Plus: Database → Tables → `pending_invites` → één rij die jou als inviter koppelt.

Zodra de invitee zich aanmeldt (klikt op de mail-link, kiest wachtwoord), maakt onze trigger uit migratie 0009 automatisch een geaccepteerde vriendschap aan en verwijdert de invite-rij. Je krijgt ze in je Vrienden-lijst zonder verdere actie.

---

## Stap 3 — Edge Function: send-push

```bash
supabase functions deploy send-push --no-verify-jwt
```

De `--no-verify-jwt` flag is nodig omdat database webhooks geen JWT meesturen. We doen onze eigen authenticatie via de service-role.

---

## Stap 4 — Database Webhooks aanmaken

Push wordt getriggerd door INSERT-events op `messages` en `friendships`. Configureer twee webhooks in Supabase Studio:

### Webhook 1: nieuwe berichten → push

1. **Database → Webhooks → Create a new hook**
2. Naam: `on_message_push`
3. Table: `messages`
4. Events: alleen **Insert** aanvinken
5. Type: **Supabase Edge Functions**
6. Edge Function: `send-push`
7. HTTP Method: `POST`
8. Save

### Webhook 2: nieuwe friend requests → push

1. **Database → Webhooks → Create a new hook**
2. Naam: `on_friend_request_push`
3. Table: `friendships`
4. Events: **Insert** (en eventueel **Update** als je ook bij Accept een push wil sturen)
5. Type: **Supabase Edge Functions**
6. Edge Function: `send-push`
7. Save

---

## Stap 5 — iOS push aanzetten (TestFlight-pad)

Push werkt op iOS pas écht zodra je:

1. Apple Developer Program lid bent (€99/jaar)
2. Een EAS Build hebt gedaan (zie DEPLOY.md fase 2). EAS regelt automatisch de iOS push notification capability en de APNs key.
3. Lincin via TestFlight installeert op een fysiek toestel (simulator support push niet)

In `app.json` moet iOS push capability aanstaan. Voeg toe onder `expo.ios`:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "io.beyondesign.lincin",
  "infoPlist": {
    "UIBackgroundModes": ["remote-notification"]
  }
}
```

Bij `eas build` worden de juiste entitlements + APNs cert automatisch aangemaakt.

Eens geïnstalleerd: bij eerste login vraagt iOS toestemming voor notificaties. Bij accepteren wordt de Expo push-token in `user_devices` opgeslagen, en stuurt onze Edge Function bij elk inkomend bericht een notificatie.

---

## Stap 6 — Web push aanzetten (optioneel)

Web push op Safari/Chrome/etc vraagt extra config:

1. Genereer VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Zet de public key in je Vercel env als `EXPO_PUBLIC_VAPID_PUBLIC_KEY`.
3. Zet de private key in Supabase secrets:
   ```bash
   supabase secrets set VAPID_PRIVATE_KEY=<private-key>
   ```
4. Pas `send-push` aan om VAPID-getekende web-push payloads te sturen (Expo's push service ondersteunt nu nog niet alle webbrowsers — voor brede browser support is een aparte `web-push` library nodig).

> Voor MVP is iOS push genoeg. Web push is een aparte project zelf — neem het op als je écht 24/7 betrokkenheid op desktop wil.

---

## Stap 7 — Testen

**Invites**:
1. Account A logt in
2. Vrienden tab → mail-icoon → nodig een nieuw e-mail uit (gebruik een aliasie zoals `coysmantom45+test2@gmail.com`)
3. Open de uitnodigingsmail in een privé venster, klik link, kies wachtwoord, account aanmaken
4. Direct na bootstrap zou je in account A's vrienden-lijst account B moeten zien staan (geaccepteerd, geen verzoek-tussenstap)

**Push (op iOS via TestFlight)**:
1. Installeer Lincin op je iPhone via TestFlight
2. Log in → bij prompt toestemming geven voor notificaties
3. Verlaat de app
4. Vanuit een tweede account: stuur een bericht naar account A
5. Push notificatie verschijnt op A's iPhone binnen enkele seconden
6. Tap → opent direct de juiste chat

---

## Troubleshooting

**Edge Function failed**: open Supabase Studio → Edge Functions → klik op `invite-by-email` of `send-push` → tab **Logs**. Zie de error stack.

**Geen push aankomen op iPhone**: check `user_devices` tabel — staat er een rij voor jouw user_id met platform=ios en een geldige token? Zo niet: app opnieuw installeren, toestemming opnieuw geven.

**Webhook fired niet**: Supabase Studio → Database → Webhooks → klik op je hook → tab **Recent runs**. Zie of de POST überhaupt vertrokken is.

**Invite-mail komt niet aan**: standaard Supabase mailer is gelimiteerd. Configureer Resend SMTP (zie DEPLOY.md fase 1.6). Daarna verdwijnen rate-limit issues.
