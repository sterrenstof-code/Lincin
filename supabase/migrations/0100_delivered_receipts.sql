-- 0100 — "aangekomen" naast "gezien", zoals Telegram/WhatsApp, en live
-- leesbevestigingen die ook echt live zijn.
--
-- 1. chat_members.last_delivered_at: tot waar de berichten in dit gesprek
--    bij dit lid zijn aangekomen. Een watermerk per lid, net als
--    last_read_at. Het verschil: "aangekomen" hangt niet af van aandacht
--    (lib/attention.ts). Een tab op de achtergrond heeft het bericht wél
--    ontvangen, alleen nog niet gezien — precies dat onderscheid wil de
--    afzender zien.
-- 2. chat_members in de realtime-publicatie. Hij stond er niet in, dus
--    `subscribeToChatMemberUpdates` vuurde nooit en "gezien" verscheen pas
--    na het opnieuw openen van het gesprek. Veilig: realtime volgt RLS, en
--    de SELECT-regel op chat_members ("see members of chats you're in",
--    is_chat_member) laat alleen leden van dat gesprek de rijen zien. Wie
--    wanneer las is bewust zichtbaar voor de andere leden — dat is wat een
--    leesbevestiging is. Er komt dus niets langs dat een lid nu niet al
--    met een gewone select kon ophalen.
-- 3. mark_chat_delivered(chat, tijdstip): zet het watermerk voor jezelf.
-- 4. mark_chat_read zet voortaan ook last_delivered_at: gelezen betekent
--    aangekomen. Anders kon een gesprek "gezien" zijn en tegelijk niet
--    "aangekomen", wat nergens op slaat.
--
-- Geen kolomrecht UPDATE op last_delivered_at voor authenticated (0090:87
-- geeft alleen last_read_at en hidden_at). Alleen de RPC schrijft hem, en
-- die kan hem niet achteruit en niet in de toekomst zetten.

alter table public.chat_members add column if not exists last_delivered_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_members'
  ) then
    alter publication supabase_realtime add table public.chat_members;
  end if;
end $$;

-- Security definer om dezelfde reden als mark_chat_read (0021): de caller
-- mag deze kolom niet zelf updaten. Veilig omdat we intern op auth.uid()
-- filteren — je raakt alleen je eigen rij, en alleen als je lid bent (geen
-- rij = niets te doen). Zonder sessie is auth.uid() null en matcht er
-- niets.
--
-- Het tijdstip komt van de client (de created_at van het nieuwste bericht
-- van een ander dat binnenkwam), dus: nooit later dan nu — anders kon een
-- client "aangekomen" vooruit zetten voor berichten die nog moeten komen —
-- en nooit terug, want een oud bericht dat laat binnendruppelt (catch-up,
-- een tweede toestel) mag het watermerk niet terugdraaien. Zonder tijdstip
-- niets: least() negeert null en zou anders "nu" invullen.
create or replace function public.mark_chat_delivered(p_chat_id uuid, p_at timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_members
     set last_delivered_at = greatest(coalesce(last_delivered_at, '-infinity'), least(p_at, now()))
   where chat_id = p_chat_id
     and user_id = auth.uid()
     and p_at is not null
     and (last_delivered_at is null or last_delivered_at < least(p_at, now()));
$$;

revoke all on function public.mark_chat_delivered(uuid, timestamptz) from public, anon;
grant execute on function public.mark_chat_delivered(uuid, timestamptz) to authenticated;

-- Gelijk aan 0021 (live identiek; 0075 voegde alleen mark_chat_unread toe),
-- plus last_delivered_at: wat je leest is ook aangekomen.
create or replace function public.mark_chat_read(p_chat_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.chat_members
     set last_read_at = now(),
         last_delivered_at = greatest(coalesce(last_delivered_at, '-infinity'), now())
   where chat_id = p_chat_id
     and user_id = auth.uid();
$$;

-- `create or replace` laat bestaande rechten staan; voor de zekerheid
-- opnieuw zoals 0021 + 0097 ze zetten.
revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

notify pgrst, 'reload schema';
