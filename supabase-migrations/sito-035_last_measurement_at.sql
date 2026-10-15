-- =============================================================================
-- sito-035: clients.last_measurement_at = inizio dell'ultima sessione
-- =============================================================================
-- Audit QA 14/10/2026, punto C5. **RICHIEDE IL VIA LIBERA DI MASSIMO** (cambia
-- un trigger e riscrive una colonna): non applicare senza averla letta.
--
-- Cosa fa
--   1. Salva lo stato attuale in `clients_last_measurement_backup_20261015`.
--   2. Riscrive `update_client_last_measurement()` (definita dall'app nella
--      app-040): il valore diventa max(coalesce(started_at_utc, started_at))
--      delle sessioni della scheda, non più `created_at` della riga appena
--      inserita (che è il momento del caricamento, da qui i +5 minuti e i
--      giorni di scarto quando l'app sincronizza in ritardo).
--   3. Il trigger scatta anche su DELETE e su UPDATE di client_id, started_at,
--      started_at_utc: una sessione cancellata o spostata ricalcola sia la
--      scheda vecchia sia quella nuova (caso Raffaele Vergari: 30/09 contro
--      sessione del 18/09 perché la sessione del 30/09 è stata cancellata).
--   4. Ricalcola tutte le schede che hanno almeno una sessione. Le schede senza
--      nessuna sessione propria e senza account collegato (`client_user_id`
--      nullo) tornano a NULL. Quelle con account collegato restano com'erano:
--      le loro misurazioni remote stanno in `sessions` di un altro utente e il
--      sito le unisce al volo (`dashboard-data.ts`, `listClientsEnriched`).
--
-- Come si annulla
--   UPDATE clients c SET last_measurement_at = b.last_measurement_at
--     FROM clients_last_measurement_backup_20261015 b WHERE b.id = c.id;
--   e si ripristina la funzione e il trigger della app-040 (AFTER INSERT,
--   `SET last_measurement_at = NEW.created_at`).
--
-- Idempotente: si può rilanciare.
-- =============================================================================

begin;

create table if not exists public.clients_last_measurement_backup_20261015 as
  select id, last_measurement_at, now() as salvato_il
  from public.clients
  where false;

insert into public.clients_last_measurement_backup_20261015 (id, last_measurement_at, salvato_il)
select id, last_measurement_at, now()
from public.clients
where not exists (select 1 from public.clients_last_measurement_backup_20261015);

-- Ricalcolo di una scheda. Resta NULL se la scheda non ha sessioni.
create or replace function public.clients_ricalcola_last_measurement(p_client_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_client_id is null or btrim(p_client_id) = '' then
    return;
  end if;
  update public.clients c
     set last_measurement_at = (
       select max(coalesce(s.started_at_utc, s.started_at))
       from public.sessions s
       where s.client_id = p_client_id
     )
   where c.id = p_client_id;
end;
$$;

revoke all on function public.clients_ricalcola_last_measurement(text) from public, anon, authenticated;

-- Trigger: non blocca mai la scrittura della sessione (regola app-040).
-- SECURITY DEFINER: il trigger gira come l'utente dell'app, che non ha (e non
-- deve avere) EXECUTE su clients_ricalcola_last_measurement. Senza DEFINER il
-- ricalcolo fallirebbe in silenzio a ogni sessione (correzione del 15/10).
create or replace function public.update_client_last_measurement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text;
begin
  begin
    if tg_op in ('INSERT', 'UPDATE') then
      perform public.clients_ricalcola_last_measurement(new.client_id);
    end if;
    if tg_op in ('UPDATE', 'DELETE') and old.client_id is distinct from
       (case when tg_op = 'DELETE' then null else new.client_id end) then
      perform public.clients_ricalcola_last_measurement(old.client_id);
    end if;
  exception when others then
    v_id := case when tg_op = 'DELETE' then old.id else new.id end;
    raise warning 'update_client_last_measurement: sessione %, ricalcolo non riuscito: % (%)', v_id, sqlerrm, sqlstate;
    perform public.trigger_errore_registra('trg_update_client_last_measurement', 'session', v_id::text, sqlstate, sqlerrm);
  end;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_update_client_last_measurement on public.sessions;
create trigger trg_update_client_last_measurement
  after insert or delete or update of client_id, started_at, started_at_utc
  on public.sessions
  for each row execute function public.update_client_last_measurement();

-- Ricalcolo di massa.
with ultime as (
  select client_id, max(coalesce(started_at_utc, started_at)) as ult
  from public.sessions
  where client_id is not null
  group by client_id
)
update public.clients c
   set last_measurement_at = u.ult
  from ultime u
 where u.client_id = c.id
   and c.last_measurement_at is distinct from u.ult;

update public.clients c
   set last_measurement_at = null
 where c.last_measurement_at is not null
   and c.client_user_id is null
   and not exists (select 1 from public.sessions s where s.client_id = c.id);

revoke all on function public.update_client_last_measurement() from public, anon, authenticated;

commit;

-- Verifica (dopo):
--   select count(*) from clients c
--   where last_measurement_at is distinct from
--     (select max(coalesce(started_at_utc, started_at)) from sessions s where s.client_id = c.id)
--     and exists (select 1 from sessions s where s.client_id = c.id);
--   -- atteso 0
