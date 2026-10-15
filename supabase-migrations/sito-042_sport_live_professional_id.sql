-- =============================================================================
-- sito-042: sport_live_data senza professional_id non risponde più 400 all'app
-- =============================================================================
-- Audit QA 14/10/2026, punto G1. **RICHIEDE IL VIA LIBERA DI MASSIMO** (nuovo
-- trigger che può scartare righe).
--
-- Nei log: 81 × `null value in column "professional_id" of relation
-- "sport_live_data" violates not-null constraint` (POST da Dart/3.11,
-- `on_conflict=session_id`). L'app manda lo snapshot live di un atleta che non
-- ha un professionista collegato (`sport_live_service.dart:18-76`).
--
-- Cosa fa: un trigger BEFORE INSERT OR UPDATE che, quando `professional_id` è
-- nullo, lo risolve così:
--   1. dal titolare della scheda: `clients.professionista_id` dove
--      `clients.id = athlete_id` (athlete_id è l'id testuale della scheda);
--   2. altrimenti dal collegamento attivo di chi scrive:
--      `client_professional_links` con `client_user_id = auth.uid()` e
--      `status = 'active'` (il più recente);
--   3. se non lo trova, scarta la riga in silenzio (`return null`) e la
--      registra in `rls_write_skipped` tramite `rls_skip_registra`, come le
--      altre scritture saltate. L'app riceve 2xx con risposta vuota invece di
--      400; nessun dato viene scritto su un professionista sbagliato.
-- La correzione vera resta nell'app (docs/FIX_APP_DA_FARE.md, G1): non avviare
-- la sessione live senza professionista collegato.
--
-- Come si annulla
--   drop trigger if exists a0_professional_id_da_scheda on public.sport_live_data;
--   drop function if exists public.tg_sport_live_professional_id();
-- Idempotente.
-- =============================================================================

create or replace function public.tg_sport_live_professional_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pro uuid;
begin
  if new.professional_id is not null then
    return new;
  end if;

  select c.professionista_id into v_pro
  from public.clients c
  where c.id = new.athlete_id
  limit 1;

  if v_pro is null and auth.uid() is not null then
    select l.professional_id into v_pro
    from public.client_professional_links l
    where l.status = 'active'
      and coalesce(l.client_user_id, l.client_id) = auth.uid()
    order by l.updated_at desc nulls last, l.created_at desc
    limit 1;
  end if;

  if v_pro is null then
    perform public.rls_skip_registra(
      'sport_live_data', new.session_id::text, null, new.athlete_id, auth.uid(),
      'professional_id mancante: atleta senza scheda né collegamento attivo'
    );
    return null;  -- riga scartata, nessun errore all'app
  end if;

  new.professional_id := v_pro;
  return new;
end;
$$;

revoke all on function public.tg_sport_live_professional_id() from public, anon, authenticated;

drop trigger if exists a0_professional_id_da_scheda on public.sport_live_data;
create trigger a0_professional_id_da_scheda
  before insert or update on public.sport_live_data
  for each row execute function public.tg_sport_live_professional_id();

-- Verifica (dopo qualche ora): select motivo, count(*) from rls_write_skipped
--   where tabella = 'sport_live_data' group by 1;
-- e nei log PostgREST l'errore 23502 su sport_live_data deve sparire.
