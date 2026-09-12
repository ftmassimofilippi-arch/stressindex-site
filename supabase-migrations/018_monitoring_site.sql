-- =============================================================================
-- STRESS INDEX — 018: Monitoraggio 24h / Sonno sul sito
-- =============================================================================
--
-- Prerequisiti (repo hrv_app, da applicare PRIMA se non lo sono già):
--   supabase/migrations/monitoring_sessions.sql          (tabella, RLS, bucket, RPC)
--   supabase/migrations/monitoring_recording_profile.sql (colonna recording_profile)
--   supabase/migrations/monitoring_sleep.sql             (colonne sleep + bucket monitoring-spo2)
-- Al 2026-09-11 sul DB c'era solo la prima: il sito legge le colonne mancanti
-- in modo resiliente, ma senza le altre due le righe 1.1 e le notti non
-- portano recording_profile / sleep_score.
--
-- Contenuto (idempotente, ogni blocco protetto da EXCEPTION WHEN OTHERS):
--   1. monitoring_sessions.events_modified_on_web (+ _at): eventi modificati
--      dal sito, in attesa che l'app ricalcoli la reazione agli eventi.
--   2. (spostato nella 019 §7) RPC get_linked_client_monitoring_sessions_by_client_id
--      riscritta con il ponte clients.client_user_id.
--   3. Policy SELECT esplicita per il superadmin (ridondante con
--      hrv_puo_accedere → hrv_e_amministrativo, ma allineata a 010/011).
--   4. Reload dello schema PostgREST.
--
-- Eseguire nel SQL Editor di Supabase.
-- =============================================================================

-- ── 1. Flag "eventi modificati dal sito" ──────────────────────────────────────
do $$
begin
  alter table public.monitoring_sessions
    add column if not exists events_modified_on_web boolean not null default false;
  alter table public.monitoring_sessions
    add column if not exists events_modified_on_web_at timestamptz;
  comment on column public.monitoring_sessions.events_modified_on_web is
    'True quando il professionista ha aggiunto/modificato/eliminato eventi dal sito: la reazione agli eventi (events[].response) va ricalcolata dall''app, che poi riporta il flag a false.';
exception when others then
  raise notice '018.1 events_modified_on_web non applicata: %', sqlerrm;
end $$;

-- ── 2. RPC bridge con client_user_id ─────────────────────────────────────────
-- SPOSTATA nella 019 (§7): get_linked_client_monitoring_sessions_by_client_id
-- è definita lì, allineata alla RPC delle sessioni (ponte esplicito, fallback
-- email/id, schede archiviate escluse). Applicare 018 e poi 019.

-- ── 3. Lettura superadmin esplicita ──────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_superadmin' and pronamespace = 'public'::regnamespace) then
    execute 'drop policy if exists "monitoring_sessions_superadmin_read" on public.monitoring_sessions';
    execute 'create policy "monitoring_sessions_superadmin_read" on public.monitoring_sessions for select using (public.is_superadmin())';
  else
    raise notice '018.3 is_superadmin() assente (migration 010 non applicata): policy non creata';
  end if;
exception when others then
  raise notice '018.3 policy superadmin non applicata: %', sqlerrm;
end $$;

-- ── 4. Reload schema ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
