-- Bewijs dat de database zelf de grens bewaakt (npm run rls:proef).
--
-- Draait tegen de gekoppelde database, maar alles gebeurt in één transactie
-- die op het eind teruggedraaid wordt: er blijft niets achter, en meldingen
-- of pushes die triggers in de wachtrij zetten (pg_net) gaan nooit weg.
--
-- Drie proefaccounts: A maakt dingen, B probeert erbij, en anon is wie
-- niet ingelogd is. Elke regel in de uitkomst is één poging: "groen" als de
-- database weigerde wat geweigerd moest worden.

begin;

create temp table proef (nr serial, naam text, ok boolean);
grant all on proef to authenticated, anon;
grant all on proef_nr_seq to authenticated, anon;

select set_config('proef.a', gen_random_uuid()::text, true),
       set_config('proef.b', gen_random_uuid()::text, true),
       set_config('proef.c', gen_random_uuid()::text, true),
       set_config('proef.post', gen_random_uuid()::text, true),
       set_config('proef.lijst', gen_random_uuid()::text, true),
       set_config('proef.item', gen_random_uuid()::text, true);

insert into auth.users (id, email, aud, role)
select current_setting('proef.' || x)::uuid, 'rls-proef-' || x || '-' || gen_random_uuid() || '@lincin.invalid', 'authenticated', 'authenticated'
from unnest(array['a', 'b', 'c']) x;
-- Ontvangers voor de proef met te veel vriendschapsverzoeken.
create temp table proef_x as select gen_random_uuid() as id from generate_series(1, 21);
insert into auth.users (id, email, aud, role)
select id, 'rls-proef-x-' || id || '@lincin.invalid', 'authenticated', 'authenticated' from proef_x;
grant select on proef_x to authenticated;

insert into public.profiles (id, username, identity_pubkey)
select id, 'proef' || substr(md5(id::text), 1, 12), 'proef'
from (select current_setting('proef.b')::uuid as id union all select current_setting('proef.c')::uuid union all select id from proef_x) p;

-- ---- A maakt zijn spullen ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('proef.a'), 'role', 'authenticated')::text, true);

insert into public.profiles (id, username, identity_pubkey)
values (current_setting('proef.a')::uuid, 'proefa' || substr(md5(random()::text), 1, 8), 'proef');
update public.profiles set last_seen_at = now() where id = current_setting('proef.a')::uuid;
insert into public.posts (id, user_id, caption)
values (current_setting('proef.post')::uuid, current_setting('proef.a')::uuid, 'privé van A');
insert into public.key_passkeys (credential_id, user_id, wrapped)
values ('proef-' || current_setting('proef.a'), current_setting('proef.a')::uuid, 'geheim');
insert into public.user_prefs (user_id, prefs) values (current_setting('proef.a')::uuid, '{"proef":true}');
insert into public.shared_lists (id, user_id, title) values (current_setting('proef.lijst')::uuid, current_setting('proef.a')::uuid, 'lijst van A');
insert into public.list_items (id, list_id, user_id, text)
values (current_setting('proef.item')::uuid, current_setting('proef.lijst')::uuid, current_setting('proef.a')::uuid, 'item van A');
insert into public.list_members (list_id, user_id) values (current_setting('proef.lijst')::uuid, current_setting('proef.b')::uuid);

-- Mass assignment op een eigen bijdrage: created_at en user_id blijven.
do $$
begin
  begin
    update public.posts set user_id = current_setting('proef.b')::uuid where id = current_setting('proef.post')::uuid;
  exception when others then null;
  end;
end $$;
update public.posts set created_at = now() + interval '1 year' where id = current_setting('proef.post')::uuid;
insert into proef (naam, ok)
select 'A kan created_at/user_id van eigen bijdrage niet zetten', created_at < now() + interval '1 day' and user_id = current_setting('proef.a')::uuid
from public.posts where id = current_setting('proef.post')::uuid;

-- Te veel vriendschapsverzoeken: 20 mag, de 21ste niet.
do $$
declare x uuid; n int := 0; geweigerd boolean := false;
begin
  for x in select id from proef_x loop
    begin
      insert into public.friendships (requester_id, addressee_id, status) values (current_setting('proef.a')::uuid, x, 'pending');
      n := n + 1;
    exception when others then geweigerd := true;
    end;
  end loop;
  insert into proef (naam, ok) values ('A kan geen 21 vriendschapsverzoeken op een dag sturen (' || n || ' gelukt)', geweigerd and n = 20);
end $$;

-- A en C zijn lincs; B kent A niet.
reset role;
insert into public.friendships (requester_id, addressee_id, status, accepted_at)
values (current_setting('proef.c')::uuid, current_setting('proef.a')::uuid, 'accepted', now());
set local role authenticated;

-- ---- B probeert bij A ----------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('proef.b'), 'role', 'authenticated')::text, true);

insert into proef (naam, ok) select 'B ziet de bijdrage van A niet', count(*) = 0 from public.posts where id = current_setting('proef.post')::uuid;
insert into proef (naam, ok) select 'B ziet de passkey-kopie van A niet', count(*) = 0 from public.key_passkeys where user_id = current_setting('proef.a')::uuid;
insert into proef (naam, ok) select 'B ziet de voorkeuren van A niet', count(*) = 0 from public.user_prefs where user_id = current_setting('proef.a')::uuid;

do $$
declare n int;
begin
  update public.posts set caption = 'door B' where id = current_setting('proef.post')::uuid;
  get diagnostics n = row_count;
  insert into proef (naam, ok) values ('B kan de bijdrage van A niet wijzigen', n = 0);
  delete from public.posts where id = current_setting('proef.post')::uuid;
  get diagnostics n = row_count;
  insert into proef (naam, ok) values ('B kan de bijdrage van A niet wissen', n = 0);
  update public.profiles set bio = 'door B' where id = current_setting('proef.a')::uuid;
  get diagnostics n = row_count;
  insert into proef (naam, ok) values ('B kan het profiel van A niet wijzigen', n = 0);
  delete from public.key_passkeys where user_id = current_setting('proef.a')::uuid;
  get diagnostics n = row_count;
  insert into proef (naam, ok) values ('B kan de passkey-kopie van A niet wissen', n = 0);
end $$;

do $$
begin
  begin
    insert into public.posts (user_id, caption) values (current_setting('proef.a')::uuid, 'op naam van A');
    insert into proef (naam, ok) values ('B kan niet posten op naam van A', false);
  exception when others then
    insert into proef (naam, ok) values ('B kan niet posten op naam van A', true);
  end;
  begin
    insert into public.key_passkeys (credential_id, user_id, wrapped) values ('proef-b', current_setting('proef.a')::uuid, 'x');
    insert into proef (naam, ok) values ('B kan geen passkey-kopie voor A toevoegen', false);
  exception when others then
    insert into proef (naam, ok) values ('B kan geen passkey-kopie voor A toevoegen', true);
  end;
  -- B is lid van de lijst: afvinken mag, maar niet op naam van A.
  begin
    update public.list_items set checked = true, checked_by = current_setting('proef.a')::uuid, user_id = current_setting('proef.b')::uuid
     where id = current_setting('proef.item')::uuid;
    insert into proef (naam, ok) values ('B kan niet afvinken op naam van A', false);
  exception when others then
    insert into proef (naam, ok) values ('B kan niet afvinken op naam van A', true);
  end;
end $$;
update public.list_items set checked = true, checked_by = current_setting('proef.b')::uuid, user_id = current_setting('proef.b')::uuid
 where id = current_setting('proef.item')::uuid;
insert into proef (naam, ok)
select 'B vinkt af op eigen naam; het item blijft van A', checked and checked_by = current_setting('proef.b')::uuid and user_id = current_setting('proef.a')::uuid
from public.list_items where id = current_setting('proef.item')::uuid;

insert into proef (naam, ok) select 'B ziet niet wanneer A laatst actief was (profiel)', last_seen_at is null from public.profiles where id = current_setting('proef.a')::uuid;
insert into proef (naam, ok) select 'B ziet niet wanneer A laatst actief was (last_seen_of)', count(*) = 0 from public.last_seen_of(array[current_setting('proef.a')::uuid]);

-- Verzoek, intrekken, opnieuw: de tweede keer op dezelfde dag niet.
do $$
begin
  insert into public.friendships (requester_id, addressee_id, status) values (current_setting('proef.b')::uuid, current_setting('proef.c')::uuid, 'pending');
  delete from public.friendships where requester_id = current_setting('proef.b')::uuid and addressee_id = current_setting('proef.c')::uuid;
  begin
    insert into public.friendships (requester_id, addressee_id, status) values (current_setting('proef.b')::uuid, current_setting('proef.c')::uuid, 'pending');
    insert into proef (naam, ok) values ('B kan C niet blijven porren met verzoeken', false);
  exception when others then
    insert into proef (naam, ok) values ('B kan C niet blijven porren met verzoeken', true);
  end;
end $$;

-- C is een linc van A en ziet het wel.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('proef.c'), 'role', 'authenticated')::text, true);
insert into proef (naam, ok) select 'C (linc van A) ziet wanneer A laatst actief was', count(*) = 1 from public.last_seen_of(array[current_setting('proef.a')::uuid]);

-- ---- Niet ingelogd -------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare n int;
begin
  begin
    select count(*) into n from public.posts;
    insert into proef (naam, ok) values ('anon leest geen bijdragen', n = 0);
  exception when insufficient_privilege then
    insert into proef (naam, ok) values ('anon leest geen bijdragen', true);
  end;
  begin
    select count(*) into n from public.profiles;
    insert into proef (naam, ok) values ('anon leest geen profielen', n = 0);
  exception when insufficient_privilege then
    insert into proef (naam, ok) values ('anon leest geen profielen', true);
  end;
end $$;

reset role;
select case when ok then 'groen' else 'ROOD' end as uitkomst, naam from proef order by nr;

rollback;
