-- =============================================================================
-- STRESS INDEX — Cron Jobs Sistema Alert e Email Settimanale
-- Versione: 002
-- Eseguire dopo 001_dashboard_tables.sql
-- =============================================================================
-- Questa migrazione contiene:
-- 1. Funzioni per generazione automatica alert
-- 2. Cron job pg_cron (richiede estensione abilitata su Supabase)
-- 3. Trigger function per email settimanale (richiede Edge Function dedicata)
-- =============================================================================
-- NOTA: pg_cron va abilitato dall'admin Supabase (Database → Extensions → pg_cron)
-- =============================================================================

-- Abilita pg_cron (se non già fatto)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- Funzione: genera alert per soglie sforate sull'ultima misurazione
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_threshold_alerts()
RETURNS void AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Trova le ultime sessioni delle ultime 2 ore e confronta con soglie cliente
  FOR rec IN
    SELECT DISTINCT ON (s.client_id)
      s.id AS session_id,
      s.client_id,
      c.professionista_id AS professional_id,
      s.stress_score,
      s.recovery_score,
      s.balance_score,
      s.energy_score,
      s.created_at,
      COALESCE(cs.alert_threshold_stress, 80) AS thr_stress,
      COALESCE(cs.alert_threshold_recovery, 30) AS thr_recovery,
      COALESCE(cs.alert_threshold_balance, 30) AS thr_balance,
      COALESCE(cs.alert_threshold_energy, 30) AS thr_energy
    FROM sessions s
    JOIN clients c ON c.id = s.client_id
    LEFT JOIN client_settings cs ON cs.client_id = s.client_id
    WHERE s.created_at > NOW() - INTERVAL '2 hours'
    ORDER BY s.client_id, s.created_at DESC
  LOOP
    -- High stress
    IF rec.stress_score IS NOT NULL AND rec.stress_score >= rec.thr_stress THEN
      INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
      SELECT rec.professional_id, rec.client_id, 'high_stress',
        CASE WHEN rec.stress_score >= 90 THEN 'high' ELSE 'medium' END,
        'Indice di stress elevato rilevato',
        rec.stress_score, 'stress_score'
      WHERE NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.client_id = rec.client_id
          AND a.type = 'high_stress'
          AND a.status IN ('new','seen')
          AND a.created_at > NOW() - INTERVAL '24 hours'
      );
    END IF;

    -- Low recovery
    IF rec.recovery_score IS NOT NULL AND rec.recovery_score <= rec.thr_recovery THEN
      INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
      SELECT rec.professional_id, rec.client_id, 'low_recovery',
        CASE WHEN rec.recovery_score <= 15 THEN 'high' ELSE 'medium' END,
        'Recupero insufficiente',
        rec.recovery_score, 'recovery_score'
      WHERE NOT EXISTS (
        SELECT 1 FROM alerts a
        WHERE a.client_id = rec.client_id
          AND a.type = 'low_recovery'
          AND a.status IN ('new','seen')
          AND a.created_at > NOW() - INTERVAL '24 hours'
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Funzione: genera alert misurazioni mancanti
-- =============================================================================
CREATE OR REPLACE FUNCTION generate_missed_measurement_alerts()
RETURNS void AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      c.id AS client_id,
      c.professionista_id AS professional_id,
      c.last_measurement_at,
      cs.expected_frequency_per_week,
      EXTRACT(EPOCH FROM (NOW() - c.last_measurement_at))/86400 AS days_since
    FROM clients c
    JOIN client_settings cs ON cs.client_id = c.id
    WHERE cs.expected_frequency_per_week > 0
      AND c.last_measurement_at IS NOT NULL
      AND c.last_measurement_at < NOW() - (INTERVAL '7 days' / cs.expected_frequency_per_week * 2)
  LOOP
    INSERT INTO alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric)
    SELECT rec.professional_id, rec.client_id, 'missed_measurement', 'low',
      'Il cliente non misura da ' || ROUND(rec.days_since) || ' giorni',
      rec.days_since, 'days_since_last_measurement'
    WHERE NOT EXISTS (
      SELECT 1 FROM alerts a
      WHERE a.client_id = rec.client_id
        AND a.type = 'missed_measurement'
        AND a.status IN ('new','seen')
        AND a.created_at > NOW() - INTERVAL '3 days'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Schedula i cron job (ogni ora)
-- =============================================================================
-- Rimuovi job esistenti se presenti
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('generate_threshold_alerts_hourly','generate_missed_alerts_hourly')
ON CONFLICT DO NOTHING;

-- Threshold alerts ogni ora
SELECT cron.schedule(
  'generate_threshold_alerts_hourly',
  '0 * * * *',
  $$SELECT generate_threshold_alerts();$$
);

-- Missed measurement alerts ogni 6 ore
SELECT cron.schedule(
  'generate_missed_alerts_hourly',
  '0 */6 * * *',
  $$SELECT generate_missed_measurement_alerts();$$
);

-- =============================================================================
-- EMAIL SETTIMANALE
-- =============================================================================
-- L'invio email deve essere fatto via Supabase Edge Function (es. /functions/v1/weekly-summary)
-- Questo cron chiama un endpoint HTTP che genera e invia l'email via Resend
-- ATTENZIONE: sostituire <PROJECT_REF> e <SERVICE_ROLE_KEY> con i tuoi valori reali
-- =============================================================================

-- Esempio di chiamata HTTP da pg_cron (richiede pg_net abilitato)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedula la chiamata all'Edge Function ogni Lunedì alle 8:00 (UTC)
-- L'Edge Function leggerà notification_preferences e invierà email solo a chi ha weekly_summary_email=true
-- nel giorno/ora configurati.
SELECT cron.schedule(
  'send_weekly_summary',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://ivwmjwukpeldbqkxgvvf.supabase.co/functions/v1/weekly-summary',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer <SERVICE_ROLE_KEY>')
  );
  $$
);
