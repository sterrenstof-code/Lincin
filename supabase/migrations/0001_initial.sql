-- Comm App: initial schema
-- Run this in Supabase SQL editor, OR via:
--   supabase db push   (if using the local CLI)
--
-- Notes:
--   * `profiles.id` mirrors auth.users.id so we can RLS on auth.uid()
--   * `messages.recipient_payloads` is jsonb keyed by recipient user_id;
--     the server never sees plaintext, only ciphertext.
--   * timestamps are timestamptz with default now()

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null check (char_length(username) between 3 and 32),
  display_name    text,
  avatar_url      text,
  identity_pubkey text not null, -- base64(X25519 public key)
  created_at      timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (lower(username));

-- ---------- friendships ----------
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

-- Helper view: every accepted friendship in BOTH directions.
create view public.accepted_friends as
  select requester_id as user_id, addressee_id as friend_id
    from public.friendships
   where status = 'accepted'
  union all
  select addressee_id as user_id, requester_id as friend_id
    from public.friendships
   where status = 'accepted';

-- ---------- chats ----------
create type public.chat_type as enum ('direct', 'group');

create table public.chats (
  id         uuid primary key default gen_random_uuid(),
  type       public.chat_type not null,
  name       text, -- null for direct chats
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.chat_members (
  chat_id   uuid not null references public.chats(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index chat_members_user_idx on public.chat_members (user_id);

-- ---------- messages ----------
create table public.messages (
  id                 uuid primary key default gen_random_uuid(),
  chat_id            uuid not null references public.chats(id) on delete cascade,
  sender_id          uuid not null references public.profiles(id) on delete cascade,
  recipient_payloads jsonb not null,
  created_at         timestamptz not null default now()
);

create index messages_chat_created_idx
  on public.messages (chat_id, created_at desc);

-- ---------- posts ----------
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  image_path text not null, -- path inside the 'posts' storage bucket
  caption    text,
  created_at timestamptz not null default now()
);

create index posts_user_created_idx
  on public.posts (user_id, created_at desc);
