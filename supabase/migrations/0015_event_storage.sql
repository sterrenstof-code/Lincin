-- Event photo storage
--
-- Aparte bucket voor event-foto's: pad-conventie {event_id}/{user_id}/{uuid}.jpg
-- Toegang: event-members kunnen lezen/uploaden binnen events waar ze lid van zijn.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-photos',
  'event-photos',
  false,
  20 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "event members read event photos" on storage.objects;
drop policy if exists "event members upload event photos" on storage.objects;
drop policy if exists "users delete own event photos" on storage.objects;

create policy "event members read event photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_members em
       where em.user_id = auth.uid()
         and em.event_id::text = (storage.foldername(name))[1]
    )
  );

create policy "event members upload event photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-photos'
    and exists (
      select 1 from public.event_members em
       where em.user_id = auth.uid()
         and em.event_id::text = (storage.foldername(name))[1]
    )
    and auth.uid()::text = (storage.foldername(name))[2]
  );

create policy "users delete own event photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-photos'
    and owner = auth.uid()
  );

notify pgrst, 'reload schema';
