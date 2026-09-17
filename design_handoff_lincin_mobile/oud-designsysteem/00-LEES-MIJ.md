# Oud designsysteem (huidige code, versie 2.0)

De bestaande bron-of-truth uit de codebase, meegeleverd zodat het nieuwe
ontwerp (2.1, zie ../HANDOFF.md) naast de huidige waarden te leggen is.

## Tokens & type
- `lib/design/theme.ts` — kleuren, thema's (o.a. Kleur), licht/donker
- `lib/design/type.ts` — typeschaal
- `global.css`, `tailwind.config.js` — web-tokens
- `fonts/` — ArchivoCond-Black, ArchivoXCond-Black

## Componenten
- `components/lincin/ThemeProvider.tsx` — themakeuze + device-follow
- `components/lincin/ui.tsx` — basiselementen
- `components/lincin/PostCard.tsx`, `Media.tsx`, `ComposeBar.tsx`, `Chrome.tsx`

## Lincin-logica
- `lib/lincin/desktop.ts` — desktop-layoutregels
- `lib/lincin/prefs.ts` — voorkeuren (thema, panelen)
- `lib/lincin/reactions.ts` — reactieset

## Documentatie
- `DESIGN.md` — de oorspronkelijke designbeschrijving

Wat er in 2.1 wijzigt staat per punt in `../HANDOFF.md`.
