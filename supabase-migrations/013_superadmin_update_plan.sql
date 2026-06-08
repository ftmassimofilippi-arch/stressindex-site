-- =============================================
-- STRESS INDEX — Superadmin: gestione piano Pro
-- Permette a un utente con profiles.is_superadmin = true di MODIFICARE
-- il campo profiles.plan ('base' | 'pro') di QUALSIASI professionista
-- dalla dashboard web. Dipende dalla migration 010 (flag + is_superadmin()).
-- Eseguire su Supabase SQL Editor.
-- =============================================

-- 1. Colonna plan sul profilo (idempotente). 'base' = default, 'pro' = Modulo Sport.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'base';

-- 2. Policy UPDATE additiva (permissive): il superadmin può aggiornare i profili.
--    USING filtra le righe aggiornabili; WITH CHECK valida la riga risultante.
--    Per i non-superadmin is_superadmin() = false → policy inerte, restano valide
--    le policy esistenti (self-update, ecc.).
DROP POLICY IF EXISTS "superadmin_update_profiles" ON profiles;
CREATE POLICY "superadmin_update_profiles"
  ON profiles FOR UPDATE
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
