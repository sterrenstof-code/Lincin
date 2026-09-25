-- Een gesprek weer als ongelezen markeren, zoals in Telegram.
--
-- Gelezen werd alleen gezet door het gesprek te openen. Dit zet
-- `last_read_at` net vóór het laatste bericht van iemand anders, zodat
-- `my_chat_unread_counts` dat bericht (minstens één) weer als ongelezen telt.
-- Zonder bericht van een ander valt er niets ongelezen te maken.

create or replace function public.mark_chat_unread(p_chat_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_members cm
     set last_read_at = (
       select max(m.created_at) - interval '1 millisecond'
         from public.messages m
        where m.chat_id = p_chat_id
          and m.sender_id <> auth.uid()
     )
   where cm.chat_id = p_chat_id
     and cm.user_id = auth.uid()
     and exists (
       select 1 from public.messages m
        where m.chat_id = p_chat_id
          and m.sender_id <> auth.uid()
     );
$$;

revoke all on function public.mark_chat_unread(uuid) from public;
grant execute on function public.mark_chat_unread(uuid) to authenticated;

notify pgrst, 'reload schema';
