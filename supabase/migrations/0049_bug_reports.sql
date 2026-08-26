-- 0049_bug_reports.sql
--
-- Een prikbord voor wat er stuk is.
--
-- ---------------------------------------------------------------
-- WAAROM EEN GEDEELDE LIJST EN GEEN FORMULIER
-- ---------------------------------------------------------------
-- Een meldformulier dat in het niets verdwijnt levert twee keer verlies op:
-- de melder weet niet of het aankwam, en dezelfde bug komt vijf keer binnen
-- zonder dat iemand ziet dat het dezelfde is.
--
-- Daarom is dit een bord dat iedereen ziet. Je leest eerst of het er al
-- staat; staat het er, dan tik je "ik heb dit ook" in plaats van een tweede
-- melding te schrijven. Dat aantal is precies wat er nodig is om te weten
-- wat er als eerste opgelost moet worden — een bug die tien mensen raken
-- weegt zwaarder dan een bug die één iemand tegenkwam.
--
-- En de status staat erbij. Wie meldde, ziet dat er iets mee gebeurd is.

-- ===============================================================
-- 1. De melding
-- ===============================================================
create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  body        text check (body is null or char_length(body) <= 2000),

  -- Waar het gebeurde. Wordt door de app ingevuld, niet door de melder:
  -- "het werkt niet" met een route en een versie erbij is een melding waar
  -- iets mee te beginnen valt, zonder die twee is het een raadsel.
  route        text,
  platform     text check (platform is null or platform in ('ios', 'android', 'web')),
  app_version  text,

  status      text not null default 'open'
              check (status in ('open', 'bezig', 'opgelost', 'geen_bug')),
  -- Wat eraan gedaan is. Verschijnt onder de melding zodra de status
  -- verandert, zodat "opgelost" geen loze mededeling is.
  resolution  text,

  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists bug_reports_status_idx
  on public.bug_reports (status, created_at desc);

-- ===============================================================
-- 2. "Ik heb dit ook"
-- ===============================================================
create table if not exists public.bug_confirms (
  report_id  uuid not null references public.bug_reports(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index if not exists bug_confirms_report_idx
  on public.bug_confirms (report_id);

-- ===============================================================
-- 3. Wie wat mag
-- ===============================================================
alter table public.bug_reports enable row level security;
alter table public.bug_confirms enable row level security;

-- Iedereen die is ingelogd leest het hele bord. Dat is het punt van een
-- bord: je moet kunnen zien of jouw bug er al op staat.
drop policy if exists "bug_reports: read" on public.bug_reports;
create policy "bug_reports: read"
  on public.bug_reports for select
  using (auth.role() = 'authenticated');

drop policy if exists "bug_reports: own insert" on public.bug_reports;
create policy "bug_reports: own insert"
  on public.bug_reports for insert
  with check (auth.uid() = user_id);

-- Je eigen melding intrekken mag; die van een ander niet.
drop policy if exists "bug_reports: own delete" on public.bug_reports;
create policy "bug_reports: own delete"
  on public.bug_reports for delete
  using (auth.uid() = user_id);

-- Bewust géén update-policy voor gewone gebruikers.
--
-- De tekst bijwerken zou mogen, maar de status niet — en RLS kan niet per
-- kolom onderscheiden. Een melding op "opgelost" kunnen zetten terwijl er
-- niets gebeurd is holt de enige betekenis van dat woord uit. Status en
-- oplossing worden gezet met de service-rol, buiten RLS om (zie
-- `scripts/pull-bugs.mjs`). Wie zich vergiste, verwijdert en meldt opnieuw.

drop policy if exists "bug_confirms: read" on public.bug_confirms;
create policy "bug_confirms: read"
  on public.bug_confirms for select
  using (auth.role() = 'authenticated');

drop policy if exists "bug_confirms: own insert" on public.bug_confirms;
create policy "bug_confirms: own insert"
  on public.bug_confirms for insert
  with check (auth.uid() = user_id);

drop policy if exists "bug_confirms: own delete" on public.bug_confirms;
create policy "bug_confirms: own delete"
  on public.bug_confirms for delete
  using (auth.uid() = user_id);

-- ===============================================================
-- 4. Het bord zoals de app het leest
-- ===============================================================
-- Eén view in plaats van een telling per melding in de client. `security
-- invoker` zodat de RLS hierboven gewoon blijft gelden — de view mag geen
-- achterdeur worden.
create or replace view public.bug_board
with (security_invoker = true) as
  select
    r.*,
    (select count(*) from public.bug_confirms c where c.report_id = r.id)
      + 1 as affected,      -- de melder telt mee; die had hem tenslotte ook
    exists (
      select 1 from public.bug_confirms c
       where c.report_id = r.id and c.user_id = auth.uid()
    ) as confirmed_by_me
  from public.bug_reports r;

comment on view public.bug_board is
  'bug_reports plus hoeveel mensen de bug hebben en of jij een van hen bent.';

-- ===============================================================
-- 5. `resolved_at` bijhouden
-- ===============================================================
-- Handmatig zetten wordt één keer vergeten en dan klopt de lijst niet meer.
create or replace function public.touch_bug_resolved_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('opgelost', 'geen_bug') and old.status not in ('opgelost', 'geen_bug') then
    new.resolved_at := now();
  elsif new.status not in ('opgelost', 'geen_bug') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bug_reports_touch_resolved on public.bug_reports;
create trigger bug_reports_touch_resolved
  before update on public.bug_reports
  for each row
  execute function public.touch_bug_resolved_at();

-- ===============================================================
-- 6. Meldingen over meldingen
-- ===============================================================
-- Wie een bug meldde hoort het als hij opgelost is. Hergebruikt de
-- meldingenketen uit 0048: één rij in `notifications`, en de push volgt
-- vanzelf via de webhook op die tabel.
alter table public.notifications
  add column if not exists bug_report_id uuid
    references public.bug_reports(id) on delete cascade;

create or replace function public.notify_bug_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status not in ('opgelost', 'geen_bug') then
    return new;
  end if;

  -- De melder én iedereen die "ik heb dit ook" tikte.
  insert into public.notifications (user_id, actor_id, type, bug_report_id)
  select uid, new.user_id, 'bug_resolved', new.id
    from (
      select new.user_id as uid
      union
      select c.user_id from public.bug_confirms c where c.report_id = new.id
    ) k
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists bug_reports_notify_resolved on public.bug_reports;
create trigger bug_reports_notify_resolved
  after update on public.bug_reports
  for each row
  execute function public.notify_bug_resolved();

-- Eén melding per bug per persoon, net als bij de signalen in 0048.
create unique index if not exists notifications_bug_once
  on public.notifications (user_id, type, bug_report_id)
  where type = 'bug_resolved';
