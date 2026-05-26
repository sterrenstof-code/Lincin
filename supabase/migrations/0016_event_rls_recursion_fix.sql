-- Fix infinite recursion in event_members RLS policy.
--
-- De originele policy zegt: "je ziet event_members rijen waar je zelf member
-- van bent" → om dat te checken doet ze een sub-SELECT op event_members,
-- wat opnieuw de policy triggert → infinite recursion → 500 errors.
--
-- Fix: gebruik een SECURITY DEFINER functie zodat de membership-check de
-- RLS van event_members bypasst. De functie zelf checkt veilig met auth.uid().

create or replace function public.is_event_member(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.event_members
     where event_id = p_event_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_event_member(uuid) to authenticated;

-- event_members: vervang de recursieve policy
drop policy if exists "see members of events you're in" on public.event_members;
create policy "see members of events you're in"
  on public.event_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_event_member(event_id)
  );

-- events: zelfde patroon — was niet recursief maar wel veel queries triggeren.
-- Gebruiken nu de helper voor consistentie en performance.
drop policy if exists "see events you host or are in" on public.events;
create policy "see events you host or are in"
  on public.events for select
  to authenticated
  using (
    host_user_id = auth.uid()
    or public.is_event_member(id)
  );

-- event_contributions: zelfde patroon
drop policy if exists "see contributions in your events" on public.event_contributions;
create policy "see contributions in your events"
  on public.event_contributions for select
  to authenticated
  using (public.is_event_member(event_id));

drop policy if exists "contribute as yourself in your events" on public.event_contributions;
create policy "contribute as yourself in your events"
  on public.event_contributions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_event_member(event_id)
  );

notify pgrst, 'reload schema';
