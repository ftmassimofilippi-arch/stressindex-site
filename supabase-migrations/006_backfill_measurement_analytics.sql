-- =============================================================================
-- STRESS INDEX — Backfill measurement_analytics da sessions
-- Versione: 006
-- Eseguire dopo 005
-- =============================================================================
-- Legge tutti i record esistenti in public.sessions ed estrae i parametri HRV
-- da hrv_data jsonb per popolare measurement_analytics.
--
-- Il trigger compute_proprietary_scores (migrazione 005) si attiva
-- automaticamente per ogni INSERT e calcola i 6 score proprietari.
--
-- Mapping JSON keys (camelCase) → colonne SQL (snake_case):
--   sdnn → sdnn, rmssd → rmssd, pnn50 → pnn50, pnn20 → pnn20
--   meanBpm → mean_hr, cv → cv, rmssdSdnnRatio → rmssd_sdnn_ratio
--   vlfPower → vlf_power, lfPower → lf_power, hfPower → hf_power
--   totalPower → total_power, lfHfRatio → lf_hf_ratio
--   lfNorm → lf_nu, hfNorm → hf_nu
--   vlfPowerLs → vlf_power_ls, lfPowerLs → lf_power_ls, hfPowerLs → hf_power_ls
--   totalPowerLs → total_power_ls, lfHfRatioLs → lf_hf_ratio_ls
--   lfNormLs → lf_nu_ls, hfNormLs → hf_nu_ls
--   sd1 → sd1, sd2 → sd2, sd1Sd2Ratio → sd1_sd2_ratio
--   dfaAlpha1 → dfa_alpha1, dfaAlpha2 → dfa_alpha2
--   sampEn → sample_entropy, apEn → approximate_entropy
--   hrvTriangularIndex → triangular_index, tinn → tinn
--   stressIndex → stress_index_baevsky
--   rrIntervals → rr_intervals (array)
--   sampleCount → rr_count
-- =============================================================================

-- =============================================================================
-- STEP 1: Backfill via INSERT ... SELECT
-- ON CONFLICT NOTHING garantisce idempotenza se eseguito più volte
-- =============================================================================

INSERT INTO measurement_analytics (
  session_id,
  user_id,
  client_id,
  measured_at,
  duration_seconds,
  sensor_type,
  sensor_name,
  age,
  sex,
  is_smoker,
  is_athlete,
  activity_level,
  rr_intervals,
  rr_count,
  mean_rr,
  sdnn,
  rmssd,
  pnn50,
  pnn20,
  mean_hr,
  cv,
  rmssd_sdnn_ratio,
  vlf_power,
  lf_power,
  hf_power,
  total_power,
  lf_hf_ratio,
  lf_nu,
  hf_nu,
  vlf_power_ls,
  lf_power_ls,
  hf_power_ls,
  total_power_ls,
  lf_hf_ratio_ls,
  sd1,
  sd2,
  sd1_sd2_ratio,
  dfa_alpha1,
  dfa_alpha2,
  sample_entropy,
  approximate_entropy,
  triangular_index,
  tinn,
  stress_index_baevsky,
  tags,
  test_type,
  created_at
)
SELECT
  s.id AS session_id,
  s.professionista_id AS user_id,
  s.client_id,
  COALESCE(s.started_at, s.created_at) AS measured_at,
  s.duration_seconds,
  NULL AS sensor_type,
  NULL AS sensor_name,
  -- Age calcolata da data_nascita del cliente
  CASE 
    WHEN c.data_nascita IS NOT NULL THEN
      EXTRACT(YEAR FROM AGE(COALESCE(s.started_at, s.created_at), c.data_nascita))::integer
    ELSE NULL
  END AS age,
  c.sesso AS sex,
  c.fumatore AS is_smoker,
  c.atleta AS is_athlete,
  c.livello_attivita AS activity_level,
  -- RR intervals: jsonb array → text[] → numeric[]
  CASE 
    WHEN s.hrv_data ? 'rrIntervals' THEN
      ARRAY(SELECT (jsonb_array_elements(s.hrv_data->'rrIntervals'))::text::double precision)
    ELSE NULL
  END AS rr_intervals,
  (s.hrv_data->>'sampleCount')::integer AS rr_count,
  -- Mean RR: non presente nel JSON, lo calcoliamo come 60000/meanBpm se possibile
  CASE 
    WHEN (s.hrv_data->>'meanBpm')::double precision > 0 THEN
      60000.0 / (s.hrv_data->>'meanBpm')::double precision
    ELSE NULL
  END AS mean_rr,
  (s.hrv_data->>'sdnn')::double precision,
  (s.hrv_data->>'rmssd')::double precision,
  (s.hrv_data->>'pnn50')::double precision,
  (s.hrv_data->>'pnn20')::double precision,
  (s.hrv_data->>'meanBpm')::double precision AS mean_hr,
  (s.hrv_data->>'cv')::double precision,
  (s.hrv_data->>'rmssdSdnnRatio')::double precision,
  (s.hrv_data->>'vlfPower')::double precision,
  (s.hrv_data->>'lfPower')::double precision,
  (s.hrv_data->>'hfPower')::double precision,
  (s.hrv_data->>'totalPower')::double precision,
  (s.hrv_data->>'lfHfRatio')::double precision,
  (s.hrv_data->>'lfNorm')::double precision AS lf_nu,
  (s.hrv_data->>'hfNorm')::double precision AS hf_nu,
  (s.hrv_data->>'vlfPowerLs')::double precision,
  (s.hrv_data->>'lfPowerLs')::double precision,
  (s.hrv_data->>'hfPowerLs')::double precision,
  (s.hrv_data->>'totalPowerLs')::double precision,
  (s.hrv_data->>'lfHfRatioLs')::double precision,
  (s.hrv_data->>'sd1')::double precision,
  (s.hrv_data->>'sd2')::double precision,
  (s.hrv_data->>'sd1Sd2Ratio')::double precision,
  (s.hrv_data->>'dfaAlpha1')::double precision,
  (s.hrv_data->>'dfaAlpha2')::double precision,
  (s.hrv_data->>'sampEn')::double precision AS sample_entropy,
  (s.hrv_data->>'apEn')::double precision AS approximate_entropy,
  (s.hrv_data->>'hrvTriangularIndex')::double precision AS triangular_index,
  (s.hrv_data->>'tinn')::double precision,
  (s.hrv_data->>'stressIndex')::double precision AS stress_index_baevsky,
  s.tags,
  s.test_type,
  s.created_at
FROM sessions s
LEFT JOIN clients c ON s.client_id = c.id
WHERE s.hrv_data IS NOT NULL
ON CONFLICT (session_id) DO NOTHING;

-- =============================================================================
-- NOTA: ON CONFLICT richiede UNIQUE constraint su session_id
-- Se non esiste, la creiamo subito (idempotente)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'measurement_analytics_session_id_unique'
  ) THEN
    -- Solo se non ci sono duplicati esistenti
    IF NOT EXISTS (
      SELECT session_id FROM measurement_analytics 
      WHERE session_id IS NOT NULL
      GROUP BY session_id HAVING COUNT(*) > 1
    ) THEN
      ALTER TABLE measurement_analytics 
        ADD CONSTRAINT measurement_analytics_session_id_unique UNIQUE (session_id);
    END IF;
  END IF;
END $$;

-- =============================================================================
-- VERIFICA
-- =============================================================================
SELECT 
  COUNT(*) AS records_inseriti,
  COUNT(score_stress) AS con_stress_calcolato,
  COUNT(score_recupero) AS con_recupero_calcolato,
  COUNT(score_equilibrio) AS con_equilibrio_calcolato,
  COUNT(score_energia) AS con_energia_calcolato,
  COUNT(score_modulazione_infiammatoria) AS con_modulazione_calcolato,
  COUNT(score_composito) AS con_composito_calcolato,
  ROUND(AVG(score_stress)::numeric, 1) AS media_stress,
  ROUND(AVG(score_recupero)::numeric, 1) AS media_recupero,
  ROUND(AVG(score_equilibrio)::numeric, 1) AS media_equilibrio,
  ROUND(AVG(score_energia)::numeric, 1) AS media_energia,
  ROUND(AVG(score_composito)::numeric, 1) AS media_composito
FROM measurement_analytics;

-- Anteprima primi 5 record
SELECT 
  session_id,
  measured_at,
  ROUND(score_stress::numeric, 1) AS stress,
  ROUND(score_recupero::numeric, 1) AS recupero,
  ROUND(score_equilibrio::numeric, 1) AS equilibrio,
  ROUND(score_energia::numeric, 1) AS energia,
  ROUND(score_modulazione_infiammatoria::numeric, 1) AS mod_infl,
  ROUND(score_composito::numeric, 1) AS composito
FROM measurement_analytics
ORDER BY measured_at DESC
LIMIT 5;
