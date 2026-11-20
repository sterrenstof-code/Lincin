-- 0106 — iemand blokkeren (nov 2026).
--
-- Voor de App Store (richtlijn 1.2, inhoud van gebruikers) moet je iemand
-- kunnen blokkeren. `friendship_status` kende 'blocked' al, maar niets zette
-- het. Nu:
--   block_user(id)    jullie zijn geen lincs meer (dus elkaars bijdragen
--                     weg), openstaande verzoeken weg, jij verlaat jullie
--                     één-op-één-gesprek, en hij kan je geen verzoek meer
--                     sturen;
--   unblock_user(id)  de blokkade weg; daarna kunnen jullie opnieuw lincs
--                     worden zoals altijd.
-- De rij (blokkeerder → geblokkeerde) is alleen zichtbaar en wisbaar voor
-- wie blokkeerde: de ander ziet niet dat hij geblokkeerd is.

create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_user = me then raise exception 'cannot block yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'user not found'; end if;

  delete from public.friendships
   where (requester_id = me and addressee_id = p_user) or (requester_id = p_user and addressee_id = me);
  insert into public.friendships (requester_id, addressee_id, status) values (me, p_user, 'blocked');

  delete from public.chat_members m
   using public.chats c
   where c.id = m.chat_id and c.type = 'direct' and m.user_id = me
     and exists (select 1 from public.chat_members o where o.chat_id = c.id and o.user_id = p_user);
end;
$$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friendships
   where requester_id = auth.uid() and addressee_id = p_user and status = 'blocked';
$$;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.unblock_user(uuid) to authenticated;

-- Wie jij blokkeerde (voor Instellingen → Geblokkeerd).
create or replace function public.my_blocked_users()
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_url
    from public.friendships f join public.profiles p on p.id = f.addressee_id
   where f.requester_id = auth.uid() and f.status = 'blocked'
   order by f.created_at desc;
$$;
revoke all on function public.my_blocked_users() from public, anon;
grant execute on function public.my_blocked_users() to authenticated;

-- Een blokkade zien en opheffen kan alleen wie blokkeerde.
drop policy if exists "see friendships you're part of" on public.friendships;
create policy "see friendships you're part of" on public.friendships
  for select to authenticated
  using (auth.uid() = requester_id or (auth.uid() = addressee_id and status <> 'blocked'));
drop policy if exists "either party can delete the friendship" on public.friendships;
create policy "either party can delete the friendship" on public.friendships
  for delete to authenticated
  using (auth.uid() = requester_id or (auth.uid() = addressee_id and status <> 'blocked'));

-- Geen verzoek naar of van iemand met een blokkade ertussen. In de trigger
-- van 0102, omdat de insert-policy de rij van de ander niet ziet.
create or replace function public.friendships_limit_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'pending' or auth.uid() is null or new.requester_id <> auth.uid() then
    return new;
  end if;
  if exists (
    select 1 from public.friendships
     where status = 'blocked'
       and ((requester_id = new.requester_id and addressee_id = new.addressee_id)
         or (requester_id = new.addressee_id and addressee_id = new.requester_id))
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('friendreq:' || new.requester_id::text));
  if exists (
    select 1 from public.friend_request_log
     where requester_id = new.requester_id and addressee_id = new.addressee_id
       and created_at > now() - interval '24 hours'
  ) then
    raise exception 'friend request rate limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if (select count(*) from public.friend_request_log
       where requester_id = new.requester_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'friend request rate limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.friend_request_log (requester_id, addressee_id) values (new.requester_id, new.addressee_id);
  return new;
end;
$$;
