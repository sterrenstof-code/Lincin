-- Universele comments voor elk type entiteit (post, poll, call_plan, list)
-- entity_type: 'post' | 'poll' | 'call_plan' | 'list'
-- entity_id: uuid van de betreffende rij

create table if not exists public.entity_comments (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('post', 'poll', 'call_plan', 'list')),
  entity_id   uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists entity_comments_entity_idx
  on public.entity_comments (entity_type, entity_id, created_at);

alter table public.entity_comments enable row level security;

create policy "entity_comments: authenticated read"
  on public.entity_comments for select
  using (auth.role() = 'authenticated');

create policy "entity_comments: authenticated insert"
  on public.entity_comments for insert
  with check (auth.uid() = user_id);

create policy "entity_comments: own delete"
  on public.entity_comments for delete
  using (auth.uid() = user_id);

-- Realtime zodat reacties live verschijnen
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'entity_comments'
  ) then
    alter publication supabase_realtime add table public.entity_comments;
  end if;
end $$;
