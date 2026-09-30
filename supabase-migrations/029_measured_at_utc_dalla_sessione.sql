-- =============================================================================
-- 029 — measurement_analytics.measured_at_utc allineata a sessions.started_at_utc
-- =============================================================================
--
-- DA APPLICARE A MANO nel SQL Editor di Supabase. Idempotente: rieseguirla non
-- cambia nulla. Nessuna colonna viene aggiunta o rimossa.
--
-- IL PROBLEMA
--
-- `sessions` ha due colonne tenute dal trigger `set_started_at_compat`:
--   started_at      forma legacy (orologio da parete italiano etichettato UTC)
--                   su TUTTE le righe: il trigger la riscrive apposta perché le
--                   build vecchie dell'app continuino a leggerla;
--   started_at_utc  istante reale, su TUTTE le righe. Corretta ovunque.
--
-- `measurement_analytics` viene riempita dal trigger di sincronizzazione della
-- 007, che copia `COALESCE(NEW.started_at, NEW.created_at)` in `measured_at`.
-- Poiché `started_at` è ormai SEMPRE la forma legacy, `measured_at` eredita la
-- forma legacy, ma la riga porta anche `tz_offset_minutes`. Il trigger
-- `set_measured_at_utc` chiama `hrv_istante_reale(measured_at,
-- tz_offset_minutes)`, che con l'offset valorizzato conclude "è già UTC" e
-- lascia il valore com'è: `measured_at_utc` resta due ore avanti.
--
-- Stato rilevato in produzione il 30 settembre 2026 (3736 righe in tutto):
--   2595  tz_offset_minutes NULL, measured_at_utc corretta;
--    156  scritte direttamente dall'app, measured_at_utc corretta;
--    986  passate dalla sincronizzazione, measured_at_utc avanti di 120 minuti.
-- Su quelle 986 la misurazione risulta avvenuta DOPO il proprio `created_at`,
-- cosa impossibile: è la prova che il valore è sbagliato.
--
-- LA RIPARAZIONE
--
-- `sessions.started_at_utc` è la fonte di verità: `measured_at_utc` si riallinea
-- a quella, e il trigger di `measurement_analytics` viene riscritto perché le
-- righe nuove nascano già giuste.
--
-- Il sito non dipende da questa migration per mostrare l'ora corretta (prende
-- l'istante dalla sessione, vedi `conIstanteSessione` in src/lib/measured-time.ts),
-- ma ORDINAMENTI e FILTRI PER PERIODO su `measurement_analytics` avvengono
-- dentro Postgres e restano approssimati finché non viene applicata.

BEGIN;

-- ── 1. Backup delle righe che stiamo per toccare ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.measurement_analytics_utc_backup_20260930 (
  id uuid PRIMARY KEY,
  session_id text,
  measured_at timestamptz,
  measured_at_utc timestamptz,
  tz_offset_minutes smallint,
  salvato_il timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.measurement_analytics_utc_backup_20260930
  (id, session_id, measured_at, measured_at_utc, tz_offset_minutes)
SELECT a.id, a.session_id, a.measured_at, a.measured_at_utc, a.tz_offset_minutes
FROM public.measurement_analytics a
JOIN public.sessions s ON s.id = a.session_id
WHERE s.started_at_utc IS NOT NULL
  AND a.measured_at_utc IS DISTINCT FROM s.started_at_utc
ON CONFLICT (id) DO NOTHING;

-- ── 2. Trigger corretto per le righe future ──────────────────────────────────
--
-- La sessione, quando c'è, decide. `hrv_istante_reale` resta come ripiego per
-- le righe senza sessione (non dovrebbero esistere, ma la colonna è nullable).
CREATE OR REPLACE FUNCTION public.set_measured_at_utc()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_sessione timestamptz;
BEGIN
  SELECT s.started_at_utc INTO v_sessione
  FROM public.sessions s
  WHERE s.id = NEW.session_id;

  NEW.measured_at_utc := COALESCE(
    v_sessione,
    public.hrv_istante_reale(NEW.measured_at, NEW.tz_offset_minutes)
  );
  RETURN NEW;
END
$function$;

-- ── 3. Riallineamento dello storico ──────────────────────────────────────────
UPDATE public.measurement_analytics a
SET measured_at_utc = s.started_at_utc
FROM public.sessions s
WHERE s.id = a.session_id
  AND s.started_at_utc IS NOT NULL
  AND a.measured_at_utc IS DISTINCT FROM s.started_at_utc;

COMMIT;

-- ── Verifica ─────────────────────────────────────────────────────────────────
-- Attese: zero righe disallineate e zero misurazioni successive al proprio
-- created_at.
--
--   SELECT count(*) AS disallineate
--   FROM measurement_analytics a
--   JOIN sessions s ON s.id = a.session_id
--   WHERE a.measured_at_utc IS DISTINCT FROM s.started_at_utc;
--
--   SELECT count(*) AS nel_futuro
--   FROM measurement_analytics
--   WHERE measured_at_utc > created_at + interval '1 minute';
--
-- Per tornare indietro:
--
--   UPDATE measurement_analytics a
--   SET measured_at_utc = b.measured_at_utc
--   FROM measurement_analytics_utc_backup_20260930 b
--   WHERE b.id = a.id;
