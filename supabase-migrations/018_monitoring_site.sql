-- =============================================================================
-- STRESS INDEX — 018: Monitoraggio 24h / Sonno sul sito
-- =============================================================================
--
-- Prerequisiti (repo hrv_app, da applicare PRIMA se non lo sono già):
--   supabase/migrations/monitoring_sessions.sql          (tabella, RLS, bucket, RPC)
--   supabase/migrations/monitoring_recording_profile.sql (colonna recording_profile)
--   supabase/migrations/monitoring_sleep.sql             (colonne sleep + bucket monitoring-spo2)
-- Al 2026-09-11 sul DB c'era solo la prima: il sito legge le colonne mancanti
-- in modo resiliente, ma senza le altre due le righe 1.1 e le notti non
-- portano recording_profile / sleep_score.
--
-- Contenuto (idempotente, ogni blocco protetto da EXCEPTION WHEN OTHERS):
--   1. monitoring_sessions.events_modified_on_web (+ _at): eventi modificati
--      dal sito, in attesa che l'app ricalcoli la reazione agli eventi.
--   2. RPC get_linked_client_monitoring_sessions_by_client_id riscritta con il
--      ponte clients.client_user_id (migration 017), oltre a email/id: stessa
--      firma della versione dell'app.
--   3. Policy SELECT esplicita per il superadmin (ridondante con
--      hrv_puo_accedere → hrv_e_amministrativo, ma allineata a 010/011).
--   4. Reload dello schema PostgREST.
--
-- Eseguire nel SQL Editor di Supabase.
-- =============================================================================

-- ── 1. Flag "eventi modificati dal sito" ──────────────────────────────────────
do $$
begin
  alter table public.monitoring_sessions
    add column if not exists events_modified_on_web boolean not null default false;
  alter table public.monitoring_sessions
    add column if not exists events_modified_on_web_at timestamptz;
  comment on column public.monitoring_sessions.events_modified_on_web is
    'True quando il professionista ha aggiunto/modificato/eliminato eventi dal sito: la reazione agli eventi (events[].response) va ricalcolata dall''app, che poi riporta il flag a false.';
exception when others then
  raise notice '018.1 events_modified_on_web non applicata: %', sqlerrm;
end $$;

-- ── 2. RPC bridge con client_user_id ─────────────────────────────────────────
-- Monitoraggi di un cliente collegato a partire dalla riga CRM. Tre vie:
--   a. clients.client_user_id (017)            → ponte esplicito
--   b. clients.id = profiles.id::text          → cliente nato dal link
--   c. email uguale (case-insensitive)         → storico
-- più le righe scritte direttamente sul CRM (client_id + professionista_id).
do $$
begin
  execute $f$
    create or replace function public.get_linked_client_monitoring_sessions_by_client_id(
      p_client_id text
    )
    returns setof public.monitoring_sessions
    language sql
    security definer
    set search_path = public
    stable
    as $body$
      select m.*
        from public.clients c
        join public.client_professional_links l
          on l.professional_id = auth.uid()
         and l.status = 'active'
        join public.profiles p
          on p.id = l.client_user_id
         and (
              c.client_user_id = p.id
           or c.id = p.id::text
           or (c.email is not null and p.email is not null and lower(trim(c.email)) = lower(trim(p.email)))
         )
        join public.monitoring_sessions m
          on m.user_id = p.id
       where c.id = p_client_id
         and c.professionista_id = auth.uid()
      union
      select m.*
        from public.monitoring_sessions m
       where m.client_id = p_client_id
         and m.professionista_id = auth.uid()
       order by start_time desc;
    $body$;
  $f$;
  grant execute on function public.get_linked_client_monitoring_sessions_by_client_id(text) to authenticated;
exception when others then
  raise notice '018.2 RPC get_linked_client_monitoring_sessions_by_client_id non applicata: %', sqlerrm;
end $$;

-- ── 3. Lettura superadmin esplicita ──────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_superadmin' and pronamespace = 'public'::regnamespace) then
    execute 'drop policy if exists "monitoring_sessions_superadmin_read" on public.monitoring_sessions';
    execute 'create policy "monitoring_sessions_superadmin_read" on public.monitoring_sessions for select using (public.is_superadmin())';
  else
    raise notice '018.3 is_superadmin() assente (migration 010 non applicata): policy non creata';
  end if;
exception when others then
  raise notice '018.3 policy superadmin non applicata: %', sqlerrm;
end $$;

-- ── 4. Reload schema ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
