-- =============================================================================
-- STRESS INDEX — Migrazione Dashboard Professionale
-- Versione: 001
-- Data: 2026-05-13
-- Eseguire su Supabase SQL Editor (https://supabase.com/dashboard)
-- =============================================================================
-- Questa migrazione aggiunge:
-- 1. Nuove tabelle: alerts, client_settings, messages, notification_preferences, ai_insights
-- 2. Estensione client_notes (tags, attachments_urls)
-- 3. Colonna last_measurement_at su clients (con backfill da sessions)
-- 4. RLS policies multi-tenant su tutte le nuove tabelle
-- =============================================================================

-- Estensione uuid-ossp (se non già abilitata)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1) Estensione tabella clients: aggiunge last_measurement_at
-- =============================================================================
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_measurement_at TIMESTAMPTZ;

-- Backfill last_measurement_at dai sessions esistenti
UPDATE clients c
SET last_measurement_at = sub.max_created
FROM (
  SELECT client_id, MAX(created_at) AS max_created
  FROM sessions
  GROUP BY client_id
) sub
WHERE c.id = sub.client_id
  AND (c.last_measurement_at IS NULL OR c.last_measurement_at < sub.max_created);

-- =============================================================================
-- 2) Estensione tabella client_notes (se esiste)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'client_notes'
  ) THEN
    ALTER TABLE client_notes
      ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS attachments_urls TEXT[] DEFAULT '{}';
  ELSE
    -- Crea client_notes se non esiste
    CREATE TABLE client_notes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      professional_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      session_id UUID,
      content TEXT NOT NULL,
      tags TEXT[] DEFAULT '{}',
      attachments_urls TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "client_notes_select_own" ON client_notes
      FOR SELECT USING (auth.uid() = professional_id);
    CREATE POLICY "client_notes_insert_own" ON client_notes
      FOR INSERT WITH CHECK (auth.uid() = professional_id);
    CREATE POLICY "client_notes_update_own" ON client_notes
      FOR UPDATE USING (auth.uid() = professional_id);
    CREATE POLICY "client_notes_delete_own" ON client_notes
      FOR DELETE USING (auth.uid() = professional_id);
  END IF;
END $$;

-- =============================================================================
-- 3) Tabella alerts
-- =============================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('high_stress','low_recovery','missed_measurement','abnormal_value','trend_negative')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  message TEXT,
  triggering_value NUMERIC,
  triggering_metric TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  seen_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_professional_status ON alerts(professional_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_client ON alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts_select_own" ON alerts;
CREATE POLICY "alerts_select_own" ON alerts
  FOR SELECT USING (auth.uid() = professional_id);

DROP POLICY IF EXISTS "alerts_insert_own" ON alerts;
CREATE POLICY "alerts_insert_own" ON alerts
  FOR INSERT WITH CHECK (auth.uid() = professional_id);

DROP POLICY IF EXISTS "alerts_update_own" ON alerts;
CREATE POLICY "alerts_update_own" ON alerts
  FOR UPDATE USING (auth.uid() = professional_id);

DROP POLICY IF EXISTS "alerts_delete_own" ON alerts;
CREATE POLICY "alerts_delete_own" ON alerts
  FOR DELETE USING (auth.uid() = professional_id);

-- =============================================================================
-- 4) Tabella client_settings
-- =============================================================================
CREATE TABLE IF NOT EXISTS client_settings (
  client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  expected_frequency_per_week INTEGER DEFAULT 0,
  alert_threshold_stress INTEGER DEFAULT 80,
  alert_threshold_recovery INTEGER DEFAULT 30,
  alert_threshold_balance INTEGER DEFAULT 30,
  alert_threshold_energy INTEGER DEFAULT 30,
  tags TEXT[] DEFAULT '{}',
  assigned_protocol_id UUID,
  last_measurement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;

-- Accesso via owner del client referenziato (multi-tenant)
DROP POLICY IF EXISTS "client_settings_select_own" ON client_settings;
CREATE POLICY "client_settings_select_own" ON client_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_settings.client_id
        AND c.professional_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_settings_insert_own" ON client_settings;
CREATE POLICY "client_settings_insert_own" ON client_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_settings.client_id
        AND c.professional_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_settings_update_own" ON client_settings;
CREATE POLICY "client_settings_update_own" ON client_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_settings.client_id
        AND c.professional_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_settings_delete_own" ON client_settings;
CREATE POLICY "client_settings_delete_own" ON client_settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_settings.client_id
        AND c.professional_id = auth.uid()
    )
  );

-- =============================================================================
-- 5) Tabella messages (per ora canale solo email; predisposto per push futuro)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subject TEXT,
  content TEXT,
  channel TEXT DEFAULT 'email' CHECK (channel IN ('email','push')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  delivered BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_professional ON messages(professional_id);
CREATE INDEX IF NOT EXISTS idx_messages_client ON messages(client_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING (auth.uid() = professional_id);

DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (auth.uid() = professional_id);

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING (auth.uid() = professional_id);

DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (auth.uid() = professional_id);

-- =============================================================================
-- 6) Tabella notification_preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_summary_email BOOLEAN DEFAULT TRUE,
  weekly_summary_day TEXT DEFAULT 'monday' CHECK (weekly_summary_day IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  weekly_summary_time TEXT DEFAULT '08:00',
  alert_email_enabled BOOLEAN DEFAULT FALSE,
  marketing_email_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_prefs_select_own" ON notification_preferences;
CREATE POLICY "notif_prefs_select_own" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_prefs_insert_own" ON notification_preferences;
CREATE POLICY "notif_prefs_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_prefs_update_own" ON notification_preferences;
CREATE POLICY "notif_prefs_update_own" ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_prefs_delete_own" ON notification_preferences;
CREATE POLICY "notif_prefs_delete_own" ON notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 7) Tabella ai_insights (predisposizione futura)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  summary TEXT,
  recommendations TEXT,
  generated_at TIMESTAMPTZ,
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_client ON ai_insights(client_id);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_insights_select_own" ON ai_insights;
CREATE POLICY "ai_insights_select_own" ON ai_insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = ai_insights.client_id
        AND c.professional_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_insights_insert_own" ON ai_insights;
CREATE POLICY "ai_insights_insert_own" ON ai_insights
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = ai_insights.client_id
        AND c.professional_id = auth.uid()
    )
  );

-- =============================================================================
-- 8) Trigger: aggiorna automaticamente clients.last_measurement_at quando arriva una sessione
-- =============================================================================
CREATE OR REPLACE FUNCTION update_client_last_measurement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clients
  SET last_measurement_at = NEW.created_at
  WHERE id = NEW.client_id
    AND (last_measurement_at IS NULL OR last_measurement_at < NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sessions_update_last_measurement ON sessions;
CREATE TRIGGER trg_sessions_update_last_measurement
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_measurement();

-- =============================================================================
-- 9) Verifica struttura
-- =============================================================================
SELECT 'alerts' AS table_name, COUNT(*) AS row_count FROM alerts
UNION ALL SELECT 'client_settings', COUNT(*) FROM client_settings
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'notification_preferences', COUNT(*) FROM notification_preferences
UNION ALL SELECT 'ai_insights', COUNT(*) FROM ai_insights;
