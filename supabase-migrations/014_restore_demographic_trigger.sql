-- =============================================================================
-- STRESS INDEX — Migration 014
-- Restore trigger DEMOGRAFICO + fix B/C sulle funzioni helper
-- =============================================================================
-- Da eseguire MANUALMENTE nel SQL editor Supabase, DOPO backup del DB.
-- Eseguire DOPO 004 (hrv_norms) e 005 (calc_score_*): questa migration
-- assume che le tabelle hrv_norms / hrv_norms_fallback e tutte le funzioni
-- calc_score_* + hrv_* siano gia presenti (verificato il 2026-06-20).
--
-- COSA FA:
--   1. Fix B  — hrv_fitness_level: 'moderato' -> 'active'  (era 'sedentary')
--   2. Fix C  — hrv_age_group: eta<18 -> 'young' (cascata <=, era NULL)
--   3. Ripristina compute_proprietary_scores() alla versione DEMOGRAFICA:
--      chiama calc_score_*(... sex_norm, age_group, fitness, has_demo),
--      NON piu le _hrv_score_* degradate (no-demo).
--
-- COSA NON FA (di proposito):
--   - NON ricalcola le righe storiche degradate. Quello e uno script SEPARATO
--     (015_recalc_degraded_rows.sql) da lanciare SOLO dopo aver verificato che
--     questo trigger gira bene sulle misure NUOVE.
--
-- NOTE SQL EDITOR SUPABASE:
--   - Tutti i corpi funzione usano $BODY$ (non $$) per evitare che l'editor
--     spezzi il dollar-quoting.
-- =============================================================================


-- =============================================================================
-- 1) FIX B — hrv_fitness_level
--    Replica DemographicProfile.fromFields (demographic_normalization.dart:57-64):
--      atleta==true  || livello=='atleta'                 -> athlete
--      livello=='attivo' || livello=='moderato'           -> active   <-- fix B
--      altrimenti                                          -> sedentary
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_fitness_level(p_is_athlete boolean, p_activity text)
RETURNS text AS $BODY$
BEGIN
  IF p_is_athlete IS TRUE THEN RETURN 'athlete'; END IF;
  IF p_activity IS NULL THEN RETURN 'sedentary'; END IF;
  CASE lower(p_activity)
    WHEN 'atleta'    THEN RETURN 'athlete';
    WHEN 'attivo'    THEN RETURN 'active';
    WHEN 'moderato'  THEN RETURN 'active';     -- fix B: era 'sedentary'
    ELSE                  RETURN 'sedentary';
  END CASE;
END;
$BODY$ LANGUAGE plpgsql IMMUTABLE;


-- =============================================================================
-- 2) FIX C — hrv_age_group
--    Replica DemographicProfile.fromFields (demographic_normalization.dart:43-54):
--      eta == null -> unknown (qui: NULL)
--      eta <= 30   -> young      (NESSUN limite inferiore: <18 = young)  <-- fix C
--      eta <= 45   -> midAdult
--      eta <= 60   -> senior
--      altrimenti  -> elderly
-- =============================================================================
CREATE OR REPLACE FUNCTION hrv_age_group(p_age integer)
RETURNS text AS $BODY$
BEGIN
  IF p_age IS NULL THEN RETURN NULL; END IF;
  IF p_age <= 30 THEN RETURN 'young';    END IF;   -- fix C: era BETWEEN 18 AND 30
  IF p_age <= 45 THEN RETURN 'midAdult'; END IF;   --        era BETWEEN 31 AND 45
  IF p_age <= 60 THEN RETURN 'senior';   END IF;   --        era BETWEEN 46 AND 60
  RETURN 'elderly';                                 --        era IF >=61, altrimenti NULL
END;
$BODY$ LANGUAGE plpgsql IMMUTABLE;


-- =============================================================================
-- 3) TRIGGER FUNCTION — compute_proprietary_scores (versione DEMOGRAFICA)
-- =============================================================================
-- Struttura di sicurezza INVARIATA rispetto alla versione in produzione:
--   - EARLY RETURN: se l'app ha gia mandato tutti e 6 gli score
--     (caso 1.2.0-flutter) -> RETURN NEW, score preservati verbatim.
--   - FALLBACK (almeno uno score nullo): calcola i mancanti e li riempie via
--     COALESCE, preservando eventuali score parziali gia presenti.
--   - EXCEPTION WHEN OTHERS: in caso di errore marca '1.2.0-sql-error' e
--     NON blocca l'insert/update.
--
-- UNICA differenza vs produzione: il ramo fallback ora usa calc_score_*
-- CON demografia (sex_norm/age_group/fitness/has_demo) invece delle
-- _hrv_score_* no-demo. has_demo=true solo se sesso+eta sono normalizzabili;
-- in mancanza, calc_score_* usa internamente il ramo no-demo / fallback norms.
-- =============================================================================
CREATE OR REPLACE FUNCTION compute_proprietary_scores()
RETURNS trigger AS $BODY$
DECLARE
  sex_norm    text;
  age_group   text;
  fitness     text;
  has_demo    boolean;
  v_stress    double precision;
  v_recovery  double precision;
  v_balance   double precision;
  v_energy    double precision;
  v_inflam    double precision;
BEGIN
  -- ---- EARLY RETURN: app ha gia fornito tutti gli score (invariato) --------
  IF NEW.score_stress IS NOT NULL
     AND NEW.score_recupero IS NOT NULL
     AND NEW.score_equilibrio IS NOT NULL
     AND NEW.score_energia IS NOT NULL
     AND NEW.score_modulazione_infiammatoria IS NOT NULL
     AND NEW.score_composito IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- ---- Normalizzazione demografica (come migration 005) --------------------
  IF NEW.sex IS NULL THEN
    sex_norm := NULL;
  ELSIF lower(NEW.sex) IN ('m','male','maschio','uomo') THEN
    sex_norm := 'male';
  ELSIF lower(NEW.sex) IN ('f','female','femmina','donna') THEN
    sex_norm := 'female';
  ELSE
    sex_norm := NULL;
  END IF;

  age_group := hrv_age_group(NEW.age);            -- con fix C
  fitness   := hrv_fitness_level(NEW.is_athlete, NEW.activity_level);  -- con fix B

  has_demo := (sex_norm IS NOT NULL AND age_group IS NOT NULL AND fitness IS NOT NULL);

  -- ---- Calcolo score (demografico se has_demo, altrimenti no-demo) ---------
  v_stress := calc_score_stress(
    NEW.stress_index_baevsky, NEW.sdnn, NEW.total_power, NEW.dfa_alpha1, NEW.hf_nu,
    sex_norm, age_group, fitness, has_demo
  );
  v_recovery := calc_score_recupero(
    NEW.rmssd, NEW.hf_nu, NEW.pnn50, NEW.sd1, NEW.mean_hr,
    sex_norm, age_group, fitness, has_demo
  );
  v_balance := calc_score_equilibrio(
    NEW.sd1_sd2_ratio, NEW.dfa_alpha1, NEW.lf_hf_ratio, NEW.hf_nu, NEW.rmssd_sdnn_ratio
  );
  v_energy := calc_score_energia(
    NEW.total_power, NEW.sdnn, NEW.rmssd, NEW.dfa_alpha1, NEW.triangular_index,
    sex_norm, age_group, fitness, has_demo
  );
  v_inflam := calc_score_modulazione_infiammatoria(
    NEW.rmssd, NEW.hf_nu, NEW.dfa_alpha1,
    sex_norm, age_group, fitness, has_demo
  );

  -- ---- Riempi solo i mancanti (COALESCE: preserva score parziali) ---------
  NEW.score_stress                    := COALESCE(NEW.score_stress, v_stress);
  NEW.score_recupero                  := COALESCE(NEW.score_recupero, v_recovery);
  NEW.score_equilibrio                := COALESCE(NEW.score_equilibrio, v_balance);
  NEW.score_energia                   := COALESCE(NEW.score_energia, v_energy);
  NEW.score_modulazione_infiammatoria := COALESCE(NEW.score_modulazione_infiammatoria, v_inflam);
  -- Composito derivato dai 4 score FINALI (post-COALESCE, mai null a questo punto)
  NEW.score_composito := COALESCE(
    NEW.score_composito,
    calc_score_composito(NEW.score_recupero, NEW.score_equilibrio, NEW.score_energia, NEW.score_stress)
  );

  -- ---- Marker versione (invariato) ----------------------------------------
  IF NEW.algorithm_version IS NULL OR NEW.algorithm_version = '1.1.0' THEN
    NEW.algorithm_version := '1.2.0-sql-fallback';
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Non bloccare mai l'insert/update: marca la riga e prosegui.
  NEW.algorithm_version := '1.2.0-sql-error';
  RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql;


-- =============================================================================
-- 4) (Ri)attivazione trigger — idempotente.
--    CREATE OR REPLACE FUNCTION sopra aggiorna gia il corpo usato dal trigger
--    esistente; questo blocco riasserisce il binding per sicurezza/documentazione.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_compute_proprietary_scores ON measurement_analytics;

CREATE TRIGGER trg_compute_proprietary_scores
BEFORE INSERT OR UPDATE ON measurement_analytics
FOR EACH ROW
EXECUTE FUNCTION compute_proprietary_scores();


-- =============================================================================
-- 5) VERIFICA (read-only) — eseguire dopo la migration
-- =============================================================================
-- a) fix helper
SELECT hrv_fitness_level(false,'moderato') AS deve_essere_active,
       hrv_age_group(15)                   AS deve_essere_young,
       hrv_age_group(70)                   AS deve_essere_elderly;

-- b) trigger attivo
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'measurement_analytics'::regclass
  AND tgname = 'trg_compute_proprietary_scores';
