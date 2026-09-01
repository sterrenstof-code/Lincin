-- Het profiel als eigen pagina: een plaat, een stuk tekst, en je links.
--
-- Tot nu toe was een profiel een avatar, een naam en één regel bio. Dat is
-- genoeg om iemand te herkennen en te weinig om iemand te kénnen — en in een
-- app voor één vriendengroep is dat tweede het punt. Drie dingen erbij, en
-- ze horen bij elkaar omdat ze alle drie gaan over wat jíj boven je eigen
-- vondsten zet in plaats van wat de app over je weet.

-- ---------------------------------------------------------------
-- 1. De plaat bovenaan
-- ---------------------------------------------------------------
-- Een publieke URL, net als `avatar_url`. Hij woont in dezelfde
-- `avatars`-bucket onder `{user_id}/hero.{ext}`: de policies uit 0028
-- laten élk pad in je eigen map toe, dus er is geen nieuwe bucket en geen
-- nieuwe policy voor nodig. Eén bucket minder om rechten op te verliezen.
alter table public.profiles add column if not exists hero_url text;

-- ---------------------------------------------------------------
-- 2. De bio wordt opmaak
-- ---------------------------------------------------------------
-- Geen kolomwijziging: `bio` was al `text` en blijft dat. Wat verandert is
-- wat erin staat — dezelfde markdown-vorm die een vondst gebruikt (**vet**,
-- *cursief*, lijstjes), gelezen door `lib/richtext.ts`.
--
-- Dat dit géén migratie nodig heeft is precies waarom het zo gedaan is:
-- bestaande bio's zijn platte tekst, en platte tekst is geldige markdown.
-- Niemands profiel verandert door deze regel; wie hierna opmaak gebruikt
-- krijgt hem, en de rest merkt er niets van.
comment on column public.profiles.bio is
  'Markdown (zie lib/richtext.ts). Platte tekst blijft geldig.';

-- ---------------------------------------------------------------
-- 3. Je links
-- ---------------------------------------------------------------
-- Een korte, geordende lijst — geen aparte tabel.
--
-- Dat is een bewuste keuze en niet luiheid. Een `profile_links`-tabel zou
-- een eigen RLS-set, een eigen volgorde-kolom en een tweede query bij élk
-- profiel betekenen, voor iets wat altijd samen met het profiel gelezen en
-- altijd in zijn geheel geschreven wordt. In jsonb komt de lijst mee met de
-- rij die er al is, houdt de array zijn volgorde vanzelf, en is "vervang de
-- lijst" één update.
--
-- De grens ligt op tien: dit is een lijst met wat je goed vond, geen
-- bladwijzerbeheer. Zonder grens wordt het dat wel, en dan staat het naast
-- je vondsten om aandacht te vragen.
alter table public.profiles
  add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_links_shape;
alter table public.profiles add constraint profiles_links_shape check (
  jsonb_typeof(links) = 'array'
  and jsonb_array_length(links) <= 10
);

comment on column public.profiles.links is
  'Array van {label, url}, hoogstens 10. Volledig vervangen bij opslaan.';
