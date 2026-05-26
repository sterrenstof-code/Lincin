-- Chat attachments
--
-- Per-chat private storage voor foto's, video en losse bestanden.
-- Content is client-side versleuteld: server slaat enkel encrypted blobs op.
-- Path-conventie: `{chat_id}/{file_uuid}.bin`. De file_id staat geëncodeerd
-- in de message payload zelf (samen met sym-key + nonce per ontvanger).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  100 * 1024 * 1024, -- 100 MB per file (video-vriendelijk)
  null               -- alle mime types (we slaan encrypted bytes op anyway)
)
on conflict (id) do nothing;

-- Drop policies if they exist (idempotent re-run)
drop policy if exists "chat members read attachments" on storage.objects;
drop policy if exists "chat members upload attachments" on storage.objects;
drop policy if exists "chat members delete own attachments" on storage.objects;

create policy "chat members read attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chat_members cm
       where cm.user_id = auth.uid()
         and cm.chat_id::text = (storage.foldername(name))[1]
    )
  );

create policy "chat members upload attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.chat_members cm
       where cm.user_id = auth.uid()
         and cm.chat_id::text = (storage.foldername(name))[1]
    )
  );

create policy "chat members delete own attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and owner = auth.uid()
  );
