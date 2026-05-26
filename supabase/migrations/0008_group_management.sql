-- Group chat management: owner can rename, add and remove members.
--
-- We restrict all new admin-style RLS to chat.type = 'group' so that direct
-- 1-on-1 chats stay locked at exactly two members.

-- ---------- owner can rename / update a group chat ----------
create policy "owner can update group chat"
  on public.chats for update
  to authenticated
  using (
    exists (
      select 1 from public.chat_members me
        join public.chats c on c.id = me.chat_id
       where me.chat_id = chats.id
         and me.user_id = auth.uid()
         and me.role = 'owner'
         and c.type = 'group'
    )
  )
  with check (
    exists (
      select 1 from public.chat_members me
        join public.chats c on c.id = me.chat_id
       where me.chat_id = chats.id
         and me.user_id = auth.uid()
         and me.role = 'owner'
         and c.type = 'group'
    )
  );

-- ---------- owner can remove other members ----------
create policy "owner can remove group chat members"
  on public.chat_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.chat_members me
        join public.chats c on c.id = me.chat_id
       where me.chat_id = chat_members.chat_id
         and me.user_id = auth.uid()
         and me.role = 'owner'
         and c.type = 'group'
    )
  );

-- ---------- RPC: add_chat_member ----------
--
-- Owner adds an accepted-friend to a group chat. SECURITY DEFINER lets us
-- insert the row on behalf of the target user; we still strictly validate.

create or replace function public.add_chat_member(
  p_chat_id uuid,
  p_user_id uuid
)
returns void
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

  -- The chat must exist and be a group chat.
  if not exists (
    select 1 from public.chats c
     where c.id = p_chat_id
       and c.type = 'group'
  ) then
    raise exception 'can only add members to a group chat';
  end if;

  -- Caller must be the owner of that chat.
  if not exists (
    select 1 from public.chat_members
     where chat_id = p_chat_id
       and user_id = me
       and role = 'owner'
  ) then
    raise exception 'not owner of this chat';
  end if;

  -- Target must be an accepted friend of the caller.
  if not exists (
    select 1 from public.accepted_friends af
     where af.user_id = me
       and af.friend_id = p_user_id
  ) then
    raise exception 'not friends with %', p_user_id;
  end if;

  insert into public.chat_members (chat_id, user_id, role)
    values (p_chat_id, p_user_id, 'member')
    on conflict (chat_id, user_id) do nothing;
end;
$$;

grant execute on function public.add_chat_member(uuid, uuid) to authenticated;
