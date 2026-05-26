-- Storage bucket for profile-feed photos.
--
-- Bucket is PRIVATE: files are accessed via short-lived signed URLs generated
-- by the client. We enforce visibility through Storage RLS that mirrors the
-- `posts` table policy (only friends can read).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'posts',
  'posts',
  false,
  10 * 1024 * 1024, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Storage objects use `storage.objects` table. Path convention:
--   posts/<user_id>/<post_id>.<ext>
-- so we can extract the owner from the path with split_part.

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
