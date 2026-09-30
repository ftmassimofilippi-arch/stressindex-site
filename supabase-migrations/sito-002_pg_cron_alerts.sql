-- =============================================================================
-- STRESS INDEX — Cron Alerts + Weekly Summary
-- Versione: 002
-- Eseguire dopo 001
-- =============================================================================
-- Genera automaticamente:
--   - threshold_alerts (ogni ora) -> high_stress, low_recovery, score_equilibrio basso, score_energia basso
--   - missed_measurement_alerts (ogni 6 ore) -> clienti che non misurano da troppo tempo
-- Schedula:
--   - weekly_summary (lunedì 8:00 UTC) -> chiama Edge Function /functions/v1/weekly-summary
-- =============================================================================

-- Estensioni richieste
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- 1. FUNZIONE: generate_threshold_alerts
-- Genera alert quando score recenti escono dalle soglie
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_threshold_alerts()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  -- HIGH STRESS: score_stress sopra soglia (default 80)
  FOR r IN
    SELECT 
      ma.client_id,
      c.professionista_id AS professional_id,
      ma.score_stress AS value,
      ma.measured_at,
      COALESCE(cs.alert_threshold_stress, 80) AS threshold
    FROM measurement_analytics ma
    JOIN clients c ON ma.client_id = c.id
    LEFT JOIN client_settings cs ON ma.client_id = cs.client_id
    WHERE ma.measured_at > NOW() - INTERVAL '24 hours'
      AND ma.score_stress IS NOT NULL
      AND ma.score_stress > COALESCE(cs.alert_threshold_stress, 80)
  LOOP
    INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
    SELECT 
      r.professional_id, r.client_id, 'high_stress', 'high',
      'Indice di Stress elevato: ' || ROUND(r.value::numeric, 1)::text || ' (soglia ' || r.threshold::text || ')',
      r.value, 'score_stress'
    WHERE NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.client_id = r.client_id
        AND a.type = 'high_stress'
        AND a.status IN ('new','seen')
        AND a.created_at > NOW() - INTERVAL '24 hours'
    );
  END LOOP;

  -- LOW RECOVERY: score_recupero sotto soglia (default 30)
  FOR r IN
    SELECT 
      ma.client_id,
      c.professionista_id AS professional_id,
      ma.score_recupero AS value,
      ma.measured_at,
      COALESCE(cs.alert_threshold_recovery, 30) AS threshold
    FROM measurement_analytics ma
    JOIN clients c ON ma.client_id = c.id
    LEFT JOIN client_settings cs ON ma.client_id = cs.client_id
    WHERE ma.measured_at > NOW() - INTERVAL '24 hours'
      AND ma.score_recupero IS NOT NULL
      AND ma.score_recupero < COALESCE(cs.alert_threshold_recovery, 30)
  LOOP
    INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
    SELECT 
      r.professional_id, r.client_id, 'low_recovery', 'medium',
      'Indice di Recupero basso: ' || ROUND(r.value::numeric, 1)::text || ' (soglia ' || r.threshold::text || ')',
      r.value, 'score_recupero'
    WHERE NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.client_id = r.client_id
        AND a.type = 'low_recovery'
        AND a.status IN ('new','seen')
        AND a.created_at > NOW() - INTERVAL '24 hours'
    );
  END LOOP;

  -- LOW EQUILIBRIO: score_equilibrio sotto soglia (default 30)
  FOR r IN
    SELECT 
      ma.client_id,
      c.professionista_id AS professional_id,
      ma.score_equilibrio AS value,
      ma.measured_at,
      COALESCE(cs.alert_threshold_balance, 30) AS threshold
    FROM measurement_analytics ma
    JOIN clients c ON ma.client_id = c.id
    LEFT JOIN client_settings cs ON ma.client_id = cs.client_id
    WHERE ma.measured_at > NOW() - INTERVAL '24 hours'
      AND ma.score_equilibrio IS NOT NULL
      AND ma.score_equilibrio < COALESCE(cs.alert_threshold_balance, 30)
  LOOP
    INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
    SELECT 
      r.professional_id, r.client_id, 'abnormal_value', 'medium',
      'Indice di Equilibrio basso: ' || ROUND(r.value::numeric, 1)::text,
      r.value, 'score_equilibrio'
    WHERE NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.client_id = r.client_id
        AND a.triggering_metric = 'score_equilibrio'
        AND a.status IN ('new','seen')
        AND a.created_at > NOW() - INTERVAL '24 hours'
    );
  END LOOP;

  -- LOW ENERGIA: score_energia sotto soglia (default 30)
  FOR r IN
    SELECT 
      ma.client_id,
      c.professionista_id AS professional_id,
      ma.score_energia AS value,
      ma.measured_at,
      COALESCE(cs.alert_threshold_energy, 30) AS threshold
    FROM measurement_analytics ma
    JOIN clients c ON ma.client_id = c.id
    LEFT JOIN client_settings cs ON ma.client_id = cs.client_id
    WHERE ma.measured_at > NOW() - INTERVAL '24 hours'
      AND ma.score_energia IS NOT NULL
      AND ma.score_energia < COALESCE(cs.alert_threshold_energy, 30)
  LOOP
    INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
    SELECT 
      r.professional_id, r.client_id, 'abnormal_value', 'medium',
      'Indice di Energia basso: ' || ROUND(r.value::numeric, 1)::text,
      r.value, 'score_energia'
    WHERE NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.client_id = r.client_id
        AND a.triggering_metric = 'score_energia'
        AND a.status IN ('new','seen')
        AND a.created_at > NOW() - INTERVAL '24 hours'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. FUNZIONE: generate_missed_measurement_alerts
-- Genera alert per clienti che non misurano da troppo tempo
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_missed_measurement_alerts()
RETURNS void AS $$
DECLARE
  r RECORD;
  expected_interval_days numeric;
BEGIN
  FOR r IN
    SELECT 
      c.id AS client_id,
      c.professionista_id AS professional_id,
      c.last_measurement_at,
      cs.expected_frequency_per_week
    FROM clients c
    LEFT JOIN client_settings cs ON c.id = cs.client_id
    WHERE cs.expected_frequency_per_week IS NOT NULL
      AND cs.expected_frequency_per_week > 0
  LOOP
    -- Calcola intervallo atteso in giorni: 7 / frequenza settimanale, con margine x2
    expected_interval_days := (7.0 / r.expected_frequency_per_week) * 2;

    IF r.last_measurement_at IS NULL 
       OR r.last_measurement_at < NOW() - (expected_interval_days || ' days')::interval THEN

      INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_metric)
      SELECT
        r.professional_id, r.client_id, 'missed_measurement', 'low',
        CASE 
          WHEN r.last_measurement_at IS NULL THEN 'Cliente non ha mai misurato'
          ELSE 'Ultima misurazione: ' || TO_CHAR(r.last_measurement_at, 'DD/MM/YYYY') || ' (oltre ' || expected_interval_days::int::text || ' giorni)'
        END,
        'last_measurement_at'
      WHERE NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.client_id = r.client_id
          AND a.type = 'missed_measurement'
          AND a.status IN ('new','seen')
          AND a.created_at > NOW() - INTERVAL '3 days'
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. SCHEDULAZIONE CRON
-- =============================================================================
-- Rimuovi job esistenti se presenti (idempotente, ignora se non esistono)
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid FROM cron.job 
    WHERE jobname IN (
      'generate_threshold_alerts_hourly',
      'generate_missed_alerts_6h',
      'send_weekly_summary'
    )
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

-- Threshold alerts ogni ora
SELECT cron.schedule(
  'generate_threshold_alerts_hourly',
  '0 * * * *',
  $$SELECT generate_threshold_alerts();$$
);

-- Missed measurement alerts ogni 6 ore
SELECT cron.schedule(
  'generate_missed_alerts_6h',
  '0 */6 * * *',
  $$SELECT generate_missed_measurement_alerts();$$
);

-- =============================================================================
-- 4. EMAIL SETTIMANALE (cron pg_net -> Edge Function)
-- =============================================================================
-- ATTENZIONE: prima di eseguire questa parte, sostituisci SERVICE_ROLE_KEY_HERE
-- con la tua service_role key reale (la trovi in Supabase Project Settings -> API).
-- Lascia per ora il blocco commentato. Quando avrai creato l'Edge Function
-- /functions/v1/weekly-summary, sostituisci la stringa e ri-esegui SOLO questa
-- parte finale.
-- =============================================================================

/*
SELECT cron.schedule(
  'send_weekly_summary',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://ivwmjwukpeldbqkxgvvf.supabase.co/functions/v1/weekly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_HERE'
    )
  );
  $$
);
*/

-- =============================================================================
-- VERIFICA
-- =============================================================================
SELECT jobname, schedule, active FROM cron.job 
WHERE jobname IN (
  'generate_threshold_alerts_hourly',
  'generate_missed_alerts_6h',
  'send_weekly_summary'
);