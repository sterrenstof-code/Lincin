-- 0104 — een grens aan linkvoorbeelden per account (nov 2026).
--
-- `unfurl` haalt voor elke ingelogde gebruiker een willekeurige publieke URL
-- op. Elke ophaling is begrensd (8 s, 512 kB), maar het aantal niet: met een
-- andere URL telkens werd de cache omzeild en liet iemand onze servers
-- eindeloos andere sites aflopen. Nu hoogstens 60 nieuwe ophalingen per uur
-- per account; wat al in de cache staat telt niet.

create table if not exists public.unfurl_fetches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists unfurl_fetches_user_idx on public.unfurl_fetches (user_id, created_at);
alter table public.unfurl_fetches enable row level security;
revoke all on public.unfurl_fetches from anon, authenticated;

-- true = ophalen mag (en is geteld); false = te veel.
create or replace function public.claim_unfurl(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('unfurl:' || p_user::text));
  if (select count(*) from unfurl_fetches
       where user_id = p_user and created_at > now() - interval '1 hour') >= 60 then
    return false;
  end if;
  insert into unfurl_fetches (user_id) values (p_user);
  delete from unfurl_fetches where user_id = p_user and created_at < now() - interval '1 day';
  return true;
end;
$$;
revoke all on function public.claim_unfurl(uuid) from public, anon, authenticated;
grant execute on function public.claim_unfurl(uuid) to service_role;
