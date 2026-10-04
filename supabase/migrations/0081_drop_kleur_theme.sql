-- 0081 — kleur is geen thema meer.
--
-- De handoff van oktober 2026 kent nog twee thema's: magazine en modern.
-- Wie op kleur stond, valt terug op "nooit gekozen" — de app toont dan
-- modern (0071). Een toestel dat nog `lincin-thema = kleur` bewaard heeft
-- leest dat sindsdien ook als geen keuze (isLincinTheme), en schrijft dus
-- niets meer terug; de check hieronder zou het anders weigeren.

update public.profiles set theme = null where theme = 'kleur';

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check check (theme in ('magazine', 'modern'));

comment on column public.profiles.theme is
  'Het thema dat de gebruiker koos: magazine | modern. Leeg = nooit gekozen (de app toont modern).';
