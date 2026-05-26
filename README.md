# lincin

Expo (iOS + web) frontend voor Lincin.

Voor de eerste opzet zie [`../SETUP.md`](../SETUP.md).

## Scripts

```bash
npm run web        # start in browser (snelste tijdens dev)
npm run ios        # vereist Xcode op macOS
npm start          # QR-code voor Expo Go op je iPhone
npm run typecheck  # TS check zonder bouwen
npm run lint
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
