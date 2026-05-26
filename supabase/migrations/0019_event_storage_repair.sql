-- Idempotente repair voor de event-photos bucket + video MIME types.
-- Run wanneer je "new row violates row-level security policy" krijgt bij
-- het uploaden van foto's of video's naar een event.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-photos',
  'event-photos',
  false,
  100 * 1024 * 1024, -- 100 MB voor video's
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

drop policy if exists "event members read event photos" on storage.objects;
drop policy if exists "event members upload event photos" on storage.objects;
drop policy if exists "users delete own event photos" on storage.objects;

create policy "event-photos: read for event members"
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

create policy "event-photos: upload for event members"
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

create policy "event-photos: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-photos'
    and owner = auth.uid()
  );

-- Repareer host-memberships: zorg dat elke event-host een event_members rij
-- heeft (klassieke "race in createEvent" preventie).
insert into public.event_members (event_id, user_id, role)
select id, host_user_id, 'host'
  from public.events
 where not exists (
   select 1 from public.event_members em
    where em.event_id = events.id and em.user_id = events.host_user_id
 )
on conflict (event_id, user_id) do nothing;

notify pgrst, 'reload schema';
