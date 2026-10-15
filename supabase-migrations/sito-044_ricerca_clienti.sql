-- =============================================================================
-- sito-044: ricerca clienti senza accenti e in qualsiasi ordine di parole
-- =============================================================================
-- Audit QA 14/10/2026, punti F1 ed E1. Solo aggiunte (estensione, funzione,
-- colonna generata, indice): applicata da Claude il 15/10/2026.
--
-- "Sabbatini Doretta" non trovava "Doretta Sabbatini", "nicolo" non trovava
-- "Nicolò Sposini". La regola: testo normalizzato (minuscolo, senza accenti) e
-- ogni parola della ricerca deve comparire in nome, cognome o email.
--
-- Cosa fa
--   1. Estensione `unaccent` (schema `extensions`).
--   2. `public.testo_ricerca(text)`: lower + unaccent, IMMUTABLE (serve
--      all'indice; `unaccent` con il dizionario esplicito è stabile).
--   3. `clients.ricerca` colonna generata = testo_ricerca(nome || cognome || email).
--   4. Indice trigram se `pg_trgm` c'è già, altrimenti btree semplice: la
--      tabella ha ~800 righe, basta il filtro.
--   Il sito filtra con `.ilike('ricerca', '%parola%')` una volta per parola.
--
-- Come si annulla
--   alter table clients drop column if exists ricerca;
--   drop function if exists public.testo_ricerca(text);
-- Idempotente.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

create or replace function public.testo_ricerca(p text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions, pg_temp
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')))
$$;

grant execute on function public.testo_ricerca(text) to authenticated, service_role;
revoke execute on function public.testo_ricerca(text) from public, anon;

alter table public.clients
  add column if not exists ricerca text
  generated always as (public.testo_ricerca(coalesce(nome, '') || ' ' || coalesce(cognome, '') || ' ' || coalesce(email, ''))) stored;

create index if not exists clients_prof_ricerca_idx on public.clients (professionista_id, ricerca);

-- Verifica:
--   select nome, cognome from clients where ricerca like '%nicolo%' and ricerca like '%sposini%';
--   select nome, cognome from clients where ricerca like '%sabbatini%' and ricerca like '%doretta%';
