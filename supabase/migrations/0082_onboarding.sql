-- 0082 — aanmelden en vrienden uitnodigen (Login Voorbeeld, okt 2026).
--
-- Vier dingen:
--   1. `profiles.hue`: je eigen kleur, gekozen bij het aanmaken van je
--      account. Leeg = de kleur die uit je id komt (zoals tot nu toe), zodat
--      niemands kleur verandert.
--   2. `profiles.onboarded_at`: wie de stappen na het aanmaken (foto,
--      vrienden uitnodigen) doorliep of oversloeg. Bestaande profielen
--      tellen als klaar — zij zien de stappen nooit.
--   3. Een trigger vóór het aanmaken van een profiel: naam en kleur uit de
--      aanmelding nemen (ze overleven zo de bevestigingsmail), en een
--      gebruikersnaam die al bestaat aanvullen met cijfers in plaats van
--      het aanmaken te laten mislukken.
--   4. Een vriendcode per persoon (`JV-4821`) en `redeem_friend_code`: wie
--      jouw code gebruikt, is meteen je linc. Geen verzoek, geen wachten.

-- ---------------------------------------------------------------
-- 1 + 2. Kolommen
-- ---------------------------------------------------------------

alter table public.profiles
  add column if not exists hue text
    check (hue in ('orange', 'blue', 'ochre', 'green', 'red'));

comment on column public.profiles.hue is
  'De eigen kleur, gekozen bij het aanmaken. Leeg = de kleur uit het id (defaultHueFor).';

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'Wanneer de stappen na het aanmaken (foto, uitnodigen) klaar of overgeslagen waren. Leeg = nog te doen.';

update public.profiles set onboarded_at = now() where onboarded_at is null;

-- ---------------------------------------------------------------
-- 3. Vóór het aanmaken van een profiel
-- ---------------------------------------------------------------

create or replace function public.profiles_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  base text;
  candidate text;
  tries int := 0;
begin
  select raw_user_meta_data into meta from auth.users where id = new.id;

  if new.display_name is null then
    new.display_name := nullif(trim(meta ->> 'display_name'), '');
  end if;
  if new.hue is null and (meta ->> 'hue') in ('orange', 'blue', 'ochre', 'green', 'red') then
    new.hue := meta ->> 'hue';
  end if;

  -- Alleen tekens die een @vermelding ook herkent (profiles.ts).
  base := lower(regexp_replace(coalesce(new.username, ''), '[^a-zA-Z0-9._]', '', 'g'));
  if char_length(base) < 3 then base := base || 'linc'; end if;
  base := left(base, 27);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = candidate) and tries < 25 loop
    tries := tries + 1;
    candidate := base || (1000 + floor(random() * 9000))::int::text;
  end loop;
  new.username := candidate;
  return new;
end;
$$;

drop trigger if exists profiles_before_insert on public.profiles;
create trigger profiles_before_insert
  before insert on public.profiles
  for each row execute function public.profiles_before_insert();

-- ---------------------------------------------------------------
-- 4. Vriendcodes
-- ---------------------------------------------------------------

-- Een eigen tabel en geen kolom op profiles: profielen zijn leesbaar voor
-- iedereen die inlogt (zoeken), en een code die iedereen kan lezen is een
-- code waarmee iedereen ieders linc kan worden. Hier leest alleen de
-- eigenaar zijn code; inwisselen gaat via de functie hieronder.
create table if not exists public.friend_codes (
  code       text primary key,
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.friend_codes enable row level security;

drop policy if exists "friend_codes: own" on public.friend_codes;
create policy "friend_codes: own"
  on public.friend_codes for select
  using (user_id = auth.uid());

-- Initialen van de naam + vier cijfers: JV-4821. Kort genoeg om voor te
-- lezen, en de cijfers maken hem uniek.
create or replace function public.gen_friend_code(p_name text)
returns text
language plpgsql
set search_path = public
as $$
declare
  words text[];
  initials text;
  candidate text;
begin
  words := regexp_split_to_array(trim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z ]', ' ', 'g')), '\s+');
  initials := upper(left(coalesce(words[1], ''), 1) || left(coalesce(words[2], words[1], ''), 1));
  if char_length(initials) < 2 then initials := 'LI'; end if;
  loop
    candidate := initials || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from public.friend_codes where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.profiles_give_friend_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.friend_codes (code, user_id)
  values (public.gen_friend_code(coalesce(new.display_name, new.username)), new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_give_friend_code on public.profiles;
create trigger profiles_give_friend_code
  after insert on public.profiles
  for each row execute function public.profiles_give_friend_code();

insert into public.friend_codes (code, user_id)
select public.gen_friend_code(coalesce(p.display_name, p.username)), p.id
from public.profiles p
where not exists (select 1 from public.friend_codes f where f.user_id = p.id);

-- Mislukte pogingen, om raden af te remmen: vier cijfers zijn snel geraden
-- als niemand telt.
create table if not exists public.friend_code_attempts (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists friend_code_attempts_user_idx
  on public.friend_code_attempts (user_id, created_at desc);
alter table public.friend_code_attempts enable row level security;
-- Geen policies: alleen de functie hieronder schrijft en leest hier.

/**
 * Een code inwisselen. Geeft een status terug in plaats van een fout te
 * gooien, zodat de mislukte poging bewaard blijft (een fout zou hem
 * terugdraaien):
 *   ok            jullie zijn lincs (of waren het al)
 *   not_found     geen code met deze tekst
 *   own           je eigen code
 *   not_allowed   een van jullie blokkeerde de ander
 *   rate_limited  te veel mislukte pogingen het afgelopen uur
 */
create or replace function public.redeem_friend_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  existing public.friendships%rowtype;
  who jsonb;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if (select count(*) from public.friend_code_attempts
      where user_id = me and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select f.user_id into target
  from public.friend_codes f
  where f.code = upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));

  if target is null then
    insert into public.friend_code_attempts (user_id) values (me);
    return jsonb_build_object('status', 'not_found');
  end if;
  if target = me then
    return jsonb_build_object('status', 'own');
  end if;

  select * into existing
  from public.friendships
  where (requester_id = me and addressee_id = target)
     or (requester_id = target and addressee_id = me)
  limit 1;

  if found then
    if existing.status = 'blocked' then
      return jsonb_build_object('status', 'not_allowed');
    end if;
    if existing.status = 'pending' then
      update public.friendships
        set status = 'accepted', accepted_at = now()
        where id = existing.id;
    end if;
  else
    insert into public.friendships (requester_id, addressee_id, status, accepted_at)
    values (target, me, 'accepted', now());
  end if;

  select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name)
    into who
  from public.profiles p where p.id = target;

  return jsonb_build_object('status', 'ok', 'friend', who);
end;
$$;

revoke all on function public.redeem_friend_code(text) from public, anon;
grant execute on function public.redeem_friend_code(text) to authenticated;
