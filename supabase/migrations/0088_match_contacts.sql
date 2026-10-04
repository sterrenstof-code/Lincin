-- Vrienden uit je contacten (native "Uit je contacten").
--
-- De app stuurt geen adressen, alleen de SHA-256 van elk e-mailadres in je
-- contacten (kleine letters, zonder spaties). Deze functie vergelijkt die
-- met de adressen van wie al op Lincin zit en geeft alleen hun openbare
-- profiel terug, met de hash erbij zodat de app weet welk contact het is.
--
-- Een hash beschermt niet tegen iemand die gericht één adres test, dus:
-- hoogstens 2000 hashes per keer en 5 keer per uur. Jezelf en wie een van
-- jullie blokkeerde komen niet terug.

create table if not exists public.contact_match_attempts (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists contact_match_attempts_user_idx
  on public.contact_match_attempts (user_id, created_at desc);
alter table public.contact_match_attempts enable row level security;
-- Geen policies: alleen de functie hieronder schrijft en leest hier.

create or replace function public.match_contacts(p_hashes text[])
returns table (hash text, id uuid, username text, display_name text, avatar_url text, hue text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(array_length(p_hashes, 1), 0) = 0 then
    return;
  end if;
  if array_length(p_hashes, 1) > 2000 then
    raise exception 'too many contacts' using errcode = '22023';
  end if;
  if (select count(*) from public.contact_match_attempts a
      where a.user_id = me and a.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.contact_match_attempts (user_id) values (me);

  return query
  select h.hash, p.id, p.username, p.display_name, p.avatar_url, p.hue
  from (select distinct lower(x) as hash from unnest(p_hashes) x) h
  join auth.users u
    on encode(extensions.digest(lower(trim(u.email)), 'sha256'), 'hex') = h.hash
  join public.profiles p on p.id = u.id
  where p.id <> me
    and not exists (
      select 1 from public.friendships f
      where f.status = 'blocked'
        and ((f.requester_id = me and f.addressee_id = p.id) or (f.requester_id = p.id and f.addressee_id = me))
    );
end $$;

revoke all on function public.match_contacts(text[]) from public, anon;
grant execute on function public.match_contacts(text[]) to authenticated;
