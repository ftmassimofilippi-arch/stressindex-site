-- =============================================================================
-- sito-031 — collegamento IN ATTESA di conferma del cliente
-- =============================================================================
-- Da applicare a mano nel SQL Editor di Supabase. Idempotente.
--
-- ⚠️ ORDINE: PRIMA `app-035_conferma_collegamento_cliente.sql` (repo hrv_app),
-- POI questa. Non è una preferenza, è una dipendenza in due sensi:
--
--   1. questa funzione scrive `requested_by`, che è la colonna creata da
--      app-035: senza quella colonna la RPC esiste ma fallisce con 42703 alla
--      prima chiamata;
--   2. peggio, app-035 fa un backfill `requested_by = client_user_id` su tutte
--      le righe dove è NULL, con l'assunzione — vera finché questa migrazione
--      non è applicata — che i soli pending esistenti li abbia chiesti il
--      cliente. Un link pending creato da un professionista PRIMA di app-035
--      verrebbe backfillato come se l'avesse chiesto il cliente, e all'app non
--      comparirebbe mai fra le richieste da accettare: una richiesta persa, in
--      silenzio, senza errori.
--
-- Il controllo qui sotto impedisce di applicarla nell'ordine sbagliato.
--
-- PERCHÉ
-- Quando il professionista inserisce come cliente una email che ha GIÀ un
-- account app, non c'è nessun giro di posta che provi il consenso
-- dell'intestatario: con un invito nuovo il consenso è la persona che clicca
-- il link, qui non esiste. Creare un link `active` esporrebbe lo storico HRV
-- di quella persona a chi ne conosce l'indirizzo email.
--
-- Il collegamento nasce quindi `pending` con `requested_by = professional_id`:
-- la riga esiste, il professionista vede "in attesa di conferma", e NON passa
-- un solo dato. Tutte le policy della 019 sono agganciate a
-- `status = 'active'`, quindi pending non legge niente. La conferma la dà il
-- cliente dall'app con `client_respond_to_link` (app-035), che mostra
-- Accetta/Rifiuta proprio quando `requested_by = professional_id`; il
-- superadmin resta la via di riserva dal pannello Collegamenti.
--
-- COME, senza aprire una seconda strada di scrittura
-- La regola del progetto è che ogni scrittura dei collegamenti passi da
-- `link_client_to_professional`. Questa funzione NON la sostituisce e non la
-- modifica: la chiama, e subito dopo riporta a `pending` il link che quella ha
-- creato o riattivato, scrivendo `requested_by`. Essere il corpo di una
-- funzione rende i due passi una sola transazione: non esiste un istante in
-- cui il link è `active` e visibile a qualcuno.
--
-- Un link GIÀ `active` prima della chiamata non viene mai abbassato: un
-- consenso dato non si ritira per un click di troppo. E un `pending` chiesto
-- DAL CLIENTE non viene riscritto come se l'avesse chiesto il professionista:
-- resta in attesa di chi doveva rispondere davvero.
--
-- Il trigger `cpl_client_cambia_solo_stato` di app-035 non intralcia: scatta
-- solo quando `auth.uid()` è il lato cliente, e questa RPC è eseguibile solo
-- dalla service_role, dove `auth.uid()` è NULL.

-- ── Prerequisito: app-035 ────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'client_professional_links'
       and column_name  = 'requested_by'
  ) then
    raise exception
      'sito-031 richiede la colonna requested_by: applicare PRIMA app-035_conferma_collegamento_cliente.sql (repo hrv_app). Nessuna modifica eseguita.';
  end if;
end $$;

create or replace function public.request_client_link(
  p_client_user_id uuid,
  p_professional_id uuid,
  p_source text default 'request'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  v_res        jsonb;
  v_action     text;
  v_link_id    uuid;
  v_prima      public.client_professional_links;
  v_chiesto_da uuid;
begin
  -- Stato PRIMA di toccare niente: serve a non riscrivere `requested_by` di un
  -- pending che aveva chiesto il cliente.
  select * into v_prima
    from public.client_professional_links
   where client_user_id = p_client_user_id
     and professional_id = p_professional_id
     and status <> 'revoked'
   order by (status = 'active') desc, created_at desc
   limit 1;

  -- Unico punto di verità: schede, ponte, dedup dei link, idempotenza.
  v_res := public.link_client_to_professional(p_client_user_id, p_professional_id, p_source);
  if v_res is null or not coalesce((v_res ->> 'ok')::boolean, false) then
    return coalesce(v_res, jsonb_build_object('ok', false, 'error', 'link_client_to_professional non ha risposto'));
  end if;

  v_action  := v_res ->> 'action';
  v_link_id := nullif(v_res ->> 'link_id', '')::uuid;

  -- `already_active` = il consenso c'era già: si lascia esattamente com'è.
  if v_action = 'already_active' or v_link_id is null then
    return v_res || jsonb_build_object('requested', false);
  end if;

  -- Chi ha chiesto: il professionista, tranne quando c'era già un pending del
  -- cliente — in quel caso tocca ancora al professionista rispondere, e
  -- `requested_by` non si tocca.
  if v_prima.id is not null
     and v_prima.status = 'pending'
     and v_prima.requested_by is not null
     and v_prima.requested_by = p_client_user_id then
    v_chiesto_da := p_client_user_id;
  else
    v_chiesto_da := p_professional_id;
  end if;

  update public.client_professional_links
     set status       = 'pending',
         requested_by = v_chiesto_da,
         updated_at   = now()
   where id = v_link_id;

  return v_res || jsonb_build_object(
    'link_status',  'pending',
    'requested',    true,
    'requested_by', v_chiesto_da);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm, 'sqlstate', sqlstate);
end;
$BODY$;

comment on function public.request_client_link(uuid, uuid, text) is
  'Chiede il collegamento a un account app esistente: passa da link_client_to_professional, lascia il link in pending e scrive requested_by = professional_id, che è ciò a cui l''app aggancia Accetta/Rifiuta (client_respond_to_link, app-035). Non abbassa mai un link già active e non riscrive il requested_by di un pending chiesto dal cliente.';

-- Solo il server (Edge Function e route con la service_role): la richiesta
-- nasce da un professionista già identificato dal JWT, non dal client.
revoke all on function public.request_client_link(uuid, uuid, text) from public;
grant execute on function public.request_client_link(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';

-- ── Verifica ─────────────────────────────────────────────────────────────────
-- La funzione c'è:
--   select proname, pg_get_function_identity_arguments(oid)
--     from pg_proc where proname = 'request_client_link';
--
-- Chi sta aspettando chi (stessa query di app-035):
--   select l.status,
--          case when l.requested_by = l.professional_id then 'il cliente deve rispondere'
--               when l.requested_by = l.client_user_id  then 'il professionista deve rispondere'
--               else 'ignoto' end as in_attesa_di,
--          count(*)
--     from public.client_professional_links l
--    group by 1, 2 order by 3 desc;
