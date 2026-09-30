-- =============================================================================
-- sito-030 — data di lettura delle notifiche, per singolo utente
-- =============================================================================
--
-- DA APPLICARE A MANO nel SQL Editor di Supabase. Idempotente: rieseguirla non
-- cambia nulla. Indipendente dalla sito-029.
--
-- PERCHÉ UNA TABELLA A PARTE
--
-- La campanella della dashboard unisce due sorgenti:
--   `alerts`        alert del cron del sito, con `status` (new | seen |
--                   resolved | dismissed) e `seen_at`;
--   `alert_events`  eventi valutati dall'app, con il booleano `read`.
--
-- Nessuna delle due si tocca:
--   • `alert_events.read` lo scrive l'APP: se lo scrivesse anche il sito, le
--     due basi si contenderebbero la stessa colonna;
--   • `alerts.status` porta anche `resolved` e `dismissed`, cioè il ciclo di
--     vita dell'alert, che non è "l'ho letto";
--   • oggi la RLS mostra ogni riga al solo proprietario, ma il sito ha già la
--     vista superadmin in sola lettura e le viste di organizzazione, e la
--     sito-010 prevede di aggiungere la lettura superadmin su `alerts`. Con un
--     flag globale la lettura di un osservatore azzererebbe il contatore del
--     professionista titolare.
--
-- Quindi: si AGGIUNGE soltanto la data di lettura, per coppia (utente,
-- notifica). Niente viene cancellato né modificato, lo storico resta intero e
-- la campanella conta le non lette di chi guarda.

-- ── 1. Registro delle letture ────────────────────────────────────────────────
create table if not exists public.notification_reads (
  -- Chi ha letto. Una notifica visibile a più utenti ha una riga per ciascuno.
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Da quale tabella viene la notifica: 'cron' = alerts, 'app' = alert_events.
  -- I due insiemi di id sono indipendenti, quindi la sorgente fa parte della
  -- chiave. Non è una FK: se una notifica sparisce, la riga di lettura resta
  -- innocua e non blocca la cancellazione.
  source          text not null,
  notification_id uuid not null,
  -- Prima lettura. Non si aggiorna: "letta il" è una data sola.
  read_at         timestamptz not null default now(),
  primary key (user_id, source, notification_id)
);

do $$
begin
  alter table public.notification_reads
    drop constraint if exists notification_reads_source_check;
  alter table public.notification_reads
    add constraint notification_reads_source_check
    check (source in ('cron', 'app'));

  -- Il conteggio delle non lette parte sempre da "le letture di questo utente".
  create index if not exists notification_reads_user
    on public.notification_reads (user_id, read_at desc);

  comment on table public.notification_reads is
    'Data di lettura delle notifiche della campanella, per singolo utente. Solo aggiunta: non modifica né cancella alerts o alert_events.';
  comment on column public.notification_reads.source is
    'cron = public.alerts | app = public.alert_events';
exception when others then
  raise notice 'sito-030.1 notification_reads non completata: %', sqlerrm;
end $$;

-- ── 2. RLS: ognuno vede e scrive solo le proprie letture ─────────────────────
--
-- Nessuna policy di UPDATE: `read_at` è la PRIMA lettura e non si riscrive
-- (il sito inserisce con ON CONFLICT DO NOTHING). Nessuna policy di DELETE:
-- dall'API le letture non si cancellano; restano solo il `on delete cascade`
-- quando l'account sparisce. Nemmeno il superadmin legge questa tabella: le
-- letture altrui non servono a nessuna vista.
do $$
begin
  alter table public.notification_reads enable row level security;

  drop policy if exists "notification_reads_own_select" on public.notification_reads;
  create policy "notification_reads_own_select" on public.notification_reads
    for select using (auth.uid() = user_id);

  drop policy if exists "notification_reads_own_insert" on public.notification_reads;
  create policy "notification_reads_own_insert" on public.notification_reads
    for insert with check (auth.uid() = user_id);
exception when others then
  raise notice 'sito-030.2 RLS notification_reads non applicata: %', sqlerrm;
end $$;

-- ── 3. `read_at` non si riscrive ─────────────────────────────────────────────
--
-- Vale anche per la service_role e per il proprietario della tabella, come nel
-- registro accessi della sito-027: "letta il" è la PRIMA lettura e resta quella.
--
-- Il trigger copre solo l'UPDATE, NON il DELETE. Un trigger sul DELETE
-- bloccherebbe anche il `on delete cascade` della FK verso `auth.users` e
-- farebbe fallire la cancellazione di un account, che la sito-028 ha appena
-- sistemato. Verificato su Postgres 16: con il DELETE bloccato,
-- `delete from auth.users` esce con "sola aggiunta: DELETE non consentita".
-- La cancellazione delle letture insieme all'account è comunque il
-- comportamento giusto; per tutti gli altri casi la RLS non espone nessuna
-- policy di DELETE, quindi nessun utente può cancellarle dall'API.
create or replace function public.notification_reads_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'notification_reads: % non consentita, read_at è la prima lettura', tg_op;
end
$$;

do $$
begin
  drop trigger if exists notification_reads_no_update on public.notification_reads;
  create trigger notification_reads_no_update
    before update on public.notification_reads
    for each row execute function public.notification_reads_append_only();
exception when others then
  raise notice 'sito-030.3 trigger su UPDATE non creato: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- ── Verifica ─────────────────────────────────────────────────────────────────
--   SELECT count(*) FROM notification_reads;                 -- 0 appena applicata
--   SELECT * FROM pg_policies WHERE tablename = 'notification_reads';
--
-- Nessun dato di `alerts` o `alert_events` è stato toccato:
--   SELECT count(*) FILTER (WHERE status = 'new') AS nuovi FROM alerts;
--   SELECT count(*) FILTER (WHERE NOT read)       AS non_letti FROM alert_events;
