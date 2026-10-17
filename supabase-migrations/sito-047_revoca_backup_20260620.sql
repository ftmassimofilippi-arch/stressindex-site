-- =============================================================================
-- sito-047: nessun grant ad anon e authenticated su measurement_analytics_backup_20260620
-- =============================================================================
-- Via libera di Massimo del 17/10/2026. La tabella ha già la RLS attiva senza
-- policy (quindi oggi non restituisce righe a chi non è service_role), ma
-- conservava i grant di default: si tolgono, come chiede la regola delle
-- tabelle di backup in CLAUDE.md. Nessun dato toccato.
--
-- Come si annulla: grant select on public.measurement_analytics_backup_20260620
-- to authenticated; (sconsigliato).
-- Idempotente.
-- =============================================================================

revoke all on public.measurement_analytics_backup_20260620 from anon, authenticated;

-- Verifica (attesi false, rls true):
--   select relrowsecurity,
--          has_table_privilege('anon', 'public.measurement_analytics_backup_20260620', 'SELECT,INSERT,UPDATE,DELETE') anon,
--          has_table_privilege('authenticated', 'public.measurement_analytics_backup_20260620', 'SELECT,INSERT,UPDATE,DELETE') auth
--   from pg_class where oid = 'public.measurement_analytics_backup_20260620'::regclass;
