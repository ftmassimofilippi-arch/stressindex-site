-- =============================================================================
-- STRESS INDEX — 024: gestione commerciale degli account
-- =============================================================================
--
-- 1. Catalogo estendibile senza migrazioni:
--      moduli (sport, monitoring, sleep, …) · piani (base, pro, prova) ·
--      piano_moduli (moduli inclusi di default in ogni piano)
-- 2. account_stato: attivo | sospeso | bloccato (+ motivo, solo superadmin).
--    "prova" non si salva qui: è lo stato di chi ha il piano prova e non è
--    sospeso né bloccato (account_stato_effettivo), così i due non divergono.
-- 3. abbonamenti (uno per account: piano, inizio, scadenza, rinnovo
--    automatico, note) + abbonamenti_storico (creazione, cambi, prolungamenti,
--    rinnovi automatici, scadenze).
-- 4. moduli_eccezioni: per singolo account sovrascrive il piano, in positivo
--    o in negativo, con motivo e scadenza opzionale.
-- 5. UNICO punto di verità: modulo_accesso_dettaglio() → has_module_access()
--    (app e sito), my_account_access() (stato e moduli dell'utente loggato,
--    senza il motivo), admin_account_moduli() (pannello: attivo + fonte).
-- 6. Funzioni admin (solo service_role, chiamate dalle route /api/admin/*):
--    admin_set_account_status, admin_set_subscription,
--    admin_extend_subscription, admin_set_module_exception. Ognuna scrive
--    admin_audit_log con chi, cosa, prima/dopo e perché.
-- 7. commerciale_scadenze_giornaliere() + pg_cron 03:05 UTC: abbonamenti
--    scaduti → rinnovo automatico oppure stato sospeso.
-- 8. Policy RESTRICTIVE: un account sospeso o bloccato non può inserire né
--    modificare clienti, sessioni, monitoraggi e sessioni sport (anche da
--    un'app non aggiornata).
-- 9. profiles.plan resta come COPIA legacy ('pro' se il piano include lo
--    sport ed è valido, altrimenti 'base') per le versioni dell'app che la
--    leggono ancora; non va più scritta direttamente.
--
-- Semina (nessun comportamento cambia per gli account esistenti):
--   profiles.plan = 'pro' → piano pro senza scadenza;
--   tutti gli altri professionisti → piano base senza scadenza, anche i 4
--   con un trial di registrazione ancora in corso (nota nell'abbonamento);
--   i moduli già usati e non inclusi nel piano (monitoraggi 24h di
--   professionisti Base) ricevono un'eccezione positiva "già in uso".
--   Da qui in avanti ogni nuovo professionista riceve un abbonamento
--   (commerciale_abbonamento_iniziale): prova fino a trial_expires_at se la
--   registrazione web lo imposta, altrimenti base senza scadenza.
--
-- Idempotente. Da applicare dopo la 023.

-- ── 1. Catalogo ─────────────────────────────────────────────────────────────
create table if not exists public.moduli (
  codice      text primary key,
  nome        text not null,
  descrizione text,
  icona       text,                 -- nome icona lucide per il pannello
  ordine      integer not null default 100,
  attivo      boolean not null default true,
  created_at  timestamptz not null default now()
);
insert into public.moduli (codice, nome, descrizione, icona, ordine) values
  ('sport',      'Sport',        'Sessioni sport, zone DFA, Team Live',            'bike',     10),
  ('monitoring', 'Monitoraggio', 'Monitoraggio 24h e registrazioni lunghe',        'activity', 20),
  ('sleep',      'Sonno',        'Registrazioni del sonno e import da dispositivi', 'moon',     30)
on conflict (codice) do nothing;

create table if not exists public.piani (
  codice      text primary key,
  nome        text not null,
  ordine      integer not null default 100,
  created_at  timestamptz not null default now()
);
insert into public.piani (codice, nome, ordine) values
  ('base', 'Base', 10), ('pro', 'Pro', 20), ('prova', 'Prova', 5)
on conflict (codice) do nothing;

create table if not exists public.piano_moduli (
  piano  text not null references public.piani(codice) on delete cascade,
  modulo text not null references public.moduli(codice) on delete cascade,
  primary key (piano, modulo)
);
-- Default solo alla prima applicazione (una riga tolta a mano non ritorna).
-- Base: nessuno. Pro: sport + monitoring. Prova: come Pro. Sonno: sempre a parte.
do $$
begin
  if not exists (select 1 from public.piano_moduli) then
    insert into public.piano_moduli (piano, modulo) values
      ('pro', 'sport'), ('pro', 'monitoring'), ('prova', 'sport'), ('prova', 'monitoring');
  end if;
end $$;

alter table public.moduli enable row level security;
alter table public.piani enable row level security;
alter table public.piano_moduli enable row level security;
drop policy if exists moduli_read on public.moduli;
create policy moduli_read on public.moduli for select to authenticated using (true);
drop policy if exists piani_read on public.piani;
create policy piani_read on public.piani for select to authenticated using (true);
drop policy if exists piano_moduli_read on public.piano_moduli;
create policy piano_moduli_read on public.piano_moduli for select to authenticated using (true);

-- ── 2-4. Stato, abbonamento, storico, eccezioni ────────────────────────────
create table if not exists public.account_stato (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stato              text not null default 'attivo' check (stato in ('attivo', 'sospeso', 'bloccato')),
  motivo             text,
  cambiato_il        timestamptz not null default now(),
  cambiato_da        uuid,
  cambiato_da_email  text
);

create table if not exists public.abbonamenti (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  piano               text not null references public.piani(codice),
  data_inizio         date not null default current_date,
  data_scadenza       date,                  -- NULL = senza scadenza; ultimo giorno valido incluso
  rinnovo_automatico  boolean not null default false,
  note                text,
  aggiornato_il       timestamptz not null default now(),
  aggiornato_da       uuid,
  aggiornato_da_email text,
  constraint abbonamenti_prova_con_scadenza check (piano <> 'prova' or data_scadenza is not null),
  constraint abbonamenti_date check (data_scadenza is null or data_scadenza >= data_inizio)
);
create index if not exists idx_abbonamenti_scadenza on public.abbonamenti (data_scadenza) where data_scadenza is not null;

create table if not exists public.abbonamenti_storico (
  id                bigserial primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  evento            text not null check (evento in ('creazione', 'modifica', 'cambio_piano', 'prolungamento', 'rinnovo_automatico', 'scadenza')),
  piano_prima       text,
  piano_dopo        text,
  scadenza_prima    date,
  scadenza_dopo     date,
  mesi              integer,
  note              text,
  eseguito_il       timestamptz not null default now(),
  eseguito_da       uuid,
  eseguito_da_email text
);
create index if not exists idx_abbonamenti_storico_user on public.abbonamenti_storico (user_id, eseguito_il desc);

create table if not exists public.moduli_eccezioni (
  user_id          uuid not null references auth.users(id) on delete cascade,
  modulo           text not null references public.moduli(codice) on delete cascade,
  abilitato        boolean not null,
  motivo           text not null,
  scade_il         date,                     -- NULL = permanente; ultimo giorno valido incluso
  creato_il        timestamptz not null default now(),
  creato_da        uuid,
  creato_da_email  text,
  primary key (user_id, modulo)
);

-- Nessuna lettura diretta per gli utenti (il motivo è solo per il superadmin):
-- l'utente vede stato e moduli tramite my_account_access().
alter table public.account_stato enable row level security;
alter table public.abbonamenti enable row level security;
alter table public.abbonamenti_storico enable row level security;
alter table public.moduli_eccezioni enable row level security;
revoke all on public.account_stato, public.abbonamenti, public.abbonamenti_storico, public.moduli_eccezioni from anon, authenticated;
grant select, insert, update, delete on public.account_stato, public.abbonamenti, public.abbonamenti_storico, public.moduli_eccezioni to service_role;
grant usage, select on sequence public.abbonamenti_storico_id_seq to service_role;

-- ── Semina ──────────────────────────────────────────────────────────────────
insert into public.abbonamenti (user_id, piano, data_inizio, data_scadenza, note, aggiornato_da_email)
select p.id,
       case when p.plan = 'pro' then 'pro' else 'base' end,
       coalesce(p.created_at, now())::date,
       null,
       case when p.plan is distinct from 'pro' and pp.trial_expires_at > now()
            then 'Trial di registrazione fino al ' || to_char(pp.trial_expires_at, 'DD/MM/YYYY') || ' non convertito in piano prova dalla migrazione 024'
            else null end,
       'migration:024'
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.id = p.id
 where p.role = 'professional'
on conflict (user_id) do nothing;

-- Moduli già in uso prima della 024 e non inclusi nel piano (es. professionisti
-- Base con monitoraggi 24h): eccezione positiva, così nessuno perde l'accesso
-- applicando la migrazione. Si tolgono dal pannello. Solo account senza
-- eccezione su quel modulo (rieseguibile).
with ins as (
  insert into public.moduli_eccezioni (user_id, modulo, abilitato, motivo, creato_da_email)
  select distinct u.user_id, u.modulo, true, 'Modulo già in uso prima della migrazione 024 (non incluso nel piano)', 'migration:024'
    from (
      select coalesce(m.professionista_id, m.user_id) as user_id,
             case when m.monitoring_type = 'sleep' then 'sleep' else 'monitoring' end as modulo
        from public.monitoring_sessions m
    ) u
    join public.profiles p on p.id = u.user_id and p.role = 'professional'
    join auth.users au on au.id = u.user_id
    left join public.abbonamenti a on a.user_id = u.user_id
   where not exists (select 1 from public.piano_moduli pm where pm.piano = a.piano and pm.modulo = u.modulo)
  on conflict (user_id, modulo) do nothing
  returning user_id, modulo, motivo
)
insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
select null, 'migration:024', 'module_exception_change', 'user', i.user_id::text,
       jsonb_build_object('modulo', i.modulo, 'eccezione_dopo', jsonb_build_object('abilitato', true, 'scade_il', null),
                          'accesso_prima', true, 'accesso_dopo', true, 'motivo', i.motivo)
  from ins i;

insert into public.abbonamenti_storico (user_id, evento, piano_dopo, note, eseguito_da_email)
select a.user_id, 'creazione', a.piano, 'Semina dalla migrazione 024 (profiles.plan)', 'migration:024'
  from public.abbonamenti a
 where a.aggiornato_da_email = 'migration:024'
   and not exists (select 1 from public.abbonamenti_storico s where s.user_id = a.user_id);

-- ── 5. Accesso ai moduli: un solo punto di verità ──────────────────────────
create or replace function public.account_stato_effettivo(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when s.stato in ('sospeso', 'bloccato') then s.stato
           when a.piano = 'prova' then 'prova'
           else 'attivo'
         end
    from (select 1) x
    left join public.account_stato s on s.user_id = p_user_id
    left join public.abbonamenti a on a.user_id = p_user_id;
$$;

-- Dettaglio di un modulo per un account: attivo + da dove viene.
-- fonte: 'superadmin' | 'stato' (sospeso/bloccato) | 'modulo_disattivato' |
--        'eccezione' | 'piano' | 'scaduto' | 'professionista' (cliente coperto
--        da un professionista collegato) | 'nessuna'
create or replace function public.modulo_accesso_dettaglio(p_user_id uuid, p_modulo text)
returns table (attivo boolean, fonte text, piano text, eccezione_abilitata boolean, eccezione_scade_il date, incluso_nel_piano boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today   date := (now() at time zone 'Europe/Rome')::date;
  v_role    text;
  v_super   boolean;
  v_stato   text;
  v_piano   text;
  v_scad    date;
  v_ecc     boolean;
  v_ecc_sc  date;
  v_incl    boolean;
begin
  select p.role, coalesce(p.is_superadmin, false) into v_role, v_super from public.profiles p where p.id = p_user_id;
  select a.piano, a.data_scadenza into v_piano, v_scad from public.abbonamenti a where a.user_id = p_user_id;
  select e.abilitato, e.scade_il into v_ecc, v_ecc_sc
    from public.moduli_eccezioni e
   where e.user_id = p_user_id and e.modulo = p_modulo and (e.scade_il is null or e.scade_il >= v_today);
  v_incl := v_piano is not null and exists (select 1 from public.piano_moduli pm where pm.piano = v_piano and pm.modulo = p_modulo);

  if not exists (select 1 from public.moduli m where m.codice = p_modulo and m.attivo) then
    return query select false, 'modulo_disattivato'::text, v_piano, v_ecc, v_ecc_sc, v_incl; return;
  end if;
  if v_super then
    return query select true, 'superadmin'::text, v_piano, v_ecc, v_ecc_sc, v_incl; return;
  end if;
  v_stato := public.account_stato_effettivo(p_user_id);
  if v_stato in ('sospeso', 'bloccato') then
    return query select false, 'stato'::text, v_piano, v_ecc, v_ecc_sc, v_incl; return;
  end if;
  if v_ecc is not null then
    return query select v_ecc, 'eccezione'::text, v_piano, v_ecc, v_ecc_sc, v_incl; return;
  end if;
  if v_role = 'client' then
    -- Cliente: coperto se almeno un professionista con collegamento attivo ha
    -- il modulo (valutato con le stesse regole, senza ricorsione sui clienti).
    return query
      select exists (
               select 1 from public.client_professional_links l
                join public.profiles pr on pr.id = l.professional_id and pr.role = 'professional'
                where l.client_user_id = p_user_id and l.status = 'active'
                  and (select d.attivo from public.modulo_accesso_dettaglio(l.professional_id, p_modulo) d)
             ),
             'professionista'::text, v_piano, v_ecc, v_ecc_sc, v_incl;
    return;
  end if;
  if v_incl and v_scad is not null and v_scad < v_today then
    return query select false, 'scaduto'::text, v_piano, v_ecc, v_ecc_sc, v_incl; return;
  end if;
  return query select v_incl, case when v_incl then 'piano' else 'nessuna' end, v_piano, v_ecc, v_ecc_sc, v_incl;
end;
$$;
revoke all on function public.modulo_accesso_dettaglio(uuid, text) from public, anon, authenticated;
grant execute on function public.modulo_accesso_dettaglio(uuid, text) to service_role;

-- Chiamata da app e sito. Chi chiama può chiedere di sé stesso, di un account
-- collegato (link active, in entrambe le direzioni); il superadmin e la
-- service role di chiunque.
create or replace function public.has_module_access(p_user_id uuid, p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_module is null then return false; end if;
  if auth.uid() is not null and auth.uid() <> p_user_id
     and not coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
     and not exists (select 1 from public.client_professional_links l
                      where l.status = 'active'
                        and ((l.client_user_id = auth.uid() and l.professional_id = p_user_id)
                          or (l.professional_id = auth.uid() and l.client_user_id = p_user_id))) then
    return false;
  end if;
  return coalesce((select d.attivo from public.modulo_accesso_dettaglio(p_user_id, p_module) d), false);
end;
$$;
revoke all on function public.has_module_access(uuid, text) from public, anon;
grant execute on function public.has_module_access(uuid, text) to authenticated, service_role;

-- Stato e moduli dell'utente loggato, per il controllo all'avvio e a ogni
-- sincronizzazione. Il motivo della sospensione non viene restituito.
create or replace function public.my_account_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_mod   jsonb;
  a       record;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select coalesce(jsonb_object_agg(m.codice, (select d.attivo from public.modulo_accesso_dettaglio(v_uid, m.codice) d)), '{}'::jsonb)
    into v_mod from public.moduli m;
  select * into a from public.abbonamenti where user_id = v_uid;
  return jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'stato', public.account_stato_effettivo(v_uid),
    'piano', a.piano,
    'data_scadenza', a.data_scadenza,
    'giorni_alla_scadenza', case when a.data_scadenza is null then null else a.data_scadenza - v_today end,
    'rinnovo_automatico', a.rinnovo_automatico,
    'moduli', v_mod,
    'verificato_il', now()
  );
end;
$$;
revoke all on function public.my_account_access() from public, anon;
grant execute on function public.my_account_access() to authenticated, service_role;

-- Pannello: tutti i moduli di tutti gli account (attivo + fonte + eccezione).
create or replace function public.admin_account_moduli()
returns table (user_id uuid, modulo text, attivo boolean, fonte text, incluso_nel_piano boolean, eccezione_abilitata boolean, eccezione_scade_il date, eccezione_motivo text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, m.codice, d.attivo, d.fonte, d.incluso_nel_piano, d.eccezione_abilitata, d.eccezione_scade_il, e.motivo
    from public.profiles p
    cross join public.moduli m
    cross join lateral public.modulo_accesso_dettaglio(p.id, m.codice) d
    left join public.moduli_eccezioni e on e.user_id = p.id and e.modulo = m.codice
   order by p.id, m.ordine;
$$;
revoke all on function public.admin_account_moduli() from public, anon, authenticated;
grant execute on function public.admin_account_moduli() to service_role;

create or replace view public.v_admin_account as
select p.id as user_id,
       public.account_stato_effettivo(p.id) as stato,
       s.motivo as stato_motivo,
       s.cambiato_il as stato_cambiato_il,
       s.cambiato_da_email as stato_cambiato_da,
       a.piano,
       a.data_inizio,
       a.data_scadenza,
       case when a.data_scadenza is null then null
            else a.data_scadenza - (now() at time zone 'Europe/Rome')::date end as giorni_alla_scadenza,
       a.rinnovo_automatico,
       a.note as abbonamento_note
  from public.profiles p
  left join public.account_stato s on s.user_id = p.id
  left join public.abbonamenti a on a.user_id = p.id;
revoke all on public.v_admin_account from public, anon, authenticated;
grant select on public.v_admin_account to service_role;

-- ── 9. Copia legacy profiles.plan ──────────────────────────────────────────
create or replace function public.commerciale_sync_plan(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_plan  text;
begin
  select case when public.account_stato_effettivo(p_user_id) in ('sospeso', 'bloccato') then 'base'
              when a.data_scadenza is not null and a.data_scadenza < v_today then 'base'
              when exists (select 1 from public.piano_moduli pm where pm.piano = a.piano and pm.modulo = 'sport') then 'pro'
              else 'base' end
    into v_plan
    from public.abbonamenti a where a.user_id = p_user_id;
  if v_plan is null then return; end if;
  update public.profiles set plan = v_plan where id = p_user_id and plan is distinct from v_plan;
end;
$$;
revoke all on function public.commerciale_sync_plan(uuid) from public, anon, authenticated;

-- Audit comune (performed_by NULL per cron/migrazioni).
create or replace function public.commerciale_audit(p_by uuid, p_by_email text, p_action text, p_user_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
  values (p_by, p_by_email, p_action, 'user', p_user_id::text, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.commerciale_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

-- ── 6. Funzioni admin ──────────────────────────────────────────────────────
create or replace function public.admin_set_account_status(p_user_id uuid, p_stato text, p_motivo text, p_by uuid, p_by_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prima text;
  v_prima_motivo text;
begin
  if p_stato not in ('attivo', 'sospeso', 'bloccato') then
    return jsonb_build_object('ok', false, 'error', 'stato_non_valido');
  end if;
  if p_stato in ('sospeso', 'bloccato') and nullif(trim(p_motivo), '') is null then
    return jsonb_build_object('ok', false, 'error', 'motivo_obbligatorio');
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'utente_inesistente');
  end if;
  if p_stato <> 'attivo' and coalesce((select is_superadmin from public.profiles where id = p_user_id), false) then
    return jsonb_build_object('ok', false, 'error', 'superadmin_non_sospendibile');
  end if;
  v_prima := public.account_stato_effettivo(p_user_id);
  select motivo into v_prima_motivo from public.account_stato where user_id = p_user_id;

  insert into public.account_stato (user_id, stato, motivo, cambiato_il, cambiato_da, cambiato_da_email)
  values (p_user_id, p_stato, nullif(trim(p_motivo), ''), now(), p_by, p_by_email)
  on conflict (user_id) do update
     set stato = excluded.stato, motivo = excluded.motivo, cambiato_il = now(),
         cambiato_da = excluded.cambiato_da, cambiato_da_email = excluded.cambiato_da_email;

  perform public.commerciale_sync_plan(p_user_id);
  perform public.commerciale_audit(p_by, p_by_email, 'account_status_change', p_user_id,
    jsonb_build_object('prima', v_prima, 'dopo', public.account_stato_effettivo(p_user_id),
                       'motivo', nullif(trim(p_motivo), ''), 'motivo_precedente', v_prima_motivo));
  return jsonb_build_object('ok', true, 'prima', v_prima, 'dopo', public.account_stato_effettivo(p_user_id));
end;
$$;

create or replace function public.admin_set_subscription(
  p_user_id uuid, p_piano text, p_data_inizio date, p_data_scadenza date, p_rinnovo boolean, p_note text,
  p_motivo text, p_by uuid, p_by_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old     public.abbonamenti%rowtype;
  v_found boolean;
  v_evento text;
begin
  if not exists (select 1 from public.piani where codice = p_piano) then
    return jsonb_build_object('ok', false, 'error', 'piano_non_valido');
  end if;
  if p_piano = 'prova' and p_data_scadenza is null then
    return jsonb_build_object('ok', false, 'error', 'prova_senza_scadenza');
  end if;
  if p_data_scadenza is not null and p_data_scadenza < coalesce(p_data_inizio, current_date) then
    return jsonb_build_object('ok', false, 'error', 'scadenza_prima_di_inizio');
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'utente_inesistente');
  end if;
  select * into old from public.abbonamenti where user_id = p_user_id;
  v_found := found;

  insert into public.abbonamenti (user_id, piano, data_inizio, data_scadenza, rinnovo_automatico, note, aggiornato_il, aggiornato_da, aggiornato_da_email)
  values (p_user_id, p_piano, coalesce(p_data_inizio, current_date), p_data_scadenza, coalesce(p_rinnovo, false), nullif(trim(p_note), ''), now(), p_by, p_by_email)
  on conflict (user_id) do update
     set piano = excluded.piano, data_inizio = excluded.data_inizio, data_scadenza = excluded.data_scadenza,
         rinnovo_automatico = excluded.rinnovo_automatico, note = excluded.note,
         aggiornato_il = now(), aggiornato_da = excluded.aggiornato_da, aggiornato_da_email = excluded.aggiornato_da_email;

  v_evento := case when not v_found then 'creazione' when old.piano is distinct from p_piano then 'cambio_piano' else 'modifica' end;
  insert into public.abbonamenti_storico (user_id, evento, piano_prima, piano_dopo, scadenza_prima, scadenza_dopo, note, eseguito_da, eseguito_da_email)
  values (p_user_id, v_evento, old.piano, p_piano, old.data_scadenza, p_data_scadenza, nullif(trim(p_motivo), ''), p_by, p_by_email);

  perform public.commerciale_sync_plan(p_user_id);
  perform public.commerciale_audit(p_by, p_by_email, 'subscription_change', p_user_id, jsonb_build_object(
    'evento', v_evento,
    'prima', case when v_found then jsonb_build_object('piano', old.piano, 'data_inizio', old.data_inizio, 'data_scadenza', old.data_scadenza,
                                                       'rinnovo_automatico', old.rinnovo_automatico, 'note', old.note) end,
    'dopo', jsonb_build_object('piano', p_piano, 'data_inizio', coalesce(p_data_inizio, current_date), 'data_scadenza', p_data_scadenza,
                               'rinnovo_automatico', coalesce(p_rinnovo, false), 'note', nullif(trim(p_note), '')),
    'motivo', nullif(trim(p_motivo), '')));
  return jsonb_build_object('ok', true, 'evento', v_evento);
end;
$$;

-- Prolunga di N mesi dalla scadenza (o da oggi se già scaduta). Se l'account
-- era stato sospeso dal job per scadenza, torna attivo; una sospensione
-- manuale resta.
create or replace function public.admin_extend_subscription(p_user_id uuid, p_mesi integer, p_motivo text, p_by uuid, p_by_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  a       public.abbonamenti%rowtype;
  v_da    date;
  v_nuova date;
  v_riattivato boolean := false;
begin
  if p_mesi is null or p_mesi < 1 or p_mesi > 60 then
    return jsonb_build_object('ok', false, 'error', 'mesi_non_validi');
  end if;
  select * into a from public.abbonamenti where user_id = p_user_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'nessun_abbonamento'); end if;
  v_da := greatest(coalesce(a.data_scadenza, v_today), v_today - 1);
  v_nuova := (v_da + make_interval(months => p_mesi))::date;

  update public.abbonamenti
     set data_scadenza = v_nuova, aggiornato_il = now(), aggiornato_da = p_by, aggiornato_da_email = p_by_email
   where user_id = p_user_id;
  insert into public.abbonamenti_storico (user_id, evento, piano_prima, piano_dopo, scadenza_prima, scadenza_dopo, mesi, note, eseguito_da, eseguito_da_email)
  values (p_user_id, 'prolungamento', a.piano, a.piano, a.data_scadenza, v_nuova, p_mesi, nullif(trim(p_motivo), ''), p_by, p_by_email);

  if exists (select 1 from public.account_stato s where s.user_id = p_user_id and s.stato = 'sospeso' and s.cambiato_da_email = 'cron:scadenze') then
    update public.account_stato set stato = 'attivo', motivo = null, cambiato_il = now(), cambiato_da = p_by, cambiato_da_email = p_by_email
     where user_id = p_user_id;
    v_riattivato := true;
    perform public.commerciale_audit(p_by, p_by_email, 'account_status_change', p_user_id,
      jsonb_build_object('prima', 'sospeso', 'dopo', public.account_stato_effettivo(p_user_id), 'motivo', 'Prolungamento dopo sospensione per scadenza'));
  end if;

  perform public.commerciale_sync_plan(p_user_id);
  perform public.commerciale_audit(p_by, p_by_email, 'subscription_extend', p_user_id, jsonb_build_object(
    'piano', a.piano, 'mesi', p_mesi, 'scadenza_prima', a.data_scadenza, 'scadenza_dopo', v_nuova,
    'riattivato', v_riattivato, 'motivo', nullif(trim(p_motivo), '')));
  return jsonb_build_object('ok', true, 'scadenza_prima', a.data_scadenza, 'scadenza_dopo', v_nuova, 'riattivato', v_riattivato);
end;
$$;

-- p_abilitato NULL = rimuove l'eccezione (torna a valere il piano).
create or replace function public.admin_set_module_exception(
  p_user_id uuid, p_modulo text, p_abilitato boolean, p_motivo text, p_scade_il date, p_by uuid, p_by_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  old public.moduli_eccezioni%rowtype;
  v_found boolean;
  v_prima boolean;
  v_dopo  boolean;
begin
  if not exists (select 1 from public.moduli where codice = p_modulo) then
    return jsonb_build_object('ok', false, 'error', 'modulo_non_valido');
  end if;
  if p_abilitato is not null and nullif(trim(p_motivo), '') is null then
    return jsonb_build_object('ok', false, 'error', 'motivo_obbligatorio');
  end if;
  if p_scade_il is not null and p_scade_il < (now() at time zone 'Europe/Rome')::date then
    return jsonb_build_object('ok', false, 'error', 'scadenza_nel_passato');
  end if;
  select * into old from public.moduli_eccezioni where user_id = p_user_id and modulo = p_modulo;
  v_found := found;
  v_prima := (select d.attivo from public.modulo_accesso_dettaglio(p_user_id, p_modulo) d);

  if p_abilitato is null then
    delete from public.moduli_eccezioni where user_id = p_user_id and modulo = p_modulo;
  else
    insert into public.moduli_eccezioni (user_id, modulo, abilitato, motivo, scade_il, creato_il, creato_da, creato_da_email)
    values (p_user_id, p_modulo, p_abilitato, trim(p_motivo), p_scade_il, now(), p_by, p_by_email)
    on conflict (user_id, modulo) do update
       set abilitato = excluded.abilitato, motivo = excluded.motivo, scade_il = excluded.scade_il,
           creato_il = now(), creato_da = excluded.creato_da, creato_da_email = excluded.creato_da_email;
  end if;
  v_dopo := (select d.attivo from public.modulo_accesso_dettaglio(p_user_id, p_modulo) d);

  perform public.commerciale_sync_plan(p_user_id);
  perform public.commerciale_audit(p_by, p_by_email, 'module_exception_change', p_user_id, jsonb_build_object(
    'modulo', p_modulo,
    'eccezione_prima', case when v_found then jsonb_build_object('abilitato', old.abilitato, 'scade_il', old.scade_il, 'motivo', old.motivo) end,
    'eccezione_dopo', case when p_abilitato is null then null else jsonb_build_object('abilitato', p_abilitato, 'scade_il', p_scade_il) end,
    'accesso_prima', v_prima, 'accesso_dopo', v_dopo,
    'motivo', nullif(trim(p_motivo), '')));
  return jsonb_build_object('ok', true, 'accesso_prima', v_prima, 'accesso_dopo', v_dopo);
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_subscription(uuid, text, date, date, boolean, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_extend_subscription(uuid, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_set_module_exception(uuid, text, boolean, text, date, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text, uuid, text) to service_role;
grant execute on function public.admin_set_subscription(uuid, text, date, date, boolean, text, text, uuid, text) to service_role;
grant execute on function public.admin_extend_subscription(uuid, integer, text, uuid, text) to service_role;
grant execute on function public.admin_set_module_exception(uuid, text, boolean, text, date, uuid, text) to service_role;

-- Abbonamento iniziale dei nuovi professionisti (sito e app). Chiamata da due
-- trigger: profiles (il ruolo diventa 'professional', anche dall'app che non
-- crea professional_profiles) e professional_profiles (la registrazione web
-- scrive trial_expires_at). Regole:
--   • trial di registrazione nel futuro → piano prova con quella scadenza
--   • altrimenti → piano base senza scadenza (mai 'pro': profiles.plan è
--     scrivibile dall'utente e non vale come prova di pagamento)
--   • un abbonamento già esistente non si tocca, salvo il base creato da
--     questo stesso trigger che diventa prova quando arriva il trial
create or replace function public.commerciale_abbonamento_iniziale(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a        public.abbonamenti%rowtype;
  v_trial  timestamptz;
  v_role   text;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then return; end if;
  select role into v_role from public.profiles where id = p_user_id;
  select trial_expires_at into v_trial from public.professional_profiles where id = p_user_id;
  if v_role is distinct from 'professional' and not exists (select 1 from public.professional_profiles where id = p_user_id) then
    return;
  end if;
  select * into a from public.abbonamenti where user_id = p_user_id;

  if not found then
    if v_trial is not null and v_trial > now() then
      insert into public.abbonamenti (user_id, piano, data_inizio, data_scadenza, note, aggiornato_da_email)
      values (p_user_id, 'prova', current_date, greatest(v_trial::date, current_date), 'Trial di registrazione', 'trigger:registrazione');
    else
      insert into public.abbonamenti (user_id, piano, data_inizio, aggiornato_da_email)
      values (p_user_id, 'base', current_date, 'trigger:registrazione');
    end if;
    insert into public.abbonamenti_storico (user_id, evento, piano_dopo, scadenza_dopo, note, eseguito_da_email)
    select x.user_id, 'creazione', x.piano, x.data_scadenza, 'Registrazione', 'trigger:registrazione' from public.abbonamenti x where x.user_id = p_user_id;
  elsif a.aggiornato_da_email = 'trigger:registrazione' and a.piano = 'base' and a.data_scadenza is null
        and v_trial is not null and v_trial > now() then
    update public.abbonamenti
       set piano = 'prova', data_scadenza = greatest(v_trial::date, current_date), note = 'Trial di registrazione', aggiornato_il = now()
     where user_id = p_user_id;
    insert into public.abbonamenti_storico (user_id, evento, piano_prima, piano_dopo, scadenza_dopo, note, eseguito_da_email)
    values (p_user_id, 'cambio_piano', 'base', 'prova', greatest(v_trial::date, current_date), 'Trial di registrazione', 'trigger:registrazione');
  else
    return;
  end if;
  perform public.commerciale_sync_plan(p_user_id);
end;
$$;
revoke all on function public.commerciale_abbonamento_iniziale(uuid) from public, anon, authenticated;

create or replace function public.tg_abbonamento_iniziale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.commerciale_abbonamento_iniziale(new.id);
  return new;
exception when others then
  raise warning 'tg_abbonamento_iniziale: % (registrazione non bloccata)', sqlerrm;
  return new;
end;
$$;
drop trigger if exists trg_abbonamento_da_professional_profile on public.professional_profiles;
drop function if exists public.tg_abbonamento_da_professional_profile();
drop trigger if exists trg_abbonamento_iniziale on public.professional_profiles;
create trigger trg_abbonamento_iniziale
  after insert or update of trial_expires_at on public.professional_profiles
  for each row execute function public.tg_abbonamento_iniziale();
drop trigger if exists trg_abbonamento_iniziale on public.profiles;
create trigger trg_abbonamento_iniziale
  after insert or update of role on public.profiles
  for each row when (new.role = 'professional')
  execute function public.tg_abbonamento_iniziale();

-- ── 7. Job giornaliero delle scadenze ──────────────────────────────────────
create or replace function public.commerciale_scadenze_giornaliere()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := (now() at time zone 'Europe/Rome')::date;
  r         record;
  v_mesi    integer;
  v_nuova   date;
  v_rinn    integer := 0;
  v_sosp    integer := 0;
begin
  for r in
    select a.* from public.abbonamenti a
     where a.data_scadenza is not null and a.data_scadenza < v_today
       and public.account_stato_effettivo(a.user_id) not in ('sospeso', 'bloccato')
       and not coalesce((select is_superadmin from public.profiles where id = a.user_id), false)
  loop
    begin
      if r.rinnovo_automatico then
        -- rinnova per la durata del periodo corrente (almeno 1 mese) finché la
        -- nuova scadenza non è nel futuro
        v_mesi := greatest(1, (extract(year from age(r.data_scadenza, r.data_inizio)) * 12
                               + extract(month from age(r.data_scadenza, r.data_inizio)))::int);
        v_nuova := r.data_scadenza;
        while v_nuova < v_today loop
          v_nuova := (v_nuova + make_interval(months => v_mesi))::date;
        end loop;
        update public.abbonamenti set data_scadenza = v_nuova, aggiornato_il = now(), aggiornato_da = null, aggiornato_da_email = 'cron:scadenze'
         where user_id = r.user_id;
        insert into public.abbonamenti_storico (user_id, evento, piano_prima, piano_dopo, scadenza_prima, scadenza_dopo, mesi, note, eseguito_da_email)
        values (r.user_id, 'rinnovo_automatico', r.piano, r.piano, r.data_scadenza, v_nuova, v_mesi, 'Rinnovo automatico alla scadenza', 'cron:scadenze');
        perform public.commerciale_audit(null, 'cron:scadenze', 'subscription_auto_renew', r.user_id,
          jsonb_build_object('piano', r.piano, 'scadenza_prima', r.data_scadenza, 'scadenza_dopo', v_nuova, 'mesi', v_mesi,
                             'motivo', 'rinnovo automatico attivo'));
        v_rinn := v_rinn + 1;
      else
        insert into public.account_stato (user_id, stato, motivo, cambiato_il, cambiato_da, cambiato_da_email)
        values (r.user_id, 'sospeso', 'Abbonamento ' || r.piano || ' scaduto il ' || to_char(r.data_scadenza, 'DD/MM/YYYY'), now(), null, 'cron:scadenze')
        on conflict (user_id) do update
           set stato = 'sospeso', motivo = excluded.motivo, cambiato_il = now(), cambiato_da = null, cambiato_da_email = 'cron:scadenze';
        insert into public.abbonamenti_storico (user_id, evento, piano_prima, piano_dopo, scadenza_prima, scadenza_dopo, note, eseguito_da_email)
        values (r.user_id, 'scadenza', r.piano, r.piano, r.data_scadenza, r.data_scadenza, 'Scaduto senza rinnovo automatico: account sospeso', 'cron:scadenze');
        perform public.commerciale_audit(null, 'cron:scadenze', 'account_status_change', r.user_id,
          jsonb_build_object('prima', case when r.piano = 'prova' then 'prova' else 'attivo' end, 'dopo', 'sospeso',
                             'motivo', 'Abbonamento ' || r.piano || ' scaduto il ' || to_char(r.data_scadenza, 'DD/MM/YYYY')));
        v_sosp := v_sosp + 1;
      end if;
      perform public.commerciale_sync_plan(r.user_id);
    exception when others then
      perform public.commerciale_audit(null, 'cron:scadenze', 'subscription_job_error', r.user_id, jsonb_build_object('errore', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('ok', true, 'data', v_today, 'rinnovati', v_rinn, 'sospesi', v_sosp);
end;
$$;
revoke all on function public.commerciale_scadenze_giornaliere() from public, anon, authenticated;
grant execute on function public.commerciale_scadenze_giornaliere() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'commerciale_scadenze_giornaliere';
    perform cron.schedule('commerciale_scadenze_giornaliere', '5 3 * * *', $job$ select public.commerciale_scadenze_giornaliere(); $job$);
  else
    raise notice 'pg_cron non abilitato: schedulare commerciale_scadenze_giornaliere() a mano';
  end if;
exception when others then
  raise notice 'cron commerciale_scadenze_giornaliere non schedulato: %', sqlerrm;
end $$;

-- ── 8. Scritture bloccate per account sospesi o bloccati ───────────────────
create or replace function public.account_puo_scrivere(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is null
      or not exists (select 1 from public.account_stato s where s.user_id = p_user_id and s.stato in ('sospeso', 'bloccato'));
$$;
revoke all on function public.account_puo_scrivere(uuid) from public, anon;
grant execute on function public.account_puo_scrivere(uuid) to authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array['clients', 'sessions', 'monitoring_sessions', 'sport_sessions'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists account_attivo_insert on public.%I', t);
    execute format('create policy account_attivo_insert on public.%I as restrictive for insert to authenticated with check (public.account_puo_scrivere(auth.uid()))', t);
    execute format('drop policy if exists account_attivo_update on public.%I', t);
    execute format('create policy account_attivo_update on public.%I as restrictive for update to authenticated using (public.account_puo_scrivere(auth.uid())) with check (public.account_puo_scrivere(auth.uid()))', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
