-- =============================================================================
-- sito-036: alert del cron senza doppioni, con risoluzione automatica
-- =============================================================================
-- Audit QA 14/10/2026, punto C6. **RICHIEDE IL VIA LIBERA DI MASSIMO**
-- (riscrive la funzione del cron e cambia un vincolo).
--
-- Perché nascono i doppioni (verificato su Doretta Sabbatini, 07 e 08/10):
--   `generate_threshold_alerts()` gira OGNI ORA (cron.job 1, `0 * * * *`) e
--   prende le misurazioni con `measured_at > now() - 24h`. Ma `measured_at` è
--   la forma legacy, avanti di 2 ore rispetto all'istante vero; la finestra di
--   dedup invece guarda `alerts.created_at > now() - 24h`. Alle 09:00 del giorno
--   dopo l'alert delle 09:00:00.1 di ieri è appena fuori finestra, la
--   misurazione delle 10:37 legacy è ancora dentro: nasce la copia.
--
-- Cosa fa
--   1. `alerts.session_id` (text): la misurazione che ha fatto scattare
--      l'alert. Indice unico parziale (session_id, triggering_metric): una
--      misurazione può generare al massimo un alert per metrica, per sempre.
--   2. Lo stato ammette anche `duplicate` (serve alla sito-037, che marca i
--      doppioni già esistenti senza cancellarli).
--   3. `generate_threshold_alerts()` riscritta: un solo giro sui quattro score,
--      istante vero (`coalesce(measured_at_utc, measured_at)`), inserimento
--      `on conflict do nothing`, dedup di riserva per le righe vecchie senza
--      session_id (stesso cliente, stessa metrica, stesso valore, aperto).
--   4. Risoluzione automatica: se l'ultima misurazione del cliente ha la
--      metrica rientrata nella soglia, gli alert aperti su quella metrica e più
--      vecchi della misurazione passano a `resolved` con `resolved_at`.
--      "Alert risolti" in home smette di valere sempre zero.
--   5. `generate_missed_measurement_alerts()`: solo il dedup di riserva e la
--      chiusura automatica quando arriva una misurazione.
--
-- Come si annulla
--   Le due funzioni si ripristinano dalla sito-002 (`supabase-migrations/
--   sito-002_pg_cron_alerts.sql`). La colonna, l'indice e il vincolo allargato
--   non danno fastidio se restano.
--
-- Idempotente.
-- =============================================================================

begin;

alter table public.alerts add column if not exists session_id text;

create unique index if not exists alerts_una_per_misurazione_e_metrica
  on public.alerts (session_id, triggering_metric)
  where session_id is not null;

create index if not exists alerts_client_metric_aperti
  on public.alerts (client_id, triggering_metric)
  where status in ('new', 'seen');

alter table public.alerts drop constraint if exists alerts_status_check;
alter table public.alerts add constraint alerts_status_check
  check (status = any (array['new', 'seen', 'resolved', 'dismissed', 'duplicate']));

-- -----------------------------------------------------------------------------
create or replace function public.generate_threshold_alerts()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  r record;
  v_type text;
  v_sev  text;
  v_msg  text;
begin
  -- 1. Nuovi alert sulle misurazioni delle ultime 24 ore (istante vero).
  for r in
    with recenti as (
      select ma.session_id, ma.client_id, c.professionista_id,
             coalesce(ma.measured_at_utc, ma.measured_at) as istante,
             ma.score_stress, ma.score_recupero, ma.score_equilibrio, ma.score_energia,
             coalesce(cs.alert_threshold_stress,   80) as t_stress,
             coalesce(cs.alert_threshold_recovery, 30) as t_recupero,
             coalesce(cs.alert_threshold_balance,  30) as t_equilibrio,
             coalesce(cs.alert_threshold_energy,   30) as t_energia
      from public.measurement_analytics ma
      join public.clients c on c.id = ma.client_id
      left join public.client_settings cs on cs.client_id = ma.client_id
      where coalesce(ma.measured_at_utc, ma.measured_at) > now() - interval '24 hours'
        and ma.client_id is not null
        and c.professionista_id is not null
    )
    select session_id, client_id, professionista_id, 'score_stress' as metrica, score_stress as valore, t_stress as soglia, true as sopra
      from recenti where score_stress is not null and score_stress > t_stress
    union all
    select session_id, client_id, professionista_id, 'score_recupero', score_recupero, t_recupero, false
      from recenti where score_recupero is not null and score_recupero < t_recupero
    union all
    select session_id, client_id, professionista_id, 'score_equilibrio', score_equilibrio, t_equilibrio, false
      from recenti where score_equilibrio is not null and score_equilibrio < t_equilibrio
    union all
    select session_id, client_id, professionista_id, 'score_energia', score_energia, t_energia, false
      from recenti where score_energia is not null and score_energia < t_energia
  loop
    case r.metrica
      when 'score_stress'     then v_type := 'high_stress';    v_sev := 'high';   v_msg := 'Indice di Stress elevato: '    || round(r.valore::numeric, 1)::text || ' (soglia ' || r.soglia::text || ')';
      when 'score_recupero'   then v_type := 'low_recovery';   v_sev := 'medium'; v_msg := 'Indice di Recupero basso: '    || round(r.valore::numeric, 1)::text || ' (soglia ' || r.soglia::text || ')';
      when 'score_equilibrio' then v_type := 'abnormal_value'; v_sev := 'medium'; v_msg := 'Indice di Equilibrio basso: '  || round(r.valore::numeric, 1)::text;
      else                         v_type := 'abnormal_value'; v_sev := 'medium'; v_msg := 'Indice di Energia basso: '     || round(r.valore::numeric, 1)::text;
    end case;

    insert into public.alerts (professional_id, client_id, type, severity, message, triggering_value, triggering_metric, session_id)
    select r.professionista_id, r.client_id, v_type, v_sev, v_msg, r.valore, r.metrica, r.session_id
    where not exists (
      -- dedup di riserva per gli alert nati prima della sito-036 (senza session_id)
      select 1 from public.alerts a
      where a.client_id = r.client_id
        and a.triggering_metric = r.metrica
        and a.status in ('new', 'seen')
        and a.session_id is null
        and a.triggering_value = r.valore
    )
    on conflict (session_id, triggering_metric) where session_id is not null do nothing;
  end loop;

  -- 2. Risoluzione automatica: l'ultima misurazione del cliente è rientrata.
  update public.alerts a
     set status = 'resolved', resolved_at = now()
    from (
      select distinct on (ma.client_id)
             ma.client_id,
             coalesce(ma.measured_at_utc, ma.measured_at) as istante,
             ma.score_stress, ma.score_recupero, ma.score_equilibrio, ma.score_energia,
             coalesce(cs.alert_threshold_stress,   80) as t_stress,
             coalesce(cs.alert_threshold_recovery, 30) as t_recupero,
             coalesce(cs.alert_threshold_balance,  30) as t_equilibrio,
             coalesce(cs.alert_threshold_energy,   30) as t_energia
      from public.measurement_analytics ma
      left join public.client_settings cs on cs.client_id = ma.client_id
      where ma.client_id is not null
        and coalesce(ma.measured_at_utc, ma.measured_at) > now() - interval '48 hours'
      order by ma.client_id, coalesce(ma.measured_at_utc, ma.measured_at) desc
    ) u
   where a.client_id = u.client_id
     and a.status in ('new', 'seen')
     and a.created_at < u.istante
     and (
          (a.triggering_metric = 'score_stress'     and u.score_stress     is not null and u.score_stress     <= u.t_stress)
       or (a.triggering_metric = 'score_recupero'   and u.score_recupero   is not null and u.score_recupero   >= u.t_recupero)
       or (a.triggering_metric = 'score_equilibrio' and u.score_equilibrio is not null and u.score_equilibrio >= u.t_equilibrio)
       or (a.triggering_metric = 'score_energia'    and u.score_energia    is not null and u.score_energia    >= u.t_energia)
     );
end;
$$;

-- -----------------------------------------------------------------------------
create or replace function public.generate_missed_measurement_alerts()
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  r record;
  expected_interval_days numeric;
begin
  -- Chiusura automatica: la scheda ha misurato dopo l'alert.
  update public.alerts a
     set status = 'resolved', resolved_at = now()
    from public.clients c
   where c.id = a.client_id
     and a.type = 'missed_measurement'
     and a.status in ('new', 'seen')
     and c.last_measurement_at is not null
     and c.last_measurement_at > a.created_at;

  for r in
    select c.id as client_id, c.professionista_id as professional_id,
           c.last_measurement_at, cs.expected_frequency_per_week
    from public.clients c
    join public.client_settings cs on cs.client_id = c.id
    where cs.expected_frequency_per_week is not null
      and cs.expected_frequency_per_week > 0
      and c.professionista_id is not null
      and c.merged_into_client_id is null
  loop
    expected_interval_days := (7.0 / r.expected_frequency_per_week) * 2;

    if r.last_measurement_at is null
       or r.last_measurement_at < now() - (expected_interval_days || ' days')::interval then
      insert into public.alerts (professional_id, client_id, type, severity, message, triggering_metric)
      select r.professional_id, r.client_id, 'missed_measurement', 'low',
             case when r.last_measurement_at is null then 'Cliente non ha mai misurato'
                  else 'Ultima misurazione: ' || to_char(r.last_measurement_at at time zone 'Europe/Rome', 'DD/MM/YYYY')
                       || ' (oltre ' || expected_interval_days::int::text || ' giorni)' end,
             'last_measurement_at'
      where not exists (
        -- un solo alert aperto di "misurazione mancata" per scheda
        select 1 from public.alerts a
        where a.client_id = r.client_id
          and a.type = 'missed_measurement'
          and a.status in ('new', 'seen')
      );
    end if;
  end loop;
end;
$$;

commit;

-- Verifica (dopo un giro del cron, o lanciando `select generate_threshold_alerts();`):
--   select count(*) from (select client_id, triggering_metric, triggering_value
--     from alerts where status in ('new','seen') group by 1,2,3 having count(*) > 1) x;
--   -- i gruppi vecchi restano finché non si applica la sito-037; nessun gruppo nuovo
