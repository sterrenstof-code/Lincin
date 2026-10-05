-- 0096 — een geheime belkamer per gesprek (veiligheidscontrole okt 2026).
--
-- De kamer bij 8x8 heette `lincin-<chat-id>`, zonder toegangsbewijs. Een
-- chat-id staat in adressen, meldingen en bij oud-leden, dus wie hem kende
-- kon een gesprek binnenlopen of vooraf bezetten. Nu heeft elk gesprek een
-- willekeurige kamernaam die alleen leden lezen (de RLS op chats), en die
-- verandert zodra iemand het gesprek verlaat of eruit gehaald wordt.

alter table public.chats
  add column if not exists call_room text not null default encode(extensions.gen_random_bytes(16), 'hex');

create or replace function public.chats_rotate_call_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats
     set call_room = encode(extensions.gen_random_bytes(16), 'hex')
   where id = old.chat_id;
  return old;
end;
$$;
revoke all on function public.chats_rotate_call_room() from public, anon, authenticated;

drop trigger if exists chat_members_rotate_call_room on public.chat_members;
create trigger chat_members_rotate_call_room
  after delete on public.chat_members
  for each row execute function public.chats_rotate_call_room();
