-- Invite-by-email
--
-- Wanneer iemand een vriend uitnodigt die nog geen Lincin-account heeft,
-- bewaren we de intentie in `pending_invites`. Zodra de invitee zich
-- aanmeldt en zijn profiel gemaakt wordt, materialiseert een trigger de
-- pending invites tot ge-accepteerde friendships, en ruimt ze op.

create table if not exists public.pending_invites (
  id              uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  email           text not null check (char_length(email) between 3 and 320),
  created_at      timestamptz not null default now(),
  unique (inviter_user_id, email)
);

create index if not exists pending_invites_email_idx
  on public.pending_invites (lower(email));

alter table public.pending_invites enable row level security;

-- Inviter ziet en beheert eigen invites
create policy "inviter sees own invites"
  on public.pending_invites for select
  to authenticated using (auth.uid() = inviter_user_id);

create policy "inviter deletes own invites"
  on public.pending_invites for delete
  to authenticated using (auth.uid() = inviter_user_id);

-- Insert gebeurt server-side via de Edge Function met service_role,
-- maar staan het toch toe via RLS voor het geval iemand zelf inserts
-- doet vanuit eigen tooling.
create policy "inviter creates invite"
  on public.pending_invites for insert
  to authenticated with check (auth.uid() = inviter_user_id);

-- ---------- materialisatie trigger ----------
-- Bij elk nieuw profiel: kijk of er pending invites voor dit email-adres
-- bestaan, maak accepted friendships, ruim de invites op.

create or replace function public.handle_pending_invites_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  invite_row record;
begin
  select email into user_email from auth.users where id = NEW.id;
  if user_email is null then
    return NEW;
  end if;

  for invite_row in
    select inviter_user_id
      from public.pending_invites
     where lower(email) = lower(user_email)
  loop
    insert into public.friendships (requester_id, addressee_id, status, accepted_at)
      values (invite_row.inviter_user_id, NEW.id, 'accepted', now())
      on conflict (requester_id, addressee_id) do nothing;
  end loop;

  delete from public.pending_invites where lower(email) = lower(user_email);
  return NEW;
end;
$$;

drop trigger if exists on_profile_created_handle_invites on public.profiles;
create trigger on_profile_created_handle_invites
  after insert on public.profiles
  for each row execute function public.handle_pending_invites_for_new_user();
