-- Gedeelde lijsten (bucketlist, wishlist, to-do, ...)
create table if not exists public.shared_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  emoji       text not null default '📋',
  created_at  timestamptz not null default now()
);

create table if not exists public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.shared_lists(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  checked     boolean not null default false,
  checked_by  uuid references auth.users(id) on delete set null,
  checked_at  timestamptz,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Wie heeft toegang? Lijst-leden
create table if not exists public.list_members (
  list_id    uuid not null references public.shared_lists(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  primary key (list_id, user_id)
);

create index if not exists list_items_list_idx on public.list_items(list_id, position);
create index if not exists list_members_user_idx on public.list_members(user_id);

alter table public.shared_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.list_members enable row level security;

-- Maker of lid mag lijst zien
create policy "shared_lists: member read"
  on public.shared_lists for select
  using (
    auth.uid() = user_id or
    exists (select 1 from public.list_members where list_id = id and user_id = auth.uid())
  );

create policy "shared_lists: authenticated insert"
  on public.shared_lists for insert
  with check (auth.uid() = user_id);

create policy "shared_lists: owner delete"
  on public.shared_lists for delete
  using (auth.uid() = user_id);

create policy "shared_lists: owner update"
  on public.shared_lists for update
  using (auth.uid() = user_id);

-- Items: leden mogen lezen/schrijven/aanvinken
create policy "list_items: member read"
  on public.list_items for select
  using (
    exists (
      select 1 from public.shared_lists sl
      left join public.list_members lm on lm.list_id = sl.id
      where sl.id = list_items.list_id
        and (sl.user_id = auth.uid() or lm.user_id = auth.uid())
    )
  );

create policy "list_items: member insert"
  on public.list_items for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.shared_lists sl
      left join public.list_members lm on lm.list_id = sl.id
      where sl.id = list_id
        and (sl.user_id = auth.uid() or lm.user_id = auth.uid())
    )
  );

create policy "list_items: member update"
  on public.list_items for update
  using (
    exists (
      select 1 from public.shared_lists sl
      left join public.list_members lm on lm.list_id = sl.id
      where sl.id = list_items.list_id
        and (sl.user_id = auth.uid() or lm.user_id = auth.uid())
    )
  );

create policy "list_items: owner or author delete"
  on public.list_items for delete
  using (
    auth.uid() = user_id or
    exists (select 1 from public.shared_lists where id = list_id and user_id = auth.uid())
  );

create policy "list_members: member read"
  on public.list_members for select
  using (
    exists (
      select 1 from public.shared_lists sl
      left join public.list_members lm on lm.list_id = sl.id
      where sl.id = list_id
        and (sl.user_id = auth.uid() or lm.user_id = auth.uid())
    )
  );

create policy "list_members: owner insert"
  on public.list_members for insert
  with check (
    exists (select 1 from public.shared_lists where id = list_id and user_id = auth.uid())
  );

create policy "list_members: owner delete"
  on public.list_members for delete
  using (
    auth.uid() = user_id or
    exists (select 1 from public.shared_lists where id = list_id and user_id = auth.uid())
  );

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'list_items'
  ) then
    alter publication supabase_realtime add table public.list_items;
  end if;
end $$;
