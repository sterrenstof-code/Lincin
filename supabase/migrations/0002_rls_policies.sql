-- Row Level Security policies for Comm App
--
-- General principle: clients can only ever see and modify data that belongs to
-- them, or that is shared with them via friendship / chat membership. The
-- server NEVER sees plaintext message content (only ciphertext jsonb).

-- ---------- enable RLS ----------
alter table public.profiles      enable row level security;
alter table public.friendships   enable row level security;
alter table public.chats         enable row level security;
alter table public.chat_members  enable row level security;
alter table public.messages      enable row level security;
alter table public.posts         enable row level security;

-- ---------- profiles ----------
-- Anyone authenticated can read other profiles (needed for friend search and
-- pubkey lookup), but only the owner may insert/update their own row.
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- friendships ----------
create policy "see friendships you're part of"
  on public.friendships for select
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

create policy "send a friend request as yourself"
  on public.friendships for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "addressee can accept or decline"
  on public.friendships for update
  to authenticated
  using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));

create policy "either party can delete the friendship"
  on public.friendships for delete
  to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- ---------- chats & chat_members ----------
create policy "see chats you're a member of"
  on public.chats for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
       where cm.chat_id = chats.id
         and cm.user_id = auth.uid()
    )
  );

create policy "create chats as yourself"
  on public.chats for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "see members of chats you're in"
  on public.chat_members for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members me
       where me.chat_id = chat_members.chat_id
         and me.user_id = auth.uid()
    )
  );

create policy "add yourself as a chat member"
  on public.chat_members for insert
  to authenticated
  with check (
    -- you can add yourself, OR you can add others if you're the chat owner
    user_id = auth.uid()
    or exists (
      select 1 from public.chat_members me
       where me.chat_id = chat_members.chat_id
         and me.user_id = auth.uid()
         and me.role = 'owner'
    )
  );

create policy "leave a chat (delete your own membership)"
  on public.chat_members for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------- messages ----------
create policy "read messages from chats you're in"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.chat_members cm
       where cm.chat_id = messages.chat_id
         and cm.user_id = auth.uid()
    )
  );

create policy "send messages to chats you're in"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.chat_members cm
       where cm.chat_id = messages.chat_id
         and cm.user_id = auth.uid()
    )
  );

-- Messages are immutable. Allow delete only by sender (best-effort, server
-- can't actually delete ciphertext from recipient devices but it gets the
-- row out of the DB).
create policy "sender can delete own message"
  on public.messages for delete
  to authenticated
  using (auth.uid() = sender_id);

-- ---------- posts ----------
-- A post is visible to its author and to anyone who is an accepted friend.
create policy "see your own posts and posts from accepted friends"
  on public.posts for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.accepted_friends af
       where af.user_id = auth.uid()
         and af.friend_id = posts.user_id
    )
  );

create policy "create posts as yourself"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "delete your own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);
