-- =============================================================================
-- sito-043: organizzazioni doppie dello stesso owner, unione e vincolo
-- =============================================================================
-- Audit QA 14/10/2026, punto C2 (b, c). Via libera di Massimo del 15/10.
-- Nessuna cancellazione: le organizzazioni unite restano con `merged_into_id`.
--
-- Stato al 15/10: 5 organizzazioni di 2 owner, tutte nate da un doppio submit
-- del form (la pagina riabilitava il bottone prima del refresh):
--   Massimo (1f8a818b…): "Codice Massimo" 27/05 19:54:24 ← si tiene,
--     "Codice Massimo" 19:54:31, "codice" 19:55:00 (nome diverso ma stesso
--     tentativo: si unisce anche questa, caso esplicito qui sotto);
--   Maria Grazia Berardinelli (46205b0b…): due "Maria Grazia Berardinelli"
--     del 24/05 a 57 secondi di distanza.
-- In entrambi i casi `profiles.organization_id` dell'owner è NULL, per questo
-- la pagina mostrava "Crea la tua organizzazione".
--
-- Cosa fa (vale per OGNI owner, oggi e se ricapita)
--   1. `organizations.merged_into_id` (uuid, FK su organizations).
--   2. Per ogni owner e nome uguale (lower/btrim) resta viva la più vecchia;
--      le altre vengono unite in lei. Più il caso esplicito "codice" → "Codice
--      Massimo".
--   3. I membri delle unite passano alla tenuta, se quella persona non è già
--      dentro (altrimenti la riga resta sull'unita, nessun DELETE). Log in
--      `organizations_merge_log_20261015`.
--   4. `profiles.organization_id` dell'owner, se NULL, punta alla tenuta.
--   5. Vincolo: un owner non può avere due organizzazioni vive con lo stesso
--      nome (indice unico parziale dove merged_into_id è nullo). Il sito
--      filtra `merged_into_id is null`.
--
-- Come si annulla
--   update organizations set merged_into_id = null;
--   update organization_members m set organization_id = l.da_org
--     from organizations_merge_log_20261015 l where l.member_id = m.id;
--   drop index organizations_owner_nome_unico;
-- Idempotente.
-- =============================================================================

begin;

alter table public.organizations
  add column if not exists merged_into_id uuid references public.organizations(id);

create table if not exists public.organizations_merge_log_20261015 (
  member_id uuid primary key,
  da_org uuid not null,
  a_org uuid not null,
  spostato_il timestamptz not null default now()
);

create temp table coppie (da_org uuid primary key, a_org uuid not null) on commit drop;

-- 2a. stesso owner, stesso nome: resta la più vecchia
insert into coppie (da_org, a_org)
select o.id, first_value(o.id) over (partition by o.owner_id, lower(btrim(o.name)) order by o.created_at asc, o.id asc)
from public.organizations o
where o.owner_id is not null and o.merged_into_id is null
on conflict do nothing;
delete from coppie where da_org = a_org;

-- 2b. caso esplicito: "codice" di Massimo → "Codice Massimo"
insert into coppie (da_org, a_org)
select '3aafb1d0-8001-4bc6-87fa-7f1e364a05df', '7da70bea-a5f1-4a48-a2ee-3d9c955b0ccf'
where exists (select 1 from public.organizations where id = '3aafb1d0-8001-4bc6-87fa-7f1e364a05df' and merged_into_id is null)
on conflict do nothing;

-- 3. membri: dall'unita alla tenuta, solo se quella persona non è già dentro
insert into public.organizations_merge_log_20261015 (member_id, da_org, a_org)
select m.id, c.da_org, c.a_org
from public.organization_members m
join coppie c on c.da_org = m.organization_id
where not exists (
  select 1 from public.organization_members k
  where k.organization_id = c.a_org and k.user_id = m.user_id
)
on conflict (member_id) do nothing;

update public.organization_members m
   set organization_id = l.a_org
  from public.organizations_merge_log_20261015 l
 where l.member_id = m.id
   and m.organization_id = l.da_org;

-- 2c. marcatura
update public.organizations o
   set merged_into_id = c.a_org
  from coppie c
 where c.da_org = o.id
   and o.merged_into_id is null;

-- 4. profilo dell'owner agganciato alla sua organizzazione viva
update public.profiles p
   set organization_id = o.id
  from public.organizations o
 where o.owner_id = p.id
   and o.merged_into_id is null
   and p.organization_id is null
   and (select count(*) from public.organizations x where x.owner_id = p.id and x.merged_into_id is null) = 1;

-- 5. vincolo
create unique index if not exists organizations_owner_nome_unico
  on public.organizations (owner_id, lower(btrim(name)))
  where merged_into_id is null and owner_id is not null;

commit;

-- Verifica:
--   select owner_id, name, merged_into_id from organizations order by owner_id, created_at;
--   -- attese 2 vive (una per owner), 3 unite
--   select id, organization_id from profiles where id in
--     ('1f8a818b-5278-4135-8692-5007a2abc739','46205b0b-515b-4b1d-82de-b4076c8783a2');
--   -- 7da70bea… e 99d42aaa…
