-- =============================================================================
-- STRESS INDEX — RLS measurement_analytics
-- Versione: 003
-- Eseguire dopo 001 e 002
-- =============================================================================
-- La dashboard /area-professionisti legge tutti gli score proprietari
-- e i parametri HRV da measurement_analytics. È quindi indispensabile
-- garantire l'isolamento multi-tenant via RLS.
-- =============================================================================
-- NB: measurement_analytics.user_id deve corrispondere a auth.uid() del
-- professionista che possiede la misurazione (popolato dall'app Flutter).
-- =============================================================================

ALTER TABLE measurement_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "measurement_analytics_own_data" ON measurement_analytics;
CREATE POLICY "measurement_analytics_own_data" ON measurement_analytics
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- Indici utili per le query della dashboard
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_ma_user_measured_at
  ON measurement_analytics(user_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ma_client_measured_at
  ON measurement_analytics(client_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ma_session_id
  ON measurement_analytics(session_id);

-- =============================================================================
-- Verifica
-- =============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'measurement_analytics') AS policy_count
FROM pg_tables
WHERE tablename = 'measurement_analytics';
