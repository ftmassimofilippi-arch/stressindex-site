-- =============================================================================
-- STRESS INDEX — Sync automatico sessions → measurement_analytics
-- Versione: 007
-- Eseguire dopo 006
-- =============================================================================
-- L'app Flutter scrive in fire-and-forget su measurement_analytics
-- (vedi lib/services/analytics_service.dart). Se la chiamata fallisce
-- (rete intermittente, RLS, race condition di sync) la riga manca e la
-- dashboard /area-professionisti/clienti/[id] mostra "Nessuna misurazione".
--
-- Soluzione DB-level: trigger AFTER INSERT/UPDATE su sessions che fa
-- upsert sulla measurement_analytics estraendo da hrv_data jsonb. Il
-- trigger BEFORE INSERT/UPDATE della migrazione 005 calcola poi gli score
-- proprietari, quindi una singola INSERT su sessions popola tutta la
-- catena automaticamente.
--
-- Idempotente: rieseguibile in sicurezza.
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_session_to_measurement_analytics()
RETURNS trigger AS $$
DECLARE
  v_age integer;
  v_sex text;
  v_is_smoker boolean;
  v_is_athlete boolean;
  v_activity text;
  v_birth date;
BEGIN
  IF NEW.hrv_data IS NULL THEN
    RETURN NEW;
  END IF;

  -- Demografia dal cliente (per il calcolo score normalizzato)
  SELECT c.data_nascita, c.sesso, c.fumatore, c.atleta, c.livello_attivita
    INTO v_birth, v_sex, v_is_smoker, v_is_athlete, v_activity
  FROM clients c
  WHERE c.id = NEW.client_id;

  IF v_birth IS NOT NULL THEN
    v_age := EXTRACT(YEAR FROM AGE(COALESCE(NEW.started_at, NEW.created_at), v_birth))::integer;
  END IF;

  INSERT INTO measurement_analytics (
    session_id, user_id, client_id, measured_at, duration_seconds,
    age, sex, is_smoker, is_athlete, activity_level,
    rr_intervals, rr_count, mean_rr,
    sdnn, rmssd, pnn50, pnn20, mean_hr, cv, rmssd_sdnn_ratio,
    vlf_power, lf_power, hf_power, total_power, lf_hf_ratio, lf_nu, hf_nu,
    vlf_power_ls, lf_power_ls, hf_power_ls, total_power_ls, lf_hf_ratio_ls,
    sd1, sd2, sd1_sd2_ratio, dfa_alpha1, dfa_alpha2,
    sample_entropy, approximate_entropy,
    triangular_index, tinn, stress_index_baevsky,
    tags, test_type, created_at
  )
  VALUES (
    NEW.id,
    NEW.professionista_id,
    NEW.client_id,
    COALESCE(NEW.started_at, NEW.created_at),
    NEW.duration_seconds,
    v_age, v_sex, v_is_smoker, v_is_athlete, v_activity,
    CASE WHEN NEW.hrv_data ? 'rrIntervals'
      THEN ARRAY(SELECT (jsonb_array_elements(NEW.hrv_data->'rrIntervals'))::text::double precision)
      ELSE NULL
    END,
    NULLIF(NEW.hrv_data->>'sampleCount','')::integer,
    CASE WHEN NULLIF(NEW.hrv_data->>'meanBpm','')::double precision > 0
      THEN 60000.0 / (NEW.hrv_data->>'meanBpm')::double precision
      ELSE NULL
    END,
    NULLIF(NEW.hrv_data->>'sdnn','')::double precision,
    NULLIF(NEW.hrv_data->>'rmssd','')::double precision,
    NULLIF(NEW.hrv_data->>'pnn50','')::double precision,
    NULLIF(NEW.hrv_data->>'pnn20','')::double precision,
    NULLIF(NEW.hrv_data->>'meanBpm','')::double precision,
    NULLIF(NEW.hrv_data->>'cv','')::double precision,
    NULLIF(NEW.hrv_data->>'rmssdSdnnRatio','')::double precision,
    NULLIF(NEW.hrv_data->>'vlfPower','')::double precision,
    NULLIF(NEW.hrv_data->>'lfPower','')::double precision,
    NULLIF(NEW.hrv_data->>'hfPower','')::double precision,
    NULLIF(NEW.hrv_data->>'totalPower','')::double precision,
    NULLIF(NEW.hrv_data->>'lfHfRatio','')::double precision,
    NULLIF(NEW.hrv_data->>'lfNorm','')::double precision,
    NULLIF(NEW.hrv_data->>'hfNorm','')::double precision,
    NULLIF(NEW.hrv_data->>'vlfPowerLs','')::double precision,
    NULLIF(NEW.hrv_data->>'lfPowerLs','')::double precision,
    NULLIF(NEW.hrv_data->>'hfPowerLs','')::double precision,
    NULLIF(NEW.hrv_data->>'totalPowerLs','')::double precision,
    NULLIF(NEW.hrv_data->>'lfHfRatioLs','')::double precision,
    NULLIF(NEW.hrv_data->>'sd1','')::double precision,
    NULLIF(NEW.hrv_data->>'sd2','')::double precision,
    NULLIF(NEW.hrv_data->>'sd1Sd2Ratio','')::double precision,
    NULLIF(NEW.hrv_data->>'dfaAlpha1','')::double precision,
    NULLIF(NEW.hrv_data->>'dfaAlpha2','')::double precision,
    NULLIF(NEW.hrv_data->>'sampEn','')::double precision,
    NULLIF(NEW.hrv_data->>'apEn','')::double precision,
    NULLIF(NEW.hrv_data->>'hrvTriangularIndex','')::double precision,
    NULLIF(NEW.hrv_data->>'tinn','')::double precision,
    NULLIF(NEW.hrv_data->>'stressIndex','')::double precision,
    NEW.tags,
    NEW.test_type,
    NEW.created_at
  )
  ON CONFLICT (session_id) DO UPDATE SET
    measured_at = EXCLUDED.measured_at,
    duration_seconds = EXCLUDED.duration_seconds,
    age = EXCLUDED.age,
    sex = EXCLUDED.sex,
    is_smoker = EXCLUDED.is_smoker,
    is_athlete = EXCLUDED.is_athlete,
    activity_level = EXCLUDED.activity_level,
    rr_intervals = EXCLUDED.rr_intervals,
    rr_count = EXCLUDED.rr_count,
    mean_rr = EXCLUDED.mean_rr,
    sdnn = EXCLUDED.sdnn,
    rmssd = EXCLUDED.rmssd,
    pnn50 = EXCLUDED.pnn50,
    pnn20 = EXCLUDED.pnn20,
    mean_hr = EXCLUDED.mean_hr,
    cv = EXCLUDED.cv,
    rmssd_sdnn_ratio = EXCLUDED.rmssd_sdnn_ratio,
    vlf_power = EXCLUDED.vlf_power,
    lf_power = EXCLUDED.lf_power,
    hf_power = EXCLUDED.hf_power,
    total_power = EXCLUDED.total_power,
    lf_hf_ratio = EXCLUDED.lf_hf_ratio,
    lf_nu = EXCLUDED.lf_nu,
    hf_nu = EXCLUDED.hf_nu,
    vlf_power_ls = EXCLUDED.vlf_power_ls,
    lf_power_ls = EXCLUDED.lf_power_ls,
    hf_power_ls = EXCLUDED.hf_power_ls,
    total_power_ls = EXCLUDED.total_power_ls,
    lf_hf_ratio_ls = EXCLUDED.lf_hf_ratio_ls,
    sd1 = EXCLUDED.sd1,
    sd2 = EXCLUDED.sd2,
    sd1_sd2_ratio = EXCLUDED.sd1_sd2_ratio,
    dfa_alpha1 = EXCLUDED.dfa_alpha1,
    dfa_alpha2 = EXCLUDED.dfa_alpha2,
    sample_entropy = EXCLUDED.sample_entropy,
    approximate_entropy = EXCLUDED.approximate_entropy,
    triangular_index = EXCLUDED.triangular_index,
    tinn = EXCLUDED.tinn,
    stress_index_baevsky = EXCLUDED.stress_index_baevsky,
    tags = EXCLUDED.tags,
    test_type = EXCLUDED.test_type;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Il trigger gira come SECURITY DEFINER per scavalcare RLS:
-- il proprietario della funzione (postgres) può sempre upsert.
-- L'isolamento multi-tenant è garantito dal fatto che user_id viene
-- impostato esplicitamente a NEW.professionista_id.

DROP TRIGGER IF EXISTS trg_sync_session_to_ma ON sessions;

CREATE TRIGGER trg_sync_session_to_ma
AFTER INSERT OR UPDATE OF hrv_data, started_at, duration_seconds, tags, test_type
ON sessions
FOR EACH ROW
EXECUTE FUNCTION sync_session_to_measurement_analytics();

-- =============================================================================
-- BACKFILL: copia tutte le sessions esistenti che non hanno una riga
-- in measurement_analytics. Il BEFORE trigger di 005 calcola gli score.
-- =============================================================================
INSERT INTO measurement_analytics (
  session_id, user_id, client_id, measured_at, duration_seconds,
  age, sex, is_smoker, is_athlete, activity_level,
  rr_intervals, rr_count, mean_rr,
  sdnn, rmssd, pnn50, pnn20, mean_hr, cv, rmssd_sdnn_ratio,
  vlf_power, lf_power, hf_power, total_power, lf_hf_ratio, lf_nu, hf_nu,
  vlf_power_ls, lf_power_ls, hf_power_ls, total_power_ls, lf_hf_ratio_ls,
  sd1, sd2, sd1_sd2_ratio, dfa_alpha1, dfa_alpha2,
  sample_entropy, approximate_entropy,
  triangular_index, tinn, stress_index_baevsky,
  tags, test_type, created_at
)
SELECT
  s.id, s.professionista_id, s.client_id,
  COALESCE(s.started_at, s.created_at),
  s.duration_seconds,
  CASE WHEN c.data_nascita IS NOT NULL
    THEN EXTRACT(YEAR FROM AGE(COALESCE(s.started_at, s.created_at), c.data_nascita))::integer
    ELSE NULL
  END,
  c.sesso, c.fumatore, c.atleta, c.livello_attivita,
  CASE WHEN s.hrv_data ? 'rrIntervals'
    THEN ARRAY(SELECT (jsonb_array_elements(s.hrv_data->'rrIntervals'))::text::double precision)
    ELSE NULL
  END,
  NULLIF(s.hrv_data->>'sampleCount','')::integer,
  CASE WHEN NULLIF(s.hrv_data->>'meanBpm','')::double precision > 0
    THEN 60000.0 / (s.hrv_data->>'meanBpm')::double precision
    ELSE NULL
  END,
  NULLIF(s.hrv_data->>'sdnn','')::double precision,
  NULLIF(s.hrv_data->>'rmssd','')::double precision,
  NULLIF(s.hrv_data->>'pnn50','')::double precision,
  NULLIF(s.hrv_data->>'pnn20','')::double precision,
  NULLIF(s.hrv_data->>'meanBpm','')::double precision,
  NULLIF(s.hrv_data->>'cv','')::double precision,
  NULLIF(s.hrv_data->>'rmssdSdnnRatio','')::double precision,
  NULLIF(s.hrv_data->>'vlfPower','')::double precision,
  NULLIF(s.hrv_data->>'lfPower','')::double precision,
  NULLIF(s.hrv_data->>'hfPower','')::double precision,
  NULLIF(s.hrv_data->>'totalPower','')::double precision,
  NULLIF(s.hrv_data->>'lfHfRatio','')::double precision,
  NULLIF(s.hrv_data->>'lfNorm','')::double precision,
  NULLIF(s.hrv_data->>'hfNorm','')::double precision,
  NULLIF(s.hrv_data->>'vlfPowerLs','')::double precision,
  NULLIF(s.hrv_data->>'lfPowerLs','')::double precision,
  NULLIF(s.hrv_data->>'hfPowerLs','')::double precision,
  NULLIF(s.hrv_data->>'totalPowerLs','')::double precision,
  NULLIF(s.hrv_data->>'lfHfRatioLs','')::double precision,
  NULLIF(s.hrv_data->>'sd1','')::double precision,
  NULLIF(s.hrv_data->>'sd2','')::double precision,
  NULLIF(s.hrv_data->>'sd1Sd2Ratio','')::double precision,
  NULLIF(s.hrv_data->>'dfaAlpha1','')::double precision,
  NULLIF(s.hrv_data->>'dfaAlpha2','')::double precision,
  NULLIF(s.hrv_data->>'sampEn','')::double precision,
  NULLIF(s.hrv_data->>'apEn','')::double precision,
  NULLIF(s.hrv_data->>'hrvTriangularIndex','')::double precision,
  NULLIF(s.hrv_data->>'tinn','')::double precision,
  NULLIF(s.hrv_data->>'stressIndex','')::double precision,
  s.tags, s.test_type, s.created_at
FROM sessions s
LEFT JOIN clients c ON s.client_id = c.id
WHERE s.hrv_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM measurement_analytics ma WHERE ma.session_id = s.id
  );

-- =============================================================================
-- VERIFICA
-- =============================================================================
SELECT
  (SELECT COUNT(*) FROM sessions WHERE hrv_data IS NOT NULL) AS total_sessions,
  (SELECT COUNT(*) FROM measurement_analytics) AS total_measurement_analytics,
  (SELECT COUNT(*) FROM sessions s
     WHERE s.hrv_data IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM measurement_analytics ma WHERE ma.session_id = s.id)) AS still_missing;
