-- Unread message tracking
--
-- We add a `last_read_at` per chat_member so we can compute unread counts
-- without storing per-message read receipts. Two helper functions:
--   * mark_chat_read(p_chat_id) — caller marks a chat as read up to now()
--   * my_chat_unread_counts()    — returns (chat_id, unread_count) for caller

alter table public.chat_members
  add column if not exists last_read_at timestamptz;

-- ---------- mark_chat_read ----------
create or replace function public.mark_chat_read(p_chat_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.chat_members
     set last_read_at = now()
   where chat_id = p_chat_id
     and user_id = auth.uid();
$$;

grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------- my_chat_unread_counts ----------
create or replace function public.my_chat_unread_counts()
returns table(chat_id uuid, unread_count int)
language sql
security invoker
set search_path = public
as $$
  select
    cm.chat_id,
    count(m.id) filter (
      where m.sender_id <> cm.user_id
        and m.created_at > coalesce(cm.last_read_at, '1970-01-01'::timestamptz)
    )::int as unread_count
  from public.chat_members cm
  left join public.messages m on m.chat_id = cm.chat_id
  where cm.user_id = auth.uid()
  group by cm.chat_id;
$$;

grant execute on function public.my_chat_unread_counts() to authenticated;
