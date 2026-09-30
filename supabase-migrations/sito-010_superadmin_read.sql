-- =============================================
-- STRESS INDEX — Vista superadmin (sola lettura)
-- Un utente con profiles.is_superadmin = true può LEGGERE i dati di TUTTI
-- i professionisti dalla dashboard web. Nessun permesso di scrittura.
-- Eseguire su Supabase SQL Editor.
-- =============================================

-- 1. Flag superadmin sul profilo (idempotente)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_superadmin boolean NOT NULL DEFAULT false;

-- 2. Helper SECURITY DEFINER: verifica se l'utente corrente è superadmin.
--    SECURITY DEFINER esegue la funzione con i privilegi del proprietario,
--    bypassando l'RLS su profiles → evita la ricorsione infinita quando la
--    funzione è usata dentro una policy che protegge la stessa tabella profiles.
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_superadmin FROM profiles p WHERE p.id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- 3. Policy SELECT additive (permissive): il superadmin legge tutto.
--    Per i non-superadmin is_superadmin() = false → policy inerte, restano
--    valide le policy esistenti (self-read, org owner, ecc.).
--    NB: solo SELECT. Nessuna policy INSERT/UPDATE/DELETE → accesso read-only.

DROP POLICY IF EXISTS "clients_superadmin_read" ON clients;
CREATE POLICY "clients_superadmin_read" ON clients
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "sessions_superadmin_read" ON sessions;
CREATE POLICY "sessions_superadmin_read" ON sessions
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "analytics_superadmin_read" ON measurement_analytics;
CREATE POLICY "analytics_superadmin_read" ON measurement_analytics
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "notes_superadmin_read" ON client_notes;
CREATE POLICY "notes_superadmin_read" ON client_notes
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "settings_superadmin_read" ON client_settings;
CREATE POLICY "settings_superadmin_read" ON client_settings
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "alerts_superadmin_read" ON alerts;
CREATE POLICY "alerts_superadmin_read" ON alerts
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "messages_superadmin_read" ON messages;
CREATE POLICY "messages_superadmin_read" ON messages
  FOR SELECT USING (public.is_superadmin());

-- profiles / professional_profiles: servono per elencare i professionisti
-- e risolverne i nomi nella vista superadmin.
DROP POLICY IF EXISTS "profiles_superadmin_read" ON profiles;
CREATE POLICY "profiles_superadmin_read" ON profiles
  FOR SELECT USING (public.is_superadmin());

DROP POLICY IF EXISTS "prof_profiles_superadmin_read" ON professional_profiles;
CREATE POLICY "prof_profiles_superadmin_read" ON professional_profiles
  FOR SELECT USING (public.is_superadmin());

-- 4. Promuovere un utente a superadmin (eseguire manualmente, sostituire l'email):
--   UPDATE profiles SET is_superadmin = true WHERE email = 'admin@esempio.it';
