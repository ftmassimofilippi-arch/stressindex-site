-- sito-048: registro dei consensi granulari e immutabili (pacchetto legale 2.1, 17/10/2026)
--
-- `gdpr_consents` resta com'è: una riga per utente (UNIQUE professionista_id),
-- scritta e aggiornata dall'app con le colonne 1.0. Non si tocca, per non
-- rompere le versioni dell'app in circolazione.
--
-- Dalla 2.1 ogni consenso è una riga a sé in `consent_records`: tipo, esito,
-- versione del testo, impronta SHA-256, lingua, data, IP, user agent, origine.
-- Solo insert: niente update né delete per gli utenti. Una revoca è una riga
-- nuova con granted=false. Lo stato corrente è in `consent_records_current`.
--
-- In più: `anon` perde tutti i grant su `gdpr_consents` (la RLS lo bloccava già,
-- ma i grant di default restavano).
--
-- Idempotente. Solo modifiche additive.

begin;

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms_privacy','dpa','wellness_ack','health_data','share_professional',
    'marketing','stats_algorithms','research','contact','studio_transfer')),
  granted boolean not null,
  text_version text not null,
  text_sha256 text,
  text_lang text check (text_lang is null or text_lang in ('it','en','de')),
  granted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  source text not null check (source in ('app','site','migration','admin')),
  related_user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.consent_records enable row level security;
revoke all on public.consent_records from anon, authenticated;
grant select, insert on public.consent_records to authenticated;

drop policy if exists consent_records_select_own on public.consent_records;
drop policy if exists consent_records_insert_own on public.consent_records;
create policy consent_records_select_own on public.consent_records
  for select to authenticated using (auth.uid() = user_id);
create policy consent_records_insert_own on public.consent_records
  for insert to authenticated with check (auth.uid() = user_id);

create index if not exists consent_records_utente_tipo_idx
  on public.consent_records (user_id, consent_type, granted_at desc);

-- Stato corrente: l'ultima riga per utente e tipo di consenso.
create or replace view public.consent_records_current
with (security_invoker = true) as
select distinct on (user_id, consent_type)
  user_id, consent_type, granted, text_version, text_lang, granted_at, source, related_user_id
from public.consent_records
order by user_id, consent_type, granted_at desc, created_at desc;

revoke all on public.consent_records_current from anon, authenticated;
grant select on public.consent_records_current to authenticated;

-- gdpr_consents (1.0): via i grant ad anon, e i privilegi che nessuno usa.
revoke all on public.gdpr_consents from anon;
revoke truncate, references, trigger on public.gdpr_consents from authenticated;

commit;

-- Verifica dopo l'applicazione:
--   select has_table_privilege('anon','public.consent_records','select');          -- false
--   select has_table_privilege('authenticated','public.consent_records','update');  -- false
--   select has_table_privilege('anon','public.gdpr_consents','select');            -- false
