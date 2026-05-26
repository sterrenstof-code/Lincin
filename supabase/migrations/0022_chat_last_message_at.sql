-- Voeg een denormalized `last_message_at` toe op chats voor snelle sortering
-- in de chatlijst zonder dat we de messages-tabel hoeven te group-by-en.
-- Een trigger houdt het bij; backfill met de bestaande data.

alter table public.chats
  add column if not exists last_message_at timestamptz;

-- Backfill: voor elke chat de MAX(created_at) uit messages, met fallback
-- naar de chat-creation-time zelf zodat lege chats niet helemaal onderaan
-- verdwijnen.
update public.chats c
   set last_message_at = coalesce(
     (select max(created_at) from public.messages m where m.chat_id = c.id),
     c.created_at
   )
 where last_message_at is null;

-- Trigger-functie: update chats.last_message_at na elke nieuwe message.
create or replace function public.touch_chat_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats
     set last_message_at = new.created_at
   where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_last_message_at on public.messages;
create trigger trg_touch_chat_last_message_at
  after insert on public.messages
  for each row
  execute function public.touch_chat_last_message_at();

-- Index voor snelle sorting in de chatlijst.
create index if not exists chats_last_message_at_idx
  on public.chats (last_message_at desc nulls last);

notify pgrst, 'reload schema';
