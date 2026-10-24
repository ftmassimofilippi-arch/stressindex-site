-- sito-051: condivisione con il formatore (Master HRV), 24/10/2026
--
-- Un professionista può condividere con il formatore (il superadmin
-- info@massimofilippi.it) le proprie misurazioni o quelle di un suo cliente, in
-- forma pseudonimizzata, a scopo didattico. Il blocco privacy dell'area admin
-- resta: il superadmin vede SOLO ciò che passa da `trainer_shared_measurements()`,
-- e quella funzione restituisce solo misurazioni coperte da una condivisione
-- attiva (non revocata, non scaduta) con un codice caso al posto dell'identità.
--
-- Oggetti:
--   • consent_records: nuovo tipo 'trainer_share' (una riga a ogni condivisione,
--     granted=true; una riga granted=false a ogni revoca).
--   • trainer_shares: una riga per (professionista, cliente | sé stesso), scade
--     dopo 90 giorni, revocabile, mai cancellabile dall'utente.
--   • trainer_case_code(): il codice caso ("M.R. 1978 F", "Sé stesso 1975").
--   • trainer_share_measurement_ids(): quali misurazioni copre una condivisione.
--     Stesse regole del sito (client-bridge.ts / remote-sessions.ts): le
--     misurazioni in studio hanno client_id = scheda; le automisurazioni del
--     cliente hanno client_id NULL e user_id = account del cliente, agganciato
--     alla scheda da clients.client_user_id o dal collegamento attivo; le
--     misurazioni proprie del professionista hanno user_id = professionista e
--     client_id NULL.
--   • trainer_share_candidates(): per il professionista loggato, "Le mie
--     misurazioni" + i suoi clienti con codice caso, conteggio e condivisione attiva.
--   • trainer_share_grant() / trainer_share_revoke(): scrittura atomica di
--     condivisione e consenso.
--   • trainer_shared_measurements(): solo superadmin, scrive in admin_audit_log.
--
-- Idempotente. Solo modifiche additive.

begin;

-- ---------------------------------------------------------------------------
-- 1. Consenso 'trainer_share'
-- ---------------------------------------------------------------------------
alter table public.consent_records drop constraint if exists consent_records_consent_type_check;
alter table public.consent_records add constraint consent_records_consent_type_check check (consent_type in (
  'terms_privacy','dpa','wellness_ack','health_data','share_professional',
  'marketing','stats_algorithms','research','contact','studio_transfer',
  'trainer_share'));

-- ---------------------------------------------------------------------------
-- 2. Tabella delle condivisioni
-- ---------------------------------------------------------------------------
create table if not exists public.trainer_shares (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users(id) on delete cascade,
  -- NULL = misurazioni proprie del professionista.
  client_id text null references public.clients(id) on delete cascade,
  scope text not null default 'all' check (scope in ('all')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz null,
  consent_record_id uuid null references public.consent_records(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.trainer_shares enable row level security;
revoke all on public.trainer_shares from anon, authenticated;
grant select, insert on public.trainer_shares to authenticated;
-- Revoca sì, riscrittura no: l'unica colonna aggiornabile è revoked_at.
grant update (revoked_at) on public.trainer_shares to authenticated;

create unique index if not exists trainer_shares_attive_uniq
  on public.trainer_shares (professional_id, coalesce(client_id, '__self__'))
  where revoked_at is null;
create index if not exists trainer_shares_professional_idx on public.trainer_shares (professional_id);
create index if not exists trainer_shares_client_idx on public.trainer_shares (client_id) where client_id is not null;

drop policy if exists trainer_shares_select_own on public.trainer_shares;
drop policy if exists trainer_shares_select_superadmin on public.trainer_shares;
drop policy if exists trainer_shares_insert_own on public.trainer_shares;
drop policy if exists trainer_shares_update_own on public.trainer_shares;

create policy trainer_shares_select_own on public.trainer_shares
  for select to authenticated using (professional_id = auth.uid());
create policy trainer_shares_select_superadmin on public.trainer_shares
  for select to authenticated using (public.is_superadmin());
create policy trainer_shares_insert_own on public.trainer_shares
  for insert to authenticated with check (
    professional_id = auth.uid()
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.id = trainer_shares.client_id and c.professionista_id = auth.uid()
      )
    )
  );
create policy trainer_shares_update_own on public.trainer_shares
  for update to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());
-- Nessuna policy di delete: una condivisione si revoca, non si cancella.

-- ---------------------------------------------------------------------------
-- 3. Il formatore: ricavato dal profilo, non scritto nel codice del sito
-- ---------------------------------------------------------------------------
create or replace function public.trainer_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id from public.profiles p
  where lower(p.email) = 'info@massimofilippi.it' and p.is_superadmin = true
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Codice caso
-- ---------------------------------------------------------------------------
-- Cliente: iniziali + anno di nascita + sesso ("M.R. 1978 F"). Le parti che
-- mancano si saltano. Sé stesso: "Sé stesso" + anno, se c'è.
create or replace function public.trainer_case_code(
  p_nome text, p_cognome text, p_data_nascita date, p_sesso text, p_self boolean default false)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_self then concat_ws(' ', 'Sé stesso', extract(year from p_data_nascita)::int::text)
    else nullif(concat_ws(' ',
      nullif(
        concat(
          case when nullif(btrim(coalesce(p_nome, '')), '') is not null then upper(left(btrim(p_nome), 1)) || '.' end,
          case when nullif(btrim(coalesce(p_cognome, '')), '') is not null then upper(left(btrim(p_cognome), 1)) || '.' end
        ), ''),
      extract(year from p_data_nascita)::int::text,
      case when upper(left(btrim(coalesce(p_sesso, '')), 1)) in ('M', 'F') then upper(left(btrim(p_sesso), 1)) end
    ), '')
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Misurazioni coperte da una condivisione
-- ---------------------------------------------------------------------------
create or replace function public.trainer_share_measurement_ids(p_professional_id uuid, p_client_id text)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- Misurazioni proprie: fatte dal professionista senza scegliere un cliente.
  select m.id from public.measurement_analytics m
  where p_client_id is null and m.user_id = p_professional_id and m.client_id is null
  union
  -- In studio: la scheda è scritta sulla riga.
  select m.id from public.measurement_analytics m
  join public.clients c on c.id = m.client_id
  where p_client_id is not null and c.id = p_client_id and c.professionista_id = p_professional_id
  union
  -- Dall'app del cliente: client_id NULL, user_id = account del cliente, che si
  -- aggancia alla scheda come fa il sito (client_user_id, poi il collegamento
  -- attivo per id o per email).
  select m.id from public.measurement_analytics m
  where p_client_id is not null and m.client_id is null and m.user_id in (
    select c.client_user_id from public.clients c
    where c.id = p_client_id and c.professionista_id = p_professional_id and c.client_user_id is not null
    union
    select l.client_user_id
    from public.clients c
    join public.client_professional_links l on l.professional_id = c.professionista_id and l.status = 'active' and l.client_user_id is not null
    left join public.profiles p on p.id = l.client_user_id
    where c.id = p_client_id and c.professionista_id = p_professional_id
      and (
        l.client_id::text = c.id
        or l.client_user_id::text = c.id
        or (c.email is not null and p.email is not null and lower(btrim(p.email)) = lower(btrim(c.email)))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. Che cosa può condividere il professionista loggato
-- ---------------------------------------------------------------------------
create or replace function public.trainer_share_candidates()
returns table (
  client_id text,
  nome text,
  cognome text,
  case_code text,
  n_misurazioni integer,
  share_id uuid,
  share_granted_at timestamptz,
  share_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return query
  with soggetti as (
    select null::text as client_id, p.nome, p.cognome,
           public.trainer_case_code(p.nome, p.cognome, p.data_nascita, p.sesso, true) as case_code,
           0 as ordine
    from public.profiles p where p.id = v_uid
    union all
    select c.id, c.nome, c.cognome,
           public.trainer_case_code(c.nome, c.cognome, c.data_nascita, c.sesso, false),
           1
    from public.clients c
    where c.professionista_id = v_uid and c.merged_into_client_id is null
  )
  select s.client_id, s.nome, s.cognome, s.case_code,
         (select count(*) from public.trainer_share_measurement_ids(v_uid, s.client_id))::int,
         sh.id, sh.granted_at, sh.expires_at
  from soggetti s
  left join public.trainer_shares sh
    on sh.professional_id = v_uid
   and coalesce(sh.client_id, '__self__') = coalesce(s.client_id, '__self__')
   and sh.revoked_at is null and sh.expires_at > now()
  order by s.ordine, lower(s.cognome), lower(s.nome);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Condividere e revocare (condivisione + consenso nella stessa transazione)
-- ---------------------------------------------------------------------------
create or replace function public.trainer_share_grant(p_client_id text, p_text_sha256 text, p_text_lang text)
returns public.trainer_shares
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_consent uuid;
  v_share public.trainer_shares;
  v_lang text := case when p_text_lang in ('it', 'en', 'de') then p_text_lang else null end;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_client_id is not null and not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.professionista_id = v_uid and c.merged_into_client_id is null
  ) then
    raise exception 'trainer_share_client_not_owned' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_text_sha256, '')), '') is null then
    raise exception 'trainer_share_missing_consent' using errcode = '22023';
  end if;

  insert into public.consent_records
    (user_id, consent_type, granted, text_version, text_sha256, text_lang, source, related_user_id)
  values
    (v_uid, 'trainer_share', true, 'trainer_share_v1', p_text_sha256, v_lang, 'site', public.trainer_user_id())
  returning id into v_consent;

  -- Una nuova condivisione sullo stesso soggetto rinnova i 90 giorni: la
  -- precedente (attiva o scaduta) si chiude.
  update public.trainer_shares
     set revoked_at = now()
   where professional_id = v_uid
     and coalesce(client_id, '__self__') = coalesce(p_client_id, '__self__')
     and revoked_at is null;

  insert into public.trainer_shares (professional_id, client_id, consent_record_id)
  values (v_uid, p_client_id, v_consent)
  returning * into v_share;
  return v_share;
end;
$$;

create or replace function public.trainer_share_revoke(p_share_id uuid)
returns public.trainer_shares
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_share public.trainer_shares;
  v_consent public.consent_records;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.trainer_shares
     set revoked_at = now()
   where id = p_share_id and professional_id = v_uid and revoked_at is null
  returning * into v_share;
  if v_share.id is null then
    raise exception 'trainer_share_not_found' using errcode = 'P0002';
  end if;
  select * into v_consent from public.consent_records where id = v_share.consent_record_id;
  insert into public.consent_records
    (user_id, consent_type, granted, text_version, text_sha256, text_lang, source, related_user_id)
  values
    (v_uid, 'trainer_share', false, coalesce(v_consent.text_version, 'trainer_share_v1'),
     v_consent.text_sha256, v_consent.text_lang, 'site', public.trainer_user_id());
  return v_share;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Lettura del formatore: solo superadmin, solo condivisioni attive, con il
--    codice caso al posto dell'identità. Ogni chiamata è nel registro.
-- ---------------------------------------------------------------------------
create or replace function public.trainer_shared_measurements()
returns table (
  share_id uuid,
  professional_id uuid,
  professional_name text,
  case_key text,
  case_code text,
  is_self boolean,
  granted_at timestamptz,
  expires_at timestamptz,
  measurement jsonb
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_shares int;
  v_rows int;
begin
  if not public.is_superadmin() then
    raise exception 'not_superadmin' using errcode = '42501';
  end if;

  select count(distinct sh.id), count(ids.mid)
    into v_shares, v_rows
    from public.trainer_shares sh
    left join lateral public.trainer_share_measurement_ids(sh.professional_id, sh.client_id) ids(mid) on true
   where sh.revoked_at is null and sh.expires_at > now();

  insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
  values (
    v_uid,
    (select p.email from public.profiles p where p.id = v_uid),
    'trainer_shared_read',
    'trainer_shares',
    null,
    jsonb_build_object('shares', v_shares, 'measurements', v_rows)
  );

  return query
  select
    sh.id,
    sh.professional_id,
    coalesce(nullif(btrim(concat_ws(' ', pp.nome, pp.cognome)), ''), pp.email),
    coalesce(sh.client_id, 'self:' || sh.professional_id::text),
    case when sh.client_id is null
      then public.trainer_case_code(pp.nome, pp.cognome, pp.data_nascita, pp.sesso, true)
      else public.trainer_case_code(c.nome, c.cognome, c.data_nascita, c.sesso, false)
    end,
    (sh.client_id is null),
    sh.granted_at,
    sh.expires_at,
    -- Elenco esplicito: solo dati di misura e di analisi. Mai user_id,
    -- client_id, rr_raw, etichette libere o colonne future.
    (select to_jsonb(x) from (
      select
        m.id, m.session_id, m.measured_at, m.measured_at_utc, m.tz_offset_minutes,
        m.duration_seconds, m.duration_type, m.test_type, m.sensor_type, m.sensor_name,
        m.age, m.sex, m.is_smoker, m.is_athlete, m.activity_level,
        m.rr_intervals, m.rr_count, m.rr_discarded, m.artifact_percentage, m.ectopic_count,
        m.signal_quality, m.incomplete, m.interruption_reason, m.coverage_ratio, m.gap_seconds,
        m.breathing_guided, m.breathing_frequency,
        m.mean_rr, m.sdnn, m.rmssd, m.pnn50, m.pnn20, m.mean_hr, m.sdnn_index, m.cv, m.rmssd_sdnn_ratio,
        m.vlf_power, m.lf_power, m.hf_power, m.total_power, m.lf_hf_ratio, m.lf_nu, m.hf_nu, m.lf_vlf_ratio,
        m.vlf_power_ls, m.lf_power_ls, m.hf_power_ls, m.total_power_ls, m.lf_hf_ratio_ls, m.lf_nu_ls, m.hf_nu_ls,
        m.sd1, m.sd2, m.sd1_sd2_ratio, m.dfa_alpha1, m.dfa_alpha2, m.sample_entropy, m.approximate_entropy,
        m.triangular_index, m.tinn, m.stress_index_baevsky,
        m.score_stress, m.score_recupero, m.score_equilibrio, m.score_energia,
        m.score_modulazione_infiammatoria, m.score_composito, m.score_source, m.algorithm_version, m.score_weights,
        m.tags, m.segments, m.rolling_series, m.orthostatic_data, m.coherence_data,
        m.created_at
    ) x)
  from public.trainer_shares sh
  join public.profiles pp on pp.id = sh.professional_id
  left join public.clients c on c.id = sh.client_id
  cross join lateral public.trainer_share_measurement_ids(sh.professional_id, sh.client_id) ids(mid)
  join public.measurement_analytics m on m.id = ids.mid
  where sh.revoked_at is null and sh.expires_at > now()
  order by lower(pp.cognome), lower(pp.nome), coalesce(sh.client_id, 'self:' || sh.professional_id::text), coalesce(m.measured_at_utc, m.measured_at) desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Permessi delle funzioni (sito-038: niente EXECUTE a PUBLIC e anon)
-- ---------------------------------------------------------------------------
revoke all on function public.trainer_user_id() from public, anon, authenticated;
revoke all on function public.trainer_case_code(text, text, date, text, boolean) from public, anon, authenticated;
revoke all on function public.trainer_share_measurement_ids(uuid, text) from public, anon, authenticated;
revoke all on function public.trainer_share_candidates() from public, anon;
revoke all on function public.trainer_share_grant(text, text, text) from public, anon;
revoke all on function public.trainer_share_revoke(uuid) from public, anon;
revoke all on function public.trainer_shared_measurements() from public, anon;
grant execute on function public.trainer_share_candidates() to authenticated, service_role;
grant execute on function public.trainer_share_grant(text, text, text) to authenticated, service_role;
grant execute on function public.trainer_share_revoke(uuid) to authenticated, service_role;
grant execute on function public.trainer_shared_measurements() to authenticated, service_role;
grant execute on function public.trainer_user_id() to service_role;
grant execute on function public.trainer_case_code(text, text, date, text, boolean) to service_role;
grant execute on function public.trainer_share_measurement_ids(uuid, text) to service_role;

commit;

-- Verifica dopo l'applicazione:
--   select has_table_privilege('anon', 'public.trainer_shares', 'select');          -- false
--   select has_table_privilege('authenticated', 'public.trainer_shares', 'delete');  -- false
--   select has_function_privilege('anon', 'public.trainer_shared_measurements()', 'execute'); -- false
--   select public.trainer_case_code('Maria', 'Rossi', '1978-03-02', 'F');          -- M.R. 1978 F
--   select public.trainer_case_code(null, null, '1975-01-01', null, true);          -- Sé stesso 1975
