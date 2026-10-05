-- Foto's en clips van bijdragen: lezen wie de bijdrage mag zien.
--
-- De regel "posts: select friends folder" keek alleen of de eigenaar van de
-- map je linc was. Een bijdrage die alleen voor één groep bedoeld is
-- (`audience_chat_id`, 0074) had daardoor zijn beeld open voor al je lincs,
-- ook wie niet in die groep zit — de bijdrage zelf zagen ze niet, de foto
-- wel (via een eigen ondertekende link).
--
-- Nu mag je een bestand lezen als een bijdrage, albumfoto of reactie die
-- jij mag zien er precies naar verwijst. De RLS van posts, post_images en
-- entity_comments beslist dus — dezelfde regels als voor de tekst. Bijkomend
-- effect: een beeld in een reactie van iemand die niet je linc is, onder een
-- bijdrage die je wel ziet, is nu ook te zien (dat liep vroeger op de map).
-- Je eigen map blijft altijd leesbaar ("posts: select own folder").

drop policy if exists "posts: select friends folder" on storage.objects;
drop policy if exists "posts: select visible media" on storage.objects;
create policy "posts: select visible media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'posts'
    and (
      exists (select 1 from public.posts p where p.image_path = objects.name or p.video_path = objects.name)
      or exists (select 1 from public.post_images i where i.image_path = objects.name)
      or exists (select 1 from public.entity_comments c where c.image_path = objects.name)
    )
  );

-- Elke handtekening loopt langs deze regel: op pad opzoeken moet snel zijn.
create index if not exists posts_image_path_idx on public.posts (image_path) where image_path is not null;
create index if not exists posts_video_path_idx on public.posts (video_path) where video_path is not null;
create index if not exists post_images_image_path_idx on public.post_images (image_path);
create index if not exists entity_comments_image_path_idx on public.entity_comments (image_path) where image_path is not null;
