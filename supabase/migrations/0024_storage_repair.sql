-- Storage policies repair voor `posts` bucket
--
-- Run als je "The database schema is invalid or incompatible" krijgt bij
-- het uploaden van een foto. Drops + re-creates de policies en herlaadt
-- de PostgREST schema-cache zodat alles weer aanlijnt.
--
-- Idempotent: veilig te herhalen.

-- Zorg dat de bucket bestaat
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Kuis oude policies op
drop policy if exists "users upload to their own folder" on storage.objects;
drop policy if exists "users read their own files" on storage.objects;
drop policy if exists "friends can read each other's posts" on storage.objects;
drop policy if exists "users delete their own files" on storage.objects;

-- Re-installeer policies
create policy "users upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users read their own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "friends can read each other's posts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'posts'
    and exists (
      select 1 from public.accepted_friends af
       where af.user_id = auth.uid()
         and af.friend_id::text = (storage.foldername(name))[1]
    )
  );

create policy "users delete their own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

notify pgrst, 'reload schema';
