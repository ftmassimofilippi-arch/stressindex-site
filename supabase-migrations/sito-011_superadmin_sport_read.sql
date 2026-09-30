-- =============================================
-- STRESS INDEX — Vista superadmin per il Modulo Sport (sola lettura)
-- Estende la migration 010_superadmin_read.sql alle tabelle del Modulo Sport.
-- Un utente con profiles.is_superadmin = true può LEGGERE le sessioni sport
-- di TUTTI i professionisti dalla dashboard web. Nessun permesso di scrittura.
-- Richiede che 010_superadmin_read.sql sia già stata applicata (definisce
-- la funzione public.is_superadmin()). Eseguire su Supabase SQL Editor.
-- =============================================

-- Policy SELECT additive (permissive): per i non-superadmin is_superadmin() = false
-- → policy inerte, restano valide le policy esistenti (auth.uid() = professional_id).
-- NB: solo SELECT → accesso read-only.

DROP POLICY IF EXISTS "sport_sessions_superadmin_read" ON sport_sessions;
CREATE POLICY "sport_sessions_superadmin_read" ON sport_sessions
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "dfa_windows_superadmin_read" ON dfa_windows;
CREATE POLICY "dfa_windows_superadmin_read" ON dfa_windows
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "training_load_superadmin_read" ON training_load_daily;
CREATE POLICY "training_load_superadmin_read" ON training_load_daily
  FOR SELECT USING (public.is_superadmin());
