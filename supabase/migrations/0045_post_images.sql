-- Meerdere foto's onder één vondst: een album.
--
-- ---------------------------------------------------------------
-- WAAROM EEN APARTE TABEL EN GEEN "ALBUMS"
-- ---------------------------------------------------------------
-- Een album is geen ander soort ding dan een vondst: het heeft dezelfde
-- auteur, hetzelfde onderschrift, dezelfde reacties, dezelfde plek in de
-- feed. Alleen het aantal foto's verschilt. Een aparte albumtabel zou al
-- die dingen moeten dupliceren — reacties op een album, meldingen over een
-- album, een album in de feed — voor precies één verschil.
--
-- Dus: de vondst blijft de vondst, en de extra foto's hangen eronder.
-- `posts.image_path` blijft de omslag, zodat alles wat vandaag met één
-- foto werkt ongewijzigd blijft werken; wie het album wil zien, leest deze
-- tabel erbij.
create table if not exists public.post_images (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  image_path text not null,
  -- Volgorde zoals de maker ze koos; 0 is de omslag.
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists post_images_post_idx on public.post_images(post_id, position);

alter table public.post_images enable row level security;

-- Zichtbaar precies wanneer de vondst zelf zichtbaar is. Niet overgeschreven
-- maar overgenomen: de regel staat op één plek (posts) en deze tabel
-- verwijst ernaar, dus een wijziging daar geldt hier vanzelf.
drop policy if exists "post_images: read with post" on public.post_images;
create policy "post_images: read with post"
  on public.post_images for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_images.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.accepted_friends af
            where af.user_id = auth.uid() and af.friend_id = p.user_id
          )
        )
    )
  );

drop policy if exists "post_images: own insert" on public.post_images;
create policy "post_images: own insert"
  on public.post_images for insert
  with check (
    exists (select 1 from public.posts p where p.id = post_images.post_id and p.user_id = auth.uid())
  );

drop policy if exists "post_images: own delete" on public.post_images;
create policy "post_images: own delete"
  on public.post_images for delete
  using (
    exists (select 1 from public.posts p where p.id = post_images.post_id and p.user_id = auth.uid())
  );
