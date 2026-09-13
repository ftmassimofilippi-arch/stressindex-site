-- =============================================================================
-- STRESS INDEX — 023: esclusioni dei collegamenti ("verificato, da non unire")
-- =============================================================================
--
-- Alcune schede con la stessa email sotto lo stesso professionista NON sono
-- doppioni: sono professionisti che registrano familiari o altre persone con
-- la propria email (es. Gian Luca Dettori, 198 sessioni, e la scheda "Mamma
-- Mamma"). Questa migrazione:
--   1. crea collegamenti_esclusioni: per ogni gruppo (professionista, email)
--      l'elenco delle schede verificate, con motivo e autore;
--   2. collegamenti_escluso_duplicato(prof, email, ids): true se TUTTE le
--      schede attuali del gruppo sono tra quelle verificate. Una scheda nuova
--      con la stessa email fa ricomparire il gruppo (va verificato di nuovo);
--   3. inserisce i 6 gruppi verificati il 13 settembre 2026 (nomi diversi,
--      nessuna unione) con una riga in admin_audit_log;
--   4. ricrea v_collegamenti_salute (020) escludendo quei gruppi da
--      'scheda_duplicata'. Il resto della view è identico alla 020.
-- La 022 (blocco C) usa la stessa funzione. Nuove esclusioni dal pannello:
-- tab Salute collegamenti → "Non unire" (POST /api/admin/collegamenti,
-- action 'exclude_duplicate').
--
-- Idempotente. Applicare dopo la 020 e prima di rieseguire la 022.

create table if not exists public.collegamenti_esclusioni (
  id                bigserial primary key,
  tipo_problema     text not null default 'scheda_duplicata',
  professionista_id uuid not null,
  email_norm        text not null,
  client_ids        text[] not null,
  motivo            text not null,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  created_by_email  text,
  updated_at        timestamptz not null default now()
);
create unique index if not exists uq_collegamenti_esclusioni
  on public.collegamenti_esclusioni (tipo_problema, professionista_id, email_norm);
alter table public.collegamenti_esclusioni enable row level security;
revoke all on public.collegamenti_esclusioni from public, anon, authenticated;
grant select, insert, update, delete on public.collegamenti_esclusioni to service_role;
grant usage, select on sequence public.collegamenti_esclusioni_id_seq to service_role;

create or replace function public.collegamenti_escluso_duplicato(p_professionista_id uuid, p_email_norm text, p_ids text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collegamenti_esclusioni e
     where e.tipo_problema = 'scheda_duplicata'
       and e.professionista_id = p_professionista_id
       and e.email_norm = lower(trim(p_email_norm))
       and p_ids <@ e.client_ids
  );
$$;
revoke all on function public.collegamenti_escluso_duplicato(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.collegamenti_escluso_duplicato(uuid, text, text[]) to service_role;

-- I 6 gruppi verificati il 13/09/2026: tutte le schede attuali del gruppo,
-- solo se i nomi sono davvero diversi (stesso criterio della 022).
with gruppi as (
  select c.professionista_id, lower(trim(c.email)) as email_norm, array_agg(c.id order by c.id) as ids
    from public.clients c
   where c.merged_into_client_id is null
     and lower(trim(c.email)) in ('planetex@virgilio.it', 'ligabriviba@gmail.com', 'gluca.dettori@gmail.com',
                                  'breil69@hotmail.com', 'alex.spirandelli7@gmail.com', 'nicolo.maragni@gmail.com')
   group by c.professionista_id, lower(trim(c.email))
  having count(*) > 1
     and count(distinct nullif(public.collegamenti_nome_norm(c.nome, c.cognome), '')) > 1
),
ins as (
  insert into public.collegamenti_esclusioni (tipo_problema, professionista_id, email_norm, client_ids, motivo, created_by_email)
  select 'scheda_duplicata', g.professionista_id, g.email_norm, g.ids,
         'Verificato il 13/09/2026: il professionista registra familiari o altre persone con la propria email. Non unire.',
         'migration:023'
    from gruppi g
  on conflict (tipo_problema, professionista_id, email_norm) do nothing
  returning id, professionista_id, email_norm, client_ids, motivo
)
insert into public.admin_audit_log (performed_by, performed_by_email, action, target_type, target_id, details)
select null, 'migration:023', 'exclude_duplicate', 'client', i.client_ids[1],
       jsonb_build_object('esclusione_id', i.id, 'professionista_id', i.professionista_id, 'email', i.email_norm,
                          'client_ids', to_jsonb(i.client_ids), 'motivo', i.motivo)
  from ins i;

create or replace view public.v_collegamenti_salute as
with cards as (
  select c.* from public.clients c where c.merged_into_client_id is null
),
prof as (
  select p.id, p.email, p.role,
         nullif(trim(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')), '') as nome_completo
  from public.profiles p
),
pro_name as (
  select p.id, coalesce(nullif(trim(coalesce(pp.nome, '') || ' ' || coalesce(pp.cognome, '')), ''), p.nome_completo, p.email) as label
  from prof p left join public.professional_profiles pp on pp.id = p.id
),
remote as (
  select s.professionista_id as user_id, count(*) as n, max(coalesce(s.started_at, s.created_at)) as last_at
  from public.sessions s where s.client_id is null group by s.professionista_id
),
active_link as (
  select distinct l.client_user_id from public.client_professional_links l where l.status = 'active'
)
-- 2.1 schede duplicate (stessa email, stesso professionista)
select 'scheda_duplicata'::text as tipo_problema, 'alta'::text as gravita,
       d.ids[1] as client_id, null::uuid as client_user_id, d.professionista_id as professional_id, null::uuid as link_id,
       d.email_norm as email, d.nomi as nome, pn.label as professionista,
       format('%s schede con la stessa email: %s', d.n, array_to_string(d.ids, ', ')) as dettaglio,
       'Unisci: tieni la scheda con il ponte (o con più sessioni, poi la più vecchia), sposta sessioni/analytics/note, archivia le altre' as fix_proposto,
       false as fix_auto, 'admin_merge'::text as fix_rpc,
       jsonb_build_object('client_ids', to_jsonb(d.ids), 'professionista_id', d.professionista_id) as fix_args
from (
  select c.professionista_id, lower(trim(c.email)) as email_norm, count(*) as n,
         array_agg(c.id order by c.client_user_id is null, c.created_at) as ids,
         string_agg(distinct trim(coalesce(c.nome,'') || ' ' || coalesce(c.cognome,'')), ' / ') as nomi
  from cards c
  where nullif(trim(c.email), '') is not null
  group by c.professionista_id, lower(trim(c.email))
  having count(*) > 1
) d
left join pro_name pn on pn.id = d.professionista_id
-- 023: gruppi verificati "da non unire" esclusi finché non compare una scheda nuova
where not public.collegamenti_escluso_duplicato(d.professionista_id, d.email_norm, d.ids)

union all
-- 2.2 ponte mancante costruibile (scheda senza client_user_id, profilo client con la stessa email)
select 'ponte_mancante', 'media', c.id, p.id, c.professionista_id, null,
       lower(trim(c.email)), trim(coalesce(c.nome,'') || ' ' || coalesce(c.cognome,'')), pn.label,
       format('esiste il profilo client %s con la stessa email%s', p.id,
              case when exists (select 1 from public.client_professional_links l where l.client_user_id = p.id and l.professional_id = c.professionista_id and l.status = 'active') then ' e un link active' else '' end),
       'Scrivi il ponte clients.client_user_id (ensure_client_bridge)', true, 'ensure_client_bridge',
       jsonb_build_object('p_email', lower(trim(c.email)))
from cards c
join prof p on p.role = 'client' and lower(trim(p.email)) = lower(trim(c.email))
left join pro_name pn on pn.id = c.professionista_id
where c.client_user_id is null and nullif(trim(c.email), '') is not null
  and c.professionista_id <> p.id      -- la scheda di sé stesso non è un ponte
  and not exists (select 1 from cards c2 where c2.professionista_id = c.professionista_id and c2.client_user_id = p.id)

union all
-- 2.3 ponte verso un profilo non client
select 'ponte_ruolo_errato', 'bassa', c.id, c.client_user_id, c.professionista_id, null,
       p.email, trim(coalesce(c.nome,'') || ' ' || coalesce(c.cognome,'')), pn.label,
       format('client_user_id punta a un profilo con ruolo %s', coalesce(p.role, 'null')),
       'Verifica a mano: è la stessa persona con due account?', false, null, '{}'::jsonb
from cards c
join prof p on p.id = c.client_user_id
left join pro_name pn on pn.id = c.professionista_id
where p.role is distinct from 'client'

union all
-- 2.4 link active senza scheda
select case when p.id is null then 'link_profilo_inesistente' else 'link_senza_scheda' end,
       case when p.id is null then 'media' else 'alta' end,
       null, l.client_user_id, l.professional_id, l.id,
       p.email, p.nome_completo, pn.label,
       case when p.id is null then 'il profilo del cliente non esiste più' else 'nessuna scheda clients aggancia questo link (né ponte, né email, né id)' end,
       case when p.id is null then 'Revoca il link' else 'Crea/aggancia la scheda (link_client_to_professional)' end,
       true,
       case when p.id is null then 'revoke_link' else 'link_client_to_professional' end,
       case when p.id is null then jsonb_build_object('link_id', l.id)
            else jsonb_build_object('p_client_user_id', l.client_user_id, 'p_professional_id', l.professional_id) end
from public.client_professional_links l
left join prof p on p.id = l.client_user_id
left join pro_name pn on pn.id = l.professional_id
where l.status = 'active'
  and not exists (
    select 1 from cards c
    where c.professionista_id = l.professional_id
      and (c.client_user_id = l.client_user_id
           or (c.client_user_id is null and ((p.email is not null and lower(trim(c.email)) = lower(trim(p.email))) or c.id = l.client_user_id::text))))

union all
-- 2.5 pending vecchi
select 'pending_vecchio', 'bassa', null, l.client_user_id, l.professional_id, l.id,
       p.email, p.nome_completo, pn.label,
       format('richiesta pendente da %s giorni', (now()::date - l.created_at::date)),
       'Accettare o revocare', false, null, '{}'::jsonb
from public.client_professional_links l
left join prof p on p.id = l.client_user_id
left join pro_name pn on pn.id = l.professional_id
where l.status = 'pending' and l.created_at < now() - interval '30 days'

union all
-- 2.6 coppie con più link vivi
select 'link_duplicato', 'media', null, d.client_user_id, d.professional_id, d.ids[1],
       p.email, p.nome_completo, pn.label,
       format('%s link non revocati per la stessa coppia', d.n),
       'Tieni il più recente active, revoca gli altri (link_client_to_professional lo fa)', true, 'link_client_to_professional',
       jsonb_build_object('p_client_user_id', d.client_user_id, 'p_professional_id', d.professional_id)
from (
  select l.client_user_id, l.professional_id, count(*) as n, array_agg(l.id order by l.created_at desc) as ids
  from public.client_professional_links l where l.status <> 'revoked'
  group by 1, 2 having count(*) > 1
) d
left join prof p on p.id = d.client_user_id
left join pro_name pn on pn.id = d.professional_id

union all
-- 2.8 sessioni remote di utenti senza link active
select 'sessioni_remote_senza_link', 'alta', null, r.user_id, null, null,
       p.email, p.nome_completo, null,
       format('%s misurazioni remote invisibili a tutti (ultima %s)', r.n, to_char(r.last_at, 'YYYY-MM-DD')),
       case when exists (select 1 from cards c where lower(trim(c.email)) = lower(trim(p.email)))
            then 'Esiste una scheda con questa email: creare il collegamento con quel professionista (richiede conferma)'
            else 'Nessuna scheda con questa email: il cliente deve chiedere il collegamento dall''app' end,
       false, null,
       jsonb_build_object(
         'client_user_id', r.user_id,
         'sessioni', r.n,
         -- candidati: professionisti che hanno una scheda con la stessa email
         'candidati', coalesce((
           select jsonb_agg(jsonb_build_object('professional_id', c.professionista_id, 'professionista', pn2.label, 'client_id', c.id) order by c.created_at)
           from cards c
           left join pro_name pn2 on pn2.id = c.professionista_id
           where lower(trim(c.email)) = lower(trim(p.email)) and c.professionista_id <> r.user_id
         ), '[]'::jsonb))
from remote r
join prof p on p.id = r.user_id and p.role is distinct from 'professional'
where not exists (select 1 from active_link a where a.client_user_id = r.user_id)

union all
-- 2.10 profili client orfani (senza link e senza scheda)
select 'profilo_client_orfano', 'bassa', null, p.id, null, null,
       p.email, p.nome_completo, null,
       format('registrato, nessun link e nessuna scheda%s', case when r.n is null then '' else format(', %s misurazioni remote', r.n) end),
       'Nessuna azione automatica', false, null, '{}'::jsonb
from prof p
left join remote r on r.user_id = p.id
where p.role = 'client'
  and not exists (select 1 from public.client_professional_links l where l.client_user_id = p.id)
  and not exists (select 1 from cards c where c.client_user_id = p.id)

union all
-- schede con ponte ma nessun link mai esistito (l'invito è fallito a metà: caso Sara)
select 'scheda_con_ponte_senza_link', 'alta', c.id, c.client_user_id, c.professionista_id, null,
       p.email, trim(coalesce(c.nome,'') || ' ' || coalesce(c.cognome,'')), pn.label,
       'la scheda ha il ponte esplicito ma non esiste nessun collegamento (nemmeno revocato)',
       'Crea il collegamento (link_client_to_professional)', true, 'link_client_to_professional',
       jsonb_build_object('p_client_user_id', c.client_user_id, 'p_professional_id', c.professionista_id)
from cards c
join prof p on p.id = c.client_user_id
left join pro_name pn on pn.id = c.professionista_id
where c.client_user_id <> c.professionista_id
  and not exists (select 1 from public.client_professional_links l where l.client_user_id = c.client_user_id and l.professional_id = c.professionista_id)

union all
-- 2.13 measurement_analytics con client_id diverso dalla sessione
select 'analytics_disallineato', 'media', s.client_id, null, s.professionista_id, null,
       null, s.client_nome, pn.label,
       format('%s righe di measurement_analytics con client_id diverso dalla sessione', count(*)),
       'Riallinea measurement_analytics.client_id alla sessione', true, 'realign_analytics',
       jsonb_build_object('professionista_id', s.professionista_id, 'client_id', s.client_id)
from public.measurement_analytics ma
join public.sessions s on s.id = ma.session_id
left join pro_name pn on pn.id = s.professionista_id
where ma.client_id is distinct from s.client_id
group by s.client_id, s.professionista_id, s.client_nome, pn.label

union all
-- 2.14 monitoring_sessions incoerenti
select 'monitoraggio_incoerente', 'media', m.client_id, m.user_id, m.professionista_id, null,
       p.email, p.nome_completo, pn.label,
       case when m.client_id is not null and c.id is null then 'client_id non esiste in clients'
            when c.id is not null and c.professionista_id is distinct from m.professionista_id then 'la scheda appartiene a un altro professionista'
            when p.role = 'client' and m.client_id is null then 'utente client senza scheda assegnata'
            else 'professionista_id non in profiles' end,
       'Verifica a mano', false, null, '{}'::jsonb
from public.monitoring_sessions m
left join public.clients c on c.id = m.client_id
left join prof p on p.id = m.user_id
left join pro_name pn on pn.id = m.professionista_id
where (m.client_id is not null and c.id is null)
   or (c.id is not null and c.professionista_id is distinct from m.professionista_id)
   or (p.role = 'client' and m.client_id is null)
   or (m.professionista_id is not null and not exists (select 1 from public.profiles x where x.id = m.professionista_id));

-- Solo la service role (pannello Super Admin) legge la view.
revoke all on public.v_collegamenti_salute from public, anon, authenticated;
grant select on public.v_collegamenti_salute to service_role;

notify pgrst, 'reload schema';
