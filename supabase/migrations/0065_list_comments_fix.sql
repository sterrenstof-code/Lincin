-- 0065 — herstel van 0064: comments lazen niet meer.
--
-- 0064 liet de policy op entity_comments voor een lijst naar
-- `shared_lists` kijken. De policies van shared_lists en list_members
-- verwijzen naar elkaar (0037) en geven "infinite recursion" — en
-- Postgres vouwt policies uit bij het plannen, dus élke vraag aan
-- entity_comments faalde, en daarmee de feed (de telling van comments).
--
-- Een lijst kijkt nu via een SECURITY DEFINER-functie, buiten de RLS van
-- shared_lists om: de maker of een lid.

create or replace function public.can_see_list(p_list_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shared_lists sl
     where sl.id = p_list_id
       and (
         sl.user_id = auth.uid()
         or exists (
           select 1 from public.list_members lm
            where lm.list_id = sl.id and lm.user_id = auth.uid()
         )
       )
  );
$$;
grant execute on function public.can_see_list(uuid) to authenticated;

drop policy if exists "entity_comments: met wat ze betreffen" on public.entity_comments;
drop policy if exists "entity_comments: op wat je ziet" on public.entity_comments;

create policy "entity_comments: met wat ze betreffen"
  on public.entity_comments for select
  using (
    case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      when 'call_plan' then public.can_see_call_plan(entity_id)
      when 'list' then public.can_see_list(entity_id)
      else false
    end
  );

create policy "entity_comments: op wat je ziet"
  on public.entity_comments for insert
  with check (
    auth.uid() = user_id
    and case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      when 'call_plan' then public.can_see_call_plan(entity_id)
      when 'list' then public.can_see_list(entity_id)
      else false
    end
  );
