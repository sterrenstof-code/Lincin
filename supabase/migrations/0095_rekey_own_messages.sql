-- 0095 — alleen de afzender deelt een bericht met een nieuw lid (veiligheidscontrole okt 2026).
--
-- add_recipient_payload liet elk lid de eerste kopie van élk bericht voor
-- een nieuwkomer schrijven. Wie als eerste was, kon de nieuwkomer een
-- aangepaste versie van andermans bericht geven, nog altijd met de naam
-- van de echte afzender erbij. Nu schrijft alleen de afzender een kopie
-- van zijn eigen bericht. Wie iets mist, krijgt het zodra die afzender de
-- app opent (lib/api/rekey.ts, met de functie hieronder).

create or replace function public.add_recipient_payload(p_message_id uuid, p_user_id text, p_payload jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update messages
     set recipient_payloads = recipient_payloads || jsonb_build_object(p_user_id, p_payload)
   where id = p_message_id
     and sender_id = auth.uid()
     and not (recipient_payloads ? p_user_id)
     and exists (select 1 from chat_members m where m.chat_id = messages.chat_id and m.user_id::text = p_user_id);
$$;

-- Jouw berichten waar een huidig lid nog geen kopie van heeft.
create or replace function public.my_messages_missing_payloads(p_chat_id uuid default null, p_limit int default 200)
returns table(message_id uuid, chat_id uuid, missing uuid[])
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.chat_id, array_agg(cm.user_id)
    from messages m
    join chat_members cm on cm.chat_id = m.chat_id
   where m.sender_id = auth.uid()
     and (p_chat_id is null or m.chat_id = p_chat_id)
     and not (m.recipient_payloads ? cm.user_id::text)
   group by m.id, m.chat_id
   order by max(m.created_at) desc
   limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function public.my_messages_missing_payloads(uuid, int) from public, anon;
grant execute on function public.my_messages_missing_payloads(uuid, int) to authenticated;
