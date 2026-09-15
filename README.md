# lincin

Expo-app (iOS, Android, web) voor Lincin. Backend: Supabase.

Voor de eerste opzet zie [`docs/SETUP.md`](docs/SETUP.md); de overige gidsen (deploy, push, testen) staan ook in `docs/`.

## Scripts

```bash
npm run web         # start in browser (snelste tijdens dev)
npm run ios         # vereist Xcode op macOS
npm start           # QR-code voor Expo Go op je iPhone
npm run typecheck   # TS check zonder bouwen
npm run lint
npm run test:crypto # roundtrip-test van de e2e-versleuteling
```

## Folders

- `app/` — schermen (Expo Router file-based routing)
- `lib/auth/` — session provider + profielcreatie
- `lib/crypto/` — X25519 keygen + XChaCha20-Poly1305 helpers
- `lib/supabase/` — client + handgeschreven DB types
- `supabase/migrations/` — Postgres schema + RLS

## Environment

`.env.local` met:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

De productiewaarden staan in `eas.json` (het zijn publieke sleutels; RLS
bewaakt de data).

## Store-builds

Alle configuratie staat in `app.config.ts`; er is geen `app.json`.
Versienummers (`buildNumber` / `versionCode`) beheert EAS op afstand
(`appVersionSource: remote`) en hoogt hij per productie-build op.

```bash
npx expo-doctor                      # eerst: alles groen?
eas build --profile preview -p all   # testbuild (Android: R8 aan — test dit écht)
eas build --profile production -p all
eas submit -p ios                    # App Store Connect
eas submit -p android                # Play Console, track "internal"
eas update --channel production      # JS-only wijziging zonder store-ronde
```

Release-bundels laten `console.log/info/debug` weg (zie `metro.config.js`);
`warn` en `error` blijven staan voor Xcode/logcat.

Wat je vóór de eerste inzending nog nodig hebt buiten deze repo:

- App Store Connect: app-record, privacy-labels, schermafbeeldingen
  (iPhone én iPad — de app ondersteunt tablets).
- Play Console: app-record, `google-service-account.json` naast `eas.json`
  (staat in `.gitignore`), data-safety-formulier.
- Exportregels: de app doet eigen e2e-versleuteling. Controleer of
  `ITSAppUsesNonExemptEncryption: false` klopt voor jouw situatie.
