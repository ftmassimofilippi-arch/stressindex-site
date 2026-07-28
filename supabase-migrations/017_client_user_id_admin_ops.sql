-- =============================================================================
-- STRESS INDEX — 017: ponte esplicito cliente↔utente + operazioni admin
-- =============================================================================
--
-- Contenuto (in ordine di applicazione):
--   STEP 1 (applicare subito, idempotente):
--     1. clients.client_user_id uuid → FK a profiles(id), indice, backfill
--     2. Unicità (professionista_id, client_user_id) sui valorizzati
--     3. RPC bridge aggiornate: client_user_id via primaria, email fallback
--        (get_linked_client_sessions_by_client_id, get_linked_clients_last_remote_session)
--     4. Trigger tg_create_client_on_active_link aggiornato: valorizza
--        client_user_id (⚠️ da riportare anche nel repo hrv_app, vedi nota)
--     5. Tabella admin_audit_log (RLS: lettura solo superadmin)
--     6. RPC admin: admin_client_fk_refs, admin_merge_clients, admin_data_health
--        (eseguibili SOLO da service_role)
--   STEP 2 (applicare SOLO DOPO la pulizia dei duplicati, vedi preflight):
--     7. Unicità parziale (professionista_id, lower(trim(email)))
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PREFLIGHT (da eseguire PRIMA dello STEP 2): elenca i duplicati esistenti.
-- Se ritorna righe, uniscile con lo strumento "Unisci doppioni" del pannello
-- Super Admin (che usa admin_merge_clients dello STEP 1), poi applica STEP 2.
--
--   select c.professionista_id,
--          lower(trim(c.email))                          as email_norm,
--          count(*)                                      as righe,
--          array_agg(c.id order by c.created_at)         as client_ids,
--          array_agg(c.nome || ' ' || coalesce(c.cognome,'') order by c.created_at) as nomi
--   from public.clients c
--   where nullif(trim(c.email), '') is not null
--   group by c.professionista_id, lower(trim(c.email))
--   having count(*) > 1
--   order by count(*) desc;
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- STEP 1.1 — Colonna ponte + backfill
-- =============================================================================
-- Il ponte cliente↔utente oggi è implicito via email (fragile: email diverse o
-- assenti → scollegamento silenzioso). client_user_id lo rende esplicito.

alter table public.clients
  add column if not exists client_user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_clients_client_user_id
  on public.clients(client_user_id)
  where client_user_id is not null;

-- Backfill A — via client_professional_links (fonte più autoritativa: il link
-- porta già client_user_id; il match è su l.client_id = c.id).
-- Idempotente (solo righe con client_user_id null). Due DISTINCT ON:
--   • un solo candidato utente per riga clients (preferisci link active, poi recente)
--   • una sola riga clients per coppia (professionista, utente) → mai lo stesso
--     client_user_id su due righe clients dello stesso professionista
with link_cand as (
  select distinct on (l.client_id)
         l.client_id, l.client_user_id
  from public.client_professional_links l
  where l.client_user_id is not null
    and l.client_id is not null
  order by l.client_id, (l.status = 'active') desc, l.created_at desc
),
cand as (
  select distinct on (c.professionista_id, lc.client_user_id)
         c.id as crm_id, lc.client_user_id
  from public.clients c
  join link_cand lc on lc.client_id = c.id
  where c.client_user_id is null
  order by c.professionista_id, lc.client_user_id, c.created_at asc nulls last
)
update public.clients c
set client_user_id = cand.client_user_id
from cand
where c.id = cand.crm_id
  and not exists (
    select 1 from public.clients c2
    where c2.professionista_id = c.professionista_id
      and c2.client_user_id = cand.client_user_id
      and c2.id <> c.id
  );

-- Backfill B — via email, MA solo se esiste un link (di qualunque stato) fra
-- quel professionista e quell'utente: l'identità si materializza solo dove
-- esiste una relazione, evitando agganci accidentali fra omonimi di email.
-- Copre i link con client_id null che il Backfill A non può matchare.
with email_cand as (
  select distinct on (c.professionista_id, p.id)
         c.id as crm_id, p.id as user_id
  from public.clients c
  join public.profiles p
    on lower(trim(p.email)) = lower(trim(c.email))
  join public.client_professional_links l
    on l.client_user_id = p.id
   and l.professional_id = c.professionista_id
  where c.client_user_id is null
    and nullif(trim(c.email), '') is not null
  order by c.professionista_id, p.id, c.created_at asc nulls last
)
update public.clients c
set client_user_id = email_cand.user_id
from email_cand
where c.id = email_cand.crm_id
  and not exists (
    select 1 from public.clients c2
    where c2.professionista_id = c.professionista_id
      and c2.client_user_id = email_cand.user_id
      and c2.id <> c.id
  );

-- =============================================================================
-- STEP 1.2 — Unicità (professionista_id, client_user_id)
-- =============================================================================
-- La colonna è nuova e il backfill sopra garantisce l'assenza di duplicati,
-- quindi questo indice non può fallire ora. Da qui in poi impedisce che lo
-- stesso utente venga agganciato a due anagrafiche dello stesso professionista.
create unique index if not exists uq_clients_prof_client_user
  on public.clients (professionista_id, client_user_id)
  where client_user_id is not null;

-- =============================================================================
-- STEP 1.3 — RPC bridge: client_user_id via primaria, email fallback
-- =============================================================================
-- Stessa semantica di prima; cambia solo il ponte profiles↔clients:
--   1. c.client_user_id = p.id                  → ponte esplicito (nuovo)
--   2. fallback SOLO se client_user_id è null:  → email o id (storico)

create or replace function public.get_linked_client_sessions_by_client_id(
  p_client_id text
)
returns setof public.sessions
language sql
security definer
set search_path = public
stable
as $BODY$
  select s.*
  from public.clients c
  join public.client_professional_links l
    on l.professional_id = auth.uid()
   and l.status = 'active'
  join public.profiles p
    on p.id = l.client_user_id
   and (
     c.client_user_id = p.id                                  -- ponte esplicito
     or (c.client_user_id is null
         and (lower(p.email) = lower(c.email) or c.id = p.id::text))  -- fallback storico
   )
  join public.sessions s
    on s.professionista_id = p.id
   and s.client_id is null
  where c.id = p_client_id
    and c.professionista_id = auth.uid()
  order by s.started_at desc;
$BODY$;

grant execute on function public.get_linked_client_sessions_by_client_id(text)
  to authenticated;

create or replace function public.get_linked_clients_last_remote_session()
returns table (
  client_id        text,
  last_remote_at   timestamptz,
  remote_count     bigint
)
language sql
security definer
set search_path = public
stable
as $BODY$
  select
    c.id                                        as client_id,
    max(coalesce(s.started_at, s.created_at))   as last_remote_at,
    count(s.id)                                 as remote_count
  from public.clients c
  join public.client_professional_links l
    on l.professional_id = auth.uid()
   and l.status = 'active'
  join public.profiles p
    on p.id = l.client_user_id
   and (
     c.client_user_id = p.id                                  -- ponte esplicito
     or (c.client_user_id is null
         and (lower(p.email) = lower(c.email) or c.id = p.id::text))  -- fallback storico
   )
  join public.sessions s
    on s.professionista_id = p.id
   and s.client_id is null
  where c.professionista_id = auth.uid()
  group by c.id;
$BODY$;

grant execute on function public.get_linked_clients_last_remote_session()
  to authenticated;

-- =============================================================================
-- STEP 1.4 — Trigger CRM autocreate: valorizza client_user_id
-- =============================================================================
-- ⚠️ Questa funzione è definita anche in hrv_app/supabase/migrations/
-- client_crm_autocreate_on_link.sql: dopo l'applicazione, allineare ANCHE quel
-- file, altrimenti una futura riapplicazione dal repo app la riporterebbe
-- alla versione senza client_user_id.
--
-- Differenze dalla versione precedente:
--   • nuovo primo branch: se esiste già una riga CRM con questo client_user_id
--     sotto questo professionista → solo backfill anagrafica, nessun doppione
--   • il dedup per email ora valorizza anche client_user_id sulla riga matchata
--   • il dedup per nome (email assente) valorizza client_user_id sulla riga matchata
--   • l'INSERT della nuova riga include client_user_id

create or replace function public.tg_create_client_on_active_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_nome       text;
  v_cognome    text;
  v_email      text;
  v_email_norm text;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  select p.nome, p.cognome, p.email
    into v_nome, v_cognome, v_email
    from public.profiles p
   where p.id = new.client_user_id;

  v_email_norm := nullif(lower(trim(v_email)), '');

  -- 0. Ponte esplicito già presente: la riga CRM esiste, backfill anagrafica.
  if exists (
    select 1 from public.clients c
     where c.professionista_id = new.professional_id
       and c.client_user_id = new.client_user_id
  ) then
    update public.clients c
       set nome    = case when coalesce(trim(c.nome), '') = ''
                          then coalesce(nullif(trim(v_nome), ''), c.nome)
                          else c.nome end,
           cognome = case when coalesce(trim(c.cognome), '') = ''
                          then coalesce(nullif(trim(v_cognome), ''), c.cognome)
                          else c.cognome end,
           email   = coalesce(nullif(trim(c.email), ''), v_email_norm)
     where c.professionista_id = new.professional_id
       and c.client_user_id = new.client_user_id;
    return new;
  end if;

  -- 1. Dedup per email: aggancia la riga CRM pre-registrata e rendi esplicito
  --    il ponte (client_user_id) che finora era solo via email.
  if v_email_norm is not null and exists (
    select 1 from public.clients c
     where c.professionista_id = new.professional_id
       and lower(trim(c.email)) = v_email_norm
  ) then
    update public.clients c
       set client_user_id = coalesce(c.client_user_id, new.client_user_id),
           nome    = case when coalesce(trim(c.nome), '') = ''
                          then coalesce(nullif(trim(v_nome), ''), c.nome)
                          else c.nome end,
           cognome = case when coalesce(trim(c.cognome), '') = ''
                          then coalesce(nullif(trim(v_cognome), ''), c.cognome)
                          else c.cognome end
     where c.professionista_id = new.professional_id
       and lower(trim(c.email)) = v_email_norm;
    return new;
  end if;

  -- 2. Email assente: dedup per nome, rendendo esplicito il ponte sulla riga
  --    matchata (prima si limitava a non creare il doppione).
  if v_email_norm is null and exists (
    select 1 from public.clients c
     where c.professionista_id = new.professional_id
       and lower(trim(coalesce(c.nome, '')))    = lower(trim(coalesce(v_nome, '')))
       and lower(trim(coalesce(c.cognome, ''))) = lower(trim(coalesce(v_cognome, '')))
       and coalesce(trim(c.email), '') = ''
  ) then
    update public.clients c
       set client_user_id = coalesce(c.client_user_id, new.client_user_id)
     where c.professionista_id = new.professional_id
       and lower(trim(coalesce(c.nome, '')))    = lower(trim(coalesce(v_nome, '')))
       and lower(trim(coalesce(c.cognome, ''))) = lower(trim(coalesce(v_cognome, '')))
       and coalesce(trim(c.email), '') = ''
       and c.client_user_id is null;
    return new;
  end if;

  -- 3. Nuova riga CRM, con ponte esplicito fin dalla nascita.
  insert into public.clients (id, professionista_id, nome, cognome, email, client_user_id, created_at)
  values (
    (extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    new.professional_id,
    coalesce(nullif(trim(v_nome), ''), 'Cliente'),
    coalesce(nullif(trim(v_cognome), ''), ''),
    v_email_norm,
    new.client_user_id,
    now()
  );

  return new;
end;
$BODY$;

-- Il trigger esistente punta già a questa funzione (CREATE OR REPLACE):
-- nessun DROP/CREATE TRIGGER necessario.

-- =============================================================================
-- STEP 1.5 — Tabella di audit delle operazioni admin
-- =============================================================================
-- Scrivono SOLO le API routes del sito via service_role (bypassa la RLS).
-- La RLS consente la lettura al solo superadmin; nessuna policy di INSERT:
-- gli utenti normali non possono né leggere né scrivere.

create table if not exists public.admin_audit_log (
  id                 uuid primary key default gen_random_uuid(),
  performed_by       uuid not null,
  performed_by_email text,
  action             text not null,   -- es. 'change_role' | 'create_link' | 'merge_clients'
  target_type        text not null,   -- es. 'user' | 'link' | 'client'
  target_id          text,
  details            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_superadmin_read" on public.admin_audit_log;
create policy "admin_audit_superadmin_read" on public.admin_audit_log
  for select using (public.is_superadmin());

create index if not exists idx_admin_audit_created_at
  on public.admin_audit_log (created_at desc);

-- =============================================================================
-- STEP 1.6 — RPC amministrative (SOLO service_role)
-- =============================================================================

-- ── admin_client_fk_refs: elenco DINAMICO delle tabelle che referenziano
--    clients(id) via foreign key. Il tool di merge lo usa al posto di una
--    lista cablata: una FK aggiunta in futuro viene coperta automaticamente.
create or replace function public.admin_client_fk_refs()
returns table (ref_table text, ref_column text)
language sql
stable
security definer
set search_path = public
as $BODY$
  select distinct
    rel.relname::text  as ref_table,
    att.attname::text  as ref_column
  from pg_constraint con
  join pg_class rel        on rel.oid  = con.conrelid
  join pg_namespace nsp    on nsp.oid  = rel.relnamespace
  join pg_class frel       on frel.oid = con.confrelid
  join pg_namespace fnsp   on fnsp.oid = frel.relnamespace
  join lateral unnest(con.conkey) as ck(attnum) on true
  join pg_attribute att    on att.attrelid = con.conrelid and att.attnum = ck.attnum
  where con.contype = 'f'
    and fnsp.nspname = 'public'
    and frel.relname = 'clients'
    and nsp.nspname  = 'public';
$BODY$;

revoke all on function public.admin_client_fk_refs() from public, anon, authenticated;
grant execute on function public.admin_client_fk_refs() to service_role;

-- ── admin_merge_clients: unione doppioni in UNA transazione.
--    Sposta tutti i riferimenti dalle righe p_merge_ids alla riga p_keep_id e
--    solo alla fine cancella le righe unite. Tabelle coinvolte:
--      • tutte quelle con FK reale verso clients(id) (dinamico, vedi sopra)
--      • measurement_analytics.client_id e client_professional_links.client_id,
--        aggiunte esplicitamente SE esistono e non hanno FK (riferimenti "soft"
--        che una scansione FK non vede ma che diventerebbero orfani)
--    Conflitti di unicità (es. client_settings con una riga per cliente, link
--    duplicato per la stessa coppia): la riga della anagrafica DA UNIRE viene
--    ELIMINATA (non spostata) quando la riga da tenere ne ha già una
--    equivalente (vince keep). Ogni eliminazione è tracciata:
--      • nel dry run: conteggio 'conflict_deleted' per tabella, SEPARATO da
--        'moved', così si vede PRIMA di confermare cosa andrebbe perso
--      • all'esecuzione: snapshot jsonb completo delle righe eliminate in
--        admin_audit_log (action='merge_conflict_delete', una riga per tabella,
--        details.rows = righe intere → ricostruibili a posteriori) e nel
--        campo 'conflicts' del risultato
--    p_performed_by/p_performed_by_email: l'admin che esegue (per l'audit;
--    la RPC gira come service_role quindi auth.uid() è null).
--    p_dry_run = true → solo conteggi per tabella, nessuna modifica.
drop function if exists public.admin_merge_clients(text, text[], boolean);

create or replace function public.admin_merge_clients(
  p_keep_id            text,
  p_merge_ids          text[],
  p_dry_run            boolean default true,
  p_performed_by       uuid    default null,
  p_performed_by_email text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_keep      public.clients%rowtype;
  v_merge     public.clients%rowtype;
  r           record;
  u           record;
  v_cnt       bigint;
  v_conf_cnt  bigint;
  v_moved     bigint;
  v_deleted   bigint;
  v_tables    jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_rows      jsonb;
  v_match     text;
  v_col       text;
  v_preds     text[];
  v_m_user    uuid;
  v_m_email   text;
  v_m_tel     text;
  v_actor     uuid;
begin
  if p_keep_id is null or p_merge_ids is null or array_length(p_merge_ids, 1) is null then
    raise exception 'parametri mancanti (keep_id / merge_ids)';
  end if;
  if p_keep_id = any(p_merge_ids) then
    raise exception 'la riga da tenere non può essere anche tra quelle da unire';
  end if;

  select * into v_keep from public.clients where id = p_keep_id;
  if not found then
    raise exception 'cliente da tenere non trovato: %', p_keep_id;
  end if;

  foreach v_col in array p_merge_ids loop
    select * into v_merge from public.clients where id = v_col;
    if not found then
      raise exception 'cliente da unire non trovato: %', v_col;
    end if;
    if v_merge.professionista_id is distinct from v_keep.professionista_id then
      raise exception 'il cliente % appartiene a un altro professionista: sposta prima la riga, poi unisci', v_col;
    end if;
  end loop;

  -- Tabelle da processare: FK reali + riferimenti soft noti (se esistono).
  for r in
    with fk as (
      select f.ref_table, f.ref_column from public.admin_client_fk_refs() f
    ),
    extra as (
      select t.tbl as ref_table, t.col as ref_column
      from (values
        ('measurement_analytics',     'client_id'),
        ('client_professional_links', 'client_id')
      ) as t(tbl, col)
      where exists (
        select 1 from information_schema.columns ic
        where ic.table_schema = 'public' and ic.table_name = t.tbl and ic.column_name = t.col
      )
      and not exists (select 1 from fk where fk.ref_table = t.tbl and fk.ref_column = t.col)
    )
    select * from fk union all select * from extra
  loop
    execute format('select count(*) from public.%I where %I = any($1)', r.ref_table, r.ref_column)
      into v_cnt using p_merge_ids;

    -- Predicato di conflitto: OR degli indici UNIQUE che includono la colonna
    -- cliente. Una riga "da unire" è in conflitto se la keep ne ha già una
    -- equivalente (match null-safe sulle altre colonne dell'indice).
    v_preds := null;
    if v_cnt > 0 then
      for u in
        select array_agg(a.attname::text order by k.ord)
                 filter (where a.attname::text <> r.ref_column) as other_cols
        from pg_index i
        join pg_class c  on c.oid = i.indrelid
        join pg_namespace n on n.oid = c.relnamespace
        join lateral unnest(i.indkey::int2[]) with ordinality as k(attnum, ord) on true
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where n.nspname = 'public'
          and c.relname = r.ref_table
          and i.indisunique
          and exists (
            select 1 from pg_attribute a2
            join lateral unnest(i.indkey::int2[]) k2(attnum) on a2.attnum = k2.attnum
            where a2.attrelid = i.indrelid and a2.attname::text = r.ref_column
          )
        group by i.indexrelid
      loop
        if u.other_cols is null then
          -- unique sulla sola colonna cliente (una riga per cliente, es. settings)
          v_preds := coalesce(v_preds, '{}'::text[]) || format(
            'exists (select 1 from public.%I k where k.%I = $1)',
            r.ref_table, r.ref_column
          );
        else
          select string_agg(format('k.%I is not distinct from m.%I', col, col), ' and ')
            into v_match
            from unnest(u.other_cols) as col;
          v_preds := coalesce(v_preds, '{}'::text[]) || format(
            'exists (select 1 from public.%I k where k.%I = $1 and %s)',
            r.ref_table, r.ref_column, v_match
          );
        end if;
      end loop;
    end if;

    -- Conteggio conflitti (righe che verrebbero ELIMINATE, non spostate).
    v_conf_cnt := 0;
    if v_cnt > 0 and v_preds is not null then
      execute format(
        'select count(*) from public.%I m where m.%I = any($2) and (%s)',
        r.ref_table, r.ref_column, array_to_string(v_preds, ' or ')
      ) into v_conf_cnt using p_keep_id, p_merge_ids;
    end if;

    if p_dry_run or v_cnt = 0 then
      v_tables := v_tables || jsonb_build_object(
        'table', r.ref_table, 'column', r.ref_column,
        'rows', v_cnt, 'moved', v_cnt - v_conf_cnt, 'conflict_deleted', v_conf_cnt
      );
      continue;
    end if;

    -- Esecuzione: snapshot completo delle righe in conflitto PRIMA di
    -- eliminarle (→ audit, ricostruibili), poi delete e spostamento.
    if v_conf_cnt > 0 then
      execute format(
        'select jsonb_agg(to_jsonb(m)) from public.%I m where m.%I = any($2) and (%s)',
        r.ref_table, r.ref_column, array_to_string(v_preds, ' or ')
      ) into v_rows using p_keep_id, p_merge_ids;
      execute format(
        'delete from public.%I m where m.%I = any($2) and (%s)',
        r.ref_table, r.ref_column, array_to_string(v_preds, ' or ')
      ) using p_keep_id, p_merge_ids;
      v_conflicts := v_conflicts || jsonb_build_object(
        'table', r.ref_table, 'column', r.ref_column,
        'reason', 'unique_conflict',
        'rows_deleted', v_conf_cnt,
        'rows', coalesce(v_rows, '[]'::jsonb)
      );
    end if;

    execute format('update public.%I set %I = $1 where %I = any($2)',
                   r.ref_table, r.ref_column, r.ref_column)
      using p_keep_id, p_merge_ids;
    get diagnostics v_moved = row_count;

    v_tables := v_tables || jsonb_build_object(
      'table', r.ref_table, 'column', r.ref_column,
      'rows', v_cnt, 'moved', v_moved, 'conflict_deleted', v_conf_cnt
    );
  end loop;

  if p_dry_run then
    return jsonb_build_object('dry_run', true, 'keep_id', p_keep_id,
                              'merge_ids', to_jsonb(p_merge_ids), 'tables', v_tables);
  end if;

  -- Audit delle eliminazioni per conflitto: una riga admin_audit_log per
  -- tabella coinvolta, con lo snapshot COMPLETO delle righe eliminate
  -- (details.rows) — tabella, id e motivo inclusi, ricostruibili a mano.
  if jsonb_array_length(v_conflicts) > 0 then
    v_actor := coalesce(p_performed_by, auth.uid());
    if v_actor is not null then
      insert into public.admin_audit_log
        (performed_by, performed_by_email, action, target_type, target_id, details)
      select
        v_actor,
        p_performed_by_email,
        'merge_conflict_delete',
        'client',
        p_keep_id,
        jsonb_build_object(
          'merge_ids', to_jsonb(p_merge_ids),
          'table', e->>'table',
          'column', e->>'column',
          'reason', e->>'reason',
          'rows_deleted', e->'rows_deleted',
          'rows', e->'rows'
        )
      from jsonb_array_elements(v_conflicts) as e;
    end if;
  end if;

  -- Leggi PRIMA i dati utili delle righe da unire (dopo il DELETE non ci sono
  -- più), ma applica l'arricchimento sulla keep solo DOPO il DELETE: farlo
  -- prima violerebbe uq_clients_prof_client_user (stesso client_user_id
  -- momentaneamente su keep e su una riga da unire).
  select max(client_user_id::text)::uuid,
         max(nullif(trim(email), '')),
         max(nullif(trim(telefono), ''))
    into v_m_user, v_m_email, v_m_tel
    from public.clients
   where id = any(p_merge_ids);

  -- Con tutti i riferimenti spostati, elimina le righe unite.
  delete from public.clients where id = any(p_merge_ids);
  get diagnostics v_deleted = row_count;

  -- Arricchisci la riga keep con i dati mancanti presi dalle righe unite.
  update public.clients k
  set client_user_id = coalesce(k.client_user_id, v_m_user),
      email          = coalesce(nullif(trim(k.email), ''), v_m_email),
      telefono       = coalesce(nullif(trim(k.telefono), ''), v_m_tel)
  where k.id = p_keep_id;

  return jsonb_build_object('dry_run', false, 'keep_id', p_keep_id,
                            'merge_ids', to_jsonb(p_merge_ids), 'tables', v_tables,
                            'conflicts', v_conflicts,
                            'deleted_clients', v_deleted);
end;
$BODY$;

revoke all on function public.admin_merge_clients(text, text[], boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_merge_clients(text, text[], boolean, uuid, text) to service_role;

-- ── admin_data_health: tutti gli indicatori di salute dati in UNA chiamata.
--    Ogni sezione: { count, items[] } con items limitati a 100 righe (il count
--    resta totale). plpgsql così la sezione app_versions può gestire l'assenza
--    delle colonne app_version/platform/last_seen_at (arrivano dal lavoro
--    parallelo sull'app Flutter) senza far fallire né la CREATE né la chiamata.
create or replace function public.admin_data_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $BODY$
declare
  v jsonb := '{}'::jsonb;
  v_sec jsonb;
begin
  -- 1. Clienti con link attivo ma nessuna misurazione visibile al professionista.
  --    reason = 'no_crm_match'    → il link attivo non aggancia NESSUNA riga clients
  --                                 (ponte rotto: email diverse e client_user_id nullo)
  --    reason = 'no_measurements' → riga agganciata ma zero sessioni (dirette+remote)
  with active_links as (
    select l.id as link_id, l.professional_id, l.client_user_id,
           p.email as user_email, p.nome as user_nome, p.cognome as user_cognome
    from public.client_professional_links l
    join public.profiles p on p.id = l.client_user_id
    where l.status = 'active'
  ),
  bridged as (
    select al.*, c.id as crm_id, c.nome as crm_nome, c.cognome as crm_cognome
    from active_links al
    left join public.clients c
      on c.professionista_id = al.professional_id
     and (
       c.client_user_id = al.client_user_id
       or (c.client_user_id is null
           and (lower(coalesce(c.email,'')) = lower(coalesce(al.user_email,''))
                or c.id = al.client_user_id::text))
     )
  ),
  problems as (
    select b.link_id, b.professional_id, b.client_user_id, b.user_email,
           coalesce(nullif(trim(coalesce(b.crm_nome,'') || ' ' || coalesce(b.crm_cognome,'')), ''),
                    nullif(trim(coalesce(b.user_nome,'') || ' ' || coalesce(b.user_cognome,'')), ''),
                    b.user_email, '—') as display_name,
           coalesce(nullif(trim(coalesce(pp.nome,'') || ' ' || coalesce(pp.cognome,'')), ''),
                    prf.email, '—') as professional_name,
           b.crm_id,
           case
             when b.crm_id is null then 'no_crm_match'
             when not exists (select 1 from public.sessions s where s.client_id = b.crm_id)
              and not exists (select 1 from public.sessions s
                              where s.professionista_id = b.client_user_id and s.client_id is null)
             then 'no_measurements'
           end as reason
    from bridged b
    left join public.professional_profiles pp on pp.id = b.professional_id
    left join public.profiles prf on prf.id = b.professional_id
  )
  select jsonb_build_object(
    'count', count(*),
    'items', coalesce(jsonb_agg(to_jsonb(pr) order by pr.reason) filter (where rn <= 100), '[]'::jsonb)
  ) into v_sec
  from (select p.*, row_number() over (order by p.reason) as rn
        from problems p where p.reason is not null) pr;
  v := v || jsonb_build_object('linked_clients_no_data', v_sec);

  -- 2. Misurazioni orfane: sessioni self (client_id null) di utenti NON
  --    professionisti senza alcun link attivo → non visibili a nessuno.
  with orphan as (
    select s.professionista_id as user_id,
           count(*) as sessions_count,
           max(coalesce(s.started_at, s.created_at)) as last_at
    from public.sessions s
    where s.client_id is null
      and exists (select 1 from public.profiles p
                  where p.id = s.professionista_id and p.role is distinct from 'professional')
      and not exists (select 1 from public.client_professional_links l
                      where l.client_user_id = s.professionista_id and l.status = 'active')
    group by s.professionista_id
  )
  select jsonb_build_object(
    'count', count(*),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'user_id', o.user_id, 'email', p.email,
      'name', nullif(trim(coalesce(p.nome,'') || ' ' || coalesce(p.cognome,'')), ''),
      'sessions_count', o.sessions_count, 'last_at', o.last_at
    ) order by o.last_at desc) filter (where o.rn <= 100), '[]'::jsonb)
  ) into v_sec
  from (select *, row_number() over (order by last_at desc) as rn from orphan) o
  left join public.profiles p on p.id = o.user_id;
  v := v || jsonb_build_object('orphan_remote_sessions', v_sec);

  -- 3. Anagrafiche duplicate: stessa email sotto lo stesso professionista.
  with dup as (
    select c.professionista_id, lower(trim(c.email)) as email_norm,
           count(*) as rows_count,
           jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'cognome', c.cognome,
                                        'created_at', c.created_at, 'client_user_id', c.client_user_id)
                     order by c.created_at) as rows
    from public.clients c
    where nullif(trim(c.email), '') is not null
    group by c.professionista_id, lower(trim(c.email))
    having count(*) > 1
  )
  select jsonb_build_object(
    'count', count(*),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'professionista_id', d.professionista_id, 'professional_name',
        coalesce(nullif(trim(coalesce(pp.nome,'') || ' ' || coalesce(pp.cognome,'')), ''), pr.email, '—'),
      'email', d.email_norm, 'rows_count', d.rows_count, 'rows', d.rows
    ) order by d.rows_count desc) filter (where d.rn <= 100), '[]'::jsonb)
  ) into v_sec
  from (select *, row_number() over (order by rows_count desc) as rn from dup) d
  left join public.professional_profiles pp on pp.id = d.professionista_id
  left join public.profiles pr on pr.id = d.professionista_id;
  v := v || jsonb_build_object('duplicate_clients', v_sec);

  -- 4. Anagrafiche senza email E senza ponte esplicito: nessuna via per
  --    agganciare misurazioni remote → cliente isolato.
  with noemail as (
    select c.id, c.nome, c.cognome, c.professionista_id, c.created_at
    from public.clients c
    where nullif(trim(c.email), '') is null
      and c.client_user_id is null
  )
  select jsonb_build_object(
    'count', count(*),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'name', nullif(trim(coalesce(n.nome,'') || ' ' || coalesce(n.cognome,'')), ''),
      'professional_name',
        coalesce(nullif(trim(coalesce(pp.nome,'') || ' ' || coalesce(pp.cognome,'')), ''), pr.email, '—'),
      'created_at', n.created_at
    ) order by n.created_at desc) filter (where n.rn <= 100), '[]'::jsonb)
  ) into v_sec
  from (select *, row_number() over (order by created_at desc) as rn from noemail) n
  left join public.professional_profiles pp on pp.id = n.professionista_id
  left join public.profiles pr on pr.id = n.professionista_id;
  v := v || jsonb_build_object('clients_no_email', v_sec);

  -- 5. Versioni app installate (colonne in arrivo dal lavoro Flutter:
  --    se non esistono ancora → available:false, nessun errore).
  begin
    execute $q$
      select jsonb_build_object(
        'available', true,
        'items', coalesce(jsonb_agg(jsonb_build_object(
          'app_version', app_version, 'platform', platform,
          'users_count', users_count, 'last_seen_at', last_seen_at
        ) order by last_seen_at desc nulls last), '[]'::jsonb)
      )
      from (
        select coalesce(app_version, 'sconosciuta') as app_version,
               coalesce(platform, '—') as platform,
               count(*) as users_count,
               max(last_seen_at) as last_seen_at
        from public.profiles
        group by 1, 2
      ) g
    $q$ into v_sec;
  exception when undefined_column then
    v_sec := jsonb_build_object('available', false, 'items', '[]'::jsonb);
  end;
  v := v || jsonb_build_object('app_versions', v_sec);

  -- 6. Richieste di collegamento pending da più di 7 giorni.
  with stale as (
    select l.id, l.created_at, l.client_user_id, l.professional_id,
           p.email as client_email,
           nullif(trim(coalesce(p.nome,'') || ' ' || coalesce(p.cognome,'')), '') as client_name
    from public.client_professional_links l
    left join public.profiles p on p.id = l.client_user_id
    where l.status = 'pending'
      and l.created_at < now() - interval '7 days'
  )
  select jsonb_build_object(
    'count', count(*),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'link_id', s.id, 'created_at', s.created_at,
      'client_name', s.client_name, 'client_email', s.client_email,
      'professional_name',
        coalesce(nullif(trim(coalesce(pp.nome,'') || ' ' || coalesce(pp.cognome,'')), ''), pr.email, '—')
    ) order by s.created_at asc) filter (where s.rn <= 100), '[]'::jsonb)
  ) into v_sec
  from (select *, row_number() over (order by created_at asc) as rn from stale) s
  left join public.professional_profiles pp on pp.id = s.professional_id
  left join public.profiles pr on pr.id = s.professional_id;
  v := v || jsonb_build_object('stale_pending_links', v_sec);

  return v || jsonb_build_object('generated_at', now());
end;
$BODY$;

revoke all on function public.admin_data_health() from public, anon, authenticated;
grant execute on function public.admin_data_health() to service_role;

notify pgrst, 'reload schema';

-- =============================================================================
-- STEP 2 — DA APPLICARE SOLO DOPO LA PULIZIA DEI DUPLICATI (vedi preflight)
-- =============================================================================
-- Impedisce la nascita di nuove anagrafiche duplicate per la stessa persona
-- sotto lo stesso professionista. FALLISCE se esistono ancora duplicati:
-- esegui prima il preflight in testa al file e unisci i doppioni dal pannello.
--
-- create unique index if not exists uq_clients_prof_email
--   on public.clients (professionista_id, lower(trim(email)))
--   where nullif(trim(email), '') is not null;
--
-- notify pgrst, 'reload schema';
