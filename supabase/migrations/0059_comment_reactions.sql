-- 0059 — emoji onder een comment (HANDOFF 2.1 §Comment reactions).
--
-- Tot 2.0 bestonden reacties alleen op de bijdrage zelf (post_reactions).
-- Sinds 2.1 krijgt elke comment zijn eigen rij chips en een ☺-kiezer met
-- zes emoji. Dezelfde vorm als post_reactions: één rij per (comment,
-- gebruiker, emoji), zodat een tweede tik hem weer weghaalt.

create table if not exists public.comment_reactions (
  comment_id uuid not null references public.entity_comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

create index if not exists comment_reactions_comment_idx on public.comment_reactions(comment_id);

alter table public.comment_reactions enable row level security;

-- Lezen zoals de comments zelf: wie ingelogd is.
drop policy if exists "comment_reactions: authenticated read" on public.comment_reactions;
create policy "comment_reactions: authenticated read"
  on public.comment_reactions for select
  using (auth.role() = 'authenticated');

drop policy if exists "comment_reactions: react as yourself" on public.comment_reactions;
create policy "comment_reactions: react as yourself"
  on public.comment_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "comment_reactions: remove own" on public.comment_reactions;
create policy "comment_reactions: remove own"
  on public.comment_reactions for delete
  using (auth.uid() = user_id);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'comment_reactions'
  ) then
    alter publication supabase_realtime add table public.comment_reactions;
  end if;
end $$;
