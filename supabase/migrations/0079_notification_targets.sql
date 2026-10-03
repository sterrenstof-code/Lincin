-- Meldingen over polls, calls en lijsten kwamen nooit aan.
--
-- De client schreef het id van de poll, de call of de lijst in `post_id`.
-- Die kolom verwijst naar `posts(id)`, dus elke insert faalde op de
-- foreign key — stil, want `createNotification` slikt de fout. Stemmen op je
-- poll, een tijdslot kiezen, uitgenodigd worden voor een call of een lijst:
-- niemand kreeg er ooit iets van te zien.
--
-- Elk soort krijgt zijn eigen kolom, met een echte verwijzing: verdwijnt de
-- poll, dan verdwijnt de melding mee.

alter table public.notifications
  add column if not exists poll_id uuid references public.polls(id) on delete cascade,
  add column if not exists call_plan_id uuid references public.call_plans(id) on delete cascade,
  add column if not exists list_id uuid references public.shared_lists(id) on delete cascade;

-- Wie een melding schrijft, is zelf de afzender. Stond op "elke ingelogde
-- gebruiker mag alles schrijven", dus iemand kon meldingen versturen uit
-- naam van een ander. De triggers zijn security definer en vallen hier
-- buiten.
drop policy if exists "notifications: authenticated insert" on public.notifications;
create policy "notifications: authenticated insert"
  on public.notifications for insert
  to authenticated
  with check (actor_id = auth.uid() and user_id <> auth.uid());

-- ---------------------------------------------------------------
-- Een vriend start een poll
-- ---------------------------------------------------------------
-- Net als een nieuwe bijdrage (`notify_friends_of_post`): je lincs horen
-- het. Alleen polls in de feed; een poll in een gesprek staat al als
-- bericht in dat gesprek en krijgt daar zijn melding.

create or replace function public.notify_friends_of_poll()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.chat_id is not null then
    return new;
  end if;
  insert into public.notifications (user_id, actor_id, type, poll_id)
  select af.user_id, new.user_id, 'friend_poll', new.id
    from public.accepted_friends af
   where af.friend_id = new.user_id
     and af.user_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists polls_notify_friends on public.polls;
create trigger polls_notify_friends
  after insert on public.polls
  for each row execute function public.notify_friends_of_poll();
