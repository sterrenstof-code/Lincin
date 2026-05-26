-- Comments on posts
--
-- Visibility piggybacks on the posts RLS: if you can see the post (your own
-- or a friend's), you can see and write comments. The "can I see this post"
-- check happens via an EXISTS subquery against the RLS-filtered posts view.
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS + DROP POLICY IF EXISTS so
-- partial re-runs don't fail.

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_created_idx
  on public.comments (post_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "read comments on visible posts" on public.comments;
drop policy if exists "comment on posts you can see" on public.comments;
drop policy if exists "delete own comment or comment on own post" on public.comments;

-- Read: only on posts I can see (RLS on posts does the filtering).
create policy "read comments on visible posts"
  on public.comments for select
  to authenticated
  using (
    exists (select 1 from public.posts p where p.id = comments.post_id)
  );

-- Insert: must be me + on a post I can see.
create policy "comment on posts you can see"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = comments.post_id)
  );

-- Delete: by the comment author, OR by the post author (moderation).
create policy "delete own comment or comment on own post"
  on public.comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (
      select user_id from public.posts where id = comments.post_id
    )
  );

-- Enable Realtime so clients see new comments live. Safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;
end $$;

-- Force PostgREST to refresh its schema cache so the new table is callable
-- from the REST API immediately.
notify pgrst, 'reload schema';
