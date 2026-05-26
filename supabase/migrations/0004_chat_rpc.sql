-- RPC: get_or_create_direct_chat
--
-- Atomically returns the direct-chat ID between the caller and another user,
-- creating it (and both chat_members rows) if it doesn't exist yet. Avoids the
-- race condition of doing this client-side.
--
-- The function is SECURITY DEFINER so it can write chat_members rows for the
-- other user without violating the "add yourself" RLS policy. We carefully
-- guard with an auth.uid() check inside the function.

create or replace function public.get_or_create_direct_chat(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  chat uuid;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if me = other_user then
    raise exception 'cannot create direct chat with yourself';
  end if;

  -- Require an accepted friendship before allowing a direct chat.
  if not exists (
    select 1 from public.accepted_friends af
     where af.user_id = me and af.friend_id = other_user
  ) then
    raise exception 'not friends with %', other_user;
  end if;

  -- Try to find an existing direct chat where both are members.
  select c.id into chat
    from public.chats c
    join public.chat_members m1 on m1.chat_id = c.id and m1.user_id = me
    join public.chat_members m2 on m2.chat_id = c.id and m2.user_id = other_user
   where c.type = 'direct'
   limit 1;

  if chat is not null then
    return chat;
  end if;

  -- Create it.
  insert into public.chats (type, created_by) values ('direct', me)
    returning id into chat;
  insert into public.chat_members (chat_id, user_id, role) values
    (chat, me,        'owner'),
    (chat, other_user, 'member');

  return chat;
end;
$$;

grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;

-- ---------- enable Realtime on messages ----------
-- Supabase Realtime piggybacks on Postgres logical replication. We add the
-- messages table to the realtime publication so clients can subscribe to
-- INSERT events.

alter publication supabase_realtime add table public.messages;
