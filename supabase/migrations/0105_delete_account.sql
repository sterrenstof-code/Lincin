-- 0105 — je account verwijderen (nov 2026).
--
-- Er was geen manier om je account te wissen (AVG art. 17). De Edge
-- Function `delete-account` doet het nu: eerst je bestanden uit de opslag,
-- dan de gebruiker zelf; al je rijen hangen met `on delete cascade` aan
-- auth.users of profiles en verdwijnen mee.
--
-- Eén vreemde eend: chats.created_by stond op RESTRICT, dus wie ooit een
-- gesprek begon kon niet gewist worden. Het gesprek blijft voor de anderen;
-- de maker wordt leeg.

alter table public.chats alter column created_by drop not null;
alter table public.chats drop constraint if exists chats_created_by_fkey;
alter table public.chats
  add constraint chats_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- Vóór het wissen: groepen waar jij eigenaar bent krijgen een nieuwe
-- eigenaar (wie er het langst in zit), en de lijst van je bestanden.
create or replace function public.prepare_account_deletion(p_user uuid)
returns table (bucket_id text, name text)
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  update public.chat_members m
     set role = 'owner'
   where (m.chat_id, m.user_id) in (
     select distinct on (o.chat_id) o.chat_id, o.user_id
       from public.chat_members mine
       join public.chats c on c.id = mine.chat_id and c.type = 'group'
       join public.chat_members o on o.chat_id = mine.chat_id and o.user_id <> p_user
      where mine.user_id = p_user and mine.role = 'owner'
        and not exists (select 1 from public.chat_members x where x.chat_id = mine.chat_id and x.role = 'owner' and x.user_id <> p_user)
      order by o.chat_id, o.joined_at
   );

  return query
  select o.bucket_id::text, o.name::text
    from storage.objects o
   where o.owner = p_user
      or (o.bucket_id in ('posts', 'avatars') and (storage.foldername(o.name))[1] = p_user::text);
end;
$$;
revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
