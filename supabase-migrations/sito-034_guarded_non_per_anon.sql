-- =============================================================================
-- sito-034 — link_client_to_professional_guarded: EXECUTE tolto ad anon
-- =============================================================================
-- ⚠️ DA APPLICARE A MANO nel SQL Editor. Idempotente. Non tocca dati né il
-- corpo della funzione: cambia solo chi può eseguirla.
--
-- IL PROBLEMA (hrv_app/docs/audit/2026-10-04.md §3.2, debiti tecnici dell'app).
-- La guarded è la porta dell'app verso `link_client_to_professional`. È nata
-- nella `sito-019` con `grant execute … to authenticated, service_role`, ma
-- una funzione nuova in `public` riceve EXECUTE anche da PUBLIC e, per i
-- privilegi di default di Supabase, da `anon`: nessuno dei due era stato
-- revocato. Catalogo di produzione il 04/10/2026:
--
--   {=X/postgres, postgres=X/postgres, anon=X/postgres,
--    authenticated=X/postgres, service_role=X/postgres}
--
-- Il suo controllo (`auth.uid() is not null and …`) lascia passare proprio chi
-- non ha un uid, cioè anon. Dal 04/10 lo ferma la regola dentro
-- `link_client_to_professional` (`app-039`, `collegamento_chiamante_ammesso`):
-- oggi una chiamata anonima torna `ok:false, 42501`. Resta però una funzione
-- SECURITY DEFINER raggiungibile con la sola anon key, che è pubblica: la
-- difesa sta in un punto solo, e un domani basta ritoccare quel punto per
-- riaprire la porta. Qui la si chiude anche all'ingresso.
--
-- CHI LA USA (verificato il 04/10/2026).
--   · app: `ProfessionalLinkService._linkRpc`, sempre dopo il login
--     (ruolo `authenticated`). Nessuna build la chiama prima dell'accesso.
--   · sito: nessuna chiamata. `src/` usa `link_client_to_professional` e
--     `request_client_link` con la service role; la guarded compare solo nei
--     documenti e nella `sito-019`.
--   · Edge Function: nessuna.
--
-- COSA CAMBIA. EXECUTE tolto a PUBLIC e ad anon; resta ad authenticated (con
-- il controllo dentro) e a service_role. Stessa forma della `app-039` per le
-- altre due funzioni dei collegamenti.
--
-- Collaudo: scripts/sql-test/test_sito-034.sql
-- Dopo l'applicazione: `tool/e2e/run.sh` nel repo dell'app (tocca le RPC dei
-- collegamenti, regola 3 di `docs/regole-progetto.md`).
-- =============================================================================

begin;

revoke all on function public.link_client_to_professional_guarded(uuid, uuid, text) from public;
revoke all on function public.link_client_to_professional_guarded(uuid, uuid, text) from anon;
grant execute on function public.link_client_to_professional_guarded(uuid, uuid, text)
  to authenticated, service_role;

-- Verifica: se non è andata come deve, la transazione si annulla.
do $$
declare
  f constant regprocedure := 'public.link_client_to_professional_guarded(uuid,uuid,text)'::regprocedure;
begin
  if has_function_privilege('anon', f, 'execute') then
    raise exception 'sito-034: anon esegue ancora la guarded';
  end if;
  if not has_function_privilege('authenticated', f, 'execute') then
    raise exception 'sito-034: authenticated non esegue più la guarded (l''app si romperebbe)';
  end if;
  if not has_function_privilege('service_role', f, 'execute') then
    raise exception 'sito-034: service_role non esegue più la guarded';
  end if;
end $$;

commit;
