# DB-drift: productie vs. migratiebestanden

Peildatum: 19 okt 2026. Vergeleken: de live catalogus van het gekoppelde project
met een database die opgebouwd is uit `supabase/migrations/0001–0096` (PGlite, 0029
gepatcht zodat hij toepasbaar is). `schema_migrations` live boekt 0001–0096 als
uitgevoerd; 0097 nog niet.

**Kort:** de drift is klein en zit bijna helemaal in policies die met de hand in het
dashboard/SQL-editor zijn gemaakt of weggehaald. Functies (inclusief body,
`security definer` en `search_path`), functierechten, tabel- en kolomrechten,
triggers (op de webhooks na), indexen, constraints, kolommen, views, buckets en de
`supabase_realtime`-publicatie zijn gelijk.

## Tabellen

| Tabel | Live | Bestanden | Opmerking |
|---|---|---|---|
| `profile_devices` | ontbreekt | 0018, RLS aan, leesregel `using (true)` | Zie hieronder. Alle andere 47 tabellen + 2 views: gelijk, RLS overal aan. |

`profile_devices` (0018) staat als uitgevoerd geboekt maar bestaat niet. Waarschijnlijk
is 0018 nooit echt gedraaid (migraties met de hand in de SQL-editor en daarna als
"applied" gemarkeerd) of later met de hand weggehaald. De app gebruikt de tabel niet
(alleen nog in `lib/supabase/types.ts`). De live toesteltabel is `user_devices` (0010,
push-tokens) met één regel `users manage their own devices` (`auth.uid() = user_id`):
niet overbelicht.

## Policies

| Tabel | Policy | Live | Bestanden | Veiligheid live |
|---|---|---|---|---|
| `chats` | `Eigenaar mag chat updaten` (UPDATE, rol `public`) | **extra** | – | **Minder veilig.** Geen `type = 'group'`, geen `with check`. Ook directe chats hebben live een `owner` (7 van 14 leden), dus de maker van een één-op-één-chat kon naam/foto/`call_room` wijzigen en de chat in een groep omzetten (in PGlite nagebootst: 1 rij bijgewerkt, `type` gewijzigd). → 0097 §4d dropt hem. |
| `storage.objects` | `posts: select own folder` / `insert own folder` / `delete own folder` | extra | – | Met de hand gemaakt, zelfde voorwaarde als 0003/0024. 0091 verwijst er al naar. |
| `storage.objects` | `users read their own files`, `users delete their own files` | aanwezig | aanwezig (0024) | Dubbels van de regels hierboven; onschuldig. → 0097 §2 dropt ze. |
| `storage.objects` | `users upload to their own folder` | ontbreekt | 0024 | Vervangen door `posts: insert own folder`. |
| `storage.objects` | `friends can read each other's posts` | ontbreekt | 0024 | Live al weg, dus de map-van-je-lincs-lek uit de bestanden bestaat live niet. |
| `storage.objects` | `Eigenaar mag groepsavatar uploaden` / `overschrijven` | ontbreken | 0029 | 0029 vergelijkt `user_id` (uuid) met `auth.uid()::text`: kon nooit slagen. De avatars-bucket is dus deels met de hand ingericht. De app uploadt groepsfoto's naar `<userId>/group_<chatId>` (eigen map), dus deze regels zijn niet nodig. |
| `profile_devices` | `anyone can read device pubkeys`, `users manage own devices` | ontbreken | 0018 | Tabel bestaat niet. |

Alle andere policies in `public` en `storage` zijn identiek (na het normaliseren van
witruimte), ook voor `chat_members`, `messages`, `private_keys`, `friendships`,
`posts`, `notifications`, `activity_events`, `poll_votes`, `comment_reactions` en
`event_*`. `posts: select visible media` is precies 0091.

## Functies en rechten

| Onderdeel | Resultaat |
|---|---|
| Functies (59) | Zelfde namen, handtekeningen, bodies; alle hebben `set search_path = public`. Geen extra of ontbrekende. |
| EXECUTE voor anon/PUBLIC | Gelijk aan de bestanden. Alle 16 app-RPC's uit de revoke-lijst van 0097 bestaan met exact die handtekening en staan live nog open voor anon. `add_recipient_payload`, `match_contacts`, `my_messages_missing_payloads`, `redeem_friend_code`, `notification_insert_ok` zijn al dicht. Nog open voor anon na 0097: de RLS-hulpfuncties (`is_chat_member`, `can_see_poll`, …) en `gen_friend_code`. Die geven zonder sessie niets prijs. |
| Tabelrechten | Gelijk. anon heeft rechten op 47 van 50 tabellen/views (326 regels). Niet op `private_keys`, `invite_sends` en `accepted_friends`. |
| Kolomrechten | Gelijk. `messages` UPDATE is live echt beperkt tot `recipient_payloads, edited_at` (0092 klopt). `chats` en `notifications`: nog UPDATE op elke kolom, ook `call_room`, `type` en `user_id`. |
| Default privileges | Live geeft `postgres` elke nieuwe tabel, functie en sequence in `public` aan anon. |
| Views | `accepted_friends` en `bug_board` hebben live `security_invoker=true`. |

## Triggers, publicatie, buckets

| Onderdeel | Live vs. bestanden |
|---|---|
| Triggers | Gelijk, plus 3 webhooks uit het dashboard: `on-message-insert`, `on-friendship-insert`, `on-notification-insert` → `supabase_functions.http_request(.../functions/v1/send-push)`. Het webhookgeheim staat in de triggerdefinitie. Niet via een migratie beheren, wel roteren als het ooit gedeeld is. |
| Publicatie `supabase_realtime` | Gelijk. Live staat er ook de interne `supabase_realtime_messages_publication` (partities van `realtime.messages`), een Supabase-detail. |
| Buckets | Gelijk: `avatars` publiek; `posts`, `chat-attachments`, `event-photos` privé. |

## Data die 0097 raakt

| Controle (alleen-lezen, live) | Resultaat |
|---|---|
| `posts.image_path`/`video_path` buiten de eigen map | **0** (33 beelden, 0 video's, 42 posts) |
| `post_images.image_path` buiten de map van de posteigenaar | 0 van 23 |
| `entity_comments.image_path` buiten de eigen map | 0 van 2 |

`posts_media_own_folder` valideert live dus meteen.

## Wat live minder veilig stond, en waar 0097 het oplost

1. `chats`: de extra regel `Eigenaar mag chat updaten` → §4d (drop). Daarna gaat de kolomgrant naar `(name, avatar_url)`.
2. `chats`/`notifications`: UPDATE op elke kolom → §4d/§4e (column grants; dit stond ook zo in de bestanden).
3. anon: tabelrechten en default privileges → §7 (`revoke all` + `alter default privileges`).
4. Dubbele posts-regels → §2. Geen gat, wel opruiming.

Opgelost door 0097 maar niet live-specifiek: §1 (approve/decline zonder sessie, RPC's
voor anon), §3 (`notification_insert_ok`), §4a–c.

## Bekende oorzaak

De migraties zijn (deels) met de hand in de SQL-editor gedraaid en daarna als
uitgevoerd gemarkeerd, met handwerk in het dashboard ertussen (storage policies,
chat-updateregel, webhooks). Daarom faalde `db push` van de eerste 0097 op
`profile_devices`. Advies: na 0097 geen dashboardwijzigingen meer aan policies, alles
via migraties. Een periodieke `supabase db diff --linked` vangt nieuwe drift op.
