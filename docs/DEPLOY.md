# Lincin — Deploy & Test gids

Twee paden. Begin bij het web, daarna iOS.

| Fase | Wat | Tijd | Kost |
|------|-----|------|------|
| 1 | Web live op een echt domein via Vercel | ~30 min | gratis |
| 2 | iOS app op vrienden via TestFlight | ~1-2 u + Apple-review | €99/jaar |

---

## Fase 1 — Web deploy (Vercel)

Vercel host je Expo web-build gratis (Hobby tier dekt jouw schaal makkelijk), regelt SSL, en re-deployt automatisch bij elke git push.

### 1. Code op GitHub krijgen

Lincin staat nu lokaal in je `Comm project` folder maar nog niet onder git. We initialiseren een repo aan de root van die folder (zodat `README.md`, `SETUP.md`, `DESIGN.md` en de `comm-app/` subfolder samen versioneerd worden).

Open een terminal in `Comm project/`:

```bash
cd "Comm project"
git init
git add .
git commit -m "initial: lincin mvp"
```

Maak een nieuwe repo op [github.com/new](https://github.com/new) — naam `lincin`, **private** (want we hebben Supabase env vars en gevoelige logica), description "Lincin — privacy-first chat & photo app". **Niet** initialize met README/gitignore (die hebben we al).

Volg de instructies die GitHub toont om een bestaande repo te pushen:

```bash
git remote add origin git@github.com:JOUW-HANDLE/lincin.git
git branch -M main
git push -u origin main
```

> Geen SSH-key op GitHub? Gebruik de HTTPS-versie van de URL of [voeg een SSH-key toe](https://docs.github.com/en/authentication/connecting-to-github-with-ssh).

### 2. Vercel account + project importeren

1. Ga naar [vercel.com/signup](https://vercel.com/signup), kies "Continue with GitHub" → autoriseer Vercel toegang tot je repos.
2. Eens ingelogd: **Add New → Project** → kies `lincin` uit de lijst.
3. **Configure Project**:

   - **Framework Preset**: `Other` (Vercel heeft geen Expo-preset, maar Other met onze custom commands werkt prima)
   - **Root Directory**: klik **Edit** en kies `comm-app` (heel belangrijk — de package.json zit één niveau diep)
   - **Build Command** (override): `npx expo export --platform web`
   - **Output Directory** (override): `dist`
   - **Install Command** kan op default

4. **Environment Variables** — klik open en voeg drie keys toe:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://vipflmocnubcqcfnqcqs.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xqpN-g6yOsyDrMjVaXEZ7w_n2IFR3Oj
   EXPO_PUBLIC_PUBLIC_URL=https://lincin.vercel.app
   ```

   (De derde waarde zet je voorlopig op de Vercel preview-URL — Vercel toont die zodra het project is aangemaakt. Na een eigen domein vervang je dit door je echte URL.)

5. Klik **Deploy**. Eerste build duurt 2-4 minuten. Aan het einde krijg je een URL zoals `lincin-abc123.vercel.app` en daarna een productie-URL `lincin.vercel.app`.

### 3. Update Supabase URL Configuration

De magic-link e-mails moeten weten dat ze naar je nieuwe domein mogen redirecten. Anders weigert Supabase de redirect.

In het Supabase dashboard:

1. **Authentication → URL Configuration**
2. **Site URL**: `https://lincin.vercel.app` (of later je echte domein)
3. **Additional Redirect URLs**: voeg toe (één per regel):
   ```
   https://lincin.vercel.app/**
   https://*-jouw-vercel-team.vercel.app/**
   http://localhost:8081
   ```
   De `**` wildcard staat redirects naar elke route toe (bijvoorbeeld direct naar `/user/jou` na een magic-link klik). De middelste regel is optioneel — alleen handig als je preview-deployments wil ondersteunen.
4. Save.

### 4. Update `EXPO_PUBLIC_PUBLIC_URL` als je een eigen domein hebt

Optioneel maar aanbevolen voor je vrienden ("Open lincin.app" klinkt beter dan "Open lincin-abc.vercel.app").

1. Koop een domein. Snel: `lincin.app` op [Namecheap](https://www.namecheap.com) of [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/). ~€10-20/jaar.
2. In Vercel: **Project → Settings → Domains** → voeg `lincin.app` toe (en `www.lincin.app` als alias). Vercel toont welke DNS-records je bij je registrar moet zetten — meestal één A-record + één CNAME.
3. SSL wordt automatisch geregeld door Vercel binnen enkele minuten.
4. Update de env var `EXPO_PUBLIC_PUBLIC_URL=https://lincin.app` en redeploy. Voeg `https://lincin.app/**` toe aan Supabase Redirect URLs.

### 5. Testen

Open `https://lincin.vercel.app` (of je eigen domein) in je iPhone-browser. Log in via magic link — die wordt nu via je echte domein bezorgd. Test:

- Foto posten + zien op de feed
- Chat met een tweede account (gebruik je magic-link in een ander toestel of incognito venster van een vriend)
- Deel je QR-code → laat iemand ze scannen met de iPhone-camera → opent direct je `/user/handle` pagina

iPhone Safari: "Deel" knop in adresbalk → "Voeg toe aan beginscherm" → Lincin verschijnt als PWA-icon, opent in volledig scherm zonder browser-chrome. Lijkt al heel erg op een echte app.

### 6. Updates pushen

Vanaf nu: elke git push naar `main` triggert automatisch een nieuwe Vercel deploy. Een typische update-flow:

```bash
# In Comm project/
git add .
git commit -m "fix: spelling in profielscherm"
git push
```

Vercel bouwt binnen ~2 min, het nieuwe versie staat live, oude tabs herladen automatisch bij volgende refresh.

---

## Fase 2 — iOS app op TestFlight

Voor wanneer je vrienden Lincin als échte app op hun home screen willen, met push notifications en native gevoel.

### 1. Apple Developer Program

Ga naar [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll). €99/jaar, betaal met Apple ID. Goedkeuring duurt 24-48 uur (Apple verifieert je identiteit).

### 2. EAS CLI setup

[Expo Application Services (EAS)](https://docs.expo.dev/eas/) is de cloud-build dienst van Expo. Gratis tier geeft je 30 builds/maand — meer dan genoeg.

```bash
cd "Comm project/comm-app"
npm install -g eas-cli
eas login          # log in met je Expo account (gratis aan te maken)
eas init           # koppelt het project aan een EAS project-id
```

Configureer build profielen:

```bash
eas build:configure
```

Dit maakt een `eas.json` aan. Pas aan zodat het er ongeveer zo uitziet:

```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "ios": { "simulator": false }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "JOUW-APPLE-ID@example.com",
        "ascAppId": "ID-uit-app-store-connect"
      }
    }
  }
}
```

### 3. Eerste iOS build

```bash
eas build --platform ios --profile production
```

EAS vraagt om je Apple Developer credentials (genereert automatisch de certs en provisioning profiles), uploadt je code naar hun cloud, en bouwt een `.ipa`-bestand. Duurt ~15-25 minuten.

### 4. Submit naar App Store Connect

```bash
eas submit --platform ios --latest
```

Dit upload de build naar App Store Connect, waar TestFlight automatisch klaarstaat.

### 5. TestFlight openzetten voor vrienden

In [App Store Connect](https://appstoreconnect.apple.com):

1. **My Apps → Lincin → TestFlight**
2. Onder **Test Information**: vul "Beta App Description", "Email", en eventueel een privacy policy URL in.
3. Onder **Internal Testing**: voeg gebruikers (max 100) toe vanuit je team — geen review nodig, build is direct beschikbaar.
4. Onder **External Testing**: maak een groep aan, voeg tot 10.000 testers toe op e-mail of via een publieke link. Eerste keer dat je een externe groep doet, vraagt Apple een korte beta-review (~24u).

Je vrienden:

1. Installeren de gratis **TestFlight** app uit de App Store.
2. Klikken op de uitnodigingslink die jij stuurt (of typen de redeem code).
3. Installeren Lincin via TestFlight — verschijnt als app op hun home screen.

Builds verlopen na 90 dagen, dus je pusht ongeveer elke 6-8 weken een nieuwe build (`eas build` + `eas submit`).

---

## Resend SMTP (om #10 en #18 te ontgrendelen)

Hierboven werkt magic-link nog steeds via Supabase's eigen mailer met die limiet van 4/uur. Voor productie wil je dat veel hoger. Vijf minuten werk:

1. Maak gratis account op [resend.com](https://resend.com). Verifieer je e-mail.
2. **API Keys → Create API Key** (full access). Kopieer (begint met `re_`).
3. In Supabase: **Project Settings → Authentication → SMTP Settings** → **Enable Custom SMTP**:
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend`
   - Password: jouw `re_…` key
   - Sender email: `onboarding@resend.dev` voor nu (later: je eigen domein verifiëren bij Resend)
   - Sender name: `Lincin`
4. Onder **Authentication → Rate Limits**: zet **Emails per hour** op 100 of meer.

Klaar — magic-link gaat nu via Resend, geen 4/uur-blokkade meer, en je kan rustig je end-to-end tests doen.

---

## Daarna

Eens je hierdoor heen bent:

- **Web deployed** ✓ — vrienden testen via lincin.app (of vercel.app domein) in hun browser
- **iOS via TestFlight** ✓ — vrienden installeren als app
- **Push notifications** wordt nu mogelijk (#25): web push via service worker, iOS push via APNs cert die EAS Build automatisch regelt voor jouw bundle ID

Geef me een seintje bij de eerste live deploy en ik help met de Supabase config check en eventuele build-errors.
