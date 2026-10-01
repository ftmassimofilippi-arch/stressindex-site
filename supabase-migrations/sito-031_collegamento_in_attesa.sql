-- =============================================================================
-- sito-031 — collegamento IN ATTESA di conferma del cliente
-- =============================================================================
-- Da applicare a mano nel SQL Editor di Supabase. Idempotente.
--
-- PERCHÉ
-- Quando il professionista inserisce come cliente una email che ha GIÀ un
-- account app, non c'è nessun giro di posta che provi il consenso
-- dell'intestatario: con un invito nuovo il consenso è la persona che clicca
-- il link, qui non esiste. Creare un link `active` esporrebbe lo storico HRV
-- di quella persona a chi ne conosce l'indirizzo email.
--
-- Il collegamento nasce quindi `pending`: la riga esiste, il professionista
-- vede "in attesa di conferma", e NON passa un solo dato. Tutte le policy
-- della 019 sono agganciate a `status = 'active'`, quindi pending non legge
-- niente. La conferma la dà il cliente dall'app (Accetta / Rifiuta); il
-- superadmin resta la via di riserva dal pannello Collegamenti.
--
-- COME, senza aprire una seconda strada di scrittura
-- La regola del progetto è che ogni scrittura dei collegamenti passi da
-- `link_client_to_professional`. Questa funzione NON la sostituisce e non la
-- modifica: la chiama, e subito dopo riporta a `pending` il link che quella ha
-- creato o riattivato. Essere il corpo di una funzione rende i due passi una
-- sola transazione: non esiste un istante in cui il link è `active` e
-- visibile a qualcuno.
--
-- Un link GIÀ `active` prima della chiamata non viene mai abbassato: un
-- consenso dato non si ritira per un click di troppo.

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
  v_res     jsonb;
  v_action  text;
  v_link_id uuid;
begin
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

  update public.client_professional_links
     set status = 'pending', updated_at = now()
   where id = v_link_id;

  return v_res || jsonb_build_object('link_status', 'pending', 'requested', true);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm, 'sqlstate', sqlstate);
end;
$BODY$;

comment on function public.request_client_link(uuid, uuid, text) is
  'Chiede il collegamento a un account app esistente: passa da link_client_to_professional e lascia il link in pending, in attesa che il cliente confermi dall''app. Non abbassa mai un link già active.';

-- Solo il server (Edge Function e route con la service_role): la richiesta
-- nasce da un professionista già identificato dal JWT, non dal client.
revoke all on function public.request_client_link(uuid, uuid, text) from public;
grant execute on function public.request_client_link(uuid, uuid, text) to service_role;

-- ── Verifica ─────────────────────────────────────────────────────────────────
-- select proname, pg_get_function_identity_arguments(oid)
--   from pg_proc where proname = 'request_client_link';
