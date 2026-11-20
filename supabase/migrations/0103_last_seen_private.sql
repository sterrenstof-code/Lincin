-- 0103 — "actief · 2 min geleden" alleen voor wie je kent (nov 2026).
--
-- Elk profiel is leesbaar voor elke ingelogde account (zoeken op naam,
-- verzoeken, wie in een groep of event zit). Daarmee kon iedereen ook zien
-- wanneer een willekeurig iemand het laatst online was. Dat tijdstip staat
-- nu in een eigen tabel, en `last_seen_of` geeft het alleen voor jezelf, je
-- lincs en wie met jou in een gesprek zit.
--
-- Oudere app-versies schrijven en lezen nog `profiles.last_seen_at`. Het
-- schrijven blijft werken (de trigger zet het door naar `presence` en laat
-- de kolom leeg); lezen geeft voortaan null, dus daar staat geen "actief".

create table if not exists public.presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null
);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

create or replace function public.profiles_route_last_seen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_seen_at is not null then
    insert into public.presence (user_id, last_seen_at) values (new.id, new.last_seen_at)
      on conflict (user_id) do update set last_seen_at = greatest(presence.last_seen_at, excluded.last_seen_at);
    new.last_seen_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.profiles_route_last_seen() from public, anon, authenticated;

drop trigger if exists profiles_route_last_seen on public.profiles;
create trigger profiles_route_last_seen
  before insert or update of last_seen_at on public.profiles
  for each row execute function public.profiles_route_last_seen();

-- Wat er al stond overzetten; de trigger maakt de kolom leeg.
update public.profiles set last_seen_at = last_seen_at where last_seen_at is not null;

create or replace function public.last_seen_of(p_ids uuid[])
returns table (id uuid, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.last_seen_at
    from public.presence p
   where p.user_id = any (p_ids)
     and auth.uid() is not null
     and (
       p.user_id = auth.uid()
       or exists (select 1 from public.accepted_friends af where af.user_id = auth.uid() and af.friend_id = p.user_id)
       or exists (
         select 1 from public.chat_members a
           join public.chat_members b on b.chat_id = a.chat_id
          where a.user_id = auth.uid() and b.user_id = p.user_id
       )
     );
$$;
revoke all on function public.last_seen_of(uuid[]) from public, anon;
grant execute on function public.last_seen_of(uuid[]) to authenticated;
