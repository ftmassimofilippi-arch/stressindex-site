-- =============================================
-- STRESS INDEX — Migrazione per registrazione trial
-- Eseguire su Supabase SQL Editor
-- =============================================

-- 1. Aggiungere colonna professione a professional_profiles
ALTER TABLE professional_profiles 
ADD COLUMN IF NOT EXISTS professione TEXT;

-- 2. Aggiungere colonna trial_expires_at a professional_profiles
ALTER TABLE professional_profiles 
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- 3. Aggiornare la policy di INSERT su profiles per permettere 
--    l'inserimento durante la registrazione (upsert)
-- (Le policy esistenti usano auth.uid() = id, quindi funzionano già)

-- 4. Aggiornare la policy di INSERT su professional_profiles
-- Le policy esistenti usano auth.uid() = id, quindi funzionano già
-- Ma verifichiamo che esista una policy di UPSERT
DO $$
BEGIN
  -- Verifica se esiste già una policy di insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'professional_profiles' 
    AND policyname = 'professional_profiles_insert'
  ) THEN
    EXECUTE 'CREATE POLICY "professional_profiles_insert" ON professional_profiles FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

-- 5. Abilitare Realtime se necessario (opzionale)
-- ALTER PUBLICATION supabase_realtime ADD TABLE professional_profiles;

-- Verifica: controlla che le colonne siano state aggiunte
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'professional_profiles' 
AND column_name IN ('professione', 'trial_expires_at')
ORDER BY column_name;
