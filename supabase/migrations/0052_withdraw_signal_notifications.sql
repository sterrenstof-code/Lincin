-- 0052_withdraw_signal_notifications.sql
--
-- Een teruggenomen duw laat geen melding achter.
--
-- ---------------------------------------------------------------
-- WAT ER MISGING
-- ---------------------------------------------------------------
-- 0048 maakte meldingen aan bij een `insert` op `post_boosts` en
-- `post_reactions`. Bij een `delete` gebeurde er niets. Wie zijn duw
-- terugnam of zijn emoji weghaalde, liet dus een melding achter die bleef
-- zeggen dat het gebeurd was — terwijl de teller op de vondst weer op nul
-- stond.
--
-- Dat leest als een fout in de teller, en dat is het venijnige eraan: je
-- gaat zoeken op de plek waar het klopt.
--
-- ---------------------------------------------------------------
-- WAAROM WEGHALEN EN NIET LATEN STAAN
-- ---------------------------------------------------------------
-- Er is een argument om hem te laten staan: het is gebeurd, en een logboek
-- herschrijf je niet. Maar dit is geen logboek. Een melding is een
-- aanwijzing naar iets dat er nú is — je tikt erop en verwacht het terug te
-- vinden. Wijst hij naar niets meer, dan is hij niet historisch maar
-- verkeerd.
--
-- Het past ook bij hoe 0048 deze soorten al behandelt: één melding per
-- persoon per vondst, afgedwongen met `notifications_signal_once`. Ze
-- stapelen niet op, ze beschrijven een toestand. Verdwijnt die toestand,
-- dan verdwijnt de melding mee — en duwt dezelfde persoon later opnieuw,
-- dan komt er een verse melding, want de oude staat de index niet meer in
-- de weg.
--
-- Reacties blijven wél staan als ze verwijderd worden: een reactie is iets
-- dat iemand zei, geen toestand die aan of uit staat.

create or replace function public.withdraw_boost_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
   where actor_id = old.user_id
     and post_id = old.post_id
     and type in ('post_boost', 'thread_boost');
  return old;
end;
$$;

drop trigger if exists post_boosts_withdraw_notifications on public.post_boosts;
create trigger post_boosts_withdraw_notifications
  after delete on public.post_boosts
  for each row
  execute function public.withdraw_boost_notifications();

-- ---------------------------------------------------------------
-- Emoji's: hetzelfde, met één verschil
-- ---------------------------------------------------------------
-- Iemand kan meer dan één emoji op dezelfde vondst zetten — de primaire
-- sleutel van `post_reactions` bevat de emoji. Er hoort dus pas een melding
-- weg te vallen als de láátste emoji van die persoon weg is. Anders
-- verdwijnt de melding zodra iemand van 😮 naar ❤️ wisselt.
create or replace function public.withdraw_reaction_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.post_reactions r
     where r.post_id = old.post_id
       and r.user_id = old.user_id
  ) then
    return old;
  end if;

  delete from public.notifications
   where actor_id = old.user_id
     and post_id = old.post_id
     and type in ('post_reaction', 'thread_reaction');
  return old;
end;
$$;

drop trigger if exists post_reactions_withdraw_notifications on public.post_reactions;
create trigger post_reactions_withdraw_notifications
  after delete on public.post_reactions
  for each row
  execute function public.withdraw_reaction_notifications();

-- ---------------------------------------------------------------
-- De rijen die er al staan
-- ---------------------------------------------------------------
-- Meldingen van vóór deze migratie die naar een duw of een emoji wijzen die
-- niet meer bestaat. Die blijven anders staan tot iemand ze aantikt en zich
-- afvraagt waarom de teller nul zegt.
-- Het aantal wordt gemeld, want het beantwoordt meteen een vraag: stond er
-- een melding over een duw die niet meer bestond, of wees de teller fout?
-- Nul verwijderde rijen betekent dat de duw er nog is en het probleem
-- elders zit.
do $$
declare
  n_boost int;
  n_react int;
begin
  delete from public.notifications n
   where n.type in ('post_boost', 'thread_boost')
     and not exists (
       select 1 from public.post_boosts b
        where b.post_id = n.post_id and b.user_id = n.actor_id
     );
  get diagnostics n_boost = row_count;

  delete from public.notifications n
   where n.type in ('post_reaction', 'thread_reaction')
     and not exists (
       select 1 from public.post_reactions r
        where r.post_id = n.post_id and r.user_id = n.actor_id
     );
  get diagnostics n_react = row_count;

  raise notice 'Opgeruimd: % duw-meldingen, % emoji-meldingen zonder rij.',
    n_boost, n_react;
end $$;
