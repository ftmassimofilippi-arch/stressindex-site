-- =============================================================================
-- STRESS INDEX — RPC get_linked_clients_last_remote_session()
-- =============================================================================
--
-- Aggregato "ultima misurazione remota" per TUTTI i clienti collegati del
-- professionista loggato, in UNA sola chiamata (niente N+1 dalla dashboard).
--
-- Contesto: le sessioni auto-misurate dal cliente dal proprio account hanno
-- professionista_id = uid del CLIENTE e client_id NULL, quindi:
--   - la RLS su `sessions` le nasconde al professionista;
--   - clients.last_measurement_at NON viene aggiornata (stesso bug lato app).
-- La lista clienti del sito mostrava quindi "ultima misurazione" stantia.
--
-- Stesso ponte c.id → client_user_id → sessioni della RPC
-- get_linked_client_sessions_by_client_id (repo hrv_app):
--   1. `c` = righe `clients` del professionista loggato.
--   2. `l` = link `active` del professionista loggato.
--   3. `p` = profilo UTENTE del cliente collegato, match per EMAIL o per ID:
--        - per EMAIL (clients pre-registrati, id arbitrario): p.email == c.email
--        - per ID    (clients creati da acceptRequest):        c.id == p.id::text
--        ⚠️ cast ::text obbligatorio: clients.id è text, profiles.id è uuid.
--   4. `s` = sessioni self del cliente: professionista_id = p.id e client_id NULL.
--
-- SICUREZZA: SECURITY DEFINER bypassa la RLS, ma il WHERE ri-verifica che la
-- riga CRM e il link appartengano al professionista loggato (auth.uid()):
-- un pro ottiene solo gli aggregati dei PROPRI clienti collegati attivi.
-- Nessun dato di misurazione esposto: solo timestamp max e conteggio.

create or replace function public.get_linked_clients_last_remote_session()
returns table (
  client_id        text,
  last_remote_at   timestamptz,
  remote_count     bigint
)
language sql
security definer
set search_path = public
stable
as $BODY$
  select
    c.id                                        as client_id,
    max(coalesce(s.started_at, s.created_at))   as last_remote_at,
    count(s.id)                                 as remote_count
  from public.clients c
  join public.client_professional_links l
    on l.professional_id = auth.uid()
   and l.status = 'active'
  join public.profiles p
    on p.id = l.client_user_id
   and (lower(p.email) = lower(c.email) or c.id = p.id::text)  -- bridge per email o per id
  join public.sessions s
    on s.professionista_id = p.id                              -- self-measure del cliente
   and s.client_id is null                                     -- non ancora assegnate
  where c.professionista_id = auth.uid()                       -- righe CRM del pro loggato
  group by c.id;
$BODY$;

grant execute on function public.get_linked_clients_last_remote_session()
  to authenticated;

notify pgrst, 'reload schema';

-- Verifica post-applicazione (da eseguire loggati come professionista):
--   select * from get_linked_clients_last_remote_session();
-- Atteso: una riga per ogni cliente collegato con sessioni remote,
-- es. il cliente con 59 auto-misurazioni → remote_count = 59,
-- last_remote_at = timestamp dell'ultima.
