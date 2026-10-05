-- 0094 — de privésleutel op de server alleen nog versleuteld (veiligheidscontrole okt 2026).
--
-- `private_keys.privkey` stond leesbaar op de server: wie bij de database
-- kon, las elk gesprek. Nu bewaart de app hier `wrapped`: de sleutel
-- versleuteld met een herstelcode die alleen de gebruiker heeft
-- (lib/crypto/recovery.ts). Een leesbare sleutel kan er niet meer bij;
-- wat er nog staat, wist de app zodra die persoon zijn code bewaard heeft.

alter table public.private_keys
  add column if not exists wrapped text,
  alter column privkey drop not null;

create or replace function public.private_keys_no_plaintext()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.privkey is not null
     and (tg_op = 'INSERT' or new.privkey is distinct from old.privkey) then
    raise exception 'privkey wordt niet meer leesbaar bewaard';
  end if;
  return new;
end;
$$;

drop trigger if exists private_keys_no_plaintext on public.private_keys;
create trigger private_keys_no_plaintext
  before insert or update on public.private_keys
  for each row execute function public.private_keys_no_plaintext();

-- "Opnieuw beginnen" haalt je oude kopie weg.
drop policy if exists "private_keys: own delete" on public.private_keys;
create policy "private_keys: own delete" on public.private_keys
  for delete to authenticated using (user_id = auth.uid());
