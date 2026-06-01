-- Emoji-reacties op feed-posts (niet op chatberichten — die staan in message_reactions)
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

create index if not exists post_reactions_post_idx on public.post_reactions(post_id);

alter table public.post_reactions enable row level security;

create policy "post_reactions: authenticated read"
  on public.post_reactions for select
  using (auth.role() = 'authenticated');

create policy "post_reactions: react as yourself"
  on public.post_reactions for insert
  with check (auth.uid() = user_id);

create policy "post_reactions: remove own"
  on public.post_reactions for delete
  using (auth.uid() = user_id);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'post_reactions'
  ) then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
end $$;
