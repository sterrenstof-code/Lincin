-- 0071 — modern is het thema voor wie nooit koos.
--
-- Tot nu toe stond `profiles.theme` standaard op 'kleur' en was hij nooit
-- leeg, dus "koos kleur" en "koos niets" waren niet uit elkaar te houden.
-- Vanaf nu betekent leeg: nooit gekozen, en de app toont dan modern.
--
-- Wie magazine of modern heeft, koos dat zelf en houdt het. Wie 'kleur'
-- heeft, kreeg dat (op een enkeling na) als standaard; die rijen worden
-- leeg. Koos iemand kleur wél zelf, dan staat die keuze nog op zijn
-- toestel (`lincin-thema`), wint daar, en schrijft de app hem bij het
-- volgende openen terug naar het profiel (components/lincin/ThemeProvider.tsx).

alter table public.profiles alter column theme drop not null;
alter table public.profiles alter column theme drop default;

update public.profiles set theme = null where theme = 'kleur';

comment on column public.profiles.theme is
  'Het thema dat de gebruiker koos: kleur | magazine | modern. Leeg = nooit gekozen (de app toont modern).';
