-- 0023_chat_hide_and_delete.sql
--
-- Twee features rond chat-management:
--
-- 1) Verberg gesprek voor mij (WhatsApp-archive-stijl).
--    Per-member kolom `hidden_at`. Filteren gebeurt client-side in
--    listMyChats: rij verschijnt opnieuw zodra last_message_at > hidden_at,
--    zodat een verborgen chat vanzelf terugkomt zodra de andere persoon
--    een nieuw bericht stuurt. Geen aparte unhide-flow nodig.
--
-- 2) Verwijder direct-chat voor iedereen.
--    Voor 1:1 chats mag elke member de hele chat-rij verwijderen — cascade
--    op `messages` en `chat_members` doet de rest. Voor groepen blijft dit
--    geblokkeerd; daar gebruik je `leaveChat` om jezelf eruit te halen.
--    De `created_by` FK heeft `on delete restrict` op `chats.created_by →
--    profiles.id`, maar dat blokkeert enkel profile-deletes, niet chat-
--    deletes — dus we zitten goed.

-- ---------- 1. hidden_at op chat_members ----------

alter table public.chat_members
  add column if not exists hidden_at timestamptz;

-- Snelle filter in listMyChats: WHERE hidden_at IS NULL OR
--   hidden_at < (SELECT last_message_at FROM chats WHERE id = chat_id).
-- Index helpt vooral als veel mensen veel chats verbergen — voor MVP is
-- het optioneel maar goedkoop om alvast neer te leggen.
create index if not exists chat_members_user_hidden_idx
  on public.chat_members (user_id, hidden_at);

-- RLS update — bestaande policy laat select toe, maar voor verbergen
-- moeten members hun eigen chat_members-rij kunnen updaten.
-- Check eerst of de policy al bestaat (idempotent her-runnen).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_members'
      and policyname = 'members update their own row'
  ) then
    create policy "members update their own row"
      on public.chat_members for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------- 2. delete-policy op chats (direct-only) ----------

-- Members van een 1:1 chat mogen die chat hard verwijderen voor beide
-- partijen. CASCADE-FKs op messages + chat_members ruimen de rest op.
-- Voor groups blijft delete geblokkeerd: gebruik leaveChat() of een
-- toekomstige group-owner-delete-flow.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chats'
      and policyname = 'members can delete direct chats'
  ) then
    create policy "members can delete direct chats"
      on public.chats for delete
      to authenticated
      using (
        chats.type = 'direct'
        and exists (
          select 1 from public.chat_members cm
          where cm.chat_id = chats.id
            and cm.user_id = auth.uid()
        )
      );
  end if;
end $$;
