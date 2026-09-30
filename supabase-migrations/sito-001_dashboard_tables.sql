-- ============================================================================
-- Stress Index Dashboard - Migrazione tabelle area professionisti
-- ============================================================================
-- Estende il database esistente con: alerts, client_settings, messages,
-- notification_preferences, ai_insights + colonne aggiuntive su client_notes
-- e clients per la dashboard web /area-professionisti
--
-- IMPORTANTE: la tabella clients esistente ha id di tipo TEXT (non UUID),
-- quindi tutte le foreign key client_id sono text.
-- ============================================================================

-- ROLLBACK IDEMPOTENTE: rende lo script ri-eseguibile in sicurezza
DROP TABLE IF EXISTS ai_insights CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS client_settings CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;

-- ============================================================================
-- 1. Tabella ALERTS
-- ============================================================================
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('high_stress','low_recovery','missed_measurement','abnormal_value','trend_negative')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  message text,
  triggering_value numeric,
  triggering_metric text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX idx_alerts_professional ON alerts(professional_id, status, created_at DESC);
CREATE INDEX idx_alerts_client ON alerts(client_id, created_at DESC);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_own_data" ON alerts
  FOR ALL USING (auth.uid() = professional_id);

-- ============================================================================
-- 2. Tabella CLIENT_SETTINGS
-- ============================================================================
CREATE TABLE client_settings (
  client_id text PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  expected_frequency_per_week integer DEFAULT 0,
  alert_threshold_stress integer DEFAULT 80,
  alert_threshold_recovery integer DEFAULT 30,
  alert_threshold_balance integer DEFAULT 30,
  alert_threshold_energy integer DEFAULT 30,
  tags text[] DEFAULT '{}',
  assigned_protocol_id uuid,
  last_measurement_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_settings_own_data" ON client_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_settings.client_id
      AND c.professionista_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. Tabella MESSAGES
-- ============================================================================
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subject text,
  content text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','push')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  delivered boolean DEFAULT false
);

CREATE INDEX idx_messages_professional ON messages(professional_id, sent_at DESC);
CREATE INDEX idx_messages_client ON messages(client_id, sent_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_own_data" ON messages
  FOR ALL USING (auth.uid() = professional_id);

-- ============================================================================
-- 4. Tabella NOTIFICATION_PREFERENCES
-- ============================================================================
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_summary_email boolean DEFAULT true,
  weekly_summary_day text DEFAULT 'monday' CHECK (weekly_summary_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  weekly_summary_time text DEFAULT '08:00',
  alert_email_enabled boolean DEFAULT false,
  marketing_emails boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_own_data" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Tabella AI_INSIGHTS (predisposizione futura)
-- ============================================================================
CREATE TABLE ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  summary text,
  recommendations text,
  generated_at timestamptz DEFAULT now(),
  model_used text
);

CREATE INDEX idx_ai_insights_client ON ai_insights(client_id, generated_at DESC);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_insights_own_data" ON ai_insights
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = ai_insights.client_id
      AND c.professionista_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. Estensione CLIENT_NOTES (tags + attachments)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_notes' AND column_name = 'tags'
  ) THEN
    ALTER TABLE client_notes ADD COLUMN tags text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_notes' AND column_name = 'attachments_urls'
  ) THEN
    ALTER TABLE client_notes ADD COLUMN attachments_urls text[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- 7. Estensione CLIENTS (last_measurement_at + backfill + trigger)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'last_measurement_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN last_measurement_at timestamptz;
  END IF;
END $$;

-- Backfill last_measurement_at dalle sessions esistenti
UPDATE clients c
SET last_measurement_at = sub.max_ts
FROM (
  SELECT client_id, MAX(created_at) AS max_ts
  FROM sessions
  GROUP BY client_id
) sub
WHERE c.id = sub.client_id;

-- Trigger per aggiornamento automatico al nuovo inserimento di session
CREATE OR REPLACE FUNCTION update_client_last_measurement()
RETURNS trigger AS $$
BEGIN
  UPDATE clients
  SET last_measurement_at = NEW.created_at
  WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_client_last_measurement ON sessions;

CREATE TRIGGER trg_update_client_last_measurement
AFTER INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_client_last_measurement();

-- ============================================================================
-- FINE MIGRAZIONE
-- ============================================================================