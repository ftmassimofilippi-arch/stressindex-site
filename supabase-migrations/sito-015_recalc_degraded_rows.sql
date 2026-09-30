-- =============================================================================
-- STRESS INDEX — Script 015 (RICALCOLO righe degradate)
-- =============================================================================
-- ⚠️  NON eseguire automaticamente / NON con `supabase db push`.
-- ⚠️  Eseguire MANUALMENTE nel SQL editor, SOLO DOPO:
--       (a) aver applicato 014 (trigger demografico ripristinato);
--       (b) aver verificato che il trigger gira bene su una misura NUOVA reale;
--       (c) aver fatto un BACKUP del DB.
--
-- COSA FA: ricalcola gli score delle righe degradate facendole ripassare dal
-- trigger demografico 014. Tecnica: azzera i 6 score + azzera algorithm_version
-- cosi l'EARLY RETURN del trigger NON scatta e il ramo fallback ricomputa tutto;
-- il trigger rimarca poi le righe come '1.2.0-sql-fallback'.
--
-- TARGET (come concordato): 1.2.0-sql-backfill, 1.2.0-sql-fallback, 1.1.0,
--                           1.2.0-sql-error.
-- NON tocca: 1.2.0-flutter (verita app) né 1.2.0-sql (non in lista — vedi nota).
--
-- Conteggi attesi al 2026-06-20:
--   1.2.0-sql-backfill  573
--   1.1.0               149
--   1.2.0-sql-fallback   61
--   1.2.0-sql-error       0
--   --------------------------
--   TOTALE              ~783 righe
-- =============================================================================


-- =============================================================================
-- STEP 0 — BACKUP snapshot (in aggiunta, non in sostituzione, del backup DB)
-- =============================================================================
-- Crea una copia integrale della tabella prima di toccare i dati.
-- (Rinominare la data se rieseguito in un giorno diverso.)
CREATE TABLE IF NOT EXISTS measurement_analytics_backup_20260620 AS
  SELECT * FROM measurement_analytics;

-- Verifica che lo snapshot abbia le righe attese prima di proseguire:
SELECT count(*) AS righe_nel_backup FROM measurement_analytics_backup_20260620;


-- =============================================================================
-- STEP 1 — PREVIEW (read-only): cosa verrà ricalcolato
-- =============================================================================
SELECT algorithm_version,
       count(*) AS righe,
       count(*) FILTER (WHERE age IS NOT NULL AND sex IS NOT NULL) AS diventano_demo,
       count(*) FILTER (WHERE age IS NULL OR sex IS NULL)          AS restano_no_demo
FROM measurement_analytics
WHERE algorithm_version IN
      ('1.2.0-sql-backfill','1.2.0-sql-fallback','1.1.0','1.2.0-sql-error')
GROUP BY algorithm_version
ORDER BY righe DESC;


-- =============================================================================
-- STEP 2 — RICALCOLO (transazione esplicita: ispeziona prima di COMMIT)
-- =============================================================================
-- Eseguire il blocco BEGIN..UPDATE, controllare il numero di righe toccate,
-- poi COMMIT (o ROLLBACK per annullare).
BEGIN;

UPDATE measurement_analytics
SET score_stress                    = NULL,
    score_recupero                  = NULL,
    score_equilibrio                = NULL,
    score_energia                   = NULL,
    score_modulazione_infiammatoria = NULL,
    score_composito                 = NULL,
    algorithm_version               = NULL   -- il trigger rimarca '1.2.0-sql-fallback'
WHERE algorithm_version IN
      ('1.2.0-sql-backfill','1.2.0-sql-fallback','1.1.0','1.2.0-sql-error');

-- Controllo dentro la stessa transazione PRIMA di committare:
--   nessuno score deve essere rimasto NULL e nessuna riga deve essere finita
--   in errore ('1.2.0-sql-error').
SELECT
  count(*) FILTER (WHERE algorithm_version = '1.2.0-sql-error')                          AS in_errore_DEVE_ESSERE_0,
  count(*) FILTER (WHERE score_composito IS NULL AND algorithm_version <> '1.2.0-sql-error') AS score_nulli_DEVE_ESSERE_0
FROM measurement_analytics
WHERE algorithm_version IN ('1.2.0-sql-fallback','1.2.0-sql-error');

-- Se i due valori sopra sono 0 -> COMMIT; altrimenti -> ROLLBACK.
COMMIT;
-- ROLLBACK;


-- =============================================================================
-- STEP 3 — VERIFICA post-commit (read-only)
-- =============================================================================
SELECT algorithm_version, count(*) AS righe
FROM measurement_analytics
GROUP BY algorithm_version
ORDER BY righe DESC;

-- Sanity: distribuzione score plausibile sulle righe ricalcolate
SELECT
  round(avg(score_stress)::numeric,2)    AS avg_stress,
  round(avg(score_recupero)::numeric,2)  AS avg_recupero,
  round(avg(score_energia)::numeric,2)   AS avg_energia,
  round(avg(score_composito)::numeric,2) AS avg_composito,
  count(*) AS n
FROM measurement_analytics
WHERE algorithm_version = '1.2.0-sql-fallback';


-- =============================================================================
-- NOTE
-- =============================================================================
-- • '1.2.0-sql' (34 righe) NON è in lista: furono calcolate dal vecchio trigger
--   demografico (migration 005) con i bug B/C ancora presenti. Se vuoi
--   ricalcolarle anche loro con B/C corretti, aggiungi '1.2.0-sql' alla WHERE
--   degli STEP 1/2. Lasciate fuori per ora come da accordo.
-- • Rollback completo possibile da measurement_analytics_backup_20260620:
--     UPDATE measurement_analytics m
--     SET score_stress=b.score_stress, score_recupero=b.score_recupero,
--         score_equilibrio=b.score_equilibrio, score_energia=b.score_energia,
--         score_modulazione_infiammatoria=b.score_modulazione_infiammatoria,
--         score_composito=b.score_composito, algorithm_version=b.algorithm_version
--     FROM measurement_analytics_backup_20260620 b
--     WHERE m.id=b.id;
--   (questo riscrive gli score originali; il trigger BEFORE UPDATE non li tocca
--    perché tutti e 6 tornano non-null -> early return.)
-- • Una volta verificato tutto, lo snapshot si può rimuovere:
--     DROP TABLE measurement_analytics_backup_20260620;
-- =============================================================================
