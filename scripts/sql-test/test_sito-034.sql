-- Collaudo di sito-034_guarded_non_per_anon.sql.
-- Autoverificante: si ferma alla prima aspettativa non rispettata.
--
-- Postgres locale di collaudo (lo stesso dell'app, `hrv_app/tool/sql_test/README.md`),
-- su un database a parte per non toccare quello dei collaudi dell'app:
--
--   export PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH PGHOST=127.0.0.1 PGPORT=5499 PGUSER=postgres
--   dropdb --if-exists sito_034; createdb sito_034
--   psql -d sito_034 -v ON_ERROR_STOP=1 -q -f scripts/sql-test/test_sito-034.sql
--
-- Ricostruisce il contorno di produzione del 04/10/2026 (la guarded verbatim,
-- con l'ACL che ha oggi: PUBLIC, anon, authenticated, service_role) e verifica
-- chi passa e chi no, prima e dopo.
\set ON_ERROR_STOP 1

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='t_sito034_qualunque') THEN CREATE ROLE t_sito034_qualunque NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role, t_sito034_qualunque;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Stub della funzione interna: dice solo di essere stata raggiunta. Come in
-- produzione dopo la app-039, anon non la esegue direttamente.
CREATE OR REPLACE FUNCTION public.link_client_to_professional(p_client_user_id uuid, p_professional_id uuid, p_source text DEFAULT 'app')
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  select jsonb_build_object('ok', true, 'raggiunta', true) $$;
REVOKE ALL ON FUNCTION public.link_client_to_professional(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_client_to_professional(uuid, uuid, text) TO authenticated, service_role;

-- La guarded, verbatim dalla produzione del 04/10/2026, con l'ACL di oggi.
CREATE OR REPLACE FUNCTION public.link_client_to_professional_guarded(p_client_user_id uuid, p_professional_id uuid, p_source text DEFAULT 'app'::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if auth.uid() is not null and auth.uid() not in (p_client_user_id, p_professional_id) then
    return jsonb_build_object('ok', false, 'error', 'non autorizzato', 'sqlstate', '42501');
  end if;
  return public.link_client_to_professional(p_client_user_id, p_professional_id, p_source);
end;
$function$;
GRANT EXECUTE ON FUNCTION public.link_client_to_professional_guarded(uuid, uuid, text) TO PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.t_come(p_sub text) RETURNS void LANGUAGE sql AS $$
  select set_config('request.jwt.claim.sub', coalesce(p_sub, ''), false) $$;
GRANT EXECUTE ON FUNCTION public.t_come(text) TO PUBLIC;

-- ── 0. PRIMA: il difetto c'è ────────────────────────────────────────────────
SELECT public.t_come(NULL);
SET ROLE anon;
DO $$
DECLARE v jsonb;
BEGIN
  v := public.link_client_to_professional_guarded('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 't');
  IF NOT (v ->> 'raggiunta')::boolean THEN RAISE EXCEPTION '0: il contorno non riproduce il difetto: %', v; END IF;
END $$;
RESET ROLE;

-- ── migrazione, due volte (idempotenza) ─────────────────────────────────────
\i supabase-migrations/sito-034_guarded_non_per_anon.sql
\i supabase-migrations/sito-034_guarded_non_per_anon.sql

-- ── 1. privilegi ────────────────────────────────────────────────────────────
DO $$
DECLARE f constant regprocedure := 'public.link_client_to_professional_guarded(uuid,uuid,text)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', f, 'EXECUTE') THEN RAISE EXCEPTION '1: anon esegue'; END IF;
  IF has_function_privilege('t_sito034_qualunque', f, 'EXECUTE') THEN RAISE EXCEPTION '1: PUBLIC esegue'; END IF;
  IF NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN RAISE EXCEPTION '1: authenticated non esegue'; END IF;
  IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN RAISE EXCEPTION '1: service_role non esegue'; END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'link_client_to_professional_guarded') <> 1 THEN
    RAISE EXCEPTION '1: più di una copia della funzione';
  END IF;
END $$;

-- ── 2. anon: rifiutato alla porta ───────────────────────────────────────────
SET ROLE anon;
DO $$
BEGIN
  PERFORM public.link_client_to_professional_guarded('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 't');
  RAISE EXCEPTION '2: anon ha eseguito la guarded';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- ── 3. authenticated: le due parti passano, l'estraneo no (come prima) ──────
SET ROLE authenticated;
SELECT public.t_come('aaaaaaaa-0000-0000-0000-000000000001');
DO $$
DECLARE v jsonb;
BEGIN
  v := public.link_client_to_professional_guarded('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 't');
  IF NOT coalesce((v ->> 'raggiunta')::boolean, false) THEN RAISE EXCEPTION '3: il cliente non passa: %', v; END IF;
END $$;
SELECT public.t_come('aaaaaaaa-0000-0000-0000-000000000002');
DO $$
DECLARE v jsonb;
BEGIN
  v := public.link_client_to_professional_guarded('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 't');
  IF NOT coalesce((v ->> 'raggiunta')::boolean, false) THEN RAISE EXCEPTION '3: il professionista non passa: %', v; END IF;
END $$;
SELECT public.t_come('aaaaaaaa-0000-0000-0000-000000000003');
DO $$
DECLARE v jsonb;
BEGIN
  v := public.link_client_to_professional_guarded('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 't');
  IF v ->> 'sqlstate' IS DISTINCT FROM '42501' OR (v ->> 'ok')::boolean THEN RAISE EXCEPTION '3: l''estraneo passa: %', v; END IF;
END $$;
RESET ROLE;

-- ── 4. service_role (nessun uid): passa ─────────────────────────────────────
SELECT public.t_come(NULL);
SET ROLE service_role;
DO $$
DECLARE v jsonb;
BEGIN
  v := public.link_client_to_professional_guarded('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 't');
  IF NOT coalesce((v ->> 'raggiunta')::boolean, false) THEN RAISE EXCEPTION '4: la service_role non passa: %', v; END IF;
END $$;
RESET ROLE;

\echo 'test_sito-034: OK'
