-- =============================================================================
-- STRESS INDEX — 026: job orario del riepilogo delle notifiche
-- =============================================================================
--
-- ⚠️  PRIMA DI APPLICARLA VA MODIFICATA A MANO: sostituisci INCOLLA_QUI_IL_SEGRETO
--     con il valore di NOTIFY_SECRET, lo stesso passato alla Edge Function con
--     `supabase secrets set NOTIFY_SECRET=...` (vedi docs/NOTIFICHE.md).
--     Se resti col segnaposto la migration si ferma con un errore esplicito
--     invece di schedulare un job che riceverebbe sempre 401.
--
-- Perché un segreto e non la service_role key: `cron.job.command` è SQL in
-- chiaro nel database e finisce nei backup. Il segreto serve solo a dire
-- "questa chiamata viene da noi", non dà accesso a niente.
--
-- Job schedulati:
--   notifiche_riepilogo_orario  '5 * * * *'  → POST /functions/v1/notify-digest
--        Gira ogni ora a :05. La funzione chiede a notifiche_digest_da_inviare()
--        chi ha digest_hour = ora corrente nel proprio fuso e manda una sola
--        email per professionista, raggruppata per cliente. Chi non ha eventi
--        in coda non riceve niente.
--   notifiche_pulizia_giornaliera '20 3 * * *' → retention di coda e log.
--
-- Prerequisiti: 025 applicata, Edge Function notify-digest già deployata.
-- Idempotente: ri-eseguirla riscrive i job invece di duplicarli.
-- =============================================================================

-- ── 0. Estensioni ────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 1. Segreto condiviso ─────────────────────────────────────────────────────
do $$
declare
  v_segreto text := 'INCOLLA_QUI_IL_SEGRETO';
  v_url     text := 'https://ivwmjwukpeldbqkxgvvf.supabase.co/functions/v1/notify-digest';
begin
  -- Il confronto è scritto spezzato apposta: così una sostituzione globale del
  -- segnaposto tocca solo la riga sopra e questo controllo resta valido.
  if v_segreto = 'INCOLLA_QUI_IL_' || 'SEGRETO' then
    raise exception
      '026: sostituisci INCOLLA_QUI_IL_SEGRETO con il valore di NOTIFY_SECRET prima di applicare questa migration.';
  end if;

  -- Il comando del job viene composto qui così il segreto compare una volta sola.
  perform cron.unschedule(jobid) from cron.job where jobname = 'notifiche_riepilogo_orario';

  perform cron.schedule(
    'notifiche_riepilogo_orario',
    '5 * * * *',
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type',    'application/json',
          'x-notify-secret', %L
        ),
        body    := jsonb_build_object('mode', 'digest'),
        timeout_milliseconds := 120000
      );
      $job$,
      v_url, v_segreto
    )
  );
end $$;

-- ── 2. Pulizia giornaliera ───────────────────────────────────────────────────
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'notifiche_pulizia_giornaliera';
  perform cron.schedule(
    'notifiche_pulizia_giornaliera',
    '20 3 * * *',
    $job$ select public.notifiche_pulizia(); $job$
  );
exception when others then
  raise notice '026.2 pulizia non schedulata: %', sqlerrm;
end $$;

-- ── 3. Verifica ──────────────────────────────────────────────────────────────
select jobname, schedule, active
from cron.job
where jobname in ('notifiche_riepilogo_orario', 'notifiche_pulizia_giornaliera');
