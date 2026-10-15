# Analisi QA del 14 ottobre 2026, Fase 0

Mappa del sito prima di toccare il codice. Scritta il 15/10/2026 sul branch
`fix/perimetro-home` (commit `f5587fb`), confrontando il codice con il database
di produzione (`supabase db query --linked`, solo SELECT), l'advisor di
sicurezza Supabase e gli errori runtime di Vercel. Ogni punto dei blocchi A-G
ha in fondo la sua causa probabile.

## 0. Fatto che cambia il piano: la produzione è indietro di 15 commit

- Vercel pubblica `main`. `main` è ad `add4738` (4 ottobre 2026): ultimo
  deploy di produzione 10 giorni fa.
- Il branch `fix/perimetro-home` ha 15 commit in più, mai uniti: tutto il
  lavoro sul **perimetro del professionista** del 7 ottobre (home, lista
  clienti, scheda, analytics, alert, monitoraggio, sport, ricerca globale,
  PDF) e il filtro delle misurazioni nell'URL del 15 ottobre.
- Conseguenza: l'audit del 14 ottobre ha visto il codice del 4 ottobre. I punti
  **C1** (Analytics a zero) e **C3** (Oggi e Clienti mostrano tutto il
  database) sono in gran parte già corretti sul branch, ma non in produzione.
- Decisione da prendere prima del blocco A: unire `fix/perimetro-home` in
  `main` (è la base su cui vanno fatti B e C) oppure lavorare sul branch e
  unire tutto alla fine.

## 1. Route e caricamento dati

`DD` = `src/lib/dashboard-data.ts`. Tutte le pagine dell'area sono server
component `force-dynamic`; nessuna usa RPC aggregate, tutte caricano righe e
calcolano in TypeScript.

### Pubbliche (`src/app/[locale]/`)

| Route | Dati |
|---|---|
| `/`, `/funzionalita`, `/sport`, `/guide`, `/supporto`, `/privacy` | statiche, nessun accesso a Supabase |
| `/registrazione`, `/imposta-password`, `/area-professionisti/login`, `/recupera-password` | solo auth lato client (`supabase-browser`) |
| `/termini`, `/cookie`, `/contatti` | **non esistono**: cadono in `[...rest]/page.tsx` e danno 404 |
| `/auth/callback`, `/auth/confirm` | **non esistono** |

### Area professionisti

| Pagina | Loader | Tabelle / RPC |
|---|---|---|
| Oggi (`area-professionisti/page.tsx:63-74`) | `listAlerts`, `listAlertEvents`, `todaysMeasurements` (DD:461), `aggregatedDailyAverages(365)` (DD:730), `clientsToContact` (DD:801), `listClients`, `listRecentNotes`, `listPendingInvitesForCurrentUser`, `listMonitoringSessionsForProfessional`, `ponteClienti` | `alerts`, `alert_events`, `measurement_analytics`, `sessions.started_at_utc`, `clients`, `client_settings`, `client_notes`, `organization_members`, `monitoring_sessions`, RPC `get_linked_clients_last_remote_session`; con service role `client_professional_links`, `profiles` |
| Clienti (`clienti/page.tsx:39-45`) | `listClientsEnriched` (DD:644) | `clients`, `measurement_analytics` (tutte le righe del perimetro, `select('*')`), `alerts`, `client_settings` (senza filtro, DD:672), RPC `get_linked_clients_last_remote_session[_as_professional]`, `get_linked_clients_last_remote_analytics[_as_professional]` |
| Scheda cliente (`clienti/[id]/page.tsx:39-58`) | `getClient` (DD:90), `listMeasurementsForClient` (DD:167) | `clients`, `sessions`, RPC `get_linked_client_sessions_by_client_id` / `_as_professional`, `measurement_analytics`, `client_notes`, `client_settings`, `messages`, `alerts`, `alert_events`, `alert_rules`, `monitoring_sessions` |
| Misurazione (`clienti/[id]/misurazione/[sessionId]/page.tsx:40-44`) e Confronto | `getMeasurementBySessionId` (DD:364), `getClient` | `measurement_analytics`, `sessions`, RPC remota come ripiego |
| Analytics (`analytics/page.tsx:18-23`) | `listClientsEnriched`, `listAllMeasurements()` senza date (DD:1331), `listMonitoringSessionsForProfessional` | tutte le `measurement_analytics` del perimetro, poi filtro lato client in `AnalyticsClient.tsx` |
| Monitoraggio, lista e dettaglio | `monitoring-data.ts:377-424`, con service role `loadWithServiceRole` (:256) | `monitoring_sessions`, RPC `get_linked_client_monitoring_sessions_by_client_id` |
| Sport (indice, atleta, sessione, team-live) | `sport-data.ts` (`resolveSportContext` :163) | `sport_sessions` (filtro `professional_id`), `clients`, `dfa_windows`, `training_load_daily`, `sport_live_data` |
| Organizzazione | `getOrganizationContext` (DD:865) | `profiles.organization_id`, `organizations`, `organization_members` |
| Impostazioni | server + `SettingsTabs.tsx` dal client | `professional_profiles`, `notification_preferences` |
| Admin (`professionisti`, `professionisti/health`) | `getPlatformCounts` (`admin-counts.ts:36-61`, service role) | conteggi, `sessions … limit(5000)` |

### API (`src/app/api`)

- `admin/*`: `admin-guard` + service role. `users`, `clients`, `links` passano
  da `admin-data.ts`: solo `measurement_analytics` è paginata (`selectAll`
  :111); `clients`, `profiles`, `links` sono letti interi (:210-214).
  `collegamenti` (vista `v_collegamenti_salute`, RPC `collegamenti_salute_*`,
  `ensure_client_bridge`, `link_client_to_professional`), `clients/merge`
  (RPC `admin_merge_clients`, `collegamenti_merge_card`), `health`
  (`admin_data_health`), `monitoring`.
- `clienti`, `clienti/[id]/accesso`: `clients`, `profiles`,
  `professional_profiles`.
- `organization` (+ `members`, `invites`): `organizations`,
  `organization_members`, `profiles`, RPC `accept_organization_invite`.
- `monitoring/[id]/{email,events,rr-csv,windows-csv}`, `notifiche`, `pdf/*`
  (`report-data.ts`), `guide-chat` (nessun DB).

### Stampa (`stampa/*`)

`resolvePrintAccess` (`print-access.ts`): sessione utente o token; con il token
usa la service role. Poi `assertOwnerOrSuperadmin` e `report-data.ts`.

## 2. Logica di scope: chi vede cosa

### Sul branch (`fix/perimetro-home`)

- **Perimetro** (`src/lib/perimetro.ts:47`, `perimetro-server.ts:16`): le
  sessioni con `user_id` = professionista, più gli `user_id` dei clienti con
  link `active` (`coalesce(client_user_id, client_id)`). Se la lettura dei link
  fallisce il perimetro si restringe alle sole sessioni proprie.
- **`resolveViewingProfessional`** (DD:1197) legge `?professionista=`. Il ramo
  superadmin (DD:1205) si attiva solo con `SUPERADMIN_VEDE_DATI_CLIENTI`, che è
  `false` (`superadmin-scope.ts:19`). Resta il ramo owner/admin di
  organizzazione per un membro attivo (DD:1210-1214).
- Per pagina: Oggi solo utente loggato (DD:465, 734); Clienti, Scheda,
  Misurazione, Confronto, Monitoraggio via `resolveViewingProfessional`;
  Analytics solo utente loggato (ignora `?professionista`); Sport
  `viewing?.user_id ?? access.userId`; Organizzazione da
  `profiles.organization_id`; Admin solo conteggi via service role.
- Incoerenze residue sul branch: in vista organizzazione
  `listClientsEnriched` legge solo `measurement_analytics.user_id =
  professionistaId` senza i collegati (DD:655); `getMeasurementBySessionId`
  controlla il perimetro solo nella vista propria (DD:400-405).

### In produzione (`main`, 4 ottobre)

Non esiste `perimetro.ts`. Le query si affidano alla sola RLS: per un
superadmin le policy `superadmin_read_*` aprono tutto, quindi Oggi e Clienti
mostrano 789 schede e le misurazioni di chiunque, mentre Sport, Monitoraggio e
Alert hanno un filtro esplicito sul professionista. È esattamente
l'incoerenza descritta in C3.

### Non esiste un `getDataScope()` unico

Né sul branch né in produzione. Ogni pagina decide per sé. Non c'è alcun
interruttore "i miei dati / tutta la piattaforma", nessun cookie, nessun
badge.

## 3. Grafici di andamento

Un solo componente, `src/components/dashboard/AdvancedTrendChart.tsx`
(`TrendChart.tsx` è codice morto). Usi:

| Uso | File | `storageKey` | Dati |
|---|---|---|---|
| Home "Andamento medio aggregato" | `area-professionisti/page.tsx:272-279` | `sx-home-trend` | medie giornaliere già tagliate a 365 giorni dal server, un punto per giorno anche vuoto, Brush spento |
| Scheda cliente, Panoramica | `tabs/OverviewTab.tsx:49-55, 107-113` | `sx-client-overview-trend` | tutto lo storico, un punto per misurazione, con il filtro URL |
| Analytics avanzati, Trend storico | `tabs/AdvancedAnalyticsTab.tsx:44-50, 108-114` | `sx-client-trend` | tutto lo storico; i selettori Periodo A/B non agiscono sul grafico |
| Report periodico | `stampa/report-periodico/page.tsx:104-113` | nessuno (`print`) | `range={{from,to}}` |

Come funziona il periodo:

- `useState(defaultPreset)` (:189); date personalizzate da oggi meno 30 giorni
  (:190-191).
- `useEffect(..., [])` dopo il mount legge `${storageKey}:range`, `:metrics`,
  `:hidden` da localStorage (:204-223) e sovrascrive il default.
- Il clic chiama `setRange` che aggiorna `activeKey`, salva in localStorage e
  incrementa `brushKey` (:241-245). `LineChart key={brushKey}` (:357) rimonta il
  grafico e azzera il Brush.
- Filtro tutto lato client, `useMemo([data, effectiveKey, effectiveFrom,
  effectiveTo])` (:308-326), confronto fra stringhe `yyyy-MM-dd`.
- Il periodo non va mai nell'URL.

Il commit `f5587fb` ha messo scheda, `?tag=` e `?tipo=` nell'URL
(`ClientProfile.tsx:73-95`, `measurement-filter.ts`) e li applica anche al
grafico della Panoramica. Non tocca il periodo né il Brush.

## 4. Data, ora e numeri

- `src/lib/format.ts`: `formatDate` (39), `formatDateTime` (45), `formatTime`
  (50), `todayLong` (202) passano sempre la lingua (`intlTag`) ma **non il
  fuso**. Le funzioni delle misurazioni (`formatMeasuredAt`, `formatMeasuredDate`,
  `formatMeasuredTime`, `formatIstante`, :78-99) usano il fuso italiano.
- `daysSince` (:112) e `formatGreeting` (:119) usano `new Date()`.
- `measured-time.ts:47` ha un `Intl` fisso `en-US` (interno, per le chiavi).
- In tutto `src` non c'è nessun `toLocaleString` / `toLocaleDateString` e
  nessun `new Intl.*` senza lingua.
- `new Date()` o `Date.now()` **durante il render** di componenti client:
  `ClientProfile.tsx:113` (`memberSince`), `AdvancedTrendChart.tsx:190-191,
  319-320`, `MeasurementsTab.tsx:46` (`defaultRange(90)`),
  `AnalyticsClient.tsx:33`.
- `OverviewTab.tsx:135`: `formatDateTime(a.created_at)` senza fuso in un
  componente client: server in UTC, browser in Europe/Rome, mismatch certo.

## 5. Alert

- Tre sorgenti: `alerts` (cron del sito), `alert_events` (scritti dall'app),
  `alert_rules` (regole).
- **Il cron non gira alle 09:00 UTC una volta al giorno**: `cron.job` ha
  `generate_threshold_alerts` ogni ora (`0 * * * *`, jobid 1) e
  `generate_missed_measurement_alerts` ogni 6 ore (jobid 2). Gli alert nascono
  alle 09:00 perché è la prima ora in cui le misurazioni del mattino rientrano
  nella finestra, vedi C6.
- `generate_threshold_alerts` (letta dal DB): per ogni score, `measurement_analytics`
  con `measured_at > now() - 24h` e soglia superata; inserisce se non esiste un
  alert `new/seen` dello stesso tipo o metrica con `created_at > now() - 24h`.
- `alert_rules_dedup_log` è vuota e nessuna funzione la usa a parte
  `gdpr_residui`: è una tabella dell'app (`hrv_app/supabase/migrations/
  alert_rules_client_override.sql`), non c'entra con il cron del sito.
- Conteggi diversi per pagina: lista clienti conta solo `alerts` `new/seen`
  (DD:671, 695-696); scheda conta `alerts` più `alert_events` non letti degli
  ultimi 30 giorni (`clienti/[id]/page.tsx:46-61`); home `alerts` (5) più
  `alert_events` (10) e mostra i primi 6.
- Testi: `alert_events.message` lo scrive l'app nella lingua del telefono
  (`hrv_app/lib/services/alert_service.dart:479`, ARB `setAlertMsgSdnnLow` in
  it/en). Il sito ricompone la frase da `alertMessage` (`alert-rules.ts:116-132`)
  ma `OverviewTab.tsx:133` mostra `{a.message}` grezzo. Per gli alert del cron
  di tipo `abnormal_value`, `alertMessage` mostra solo "valore N" (:130)
  ignorando `message` e `triggering_metric`.
- Nel DB: **2652 alert, tutti `new`**, nessuno `seen` né `resolved`. Nessuna
  funzione risolve mai un alert.

## 6. Middleware (`src/middleware.ts`)

1. `handleI18n` di next-intl su ogni richiesta (matcher
   `/((?!api|_next|_vercel|.*\..*).*)`).
2. Solo sotto `/area-professionisti`: `createServerClient` con env `!`,
   `supabase.auth.getUser()` (:57, fino a due chiamate di rete se il token va
   rinfrescato), poi per gli utenti loggati `rpc('my_account_access')` (:82),
   eventuale `signOut()` (:85). Nessun try/catch, nessun timeout, l'`error` di
   `getUser` non viene letto.
3. Vercel, ultimi 7 giorni: 4 timeout "did not return an initial response
   within 25s" (3 utenti, ultimo 14/10 18:17) e 2 `AuthApiError: Invalid
   Refresh Token: Refresh Token Not Found` (13/10 12:57), tutti su
   `/middleware`.
4. I link pubblici a `/area-professionisti/login` (`Header.tsx:67, 133`,
   `HomeNavbar.tsx:53, 92`) non hanno `prefetch={false}`: ogni pagina pubblica
   fa passare dal middleware un prefetch che per un utente loggato esegue
   `getUser` e la RPC.

## 7. `clients.last_measurement_at`

Trigger in produzione:

```
CREATE TRIGGER trg_update_client_last_measurement AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_client_last_measurement()
-- UPDATE clients SET last_measurement_at = NEW.created_at WHERE id = NEW.client_id;
```

- Scrive `created_at` (momento del caricamento), non l'inizio della sessione:
  da qui i +5 minuti sistematici (una misurazione di 5 minuti viene caricata
  alla fine) e i giorni di scarto quando l'app sincronizza in ritardo (Fabio De
  Maria: sessione del 21/05 caricata il 24/05).
- Solo `AFTER INSERT`: nessun ricalcolo su DELETE né su UPDATE di `client_id`.
  Raffaele Vergari: `last_measurement_at` 30/09 15:28:46, ma in tutto il
  database non esiste più nessuna sessione con quel `created_at`: la sessione è
  stata cancellata dopo l'inserimento e il valore è rimasto.
- Numeri al 15/10 (clienti non uniti): 12 con `last_measurement_at` nullo ma
  con sessioni, 55 avanti di più di un'ora rispetto all'inizio dell'ultima
  sessione, 12 con misurazione oggi in Europe/Rome.
- Il sito la usa in "Ultima misurazione", nel filtro periodo della lista
  (`ClientsTable.tsx:51-58`, finestra mobile di 24 ore), in "Da contattare"
  (DD:801) e nel cron `generate_missed_measurement_alerts`. In lista il valore
  è `max(clients.last_measurement_at, ultima sessione remota)` (DD:633).
- L'app non la scrive mai direttamente (grep in `hrv_app/lib`: nessuna
  occorrenza). La funzione del trigger è definita nella `app-040` dell'app:
  cambiarla è una migrazione del sito che riscrive una funzione dell'app, va
  detto nel changelog di entrambi.

## 8. Header, footer, testi legali

- Home: `HomeNavbar.tsx:29-34` (Come funziona, Funzionalità, Prezzi, FAQ,
  Guide, Area professionisti, CTA `startFree`) e un `Footer()` locale in
  `page.tsx:602-665` con **"Minimax Srl", "Via Francesco Baracca, 88 · 36100
  Vicenza", P.IVA 04496840242 scritti nel codice** (:649-654).
- Pagine interne: `src/components/Header.tsx` (Funzionalità, Sport, Guide,
  Area professionisti, CTA `freeTrial`) e `src/components/Footer.tsx` (link a
  `/termini` e `/contatti` che non esistono).
- "The Performance Lab S.r.l.": `layout.tsx:52, 92`, `support.a.json:11`,
  `privacy.a.json`, template email in `docs/email-templates`.
- Stringhe in `messages/_parts/<lingua>/`: prezzi in `home.a.json`
  (:123, 131, 135-136, 147, 175-176, 185), `sportLanding.a.json` (:3, 7, 9, 99,
  101, 120-124), `sport.g.json`, `admin.h.json`, `print.pdf2.json`; costanti
  `PRICE_FOUNDING = 49.9`, `PRICE_STANDARD = 69.9` in `page.tsx:14-15` e
  `PRICE_PRO = 69`, `PRICE_BASE = 49.9` in `sport/page.tsx:23-26`. Carta:
  `common.a.json:5` e `home.a.json:147, 185` ("richiesta") contro
  `registration.c.json:7, 10` ("nessuna"). "4 indici" `home.a.json:84`; "24
  parametri" `home.a.json:14, 44, 107`, `registration.c.json:7`; "29
  parametri" `features.a.json:100`; "Quattro modalità" `features.a.json:55`;
  "3 tipi di test" `guide.b.json:32, 231, 493`, `home.a.json:117`,
  `meta.a.json:4-5`, `guide-knowledge-base.ts:132, 404`; "assistente in basso a
  destra" `guide.b.json:41`; "Affaticamento" `guide.b.json:305`,
  `scores.base.json:17`; ROADMAP `sportLanding.a.json:104-105`; ACWR
  `guide.b.json:561, 566`, `sportLanding.a.json:110`, `alerts.d1.json:47-48`;
  "URL logo (per ora link diretto)" `settings.h.json:22`; "Insights AI"
  `clients.d2.json:44` → `OverviewTab.tsx:173-186`.
- Titoli: layout area con template `%s | Area Professionisti Stress Index`
  (`area-professionisti/layout.tsx:7-9`), home dashboard `dashboardHome.title`
  = "Oggi" → il titolo completo dovrebbe già uscire giusto, da verificare in
  produzione; `not-found.tsx` e `[...rest]` senza metadata, ereditano titolo e
  `index: true` della home.
- "Mercoledì 14 Ottobre": `todayLong()` dentro una classe `capitalize`
  (`page.tsx:105`). "Σ": chiave `analytics.std` = "σ" dentro `uppercase`
  (`AdvancedAnalyticsTab.tsx:89`). "DFA Α1": `uppercase` su
  `sport/sessione/[id]/page.tsx:54, 91`, `SportTabs.tsx:111, 220, 361`,
  `sport/atleta/[id]/page.tsx:192`, `TeamLiveBoard.tsx:550, 607`.

## 9. Database: stato al 15/10

- `alerts`: 2652 righe tutte `new`; 843 gruppi (`client_id`, metrica, valore)
  con più di una riga, 44 nel tuo account.
- `organizations`: tre con `owner_id` = tuo uid (19:54:24, 19:54:31,
  19:55:00 del 27/05), ognuna con un membro; `profiles.organization_id` è
  **NULL** per te, per questo la pagina mostra "Crea la tua organizzazione".
  Unici vincoli: PK e FK su `owner_id`, nessun vincolo di unicità.
- `measurement_analytics` per il tuo uid: 245 righe totali, 44 negli ultimi 30
  giorni. `measured_at` è ancora la forma legacy (+2 ore), `measured_at_utc`
  quella vera.
- Tue schede: 170 non unite; 2 gruppi di omonimi con stessa data di nascita (4
  schede); 34 gruppi su tutto il database. 26 tue sessioni senza `client_id`;
  oggi 28 sessioni globali di cui 16 non assegnate.
- Trial e abbonamenti: `professional_profiles` 82 profili, 12 trial attivi, 70
  scaduti; `abbonamenti` 145 `pro` senza scadenza, 4 `base` senza scadenza, 1
  `prova`; `account_stato` 325 `attivo`.
- FK `measurement_analytics_session_id_fkey` non `DEFERRABLE`.
- Estensioni `unaccent` e `pg_trgm` **non installate**.
- Indici presenti: `sessions` ha solo `started_at_utc desc`,
  `(professionista_id, duration_type, started_at desc)`, `misurata_da`, GIN
  `tags`: **manca `(client_id, …)` e `(professionista_id, started_at_utc)`**.
  `alerts` ha `(professional_id, status, created_at desc)` e `(client_id,
  created_at desc)`. `measurement_analytics` ha `(user_id, measured_at_utc
  desc)` e `(client_id, measured_at desc)`, manca `(client_id, measured_at_utc)`.
- Advisor di sicurezza (15/10):
  - **68 funzioni `SECURITY DEFINER` eseguibili da `anon`**:
    accept_organization_invite account_stato_effettivo
    auth_user_deleted_pulisci_registro backfill_client_baselines
    backfill_night_metrics_from_sessions cleanup_stale_sport_live_data
    client_can_assign_session client_can_assign_session_text
    client_respond_to_link client_rolling_state compute_client_baseline
    compute_night_baseline evaluate_night_alerts
    find_linked_client_user_id_by_email get_client_baselines
    get_client_night_status get_linked_client_monitoring_sessions_by_client_id
    get_linked_client_profile get_linked_client_sessions_as_professional
    get_linked_client_sessions_by_client_id get_linked_client_sessions_by_email
    get_linked_clients_last_remote_analytics
    get_linked_clients_last_remote_analytics_as_professional
    get_linked_clients_last_remote_session
    get_linked_clients_last_remote_session_as_professional
    get_linked_clients_last_remote_session_row
    get_monitoring_sessions_for_professional get_monthly_comparison
    get_my_night_status get_night_baselines get_night_metrics
    get_night_monthly_comparison get_night_overview_for_professional
    get_pending_link_requests hrv_baseline_rest_reference hrv_e_amministrativo
    hrv_my_subject_id hrv_puo_accedere hrv_puo_leggere_soggetto
    hrv_soggetto_e_se_stesso is_superadmin monitoring_can_access
    night_action_level night_can_access night_cron_daily
    night_metrics_upsert_from_session night_rolling_state night_signatures
    night_status_json note_night_alert puo_vedere_come_professionista
    recompute_all_client_baselines refresh_night_status reset_client_baseline
    reset_night_baseline rls_skip_cliente_puo_assegnare rls_skip_registra
    sync_night_alerts sync_session_to_measurement_analytics
    tg_abbonamento_iniziale tg_compute_client_baseline
    tg_create_client_on_active_link tg_ma_salta_non_propria
    tg_night_metrics_delete_from_session tg_night_metrics_from_session
    tg_night_metrics_refresh tg_profiles_ensure_client_bridge
    tg_sessions_salta_non_propria.
    Molte hanno anche `EXECUTE` a `PUBLIC` (grant implicito di Postgres
    sulle funzioni nuove), quindi togliere `anon` non basta: va tolto `PUBLIC`.
  - 80 eseguibili da `authenticated` (le 68 più `account_puo_scrivere`,
    `gdpr_*`, `has_module_access`, `link_client_to_professional[_guarded]`,
    `lookup_professional`, `my_account_access`, `request_client_link`,
    `trigger_errore_registra`): queste ultime sono le API legittime di app e
    sito, restano.
  - **49 funzioni senza `search_path`** (lista nel punto D3 sotto).
  - **21 tabelle con RLS e zero policy**: `abbonamenti`, `abbonamenti_storico`,
    `account_stato`, `alert_rules_dedup_log`, `collegamenti_esclusioni`,
    `collegamenti_riparazione_link_ok`, `collegamenti_riparazione_log`,
    `gdpr_storage_coda`, `hrv_norms`, `hrv_norms_fallback`, `moduli_eccezioni`
    e dieci `*_backup_*` / `*_orfane_*`.
  - **Nuovo, ERROR: 5 tabelle senza RLS create oggi 15/10** da un'altra
    sessione: `backup_laura_20261015_sessions`, `backup_laura_20261015_ma`,
    `backup_marco_morbin_20261015_client`, `_sessions`, `_ma`. Non le tocco,
    vanno in report.
  - Leaked password protection disattivata.

## 10. Cause probabili, punto per punto

### Blocco A

- **A1** le tre pagine non esistono (catch-all `[...rest]`); `/termini` è
  linkata da footer e registrazione.
- **A2** "Minimax Srl" è hardcoded nel footer della home (`page.tsx:649-654`),
  l'unico posto. Tutte le altre pagine usano `Footer.tsx` che non ha titolare.
- **A3** due header (`HomeNavbar` e `Header`) e due footer (locale in `page.tsx`
  e `Footer.tsx`).
- **A4** quattro costanti di prezzo in due file più stringhe sparse nei
  messages: nessuna fonte unica. "99 €" non compare da nessuna parte.
- **A5** `common.a.json:5` (`trialNote`) contro `registration.c.json:7, 10`.
  Il form (`RegistrationForm.tsx`) non chiede nessuna carta.
- **A6** numeri in sei file di messages, in tre lingue; "17 parametri" nel
  dettaglio è un conteggio dinamico di `HrvParamsTable`.
- **A7** `OverviewTab.tsx:173-186`, `settings.h.json:22`,
  `sportLanding.a.json:104-110`, `guide.b.json:561-566`.
- **A8** messaggio scritto dall'app nella lingua del telefono del cliente;
  `OverviewTab.tsx:133` lo mostra grezzo invece di passare da `alertMessage`.
- **A9** il template del layout c'è: da verificare se il titolo "Oggi" visto
  nell'audit viene dalla produzione vecchia; 404 senza `generateMetadata`.
- **A10** `capitalize` su `todayLong`; `uppercase` su "σ" e "α1"; stringhe
  nelle guide.

### Blocco B

- **B1** nessun bug che blocchi il cambio di stato: il clic aggiorna
  `activeKey` e il `useMemo` lo include. L'effetto "non cambia" nasce da:
  (a) asse X a categorie (`:363`), quindi quando tutti i punti stanno negli
  ultimi N giorni ogni preset sopra N disegna la stessa cosa e l'asse non si
  allarga; (b) home tagliata a 365 giorni dal server, "Tutto" = "1a";
  (c) date personalizzate e filtri etichetta/tipo non incrementano `brushKey`,
  e in Recharts 3.8 `setChartData` non azzera `dataStartIndex`
  (`chartDataSlice.js:38-47`): dopo uno zoom lo start resta vecchio;
  (d) `trendData` non memoizzato in `OverviewTab.tsx:49`, nuovo array a ogni
  render; (e) "oggi" calcolato nel fuso del browser contro chiavi in giorno
  italiano, e "7g" copre 8 giorni. Per Doretta (misurazioni 07/10 e 12/05):
  "90 giorni" dovrebbe già dare 1 punto, "Tutto" 2, da riprodurre in locale
  prima di toccare.
- **B2** nessuna media/mediana esistente. La regola "calo = miglioramento per
  lo stress" è in `before-after.ts:203-222` (`SCORE_DELTA_ROWS`,
  `deltaVerdict`), riusabile.
- **B3** nella cartella del dettaglio non c'è nessun `toLocaleString`,
  `Date.now`, `Math.random`, `useId`. Candidati veri: `formatDateTime`,
  `formatDate`, `formatTime` senza fuso usati in componenti client (server UTC
  contro browser Europe/Rome), `linearGradient id="psd-fill"` duplicato
  (`HrvCharts.tsx:456, 510`), e i componenti condivisi di contorno
  (`ClientProfile.tsx:113` `Date.now()`, `OverviewTab.tsx:135`). Da riprodurre
  con la console in locale: la pagina è `force-dynamic` quindi i 12 errori
  dovrebbero ripetersi uguali.
- **B4** `useState(defaultRange(90))` in `MeasurementsTab.tsx:46`;
  l'intestazione usa `measurements.length` (`ClientProfile.tsx:112, 175`).
- **B5** dieci colonne senza `width`, `DataTable.tsx:73-74` con
  `overflow-x-auto`.

### Blocco C

- **C1** in produzione (`main`) `listAllMeasurements` legge
  `measurement_analytics` **senza filtro utente**, ordinata per
  `measured_at_utc` crescente, senza `range()`: la RLS superadmin apre tutto il
  database e PostgREST tronca a **1000 righe, le più vecchie**. Gli ultimi 30
  giorni restano fuori e tutto è zero; "Alert attivi" è giusto perché viene da
  `listClientsEnriched`. Sul branch il filtro sul perimetro riporta 245 righe
  per il tuo account e i numeri tornano, ma la query resta senza paginazione
  (un blocco di 100 utenti può superare le 1000 righe) e un errore diventa
  ancora `[]` silenzioso (DD:1349).
- **C2** `profiles.organization_id` è NULL per te, quindi
  `getOrganizationContext` non trova niente e mostra il form; il POST
  (`api/organization/route.ts:60-84`) controlla il profilo e poi inserisce, non
  è atomico, e l'esito dell'upsert su `profiles` non è controllato: se fallisce
  l'organizzazione resta orfana e il form riappare. `CreateOrganizationForm.tsx:17-34`
  riabilita il bottone prima del `router.refresh()`. Nessun vincolo di
  unicità in tabella.
- **C3** vedi §2: produzione senza perimetro; sul branch le pagine sono
  coerenti ma senza `getDataScope()` né interruttore.
- **C4** `ClientsTable.tsx:51-58`: finestre mobili `Date.now() - last`,
  "Oggi" = 24 ore. Il DB oggi dice 12 clienti in Europe/Rome.
- **C5** vedi §7: trigger su `created_at`, solo INSERT, sessioni cancellate
  non ricalcolate.
- **C6** meccanismo verificato su Doretta: misurazione delle 08:37 UTC del
  07/10 ha `measured_at` legacy 10:37 (forma +2h). Il cron delle 09:00 del 07/10
  crea l'alert. Alle 09:00 del 08/10 il dedup cerca alert con `created_at >
  now() - 24h`: quello del 07/10 09:00:00.1 è appena fuori finestra; la
  misurazione invece è ancora dentro (`measured_at` 10:37 > 09:00 di ieri)
  perché la finestra la confronta con la forma legacy avanti di due ore. Nasce
  il doppione. Non è un bug del cron "una volta al giorno": è la finestra di
  dedup più corta di quella di generazione più il fuso sbagliato. Con due
  misurazioni sotto soglia lo stesso giorno si hanno due alert "legittimi" per
  Mularoni. Nessuna risoluzione automatica esiste.
- **C7** `alertMessage` (`alert-rules.ts:130`) per gli alert del cron ignora
  `message` e `triggering_metric`.
- **C8** definizioni diverse per pagina (§5); "Clienti attivi 789" è
  `listClients` di tutto il DB in produzione, 170 sul branch; "Misurazioni di
  oggi" tagliate a 10 senza link.
- **C9** pannello legge `professional_profiles.trial_expires_at` mentre la
  `sito-024` ha spostato la verità in `abbonamenti` + `account_stato`
  (`docs/COMMERCIALE.md`): la semina del 13/09 ha messo tutti i `profiles.plan
  = 'pro'` in `pro` senza scadenza (145) e i trial in `base` con nota. "In prova
  0" perché conta `abbonamenti.piano = 'prova'` (1) o `trial_expires_at`,
  dipende dal tab. Decisione tua su quale fonte vale.
- **C10** 34 gruppi di omonimi nel DB, 2 nei tuoi; 16 sessioni di oggi senza
  cliente. Esistono `admin_merge_clients`, `collegamenti_merge_card`,
  `clients.merged_into_client_id`: manca solo la vista nel pannello.
- **C11** il dropdown riceve `listClients()` intero.

### Blocco D

- **D1** lista nel §9; molte hanno `EXECUTE` a `PUBLIC`, quindi la revoca va
  fatta su `PUBLIC` e `anon` insieme. Chi chiama cosa: da censire nella
  migrazione (grep in `hrv_app/lib` e `src/`).
- **D2** lista nel §9.
- **D3** 49 funzioni: hrv_clamp_0_100 set_training_load_updated_at
  hrv_percentile_score hrv_normalize_rmssd hrv_lookup_norms hrv_lerp
  hrv_normalize_sdnn hrv_normalize_baevsky_si hrv_istante_reale
  set_started_at_utc set_measured_at_utc update_client_last_measurement
  set_sport_session_utc generate_threshold_alerts
  generate_missed_measurement_alerts calc_score_stress calc_score_recupero
  calc_score_equilibrio calc_score_energia calc_score_modulazione_infiammatoria
  calc_score_composito hrv_gaussian_score compute_proprietary_scores
  monitoring_sessions_touch_updated_at hrv_versione_confrontabile
  sync_session_to_measurement_analytics hrv_rappresentazione_legacy
  set_started_at_compat accept_organization_invite hrv_baseline_params
  notification_reads_append_only hrv_fitness_level hrv_age_group
  tg_ma_score_source collegamenti_nome_norm hrv_baseline_trigger_disattivato
  monitoring_profile_for_row monitoring_nominal_night_minutes
  hrv_sleep_midpoint hrv_midpoint_minutes night_metrics_before_write
  night_hrv_value night_hrv_ms hrv_cv_pct hrv_night_params night_compare_row
  notification_preferences_touch gdpr_nuovo_percorso gdpr_versione_num.
  Molte sono funzioni dell'app (`hrv_*`, `night_*`, `calc_*`): la migrazione
  del sito le altera, va scritto nel changelog dell'app.
- **D4** impostazione del dashboard Auth; `validation.ts:116-136` mappa già
  `weakPassword`, da estendere al messaggio di Supabase sulle password
  compromesse.
- **D5** `RegistrationForm.tsx:151`: `<form onSubmit noValidate>` senza
  `method`; gli input non hanno `name`, quindi senza JS il GET non porta campi
  nell'URL, ma la regola va messa lo stesso.
- **D6** `/auth/callback` e `/auth/confirm` non esistono; il recupero atterra su
  `/imposta-password` (`SetPasswordForm.tsx`) che consuma il token al
  caricamento (`exchangeCodeForSession` / `verifyOtp` a :160-174). La Site URL
  di Supabase è ancora il deep link dell'app (`docs/reset-password.md`).
- **D7** `middleware.ts:57` non legge `error` di `getUser` e non ha try/catch.

### Blocco E

- **E1** `clienti/page.tsx:97` passa tutti i clienti con l'intera
  `lastMeasurement` (`select('*')`, serie comprese) a un componente client.
- **E2** Oggi carica 365 giorni di `measurement_analytics` e tutte le righe del
  perimetro; Analytics tutte le `measurement_analytics` del perimetro senza
  date.
- **E3** nessun `prefetch={false}` in tutto `src`.
- **E4** §6.
- **E5** §9, indici mancanti su `sessions(client_id)` e
  `sessions(professionista_id, started_at_utc)`.

### Blocco F

- **F1** `ClientsTable.tsx:43-46` `includes` su "nome cognome email";
  `GlobalSearch.tsx:43-94` `ilike` su tre colonne separate, interpolazione
  senza escape; `unaccent` non installata.
- **F2** `DataTable` unica con `overflow-x-auto`, nessuna variante a card.
- **F3** `TopBar.tsx:14-41`: segmenti non mappati mostrati grezzi, e il link
  intermedio `/clienti/<id>/misurazione` porta a 404.
- **F4** placeholder "—" in home e card, nessun tooltip.
- **F5** `misurazione/page.tsx:58, 89`: `sensor_name ?? sensor_type ?? 'Polar
  H10'`; le righe sintetiche hanno entrambi null.
- **F6** `num(v, 1)` in più punti per gli score.
- **F7** `sport-data.ts` non filtra la durata.
- **F8** `hrv-reference-ranges.ts:15-33` è una tabella fissa (Task Force 1996);
  `hrv_norms` non è letta dal sito, solo dal trigger degli score.
- **F9** `fullName` non normalizza.

### Blocco G

- **G1** `sport_live_data` ha `professional_id` NOT NULL; l'app lo risolve in
  `sport_live_service.dart:18-76` e lo manda nullo quando l'atleta non ha
  professionista.
- **G2** FK non deferibile; l'app scrive analytics e sessione in due chiamate.
- **G3** da leggere nei log PostgREST, non verificato in questa fase.

## 11. Domande aperte prima di partire

1. Unire `fix/perimetro-home` in `main` adesso (consigliato) o a fine lavoro.
2. A2: "Minimax Srl" era voluto? La holding si chiama Mimax.
3. A5: la verità commerciale sulla carta di credito.
4. C9: fonte di verità trial/abbonamenti (`abbonamenti` + `account_stato`,
   con `trial_expires_at` derivato).
5. Le 5 tabelle `backup_*_20261015` senza RLS create oggi da un'altra
   sessione: non le tocco, le segnalo.
