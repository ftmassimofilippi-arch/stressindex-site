-- =============================================
-- STRESS INDEX — Tabella live del Modulo Sport (Team Live)
-- I telefoni degli atleti scrivono qui l'ultimo stato della sessione in corso
-- (un record per atleta/sessione, aggiornato ~ogni 5 secondi). La dashboard web
-- /area-professionisti/sport/team-live la legge in tempo reale via Supabase
-- Realtime (WebSocket) con fallback polling.
--
-- Convenzioni coerenti col resto del Modulo Sport:
--   • professional_id = auth.uid() del professionista (uuid)
--   • athlete_id      = clients.id (TEXT, non uuid)
--   • RLS: il professionista vede/gestisce solo le proprie righe; il superadmin
--     (migration 010/011, funzione public.is_superadmin()) legge tutto in sola
--     lettura.
-- Eseguire su Supabase SQL Editor.
-- =============================================

CREATE TABLE IF NOT EXISTS public.sport_live_data (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL,
  athlete_id      text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  session_id      uuid,                 -- collega alla sport_sessions quando la sessione è terminata
  sport           text,
  is_connected    boolean NOT NULL DEFAULT true,
  elapsed_s       integer,              -- durata sessione in secondi (timer)
  hr              integer,              -- HR attuale (bpm)
  hr_max          integer,             -- HR max della sessione corrente
  zone            integer,             -- zona DFA: 1=aerobica 2=transizione 3=anaerobica 4=massimale
  dfa_alpha1      numeric,             -- DFA Alpha1 attuale
  rmssd           numeric,             -- RMSSD rolling
  trimp           numeric,             -- TRIMP accumulato
  artifact_rate   numeric,             -- frazione 0..1 (mostrata come %)
  tags            jsonb DEFAULT '[]'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- una sola riga "live" per atleta: l'app fa upsert su questa chiave
  CONSTRAINT sport_live_data_athlete_unique UNIQUE (professional_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS sport_live_data_professional_idx
  ON public.sport_live_data (professional_id, updated_at DESC);

-- Realtime invia il record OLD completo (necessario per UPDATE/DELETE col filtro).
ALTER TABLE public.sport_live_data REPLICA IDENTITY FULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.sport_live_data ENABLE ROW LEVEL SECURITY;

-- Il professionista gestisce (lettura+scrittura) solo le proprie righe.
DROP POLICY IF EXISTS "sport_live_data_owner_all" ON public.sport_live_data;
CREATE POLICY "sport_live_data_owner_all" ON public.sport_live_data
  FOR ALL
  USING (auth.uid() = professional_id)
  WITH CHECK (auth.uid() = professional_id);

-- Vista superadmin in sola lettura (additiva, inerte per i non-superadmin).
DROP POLICY IF EXISTS "sport_live_data_superadmin_read" ON public.sport_live_data;
CREATE POLICY "sport_live_data_superadmin_read" ON public.sport_live_data
  FOR SELECT USING (public.is_superadmin());

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Abilita la pubblicazione realtime sulla tabella (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sport_live_data'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sport_live_data;
  END IF;
END $$;
