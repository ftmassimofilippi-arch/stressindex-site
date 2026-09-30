-- =============================================================================
-- STRESS INDEX — 024b: stato di partenza esplicito e Sonno nel piano Pro
-- =============================================================================
--
-- Da eseguire SUBITO DOPO la 024. Serve a una cosa sola: che il giorno
-- dell'applicazione nessuno si accorga di niente.
--
-- BLOCCO A — stato 'attivo' scritto a mano per tutti gli utenti esistenti.
--   Non cambia niente dal punto di vista funzionale: account_stato_effettivo()
--   e account_puo_scrivere() considerano attivo anche chi non ha riga, e senza
--   la 024b nessuno risulta sospeso o bloccato (verificato: su 144
--   professionisti la 024 produce 144 stati 'attivo'). Si scrive perché lo
--   stato sia esplicito e visibile nel pannello invece di essere un'assenza.
--   `on conflict do nothing`: chi ha già uno stato deciso da un superadmin o
--   dal cron delle scadenze NON viene toccato.
--
-- BLOCCO B — il Sonno entra nel piano Pro (e nella prova).
--   Nessun piano includeva 'sleep' e la semina della 024 crea eccezioni solo
--   per i moduli con righe già presenti in monitoring_sessions: di notti
--   registrate non ce n'è ancora nessuna, quindi la 024 da sola avrebbe spento
--   il Sonno per tutti. Nessuno bloccato nello scrivere (le policy RESTRICTIVE
--   guardano lo stato, non i moduli), ma sul sito le registrazioni del sonno
--   sarebbero sparite da elenchi, scheda cliente e analytics, e la pagina di
--   una notte avrebbe risposto 404.
--
--   Decisione (2026-09-27): il Sonno è compreso nel piano Pro e nella prova,
--   come Sport e Monitoraggio. Due righe in piano_moduli, niente eccezioni di
--   massa: vale per chi c'è e per chi si iscriverà. Il piano Base resta senza
--   moduli. Dopo questo blocco commerciale_sync_plan continua a funzionare
--   com'era: profiles.plan = 'pro' quando il piano include lo sport, e da oggi
--   lo sport e il Sonno viaggiano insieme, quindi `profiles.plan = 'pro'` è
--   anche la risposta corretta alla domanda «vede il Sonno?» — è ciò che
--   l'app Flutter usa in UserRoleService.canAccessSleep.
--
-- BLOCCO C — una riga di audit che dice che il catalogo è cambiato e perché.
--
-- Idempotente: rieseguirla non duplica righe. Ogni blocco è protetto da
-- EXCEPTION WHEN OTHERS, quindi un blocco che fallisce non annulla gli altri.
-- =============================================================================

-- ── BLOCCO A — stato esplicito 'attivo' ─────────────────────────────────────
do $$
declare
  v_righe integer;
begin
  insert into public.account_stato (user_id, stato, motivo, cambiato_da_email)
  select p.id, 'attivo', 'Stato iniziale scritto dalla migrazione 024b', 'migration:024b'
    from public.profiles p
    join auth.users u on u.id = p.id
  on conflict (user_id) do nothing;
  get diagnostics v_righe = row_count;
  raise notice '024b.A stati iniziali scritti: %', v_righe;
exception when others then
  raise notice '024b.A stato iniziale non scritto: %', sqlerrm;
end $$;

-- ── BLOCCO B — Sonno nel piano Pro e nella prova ────────────────────────────
do $$
declare
  v_righe integer;
begin
  insert into public.piano_moduli (piano, modulo)
  values ('pro', 'sleep'), ('prova', 'sleep')
  on conflict (piano, modulo) do nothing;
  get diagnostics v_righe = row_count;
  raise notice '024b.B Sonno aggiunto ai piani (righe nuove): %', v_righe;
exception when others then
  raise notice '024b.B Sonno NON aggiunto ai piani: %', sqlerrm;
end $$;

-- ── BLOCCO C — traccia della decisione ──────────────────────────────────────
do $$
declare
  v_righe integer;
begin
  insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
  select null, 'migration:024b', 'plan_modules_change', 'sistema', 'piano_moduli',
         jsonb_build_object(
           'aggiunti', jsonb_build_array(
             jsonb_build_object('piano', 'pro',   'modulo', 'sleep'),
             jsonb_build_object('piano', 'prova', 'modulo', 'sleep')),
           'motivo', 'Il Sonno era disponibile a tutti prima della 024 e nessun piano lo includeva: entra nel piano Pro e nella prova.')
   where not exists (
     select 1 from public.admin_audit_log l
      where l.performed_by_email = 'migration:024b' and l.action = 'plan_modules_change'
   );
  get diagnostics v_righe = row_count;
  raise notice '024b.C righe di audit scritte: %', v_righe;
exception when others then
  raise notice '024b.C audit non scritto (il catalogo resta aggiornato): %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- ── Verifica: da leggere dopo l'esecuzione ───────────────────────────────────
-- Attesi oggi (144 professionisti, 181 clienti, tutti con profiles.plan='pro'):
--   professional  monitoring / sleep / sport → 144 con_accesso, 0 senza
--   client        monitoring / sleep / sport → 155 con_accesso, 26 senza
--                 (i 26 non hanno un collegamento attivo con nessun
--                  professionista, e nessuno di loro ha dati)
--   stato: attivo 144
select p.role,
       m.codice as modulo,
       count(*) filter (where d.attivo)     as con_accesso,
       count(*) filter (where not d.attivo) as senza_accesso,
       string_agg(distinct d.fonte, ', ')   as fonti
  from public.profiles p
  cross join public.moduli m
  cross join lateral public.modulo_accesso_dettaglio(p.id, m.codice) d
 where p.role in ('professional', 'client')
 group by 1, 2
 order by 1, 2;

select public.account_stato_effettivo(p.id) as stato, count(*)
  from public.profiles p
 where p.role = 'professional'
 group by 1
 order by 1;

select piano, string_agg(modulo, ', ' order by modulo) as moduli
  from public.piano_moduli
 group by 1
 order by 1;
