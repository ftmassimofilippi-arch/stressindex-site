-- =============================================================================
-- sito-041: indici per le letture principali del sito
-- =============================================================================
-- Audit QA 14/10/2026, punto E5. Applicata da Claude il 15/10/2026 (solo indici).
--
-- Mancavano (stato al 15/10):
--   • sessions(client_id, started_at_utc): scheda cliente, ricalcolo di
--     last_measurement_at (sito-035), report.
--   • sessions(professionista_id, started_at_utc): home, lista clienti, analytics
--     per periodo (oggi c'è solo (professionista_id, duration_type, started_at)).
--   • measurement_analytics(client_id, measured_at_utc): c'è solo su measured_at
--     legacy, mentre il sito ordina e filtra su measured_at_utc.
--   • organizations(owner_id): pagina Organizzazione.
--   alerts(professional_id, status, created_at) e alerts(client_id, created_at)
--   esistono già; l'indice parziale sugli aperti arriva con la sito-036.
--
-- Come si annulla: `drop index if exists <nome>;`
-- Idempotente. Le tabelle sono piccole (sessions 4.4k, analytics 3.7k):
-- CREATE INDEX normale, niente CONCURRENTLY.
-- =============================================================================

create index if not exists sessions_client_started_utc_idx
  on public.sessions (client_id, started_at_utc desc)
  where client_id is not null;

create index if not exists sessions_prof_started_utc_idx
  on public.sessions (professionista_id, started_at_utc desc);

create index if not exists measurement_analytics_client_measured_utc_idx
  on public.measurement_analytics (client_id, measured_at_utc desc)
  where client_id is not null;

create index if not exists organizations_owner_idx
  on public.organizations (owner_id);

-- Verifica: explain (analyze) select * from sessions where client_id = '1778590876479'
--   order by started_at_utc desc limit 50;  -- atteso Index Scan su sessions_client_started_utc_idx
