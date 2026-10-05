-- 0092 — tweede veiligheidscontrole voor productie (okt 2026).
--
-- 1. Een eigen bericht bewerken mocht nog steeds chat_id, created_at en id
--    wijzigen: 0090 eiste enkel dat je lid bent van de nieuwe chat, dus een
--    bericht kon naar een andere chat van jezelf verhuizen of terug in de
--    tijd. Bewerken raakt alleen de versleutelde tekst en edited_at.
-- 2. Twee triggerfuncties zonder vaste search_path.

revoke update on public.messages from authenticated, anon;
grant update (recipient_payloads, edited_at) on public.messages to authenticated;

alter function public.entity_comments_mark_edited() set search_path = public;
alter function public.touch_bug_resolved_at() set search_path = public;

-- 3. invite-by-email telde rijen in pending_invites op created_at. Iemand
--    opnieuw uitnodigen werkte die rij enkel bij, dus dezelfde persoon kon
--    eindeloos gemaild worden; en tegelijk afgevuurde verzoeken telden
--    allemaal vóór er één bewaard was. Nu wordt elke verzending gelogd en in
--    één stap geteld en vastgelegd, onder een slot per uitnodiger en per adres.
create table if not exists public.invite_sends (
  id bigint generated always as identity primary key,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
create index if not exists invite_sends_inviter_idx on public.invite_sends (inviter_user_id, created_at);
create index if not exists invite_sends_email_idx on public.invite_sends (email, created_at);
alter table public.invite_sends enable row level security;
revoke all on public.invite_sends from anon, authenticated;

-- 'ok' = versturen; 'repeat' = dit adres kreeg van jou vandaag al een mail
-- (stil overslaan); 'limit' = te veel.
create or replace function public.claim_invite_send(p_inviter uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('invite:' || p_inviter::text));
  perform pg_advisory_xact_lock(hashtext('invite-to:' || p_email));

  if exists (select 1 from invite_sends
              where inviter_user_id = p_inviter and email = p_email
                and created_at > now() - interval '24 hours') then
    return 'repeat';
  end if;
  if (select count(*) from invite_sends
       where inviter_user_id = p_inviter and created_at > now() - interval '24 hours') >= 10
     or (select count(*) from pending_invites where inviter_user_id = p_inviter) >= 50
     -- Eén adres krijgt hooguit drie uitnodigingen per dag, van wie ook.
     or (select count(*) from invite_sends
          where email = p_email and created_at > now() - interval '24 hours') >= 3 then
    return 'limit';
  end if;

  insert into invite_sends (inviter_user_id, email) values (p_inviter, p_email);
  return 'ok';
end;
$$;
revoke all on function public.claim_invite_send(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_invite_send(uuid, text) to service_role;
