-- =============================================================================
-- sito-038: le funzioni SECURITY DEFINER non sono più eseguibili da anon
-- =============================================================================
-- Audit QA 14/10/2026, punto D1. **RICHIEDE IL VIA LIBERA DI MASSIMO** (revoca
-- permessi). L'advisor Supabase del 15/10 segnala 68 funzioni SECURITY DEFINER
-- eseguibili senza login via /rest/v1/rpc/. Quasi tutte hanno anche EXECUTE a
-- PUBLIC (il grant implicito di Postgres sulle funzioni nuove): togliere solo
-- `anon` non basta, si revoca a PUBLIC e anon insieme.
--
-- Censimento di chi chiama ogni funzione (grep in hrv_app/lib, src/,
-- pg_policies, pg_trigger, cron.job, corpo delle altre funzioni), 15/10/2026.
-- Tre gruppi:
--   A. API di app e sito: restano a `authenticated` (+ service_role). Tutte
--      controllano auth.uid() o passano da una guardia (hrv_puo_accedere,
--      hrv_puo_leggere_soggetto, puo_vedere_come_professionista...). Le due
--      senza controllo esplicito sono annotate.
--   B. Funzioni usate nelle policy RLS: valutate come l'utente che interroga,
--      restano a `authenticated`.
--   C. Interne, trigger, cron, backfill, amministrative: solo `service_role`
--      e `postgres`. I trigger non hanno bisogno dell'EXECUTE del chiamante;
--      le chiamate interne avvengono dentro funzioni SECURITY DEFINER, quindi
--      come `postgres`; pg_cron gira come `postgres`.
--
-- In coda: default privileges, così le funzioni create d'ora in poi non
-- nascono eseguibili da PUBLIC e anon.
--
-- Come si annulla: `grant execute on function <firma> to anon, authenticated;`
-- per la funzione che serve (nessuna viene cancellata). Idempotente.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- A. API di app e sito: via PUBLIC e anon, resta authenticated
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.accept_organization_invite(uuid)',                                 -- sito (api/organization/invites), auth.uid()
    'public.client_respond_to_link(uuid, boolean)',                             -- app, sito; auth.uid()
    'public.client_rolling_state(uuid)',                                        -- app (10 punti); hrv_puo_accedere
    'public.compute_client_baseline(uuid, text)',                               -- app (1 punto); auth.uid() + hrv_puo_accedere
    'public.get_client_baselines(uuid)',                                        -- app; hrv_puo_accedere
    'public.get_client_night_status(text)',                                     -- app; NESSUN controllo diretto: passa da night_status_json (vedi nota 1)
    'public.get_linked_client_monitoring_sessions_by_client_id(text)',          -- app, sito; auth.uid()
    'public.get_linked_client_profile(uuid)',                                   -- app; auth.uid()
    'public.get_linked_client_sessions_as_professional(uuid, text)',            -- sito; puo_vedere_come_professionista
    'public.get_linked_client_sessions_by_client_id(text)',                     -- app, sito; auth.uid()
    'public.get_linked_client_sessions_by_email(text)',                         -- app, sito; auth.uid()
    'public.get_linked_clients_last_remote_analytics()',                        -- sito; auth.uid()
    'public.get_linked_clients_last_remote_analytics_as_professional(uuid)',    -- sito; puo_vedere_come_professionista
    'public.get_linked_clients_last_remote_session()',                          -- sito; auth.uid()
    'public.get_linked_clients_last_remote_session_as_professional(uuid)',      -- sito; puo_vedere_come_professionista
    'public.get_linked_clients_last_remote_session_row()',                      -- app; auth.uid()
    'public.get_monitoring_sessions_for_professional(integer)',                 -- app; auth.uid()
    'public.get_monthly_comparison(text, text)',                                -- app; NESSUN controllo diretto: passa da get_night_monthly_comparison (nota 1)
    'public.get_my_night_status()',                                             -- app; hrv_my_subject_id
    'public.get_night_baselines(text, text)',                                   -- nessun chiamante trovato; hrv_puo_leggere_soggetto
    'public.get_night_metrics(text, text, integer)',                            -- app; hrv_puo_leggere_soggetto
    'public.get_night_monthly_comparison(text, text, text)',                    -- app; hrv_puo_leggere_soggetto
    'public.get_night_overview_for_professional()',                             -- app; auth.uid()
    'public.get_pending_link_requests()',                                       -- app; auth.uid()
    'public.hrv_baseline_rest_reference(uuid)',                                 -- app; hrv_puo_accedere
    'public.hrv_soggetto_e_se_stesso(uuid, text)',                              -- app (1 punto); predicato booleano, nessun dato
    'public.note_night_alert(uuid, text)',                                      -- app; auth.uid() + guardia
    'public.puo_vedere_come_professionista(uuid)',                              -- sito (sito-033); auth.uid() / service_role
    'public.refresh_night_status(text, text)',                                  -- app; hrv_puo_leggere_soggetto
    'public.sync_night_alerts(text, text)'                                      -- app; auth.uid() + guardia
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- B. Funzioni nelle policy RLS: via PUBLIC e anon, resta authenticated
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.client_can_assign_session_text(uuid, text)',   -- policy su sessions (rls_skip_cliente_puo_assegnare)
    'public.hrv_puo_accedere(uuid)',                       -- policy storage.objects monitoring_rr_* e monitoring_spo2_* (upload file RR e SpO2 dall'app): DEVE restare ad authenticated (correzione del 15/10)
    'public.hrv_puo_leggere_soggetto(text)',               -- policy night_*; chiamata da 14 funzioni
    'public.is_superadmin()',                              -- policy superadmin_read_*, sito (10 punti)
    'public.monitoring_can_access(uuid, uuid)',            -- policy monitoring_sessions, app
    'public.night_can_access(uuid, uuid, text)'            -- policy night_*
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- C. Interne, trigger, cron, backfill, amministrative: solo service_role
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    -- trigger (pg_trigger)
    'public.auth_user_deleted_pulisci_registro()',          -- trigger su auth.users
    'public.sync_session_to_measurement_analytics()',       -- trigger su sessions
    'public.tg_abbonamento_iniziale()',                     -- trigger su profiles, professional_profiles
    'public.tg_compute_client_baseline()',                  -- trigger su measurement_analytics
    'public.tg_create_client_on_active_link()',             -- trigger su client_professional_links
    'public.tg_ma_salta_non_propria()',                     -- trigger su measurement_analytics
    'public.tg_night_metrics_delete_from_session()',        -- trigger su monitoring_sessions
    'public.tg_night_metrics_from_session()',               -- trigger su monitoring_sessions
    'public.tg_night_metrics_refresh()',                    -- trigger su night_metrics
    'public.tg_profiles_ensure_client_bridge()',            -- trigger su profiles
    'public.tg_sessions_salta_non_propria()',               -- trigger su sessions
    -- cron (cron.job) e manutenzione
    'public.cleanup_stale_sport_live_data()',               -- cron.job 3, ogni ora
    'public.night_cron_daily(boolean)',                     -- cron.job 7 e 8
    'public.backfill_client_baselines(boolean)',            -- backfill amministrativo, nessun chiamante
    'public.backfill_night_metrics_from_sessions()',        -- backfill amministrativo, nessun chiamante
    'public.recompute_all_client_baselines(text)',          -- amministrativa, nessun chiamante
    'public.reset_client_baseline(uuid, text)',             -- nessun chiamante (ha le guardie: se l'app la userà, riaprire ad authenticated)
    'public.reset_night_baseline(text, text, text)',        -- nessun chiamante (idem)
    'public.compute_night_baseline(text, text, text, boolean)', -- interna: reset_night_baseline, refresh_night_status
    -- interne, chiamate solo da altre funzioni SECURITY DEFINER
    'public.account_stato_effettivo(uuid)',                 -- my_account_access, admin_*, commerciale_*
    'public.client_can_assign_session(uuid, uuid)',         -- nessun chiamante (variante uuid della _text)
    'public.evaluate_night_alerts(text, text)',             -- sync_night_alerts
    'public.find_linked_client_user_id_by_email(text)',     -- nessun chiamante
    'public.hrv_e_amministrativo()',                        -- backfill_*, hrv_puo_*, night_cron_daily, gdpr_cancella_scheda
    'public.hrv_my_subject_id()',                           -- get_night_*, get_my_night_status
    'public.night_action_level(text, text)',                -- night_status_json
    'public.night_metrics_upsert_from_session(monitoring_sessions)', -- tg_night_metrics_from_session, backfill
    'public.night_rolling_state(text, text)',               -- night_status_json
    'public.night_signatures(text, text)',                  -- night_status_json
    'public.night_status_json(text, boolean)',              -- get_my_night_status, get_client_night_status
    'public.rls_skip_cliente_puo_assegnare(uuid, text)',    -- tg_sessions_salta_non_propria
    'public.rls_skip_registra(text, text, uuid, text, uuid, text)' -- tg_*_salta_non_propria, sito-042
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- D. Le funzioni nuove non nascono più eseguibili da chiunque
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

commit;

-- Nota 1: `get_client_night_status(text)` e `get_monthly_comparison(text, text)`
-- non leggono auth.uid() in prima persona: delegano a `night_status_json` /
-- `get_night_monthly_comparison`, che usano `hrv_puo_leggere_soggetto`. Vanno
-- bene così, ma se una delle due funzioni interne cambia, il controllo sparisce
-- senza che si veda da fuori. Da annotare nel debito dell'app.
--
-- Verifica:
--   select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE');
--   -- atteso: nessuna riga
--   Poi un giro dell'app (login cliente, misurazione remota, notte) e del sito
--   (home, scheda con cliente collegato, organizzazione) per cogliere un
--   permesso mancante: l'errore sarebbe 42501 "permission denied for function".
