-- Meldingen voor wie een vondst volgt: van de client naar de database.
--
-- ---------------------------------------------------------------
-- WAAROM DIT EEN TRIGGER WORDT
-- ---------------------------------------------------------------
-- De app maakte deze meldingen zelf aan, meteen na het plaatsen van een
-- reactie. Dat werkt zolang de reactie via dát scherm binnenkomt en de
-- gebruiker blijft staan tot het verzoek klaar is. Allebei niet
-- gegarandeerd: er zijn meerdere plekken die reacties plaatsen (de
-- vondstpagina, de reactielijst onder een stemming of een lijst), en wie
-- meteen wegklikt annuleert het verzoek dat nog onderweg was.
--
-- Een melding die soms wél en soms niet komt is erger dan geen melding:
-- je gaat het systeem wantrouwen. Dus doet de database het, in dezelfde
-- transactie als de reactie zelf. Komt de reactie erin, dan komen de
-- meldingen erbij — via welke weg dan ook.
--
-- De eigenaar van de vondst zit er niet bij: die krijgt al
-- `comment_on_post`. En jezelf een melding sturen over je eigen reactie
-- gebeurt evenmin.
create or replace function public.notify_post_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entity_type <> 'post' then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id)
  select f.user_id, new.user_id, 'followed_post_comment', new.entity_id
  from public.post_follows f
  join public.posts p on p.id = f.post_id
  where f.post_id = new.entity_id
    and f.user_id <> new.user_id
    and f.user_id <> p.user_id;

  return new;
end;
$$;

drop trigger if exists entity_comments_notify_followers on public.entity_comments;
create trigger entity_comments_notify_followers
  after insert on public.entity_comments
  for each row
  execute function public.notify_post_followers();
