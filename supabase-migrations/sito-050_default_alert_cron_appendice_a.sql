-- =============================================================================
-- sito-050: default delle soglie del cron allineati all'Appendice A del manuale
-- =============================================================================
-- Allineamento del 23/10/2026 (DECISIONI.md, decisione 19 e punti B7/C6 della
-- matrice). NON ANCORA APPLICATA: si applica a mano nel SQL Editor dopo il via
-- libera di Massimo, perché cambia quali clienti fanno scattare un alert.
--
-- Cosa fa
--   1. Default delle colonne di `client_settings` (sito-001):
--        alert_threshold_stress    80 -> 70   (= stress_high_chronic dell'app)
--        alert_threshold_recovery  30 -> 25   (= recovery_low dell'app)
--        alert_threshold_balance   30 -> 25
--        alert_threshold_energy    30 -> 25
--      Gli stessi numeri stanno in `CRON_ALERT_DEFAULTS` (src/lib/alert-rules.ts)
--      e nei default delle regole `alert_rules` dell'app (lib/models/alert.dart).
--   2. `generate_threshold_alerts()`: i `coalesce(..., 80|30)` di riserva usano
--      i default nuovi (70/25). Il corpo è quello della sito-036, cambiano solo
--      i numeri.
--   3. `generate_missed_measurement_alerts()`: il margine sull'intervallo
--      atteso passa da x2 a x1,5, lo stesso fattore di "da contattare" nella
--      home (src/lib/dashboard-data.ts, `CRON_ALERT_DEFAULTS.missedMeasurementFactor`).
--      Il corpo è quello della sito-036, cambia solo il fattore.
--
-- Righe già esistenti in `client_settings`
--   Il default di colonna vale solo per le righe nuove. Le righe salvate con il
--   vecchio default (80/30) restano a 80/30: non si distingue un 80 scelto dal
--   professionista da un 80 ereditato dal default. Se Massimo vuole portarle
--   tutte ai valori nuovi, c'è l'UPDATE facoltativo in fondo, commentato.
--
-- Come si annulla
--   `alter table public.client_settings alter column alert_threshold_stress set default 80;`
--   (e 30 per le altre tre); le due funzioni si ripristinano dalla sito-036.
--
-- Idempotente.
-- =============================================================================

begin;

-- 1. Default delle colonne --------------------------------------------------
alter table public.client_settings alter column alert_threshold_stress   set default 70;
alter table public.client_settings alter column alert_threshold_recovery set default 25;
alter table public.client_settings alter column alert_threshold_balance  set default 25;
alter table public.client_settings alter column alert_threshold_energy   set default 25;

-- 2. generate_threshold_alerts: default di riserva 70/25 -------------------
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
             coalesce(cs.alert_threshold_stress,   70) as t_stress,
             coalesce(cs.alert_threshold_recovery, 25) as t_recupero,
             coalesce(cs.alert_threshold_balance,  25) as t_equilibrio,
             coalesce(cs.alert_threshold_energy,   25) as t_energia
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
             coalesce(cs.alert_threshold_stress,   70) as t_stress,
             coalesce(cs.alert_threshold_recovery, 25) as t_recupero,
             coalesce(cs.alert_threshold_balance,  25) as t_equilibrio,
             coalesce(cs.alert_threshold_energy,   25) as t_energia
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

-- 3. generate_missed_measurement_alerts: margine x1,5 come la home ---------
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
    -- Intervallo atteso (7 / frequenza settimanale) con margine x1,5: lo
    -- stesso fattore di "da contattare" nella home del sito.
    expected_interval_days := (7.0 / r.expected_frequency_per_week) * 1.5;

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

-- Facoltativo, solo con il via libera di Massimo: porta ai valori nuovi le
-- righe rimaste al vecchio default (sovrascrive anche un 80 o 30 scelto a mano).
-- update public.client_settings set alert_threshold_stress   = 70 where alert_threshold_stress   = 80;
-- update public.client_settings set alert_threshold_recovery = 25 where alert_threshold_recovery = 30;
-- update public.client_settings set alert_threshold_balance  = 25 where alert_threshold_balance  = 30;
-- update public.client_settings set alert_threshold_energy   = 25 where alert_threshold_energy   = 30;

-- Verifica:
--   select column_name, column_default from information_schema.columns
--    where table_name = 'client_settings' and column_name like 'alert_threshold_%';
--   select prosrc like '%* 1.5%' from pg_proc where proname = 'generate_missed_measurement_alerts';
