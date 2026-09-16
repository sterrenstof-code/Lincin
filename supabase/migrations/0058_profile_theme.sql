-- 0058 — het thema van de app, per gebruiker.
--
-- Profiel › Instellingen › Thema: kleur (standaard), magazine of modern.
-- Verandert de hele app (kleuren, kaders, koppen, ronding, de feed). Staat
-- op het profiel en niet alleen op het toestel, zodat een tweede toestel
-- dezelfde keuze kent. Lokaal wordt hij gecachet (lib/design/theme.ts).

alter table public.profiles
  add column if not exists theme text not null default 'kleur'
  check (theme in ('kleur', 'magazine', 'modern'));

comment on column public.profiles.theme is
  'Het thema van de app voor deze gebruiker: kleur | magazine | modern.';
