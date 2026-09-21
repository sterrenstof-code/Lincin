-- 0067 — het thema modern komt terug.
--
-- 2.1 haalde modern weg (0061); 2.2 voert hem opnieuw in, nu als
-- bento-rooster (WIJZIGINGEN-2.2 §1). De check laat de drie thema's weer
-- toe. Niemand hoeft te verhuizen: wie kleur of magazine had, houdt die.

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check check (theme in ('kleur', 'magazine', 'modern'));

comment on column public.profiles.theme is
  'Het thema van de app voor deze gebruiker: kleur | magazine | modern.';
