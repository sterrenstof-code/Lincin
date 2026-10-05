-- 0093 — vriendcodes: raden levert geen linc meer op (veiligheidscontrole okt 2026).
--
-- Een vriendcode is twee initialen en vier cijfers (`JV-4821`): tienduizend
-- mogelijkheden per paar initialen. Wie hem raadde, was meteen iemands
-- linc, en met een paar wegwerpaccounts (tien missers per uur elk) is dat
-- haalbaar. Nu:
--   - de korte code (getypt, of een QR met enkel de code) stuurt een
--     verzoek dat de ander moet aanvaarden;
--   - de link en de QR die je deelt dragen een lang geheim (`token`, 128
--     bit). Die blijft meteen een linc maken: wie hem heeft, kreeg hem van jou.
-- Stond er al een verzoek van de ander naar jou open, dan maakt de korte
-- code jullie wel meteen lincs: beiden wilden het.

alter table public.friend_codes
  add column if not exists token text;
update public.friend_codes
   set token = encode(extensions.gen_random_bytes(16), 'hex')
 where token is null;
alter table public.friend_codes
  alter column token set default encode(extensions.gen_random_bytes(16), 'hex'),
  alter column token set not null;
create unique index if not exists friend_codes_token_key on public.friend_codes (token);

/**
 *   ok            jullie zijn lincs (of waren het al)
 *   requested     verzoek verstuurd (of stond al open)
 *   not_found     geen code met deze tekst
 *   own           je eigen code
 *   not_allowed   een van jullie blokkeerde de ander
 *   rate_limited  te veel mislukte pogingen het afgelopen uur
 */
create or replace function public.redeem_friend_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  raw text := regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g');
  target uuid;
  by_token boolean := false;
  existing public.friendships%rowtype;
  who jsonb;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if (select count(*) from public.friend_code_attempts
      where user_id = me and created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select f.user_id into target from public.friend_codes f where f.token = lower(raw);
  if target is not null then
    by_token := true;
  else
    select f.user_id into target from public.friend_codes f where f.code = upper(raw);
  end if;

  if target is null then
    insert into public.friend_code_attempts (user_id) values (me);
    return jsonb_build_object('status', 'not_found');
  end if;
  if target = me then
    return jsonb_build_object('status', 'own');
  end if;

  select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name)
    into who
  from public.profiles p where p.id = target;

  select * into existing
  from public.friendships
  where (requester_id = me and addressee_id = target)
     or (requester_id = target and addressee_id = me)
  limit 1;

  if found then
    if existing.status = 'blocked' then
      return jsonb_build_object('status', 'not_allowed');
    end if;
    if existing.status = 'accepted' then
      return jsonb_build_object('status', 'ok', 'friend', who);
    end if;
    -- pending: met de link, of als de ander jou al vroeg, worden jullie lincs.
    if by_token or existing.requester_id = target then
      update public.friendships
        set status = 'accepted', accepted_at = now()
        where id = existing.id;
      return jsonb_build_object('status', 'ok', 'friend', who);
    end if;
    return jsonb_build_object('status', 'requested', 'friend', who);
  end if;

  if by_token then
    insert into public.friendships (requester_id, addressee_id, status, accepted_at)
    values (target, me, 'accepted', now());
    return jsonb_build_object('status', 'ok', 'friend', who);
  end if;

  -- Een geraden code kost ook een poging: anders kon je onbeperkt codes
  -- aflopen en zien bij wie ze horen.
  insert into public.friend_code_attempts (user_id) values (me);
  insert into public.friendships (requester_id, addressee_id, status)
  values (me, target, 'pending');
  return jsonb_build_object('status', 'requested', 'friend', who);
end;
$$;
