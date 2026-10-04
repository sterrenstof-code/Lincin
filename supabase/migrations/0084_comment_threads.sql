-- 0084 — reacties zoals op Instagram (Bijdrage Voorbeeld, okt 2026).
--
--   1. Gesprekken binnen één reactie: `parent_id`, één niveau diep. Een
--      antwoord op een antwoord hangt onder dezelfde hoofdreactie.
--   2. Wie een bijdrage of poll maakte, mag elke reactie erop verwijderen.
--   3. Verbergen (voor jezelf) en rapporteren.
--   4. Meldingen: een antwoord gaat naar wie je antwoordt ("comment_reply"),
--      een hart op je reactie naar jou ("comment_like").

-- ---------------------------------------------------------------
-- 1. Draden
-- ---------------------------------------------------------------

alter table public.entity_comments
  add column if not exists parent_id uuid references public.entity_comments(id) on delete cascade;

comment on column public.entity_comments.parent_id is
  'De hoofdreactie waaronder dit antwoord hangt. Leeg = een hoofdreactie. Altijd één niveau diep.';

create index if not exists entity_comments_thread_idx
  on public.entity_comments (entity_type, entity_id, parent_id, created_at desc);

-- Een antwoord hoort bij dezelfde bijdrage als zijn hoofdreactie, en een
-- antwoord op een antwoord wordt een antwoord op de hoofdreactie.
create or replace function public.entity_comments_thread_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p public.entity_comments%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;
  select * into p from public.entity_comments where id = new.parent_id;
  if not found or p.entity_type <> new.entity_type or p.entity_id <> new.entity_id then
    raise exception 'parent_id hoort niet bij deze bijdrage';
  end if;
  if p.parent_id is not null then
    new.parent_id := p.parent_id;
  end if;
  return new;
end;
$$;

drop trigger if exists entity_comments_thread_parent on public.entity_comments;
create trigger entity_comments_thread_parent
  before insert on public.entity_comments
  for each row execute function public.entity_comments_thread_parent();

-- `parent_id` kan na het schrijven niet meer veranderen: alleen `body`
-- mag bijgewerkt worden (0080). Dat blijft zo.

-- ---------------------------------------------------------------
-- 2. Verwijderen: je eigen reactie, of elke reactie op wat jij maakte
-- ---------------------------------------------------------------

create or replace function public.owns_comment_target(p_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_type
    when 'post' then exists (select 1 from public.posts where id = p_id and user_id = auth.uid())
    when 'poll' then exists (select 1 from public.polls where id = p_id and user_id = auth.uid())
    else false
  end;
$$;

grant execute on function public.owns_comment_target(text, uuid) to authenticated;

drop policy if exists "entity_comments: own delete" on public.entity_comments;
drop policy if exists "entity_comments: own or on yours" on public.entity_comments;
create policy "entity_comments: own or on yours"
  on public.entity_comments for delete
  using (auth.uid() = user_id or public.owns_comment_target(entity_type, entity_id));

-- ---------------------------------------------------------------
-- 3. Verbergen en rapporteren
-- ---------------------------------------------------------------

create table if not exists public.comment_hides (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.entity_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

alter table public.comment_hides enable row level security;

drop policy if exists "comment_hides: own" on public.comment_hides;
create policy "comment_hides: own"
  on public.comment_hides for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.content_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  entity_comment_id uuid references public.entity_comments(id) on delete set null,
  post_id           uuid references public.posts(id) on delete set null,
  reason            text check (char_length(reason) <= 500),
  status            text not null default 'open' check (status in ('open', 'handled')),
  created_at        timestamptz not null default now()
);

alter table public.content_reports enable row level security;

drop policy if exists "content_reports: report as yourself" on public.content_reports;
create policy "content_reports: report as yourself"
  on public.content_reports for insert
  with check (reporter_id = auth.uid());

drop policy if exists "content_reports: see your own" on public.content_reports;
create policy "content_reports: see your own"
  on public.content_reports for select
  using (reporter_id = auth.uid());

-- ---------------------------------------------------------------
-- 4. Meldingen
-- ---------------------------------------------------------------

-- Een antwoord: wie je antwoordt krijgt "comment_reply" in plaats van de
-- algemene "comment_on_post"/"comment_on_thread" — één melding, niet twee.
create or replace function public.notify_comment_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_parent_author uuid;
begin
  if new.entity_type <> 'post' then
    return new;
  end if;

  select p.user_id into v_owner from public.posts p where p.id = new.entity_id;
  if v_owner is null then
    return new;
  end if;

  if new.parent_id is not null then
    select c.user_id into v_parent_author from public.entity_comments c where c.id = new.parent_id;
    if v_parent_author is not null and v_parent_author <> new.user_id then
      insert into public.notifications
        (user_id, actor_id, type, post_id, entity_comment_id)
      values
        (v_parent_author, new.user_id, 'comment_reply', new.entity_id, new.id);
    end if;
  end if;

  if v_owner <> new.user_id and v_owner is distinct from v_parent_author then
    insert into public.notifications
      (user_id, actor_id, type, post_id, entity_comment_id)
    values
      (v_owner, new.user_id, 'comment_on_post', new.entity_id, new.id);
  end if;

  insert into public.notifications
    (user_id, actor_id, type, post_id, entity_comment_id)
  select a.uid, new.user_id, 'comment_on_thread', new.entity_id, new.id
    from public.post_audience(new.entity_id, new.user_id) a
   where a.uid <> v_owner
     and a.uid is distinct from v_parent_author;

  return new;
end;
$$;

-- Een hart (of emoji) op je reactie. Eén melding per persoon per reactie.
create unique index if not exists notifications_comment_like_once
  on public.notifications (user_id, actor_id, type, entity_comment_id)
  where type = 'comment_like';

create or replace function public.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.entity_comments%rowtype;
begin
  select * into c from public.entity_comments where id = new.comment_id;
  if not found or c.user_id = new.user_id then
    return new;
  end if;
  insert into public.notifications
    (user_id, actor_id, type, post_id, poll_id, entity_comment_id, detail)
  values
    (c.user_id, new.user_id, 'comment_like',
     case when c.entity_type = 'post' then c.entity_id end,
     case when c.entity_type = 'poll' then c.entity_id end,
     c.id, new.emoji)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists comment_reactions_notify on public.comment_reactions;
create trigger comment_reactions_notify
  after insert on public.comment_reactions
  for each row execute function public.notify_comment_like();

-- Wie al zijn reacties op een reactie terugneemt, neemt ook de melding terug.
create or replace function public.withdraw_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.comment_reactions
     where comment_id = old.comment_id and user_id = old.user_id
  ) then
    delete from public.notifications
     where type = 'comment_like'
       and actor_id = old.user_id
       and entity_comment_id = old.comment_id;
  end if;
  return old;
end;
$$;

drop trigger if exists comment_reactions_withdraw on public.comment_reactions;
create trigger comment_reactions_withdraw
  after delete on public.comment_reactions
  for each row execute function public.withdraw_comment_like();
