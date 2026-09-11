-- =============================================================================
-- STRESS INDEX — 021: BACKUP prima della riparazione dei collegamenti
-- =============================================================================
-- Copia clients, client_professional_links, le colonne di collegamento di
-- sessions e di measurement_analytics in tabelle *_backup_YYYYMMDD (data di
-- esecuzione). Rieseguibile: se la tabella del giorno esiste già non la
-- sovrascrive (il backup della prima esecuzione resta intatto).
--
-- Eseguire PRIMA della 022. Ripristino (esempio, da eseguire a mano):
--   update public.clients c set client_user_id = b.client_user_id, merged_into_client_id = null
--     from public.clients_backup_20260911 b where b.id = c.id;
--   update public.client_professional_links l set status = b.status
--     from public.client_professional_links_backup_20260911 b where b.id = l.id;
--   update public.sessions s set client_id = b.client_id
--     from public.sessions_link_backup_20260911 b where b.id = s.id;

do $$
declare
  v_suffix text := to_char(now(), 'YYYYMMDD');
  v_t text;
  v_n bigint;
begin
  v_t := 'clients_backup_' || v_suffix;
  if to_regclass('public.' || v_t) is null then
    execute format('create table public.%I as select * from public.clients', v_t);
    execute format('select count(*) from public.%I', v_t) into v_n;
    raise notice 'creata %: % righe', v_t, v_n;
  else
    raise notice '% esiste già: non sovrascritta', v_t;
  end if;

  v_t := 'client_professional_links_backup_' || v_suffix;
  if to_regclass('public.' || v_t) is null then
    execute format('create table public.%I as select * from public.client_professional_links', v_t);
    execute format('select count(*) from public.%I', v_t) into v_n;
    raise notice 'creata %: % righe', v_t, v_n;
  else
    raise notice '% esiste già: non sovrascritta', v_t;
  end if;

  v_t := 'sessions_link_backup_' || v_suffix;
  if to_regclass('public.' || v_t) is null then
    execute format('create table public.%I as select id, client_id, professionista_id, client_nome, started_at from public.sessions', v_t);
    execute format('select count(*) from public.%I', v_t) into v_n;
    raise notice 'creata %: % righe', v_t, v_n;
  else
    raise notice '% esiste già: non sovrascritta', v_t;
  end if;

  v_t := 'measurement_analytics_link_backup_' || v_suffix;
  if to_regclass('public.' || v_t) is null then
    execute format('create table public.%I as select id, session_id, user_id, client_id from public.measurement_analytics', v_t);
    execute format('select count(*) from public.%I', v_t) into v_n;
    raise notice 'creata %: % righe', v_t, v_n;
  else
    raise notice '% esiste già: non sovrascritta', v_t;
  end if;

  -- Le tabelle di backup non devono essere lette da nessuno via API.
  for v_t in select unnest(array['clients_backup_', 'client_professional_links_backup_', 'sessions_link_backup_', 'measurement_analytics_link_backup_']) || v_suffix loop
    execute format('alter table public.%I enable row level security', v_t);
    execute format('revoke all on public.%I from public, anon, authenticated', v_t);
  end loop;
exception when others then
  raise notice 'backup non completato: % (%)', sqlerrm, sqlstate;
end $$;
