-- RPC: create_group_chat
--
-- Atomically creates a group chat plus chat_members rows for the creator and
-- all selected friends. Uses SECURITY DEFINER so it can insert chat_members
-- rows on behalf of the other users (bypassing the "add yourself" RLS rule),
-- but we strictly check that the caller is friends with every proposed member.

create or replace function public.create_group_chat(
  group_name text,
  member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  chat uuid;
  m uuid;
  trimmed text;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  trimmed := trim(coalesce(group_name, ''));
  if length(trimmed) = 0 then
    raise exception 'group name required';
  end if;
  if length(trimmed) > 64 then
    raise exception 'group name too long';
  end if;

  if member_ids is null or array_length(member_ids, 1) is null then
    raise exception 'at least one other member required';
  end if;

  -- Verify every proposed member (other than the caller) is an accepted friend.
  foreach m in array member_ids loop
    if m = me then
      continue;
    end if;
    if not exists (
      select 1 from public.accepted_friends af
        where af.user_id = me and af.friend_id = m
    ) then
      raise exception 'not friends with %', m;
    end if;
  end loop;

  insert into public.chats (type, name, created_by)
    values ('group', trimmed, me)
    returning id into chat;

  -- Owner row for the creator
  insert into public.chat_members (chat_id, user_id, role)
    values (chat, me, 'owner');

  -- Members
  foreach m in array member_ids loop
    if m = me then
      continue;
    end if;
    insert into public.chat_members (chat_id, user_id, role)
      values (chat, m, 'member')
      on conflict (chat_id, user_id) do nothing;
  end loop;

  return chat;
end;
$$;

grant execute on function public.create_group_chat(text, uuid[]) to authenticated;
