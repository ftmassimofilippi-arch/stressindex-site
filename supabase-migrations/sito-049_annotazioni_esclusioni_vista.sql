-- =============================================================================
-- sito-049: annotazioni, esclusioni dai conti e vista salvata dei grafici
-- =============================================================================
-- Grafici del percorso (17/10/2026, fase 3b). NON ANCORA APPLICATA: la applica
-- Massimo (o Claude con il suo via libera) dal SQL Editor o con
-- `supabase db query --linked -f supabase-migrations/sito-049_annotazioni_esclusioni_vista.sql`.
--
-- Cosa fa
--   1. `client_settings.chart_view` (jsonb): la vista preparata dal
--      professionista per un cliente (indici e ordine, periodo, confronto,
--      punti, scala). Una riga per cliente, RLS già in vigore
--      (`client_settings_own_data`: la scheda è mia).
--   2. `client_chart_annotations`: linee verticali con una parola su una data
--      ("inizio percorso", "seduta 3"). Si tolgono con `rimossa_at`, mai con un
--      delete.
--   3. `measurement_exclusions`: una misurazione esclusa dai conti con motivo
--      obbligatorio. `measurement_analytics` non si tocca: il sito la legge e
--      salta i `session_id` esclusi. Si revoca con `revocata_at`; al massimo
--      un'esclusione attiva per misurazione.
--   RLS sul perimetro del professionista (la scheda è mia), scrittura solo con
--   account attivo (`account_puo_scrivere`, come `clients`), lettura al
--   superadmin (`is_superadmin()`), nessun grant ad `anon`, nessun `delete`
--   concesso ad `authenticated`. Tutto nella stessa transazione (regola di
--   CLAUDE.md sulle tabelle nuove).
--
-- Come si annulla
--   drop table if exists public.measurement_exclusions;
--   drop table if exists public.client_chart_annotations;
--   alter table public.client_settings drop column if exists chart_view;
-- Idempotente.
-- =============================================================================

begin;

alter table public.client_settings add column if not exists chart_view jsonb;

create table if not exists public.client_chart_annotations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id),
  professionista_id uuid not null,
  giorno date not null,
  testo text not null check (char_length(testo) between 1 and 60),
  created_at timestamptz not null default now(),
  rimossa_at timestamptz
);

create table if not exists public.measurement_exclusions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  client_id text not null references public.clients(id),
  professionista_id uuid not null,
  motivo text not null check (motivo in ('artefatti', 'condizioni_anomale', 'malattia', 'altro')),
  nota text check (nota is null or char_length(nota) <= 200),
  created_at timestamptz not null default now(),
  revocata_at timestamptz
);

create unique index if not exists measurement_exclusions_attiva_unica
  on public.measurement_exclusions (session_id) where revocata_at is null;
create index if not exists client_chart_annotations_client_idx on public.client_chart_annotations (client_id);
create index if not exists measurement_exclusions_client_idx on public.measurement_exclusions (client_id);

alter table public.client_chart_annotations enable row level security;
alter table public.measurement_exclusions enable row level security;
revoke all on public.client_chart_annotations from anon, authenticated;
revoke all on public.measurement_exclusions from anon, authenticated;
grant select, insert, update on public.client_chart_annotations to authenticated;
grant select, insert, update on public.measurement_exclusions to authenticated;

drop policy if exists annotations_owner on public.client_chart_annotations;
create policy annotations_owner on public.client_chart_annotations for all
  using (exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid()))
  with check (
    professionista_id = auth.uid()
    and account_puo_scrivere(auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid())
  );
drop policy if exists annotations_superadmin_read on public.client_chart_annotations;
create policy annotations_superadmin_read on public.client_chart_annotations for select using (is_superadmin());

drop policy if exists exclusions_owner on public.measurement_exclusions;
create policy exclusions_owner on public.measurement_exclusions for all
  using (exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid()))
  with check (
    professionista_id = auth.uid()
    and account_puo_scrivere(auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid())
  );
drop policy if exists exclusions_superadmin_read on public.measurement_exclusions;
create policy exclusions_superadmin_read on public.measurement_exclusions for select using (is_superadmin());

commit;

-- Verifica:
--   select relname, relrowsecurity from pg_class where relname in ('client_chart_annotations','measurement_exclusions');
--   select has_table_privilege('anon', 'public.measurement_exclusions', 'select');            -- false
--   select has_table_privilege('authenticated', 'public.measurement_exclusions', 'delete');   -- false
--   select column_name from information_schema.columns where table_name = 'client_settings' and column_name = 'chart_view';
