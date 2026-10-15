-- =============================================================================
-- sito-037: marca i doppioni di alert già esistenti (nessuna cancellazione)
-- =============================================================================
-- Audit QA 14/10/2026, punto C6 (c). **PROPOSTA: NON APPLICARE SENZA IL VIA
-- LIBERA DI MASSIMO.** Richiede la sito-036 (stato `duplicate`).
--
-- Al 15/10/2026: 2652 alert tutti `new`; 843 gruppi (cliente, metrica, valore)
-- con più di una riga, 44 nel solo account di Massimo. Per ogni gruppo resta
-- `new` la riga PIÙ VECCHIA; le altre passano a `duplicate`. Nessun DELETE.
--
-- Come si annulla
--   update alerts set status = 'new' where status = 'duplicate';
--   (la tabella `alerts_doppioni_20261015` tiene l'elenco degli id toccati)
-- =============================================================================

begin;

create table if not exists public.alerts_doppioni_20261015 (
  alert_id uuid primary key,
  tenuto_id uuid not null,
  marcato_il timestamptz not null default now()
);

with gruppi as (
  select id,
         first_value(id) over (partition by client_id, triggering_metric, triggering_value
                               order by created_at asc, id asc) as tenuto_id,
         row_number()   over (partition by client_id, triggering_metric, triggering_value
                               order by created_at asc, id asc) as n
  from public.alerts
  where status in ('new', 'seen')
    and triggering_value is not null
)
insert into public.alerts_doppioni_20261015 (alert_id, tenuto_id)
select id, tenuto_id from gruppi where n > 1
on conflict (alert_id) do nothing;

-- Stessa regola per "misurazione mancata" (valore nullo): la vecchia finestra
-- di 3 giorni ne rigenerava uno ogni 3 giorni per la stessa scheda (29 aperti
-- per la scheda 1781008437594 al 15/10). Resta aperto il più vecchio.
-- Aggiunto il 15/10 dopo la prima verifica, su indicazione di Massimo.
with gruppi as (
  select id,
         first_value(id) over (partition by client_id, type order by created_at asc, id asc) as tenuto_id,
         row_number()   over (partition by client_id, type order by created_at asc, id asc) as n
  from public.alerts
  where status in ('new', 'seen')
    and type = 'missed_measurement'
)
insert into public.alerts_doppioni_20261015 (alert_id, tenuto_id)
select id, tenuto_id from gruppi where n > 1
on conflict (alert_id) do nothing;

update public.alerts a
   set status = 'duplicate'
  from public.alerts_doppioni_20261015 d
 where d.alert_id = a.id
   and a.status in ('new', 'seen');

commit;

-- Verifica:
--   select count(*) from alerts where status = 'duplicate';            -- atteso circa 1300
--   select count(*) from (select client_id, type, triggering_metric, triggering_value
--     from alerts where status in ('new','seen') group by 1,2,3,4 having count(*) > 1) x;  -- atteso 0
