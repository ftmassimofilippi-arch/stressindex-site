-- =============================================================================
-- STRESS INDEX — 027: gestione dell'accesso app del cliente dal sito
-- =============================================================================
--
-- Il professionista può creare l'accesso app di un cliente e rimetterlo in piedi
-- quando il cliente non riesce più a entrare. Perché resti una cosa tracciabile
-- e non un potere silenzioso:
--
--   1. professional_access_log — registro APPEND-ONLY di ogni azione sul mezzo
--      di accesso di un cliente (password temporanea, email di reset, link di
--      reset copiato). Il professionista rilegge solo le proprie righe; nessuno
--      può modificarle o cancellarle, nemmeno la service_role, perché un
--      trigger blocca UPDATE e DELETE. Serve anche al rate limit (5 azioni per
--      cliente ogni 24 ore), che il sito calcola contando qui.
--   2. profiles.must_change_password — alzata quando il professionista imposta
--      una password temporanea. L'app Flutter, al login, se la trova true
--      obbliga il cliente a scegliere una password sua e poi la riabbassa.
--      Se la colonna manca l'app non blocca nessuno: è una colonna additiva.
--
-- Perché il log non basta la RLS: la service_role la scavalca per definizione, e
-- le route /api/* girano con quella. Il trigger è l'unica cosa che rende il
-- registro davvero non riscrivibile.
--
-- Idempotente, ogni blocco protetto da EXCEPTION WHEN OTHERS. Eseguire nel SQL
-- Editor di Supabase. Indipendente da 025/026: si può applicare prima o dopo.
-- =============================================================================

-- ── 1. Registro delle azioni sull'accesso ────────────────────────────────────
create table if not exists public.professional_access_log (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  -- Scheda CRM (clients.id è TEXT, non uuid): è l'identificatore che il
  -- professionista vede e su cui si conta il rate limit.
  client_id       text not null,
  -- Account app su cui si è agito, quando è noto. Non è una FK: se l'utente
  -- viene cancellato la traccia dell'azione deve restare.
  client_user_id  uuid,
  action          text not null,
  -- Esito e contesto: se l'email di avviso al cliente non è partita si vede qui.
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

do $$
begin
  alter table public.professional_access_log
    add column if not exists client_user_id uuid;
  alter table public.professional_access_log
    add column if not exists details jsonb not null default '{}'::jsonb;

  alter table public.professional_access_log
    drop constraint if exists professional_access_log_action_check;
  alter table public.professional_access_log
    add constraint professional_access_log_action_check
    check (action in ('set_temp_password', 'send_reset_email', 'copy_reset_link', 'create_access'));

  -- Indice del rate limit: "quante azioni su questo cliente nelle ultime 24h?".
  create index if not exists professional_access_log_rate
    on public.professional_access_log (professional_id, client_id, created_at desc);

  comment on table public.professional_access_log is
    'Registro append-only delle azioni del professionista sull''accesso app dei suoi clienti. UPDATE e DELETE sono bloccati da trigger.';
  comment on column public.professional_access_log.action is
    'set_temp_password | send_reset_email | copy_reset_link | create_access';
exception when others then
  raise notice '027.1 professional_access_log non completata: %', sqlerrm;
end $$;

-- RLS: lettura solo delle proprie righe. Nessuna policy di INSERT, UPDATE o
-- DELETE: scrive solo il server con la service_role, che salta la RLS.
do $$
begin
  alter table public.professional_access_log enable row level security;

  drop policy if exists "professional_access_log_own_read" on public.professional_access_log;
  create policy "professional_access_log_own_read" on public.professional_access_log
    for select using (auth.uid() = professional_id);

  if exists (select 1 from pg_proc where proname = 'is_superadmin' and pronamespace = 'public'::regnamespace) then
    drop policy if exists "professional_access_log_superadmin_read" on public.professional_access_log;
    create policy "professional_access_log_superadmin_read" on public.professional_access_log
      for select using (public.is_superadmin());
  else
    raise notice '027.2 is_superadmin() assente: policy superadmin non creata';
  end if;
exception when others then
  raise notice '027.2 RLS professional_access_log non applicata: %', sqlerrm;
end $$;

-- Append-only per davvero: il trigger vale anche per la service_role e per il
-- proprietario della tabella.
create or replace function public.professional_access_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'professional_access_log è un registro append-only: % non è consentita', tg_op
    using errcode = '42501';
end $$;

do $$
begin
  drop trigger if exists professional_access_log_no_update on public.professional_access_log;
  create trigger professional_access_log_no_update
    before update or delete on public.professional_access_log
    for each row execute function public.professional_access_log_append_only();
exception when others then
  raise notice '027.3 trigger append-only non applicato: %', sqlerrm;
end $$;

-- ── 2. Cambio password obbligatorio al primo accesso ─────────────────────────
-- Alzata dal sito quando il professionista imposta una password temporanea,
-- riabbassata dall'app dopo che il cliente ha scelto la sua.
do $$
begin
  alter table public.profiles
    add column if not exists must_change_password boolean not null default false;
  comment on column public.profiles.must_change_password is
    'True quando la password attuale è temporanea, impostata dal professionista: l''app obbliga il cliente a cambiarla al login e poi rimette false.';
exception when others then
  raise notice '027.4 profiles.must_change_password non aggiunta: %', sqlerrm;
end $$;

-- Il cliente deve poter riabbassare il flag da solo dopo il cambio password.
-- Le policy di `profiles` variano da progetto a progetto: si aggiunge una
-- policy di UPDATE sulla propria riga solo se non ce n'è già una che la copre.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
  ) then
    create policy "profiles_update_own" on public.profiles
      for update using (auth.uid() = id) with check (auth.uid() = id);
    raise notice '027.5 creata policy profiles_update_own (non ce n''era nessuna di UPDATE)';
  else
    raise notice '027.5 profiles ha già una policy di UPDATE: lasciata invariata';
  end if;
exception when others then
  raise notice '027.5 policy profiles_update_own non applicata: %', sqlerrm;
end $$;

-- ── 3. Reload schema ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
