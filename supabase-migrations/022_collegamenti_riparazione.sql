-- =============================================================================
-- STRESS INDEX — 022: RIPARAZIONE dei collegamenti (anteprima + applicazione)
-- =============================================================================
--
-- Prerequisiti: 019 (funzioni), 021 (backup). Idempotente e rieseguibile.
--
-- DUE MODALITÀ, stesso file:
--   • ANTEPRIMA (default): nessuna scrittura sui dati; calcola e stampa i
--     conteggi di ogni blocco e li lascia nella tabella
--     collegamenti_riparazione_log (mode = 'anteprima').
--   • APPLICAZIONE: eseguire prima
--        select set_config('collegamenti.apply', 'on', false);
--     nella STESSA sessione del SQL Editor, poi questo file. Ogni blocco è
--     avvolto in EXCEPTION WHEN OTHERS: un caso strano viene loggato e non
--     blocca gli altri.
--
-- Blocchi (nell'ordine di esecuzione):
--   A  link duplicati: per ogni coppia con più link vivi tiene l'active più
--      recente e revoca gli altri; poi crea l'indice univoco parziale
--      uq_client_professional_active (client_user_id, professional_id)
--      where status <> 'revoked'
--   B  link active il cui profilo cliente non esiste più → revocati
--   C  (3.2) schede duplicate sotto lo stesso professionista (stessa email,
--      STESSA PERSONA: cognome o nome+cognome uguali, oppure una delle due
--      senza nome): tiene la scheda col ponte, altrimenti quella con più
--      sessioni, a parità la più vecchia (epoch dell'id); unisce le altre con
--      collegamenti_merge_card (sessioni, analytics, monitoraggi, note, link,
--      ecc. spostati; scheda archiviata con merged_into_client_id; riga in
--      clients_merge_log). Le coppie con la stessa email ma nomi diversi NON
--      vengono toccate: restano nella view come 'scheda_duplicata' da
--      decidere a mano (pulsante Unisci nel pannello).
--   D  (3.1) ponte mancante: ensure_client_bridge(email) per ogni email di
--      scheda senza ponte che ha esattamente un profilo client
--   E  (3.3) link active senza scheda → link_client_to_professional
--   F  schede che avevano GIÀ il ponte esplicito prima di questa esecuzione
--      ma nessun link mai esistito (invito fallito a metà, caso Sara)
--      → link_client_to_professional; le schede agganciate dal blocco D non
--      vengono collegate: finiscono nel report G
--   G  (3.4) sessioni remote invisibili: SOLO REPORT, con il professionista
--      candidato (scheda con la stessa email). Per crearne il collegamento
--      inserire le coppie confermate in collegamenti_riparazione_link_ok
--      (client_user_id, professional_id) prima di rieseguire in APPLICAZIONE.
--   H  (2.13) measurement_analytics.client_id riallineato alla sessione
--   I  report: measurement_analytics senza sessione, ponti verso profili non
--      client, pending vecchi (nessuna modifica)
--
-- Alla fine: SELECT riassuntivo dell'esecuzione corrente.

create table if not exists public.collegamenti_riparazione_log (
  id         bigserial primary key,
  run_id     uuid not null,
  run_at     timestamptz not null default now(),
  mode       text not null,      -- 'anteprima' | 'applicazione'
  block      text not null,
  n          integer not null default 0,
  details    jsonb not null default '[]'::jsonb,
  error      text
);
alter table public.collegamenti_riparazione_log enable row level security;
revoke all on public.collegamenti_riparazione_log from public, anon, authenticated;

create table if not exists public.collegamenti_riparazione_link_ok (
  client_user_id  uuid not null,
  professional_id uuid not null,
  note            text,
  primary key (client_user_id, professional_id)
);
alter table public.collegamenti_riparazione_link_ok enable row level security;
revoke all on public.collegamenti_riparazione_link_ok from public, anon, authenticated;

-- Helper di log (le procedure locali non esistono in plpgsql).
create or replace function public.collegamenti_riparazione_logb(
  p_run uuid, p_mode text, p_block text, p_n integer, p_details jsonb default '[]'::jsonb, p_error text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.collegamenti_riparazione_log (run_id, mode, block, n, details, error)
  values (p_run, p_mode, p_block, coalesce(p_n, 0), coalesce(p_details, '[]'::jsonb), p_error);
$$;
revoke all on function public.collegamenti_riparazione_logb(uuid, text, text, integer, jsonb, text) from public, anon, authenticated;

do $MAIN$
declare
  v_apply   boolean := coalesce(current_setting('collegamenti.apply', true), 'off') = 'on';
  v_mode    text;
  v_run     uuid := gen_random_uuid();
  v_n       integer;
  v_det     jsonb;
  r         record;
  v_res     jsonb;
  v_keep    text;
  v_ok      integer;
  v_err     integer;
begin
  v_mode := case when v_apply then 'applicazione' else 'anteprima' end;
  perform set_config('collegamenti.skip_trigger', 'on', true);
  -- Schede che avevano GIÀ il ponte prima di questa esecuzione: solo queste
  -- possono ricevere un link automatico nel blocco F (il ponte è stato
  -- scritto da un flusso esplicito: invito o accettazione). Quelle agganciate
  -- dal blocco D restano nel report G, da confermare a mano.
  create temp table if not exists _pre on commit drop as
  select c.id from public.clients c where c.client_user_id is not null;
  raise notice '=== collegamenti riparazione: modalità % (run %) ===', v_mode, v_run;

  -- ── A. link duplicati + indice univoco ─────────────────────────────────────
  begin
    with ranked as (
      select l.id, l.client_user_id, l.professional_id, l.status, l.created_at,
             row_number() over (partition by l.client_user_id, l.professional_id
                                order by (l.status = 'active') desc, l.created_at desc) as rn
      from public.client_professional_links l
      where l.status <> 'revoked'
    )
    select count(*), coalesce(jsonb_agg(jsonb_build_object('link_id', id, 'client_user_id', client_user_id, 'professional_id', professional_id, 'status', status, 'created_at', created_at)), '[]'::jsonb)
      into v_n, v_det
      from ranked where rn > 1;
    if v_apply and v_n > 0 then
      with ranked as (
        select l.id, row_number() over (partition by l.client_user_id, l.professional_id
                                        order by (l.status = 'active') desc, l.created_at desc) as rn
        from public.client_professional_links l where l.status <> 'revoked'
      )
      update public.client_professional_links l set status = 'revoked', updated_at = now()
        from ranked where l.id = ranked.id and ranked.rn > 1;
    end if;
    if v_apply then
      execute 'create unique index if not exists uq_client_professional_active
               on public.client_professional_links (client_user_id, professional_id)
               where status <> ''revoked''';
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'A_link_duplicati_revocati', v_n, v_det);
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'A_link_duplicati_revocati', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── B. link active con profilo inesistente → revoca ────────────────────────
  begin
    select count(*), coalesce(jsonb_agg(jsonb_build_object('link_id', l.id, 'client_user_id', l.client_user_id, 'professional_id', l.professional_id)), '[]'::jsonb)
      into v_n, v_det
      from public.client_professional_links l
      where l.status <> 'revoked' and not exists (select 1 from public.profiles p where p.id = l.client_user_id);
    if v_apply and v_n > 0 then
      update public.client_professional_links l set status = 'revoked', updated_at = now()
       where l.status <> 'revoked' and not exists (select 1 from public.profiles p where p.id = l.client_user_id);
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'B_link_profilo_inesistente_revocati', v_n, v_det);
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'B_link_profilo_inesistente_revocati', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── C. schede duplicate stessa persona, stesso professionista → unione ─────
  begin
    create temp table if not exists _dup on commit drop as
    with cards as (
      select c.*, lower(trim(c.email)) as email_norm,
             lower(trim(coalesce(c.cognome, ''))) as cog, lower(trim(coalesce(c.nome, ''))) as nom,
             (select count(*) from public.sessions s where s.client_id = c.id) as n_sess,
             case when c.id ~ '^[0-9]+$' then c.id::numeric else null end as epoch
      from public.clients c
      where c.merged_into_client_id is null and nullif(trim(c.email), '') is not null
    ),
    grp as (
      select professionista_id, email_norm, count(*) as n,
             count(distinct nullif(cog, '')) as n_cognomi,
             count(distinct nullif(nom || ' ' || cog, ' ')) as n_nomi,
             array_agg(id order by (client_user_id is not null) desc, n_sess desc, epoch asc nulls last, created_at asc) as ids
      from cards group by professionista_id, email_norm having count(*) > 1
    )
    select g.*, (g.n_cognomi <= 1 and g.n_nomi <= 2) as same_person from grp g;

    select count(*), coalesce(jsonb_agg(jsonb_build_object('professionista_id', professionista_id, 'email', email_norm, 'keep', ids[1], 'merge', ids[2:], 'same_person', same_person)), '[]'::jsonb)
      into v_n, v_det from _dup where same_person;
    v_ok := 0; v_err := 0;
    if v_apply then
      for r in select * from _dup where same_person loop
        for v_keep in select unnest(r.ids[2:]) loop
          begin
            v_res := public.collegamenti_merge_card(r.ids[1], v_keep, 'repair:3.2', null);
            v_ok := v_ok + 1;
          exception when others then
            v_err := v_err + 1;
            perform public.collegamenti_riparazione_logb(v_run, v_mode, 'C_merge_errore', 1, jsonb_build_array(jsonb_build_object('keep', r.ids[1], 'merge', v_keep)), sqlerrm);
          end;
        end loop;
      end loop;
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'C_schede_duplicate_unite', v_n, v_det || jsonb_build_object('unite', v_ok, 'errori', v_err));
    select count(*), coalesce(jsonb_agg(jsonb_build_object('professionista_id', professionista_id, 'email', email_norm, 'ids', ids)), '[]'::jsonb)
      into v_n, v_det from _dup where not same_person;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'C_schede_duplicate_da_decidere_a_mano', v_n, v_det);
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'C_schede_duplicate_unite', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── D. ponte mancante → ensure_client_bridge ───────────────────────────────
  begin
    create temp table if not exists _bridge on commit drop as
    select x.email_norm, count(*) as n_schede,
           jsonb_agg(jsonb_build_object('client_id', x.id, 'professionista_id', x.professionista_id, 'nome', x.nome)) as schede,
           (select count(*) from public.profiles p where p.role = 'client' and lower(trim(p.email)) = x.email_norm) as n_profili
    from (
      select lower(trim(c.email)) as email_norm, c.id, c.professionista_id,
             trim(coalesce(c.nome,'') || ' ' || coalesce(c.cognome,'')) as nome
      from public.clients c
      where c.client_user_id is null and c.merged_into_client_id is null and nullif(trim(c.email), '') is not null
    ) x
    group by x.email_norm;
    select count(*), coalesce(jsonb_agg(jsonb_build_object('email', email_norm, 'schede', schede)), '[]'::jsonb)
      into v_n, v_det from _bridge where n_profili = 1;
    v_ok := 0; v_err := 0;
    if v_apply then
      for r in select * from _bridge where n_profili = 1 loop
        v_res := public.ensure_client_bridge(r.email_norm);
        if coalesce((v_res ->> 'ok')::boolean, false) then v_ok := v_ok + coalesce((v_res ->> 'bridged')::int, 0);
        else v_err := v_err + 1; perform public.collegamenti_riparazione_logb(v_run, v_mode, 'D_ponte_errore', 1, jsonb_build_array(jsonb_build_object('email', r.email_norm)), v_res ->> 'error'); end if;
      end loop;
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'D_ponte_costruito', v_n, v_det || jsonb_build_object('agganciate', v_ok, 'errori', v_err));
    select count(*), coalesce(jsonb_agg(jsonb_build_object('email', email_norm, 'n_profili', n_profili)), '[]'::jsonb)
      into v_n, v_det from _bridge where n_profili > 1;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'D_ponte_ambiguo_piu_profili', v_n, v_det);
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'D_ponte_costruito', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── E. link active senza scheda → link_client_to_professional ──────────────
  begin
    create temp table if not exists _nocard on commit drop as
    select l.id as link_id, l.client_user_id, l.professional_id, p.email
    from public.client_professional_links l
    join public.profiles p on p.id = l.client_user_id
    where l.status = 'active'
      and not exists (
        select 1 from public.clients c
        where c.professionista_id = l.professional_id and c.merged_into_client_id is null
          and (c.client_user_id = l.client_user_id
               or (c.client_user_id is null and (lower(trim(c.email)) = lower(trim(p.email)) or c.id = l.client_user_id::text))));
    select count(*), coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_n, v_det from _nocard x;
    v_ok := 0; v_err := 0;
    if v_apply then
      for r in select * from _nocard loop
        v_res := public.link_client_to_professional(r.client_user_id, r.professional_id, 'repair:3.3');
        if coalesce((v_res ->> 'ok')::boolean, false) then v_ok := v_ok + 1;
        else v_err := v_err + 1; perform public.collegamenti_riparazione_logb(v_run, v_mode, 'E_scheda_errore', 1, jsonb_build_array(to_jsonb(r)), v_res ->> 'error'); end if;
      end loop;
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'E_link_senza_scheda_riparati', v_n, v_det || jsonb_build_object('riparati', v_ok, 'errori', v_err));
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'E_link_senza_scheda_riparati', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── F. scheda con ponte ma nessun link mai esistito → link ─────────────────
  begin
    create temp table if not exists _nolink on commit drop as
    select c.id as client_id, c.client_user_id, c.professionista_id, p.email,
           trim(coalesce(c.nome,'') || ' ' || coalesce(c.cognome,'')) as nome
    from public.clients c
    join public.profiles p on p.id = c.client_user_id
    where c.merged_into_client_id is null
      and c.client_user_id <> c.professionista_id
      and c.id in (select id from _pre)
      and not exists (select 1 from public.client_professional_links l
                      where l.client_user_id = c.client_user_id and l.professional_id = c.professionista_id);
    select count(*), coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_n, v_det from _nolink x;
    v_ok := 0; v_err := 0;
    if v_apply then
      for r in select * from _nolink loop
        v_res := public.link_client_to_professional(r.client_user_id, r.professionista_id, 'repair:ponte_senza_link');
        if coalesce((v_res ->> 'ok')::boolean, false) then v_ok := v_ok + 1;
        else v_err := v_err + 1; perform public.collegamenti_riparazione_logb(v_run, v_mode, 'F_link_errore', 1, jsonb_build_array(to_jsonb(r)), v_res ->> 'error'); end if;
      end loop;
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'F_ponte_senza_link_collegati', v_n, v_det || jsonb_build_object('collegati', v_ok, 'errori', v_err));
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'F_ponte_senza_link_collegati', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── G. sessioni remote invisibili: report + coppie confermate ──────────────
  begin
    create temp table if not exists _orphan on commit drop as
    select s.professionista_id as client_user_id,
           trim(coalesce(p.nome,'') || ' ' || coalesce(p.cognome,'')) as cliente, p.email,
           count(*) as sessioni, max(coalesce(s.started_at, s.created_at)) as ultima,
           (select jsonb_agg(jsonb_build_object('professional_id', c.professionista_id,
                    'professionista', coalesce(nullif(trim(coalesce(pp.nome,'')||' '||coalesce(pp.cognome,'')),''), q.email),
                    'client_id', c.id))
              from public.clients c
              left join public.professional_profiles pp on pp.id = c.professionista_id
              left join public.profiles q on q.id = c.professionista_id
             where c.merged_into_client_id is null and lower(trim(c.email)) = lower(trim(p.email))
               and c.professionista_id <> s.professionista_id) as candidati
    from public.sessions s
    join public.profiles p on p.id = s.professionista_id and p.role is distinct from 'professional'
    where s.client_id is null
      and not exists (select 1 from public.client_professional_links l where l.client_user_id = s.professionista_id and l.status = 'active')
    group by s.professionista_id, p.nome, p.cognome, p.email;
    select count(*), coalesce(jsonb_agg(to_jsonb(x) order by x.sessioni desc), '[]'::jsonb) into v_n, v_det from _orphan x;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'G_sessioni_remote_invisibili_report', coalesce((select sum(sessioni) from _orphan), 0)::int, v_det);
    -- coppie confermate a mano
    select count(*), coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_n, v_det from public.collegamenti_riparazione_link_ok x;
    v_ok := 0; v_err := 0;
    if v_apply then
      for r in select * from public.collegamenti_riparazione_link_ok loop
        v_res := public.link_client_to_professional(r.client_user_id, r.professional_id, 'repair:link_ok_manuale');
        if coalesce((v_res ->> 'ok')::boolean, false) then v_ok := v_ok + 1;
        else v_err := v_err + 1; perform public.collegamenti_riparazione_logb(v_run, v_mode, 'G_link_ok_errore', 1, jsonb_build_array(to_jsonb(r)), v_res ->> 'error'); end if;
      end loop;
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'G_link_confermati_a_mano', v_n, v_det || jsonb_build_object('collegati', v_ok, 'errori', v_err));
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'G_sessioni_remote_invisibili_report', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── H. measurement_analytics.client_id riallineato alla sessione ───────────
  begin
    select count(*), coalesce(jsonb_agg(jsonb_build_object('ma_id', ma.id, 'session_id', ma.session_id, 'da', ma.client_id, 'a', s.client_id)), '[]'::jsonb)
      into v_n, v_det
      from public.measurement_analytics ma join public.sessions s on s.id = ma.session_id
     where ma.client_id is distinct from s.client_id;
    if v_apply and v_n > 0 then
      update public.measurement_analytics ma set client_id = s.client_id
        from public.sessions s where s.id = ma.session_id and ma.client_id is distinct from s.client_id;
    end if;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'H_analytics_riallineati', v_n, v_det);
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'H_analytics_riallineati', 0, '[]'::jsonb, sqlerrm);
  end;

  -- ── I. solo report ─────────────────────────────────────────────────────────
  begin
    select count(*) into v_n from public.measurement_analytics ma where not exists (select 1 from public.sessions s where s.id = ma.session_id);
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'I_report_analytics_senza_sessione', v_n);
    select count(*), coalesce(jsonb_agg(jsonb_build_object('client_id', c.id, 'client_user_id', c.client_user_id, 'ruolo', p.role, 'email', p.email)), '[]'::jsonb)
      into v_n, v_det from public.clients c join public.profiles p on p.id = c.client_user_id where p.role is distinct from 'client' and c.merged_into_client_id is null;
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'I_report_ponte_ruolo_non_client', v_n, v_det);
    select count(*), coalesce(jsonb_agg(jsonb_build_object('link_id', l.id, 'client_user_id', l.client_user_id, 'professional_id', l.professional_id, 'created_at', l.created_at)), '[]'::jsonb)
      into v_n, v_det from public.client_professional_links l where l.status = 'pending' and l.created_at < now() - interval '30 days';
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'I_report_pending_vecchi', v_n, v_det);
  exception when others then
    perform public.collegamenti_riparazione_logb(v_run, v_mode, 'I_report', 0, '[]'::jsonb, sqlerrm);
  end;

  perform set_config('collegamenti.skip_trigger', 'off', true);
  perform set_config('collegamenti.last_run', v_run::text, false);
  raise notice '=== fine: vedi select riassuntivo ===';
end
$MAIN$;

-- Riepilogo dell'esecuzione appena fatta.
select block, mode, n, error,
       case when jsonb_typeof(details) = 'array' then jsonb_array_length(details) else null end as dettagli
from public.collegamenti_riparazione_log
where run_id = current_setting('collegamenti.last_run', true)::uuid
order by id;
