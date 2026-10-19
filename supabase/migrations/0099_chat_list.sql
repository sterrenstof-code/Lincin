-- 0099 — de chatlijst in één vraag, en de voorvertoningen in één vraag.
--
-- `listMyChats` deed vijf vragen in drie golven na elkaar: de gesprekken,
-- dan (leden, ongelezen-tellers, eigen hidden_at) naast elkaar, en pas
-- daarna de profielen van die leden. Op een trage verbinding is dat drie
-- keer de volle wachttijd vóór de lijst iets toont, en de lijst wordt bij
-- elke terugkeer naar de app opnieuw opgehaald.
--
-- En de voorvertoning (lib/chat-preview.ts) haalde per gesprek, één voor
-- één, de laatste vijf berichten op: tien gesprekken = tien vragen na
-- elkaar.

-- ---------------------------------------------------------------
-- 1. my_chat_list() — één rij per gesprek waar ik lid van ben
-- ---------------------------------------------------------------
-- Security definer, en alleen omdat het filter het al afdwingt: elke rij
-- komt uit `chat_members` met `user_id = auth.uid()`. Dat is precies de set
-- die de policy "see chats you're a member of" (is_chat_member) toeliet.
-- De leden komen alleen uit gesprekken die al door dat filter kwamen, en
-- profielen zijn voor elke ingelogde gebruiker sowieso leesbaar. Zonder
-- auth.uid() (anon, service-key) levert hij niets op.
--
-- Definer en niet invoker: als invoker liep de RLS-check `is_chat_member`
-- nog eens voor elke rij in de tellers (de reden voor 0076), en de
-- ongelezen-telling hieronder is letterlijk die van `my_chat_unread_counts`
-- (0076, live gelijk): berichten van anderen ná mijn `last_read_at`. Zo
-- telt `mark_chat_unread` (0075) — die zet last_read_at net vóór het
-- laatste bericht van een ander — hier precies zo mee als daar.
--
-- Verborgen gesprekken (hidden_at, 0023) komen wél mee, met hun
-- `hidden_at`: de app filtert ze zelf weg tenzij er sindsdien een bericht
-- binnenkwam, zoals hij dat altijd deed.
--
-- `members` bevat dezelfde velden als de profielvraag van vroeger: wat de
-- kop van een gesprek, de avatars en de versleuteling (identity_pubkey)
-- nodig hebben.
create or replace function public.my_chat_list()
returns table (
  id uuid,
  type public.chat_type,
  name text,
  avatar_url text,
  created_by uuid,
  created_at timestamptz,
  last_message_at timestamptz,
  hidden_at timestamptz,
  unread_count integer,
  members jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.type,
    c.name,
    c.avatar_url,
    c.created_by,
    c.created_at,
    c.last_message_at,
    me.hidden_at,
    (
      select count(*)::int
        from public.messages m
       where m.chat_id = me.chat_id
         and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)
         and m.sender_id <> me.user_id
    ) as unread_count,
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', p.id,
                 'username', p.username,
                 'display_name', p.display_name,
                 'avatar_url', p.avatar_url,
                 'identity_pubkey', p.identity_pubkey,
                 'last_seen_at', p.last_seen_at,
                 'hue', p.hue
               )
               order by cm.joined_at, cm.user_id
             )
        from public.chat_members cm
        join public.profiles p on p.id = cm.user_id
       where cm.chat_id = c.id
    ), '[]'::jsonb) as members
  from public.chat_members me
  join public.chats c on c.id = me.chat_id
  where auth.uid() is not null
    and me.user_id = auth.uid()
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

revoke all on function public.my_chat_list() from public, anon;
grant execute on function public.my_chat_list() to authenticated;

-- ---------------------------------------------------------------
-- 2. latest_messages_per_chat() — de laatste N berichten per gesprek
-- ---------------------------------------------------------------
-- Security invoker: hij leest `messages` met de rechten van wie vraagt,
-- dus de policy "read messages from chats you're in" bepaalt wat er
-- terugkomt. Een gesprek-id waar je geen lid van bent levert gewoon niets
-- op. Er komt niets uit wat `fetchMessages` per gesprek niet ook gaf.
--
-- Top-N per gesprek via een lateral join met `limit` in plaats van
-- `row_number() over (partition by chat_id …)`: hetzelfde resultaat, maar
-- de lateral loopt per gesprek over de index (chat_id, created_at desc)
-- uit 0001 en stopt na N rijen, waar de window-functie eerst élk bericht
-- van elk gesprek moet nummeren. RLS geldt op de scan zelf, dus de limit
-- telt alleen berichten die je mag zien.
--
-- Begrensd (200 gesprekken, 20 per gesprek) zodat één aanroep nooit de
-- hele geschiedenis kan opvragen.
create or replace function public.latest_messages_per_chat(
  p_chat_ids uuid[],
  p_n integer default 5
)
returns table (
  id uuid,
  chat_id uuid,
  sender_id uuid,
  recipient_payloads jsonb,
  created_at timestamptz,
  edited_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.chat_id, m.sender_id, m.recipient_payloads, m.created_at, m.edited_at
    from (
      select distinct x.chat_id
        from unnest(p_chat_ids) as x(chat_id)
       where x.chat_id is not null
       limit 200
    ) ids
    cross join lateral (
      select mm.id, mm.chat_id, mm.sender_id, mm.recipient_payloads, mm.created_at, mm.edited_at
        from public.messages mm
       where mm.chat_id = ids.chat_id
       order by mm.created_at desc
       limit least(greatest(coalesce(p_n, 5), 1), 20)
    ) m
   order by m.chat_id, m.created_at desc;
$$;

revoke all on function public.latest_messages_per_chat(uuid[], integer) from public, anon;
grant execute on function public.latest_messages_per_chat(uuid[], integer) to authenticated;

notify pgrst, 'reload schema';
