-- sito-048: consensi granulari e immutabili (pacchetto legale 2.1, 17/10/2026)
--
-- Fino alla 1.0 `gdpr_consents` aveva una riga cumulativa per utente
-- (privacy_accepted, service_accepted, marketing_accepted), scritta solo dall'app.
-- Dalla 2.1 ogni consenso è una riga a sé: tipo, esito, versione del testo,
-- impronta SHA-256, lingua, data, IP, user agent, origine. Le righe 2.1 non si
-- modificano e non si cancellano: una revoca è una nuova riga con granted=false.
--
-- `professionista_id` resta la chiave dell'utente (per i clienti con account è
-- il loro uid): il nome è storico, non si rinomina per non rompere l'app.
-- Le righe 1.0 (consent_type null) restano com'erano e l'app può continuare a
-- scriverle e aggiornarle finché non passa al modello 2.1.
--
-- Idempotente. Solo modifiche additive.

begin;

alter table public.gdpr_consents
  add column if not exists consent_type text,
  add column if not exists granted boolean,
  add column if not exists text_version text,
  add column if not exists text_sha256 text,
  add column if not exists text_lang text,
  add column if not exists granted_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists user_agent text,
  add column if not exists source text,
  add column if not exists related_user_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gdpr_consents_consent_type_chk') then
    alter table public.gdpr_consents add constraint gdpr_consents_consent_type_chk
      check (consent_type is null or consent_type in (
        'terms_privacy','dpa','wellness_ack','health_data','share_professional',
        'marketing','stats_algorithms','research','contact','studio_transfer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gdpr_consents_source_chk') then
    alter table public.gdpr_consents add constraint gdpr_consents_source_chk
      check (source is null or source in ('app','site','migration','admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gdpr_consents_lang_chk') then
    alter table public.gdpr_consents add constraint gdpr_consents_lang_chk
      check (text_lang is null or text_lang in ('it','en','de'));
  end if;
  -- una riga 2.1 è completa o non è
  if not exists (select 1 from pg_constraint where conname = 'gdpr_consents_v2_completa_chk') then
    alter table public.gdpr_consents add constraint gdpr_consents_v2_completa_chk
      check (consent_type is null or (granted is not null and text_version is not null
             and granted_at is not null and source is not null));
  end if;
end $$;

create index if not exists gdpr_consents_utente_tipo_idx
  on public.gdpr_consents (professionista_id, consent_type, granted_at desc)
  where consent_type is not null;

-- Stato corrente: l'ultima riga 2.1 per utente e tipo di consenso.
create or replace view public.gdpr_consents_current
with (security_invoker = true) as
select distinct on (professionista_id, consent_type)
  professionista_id as user_id, consent_type, granted, text_version, text_lang,
  granted_at, source, related_user_id
from public.gdpr_consents
where consent_type is not null
order by professionista_id, consent_type, granted_at desc, id;

-- Policy: prima una sola policy ALL ("Consenso personale") che permetteva
-- all'utente di riscrivere o cancellare i propri consensi.
drop policy if exists "Consenso personale" on public.gdpr_consents;
drop policy if exists gdpr_consents_select_own on public.gdpr_consents;
drop policy if exists gdpr_consents_insert_own on public.gdpr_consents;
drop policy if exists gdpr_consents_update_legacy_own on public.gdpr_consents;
drop policy if exists gdpr_consents_delete_legacy_own on public.gdpr_consents;

create policy gdpr_consents_select_own on public.gdpr_consents
  for select to authenticated using (auth.uid() = professionista_id);
create policy gdpr_consents_insert_own on public.gdpr_consents
  for insert to authenticated with check (auth.uid() = professionista_id);
-- solo le righe 1.0, per compatibilità con le versioni dell'app in circolazione
create policy gdpr_consents_update_legacy_own on public.gdpr_consents
  for update to authenticated
  using (auth.uid() = professionista_id and consent_type is null)
  with check (auth.uid() = professionista_id and consent_type is null);
create policy gdpr_consents_delete_legacy_own on public.gdpr_consents
  for delete to authenticated using (auth.uid() = professionista_id and consent_type is null);

revoke all on public.gdpr_consents from anon;
revoke truncate, references, trigger on public.gdpr_consents from authenticated;
revoke all on public.gdpr_consents_current from anon;
grant select on public.gdpr_consents_current to authenticated;

commit;

-- Verifica dopo l'applicazione:
--   select has_table_privilege('anon','public.gdpr_consents','select');      -- false
--   select polname from pg_policy where polrelid='public.gdpr_consents'::regclass;
