-- =============================================================================
-- STRESS INDEX — 025: notifiche al professionista per le misurazioni da remoto
-- =============================================================================
--
-- Oggi un cliente collegato può misurarsi dalla SUA app e il professionista non
-- riceve niente. Questa migration prepara tutto il lato database; l'invio vero
-- lo fanno due Edge Function (notify-measurement, notify-digest) e un Database
-- Webhook. Vedi docs/NOTIFICHE.md per i comandi di deploy.
--
-- Contenuto (idempotente, ogni blocco protetto da EXCEPTION WHEN OTHERS):
--   1. notification_preferences: la tabella esisteva già (001) ma senza policy
--      di INSERT, quindi nessuno ha mai potuto salvarci niente (è vuota). Qui
--      si aggiungono le colonne nuove (on_client_measurement, digest_hour,
--      email_override, timezone, lingua) e si rifanno le policy con WITH CHECK.
--   2. notification_queue: la coda degli eventi da notificare. Ci finisce OGNI
--      misurazione remota di un cliente collegato il cui professionista non ha
--      scelto "mai", anche in modalità "subito": così un evento soppresso
--      dall'anti-ripetizione non va perso, lo raccoglie l'email successiva.
--   3. notification_log: traccia di ogni email, riuscita o fallita, più le
--      soppressioni. È anche la memoria dell'anti-ripetizione (una email per
--      cliente per ora).
--   4. notifica_scheda_cliente(): ponte client_user_id → clients.id, serve a
--      costruire il link diretto al dettaglio sul sito. Stessa logica a quattro
--      vie di src/lib/remote-sessions.ts (ponte esplicito, link, id, email).
--   5. notifica_destinatari(): dato il cliente che si è misurato, restituisce i
--      professionisti collegati (link active) con email e preferenze risolte.
--   6. notifiche_digest_da_inviare(): i professionisti la cui digest_hour è
--      l'ora corrente NEL LORO FUSO e che hanno qualcosa in coda.
--   7. notifiche_pulizia(): retention di coda e log.
--   8. Reload dello schema PostgREST.
--
-- Nessun trigger e nessun cron qui dentro: il webhook si crea dalla dashboard,
-- il job orario è nella 026 (va modificata a mano prima di applicarla).
--
-- Eseguire nel SQL Editor di Supabase, dopo la 024. Ri-eseguibile in sicurezza.
-- =============================================================================

-- ── 1. Preferenze di notifica ────────────────────────────────────────────────
do $$
begin
  -- La tabella nasce nella 001, ma se quella non fosse mai stata applicata
  -- qui non si deve fallire: la si crea con la forma completa.
  create table if not exists public.notification_preferences (
    user_id              uuid primary key references auth.users(id) on delete cascade,
    weekly_summary_email boolean default true,
    weekly_summary_day   text default 'monday',
    weekly_summary_time  text default '08:00',
    alert_email_enabled  boolean default false,
    marketing_emails     boolean default true,
    updated_at           timestamptz default now()
  );

  alter table public.notification_preferences
    add column if not exists on_client_measurement text not null default 'riepilogo';
  alter table public.notification_preferences
    add column if not exists digest_hour smallint not null default 20;
  alter table public.notification_preferences
    add column if not exists email_override text;
  alter table public.notification_preferences
    add column if not exists timezone text not null default 'Europe/Rome';
  alter table public.notification_preferences
    add column if not exists lingua text not null default 'it';

  comment on column public.notification_preferences.on_client_measurement is
    'Cosa fare quando un cliente collegato si misura da remoto: subito (una email per misurazione, al massimo una per cliente all''ora) | riepilogo (una sola email al giorno all''ora digest_hour) | mai.';
  comment on column public.notification_preferences.digest_hour is
    'Ora locale (0-23, nel fuso `timezone`) del riepilogo giornaliero.';
  comment on column public.notification_preferences.email_override is
    'Indirizzo alternativo per le notifiche. Se nullo si usa l''email dell''account.';
  comment on column public.notification_preferences.timezone is
    'Fuso IANA del professionista, usato per decidere quando far partire il riepilogo.';
  comment on column public.notification_preferences.lingua is
    'Lingua delle email di notifica: it | en | de.';
exception when others then
  raise notice '025.1 colonne notification_preferences non applicate: %', sqlerrm;
end $$;

-- Vincoli separati dalle colonne: un valore fuori elenco già presente non deve
-- far fallire l'intera migration, ma va segnalato.
do $$
begin
  alter table public.notification_preferences
    drop constraint if exists notification_preferences_on_client_measurement_check;
  alter table public.notification_preferences
    add constraint notification_preferences_on_client_measurement_check
    check (on_client_measurement in ('subito', 'riepilogo', 'mai'));

  alter table public.notification_preferences
    drop constraint if exists notification_preferences_digest_hour_check;
  alter table public.notification_preferences
    add constraint notification_preferences_digest_hour_check
    check (digest_hour between 0 and 23);

  alter table public.notification_preferences
    drop constraint if exists notification_preferences_lingua_check;
  alter table public.notification_preferences
    add constraint notification_preferences_lingua_check
    check (lingua in ('it', 'en', 'de'));
exception when others then
  raise notice '025.1b vincoli notification_preferences non applicati: %', sqlerrm;
end $$;

-- RLS: la policy della 001 era `FOR ALL USING (auth.uid() = user_id)` senza
-- WITH CHECK. Su INSERT la USING non viene valutata e la WITH CHECK manca →
-- ogni inserimento veniva rifiutato e la pagina Impostazioni non ha mai potuto
-- salvare le preferenze. Qui si separano lettura, inserimento e modifica.
do $$
begin
  alter table public.notification_preferences enable row level security;

  drop policy if exists "notification_preferences_own_data" on public.notification_preferences;
  drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
  drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
  drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
  drop policy if exists "notification_preferences_delete_own" on public.notification_preferences;

  create policy "notification_preferences_select_own" on public.notification_preferences
    for select using (auth.uid() = user_id);
  create policy "notification_preferences_insert_own" on public.notification_preferences
    for insert with check (auth.uid() = user_id);
  create policy "notification_preferences_update_own" on public.notification_preferences
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "notification_preferences_delete_own" on public.notification_preferences
    for delete using (auth.uid() = user_id);
exception when others then
  raise notice '025.1c policy notification_preferences non applicate: %', sqlerrm;
end $$;

-- updated_at: la pagina Impostazioni fa un upsert e non lo passa. Meglio un
-- trigger che ricordarselo in ogni punto del client.
create or replace function public.notification_preferences_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
begin
  drop trigger if exists notification_preferences_touch on public.notification_preferences;
  create trigger notification_preferences_touch
    before insert or update on public.notification_preferences
    for each row execute function public.notification_preferences_touch();
exception when others then
  raise notice '025.1d trigger updated_at non applicato: %', sqlerrm;
end $$;

-- ── 2. Coda del riepilogo ────────────────────────────────────────────────────
-- Una riga per (evento, professionista destinatario). `sent_at` nullo = ancora
-- da comunicare. La UNIQUE rende innocuo un webhook che rispara: il DB webhook
-- di Supabase è at-least-once.
create table if not exists public.notification_queue (
  id             uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  client_id      text,                       -- scheda CRM, se il ponte la trova
  kind           text not null,              -- measurement | monitoring | night
  source_table   text not null,              -- sessions | monitoring_sessions | night_metrics
  source_id      text not null,
  occurred_at    timestamptz not null,       -- quando è avvenuta la misurazione
  payload        jsonb not null default '{}'::jsonb,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

do $$
begin
  create unique index if not exists notification_queue_evento_uniq
    on public.notification_queue (source_table, source_id, professional_id);
  create index if not exists notification_queue_pending
    on public.notification_queue (professional_id, occurred_at) where sent_at is null;
  alter table public.notification_queue
    drop constraint if exists notification_queue_kind_check;
  alter table public.notification_queue
    add constraint notification_queue_kind_check
    check (kind in ('measurement', 'monitoring', 'night'));
exception when others then
  raise notice '025.2 indici notification_queue non applicati: %', sqlerrm;
end $$;

-- Nessuno legge questa tabella con un JWT: ci lavora solo la service_role delle
-- Edge Function, che salta la RLS. La RLS resta attiva senza policy = negato a
-- tutti gli altri.
do $$
begin
  alter table public.notification_queue enable row level security;
  if exists (select 1 from pg_proc where proname = 'is_superadmin' and pronamespace = 'public'::regnamespace) then
    drop policy if exists "notification_queue_superadmin_read" on public.notification_queue;
    create policy "notification_queue_superadmin_read" on public.notification_queue
      for select using (public.is_superadmin());
  end if;
exception when others then
  raise notice '025.2b RLS notification_queue non applicata: %', sqlerrm;
end $$;

-- ── 3. Log degli invii ───────────────────────────────────────────────────────
-- `status`: sent (partita) | failed (SMTP ha rifiutato) | skipped (soppressa
-- dall'anti-ripetizione o senza destinatario). Solo le righe `sent` contano per
-- l'anti-ripetizione.
create table if not exists public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  client_user_id  uuid references auth.users(id) on delete set null,
  client_id       text,
  kind            text not null,             -- measurement | monitoring | night | digest
  status          text not null,             -- sent | failed | skipped
  reason          text,                      -- motivo di skipped / errore SMTP
  source_table    text,
  source_id       text,
  event_count     integer not null default 1,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

do $$
begin
  -- L'indice dell'anti-ripetizione: "esiste una email partita nell'ultima ora
  -- per questo cliente verso questo professionista?".
  create index if not exists notification_log_antiripetizione
    on public.notification_log (professional_id, client_user_id, created_at desc)
    where status = 'sent';
  create index if not exists notification_log_recente
    on public.notification_log (created_at desc);
  alter table public.notification_log
    drop constraint if exists notification_log_status_check;
  alter table public.notification_log
    add constraint notification_log_status_check
    check (status in ('sent', 'failed', 'skipped'));
exception when others then
  raise notice '025.3 indici notification_log non applicati: %', sqlerrm;
end $$;

do $$
begin
  alter table public.notification_log enable row level security;
  drop policy if exists "notification_log_own_read" on public.notification_log;
  create policy "notification_log_own_read" on public.notification_log
    for select using (auth.uid() = professional_id);
  if exists (select 1 from pg_proc where proname = 'is_superadmin' and pronamespace = 'public'::regnamespace) then
    drop policy if exists "notification_log_superadmin_read" on public.notification_log;
    create policy "notification_log_superadmin_read" on public.notification_log
      for select using (public.is_superadmin());
  end if;
exception when others then
  raise notice '025.3b RLS notification_log non applicata: %', sqlerrm;
end $$;

-- ── 4. Ponte client_user_id → scheda CRM ─────────────────────────────────────
-- Serve solo per costruire il link "apri il dettaglio": se non trova nulla
-- torna NULL e l'email rimanda alla lista clienti. Quattro vie in ordine di
-- affidabilità, le stesse di src/lib/remote-sessions.ts buildBridge().
create or replace function public.notifica_scheda_cliente(
  p_client_user_id uuid,
  p_professional_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id    text;
  v_email text;
begin
  if p_client_user_id is null or p_professional_id is null then return null; end if;

  -- 1. ponte esplicito clients.client_user_id (017)
  select c.id into v_id
  from public.clients c
  where c.professionista_id = p_professional_id
    and c.client_user_id = p_client_user_id
    and c.merged_into_client_id is null
  limit 1;
  if v_id is not null then return v_id; end if;

  -- 2. scheda nata dall'accettazione del link: clients.id (TEXT) contiene
  --    l'uid dell'utente. Il confronto passa da un cast perché
  --    client_professional_links.client_id è UUID e punta ad auth.users
  --    (FK rifatta dalla 022), mentre clients.id è testo: senza il cast il
  --    join non compila proprio.
  select c.id into v_id
  from public.clients c
  where c.professionista_id = p_professional_id
    and c.merged_into_client_id is null
    and (
      c.id = p_client_user_id::text
      or c.id in (
        select l.client_id::text
        from public.client_professional_links l
        where l.professional_id = p_professional_id
          and l.client_user_id = p_client_user_id
          and l.status = 'active'
          and l.client_id is not null
      )
    )
  limit 1;
  if v_id is not null then return v_id; end if;

  -- 3. stessa email (cliente pre-registrato dal professionista)
  select lower(trim(p.email)) into v_email from public.profiles p where p.id = p_client_user_id;
  if v_email is null or v_email = '' then return null; end if;
  select c.id into v_id
  from public.clients c
  where c.professionista_id = p_professional_id
    and lower(trim(c.email)) = v_email
    and c.merged_into_client_id is null
  limit 1;
  return v_id;
end $$;

comment on function public.notifica_scheda_cliente(uuid, uuid) is
  'Scheda CRM (clients.id) del cliente app p_client_user_id per il professionista indicato, o NULL. Solo per costruire i link delle email di notifica.';

-- ── 5. Destinatari di una misurazione remota ─────────────────────────────────
-- Dato l'utente-cliente che si è misurato restituisce i professionisti a cui
-- va comunicata: link `active`, preferenze risolte (con i default se la riga
-- non esiste ancora), email di destinazione già scelta.
create or replace function public.notifica_destinatari(p_client_user_id uuid)
returns table (
  professional_id       uuid,
  recipient_email       text,
  on_client_measurement text,
  digest_hour           smallint,
  lingua                text,
  fuso                  text,
  client_id             text,
  client_nome           text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.professional_id,
    coalesce(nullif(trim(np.email_override), ''), pp.email)                as recipient_email,
    coalesce(np.on_client_measurement, 'riepilogo')                        as on_client_measurement,
    coalesce(np.digest_hour, 20::smallint)                                 as digest_hour,
    coalesce(np.lingua, 'it')                                              as lingua,
    coalesce(np.timezone, 'Europe/Rome')                                   as fuso,
    public.notifica_scheda_cliente(p_client_user_id, l.professional_id)    as client_id,
    nullif(trim(coalesce(cp.nome, '') || ' ' || coalesce(cp.cognome, '')), '') as client_nome
  from public.client_professional_links l
  join public.profiles pp on pp.id = l.professional_id
  left join public.profiles cp on cp.id = p_client_user_id
  left join public.notification_preferences np on np.user_id = l.professional_id
  where l.client_user_id = p_client_user_id
    and l.status = 'active'
    and pp.role = 'professional'
    and coalesce(nullif(trim(np.email_override), ''), pp.email) is not null;
$$;

comment on function public.notifica_destinatari(uuid) is
  'Professionisti collegati (link active) a cui notificare una misurazione remota del cliente indicato, con preferenze già risolte sui default.';

-- ── 6. Chi va riepilogato adesso ─────────────────────────────────────────────
-- Il job orario chiama questa funzione: torna i professionisti in modalità
-- "riepilogo" la cui digest_hour è l'ora corrente NEL LORO FUSO e che hanno
-- almeno un evento in coda non ancora comunicato. Chi non ha niente in coda
-- non compare, quindi nessuna email vuota.
create or replace function public.notifiche_digest_da_inviare()
returns table (
  professional_id uuid,
  recipient_email text,
  lingua          text,
  fuso            text,
  eventi          integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r        record;
  v_ora    integer;
begin
  for r in
    select
      q.professional_id                                                  as pid,
      coalesce(nullif(trim(np.email_override), ''), pp.email)            as email,
      coalesce(np.lingua, 'it')                                          as lang,
      coalesce(np.timezone, 'Europe/Rome')                               as tz,
      coalesce(np.digest_hour, 20::smallint)                             as ora_scelta,
      count(*)::integer                                                  as n
    from public.notification_queue q
    join public.profiles pp on pp.id = q.professional_id
    left join public.notification_preferences np on np.user_id = q.professional_id
    where q.sent_at is null
      and coalesce(np.on_client_measurement, 'riepilogo') = 'riepilogo'
      and pp.role = 'professional'
      and coalesce(nullif(trim(np.email_override), ''), pp.email) is not null
      -- Solo il giorno in corso: un evento più vecchio è rimasto indietro per
      -- un guasto, lo raccoglie comunque il primo riepilogo utile.
      and q.occurred_at > now() - interval '7 days'
    group by 1, 2, 3, 4, 5
  loop
    -- Un fuso scritto male non deve far saltare il riepilogo di tutti gli altri.
    begin
      v_ora := extract(hour from (now() at time zone r.tz))::integer;
    exception when others then
      v_ora := extract(hour from (now() at time zone 'Europe/Rome'))::integer;
    end;
    if v_ora = r.ora_scelta then
      professional_id := r.pid;
      recipient_email := r.email;
      lingua          := r.lang;
      fuso            := r.tz;
      eventi          := r.n;
      return next;
    end if;
  end loop;
end $$;

comment on function public.notifiche_digest_da_inviare() is
  'Professionisti da riepilogare in questa ora: modalità riepilogo, digest_hour = ora corrente nel loro fuso, almeno un evento in coda.';

-- ── 7. Retention ─────────────────────────────────────────────────────────────
create or replace function public.notifiche_pulizia()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coda integer := 0;
  v_log  integer := 0;
begin
  delete from public.notification_queue
   where sent_at is not null and sent_at < now() - interval '30 days';
  get diagnostics v_coda = row_count;
  -- Anche le righe mai inviate scadono: un evento di due settimane fa non è
  -- più una notizia.
  delete from public.notification_queue
   where sent_at is null and occurred_at < now() - interval '14 days';
  delete from public.notification_log
   where created_at < now() - interval '180 days';
  get diagnostics v_log = row_count;
  return v_coda + v_log;
end $$;

-- ── 8. Permessi ──────────────────────────────────────────────────────────────
-- Queste funzioni espongono email e collegamenti altrui: le chiama solo la
-- service_role delle Edge Function, mai un utente loggato.
do $$
begin
  revoke all on function public.notifica_scheda_cliente(uuid, uuid) from public, anon, authenticated;
  revoke all on function public.notifica_destinatari(uuid) from public, anon, authenticated;
  revoke all on function public.notifiche_digest_da_inviare() from public, anon, authenticated;
  revoke all on function public.notifiche_pulizia() from public, anon, authenticated;
  grant execute on function public.notifica_scheda_cliente(uuid, uuid) to service_role;
  grant execute on function public.notifica_destinatari(uuid) to service_role;
  grant execute on function public.notifiche_digest_da_inviare() to service_role;
  grant execute on function public.notifiche_pulizia() to service_role;
exception when others then
  raise notice '025.8 permessi non applicati: %', sqlerrm;
end $$;

-- ── 9. Reload schema ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
