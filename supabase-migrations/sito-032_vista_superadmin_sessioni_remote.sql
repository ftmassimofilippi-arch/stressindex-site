-- =============================================================================
-- sito-032 — le misurazioni remote nella vista "come un altro professionista"
-- =============================================================================
-- Da applicare a mano nel SQL Editor di Supabase. Idempotente. Nessuna
-- dipendenza da migrazioni del repo hrv_app, nessuna modifica ai dati: crea
-- quattro funzioni di sola lettura e non tocca una riga di `sessions`.
--
-- PERCHÉ
-- Una misurazione fatta dal cliente sulla sua app si salva, per progetto, con
--   sessions.professionista_id = uid del CLIENTE
--   sessions.client_id        = NULL
-- (vedi `SyncService._sessionToRow` nell'app e `measurement_subject.dart`).
-- Il professionista collegato le vede perché la 019 gli dà due vie: la policy
-- `professional_reads_linked_client_sessions` e la RPC
-- `get_linked_client_sessions_by_client_id`. Entrambe partono da `auth.uid()`.
--
-- Quando un SUPERADMIN apre la scheda di un cliente di un altro professionista
-- (`?professionista=UUID`, risolto da `resolveViewingProfessional`) quelle due
-- vie non portano da nessuna parte: `auth.uid()` è il superadmin, che con quel
-- cliente non ha alcun collegamento. La query diretta trova 0 righe perché
-- `client_id` è NULL, la RPC trova 0 righe perché il link non è suo, e la
-- scheda risulta VUOTA — mentre al professionista proprietario la stessa
-- scheda mostra tutto. Verificato in produzione sulla scheda 1789282977721:
-- 14 misurazioni viste dal proprietario, 0 viste dal superadmin.
-- Lo stesso vale per un owner/admin di organizzazione che guarda la scheda di
-- un cliente di un proprio membro attivo.
--
-- COME
-- Non si allargano le policy né le RPC esistenti: il professionista
-- proprietario continua a passare esattamente da dove passa oggi. Si
-- aggiungono quattro funzioni che prendono il professionista come PARAMETRO e
-- ne autorizzano la lettura con `puo_vedere_come_professionista`, che
-- riproduce in SQL le stesse due condizioni che `resolveViewingProfessional`
-- applica in TypeScript. Il corpo delle tre funzioni di lettura è quello della
-- 019 con `p_professional_id` al posto di `auth.uid()`.
--
-- Chi non è autorizzato riceve un errore 42501, NON una lista vuota: una lista
-- vuota è il modo in cui questo stesso problema è passato inosservato per
-- settimane, perché una scheda senza misurazioni e una scheda non autorizzata
-- si assomigliano troppo. Il lettore lato sito logga l'errore e degrada alle
-- sole misurazioni dirette.
--
-- Nessun EXCEPTION WHEN OTHERS qui: la regola del progetto vale per i trigger
-- derivati, che non devono far fallire la scrittura primaria. Queste sono
-- letture, e un lettore che si inghiotte gli errori è il difetto che stiamo
-- chiudendo.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Chi può guardare i dati di quale professionista
-- ─────────────────────────────────────────────────────────────────────────────
-- Tre casi, in ordine:
--   a) sé stesso — così le funzioni parametriche sono usabili anche nella
--      vista "propria", senza un ramo in più lato sito;
--   b) superadmin — sola lettura su qualsiasi professionista
--      (`profiles.is_superadmin`, come `is_superadmin()`);
--   c) owner/admin di organizzazione — solo sui membri ATTIVI della propria
--      organizzazione, come `getOrgMembersStats()`.
create or replace function public.puo_vedere_come_professionista(
  p_professional_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $BODY$
  select
    p_professional_id is not null
    and auth.uid() is not null
    and (
      -- a) sé stesso
      p_professional_id = auth.uid()
      -- b) superadmin
      or coalesce((select p.is_superadmin from public.profiles p
                    where p.id = auth.uid()), false)
      -- c) owner/admin della stessa organizzazione, sul membro attivo
      or exists (
        select 1
          from public.organization_members me
          join public.organization_members target
            on target.organization_id = me.organization_id
         where me.user_id = auth.uid()
           and me.status  = 'active'
           and me.role in ('owner', 'admin')
           and target.user_id = p_professional_id
           and target.status  = 'active'
      )
    );
$BODY$;

comment on function public.puo_vedere_come_professionista(uuid) is
  'True se chi chiama può leggere i dati di p_professional_id: sé stesso, '
  'superadmin, oppure owner/admin della stessa organizzazione su un membro '
  'attivo. Riproduce resolveViewingProfessional del sito.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Le misurazioni remote di UNA scheda, per conto del professionista
-- ─────────────────────────────────────────────────────────────────────────────
-- Corpo della 019 (`get_linked_client_sessions_by_client_id`) con
-- `p_professional_id` al posto di `auth.uid()`. Restano identici:
--   - `l.status = 'active'`: un collegamento revocato non fa vedere niente, e
--     la verifica avviene a ogni chiamata, quindi una revoca ha effetto subito;
--   - il ponte scheda↔account per `clients.client_user_id`, con i ripieghi per
--     email e per `clients.id = profiles.id::text`;
--   - `s.client_id is null`: le sessioni in studio le trova già la query
--     diretta del sito, qui si cercano solo le remote;
--   - `merged_into_client_id is null`: le schede archiviate non leggono.
create or replace function public.get_linked_client_sessions_as_professional(
  p_professional_id uuid,
  p_client_id       text
)
returns setof public.sessions
language plpgsql
stable
security definer
set search_path = public
as $BODY$
begin
  if not public.puo_vedere_come_professionista(p_professional_id) then
    raise exception 'non autorizzato a leggere i dati del professionista %',
      p_professional_id
      using errcode = '42501';
  end if;

  return query
    select s.*
      from public.clients c
      join public.client_professional_links l
        on l.professional_id = p_professional_id
       and l.status = 'active'
      join public.profiles p
        on p.id = l.client_user_id
       and (c.client_user_id = p.id
            or (c.client_user_id is null
                and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
      join public.sessions s
        on s.professionista_id = p.id
       and s.client_id is null
     where c.id = p_client_id
       and c.professionista_id = p_professional_id
       and c.merged_into_client_id is null
     order by s.started_at desc;
end;
$BODY$;

comment on function public.get_linked_client_sessions_as_professional(uuid, text) is
  'Come get_linked_client_sessions_by_client_id, ma per il professionista '
  'passato come parametro: serve alla vista superadmin/org del sito. '
  'Autorizzata da puo_vedere_come_professionista, errore 42501 se no.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ultima sessione remota per scheda (lista clienti)
-- ─────────────────────────────────────────────────────────────────────────────
-- Senza questa, nella vista superadmin la lista clienti mostra "—" nella
-- colonna dell'ultima misurazione per chi misura solo dalla propria app:
-- `clients.last_measurement_at` lo scrive solo il trigger delle sessioni in
-- studio. Il commento in `listClientsEnriched` dichiarava già il buco.
create or replace function public.get_linked_clients_last_remote_session_as_professional(
  p_professional_id uuid
)
returns table(client_id text, last_remote_at timestamptz, remote_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $BODY$
begin
  if not public.puo_vedere_come_professionista(p_professional_id) then
    raise exception 'non autorizzato a leggere i dati del professionista %',
      p_professional_id
      using errcode = '42501';
  end if;

  return query
    select c.id, max(coalesce(s.started_at, s.created_at)), count(s.id)
      from public.clients c
      join public.client_professional_links l
        on l.professional_id = p_professional_id
       and l.status = 'active'
      join public.profiles p
        on p.id = l.client_user_id
       and (c.client_user_id = p.id
            or (c.client_user_id is null
                and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
      join public.sessions s
        on s.professionista_id = p.id
       and s.client_id is null
     where c.professionista_id = p_professional_id
       and c.merged_into_client_id is null
     group by c.id;
end;
$BODY$;

comment on function public.get_linked_clients_last_remote_session_as_professional(uuid) is
  'Come get_linked_clients_last_remote_session, per il professionista passato '
  'come parametro (vista superadmin/org del sito).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Ultima misurazione remota CON gli score (colonna Stress della lista)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_linked_clients_last_remote_analytics_as_professional(
  p_professional_id uuid
)
returns table(client_id text, analytics public.measurement_analytics)
language plpgsql
stable
security definer
set search_path = public
as $BODY$
begin
  if not public.puo_vedere_come_professionista(p_professional_id) then
    raise exception 'non autorizzato a leggere i dati del professionista %',
      p_professional_id
      using errcode = '42501';
  end if;

  return query
    select distinct on (c.id) c.id, ma
      from public.clients c
      join public.client_professional_links l
        on l.professional_id = p_professional_id
       and l.status = 'active'
      join public.profiles p
        on p.id = l.client_user_id
       and (c.client_user_id = p.id
            or (c.client_user_id is null
                and (lower(p.email) = lower(c.email) or c.id = p.id::text)))
      join public.sessions s
        on s.professionista_id = p.id
       and s.client_id is null
      join public.measurement_analytics ma
        on ma.session_id = s.id
     where c.professionista_id = p_professional_id
       and c.merged_into_client_id is null
     order by c.id, coalesce(s.started_at, s.created_at) desc;
end;
$BODY$;

comment on function public.get_linked_clients_last_remote_analytics_as_professional(uuid) is
  'Come get_linked_clients_last_remote_analytics, per il professionista '
  'passato come parametro (vista superadmin/org del sito).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Permessi
-- ─────────────────────────────────────────────────────────────────────────────
-- Solo `authenticated` e `service_role`: `anon` non deve poter chiedere nulla,
-- e l'autorizzazione vera è dentro le funzioni, non nel grant.
revoke all on function public.puo_vedere_come_professionista(uuid) from public;
revoke all on function public.get_linked_client_sessions_as_professional(uuid, text) from public;
revoke all on function public.get_linked_clients_last_remote_session_as_professional(uuid) from public;
revoke all on function public.get_linked_clients_last_remote_analytics_as_professional(uuid) from public;

grant execute on function public.puo_vedere_come_professionista(uuid)
  to authenticated, service_role;
grant execute on function public.get_linked_client_sessions_as_professional(uuid, text)
  to authenticated, service_role;
grant execute on function public.get_linked_clients_last_remote_session_as_professional(uuid)
  to authenticated, service_role;
grant execute on function public.get_linked_clients_last_remote_analytics_as_professional(uuid)
  to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Verifica (da eseguire dopo, sostituendo gli id)
-- ─────────────────────────────────────────────────────────────────────────────
--   select count(*) from get_linked_client_sessions_as_professional(
--     '1adfd1cd-cc61-4753-a36d-314ae4e0b179', '1789282977721');
-- Atteso 14 chiamandola come superadmin o come Andrea Ponghetti; errore 42501
-- chiamandola come un professionista qualsiasi.
