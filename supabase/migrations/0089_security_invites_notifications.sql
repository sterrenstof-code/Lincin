-- Veiligheidscontrole vóór productie (okt 2026).
--
-- 1. Uitnodigingen per e-mail
--    Iedereen met een account kon via de REST-API zelf rijen in
--    `pending_invites` zetten — voor elk adres, zonder dat er een mail
--    vertrok — en werd dan automatisch een aanvaarde linc van wie zich
--    later met dat adres aanmeldde, ook als die nooit een uitnodiging zag.
--    Nu schrijft alleen de functie `invite-by-email` (service role) hier,
--    en wordt een uitnodiging alleen meteen een linc als je je via een
--    uitnodigingsmail aanmeldde en er precies één uitnodiger is. In alle
--    andere gevallen wordt het een gewoon verzoek dat je zelf aanvaardt.

drop policy if exists "inviter creates invite" on public.pending_invites;

create or replace function public.handle_pending_invites_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  was_invited boolean;
  inviters uuid[];
  inviter uuid;
  direct boolean;
begin
  select email, invited_at is not null into user_email, was_invited from auth.users where id = new.id;
  if user_email is null then
    return new;
  end if;

  select array_agg(distinct inviter_user_id) into inviters
    from public.pending_invites
   where lower(email) = lower(user_email);
  if inviters is null then
    return new;
  end if;

  direct := was_invited and array_length(inviters, 1) = 1;
  foreach inviter in array inviters loop
    insert into public.friendships (requester_id, addressee_id, status, accepted_at)
      values (inviter, new.id, case when direct then 'accepted' else 'pending' end, case when direct then now() end)
      on conflict (requester_id, addressee_id) do nothing;
  end loop;

  delete from public.pending_invites where lower(email) = lower(user_email);
  return new;
end;
$$;

-- 2. Meldingen schrijven vanuit de app
--    De app schrijft zelf maar vijf soorten meldingen; de rest komt uit
--    triggers (security definer, buiten RLS). De oude regel liet elke
--    ingelogde gebruiker een melding maken voor wie dan ook, met eigen
--    tekst (`detail`) en een verwijzing naar elke bijdrage, poll, lijst of
--    reactie — en `send-push` las die inhoud dan met de service role en
--    stuurde hem als push naar de ontvanger. Nu:
--      - alleen die vijf soorten, zonder `detail`, reactie of event;
--      - alleen naar een linc of iemand met wie je een gesprek deelt;
--      - en alleen over iets wat bij jou of de ontvanger hoort (een poll
--        of call van de ontvanger, een lijst of call van jou, een bijdrage
--        die jij mag zien).

create or replace function public.notification_insert_ok(
  p_actor uuid, p_user uuid, p_type text,
  p_post uuid, p_poll uuid, p_list uuid, p_call uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_type in ('invited_to_list', 'invited_to_call', 'vote_on_call', 'mention', 'vote_on_poll')
    and (
      exists (select 1 from friendships f
               where f.status = 'accepted'
                 and ((f.requester_id = p_actor and f.addressee_id = p_user)
                   or (f.requester_id = p_user and f.addressee_id = p_actor)))
      or exists (select 1 from chat_members a join chat_members b on b.chat_id = a.chat_id
                  where a.user_id = p_actor and b.user_id = p_user)
    )
    and (p_poll is null or exists (select 1 from polls where id = p_poll and user_id = p_user))
    and (p_list is null or exists (select 1 from shared_lists where id = p_list and user_id = p_actor))
    and (p_call is null or exists (select 1 from call_plans where id = p_call and user_id in (p_actor, p_user)))
$$;

revoke all on function public.notification_insert_ok(uuid, uuid, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.notification_insert_ok(uuid, uuid, text, uuid, uuid, uuid, uuid) to authenticated;

drop policy if exists "notifications: authenticated insert" on public.notifications;
create policy "notifications: authenticated insert"
  on public.notifications for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and user_id <> auth.uid()
    and detail is null
    and entity_comment_id is null
    and event_id is null
    and bug_report_id is null
    -- een bijdrage: alleen een die jij zelf mag zien (RLS van posts geldt hier)
    and (post_id is null or exists (select 1 from public.posts p where p.id = post_id))
    and public.notification_insert_ok(actor_id, user_id, type, post_id, poll_id, list_id, call_plan_id)
  );
