-- =============================================================================
-- sito-040: search_path fisso sulle 49 funzioni segnalate dall'advisor
-- =============================================================================
-- Audit QA 14/10/2026, punto D3. Applicata da Claude il 15/10/2026.
--
-- `SET search_path = public, pg_temp` su ogni funzione senza search_path:
-- impedisce a un utente di far risolvere un nome di tabella o funzione dentro
-- un suo schema. Controllato prima: nessuna delle 49 usa funzioni di
-- estensioni senza schema (uuid_generate_v4, digest, unaccent...), `auth.uid()`
-- è sempre qualificato. Molte sono funzioni dell'app (`hrv_*`, `calc_*`,
-- `night_*`): la modifica va annotata anche nel changelog di `hrv_app`.
--
-- Come si annulla: `alter function <firma> reset search_path;` per ciascuna.
-- Idempotente.
-- =============================================================================

do $$
declare
  f text;
  firme text[] := array[
    'public.accept_organization_invite(uuid)',
    'public.calc_score_composito(double precision, double precision, double precision, double precision)',
    'public.calc_score_energia(double precision, double precision, double precision, double precision, double precision, text, text, text, boolean)',
    'public.calc_score_equilibrio(double precision, double precision, double precision, double precision, double precision)',
    'public.calc_score_modulazione_infiammatoria(double precision, double precision, double precision, text, text, text, boolean)',
    'public.calc_score_recupero(double precision, double precision, double precision, double precision, double precision, text, text, text, boolean)',
    'public.calc_score_stress(double precision, double precision, double precision, double precision, double precision, text, text, text, boolean)',
    'public.collegamenti_nome_norm(text, text)',
    'public.compute_proprietary_scores()',
    'public.gdpr_nuovo_percorso(text, uuid)',
    'public.gdpr_versione_num(text)',
    'public.generate_missed_measurement_alerts()',
    'public.generate_threshold_alerts()',
    'public.hrv_age_group(integer)',
    'public.hrv_baseline_params()',
    'public.hrv_baseline_trigger_disattivato()',
    'public.hrv_clamp_0_100(double precision)',
    'public.hrv_cv_pct(double precision[])',
    'public.hrv_fitness_level(boolean, text)',
    'public.hrv_gaussian_score(double precision, double precision, double precision)',
    'public.hrv_istante_reale(timestamp with time zone, smallint)',
    'public.hrv_lerp(double precision, double precision, double precision, double precision, double precision)',
    'public.hrv_lookup_norms(text, text, text, text)',
    'public.hrv_midpoint_minutes(time without time zone)',
    'public.hrv_night_params()',
    'public.hrv_normalize_baevsky_si(double precision, text, text, text)',
    'public.hrv_normalize_rmssd(double precision, text, text, text)',
    'public.hrv_normalize_sdnn(double precision, text, text, text)',
    'public.hrv_percentile_score(double precision, double precision, double precision, double precision)',
    'public.hrv_rappresentazione_legacy(timestamp with time zone)',
    'public.hrv_sleep_midpoint(time without time zone, time without time zone)',
    'public.hrv_versione_confrontabile(text)',
    'public.monitoring_nominal_night_minutes(timestamp with time zone, timestamp with time zone, integer)',
    'public.monitoring_profile_for_row(integer, integer, integer)',
    'public.monitoring_sessions_touch_updated_at()',
    'public.night_compare_row(text, text, text, double precision, double precision, double precision, boolean, boolean)',
    'public.night_hrv_ms(night_metrics, boolean)',
    'public.night_hrv_value(night_metrics, boolean)',
    'public.night_metrics_before_write()',
    'public.notification_preferences_touch()',
    'public.notification_reads_append_only()',
    'public.set_measured_at_utc()',
    'public.set_sport_session_utc()',
    'public.set_started_at_compat()',
    'public.set_started_at_utc()',
    'public.set_training_load_updated_at()',
    'public.sync_session_to_measurement_analytics()',
    'public.tg_ma_score_source()',
    'public.update_client_last_measurement()'
  ];
begin
  foreach f in array firme loop
    begin
      execute format('alter function %s set search_path = public, pg_temp', f);
    exception when undefined_function then
      raise notice 'sito-040: funzione % non trovata, salto', f;
    end;
  end loop;
end $$;

-- Verifica:
--   select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and not exists
--     (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%');
--   -- atteso: solo funzioni create dopo questa migrazione
