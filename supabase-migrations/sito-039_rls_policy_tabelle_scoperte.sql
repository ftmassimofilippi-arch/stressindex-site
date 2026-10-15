-- =============================================================================
-- sito-039: policy esplicite sulle tabelle con RLS attiva e zero policy
-- =============================================================================
-- Audit QA 14/10/2026, punto D2. Solo policy (nessuna revoca, nessuna
-- cancellazione): applicata da Claude il 15/10/2026 dopo averla scritta.
--
-- Con RLS attiva e nessuna policy la tabella è già chiusa a `anon` e
-- `authenticated` (la `service_role` scavalca la RLS). Qui lo si scrive
-- esplicitamente, così l'advisor smette di segnalarle e chi legge il database
-- capisce la regola:
--   • `hrv_norms`, `hrv_norms_fallback`: tabelle di riferimento (Nunan 2010,
--     Voss 2015), lettura a chi è loggato. Nessuna scrittura.
--   • `abbonamenti`, `abbonamenti_storico`, `account_stato`, `moduli_eccezioni`:
--     commerciale (sito-024), si leggono solo tramite `my_account_access()` e
--     le funzioni `admin_*`. Solo `service_role`.
--   • `collegamenti_esclusioni`, `collegamenti_riparazione_link_ok`,
--     `collegamenti_riparazione_log`, `gdpr_storage_coda`,
--     `alert_rules_dedup_log`: registri interni. Solo `service_role`.
--   • Le tabelle `*_backup_*` e `*_orfane_*` restano senza policy: sono
--     candidate alla rimozione (elenco nel FIX_REPORT), non si toccano qui.
--
-- Come si annulla: `drop policy <nome> on <tabella>` per ciascuna.
-- Idempotente.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['hrv_norms', 'hrv_norms_fallback'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_lettura_loggati', t);
      execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_lettura_loggati', t);
      execute format('drop policy if exists %I on public.%I', t || '_service_role', t);
      execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t || '_service_role', t);
    end if;
  end loop;

  foreach t in array array[
    'abbonamenti', 'abbonamenti_storico', 'account_stato', 'moduli_eccezioni',
    'collegamenti_esclusioni', 'collegamenti_riparazione_link_ok', 'collegamenti_riparazione_log',
    'gdpr_storage_coda', 'alert_rules_dedup_log'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_service_role', t);
      execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t || '_service_role', t);
    end if;
  end loop;
end $$;

-- Verifica:
--   select tablename from pg_tables t where schemaname='public' and rowsecurity
--     and not exists (select 1 from pg_policies p where p.tablename=t.tablename)
--     and tablename not like '%backup%' and tablename not like '%orfane%';
--   -- atteso: nessuna riga
