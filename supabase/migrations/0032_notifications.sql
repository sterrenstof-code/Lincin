-- Notifications table
-- type: 'comment_on_post'   → someone commented on your post
--        'comment_on_thread' → someone commented on a post you also commented on

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  actor_id     uuid not null references auth.users(id) on delete cascade,
  type         text not null,          -- 'comment_on_post' | 'comment_on_thread'
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.comments(id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

-- RLS
alter table public.notifications enable row level security;

-- Users can only read their own notifications
create policy "notifications: own read"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Authenticated users can insert notifications for others
create policy "notifications: authenticated insert"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- Users can mark their own as read
create policy "notifications: own update"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Users can delete their own
create policy "notifications: own delete"
  on public.notifications for delete
  using (auth.uid() = user_id);
