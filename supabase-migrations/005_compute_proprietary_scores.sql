-- =============================================================================
-- STRESS INDEX — Trigger compute_proprietary_scores
-- Versione: 005
-- Eseguire dopo 004
-- =============================================================================
-- Calcola automaticamente i 6 score proprietari su measurement_analytics
-- a partire dai parametri HRV grezzi e dalla demografia del cliente.
--
-- Replica fedelmente la logica Dart di:
--   lib/utils/proprietary_scores.dart
--   lib/utils/demographic_normalization.dart
--
-- Trigger BEFORE INSERT OR UPDATE: gli score vengono calcolati prima del salvataggio.
-- Se l'app Flutter scrive direttamente gli score, il trigger li sovrascrive
-- garantendo single source of truth in DB.
-- =============================================================================

-- =============================================================================
-- HELPER: clamp 0-100
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_clamp_0_100(v double precision)
RETURNS double precision AS $$
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  IF v < 0 THEN RETURN 0; END IF;
  IF v > 100 THEN RETURN 100; END IF;
  RETURN v;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER: derivazione age_group da age (anni)
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_age_group(p_age integer)
RETURNS text AS $$
BEGIN
  IF p_age IS NULL THEN RETURN NULL; END IF;
  IF p_age BETWEEN 18 AND 30 THEN RETURN 'young'; END IF;
  IF p_age BETWEEN 31 AND 45 THEN RETURN 'midAdult'; END IF;
  IF p_age BETWEEN 46 AND 60 THEN RETURN 'senior'; END IF;
  IF p_age >= 61                THEN RETURN 'elderly'; END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER: derivazione fitness da is_athlete + activity_level
-- Priorità: is_athlete=true → 'athlete'
-- Altrimenti activity_level: 'atleta' → 'athlete', 'attivo' → 'active',
--                            'moderato' → 'sedentary', altro → 'sedentary'
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_fitness_level(p_is_athlete boolean, p_activity text)
RETURNS text AS $$
BEGIN
  IF p_is_athlete IS TRUE THEN RETURN 'athlete'; END IF;
  IF p_activity IS NULL THEN RETURN 'sedentary'; END IF;
  CASE lower(p_activity)
    WHEN 'atleta'    THEN RETURN 'athlete';
    WHEN 'attivo'    THEN RETURN 'active';
    WHEN 'moderato'  THEN RETURN 'sedentary';
    ELSE                  RETURN 'sedentary';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER: lookup norms con fallback
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_lookup_norms(
  p_metric text, p_sex text, p_age_group text, p_fitness text
)
RETURNS TABLE(p25 double precision, p50 double precision, p75 double precision) AS $$
BEGIN
  -- Tentativo lookup specifico
  IF p_sex IS NOT NULL AND p_age_group IS NOT NULL AND p_fitness IS NOT NULL THEN
    RETURN QUERY
    SELECT n.p25, n.p50, n.p75 FROM hrv_norms n
    WHERE n.metric = p_metric
      AND n.sex = p_sex
      AND n.age_group = p_age_group
      AND n.fitness = p_fitness
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
  -- Fallback general population
  RETURN QUERY
  SELECT f.p25, f.p50, f.p75 FROM hrv_norms_fallback f WHERE f.metric = p_metric LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- HELPER: linear interpolation tra (x1,y1) e (x2,y2) per x
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_lerp(
  x double precision, x1 double precision, x2 double precision,
  y1 double precision, y2 double precision
)
RETURNS double precision AS $$
BEGIN
  IF x2 = x1 THEN RETURN y1; END IF;
  RETURN y1 + (x - x1) / (x2 - x1) * (y2 - y1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER: percentile score "higher is better"
-- Anchor: 0→0, P25→25, P50→50, P75→75, P95(=P75+(P75-P50))→100
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_percentile_score(
  value double precision, p25 double precision, p50 double precision, p75 double precision
)
RETURNS double precision AS $$
DECLARE
  p95 double precision;
BEGIN
  IF value IS NULL OR p25 IS NULL OR p50 IS NULL OR p75 IS NULL THEN RETURN NULL; END IF;
  IF value <= 0 THEN RETURN 0; END IF;
  p95 := p75 + (p75 - p50);
  IF value >= p95 THEN RETURN 100; END IF;
  IF value >= p75 THEN RETURN hrv_lerp(value, p75, p95, 75, 100); END IF;
  IF value >= p50 THEN RETURN hrv_lerp(value, p50, p75, 50, 75); END IF;
  IF value >= p25 THEN RETURN hrv_lerp(value, p25, p50, 25, 50); END IF;
  RETURN hrv_lerp(value, 0, p25, 0, 25);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER: gaussian score (per balance/equilibrio)
-- score = 100 * exp(-((v-target)/sigma)^2)
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_gaussian_score(
  v double precision, target double precision, sigma double precision
)
RETURNS double precision AS $$
DECLARE
  z double precision;
BEGIN
  IF v IS NULL OR sigma IS NULL OR sigma <= 0 THEN RETURN 0; END IF;
  z := (v - target) / sigma;
  RETURN hrv_clamp_0_100(100 * exp(-z * z));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- HELPER: normalizeRmssd / normalizeSdnn / normalizeLfhf / normalizeDfaAlpha1
-- / normalizeBaevskySi (replica delle API Dart)
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_normalize_rmssd(
  rmssd double precision, sex text, age_group text, fitness text
)
RETURNS double precision AS $$
DECLARE
  norms RECORD;
BEGIN
  IF rmssd IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO norms FROM hrv_lookup_norms('rmssd', sex, age_group, fitness);
  RETURN hrv_percentile_score(rmssd, norms.p25, norms.p50, norms.p75);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION hrv_normalize_sdnn(
  sdnn double precision, sex text, age_group text, fitness text
)
RETURNS double precision AS $$
DECLARE
  norms RECORD;
BEGIN
  IF sdnn IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO norms FROM hrv_lookup_norms('sdnn', sex, age_group, fitness);
  RETURN hrv_percentile_score(sdnn, norms.p25, norms.p50, norms.p75);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION hrv_normalize_baevsky_si(
  si double precision, sex text, age_group text, fitness text
)
RETURNS double precision AS $$
DECLARE
  norms RECORD;
  raw_score double precision;
BEGIN
  IF si IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO norms FROM hrv_lookup_norms('si', sex, age_group, fitness);
  raw_score := hrv_percentile_score(si, norms.p25, norms.p50, norms.p75);
  IF raw_score IS NULL THEN RETURN NULL; END IF;
  -- Invertito: SI alto = stress alto = score alto (già "higher is worse" in input)
  RETURN raw_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNZIONE PRINCIPALE: calcola_score_stress
-- Pesi: Baevsky 30% + SDNN 25% + TotalPower 20% + DFA 15% + HFnu 10%
-- =============================================================================
CREATE OR REPLACE FUNCTION calc_score_stress(
  p_stress_index_baevsky double precision,
  p_sdnn double precision,
  p_total_power double precision,
  p_dfa_alpha1 double precision,
  p_hf_nu double precision,
  p_sex text, p_age_group text, p_fitness text,
  p_has_demo boolean
)
RETURNS double precision AS $$
DECLARE
  total double precision := 0;
  weight double precision := 0;
  v double precision;
  si_val double precision;
  dfa_dist double precision;
BEGIN
  -- 1) Baevsky SI normalizzato (30%)
  IF p_stress_index_baevsky IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_baevsky_si(p_stress_index_baevsky, p_sex, p_age_group, p_fitness);
    ELSE
      -- piecewise no-demo
      si_val := p_stress_index_baevsky;
      IF si_val < 50 THEN
        v := 40;
      ELSIF si_val <= 150 THEN
        v := 30 + (si_val - 50) / 100.0 * 20;
      ELSIF si_val <= 250 THEN
        v := 50 + (si_val - 150) / 100.0 * 25;
      ELSIF si_val <= 500 THEN
        v := 75 + (si_val - 250) / 250.0 * 25;
      ELSE
        v := 100;
      END IF;
    END IF;
    IF v IS NOT NULL THEN
      total := total + v * 0.30;
      weight := weight + 0.30;
    END IF;
  END IF;

  -- 2) SDNN normalizzato invertito (25%)
  IF p_sdnn IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_sdnn(p_sdnn, p_sex, p_age_group, p_fitness);
    ELSE
      v := hrv_clamp_0_100((p_sdnn - 10) / 90.0 * 100);
    END IF;
    IF v IS NOT NULL THEN
      v := 100 - v; -- invertito
      total := total + v * 0.25;
      weight := weight + 0.25;
    END IF;
  END IF;

  -- 3) Total Power (20%)
  IF p_total_power IS NOT NULL THEN
    v := 100 - LEAST(GREATEST(p_total_power, 0), 5000) / 5000.0 * 100;
    total := total + v * 0.20;
    weight := weight + 0.20;
  END IF;

  -- 4) DFA Alpha1 (15%): distanza da [0.85, 1.15]
  IF p_dfa_alpha1 IS NOT NULL THEN
    IF p_dfa_alpha1 BETWEEN 0.85 AND 1.15 THEN
      v := 0;
    ELSIF p_dfa_alpha1 < 0.85 THEN
      dfa_dist := 0.85 - p_dfa_alpha1;
      v := LEAST(dfa_dist / 0.40, 1) * 100;
    ELSE
      dfa_dist := p_dfa_alpha1 - 1.15;
      v := LEAST(dfa_dist / 0.40, 1) * 100;
    END IF;
    total := total + v * 0.15;
    weight := weight + 0.15;
  END IF;

  -- 5) HFnu (10%): 0 se ≥40, 100 se ≤15, lineare in mezzo
  IF p_hf_nu IS NOT NULL THEN
    IF p_hf_nu >= 40 THEN
      v := 0;
    ELSIF p_hf_nu <= 15 THEN
      v := 100;
    ELSE
      v := (40 - p_hf_nu) / 25.0 * 100;
    END IF;
    total := total + v * 0.10;
    weight := weight + 0.10;
  END IF;

  IF weight = 0 THEN RETURN 50; END IF;
  RETURN hrv_clamp_0_100(total / weight);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- calc_score_recupero
-- Pesi: RMSSD 35% + HFnu 20% + pNN50 15% + SD1 15% + MeanHR_inv 15%
-- =============================================================================
CREATE OR REPLACE FUNCTION calc_score_recupero(
  p_rmssd double precision, p_hf_nu double precision, p_pnn50 double precision,
  p_sd1 double precision, p_mean_hr double precision,
  p_sex text, p_age_group text, p_fitness text, p_has_demo boolean
)
RETURNS double precision AS $$
DECLARE
  total double precision := 0;
  weight double precision := 0;
  v double precision;
BEGIN
  -- RMSSD demo normalizzato (35%)
  IF p_rmssd IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_rmssd(p_rmssd, p_sex, p_age_group, p_fitness);
    ELSE
      v := hrv_clamp_0_100((p_rmssd - 10) / 70.0 * 100);
    END IF;
    total := total + v * 0.35;
    weight := weight + 0.35;
  END IF;

  -- HFnu (20%)
  IF p_hf_nu IS NOT NULL THEN
    IF p_hf_nu <= 30 THEN
      v := 0;
    ELSIF p_hf_nu >= 60 THEN
      v := 100;
    ELSE
      v := (p_hf_nu - 30) / 30.0 * 100;
    END IF;
    total := total + v * 0.20;
    weight := weight + 0.20;
  END IF;

  -- pNN50 (15%)
  IF p_pnn50 IS NOT NULL THEN
    v := hrv_clamp_0_100(p_pnn50 / 30.0 * 100);
    total := total + v * 0.15;
    weight := weight + 0.15;
  END IF;

  -- SD1 (15%)
  IF p_sd1 IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_rmssd(p_sd1 * 1.41, p_sex, p_age_group, p_fitness);
    ELSE
      v := hrv_clamp_0_100(p_sd1 / 50.0 * 100);
    END IF;
    total := total + v * 0.15;
    weight := weight + 0.15;
  END IF;

  -- Mean HR inverso (15%): 60bpm→100, 100bpm→0
  IF p_mean_hr IS NOT NULL THEN
    v := hrv_clamp_0_100((100 - p_mean_hr) / 40.0 * 100);
    total := total + v * 0.15;
    weight := weight + 0.15;
  END IF;

  IF weight = 0 THEN RETURN 50; END IF;
  RETURN hrv_clamp_0_100(total / weight);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- calc_score_equilibrio
-- Pesi: SD1/SD2 30% + DFA 25% + LF/HF 20% + HFnu 15% + RMSSD/SDNN 10%
-- Tutte le componenti usano gaussian score (target fissi fisiologici)
-- =============================================================================
CREATE OR REPLACE FUNCTION calc_score_equilibrio(
  p_sd1_sd2_ratio double precision, p_dfa_alpha1 double precision,
  p_lf_hf_ratio double precision, p_hf_nu double precision,
  p_rmssd_sdnn_ratio double precision
)
RETURNS double precision AS $$
DECLARE
  total double precision := 0;
  weight double precision := 0;
  v double precision;
BEGIN
  IF p_sd1_sd2_ratio IS NOT NULL THEN
    v := hrv_gaussian_score(p_sd1_sd2_ratio, 0.40, 0.20);
    total := total + v * 0.30;
    weight := weight + 0.30;
  END IF;

  IF p_dfa_alpha1 IS NOT NULL THEN
    v := hrv_gaussian_score(p_dfa_alpha1, 1.00, 0.30);
    total := total + v * 0.25;
    weight := weight + 0.25;
  END IF;

  IF p_lf_hf_ratio IS NOT NULL THEN
    v := hrv_gaussian_score(p_lf_hf_ratio, 1.50, 1.50);
    total := total + v * 0.20;
    weight := weight + 0.20;
  END IF;

  IF p_hf_nu IS NOT NULL THEN
    v := hrv_gaussian_score(p_hf_nu, 50.0, 25.0);
    total := total + v * 0.15;
    weight := weight + 0.15;
  END IF;

  IF p_rmssd_sdnn_ratio IS NOT NULL THEN
    v := hrv_gaussian_score(p_rmssd_sdnn_ratio, 0.65, 0.20);
    total := total + v * 0.10;
    weight := weight + 0.10;
  END IF;

  IF weight = 0 THEN RETURN 50; END IF;
  RETURN hrv_clamp_0_100(total / weight);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- calc_score_energia
-- Pesi: TotalPower 30% + SDNN 25% + RMSSD 20% + DFA(gauss) 15% + TI 10%
-- =============================================================================
CREATE OR REPLACE FUNCTION calc_score_energia(
  p_total_power double precision, p_sdnn double precision, p_rmssd double precision,
  p_dfa_alpha1 double precision, p_triangular_index double precision,
  p_sex text, p_age_group text, p_fitness text, p_has_demo boolean
)
RETURNS double precision AS $$
DECLARE
  total double precision := 0;
  weight double precision := 0;
  v double precision;
BEGIN
  IF p_total_power IS NOT NULL THEN
    v := hrv_clamp_0_100(p_total_power / 5000.0 * 100);
    total := total + v * 0.30;
    weight := weight + 0.30;
  END IF;

  IF p_sdnn IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_sdnn(p_sdnn, p_sex, p_age_group, p_fitness);
    ELSE
      v := hrv_clamp_0_100((p_sdnn - 10) / 90.0 * 100);
    END IF;
    total := total + v * 0.25;
    weight := weight + 0.25;
  END IF;

  IF p_rmssd IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_rmssd(p_rmssd, p_sex, p_age_group, p_fitness);
    ELSE
      v := hrv_clamp_0_100((p_rmssd - 10) / 70.0 * 100);
    END IF;
    total := total + v * 0.20;
    weight := weight + 0.20;
  END IF;

  IF p_dfa_alpha1 IS NOT NULL THEN
    v := hrv_gaussian_score(p_dfa_alpha1, 1.0, 0.30);
    total := total + v * 0.15;
    weight := weight + 0.15;
  END IF;

  IF p_triangular_index IS NOT NULL THEN
    v := hrv_clamp_0_100(p_triangular_index / 30.0 * 100);
    total := total + v * 0.10;
    weight := weight + 0.10;
  END IF;

  IF weight = 0 THEN RETURN 50; END IF;
  RETURN hrv_clamp_0_100(total / weight);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- calc_score_modulazione_infiammatoria
-- Pesi: RMSSD 50% + HFnu 30% + DFA 20%
-- =============================================================================
CREATE OR REPLACE FUNCTION calc_score_modulazione_infiammatoria(
  p_rmssd double precision, p_hf_nu double precision, p_dfa_alpha1 double precision,
  p_sex text, p_age_group text, p_fitness text, p_has_demo boolean
)
RETURNS double precision AS $$
DECLARE
  total double precision := 0;
  weight double precision := 0;
  v double precision;
  dfa_dist double precision;
BEGIN
  -- RMSSD (50%)
  IF p_rmssd IS NOT NULL THEN
    IF p_has_demo THEN
      v := hrv_normalize_rmssd(p_rmssd, p_sex, p_age_group, p_fitness);
    ELSE
      -- no-demo: usa fallback general population
      v := hrv_percentile_score(p_rmssd, 17, 29, 46);
    END IF;
    total := total + v * 0.50;
    weight := weight + 0.50;
  END IF;

  -- HFnu (30%): ≤30→0, ≥50→100, lineare
  IF p_hf_nu IS NOT NULL THEN
    IF p_hf_nu <= 30 THEN
      v := 0;
    ELSIF p_hf_nu >= 50 THEN
      v := 100;
    ELSE
      v := (p_hf_nu - 30) / 20.0 * 100;
    END IF;
    total := total + v * 0.30;
    weight := weight + 0.30;
  END IF;

  -- DFA Alpha1 (20%): dentro [0.85, 1.15] = 100, fuori decresce
  IF p_dfa_alpha1 IS NOT NULL THEN
    IF p_dfa_alpha1 BETWEEN 0.85 AND 1.15 THEN
      v := 100;
    ELSIF p_dfa_alpha1 < 0.85 THEN
      dfa_dist := 0.85 - p_dfa_alpha1;
      v := (1 - LEAST(dfa_dist / 0.30, 1)) * 100;
    ELSE
      dfa_dist := p_dfa_alpha1 - 1.15;
      v := (1 - LEAST(dfa_dist / 0.30, 1)) * 100;
    END IF;
    total := total + v * 0.20;
    weight := weight + 0.20;
  END IF;

  IF weight = 0 THEN RETURN 50; END IF;
  RETURN hrv_clamp_0_100(total / weight);
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- calc_score_composito
-- Recupero 30% + Equilibrio 25% + Energia 20% + (100-Stress) 25%
-- =============================================================================
CREATE OR REPLACE FUNCTION calc_score_composito(
  p_recupero double precision, p_equilibrio double precision,
  p_energia double precision, p_stress double precision
)
RETURNS double precision AS $$
BEGIN
  IF p_recupero IS NULL OR p_equilibrio IS NULL OR p_energia IS NULL OR p_stress IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN hrv_clamp_0_100(
    p_recupero   * 0.30 +
    p_equilibrio * 0.25 +
    p_energia    * 0.20 +
    (100 - p_stress) * 0.25
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- TRIGGER FUNCTION: compute_proprietary_scores
-- =============================================================================
CREATE OR REPLACE FUNCTION compute_proprietary_scores()
RETURNS trigger AS $$
DECLARE
  age_group text;
  fitness text;
  has_demo boolean;
  sex_norm text;
BEGIN
  -- Normalizza sex (Dart usa Gender.male/female, DB usa lowercase string)
  IF NEW.sex IS NULL THEN
    sex_norm := NULL;
  ELSIF lower(NEW.sex) IN ('m','male','maschio','uomo') THEN
    sex_norm := 'male';
  ELSIF lower(NEW.sex) IN ('f','female','femmina','donna') THEN
    sex_norm := 'female';
  ELSE
    sex_norm := NULL;
  END IF;

  age_group := hrv_age_group(NEW.age);
  fitness := hrv_fitness_level(NEW.is_athlete, NEW.activity_level);

  has_demo := (sex_norm IS NOT NULL AND age_group IS NOT NULL AND fitness IS NOT NULL);

  -- Calcola Stress
  NEW.score_stress := calc_score_stress(
    NEW.stress_index_baevsky, NEW.sdnn, NEW.total_power, NEW.dfa_alpha1, NEW.hf_nu,
    sex_norm, age_group, fitness, has_demo
  );

  -- Calcola Recupero
  NEW.score_recupero := calc_score_recupero(
    NEW.rmssd, NEW.hf_nu, NEW.pnn50, NEW.sd1, NEW.mean_hr,
    sex_norm, age_group, fitness, has_demo
  );

  -- Calcola Equilibrio
  NEW.score_equilibrio := calc_score_equilibrio(
    NEW.sd1_sd2_ratio, NEW.dfa_alpha1, NEW.lf_hf_ratio, NEW.hf_nu, NEW.rmssd_sdnn_ratio
  );

  -- Calcola Energia
  NEW.score_energia := calc_score_energia(
    NEW.total_power, NEW.sdnn, NEW.rmssd, NEW.dfa_alpha1, NEW.triangular_index,
    sex_norm, age_group, fitness, has_demo
  );

  -- Calcola Modulazione Infiammatoria
  NEW.score_modulazione_infiammatoria := calc_score_modulazione_infiammatoria(
    NEW.rmssd, NEW.hf_nu, NEW.dfa_alpha1,
    sex_norm, age_group, fitness, has_demo
  );

  -- Calcola Composito (deve essere fatto DOPO gli altri 4)
  NEW.score_composito := calc_score_composito(
    NEW.score_recupero, NEW.score_equilibrio, NEW.score_energia, NEW.score_stress
  );

  -- Metadata
  NEW.algorithm_version := '1.2.0-sql';
  NEW.score_weights := jsonb_build_object(
    'stress',                jsonb_build_object('baevsky', 0.30, 'sdnn', 0.25, 'total_power', 0.20, 'dfa', 0.15, 'hf_nu', 0.10),
    'recupero',              jsonb_build_object('rmssd', 0.35, 'hf_nu', 0.20, 'pnn50', 0.15, 'sd1', 0.15, 'mean_hr_inv', 0.15),
    'equilibrio',            jsonb_build_object('sd1_sd2', 0.30, 'dfa', 0.25, 'lf_hf', 0.20, 'hf_nu', 0.15, 'rmssd_sdnn', 0.10),
    'energia',               jsonb_build_object('total_power', 0.30, 'sdnn', 0.25, 'rmssd', 0.20, 'dfa', 0.15, 'ti', 0.10),
    'modulazione_infl',      jsonb_build_object('rmssd', 0.50, 'hf_nu', 0.30, 'dfa', 0.20),
    'composito',             jsonb_build_object('recupero', 0.30, 'equilibrio', 0.25, 'energia', 0.20, 'stress_inv', 0.25)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ATTIVAZIONE TRIGGER su measurement_analytics
-- =============================================================================
DROP TRIGGER IF EXISTS trg_compute_proprietary_scores ON measurement_analytics;

CREATE TRIGGER trg_compute_proprietary_scores
BEFORE INSERT OR UPDATE ON measurement_analytics
FOR EACH ROW
EXECUTE FUNCTION compute_proprietary_scores();

-- =============================================================================
-- VERIFICA
-- =============================================================================
SELECT 
  'Trigger creato' AS status,
  tgname AS trigger_name,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgrelid = 'measurement_analytics'::regclass
AND tgname = 'trg_compute_proprietary_scores';
