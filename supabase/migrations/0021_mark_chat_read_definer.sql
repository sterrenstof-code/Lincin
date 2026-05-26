-- Fix: mark_chat_read updatte stilletjes 0 rijen omdat er geen RLS UPDATE
-- policy bestaat op chat_members. De caller is wel select-bevoegd, maar
-- niet update-bevoegd, dus de UPDATE deed niets en last_read_at bleef hangen
-- op de oude waarde. Gevolg: badge bleef op N staan na het openen van een
-- chat.
--
-- Oplossing: zet de functie op `security definer`. Dat is veilig want we
-- filteren intern op `auth.uid()`, dus een caller kan alleen zijn eigen
-- chat_members-rij updaten. Beter dan een algemene UPDATE policy
-- toevoegen op chat_members (die zou ook andere kolommen openen voor
-- self-update).

create or replace function public.mark_chat_read(p_chat_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_members
     set last_read_at = now()
   where chat_id = p_chat_id
     and user_id = auth.uid();
$$;

revoke all on function public.mark_chat_read(uuid) from public;
grant execute on function public.mark_chat_read(uuid) to authenticated;

notify pgrst, 'reload schema';
