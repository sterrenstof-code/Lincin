-- 0061 — het thema modern verdwijnt.
--
-- Profiel › Instellingen › Thema kent nog kleur (standaard) en magazine.
-- Wie modern had, gaat terug naar kleur; daarna laat de check modern niet
-- meer toe.

update public.profiles set theme = 'kleur' where theme = 'modern';

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check check (theme in ('kleur', 'magazine'));

comment on column public.profiles.theme is
  'Het thema van de app voor deze gebruiker: kleur | magazine.';
