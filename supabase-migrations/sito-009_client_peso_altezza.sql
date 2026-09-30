-- 009_client_peso_altezza.sql
-- Aggiunge le colonne peso/altezza alla tabella clients.
--
-- Contesto: il form "Impostazioni cliente" della dashboard web e la sync
-- dell'app Flutter (_clientToRow) scrivono già `peso` e `altezza`, ma le colonne
-- non esistevano su Supabase. Risultato: errore PostgREST
--   "could not find the 'altezza' column of 'clients' in the schema cache".
--
-- Idempotente: rieseguibile senza effetti collaterali.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS peso    DOUBLE PRECISION;  -- kg
ALTER TABLE clients ADD COLUMN IF NOT EXISTS altezza DOUBLE PRECISION;  -- cm

-- Nota: dopo l'ALTER, PostgREST ricarica lo schema in cache automaticamente.
-- Se la cache non si aggiorna subito, forzare il reload con:
--   NOTIFY pgrst, 'reload schema';
