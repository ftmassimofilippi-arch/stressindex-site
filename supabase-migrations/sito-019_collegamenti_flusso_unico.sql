-- =============================================================================
-- STRESS INDEX — 019: collegamento cliente↔professionista, flusso unico
-- =============================================================================
--
-- UN SOLO punto di verità, lato database, per creare o riattivare il
-- collegamento fra un utente con account (profiles) e un professionista, e per
-- trovare o creare la scheda CRM (clients) con il ponte esplicito
-- clients.client_user_id. App, sito, Edge Function e trigger passano tutti da
-- qui: nessuno scrive più direttamente clients.client_user_id o inserisce link
-- "a mano" (vedi docs/COLLEGAMENTI_AUDIT.md, FASE 4).
--
-- Contenuto (idempotente, riapplicabile):
--   1. clients.merged_into_client_id + tabella clients_merge_log
--   2. collegamenti_merge_card(): unione di una scheda in un'altra SENZA
--      cancellare (la scheda unita resta, archiviata e nascosta dalla RLS)
--   3. link_client_to_professional(p_client_user_id, p_professional_id, p_source)
--   4. ensure_client_bridge(p_email) + trigger su profiles (after insert /
--      update of email)
--   5. tg_create_client_on_active_link riscritto: delega a (3); se l'aggancio
--      non riesce NON blocca il link (raise warning + riga in admin_audit_log
--      'link_trigger_failed'): il link resta e la vista salute lo segnala
--      come link_senza_scheda
--   6. client_can_assign_session (RLS sessioni del client) usa il ponte
--   7. RPC di lettura: escludono le schede archiviate
--   8. get_linked_clients_last_remote_analytics(): ultima misurazione remota
--      (con score) per la lista clienti del sito
--   9. policy RESTRICTIVE "clients_hide_merged": le schede unite non si vedono
--      più da app e sito con la sessione utente (la service role le vede)
--  10. le DUE colonne dei link: link_client_to_professional scrive sempre
--      client_id = client_user_id (client_id è la colonna legacy uuid con
--      l'utente; l'unico indice univoco oggi in produzione è su
--      (client_id, professional_id)); le policy RLS
--      professional_reads_linked_client_sessions / _analytics, che oggi
--      controllano solo cpl.client_id, vengono riscritte su
--      coalesce(cpl.client_user_id, cpl.client_id)
--  11. get_linked_client_monitoring_sessions_by_client_id allineata alla
--      logica di get_linked_client_sessions_by_client_id (ponte esplicito,
--      poi fallback email/id, schede archiviate escluse)
--
-- Adattata all'output reale del catalogo (docs/COLLEGAMENTI_AUDIT.md §1.2-1.4):
--   • il trigger in produzione è quello di client_crm_autocreate_on_link.sql
--     (passo 0 ponte, passo 1 UPDATE per email SENZA limite su tutte le
--     schede, passo 2 dedup per nome, passo 3 insert epoch, nessun EXCEPTION):
--     è la causa del caso Sara. Qui i passi 0 e 2 sono conservati dentro
--     link_client_to_professional (rami a e c), il passo 1 sceglie UNA scheda
--     in modo deterministico (ramo b) e tutto è avvolto in EXCEPTION WHEN
--     OTHERS con log in admin_audit_log;
--   • uq_client_professional_active NON esiste: lo crea la 022 dopo la dedup;
--   • admin_merge_clients e admin_audit_log esistono già (017) e vengono
--     riusate dalla 022; collegamenti_merge_card resta per il pannello
--     (unione morbida) e per i doppioni trovati durante un collegamento.
--
-- Il file hrv_app/supabase/migrations/client_crm_autocreate_on_link.sql è
-- stato svuotato (commit 2453baf dell'app, 12/09/2026) e rimanda a questa
-- migrazione: il vecchio corpo resta consultabile con
--   git show 474b0e3:supabase/migrations/client_crm_autocreate_on_link.sql
-- Riprodotto su copia locale dei dati di produzione (audit §2.12): con due
-- schede saraspadoni@yahoo.it l'INSERT del link fallisce con 23505 su
-- uq_clients_prof_client_user; con una scheda sola riesce.
--
-- Applicazione: SQL Editor di Supabase, dopo la 017 (e la 018). Prima della
-- 022 (riparazione), che usa queste funzioni.

-- =============================================================================
-- 1. Archiviazione delle schede unite + log delle unioni
-- =============================================================================

alter table public.clients
  add column if not exists merged_into_client_id text references public.clients(id) on delete set null;

create index if not exists idx_clients_merged_into
  on public.clients (merged_into_client_id) where merged_into_client_id is not null;

comment on column public.clients.merged_into_client_id is
  'Valorizzato quando la scheda è stata unita in un''altra (doppione): la riga resta per storico, ma è nascosta a app e sito.';

create table if not exists public.clients_merge_log (
  id                 bigserial primary key,
  keep_client_id     text not null,
  merged_client_id   text not null,
  professionista_id  uuid,
  reason             text not null,          -- es. 'link_fn:email_duplicate' | 'repair:3.2' | 'admin:merge'
  performed_by       uuid,                   -- auth.uid() se disponibile
  moved              jsonb not null default '{}'::jsonb,   -- {tabella: righe spostate}
  conflicts          jsonb not null default '[]'::jsonb,   -- righe eliminate per unicità (snapshot)
  merged_snapshot    jsonb,                  -- la scheda unita, com'era
  created_at         timestamptz not null default now()
);

alter table public.clients_merge_log enable row level security;
drop policy if exists "clients_merge_log_superadmin_read" on public.clients_merge_log;
create policy "clients_merge_log_superadmin_read" on public.clients_merge_log
  for select using (public.is_superadmin());

-- =============================================================================
-- 2. collegamenti_merge_card: sposta tutti i riferimenti da p_merge a p_keep
-- =============================================================================
-- Tabelle: tutte quelle con FK verso clients(id) (scoperta dinamica, stessa
-- di admin_client_fk_refs) più i riferimenti "soft" senza FK:
-- measurement_analytics.client_id e monitoring_sessions.client_id (entrambi
-- text). client_professional_links.client_id NON è un riferimento alla scheda:
-- è l'uuid dell'utente (colonna legacy, dalla 019 = client_user_id) e non va
-- toccato dalle unioni.
-- Conflitti di unicità (es. client_settings, una riga per cliente): la riga
-- della scheda da unire viene eliminata e salvata nello snapshot del log.
-- La scheda unita NON viene cancellata: merged_into_client_id = p_keep.
-- Restituisce il riepilogo. Non cattura le eccezioni: il chiamante decide.

create or replace function public.collegamenti_merge_card(
  p_keep_id      text,
  p_merge_id     text,
  p_reason       text,
  p_performed_by uuid default null
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
  v_moved     jsonb := '{}'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
  v_rows      jsonb;
  v_preds     text[];
  v_match     text;
  v_coltype   text;
  v_n         bigint;
begin
  if p_keep_id is null or p_merge_id is null or p_keep_id = p_merge_id then
    raise exception 'collegamenti_merge_card: parametri non validi (%, %)', p_keep_id, p_merge_id;
  end if;
  select * into v_keep  from public.clients where id = p_keep_id;
  if not found then raise exception 'collegamenti_merge_card: scheda da tenere % non trovata', p_keep_id; end if;
  select * into v_merge from public.clients where id = p_merge_id;
  if not found then raise exception 'collegamenti_merge_card: scheda da unire % non trovata', p_merge_id; end if;
  if v_merge.professionista_id is distinct from v_keep.professionista_id then
    raise exception 'collegamenti_merge_card: le schede appartengono a professionisti diversi';
  end if;
  if v_merge.merged_into_client_id is not null then
    -- già unita: no-op idempotente
    return jsonb_build_object('ok', true, 'already_merged', true, 'keep_id', p_keep_id, 'merge_id', p_merge_id);
  end if;

  for r in
    with fk as (
      select distinct rel.relname::text as ref_table, att.attname::text as ref_column
      from pg_constraint con
      join pg_class rel      on rel.oid  = con.conrelid
      join pg_namespace nsp  on nsp.oid  = rel.relnamespace
      join pg_class frel     on frel.oid = con.confrelid
      join pg_namespace fnsp on fnsp.oid = frel.relnamespace
      join lateral unnest(con.conkey) as ck(attnum) on true
      join pg_attribute att  on att.attrelid = con.conrelid and att.attnum = ck.attnum
      where con.contype = 'f' and fnsp.nspname = 'public' and frel.relname = 'clients' and nsp.nspname = 'public'
        and not (rel.relname = 'clients' and att.attname = 'merged_into_client_id')
    ),
    extra as (
      select t.tbl as ref_table, t.col as ref_column
      from (values ('measurement_analytics', 'client_id'), ('monitoring_sessions', 'client_id')) as t(tbl, col)
      where exists (select 1 from information_schema.columns ic
                    where ic.table_schema = 'public' and ic.table_name = t.tbl and ic.column_name = t.col)
        and not exists (select 1 from fk where fk.ref_table = t.tbl and fk.ref_column = t.col)
    )
    select * from fk union all select * from extra
  loop
    select c.udt_name into v_coltype
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = r.ref_table and c.column_name = r.ref_column;

    execute format('select count(*) from public.%I where %I::text = $1', r.ref_table, r.ref_column)
      into v_cnt using p_merge_id;
    if v_cnt = 0 then continue; end if;

    -- Predicati di conflitto: indici UNIQUE che includono la colonna cliente.
    v_preds := null;
    for u in
      select array_agg(a.attname::text order by k.ord) filter (where a.attname::text <> r.ref_column) as other_cols
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace
      join lateral unnest(i.indkey::int2[]) with ordinality as k(attnum, ord) on true
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
      where n.nspname = 'public' and c.relname = r.ref_table and i.indisunique
        and exists (select 1 from pg_attribute a2
                    join lateral unnest(i.indkey::int2[]) k2(attnum) on a2.attnum = k2.attnum
                    where a2.attrelid = i.indrelid and a2.attname::text = r.ref_column)
      group by i.indexrelid
    loop
      if u.other_cols is null then
        v_preds := coalesce(v_preds, '{}'::text[]) || format(
          'exists (select 1 from public.%I k where k.%I::text = $1)', r.ref_table, r.ref_column);
      else
        select string_agg(format('k.%I is not distinct from m.%I', col, col), ' and ') into v_match
          from unnest(u.other_cols) as col;
        v_preds := coalesce(v_preds, '{}'::text[]) || format(
          'exists (select 1 from public.%I k where k.%I::text = $1 and %s)', r.ref_table, r.ref_column, v_match);
      end if;
    end loop;

    v_conf_cnt := 0;
    if v_preds is not null then
      execute format('select count(*) from public.%I m where m.%I::text = $2 and (%s)',
                     r.ref_table, r.ref_column, array_to_string(v_preds, ' or '))
        into v_conf_cnt using p_keep_id, p_merge_id;
      if v_conf_cnt > 0 then
        execute format('select jsonb_agg(to_jsonb(m)) from public.%I m where m.%I::text = $2 and (%s)',
                       r.ref_table, r.ref_column, array_to_string(v_preds, ' or '))
          into v_rows using p_keep_id, p_merge_id;
        execute format('delete from public.%I m where m.%I::text = $2 and (%s)',
                       r.ref_table, r.ref_column, array_to_string(v_preds, ' or '))
          using p_keep_id, p_merge_id;
        v_conflicts := v_conflicts || jsonb_build_object(
          'table', r.ref_table, 'column', r.ref_column, 'rows_deleted', v_conf_cnt, 'rows', coalesce(v_rows, '[]'::jsonb));
      end if;
    end if;

    execute format('update public.%I set %I = $1::%I where %I::text = $2',
                   r.ref_table, r.ref_column, v_coltype, r.ref_column)
      using p_keep_id, p_merge_id;
    get diagnostics v_n = row_count;
    v_moved := v_moved || jsonb_build_object(r.ref_table || '.' || r.ref_column, v_n);
  end loop;

  -- Arricchisci la scheda tenuta con ciò che le manca, poi archivia l'altra.
  -- Ordine obbligato: prima si toglie il ponte alla scheda unita (indice
  -- univoco professionista+utente), poi lo si dà alla tenuta.
  update public.clients
     set merged_into_client_id = p_keep_id,
         client_user_id = null
   where id = p_merge_id;

  update public.clients k
     set client_user_id = coalesce(k.client_user_id, v_merge.client_user_id),
         email          = coalesce(nullif(trim(k.email), ''), nullif(trim(v_merge.email), '')),
         telefono       = coalesce(nullif(trim(k.telefono), ''), nullif(trim(v_merge.telefono), '')),
         data_nascita   = coalesce(k.data_nascita, v_merge.data_nascita),
         sesso          = coalesce(k.sesso, v_merge.sesso),
         note           = case when coalesce(trim(k.note), '') = '' then v_merge.note else k.note end,
         last_measurement_at = greatest(k.last_measurement_at, v_merge.last_measurement_at)
   where k.id = p_keep_id;

  insert into public.clients_merge_log
    (keep_client_id, merged_client_id, professionista_id, reason, performed_by, moved, conflicts, merged_snapshot)
  values
    (p_keep_id, p_merge_id, v_keep.professionista_id, p_reason, coalesce(p_performed_by, auth.uid()),
     v_moved, v_conflicts, to_jsonb(v_merge));

  return jsonb_build_object('ok', true, 'keep_id', p_keep_id, 'merge_id', p_merge_id,
                            'moved', v_moved, 'conflicts', v_conflicts);
end;
$BODY$;

revoke all on function public.collegamenti_merge_card(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.collegamenti_merge_card(text, text, text, uuid) to service_role;

-- =============================================================================
-- 3. link_client_to_professional: IL punto di verità
-- =============================================================================
-- Trova o crea la scheda CRM con il ponte, crea o riattiva il link, non crea
-- mai duplicati, è idempotente. Restituisce sempre un jsonb:
--   { ok: true,  client_id, link_id, link_status, action, card_action, merged: [...] }
--   { ok: false, error, sqlstate, client_id?, ... }
-- Ordine di ricerca della scheda (schede archiviate escluse):
--   a) client_user_id = p_client_user_id (ponte già valorizzato)
--   b) email del profilo: UNA scheda senza ponte (o con lo stesso ponte) → la
--      aggancia; PIÙ schede → aggancia quella con più sessioni (a parità la più
--      vecchia, dall'epoch dell'id), unisce le altre in essa (merge_log)
--   c) email assente: nome+cognome su schede senza email e senza ponte
--   d) nessuna: crea la scheda (id epoch-millis, come l'app)
-- Link: riusa l'active, attiva il pending, riattiva il revocato più recente,
-- altrimenti lo crea; gli altri link vivi della stessa coppia vengono revocati.
-- Scrive SEMPRE entrambe le colonne: client_user_id e client_id (= lo stesso
-- uuid utente). L'indice univoco in produzione è su (client_id, professional_id)
-- e non è parziale: per la stessa coppia una sola riga può portare client_id,
-- quindi prima lo si azzera sulle altre righe della coppia e poi lo si scrive
-- sulla riga scelta (mai un INSERT quando esiste già una riga della coppia).
-- Il trigger su client_professional_links viene disattivato durante la
-- funzione (flag di sessione) per non rientrare in sé stesso.
-- EXCEPTION WHEN OTHERS: ritorna ok=false con l'errore; chi chiama decide se
-- propagarlo (il trigger lo rilancia, così il link non nasce).

-- Nome normalizzato per confrontare due schede: minuscolo, senza spazi né
-- punteggiatura ("Gian Andrea Pazzini" = "Gianandrea Pazzini"). Vuoto se la
-- scheda non ha nome. Usato qui (unione dei doppioni durante un collegamento)
-- e nella 022 (blocco C): due schede con la stessa email si uniscono in
-- automatico SOLO se hanno lo stesso nome, o se una delle due non ha nome.
create or replace function public.collegamenti_nome_norm(p_nome text, p_cognome text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(p_nome, '') || coalesce(p_cognome, '')), '[^[:alnum:]]', '', 'g');
$$;

create or replace function public.link_client_to_professional(
  p_client_user_id uuid,
  p_professional_id uuid,
  p_source text default 'unknown'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_profile     public.profiles%rowtype;
  v_email       text;
  v_card_id     text;
  v_card_action text := 'found';
  v_keep_id     text;
  v_other       record;
  v_merged      jsonb := '[]'::jsonb;
  v_res         jsonb;
  v_link        public.client_professional_links%rowtype;
  v_link_id     uuid;
  v_link_status text;
  v_action      text;
  v_warn        text[] := '{}'::text[];
begin
  if p_client_user_id is null or p_professional_id is null then
    return jsonb_build_object('ok', false, 'error', 'parametri mancanti', 'sqlstate', '22004');
  end if;
  if p_client_user_id = p_professional_id then
    return jsonb_build_object('ok', false, 'error', 'un utente non può collegarsi a sé stesso', 'sqlstate', '22023');
  end if;

  select * into v_profile from public.profiles where id = p_client_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profilo cliente inesistente: ' || p_client_user_id::text, 'sqlstate', 'P0002');
  end if;
  if not exists (select 1 from public.profiles where id = p_professional_id) then
    return jsonb_build_object('ok', false, 'error', 'profilo professionista inesistente: ' || p_professional_id::text, 'sqlstate', 'P0002');
  end if;
  if v_profile.role is distinct from 'client' then
    v_warn := v_warn || ('il profilo collegato ha ruolo ' || coalesce(v_profile.role, 'null'));
  end if;

  v_email := nullif(lower(trim(v_profile.email)), '');
  perform set_config('collegamenti.skip_trigger', 'on', true);

  -- a) ponte esplicito
  select c.id into v_card_id
    from public.clients c
   where c.professionista_id = p_professional_id
     and c.client_user_id = p_client_user_id
     and c.merged_into_client_id is null
   limit 1;

  -- a2) scheda col ponte trovata: altre schede con la stessa email e senza
  --     ponte sotto lo stesso professionista sono doppioni → unite in essa
  if v_card_id is not null and v_email is not null then
    for v_other in
      select c.id from public.clients c
       where c.professionista_id = p_professional_id
         and lower(trim(c.email)) = v_email
         and c.merged_into_client_id is null
         and c.client_user_id is null
         and c.id <> v_card_id
         -- stessa persona: stesso nome normalizzato, oppure scheda senza nome
         and public.collegamenti_nome_norm(c.nome, c.cognome)
             in ('', (select public.collegamenti_nome_norm(k.nome, k.cognome) from public.clients k where k.id = v_card_id))
    loop
      v_res := public.collegamenti_merge_card(v_card_id, v_other.id, 'link_fn:email_duplicate:' || coalesce(p_source, '?'), auth.uid());
      v_merged := v_merged || to_jsonb(v_other.id);
    end loop;
    if jsonb_array_length(v_merged) > 0 then v_card_action := 'found_and_merged'; end if;
  end if;

  -- b) email
  if v_card_id is null and v_email is not null then
    -- candidate: stessa email, senza ponte o con questo stesso ponte, non archiviate
    select c.id into v_keep_id
      from public.clients c
      left join lateral (select count(*) as n from public.sessions s where s.client_id = c.id) sc on true
     where c.professionista_id = p_professional_id
       and lower(trim(c.email)) = v_email
       and c.merged_into_client_id is null
       and (c.client_user_id is null or c.client_user_id = p_client_user_id)
     order by (public.collegamenti_nome_norm(c.nome, c.cognome) = public.collegamenti_nome_norm(v_profile.nome, v_profile.cognome)) desc,
              sc.n desc,
              case when c.id ~ '^[0-9]+$' then c.id::numeric else null end asc nulls last,
              c.created_at asc nulls last
     limit 1;
    if v_keep_id is not null then
      for v_other in
        select c.id from public.clients c
         where c.professionista_id = p_professional_id
           and lower(trim(c.email)) = v_email
           and c.merged_into_client_id is null
           and (c.client_user_id is null or c.client_user_id = p_client_user_id)
           and c.id <> v_keep_id
           -- stessa persona: stesso nome normalizzato, oppure scheda senza nome.
           -- Le schede con la stessa email ma un altro nome (es. il pro che
           -- mette la propria email a più clienti) restano dove sono e la
           -- vista salute le mostra come scheda_duplicata.
           and public.collegamenti_nome_norm(c.nome, c.cognome)
               in ('', (select public.collegamenti_nome_norm(k.nome, k.cognome) from public.clients k where k.id = v_keep_id))
      loop
        v_res := public.collegamenti_merge_card(v_keep_id, v_other.id, 'link_fn:email_duplicate:' || coalesce(p_source, '?'), auth.uid());
        v_merged := v_merged || to_jsonb(v_other.id);
      end loop;
      update public.clients
         set client_user_id = p_client_user_id,
             nome    = case when coalesce(trim(nome), '') = '' then coalesce(nullif(trim(v_profile.nome), ''), nome) else nome end,
             cognome = case when coalesce(trim(cognome), '') = '' then coalesce(nullif(trim(v_profile.cognome), ''), cognome) else cognome end
       where id = v_keep_id;
      v_card_id := v_keep_id;
      v_card_action := case when jsonb_array_length(v_merged) > 0 then 'bridged_after_merge' else 'bridged_by_email' end;
    end if;
  end if;

  -- c) nome+cognome, solo se il profilo non ha email
  if v_card_id is null and v_email is null then
    select c.id into v_card_id
      from public.clients c
     where c.professionista_id = p_professional_id
       and c.client_user_id is null
       and c.merged_into_client_id is null
       and coalesce(trim(c.email), '') = ''
       and lower(trim(coalesce(c.nome, '')))    = lower(trim(coalesce(v_profile.nome, '')))
       and lower(trim(coalesce(c.cognome, ''))) = lower(trim(coalesce(v_profile.cognome, '')))
     order by c.created_at asc nulls last
     limit 1;
    if v_card_id is not null then
      update public.clients set client_user_id = p_client_user_id where id = v_card_id;
      v_card_action := 'bridged_by_name';
    end if;
  end if;

  -- d) nuova scheda
  if v_card_id is null then
    v_card_id := (extract(epoch from clock_timestamp()) * 1000)::bigint::text;
    -- id epoch-millis come l'app: due schede create nello stesso millisecondo
    -- (es. il ciclo del blocco E della 022) collidono su clients_pkey →
    -- avanza di 1 ms finché l'id è libero.
    while exists (select 1 from public.clients c where c.id = v_card_id) loop
      v_card_id := (v_card_id::bigint + 1)::text;
    end loop;
    insert into public.clients (id, professionista_id, nome, cognome, email, client_user_id, created_at)
    values (v_card_id, p_professional_id,
            coalesce(nullif(trim(v_profile.nome), ''), 'Cliente'),
            coalesce(nullif(trim(v_profile.cognome), ''), ''),
            v_email, p_client_user_id, now());
    v_card_action := 'created';
  else
    -- backfill anagrafica ed email mancanti sulla scheda agganciata
    update public.clients
       set email   = coalesce(nullif(trim(email), ''), v_email),
           nome    = case when coalesce(trim(nome), '') = '' then coalesce(nullif(trim(v_profile.nome), ''), nome) else nome end,
           cognome = case when coalesce(trim(cognome), '') = '' then coalesce(nullif(trim(v_profile.cognome), ''), cognome) else cognome end
     where id = v_card_id;
  end if;

  -- Link: active > pending > revoked più recente > nuovo.
  select * into v_link
    from public.client_professional_links l
   where l.client_user_id = p_client_user_id and l.professional_id = p_professional_id
   order by (l.status = 'active') desc, (l.status = 'pending') desc, l.created_at desc
   limit 1;

  if v_link.id is null then
    insert into public.client_professional_links (client_user_id, client_id, professional_id, status)
    values (p_client_user_id, p_client_user_id, p_professional_id, 'active')
    returning id into v_link_id;
    v_action := 'link_created';
  elsif v_link.status = 'active' then
    v_link_id := v_link.id;
    v_action := 'already_active';
  else
    update public.client_professional_links
       set status = 'active', updated_at = now()
     where id = v_link.id;
    v_link_id := v_link.id;
    v_action := case when v_link.status = 'pending' then 'pending_activated' else 'reactivated' end;
  end if;
  v_link_status := 'active';

  -- Dedup: nessun altro link vivo per la stessa coppia.
  update public.client_professional_links
     set status = 'revoked', updated_at = now()
   where client_user_id = p_client_user_id and professional_id = p_professional_id
     and status <> 'revoked' and id <> v_link_id;

  -- Le due colonne: client_id (legacy uuid utente) allineato a client_user_id
  -- sulla riga scelta; azzerato sulle altre righe della coppia, altrimenti
  -- l'indice univoco (client_id, professional_id) lo impedirebbe.
  update public.client_professional_links
     set client_id = null
   where client_user_id = p_client_user_id and professional_id = p_professional_id
     and id <> v_link_id and client_id = p_client_user_id;
  update public.client_professional_links
     set client_id = p_client_user_id
   where id = v_link_id and client_id is distinct from p_client_user_id;

  perform set_config('collegamenti.skip_trigger', 'off', true);
  return jsonb_build_object(
    'ok', true, 'client_id', v_card_id, 'card_action', v_card_action,
    'link_id', v_link_id, 'link_status', v_link_status, 'action', v_action,
    'merged', v_merged, 'warnings', to_jsonb(v_warn), 'source', p_source);
exception when others then
  perform set_config('collegamenti.skip_trigger', 'off', true);
  return jsonb_build_object('ok', false, 'error', sqlerrm, 'sqlstate', sqlstate,
                            'client_id', v_card_id, 'source', p_source);
end;
$BODY$;

grant execute on function public.link_client_to_professional(uuid, uuid, text) to authenticated, service_role;

-- Un utente autenticato può chiamarla SOLO per sé o come professionista
-- destinatario: guardia sull'identità del chiamante. La service role
-- (auth.uid() null) può tutto.
create or replace function public.link_client_to_professional_guarded(
  p_client_user_id uuid,
  p_professional_id uuid,
  p_source text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $BODY$
begin
  if auth.uid() is not null and auth.uid() not in (p_client_user_id, p_professional_id) then
    return jsonb_build_object('ok', false, 'error', 'non autorizzato', 'sqlstate', '42501');
  end if;
  return public.link_client_to_professional(p_client_user_id, p_professional_id, p_source);
end;
$BODY$;

grant execute on function public.link_client_to_professional_guarded(uuid, uuid, text) to authenticated, service_role;

-- =============================================================================
-- 4. ensure_client_bridge: aggancia le schede CRM con quella email al profilo
-- =============================================================================
-- Per un profilo client appena creato (o a mano): ogni scheda con la stessa
-- email e client_user_id NULL riceve il ponte, UNA per professionista (quella
-- con più sessioni, poi la più vecchia). Se il professionista ha già una
-- scheda con quel ponte, le altre vengono unite in essa. Non crea link: il
-- collegamento resta una scelta esplicita (invito, richiesta, accettazione).

create or replace function public.ensure_client_bridge(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_email   text := nullif(lower(trim(p_email)), '');
  v_user    uuid;
  v_n       int;
  r         record;
  v_keep    text;
  v_bridged int := 0;
  v_merged  jsonb := '[]'::jsonb;
  v_skipped jsonb := '[]'::jsonb;
  v_res     jsonb;
begin
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'email vuota');
  end if;
  select count(*) into v_n from public.profiles p where lower(trim(p.email)) = v_email and p.role = 'client';
  if v_n = 0 then
    return jsonb_build_object('ok', true, 'bridged', 0, 'reason', 'nessun profilo client con questa email');
  end if;
  if v_n > 1 then
    return jsonb_build_object('ok', false, 'error', 'più profili client con la stessa email: da risolvere a mano');
  end if;
  select p.id into v_user from public.profiles p where lower(trim(p.email)) = v_email and p.role = 'client';

  perform set_config('collegamenti.skip_trigger', 'on', true);
  for r in
    select c.professionista_id
      from public.clients c
     where lower(trim(c.email)) = v_email
       and c.client_user_id is null
       and c.merged_into_client_id is null
       and c.professionista_id <> v_user      -- la scheda di sé stesso non è un ponte
     group by c.professionista_id
  loop
    begin
      -- scheda già col ponte sotto questo professionista?
      select c.id into v_keep from public.clients c
       where c.professionista_id = r.professionista_id and c.client_user_id = v_user and c.merged_into_client_id is null
       limit 1;
      if v_keep is null then
        select c.id into v_keep
          from public.clients c
          left join lateral (select count(*) as n from public.sessions s where s.client_id = c.id) sc on true
         where c.professionista_id = r.professionista_id
           and lower(trim(c.email)) = v_email
           and c.client_user_id is null
           and c.merged_into_client_id is null
         order by sc.n desc,
                  case when c.id ~ '^[0-9]+$' then c.id::numeric else null end asc nulls last,
                  c.created_at asc nulls last
         limit 1;
        update public.clients set client_user_id = v_user where id = v_keep;
        v_bridged := v_bridged + 1;
      end if;
      -- le altre schede con la stessa email (senza ponte) sotto lo stesso pro → unite
      for v_res in
        select to_jsonb(c.id) from public.clients c
         where c.professionista_id = r.professionista_id
           and lower(trim(c.email)) = v_email
           and c.client_user_id is null
           and c.merged_into_client_id is null
           and c.id <> v_keep
      loop
        perform public.collegamenti_merge_card(v_keep, v_res #>> '{}', 'ensure_client_bridge:email_duplicate', auth.uid());
        v_merged := v_merged || v_res;
      end loop;
    exception when others then
      v_skipped := v_skipped || jsonb_build_object('professionista_id', r.professionista_id, 'error', sqlerrm);
    end;
  end loop;
  perform set_config('collegamenti.skip_trigger', 'off', true);
  return jsonb_build_object('ok', true, 'client_user_id', v_user, 'bridged', v_bridged, 'merged', v_merged, 'skipped', v_skipped);
exception when others then
  perform set_config('collegamenti.skip_trigger', 'off', true);
  return jsonb_build_object('ok', false, 'error', sqlerrm, 'sqlstate', sqlstate);
end;
$BODY$;

revoke all on function public.ensure_client_bridge(text) from public, anon, authenticated;
grant execute on function public.ensure_client_bridge(text) to service_role;

create or replace function public.tg_profiles_ensure_client_bridge()
returns trigger
language plpgsql
security definer
set search_path = public
as $BODY$
begin
  if new.role = 'client' and nullif(trim(new.email), '') is not null then
    perform public.ensure_client_bridge(new.email);
  end if;
  return new;
exception when others then
  -- il ponte non deve mai bloccare la creazione del profilo
  raise warning 'tg_profiles_ensure_client_bridge: % (%)', sqlerrm, sqlstate;
  return new;
end;
$BODY$;

drop trigger if exists trg_profiles_ensure_client_bridge on public.profiles;
create trigger trg_profiles_ensure_client_bridge
  after insert or update of email, role on public.profiles
  for each row execute function public.tg_profiles_ensure_client_bridge();

-- =============================================================================
-- 5. tg_create_client_on_active_link: delega al punto di verità
-- =============================================================================
-- Sostituisce il trigger reale in produzione (client_crm_autocreate_on_link.sql):
--   passo 0 (ponte già presente → backfill anagrafica)   → ramo a) della funzione
--   passo 1 (dedup per email, UPDATE su TUTTE le schede) → ramo b): UNA scheda
--            scelta in modo deterministico (più sessioni, poi la più vecchia
--            per epoch dell'id, poi created_at), le altre unite in essa
--   passo 2 (dedup per nome senza email)                 → ramo c)
--   passo 3 (insert con id epoch)                        → ramo d)
-- Scatta alla transizione verso 'active' (INSERT già active, o UPDATE da altro
-- stato). Tutto è avvolto in EXCEPTION WHEN OTHERS: se l'aggancio della
-- scheda fallisce il link resta (non si fa più fallire la transazione del
-- chiamante), l'errore viene scritto in admin_audit_log
-- (action = 'link_trigger_failed') e in un WARNING, e il caso compare nella
-- view v_collegamenti_salute come 'link_senza_scheda', riparabile dal pannello.

create or replace function public.tg_create_client_on_active_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_res jsonb;
  v_err text;
begin
  if coalesce(current_setting('collegamenti.skip_trigger', true), 'off') = 'on' then
    return new;
  end if;
  if new.status is distinct from 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  if new.client_user_id is null then
    v_err := 'collegamento senza client_user_id: impossibile agganciare la scheda';
  else
    v_res := public.link_client_to_professional(new.client_user_id, new.professional_id, 'trigger:' || tg_op);
    if coalesce((v_res ->> 'ok')::boolean, false) is not true then
      v_err := coalesce(v_res ->> 'error', 'errore sconosciuto') || ' (' || coalesce(v_res ->> 'sqlstate', '?') || ')';
    end if;
  end if;

  if v_err is not null then
    raise warning 'tg_create_client_on_active_link: link % non agganciato alla scheda: %', new.id, v_err;
    begin
      insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
      values (null, 'trigger:tg_create_client_on_active_link', 'link_trigger_failed', 'link', new.id::text,
              jsonb_build_object('client_user_id', new.client_user_id, 'professional_id', new.professional_id,
                                 'op', tg_op, 'error', v_err, 'result', v_res));
    exception when others then
      raise warning 'tg_create_client_on_active_link: audit non scritto: %', sqlerrm;
    end;
  end if;
  return new;
exception when others then
  raise warning 'tg_create_client_on_active_link: errore inatteso su link %: % (%)', new.id, sqlerrm, sqlstate;
  begin
    insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
    values (null, 'trigger:tg_create_client_on_active_link', 'link_trigger_failed', 'link', new.id::text,
            jsonb_build_object('client_user_id', new.client_user_id, 'professional_id', new.professional_id,
                               'op', tg_op, 'error', sqlerrm, 'sqlstate', sqlstate));
  exception when others then
    null;
  end;
  return new;
end;
$BODY$;

drop trigger if exists trg_create_client_on_active_link on public.client_professional_links;
create trigger trg_create_client_on_active_link
  after insert or update of status on public.client_professional_links
  for each row execute function public.tg_create_client_on_active_link();

-- =============================================================================
-- 6. RLS sessioni del client: il ponte esplicito, con fallback storico
-- =============================================================================
create or replace function public.client_can_assign_session(
  p_professional_id uuid,
  p_client_id       uuid
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.client_professional_links l
    join public.clients c on c.professionista_id = l.professional_id
    where l.client_user_id = auth.uid()
      and l.professional_id = p_professional_id
      and l.status = 'active'
      and c.id = p_client_id::text
      and c.merged_into_client_id is null
      and (
        c.client_user_id = auth.uid()
        or (c.client_user_id is null
            and (c.id = auth.uid()::text
                 or lower(coalesce(c.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))))
      )
  );
$$;

-- Variante con l'id scheda in TEXT (clients.id è text: gli id epoch non sono
-- uuid e la firma uuid della policy storica fa fallire il cast). Le policy
-- vengono ricreate su questa.
create or replace function public.client_can_assign_session_text(
  p_professional_id uuid,
  p_client_id       text
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.client_professional_links l
    join public.clients c on c.professionista_id = l.professional_id
    where l.client_user_id = auth.uid()
      and l.professional_id = p_professional_id
      and l.status = 'active'
      and c.id = p_client_id
      and c.merged_into_client_id is null
      and (
        c.client_user_id = auth.uid()
        or (c.client_user_id is null
            and (c.id = auth.uid()::text
                 or lower(coalesce(c.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))))
      )
  );
$$;

grant execute on function public.client_can_assign_session(uuid, uuid) to authenticated;
grant execute on function public.client_can_assign_session_text(uuid, text) to authenticated;

do $$
begin
  execute 'drop policy if exists "sessions_client_insert_linked" on public.sessions';
  execute 'create policy "sessions_client_insert_linked" on public.sessions for insert to authenticated
           with check (public.client_can_assign_session_text(professionista_id, client_id))';
  execute 'drop policy if exists "sessions_client_update_linked" on public.sessions';
  execute 'create policy "sessions_client_update_linked" on public.sessions for update to authenticated
           using (public.client_can_assign_session_text(professionista_id, client_id))
           with check (public.client_can_assign_session_text(professionista_id, client_id))';
exception when others then
  raise notice 'policy sessions_client_*_linked non ricreate: %', sqlerrm;
end $$;

-- ── 6b. Lettura delle misurazioni remote dei clienti collegati ──────────────
-- In produzione le policy professional_reads_linked_client_sessions (su
-- sessions) e professional_reads_linked_client_analytics (su
-- measurement_analytics) controllano cpl.client_id, la colonna legacy: i link
-- nati dall'app portano solo client_user_id e quelle policy non concedono
-- nulla. Riscritte su coalesce(cpl.client_user_id, cpl.client_id), che regge
-- sia le righe legacy sia le nuove (dove le due colonne coincidono). Solo
-- SELECT, solo link active, secondo la convenzione remota: la misurazione del
-- cliente ha professionista_id / user_id = uid del cliente.
do $$
begin
  execute 'drop policy if exists "professional_reads_linked_client_sessions" on public.sessions';
  execute $p$
    create policy "professional_reads_linked_client_sessions" on public.sessions
      for select to authenticated
      using (
        exists (
          select 1 from public.client_professional_links cpl
           where cpl.professional_id = auth.uid()
             and cpl.status = 'active'
             and coalesce(cpl.client_user_id, cpl.client_id) = public.sessions.professionista_id
        )
      )
  $p$;
exception when others then
  raise notice 'policy professional_reads_linked_client_sessions non riscritta: %', sqlerrm;
end $$;

do $$
begin
  execute 'drop policy if exists "professional_reads_linked_client_analytics" on public.measurement_analytics';
  execute $p$
    create policy "professional_reads_linked_client_analytics" on public.measurement_analytics
      for select to authenticated
      using (
        exists (
          select 1 from public.client_professional_links cpl
           where cpl.professional_id = auth.uid()
             and cpl.status = 'active'
             and coalesce(cpl.client_user_id, cpl.client_id) = public.measurement_analytics.user_id
        )
      )
  $p$;
exception when others then
  raise notice 'policy professional_reads_linked_client_analytics non riscritta: %', sqlerrm;
end $$;

-- =============================================================================
-- 7. RPC di lettura: escludono le schede archiviate
-- =============================================================================
create or replace function public.get_linked_client_sessions_by_client_id(p_client_id text)
returns setof public.sessions
language sql
security definer
set search_path = public
stable
as $BODY$
  select s.*
  from public.clients c
  join public.client_professional_links l
    on l.professional_id = auth.uid() and l.status = 'active'
  join public.profiles p
    on p.id = l.client_user_id
   and (c.client_user_id = p.id
        or (c.client_user_id is null and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
  join public.sessions s
    on s.professionista_id = p.id and s.client_id is null
  where c.id = p_client_id
    and c.professionista_id = auth.uid()
    and c.merged_into_client_id is null
  order by s.started_at desc;
$BODY$;

create or replace function public.get_linked_clients_last_remote_session()
returns table (client_id text, last_remote_at timestamptz, remote_count bigint)
language sql
security definer
set search_path = public
stable
as $BODY$
  select c.id, max(coalesce(s.started_at, s.created_at)), count(s.id)
  from public.clients c
  join public.client_professional_links l
    on l.professional_id = auth.uid() and l.status = 'active'
  join public.profiles p
    on p.id = l.client_user_id
   and (c.client_user_id = p.id
        or (c.client_user_id is null and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
  join public.sessions s
    on s.professionista_id = p.id and s.client_id is null
  where c.professionista_id = auth.uid()
    and c.merged_into_client_id is null
  group by c.id;
$BODY$;

-- Monitoraggi (24h / sonno) dei clienti collegati: stessa logica della RPC
-- delle sessioni (ponte esplicito, poi fallback email/id per le righe
-- legacy, schede archiviate escluse) più le righe scritte direttamente sul
-- CRM (client_id + professionista_id). Sostituisce la versione dell'app
-- (solo email / c.id = p.id::text) e quella della 018 del sito.
create or replace function public.get_linked_client_monitoring_sessions_by_client_id(p_client_id text)
returns setof public.monitoring_sessions
language sql
security definer
set search_path = public
stable
as $BODY$
  select m.*
    from public.clients c
    join public.client_professional_links l
      on l.professional_id = auth.uid() and l.status = 'active'
    join public.profiles p
      on p.id = l.client_user_id
     and (c.client_user_id = p.id
          or (c.client_user_id is null and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
    join public.monitoring_sessions m
      on m.user_id = p.id
   where c.id = p_client_id
     and c.professionista_id = auth.uid()
     and c.merged_into_client_id is null
  union
  select m.*
    from public.monitoring_sessions m
   where m.client_id = p_client_id
     and m.professionista_id = auth.uid()
   order by start_time desc;
$BODY$;

grant execute on function public.get_linked_client_monitoring_sessions_by_client_id(text) to authenticated;

-- =============================================================================
-- 8. Ultima misurazione remota CON gli score, per la lista clienti del sito
-- =============================================================================
create or replace function public.get_linked_clients_last_remote_analytics()
returns table (client_id text, analytics public.measurement_analytics)
language sql
security definer
set search_path = public
stable
as $BODY$
  select distinct on (c.id) c.id, ma
  from public.clients c
  join public.client_professional_links l
    on l.professional_id = auth.uid() and l.status = 'active'
  join public.profiles p
    on p.id = l.client_user_id
   and (c.client_user_id = p.id
        or (c.client_user_id is null and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
  join public.sessions s
    on s.professionista_id = p.id and s.client_id is null
  join public.measurement_analytics ma on ma.session_id = s.id
  where c.professionista_id = auth.uid()
    and c.merged_into_client_id is null
  order by c.id, coalesce(s.started_at, s.created_at) desc;
$BODY$;

grant execute on function public.get_linked_clients_last_remote_analytics() to authenticated;

-- =============================================================================
-- 9. Le schede unite spariscono da app e sito (sessione utente)
-- =============================================================================
-- Policy RESTRICTIVE: si somma in AND alle permissive esistenti. La service
-- role bypassa la RLS e continua a vederle (pannello Super Admin, log).
drop policy if exists "clients_hide_merged" on public.clients;
create policy "clients_hide_merged" on public.clients
  as restrictive
  for all
  to authenticated
  using (merged_into_client_id is null)
  with check (merged_into_client_id is null);

notify pgrst, 'reload schema';
