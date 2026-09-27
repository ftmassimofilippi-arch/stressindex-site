-- =============================================================================
-- STRESS INDEX — 028: la cancellazione di un utente non deve più fallire
-- =============================================================================
--
-- IL PROBLEMA (misurato in produzione, non ipotizzato)
--
--   auth.admin.deleteUser() su un professionista che ha usato la gestione
--   dell'accesso cliente risponde "Database error deleting user" e non cancella
--   niente. La catena è questa:
--
--     1. professional_access_log.professional_id ha una FK verso auth.users(id)
--        con ON DELETE CASCADE (027);
--     2. cancellare l'utente fa quindi partire un DELETE sulle righe del
--        registro;
--     3. il trigger professional_access_log_no_update (BEFORE DELETE, 027)
--        alza 42501 "registro append-only: DELETE non è consentita" — vale
--        anche per la service_role e per il proprietario della tabella;
--     4. l'eccezione risale e fa fallire tutta la transazione di GoTrue.
--
--   Conseguenza grave: un professionista che ha impostato una password
--   temporanea o copiato un link di reset NON PUÒ PIÙ CANCELLARE IL PROPRIO
--   ACCOUNT. L'Edge Function delete-account (richiesta GDPR, Apple Guideline
--   5.1.1(v)) arriva fino a deleteUser e torna auth_delete_failed.
--
--   Verificato anche il resto: l'unico trigger BEFORE DELETE su public è quello
--   del registro, ma ci sono altre quattro FK verso auth.users senza azione di
--   cancellazione (NO ACTION = blocca), che fanno fallire deleteUser nello
--   stesso modo opaco:
--     measurement_analytics.user_id     (3628 righe: blocca ogni utente che
--                                        abbia mai misurato, se non si cancella
--                                        prima a mano come fa delete-account)
--     organizations.owner_id
--     organization_members.user_id
--     organization_members.invited_by
--
-- LA CORREZIONE
--
--   1. Nel registro le FK spariscono: restano gli uuid. Le righe sopravvivono
--      alla cancellazione dell'account come traccia pseudonimizzata — è il
--      senso di un registro append-only, e una traccia che si autodistrugge
--      quando si cancella il soggetto non è una traccia.
--   2. Il trigger append-only RESTA, con un solo varco: le funzioni di
--      manutenzione dedicate qui sotto, su cui EXECUTE è revocato a anon,
--      authenticated e service_role. Le route /api/* girano con la service_role
--      e quindi continuano a non poter riscrivere né cancellare niente.
--   3. "Pseudonimizzata" per davvero: details contiene l'email del cliente.
--      Un trigger AFTER DELETE su auth.users la toglie quando l'account se ne
--      va, lasciando azione, uuid e data. Il trigger ingoia qualunque errore:
--      non deve mai diventare il prossimo motivo per cui non si cancella un
--      utente.
--   4. Conservazione 12 mesi, con un job pg_cron giornaliero che passa dalla
--      funzione di manutenzione.
--   5. Le altre quattro FK passano da NO ACTION a CASCADE o SET NULL.
--
-- Idempotente, ogni blocco protetto da EXCEPTION WHEN OTHERS. Eseguire nel SQL
-- Editor di Supabase. Richiede la 027 già applicata.
-- =============================================================================

-- ── 0. Diagnosi: cos'altro blocca la cancellazione di un utente ──────────────
-- Non cambia niente, stampa. Utile riapplicandola fra sei mesi: se qualcuno ha
-- aggiunto una FK bloccante o un trigger BEFORE DELETE, lo si legge qui.
do $$
declare
  r record;
  v_trovati int := 0;
begin
  for r in
    select c.conrelid::regclass::text as tabella, c.conname,
           case c.confdeltype when 'a' then 'NO ACTION' else 'RESTRICT' end as azione
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
      and c.confdeltype in ('a', 'r')
      and c.connamespace <> 'auth'::regnamespace
    order by 1
  loop
    v_trovati := v_trovati + 1;
    raise notice '028.0 FK che blocca la cancellazione: %.% (% su delete)', r.tabella, r.conname, r.azione;
  end loop;

  for r in
    select t.tgrelid::regclass::text as tabella, t.tgname
    from pg_trigger t
    where not t.tgisinternal
      and (t.tgtype & 8) > 0            -- fires on DELETE
      and (t.tgtype & 2) > 0            -- BEFORE
      and t.tgrelid::regclass::text not like 'storage.%'
      and t.tgrelid::regclass::text not like 'cron.%'
    order by 1
  loop
    v_trovati := v_trovati + 1;
    raise notice '028.0 trigger BEFORE DELETE da controllare: % su %', r.tgname, r.tabella;
  end loop;

  if v_trovati = 0 then
    raise notice '028.0 nessuna FK bloccante e nessun trigger BEFORE DELETE sospetto';
  end if;
exception when others then
  raise notice '028.0 diagnosi non eseguita: %', sqlerrm;
end $$;

-- ── 1. Registro: via le FK, restano gli uuid ─────────────────────────────────
-- Si cancellano tutte le FK della tabella (non solo quella nota per nome): così
-- il blocco è giusto anche se il vincolo è stato ricreato con un altro nome.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.professional_access_log'::regclass and contype = 'f'
  loop
    execute format('alter table public.professional_access_log drop constraint %I', r.conname);
    raise notice '028.1 rimossa FK %', r.conname;
  end loop;

  -- La retention filtra su created_at: l'indice del rate limit non la copre.
  create index if not exists professional_access_log_created_at
    on public.professional_access_log (created_at);

  comment on column public.professional_access_log.professional_id is
    'uuid del professionista che ha agito. NESSUNA foreign key: quando l''account viene cancellato la riga resta come traccia pseudonimizzata (uuid, azione, data).';
  comment on column public.professional_access_log.client_user_id is
    'uuid dell''account app su cui si è agito, quando noto. Nessuna foreign key, stesso motivo di professional_id.';
  comment on table public.professional_access_log is
    'Registro append-only delle azioni del professionista sull''accesso app dei suoi clienti. UPDATE e DELETE sono bloccati da trigger: solo public.professional_access_log_purge* e ..._anonimizza possono scrivere, e EXECUTE su quelle funzioni è revocato a anon, authenticated e service_role. Conservazione 12 mesi (job professional_access_log_retention).';
exception when others then
  raise notice '028.1 registro non ripulito dalle FK: %', sqlerrm;
end $$;

-- ── 2. Append-only con un varco per la sola manutenzione ─────────────────────
-- Il varco è un parametro di sessione che solo le funzioni qui sotto alzano, e
-- solo per la durata della propria transazione (set_config con is_local = true).
-- Chi passa da PostgREST non ha modo di alzarlo: non può eseguire SQL arbitrario
-- e non ha EXECUTE su quelle funzioni.
create or replace function public.professional_access_log_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if coalesce(current_setting('stressindex.access_log_manutenzione', true), 'off') = 'on' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  raise exception
    'professional_access_log è un registro append-only: % non è consentita', tg_op
    using errcode = '42501',
          hint = 'Solo le funzioni di manutenzione (professional_access_log_purge, _purge_utente, _anonimizza) possono modificare il registro.';
end $$;

do $$
begin
  -- Il trigger di 027 punta già a questa funzione: si ricrea solo per essere
  -- idempotenti anche su un database dove non ci fosse.
  drop trigger if exists professional_access_log_no_update on public.professional_access_log;
  create trigger professional_access_log_no_update
    before update or delete on public.professional_access_log
    for each row execute function public.professional_access_log_append_only();
exception when others then
  raise notice '028.2 trigger append-only non riapplicato: %', sqlerrm;
end $$;

-- ── 3. Funzioni di manutenzione dedicate ─────────────────────────────────────
-- SECURITY DEFINER e di proprietà di postgres: le esegue il job pg_cron e chi
-- ha accesso diretto al database, nessun altro.

-- 3a. Conservazione: cancella le righe più vecchie di p_conserva.
create or replace function public.professional_access_log_purge(
  p_conserva interval default interval '12 months'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_righe integer := 0;
begin
  perform set_config('stressindex.access_log_manutenzione', 'on', true);
  delete from public.professional_access_log where created_at < now() - p_conserva;
  get diagnostics v_righe = row_count;
  perform set_config('stressindex.access_log_manutenzione', 'off', true);
  return v_righe;
exception when others then
  perform set_config('stressindex.access_log_manutenzione', 'off', true);
  raise warning 'professional_access_log_purge: %', sqlerrm;
  return -1;
end $$;

comment on function public.professional_access_log_purge(interval) is
  'Conservazione del registro: cancella le righe più vecchie dell''intervallo (default 12 mesi) e torna quante ne ha cancellate. È l''unica via per un DELETE sul registro insieme a _purge_utente. Chiamata ogni giorno dal job professional_access_log_retention.';

-- 3b. Cancellazione totale delle righe di un utente: serve per una richiesta di
--     cancellazione che non si accontenta della pseudonimizzazione, e per
--     ripulire gli account di prova.
create or replace function public.professional_access_log_purge_utente(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_righe integer := 0;
begin
  if p_user_id is null then return 0; end if;
  perform set_config('stressindex.access_log_manutenzione', 'on', true);
  delete from public.professional_access_log
   where professional_id = p_user_id or client_user_id = p_user_id;
  get diagnostics v_righe = row_count;
  perform set_config('stressindex.access_log_manutenzione', 'off', true);
  return v_righe;
exception when others then
  perform set_config('stressindex.access_log_manutenzione', 'off', true);
  raise warning 'professional_access_log_purge_utente(%): %', p_user_id, sqlerrm;
  return -1;
end $$;

comment on function public.professional_access_log_purge_utente(uuid) is
  'Cancella tutte le righe del registro che riguardano un utente (come professionista o come cliente). Per le richieste di cancellazione totale e per gli account di prova.';

-- 3c. Pseudonimizzazione: toglie da details tutto ciò che è dato personale e
--     lascia azione, uuid, data. Le chiavi sono quelle scritte dalle route
--     /api/clienti/* (oggi solo `email`), più qualche nome difensivo.
create or replace function public.professional_access_log_anonimizza(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_righe integer := 0;
  v_pii   text[] := array['email', 'nome', 'cognome', 'telefono', 'link', 'token', 'message'];
begin
  if p_user_id is null then return 0; end if;
  perform set_config('stressindex.access_log_manutenzione', 'on', true);
  update public.professional_access_log
     set details = (details - v_pii) || jsonb_build_object('pii_rimossa', now())
   where (professional_id = p_user_id or client_user_id = p_user_id)
     and details ?| v_pii;
  get diagnostics v_righe = row_count;
  perform set_config('stressindex.access_log_manutenzione', 'off', true);
  return v_righe;
exception when others then
  perform set_config('stressindex.access_log_manutenzione', 'off', true);
  raise warning 'professional_access_log_anonimizza(%): %', p_user_id, sqlerrm;
  return -1;
end $$;

comment on function public.professional_access_log_anonimizza(uuid) is
  'Toglie i dati personali da details lasciando azione, uuid e data: è ciò che rende la riga una traccia pseudonimizzata. Chiamata dal trigger su auth.users quando l''account viene cancellato.';

-- Nessuno di questi tre passa da PostgREST né è chiamabile da un utente loggato.
do $$
begin
  revoke all on function public.professional_access_log_purge(interval)        from public, anon, authenticated, service_role;
  revoke all on function public.professional_access_log_purge_utente(uuid)     from public, anon, authenticated, service_role;
  revoke all on function public.professional_access_log_anonimizza(uuid)       from public, anon, authenticated, service_role;
exception when others then
  raise notice '028.3 revoke sulle funzioni di manutenzione non completata: %', sqlerrm;
end $$;

-- ── 4. Alla cancellazione dell'account, il registro si pseudonimizza ─────────
-- Nota bene: questo trigger sta sulla strada della cancellazione di un utente,
-- cioè esattamente dove stava il bug. Per questo il corpo è avvolto in un
-- blocco che ingoia qualunque errore: se l'anonimizzazione non riesce, si perde
-- una pulizia, non la cancellazione dell'account.
create or replace function public.auth_user_deleted_pulisci_registro()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  begin
    perform public.professional_access_log_anonimizza(old.id);
  exception when others then
    raise warning 'anonimizzazione del registro per % non riuscita: %', old.id, sqlerrm;
  end;
  return old;
end $$;

do $$
begin
  drop trigger if exists professional_access_log_pseudonimizza on auth.users;
  create trigger professional_access_log_pseudonimizza
    after delete on auth.users
    for each row execute function public.auth_user_deleted_pulisci_registro();
exception when others then
  raise notice '028.4 trigger su auth.users non applicato (%): le righe del registro resteranno con l''email finché non si chiama professional_access_log_anonimizza a mano', sqlerrm;
end $$;

-- ── 5. Le altre FK che bloccavano la cancellazione ───────────────────────────
-- measurement_analytics: i dati della misurazione sono dati della persona, e
-- delete-account li cancella già a mano prima di deleteUser. CASCADE mette il
-- database d'accordo con quel comportamento, e fa funzionare la cancellazione
-- anche dalle altre strade (dashboard Supabase, script di servizio).
do $$
begin
  alter table public.measurement_analytics
    drop constraint if exists measurement_analytics_user_id_fkey;
  alter table public.measurement_analytics
    add constraint measurement_analytics_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade not valid;
  raise notice '028.5 measurement_analytics.user_id -> ON DELETE CASCADE';
exception when others then
  raise notice '028.5 measurement_analytics non corretta: %', sqlerrm;
end $$;

-- NOT VALID non controlla le righe già presenti (al momento della scrittura
-- nessuna è orfana, ma la migration deve reggere anche fra un anno). L'azione di
-- cancellazione vale comunque da subito: si prova a validare a parte.
do $$
begin
  alter table public.measurement_analytics validate constraint measurement_analytics_user_id_fkey;
exception when others then
  raise notice '028.5 measurement_analytics_user_id_fkey resta NOT VALID (ci sono righe orfane da ripulire): %', sqlerrm;
end $$;

-- organizations / organization_members: l'organizzazione non deve sparire
-- perché il proprietario cancella il suo account, quindi SET NULL e colonna resa
-- annullabile; l'iscrizione di una persona invece muore con la persona.
do $$
begin
  alter table public.organizations alter column owner_id drop not null;
  alter table public.organizations drop constraint if exists organizations_owner_id_fkey;
  alter table public.organizations
    add constraint organizations_owner_id_fkey
    foreign key (owner_id) references auth.users(id) on delete set null;
  comment on column public.organizations.owner_id is
    'Proprietario. Diventa NULL se l''account viene cancellato: l''organizzazione resta e va riassegnata.';
  raise notice '028.5 organizations.owner_id -> ON DELETE SET NULL';
exception when others then
  raise notice '028.5 organizations.owner_id non corretta: %', sqlerrm;
end $$;

do $$
begin
  alter table public.organization_members drop constraint if exists organization_members_user_id_fkey;
  alter table public.organization_members
    add constraint organization_members_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

  alter table public.organization_members alter column invited_by drop not null;
  alter table public.organization_members drop constraint if exists organization_members_invited_by_fkey;
  alter table public.organization_members
    add constraint organization_members_invited_by_fkey
    foreign key (invited_by) references auth.users(id) on delete set null;
  raise notice '028.5 organization_members: user_id -> CASCADE, invited_by -> SET NULL';
exception when others then
  raise notice '028.5 organization_members non corretta: %', sqlerrm;
end $$;

-- ── 6. Conservazione 12 mesi, ogni giorno ────────────────────────────────────
-- Alle 3:35 UTC, dopo notifiche_pulizia_giornaliera (3:20) e non insieme.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'professional_access_log_retention';
  perform cron.schedule(
    'professional_access_log_retention',
    '35 3 * * *',
    $job$ select public.professional_access_log_purge(interval '12 months'); $job$
  );
  raise notice '028.6 job professional_access_log_retention schedulato (35 3 * * *)';
exception when others then
  raise notice '028.6 job di conservazione non schedulato: %', sqlerrm;
end $$;

-- ── 7. Verifica ──────────────────────────────────────────────────────────────
do $$
declare
  v_fk      int;
  v_trigger int;
  v_job     int;
begin
  select count(*) into v_fk from pg_constraint
   where conrelid = 'public.professional_access_log'::regclass and contype = 'f';
  select count(*) into v_trigger from pg_trigger
   where tgrelid = 'public.professional_access_log'::regclass and tgname = 'professional_access_log_no_update';
  select count(*) into v_job from cron.job where jobname = 'professional_access_log_retention';

  raise notice '028.7 registro: % FK (attese 0), % trigger append-only (atteso 1), % job di conservazione (atteso 1)',
    v_fk, v_trigger, v_job;
exception when others then
  raise notice '028.7 verifica non eseguita: %', sqlerrm;
end $$;

-- ── 8. Reload schema ─────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
