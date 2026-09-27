-- Ongelezen tellen zonder alle berichten langs te lopen.
--
-- `my_chat_unread_counts` (0006) koppelde elk gesprek aan al zijn berichten
-- en filterde pas daarna op "nieuwer dan gelezen". Hij draaide als de
-- aanroeper, dus voor elk van die rijen liep ook de RLS-check
-- (`is_chat_member`) nog eens. De chatlijst vraagt hem op bij elk nieuw
-- bericht, bij iedereen die de app open heeft: werk dat meegroeit met de
-- hele geschiedenis, voor een getal dat meestal nul is.
--
-- Nu telt hij per gesprek alleen de berichten ná `last_read_at`, via de
-- index (chat_id, created_at) uit 0001. Security definer mag hier: het
-- filter `cm.user_id = auth.uid()` beperkt hem tot je eigen gesprekken,
-- precies wat RLS eerder deed.

create or replace function public.my_chat_unread_counts()
returns table(chat_id uuid, unread_count int)
language sql
stable
security definer
set search_path = public
as $$
  select
    cm.chat_id,
    (
      select count(*)::int
        from public.messages m
       where m.chat_id = cm.chat_id
         and m.created_at > coalesce(cm.last_read_at, '-infinity'::timestamptz)
         and m.sender_id <> cm.user_id
    ) as unread_count
  from public.chat_members cm
  where cm.user_id = auth.uid();
$$;

revoke all on function public.my_chat_unread_counts() from public;
grant execute on function public.my_chat_unread_counts() to authenticated;

notify pgrst, 'reload schema';
