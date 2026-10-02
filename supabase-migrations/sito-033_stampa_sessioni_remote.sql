-- =============================================================================
-- sito-033 — la via "solo token" delle pagine di stampa vede le remote
-- =============================================================================
-- Da applicare a mano nel SQL Editor di Supabase. Idempotente. Richiede la
-- `sito-032`, di cui ridefinisce una sola funzione. Nessun dato toccato.
--
-- PERCHÉ
-- Con la 032 un superadmin vede le misurazioni remote nella scheda cliente,
-- ma il REPORT PERIODICO stampato restava senza, e per due ragioni diverse
-- che portano allo stesso 0:
--
--   1. con la sessione del superadmin (via cookie, `resolvePrintAccess` ramo
--      1) `loadPeriodicReportData` chiamava ancora la RPC legata ad
--      `auth.uid()` — risolto nel codice, passando dalla
--      `get_linked_client_sessions_as_professional` della 032;
--   2. nella via "solo token" (`resolvePrintAccess` ramo 2) il client è la
--      **service_role**, dove `auth.uid()` è NULL: lì non solo la RPC della
--      019 restituisce 0 righe, ma anche la variante della 032 negherebbe
--      l'accesso con 42501, perché `puo_vedere_come_professionista` chiede un
--      `auth.uid()`.
--
-- Da notare che la stampa della SINGOLA misurazione non aveva il problema: un
-- superadmin legge qualsiasi riga di `sessions` e `measurement_analytics` per
-- `superadmin_read_sessions` / `superadmin_read_analytics`, quindi la riga
-- viene trovata dalla query diretta e il ripiego remoto non serve. Il report
-- periodico sì, perché la sua query diretta filtra `client_id = scheda` e sulle
-- sessioni remote quel campo è NULL per progetto.
--
-- COME
-- Si aggiunge un solo caso a `puo_vedere_come_professionista`: la chiave
-- **service_role**. Non concede nulla di nuovo — la service_role scavalca già
-- la RLS e può leggere `sessions` direttamente — e il diritto di lettura di
-- chi ha chiesto la stampa è già stato verificato PRIMA, in
-- `src/lib/print-access.ts` (`verifyPrintToken` sul token firmato, poi
-- `assertOwnerOrSuperadmin` sul proprietario della scheda). Serve solo a non
-- far fallire con 42501 una lettura che la service_role avrebbe comunque il
-- potere di fare, scritta a mano, con la stessa logica di join copiata nel
-- TypeScript.
--
-- `anon` resta fuori: la funzione non è concessa a quel ruolo e, anche se lo
-- fosse, `auth.role()` sarebbe 'anon' e nessuno dei casi si applicherebbe.
-- =============================================================================

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
    and (
      -- d) chiave service_role: la via "solo token" delle pagine di stampa.
      --    Il diritto di lettura è verificato prima, in print-access.ts; qui
      --    si evita soltanto un 42501 su una lettura che la service_role
      --    potrebbe comunque fare scavalcando la RLS.
      auth.role() = 'service_role'
      or (
        auth.uid() is not null
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
        )
      )
    );
$BODY$;

comment on function public.puo_vedere_come_professionista(uuid) is
  'True se chi chiama può leggere i dati di p_professional_id: service_role '
  '(via "solo token" delle stampe, diritto già verificato in print-access.ts), '
  'sé stesso, superadmin, oppure owner/admin della stessa organizzazione su un '
  'membro attivo. Riproduce resolveViewingProfessional del sito.';

-- I grant della 032 restano validi: `create or replace` non li cambia.
-- Ricontrollati qui per sicurezza, l'operazione è idempotente.
revoke all on function public.puo_vedere_come_professionista(uuid) from public;
grant execute on function public.puo_vedere_come_professionista(uuid)
  to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verifica
-- ─────────────────────────────────────────────────────────────────────────────
--   -- come service_role, senza alcun jwt utente:
--   set local role service_role;
--   select set_config('request.jwt.claims', '{"role":"service_role"}', true);
--   select count(*) from get_linked_client_sessions_as_professional(
--     '1adfd1cd-cc61-4753-a36d-314ae4e0b179', '1789282977721');   -- atteso 14
--
--   -- come anon: atteso 42501
--   select set_config('request.jwt.claims', '{"role":"anon"}', true);
