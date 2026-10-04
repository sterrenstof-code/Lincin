-- 0085 — de poll op de bijdragepagina (Poll-spec, okt 2026).
--
--   anonymous        de maker zette de poll anoniem: niemand ziet wie wat
--                    stemde, alleen de aantallen (en je eigen stem)
--   allow_proposals  "Eigen voorstel mag": iedereen die de poll ziet mag
--                    een keuze toevoegen, tot zes keuzes in totaal
--   created_by       wie een keuze voorstelde (leeg = de maker zelf)
--
-- Stemmen, voorstellen en een voorstel weghalen gaan via functies, zodat
-- de regels (één stem of meerdere, gesloten na de einddatum, hoogstens zes
-- keuzes, samenvoegen bij dezelfde tekst) op één plek staan.

alter table public.polls
  add column if not exists anonymous boolean not null default false,
  add column if not exists allow_proposals boolean not null default false;

alter table public.poll_options
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

-- Anoniem: andermans stemmen zijn onzichtbaar. Je eigen stem blijft
-- leesbaar (anders weet de app niet wat jij koos); de aantallen komen uit
-- `poll_results`.
drop policy if exists "poll_votes: met de poll" on public.poll_votes;
create policy "poll_votes: met de poll"
  on public.poll_votes for select
  using (
    exists (
      select 1
        from public.poll_options po
        join public.polls p on p.id = po.poll_id
       where po.id = poll_option_id
         and public.can_see_poll(po.poll_id)
         and (poll_votes.user_id = auth.uid() or not p.anonymous)
    )
  );

/** De aantallen per keuze, ook als de poll anoniem is. */
create or replace function public.poll_results(p_poll_id uuid)
returns table (option_id uuid, votes integer)
language sql
stable
security definer
set search_path = public
as $$
  select po.id, count(v.id)::int
    from public.poll_options po
    left join public.poll_votes v on v.poll_option_id = po.id
   where po.poll_id = p_poll_id
     and public.can_see_poll(p_poll_id)
   group by po.id;
$$;

grant execute on function public.poll_results(uuid) to authenticated;

/**
 * Een tik op een keuze:
 *   - nog niet gestemd op deze keuze → stem (bij één keuze vervangt hij je
 *     vorige stem)
 *   - al gestemd op deze keuze → stem ingetrokken
 * Geeft 'voted', 'withdrawn' of 'closed' terug.
 */
create or replace function public.vote_poll_option(p_option_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_poll public.polls%rowtype;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select p.* into v_poll
    from public.polls p
    join public.poll_options po on po.poll_id = p.id
   where po.id = p_option_id;
  if not found or not public.can_see_poll(v_poll.id) then
    raise exception 'poll niet gevonden';
  end if;
  if v_poll.ends_at is not null and v_poll.ends_at <= now() then
    return 'closed';
  end if;

  if exists (select 1 from public.poll_votes where poll_option_id = p_option_id and user_id = me) then
    delete from public.poll_votes where poll_option_id = p_option_id and user_id = me;
    return 'withdrawn';
  end if;

  if not v_poll.allow_multiple then
    delete from public.poll_votes v
     using public.poll_options po
     where po.id = v.poll_option_id and po.poll_id = v_poll.id and v.user_id = me;
  end if;
  insert into public.poll_votes (poll_option_id, user_id) values (p_option_id, me);
  return 'voted';
end;
$$;

grant execute on function public.vote_poll_option(uuid) to authenticated;

/**
 * Een eigen voorstel: voegt een keuze toe en stemt erop. Bestaat er al een
 * keuze met dezelfde tekst (hoofdletterongevoelig), dan wordt het een stem
 * op die keuze. Geeft het id van de keuze terug.
 */
create or replace function public.propose_poll_option(p_poll_id uuid, p_label text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_poll public.polls%rowtype;
  v_label text := trim(coalesce(p_label, ''));
  v_option uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  select * into v_poll from public.polls where id = p_poll_id;
  if not found or not public.can_see_poll(p_poll_id) then
    raise exception 'poll niet gevonden';
  end if;
  if not v_poll.allow_proposals then
    raise exception 'deze poll staat geen voorstellen toe';
  end if;
  if v_poll.ends_at is not null and v_poll.ends_at <= now() then
    raise exception 'deze poll is gesloten';
  end if;
  if char_length(v_label) < 1 or char_length(v_label) > 80 then
    raise exception 'een voorstel heeft 1 tot 80 tekens';
  end if;

  select id into v_option
    from public.poll_options
   where poll_id = p_poll_id and lower(trim(label)) = lower(v_label)
   limit 1;

  if v_option is null then
    if (select count(*) from public.poll_options where poll_id = p_poll_id) >= 6 then
      raise exception 'deze poll heeft al zes keuzes';
    end if;
    insert into public.poll_options (poll_id, label, position, created_by)
    values (
      p_poll_id,
      v_label,
      coalesce((select max(position) + 1 from public.poll_options where poll_id = p_poll_id), 0),
      me
    )
    returning id into v_option;
  end if;

  -- Toevoegen telt meteen als jouw stem (en vervangt bij één keuze je vorige).
  if not exists (select 1 from public.poll_votes where poll_option_id = v_option and user_id = me) then
    if not v_poll.allow_multiple then
      delete from public.poll_votes v
       using public.poll_options po
       where po.id = v.poll_option_id and po.poll_id = p_poll_id and v.user_id = me;
    end if;
    insert into public.poll_votes (poll_option_id, user_id) values (v_option, me);
  end if;

  return v_option;
end;
$$;

grant execute on function public.propose_poll_option(uuid, text) to authenticated;

/**
 * Een voorstel weghalen: alleen de maker van de poll of wie het voorstelde,
 * en alleen zolang niemand anders erop stemde.
 */
create or replace function public.remove_poll_option(p_option_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  o public.poll_options%rowtype;
  v_owner uuid;
begin
  select * into o from public.poll_options where id = p_option_id;
  if not found or o.created_by is null then
    return false;
  end if;
  select user_id into v_owner from public.polls where id = o.poll_id;
  if me is distinct from o.created_by and me is distinct from v_owner then
    return false;
  end if;
  if exists (select 1 from public.poll_votes where poll_option_id = p_option_id and user_id <> o.created_by) then
    return false;
  end if;
  delete from public.poll_options where id = p_option_id;
  return true;
end;
$$;

grant execute on function public.remove_poll_option(uuid) to authenticated;

-- Live: percentages en "wie stemde" bewegen mee.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'poll_votes') then
    alter publication supabase_realtime add table public.poll_votes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'poll_options') then
    alter publication supabase_realtime add table public.poll_options;
  end if;
end $$;
