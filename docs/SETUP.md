# Lincin — Setup gids

Een end-to-end versleutelde chat + foto-feed app voor iOS en web, gebouwd op Expo en Supabase. Deze gids loodst je door alles wat je één keer moet doen om het project lokaal te starten.

---

## 1. Wat staat er klaar

```
Comm project/
├── SETUP.md                ← je leest dit nu
└── comm-app/               ← de Expo applicatie
    ├── app/                ← schermen (Expo Router)
    │   ├── (auth)/login.tsx
    │   ├── (app)/          ← tabs: feed, chats, friends, profile
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── lib/
    │   ├── auth/           ← session + profile-bootstrap
    │   ├── crypto/         ← X25519 + XChaCha20-Poly1305 helpers
    │   └── supabase/       ← Supabase client + types
    ├── supabase/migrations/
    │   ├── 0001_initial.sql
    │   ├── 0002_rls_policies.sql
    │   ├── 0003_storage.sql
    │   └── 0004_chat_rpc.sql
    ├── package.json
    ├── tailwind.config.js, babel.config.js, metro.config.js
    └── app.json
```

## 2. Supabase project aanmaken

1. Ga naar [https://supabase.com](https://supabase.com) en maak een account aan (gratis tier is meer dan genoeg voor je MVP).
2. Klik **New project**. Kies een naam (bv. `comm-app`), region (Frankfurt of Brussel zit dicht bij), en een sterk database-wachtwoord (ergens veilig opslaan — Bitwarden, 1Password). Wachtwoord is enkel nodig als je later raw SQL via psql wil doen.
3. Wacht tot het project klaar is (~2 minuten).
4. Ga in het dashboard naar **Project Settings → API**. Kopieer:
   - **Project URL** (ziet er uit als `https://xxxxx.supabase.co`)
   - **anon / public key** (lange JWT die met `eyJ` begint)

## 3. Email magic-link auth aanzetten

1. In Supabase: **Authentication → Providers → Email**.
2. Zorg dat **Enable Email provider** aan staat.
3. Zet **Confirm email** aan en **Secure email change** aan.
4. Onder **Email Templates** kan je later de magic-link mail aanpassen naar het Nederlands.
5. **Authentication → URL Configuration** — voeg `lincin://` toe aan **Additional Redirect URLs** zodat de magic link de iOS-app later kan openen. Voor web tijdens dev voeg je ook `http://localhost:8081` toe.

## 4. Migraties uitvoeren

Open in Supabase de **SQL Editor** (linkermenu) en voer de drie bestanden uit deze repo één voor één uit, in volgorde:

1. `comm-app/supabase/migrations/0001_initial.sql` — tabellen en indexes
2. `comm-app/supabase/migrations/0002_rls_policies.sql` — Row Level Security policies
3. `comm-app/supabase/migrations/0003_storage.sql` — `posts` storage bucket + policies
4. `comm-app/supabase/migrations/0004_chat_rpc.sql` — RPC voor 1-op-1 chats + Realtime aanzetten

Voor elk bestand: open het in je editor, copy-paste de inhoud in de SQL Editor, klik **Run**. Je moet voor elk een groene "Success" zien.

> Tip: later schakelen we over naar de Supabase CLI met `supabase db push` zodat dit één commando wordt. Voor de MVP is copy-paste het simpelst.

## 5. Storage bucket controleren

Ga naar **Storage** in het Supabase dashboard. Je zou de `posts` bucket moeten zien, met "Private" status. Als die er niet is, voer dan migratie 3 nog eens uit.

## 6. Lokaal opzetten

Open een terminal in deze folder:

```bash
cd "Comm project/comm-app"
cp .env.example .env.local
```

Bewerk `.env.local` en plak je twee waarden:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ......
```

Installeer dependencies:

```bash
npm install
```

(Eerste install duurt 3-5 minuten — Expo en alle native deps zijn groot.)

## 7. App starten

```bash
npm run web
```

→ opent op `http://localhost:8081`. Je zou het login-scherm moeten zien.

Voor iOS later:

```bash
npm run ios     # vereist Xcode
# of:
npm start       # toont QR-code; scan met Expo Go app op je iPhone
```

## 8. Sanity check

1. Open de web-app, vul je e-mail in, klik **Stuur magic link**.
2. Check je inbox, klik de link → je komt terug op de app en zit op de Feed tab.
3. Ga naar **Profiel**. Je zou je email + een base64-public-key moeten zien. Die public key is gegenereerd op dit toestel — de bijhorende private key staat in IndexedDB (web) of Keychain (iOS) en verlaat het toestel nooit.
4. Open de Supabase **Table Editor → profiles**. Je zou jouw rij moeten zien met die zelfde `identity_pubkey`. ✅

Als alles werkt, ben je klaar voor Fase 2: friends-flow en de eerste echte versleutelde chat.

---

## Veelvoorkomende issues

**"Missing EXPO_PUBLIC_SUPABASE_URL"** — je hebt `.env.local` niet aangemaakt, of de Metro bundler draait al sinds voor je het bestand maakte. Stop met Ctrl+C en herstart `npm run web`.

**Magic link werkt niet op web** — controleer dat `http://localhost:8081` in **Auth → URL Configuration → Redirect URLs** staat in Supabase.

**RLS errors bij inserten profile** — open in Supabase **Authentication → Users** en check dat jouw email user effectief een `auth.users` rij heeft. Magic link moet eerst aangeklikt zijn.

**Type errors op `nativewind/types`** — run `npx expo install --check` om versies te aligneren, dan herstart de TS-server in je editor.
