-- Fix infinite recursion in chat_members RLS — zelfde patroon als 0016 voor
-- event_members. chat_members SELECT policy queryt zichzelf via een EXISTS,
-- wat de policy opnieuw triggert → recursie → 500. Ook chats/messages/reacties
-- queryen chat_members en breken mee.
--
-- Fix: SECURITY DEFINER helper functies om de check buiten RLS te doen.

create or replace function public.is_chat_member(p_chat_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.chat_members
     where chat_id = p_chat_id and user_id = auth.uid()
  );
$$;
grant execute on function public.is_chat_member(uuid) to authenticated;

create or replace function public.is_chat_owner(p_chat_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.chat_members
     where chat_id = p_chat_id
       and user_id = auth.uid()
       and role = 'owner'
  );
$$;
grant execute on function public.is_chat_owner(uuid) to authenticated;

-- ---------- chat_members ----------
drop policy if exists "see members of chats you're in" on public.chat_members;
create policy "see members of chats you're in"
  on public.chat_members for select
  to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists "add yourself as a chat member" on public.chat_members;
create policy "add yourself as a chat member"
  on public.chat_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_chat_owner(chat_id)
  );

drop policy if exists "leave a chat (delete your own membership)" on public.chat_members;
drop policy if exists "leave a chat" on public.chat_members;
create policy "leave a chat"
  on public.chat_members for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "owner can remove group chat members" on public.chat_members;
create policy "owner can remove group chat members"
  on public.chat_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.chats c
       where c.id = chat_members.chat_id
         and c.type = 'group'
    )
    and public.is_chat_owner(chat_id)
  );

-- ---------- chats ----------
drop policy if exists "see chats you're a member of" on public.chats;
create policy "see chats you're a member of"
  on public.chats for select
  to authenticated
  using (public.is_chat_member(id));

drop policy if exists "owner can update group chat" on public.chats;
create policy "owner can update group chat"
  on public.chats for update
  to authenticated
  using (type = 'group' and public.is_chat_owner(id))
  with check (type = 'group' and public.is_chat_owner(id));

-- ---------- messages ----------
drop policy if exists "read messages from chats you're in" on public.messages;
create policy "read messages from chats you're in"
  on public.messages for select
  to authenticated
  using (public.is_chat_member(chat_id));

drop policy if exists "send messages to chats you're in" on public.messages;
create policy "send messages to chats you're in"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and public.is_chat_member(chat_id)
  );

-- ---------- message_reactions ----------
drop policy if exists "see reactions in your chats" on public.message_reactions;
create policy "see reactions in your chats"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
       where m.id = message_reactions.message_id
         and public.is_chat_member(m.chat_id)
    )
  );

drop policy if exists "react as yourself" on public.message_reactions;
create policy "react as yourself"
  on public.message_reactions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
       where m.id = message_reactions.message_id
         and public.is_chat_member(m.chat_id)
    )
  );

notify pgrst, 'reload schema';
