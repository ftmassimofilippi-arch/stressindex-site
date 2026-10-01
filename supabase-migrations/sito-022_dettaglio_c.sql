-- =============================================================================
-- sito-022, dettaglio del blocco C — schede duplicate, coppia per coppia
-- =============================================================================
-- Da lanciare SUBITO DOPO la 022 (anteprima o applicazione). Non modifica
-- niente: sono due SELECT. Sta in un file a parte perché il SQL Editor mostra
-- solo l'ultimo select di uno script, e nella 022 l'ultimo è il riepilogo.
--
-- Una riga per coppia di schede: quale TIENE, quale ARCHIVIA, con il numero di
-- sessioni, la data di creazione, se hanno il ponte client_user_id, e il
-- motivo della scelta in italiano.
--
--   esito = 'automatica' → stessa persona (un solo nome distinto): la 022 la
--                          unisce quando si applica il blocco C.
--   esito = 'a_mano'     → stessa email ma nomi diversi: nessuna unione
--                          automatica. tiene/archivia è solo l'ordine
--                          proposto, la scelta si fa col pulsante Unisci nel
--                          pannello Collegamenti.
--
-- Le righe sono scritte PRIMA di qualunque unione, quindi in anteprima questo
-- è esattamente l'elenco di ciò che succederebbe.

-- ── 1. Le coppie dell'ultima esecuzione ──────────────────────────────────────
select esito,
       email,
       professionista,
       tiene_nome,
       tiene_id,
       tiene_sessioni,
       tiene_creata::date    as tiene_dal,
       tiene_ponte,
       archivia_nome,
       archivia_id,
       archivia_sessioni,
       archivia_creata::date as archivia_dal,
       archivia_ponte,
       motivo
  from public.collegamenti_riparazione_c_dettaglio
 where run_id = (select run_id from public.collegamenti_riparazione_log order by id desc limit 1)
 order by esito, professionista, email, archivia_id;

-- ── 2. Solo le unioni DA DECIDERE A MANO ─────────────────────────────────────
-- Scommentare e rilanciare per vedere soltanto queste (il SQL Editor mostra
-- l'ultimo select, quindi una query alla volta).
-- select email, professionista,
--        tiene_nome, tiene_id, tiene_sessioni, tiene_creata::date as tiene_dal,
--        archivia_nome, archivia_id, archivia_sessioni, archivia_creata::date as archivia_dal,
--        motivo
--   from public.collegamenti_riparazione_c_dettaglio
--  where run_id = (select run_id from public.collegamenti_riparazione_log order by id desc limit 1)
--    and esito = 'a_mano'
--  order by professionista, email, archivia_id;
