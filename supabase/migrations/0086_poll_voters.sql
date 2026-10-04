-- 0086 — hoeveel mensen stemden (ook bij een anonieme poll).
--
-- Bij "meerdere keuzes" is een percentage per stemmer (Poll-spec): het
-- aantal stemmen op een keuze gedeeld door het aantal mensen dat stemde.
-- Bij een anonieme poll ziet de app andermans stemmen niet (0085), dus dat
-- aantal moet van hier komen.

create or replace function public.poll_voter_count(p_poll_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct v.user_id)::int
    from public.poll_votes v
    join public.poll_options po on po.id = v.poll_option_id
   where po.poll_id = p_poll_id
     and public.can_see_poll(p_poll_id);
$$;

grant execute on function public.poll_voter_count(uuid) to authenticated;
