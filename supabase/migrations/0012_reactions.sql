-- Emoji-reacties op berichten
--
-- Reacties zijn opzettelijk NIET versleuteld — alleen één emoji-codepoint
-- per (user, message), wat metadata is en geen content. Zo kunnen we client-
-- side tellen en groeperen zonder per-reaction decryption.

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "see reactions in your chats" on public.message_reactions;
drop policy if exists "react as yourself" on public.message_reactions;
drop policy if exists "remove your own reactions" on public.message_reactions;

create policy "see reactions in your chats"
  on public.message_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.messages m
        join public.chat_members cm on cm.chat_id = m.chat_id
       where m.id = message_reactions.message_id
         and cm.user_id = auth.uid()
    )
  );

create policy "react as yourself"
  on public.message_reactions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
        join public.chat_members cm on cm.chat_id = m.chat_id
       where m.id = message_reactions.message_id
         and cm.user_id = auth.uid()
    )
  );

create policy "remove your own reactions"
  on public.message_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- Realtime aanzetten zodat reacties live verschijnen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

notify pgrst, 'reload schema';
