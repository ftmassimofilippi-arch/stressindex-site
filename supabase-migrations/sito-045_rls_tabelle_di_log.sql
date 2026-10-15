-- =============================================================================
-- sito-045: RLS sulle tabelle di backup e log create dalle sito-035/037/043
-- =============================================================================
-- Le tre tabelle di servizio create il 15/10 erano in `public` senza RLS, quindi
-- esposte da PostgREST (advisor: rls_disabled_in_public, ERROR). Con RLS attiva
-- e nessuna policy restano leggibili solo dalla service_role. Applicata da
-- Claude il 15/10/2026 (solo chiusura, nessun dato toccato).
--
-- Come si annulla: alter table <tabella> disable row level security;
-- Idempotente.
-- =============================================================================

alter table if exists public.clients_last_measurement_backup_20261015 enable row level security;
alter table if exists public.alerts_doppioni_20261015 enable row level security;
alter table if exists public.organizations_merge_log_20261015 enable row level security;

revoke all on public.clients_last_measurement_backup_20261015 from anon, authenticated;
revoke all on public.alerts_doppioni_20261015 from anon, authenticated;
revoke all on public.organizations_merge_log_20261015 from anon, authenticated;
