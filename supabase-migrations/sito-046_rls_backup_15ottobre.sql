-- =============================================================================
-- sito-046: chiusura delle 5 tabelle di backup create il 15/10 senza RLS
-- =============================================================================
-- Via libera di Massimo del 15/10/2026 (urgente). Le tabelle erano in `public`
-- senza RLS e con i grant di default: leggibili da `anon` via /rest/v1
-- (advisor: rls_disabled_in_public, ERROR). Con RLS attiva, nessuna policy e
-- nessun grant restano accessibili solo alla service_role. Nessun dato toccato.
--
-- Come si annulla: alter table <tabella> disable row level security; e i grant
-- di default (sconsigliato: sono copie di dati personali).
-- Idempotente.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'backup_laura_20261015_sessions',
    'backup_laura_20261015_ma',
    'backup_marco_morbin_20261015_client',
    'backup_marco_morbin_20261015_sessions',
    'backup_marco_morbin_20261015_ma'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    else
      raise notice 'sito-046: tabella % non trovata', t;
    end if;
  end loop;
end $$;

-- Verifica (attesi tutti false, rls true):
--   select c.relname, c.relrowsecurity,
--          has_table_privilege('anon', c.oid, 'SELECT') anon_select,
--          has_table_privilege('authenticated', c.oid, 'SELECT') auth_select
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public' and c.relname like 'backup_%_20261015_%';
