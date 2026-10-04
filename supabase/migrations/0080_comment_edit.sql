-- 0080 — je eigen comment aanpassen.
--
-- Tot nu toe kon een comment alleen geschreven en gewist worden. Nu mag
-- de schrijver de tekst ervan aanpassen — en alléén de tekst: waar hij
-- onder staat, van wie hij is en wanneer hij geschreven werd blijven vast.
-- Dat regelt de kolomrechten hieronder, niet de app.
--
-- `edited_at` wordt door de database gezet zodra de tekst verandert, zodat
-- de app "bewerkt" kan tonen zonder dat iemand die stempel zelf kan zetten.

alter table public.entity_comments
  add column if not exists edited_at timestamptz;

comment on column public.entity_comments.edited_at is
  'Wanneer de schrijver de tekst het laatst aanpaste. Leeg = nooit aangepast. Gezet door de trigger.';

drop policy if exists "entity_comments: own update" on public.entity_comments;
create policy "entity_comments: own update"
  on public.entity_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.entity_comments from anon, authenticated;
grant update (body) on public.entity_comments to authenticated;

create or replace function public.entity_comments_mark_edited()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists entity_comments_mark_edited on public.entity_comments;
create trigger entity_comments_mark_edited
  before update on public.entity_comments
  for each row execute function public.entity_comments_mark_edited();
