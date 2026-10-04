# Stress Index — sito e dashboard professionisti

Sito pubblico e area riservata di **Stress Index** (The Performance Lab
S.r.l.): la dashboard web dove il professionista vede clienti, misurazioni,
monitoraggi, sport e avvisi raccolti dall'app Flutter (repo `hrv_app`).
Aggiornato al 30 settembre 2026 (tag `site-2026-09-30`).

## Stack

- **Next.js 14** (App Router), React 18, TypeScript 5, Tailwind CSS 3
- **Supabase** (Postgres 17, Auth, RLS, Storage, pg_cron, Edge Function),
  progetto `ivwmjwukpeldbqkxgvvf`, EU Frankfurt, **condiviso con l'app**
- `recharts` per i grafici, `@react-pdf/renderer` per i PDF, `nodemailer` per
  le email dal server, `zod` + `react-hook-form` per i form
- **Deploy: Vercel**, automatico a ogni push su `main`. Dominio `stressindex.io`
- Test: `npm test` (`node --test src/lib/*.test.ts`)

## Setup locale

```bash
npm install
cp .env.example .env.local      # compilare con i valori del password manager
npm run dev                     # http://localhost:3000
npm run build && npm run lint && npm test
```

### Variabili d'ambiente (solo nomi, i valori stanno nel password manager)

| Nome | Dove serve |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client browser e server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client browser e server |
| `NEXT_PUBLIC_SITE_URL` | link nelle email e redirect |
| `SUPABASE_SERVICE_ROLE_KEY` | solo server: `/api/admin/*`, `/api/clienti*`, ponte monitoraggi; mai `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | solo server: `/api/guide-chat` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | `src/lib/mailer.ts` (avvisi al cliente) e Edge Function delle notifiche |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry, browser e server. Solo su Vercel, ambiente **Production**: senza, l'SDK resta spento (locale, anteprime) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | facoltative, solo build su Vercel: caricano le source map (stack del browser leggibili) |

### Errori (Sentry)

`@sentry/nextjs` su browser, server Node e middleware: `src/instrumentation.ts`,
`src/instrumentation-client.ts`, `src/sentry.{server,edge}.config.ts`, opzioni
comuni in `src/lib/sentry-options.ts`.

- **Release = commit** (`VERCEL_GIT_COMMIT_SHA`), **environment = `VERCEL_ENV`**
  (`production` in produzione), fissati alla build da `next.config.js`.
- **Utente = solo uuid.** `sendDefaultPii: false`; `beforeSend` toglie tutto
  dell'utente tranne `id`, la query string dagli URL (porta il token delle
  stampe) e le email dai testi. Mai nomi, email, valori di misurazione.
- Solo errori: niente tracce di prestazione, niente replay.
- **Nessun errore muto** (`src/lib/data-error.ts`): una lettura che fallisce
  chiama `reportDataError` (il ripiego resta) o lancia `dataLoadError` (la
  pagina mostra `DataLoadNotice` al posto della sezione, la stampa si ferma).
  Mai una lista vuota al posto di un errore. Cosa resta da fare è in
  `docs/debiti-tecnici.md`.

Secret delle Edge Function (`supabase secrets set`): `NOTIFY_SECRET`,
`SITE_URL`, le `SMTP_*`; `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` li inietta Supabase.

## Lingue (i18n)

Sito in **italiano** (default, senza prefisso), **inglese** (`/en/...`) e
**tedesco** (`/de/...`) con `next-intl`: tutte le pagine stanno in
`src/app/[locale]/`, gli slug restano italiani in ogni lingua. Il middleware
sceglie la lingua da prefisso URL, poi cookie `NEXT_LOCALE`, poi
`Accept-Language` alla prima visita; switcher IT / EN / DE in navbar, footer,
login e top bar della dashboard. I messaggi finali `messages/{it,en,de}.json`
sono **generati** dai frammenti `messages/_parts/<lingua>/<namespace>.<pacchetto>.json`:

```bash
node scripts/i18n-merge.mjs     # rigenera messages/*.json dai frammenti
node scripts/i18n-check.mjs     # chiavi allineate nelle 3 lingue, termini vietati, trattini lunghi
node scripts/i18n-residui.mjs   # euristica: stringhe italiane rimaste nei sorgenti
```

Convenzioni in `docs/i18n-convenzioni.md`, glossario dall'app in
`docs/i18n-glossario.md`, template email Supabase trilingue in
`docs/email-templates/`. La lingua scelta alla registrazione finisce in
`user_metadata.locale`; le route API la leggono con `getRequestLocale`
(`?locale=`, cookie, Referer, Accept-Language).

## Struttura delle pagine

### Pubbliche
`/` home, `/funzionalita`, `/sport` (landing Piano Pro), `/supporto`,
`/privacy` (informativa di app e sito, testi in `privacy.a.json`),
`/guide` (guide + assistente Claude via `/api/guide-chat`), `/registrazione`
(+ `/conferma`, trial 60 giorni), `/imposta-password` (atterraggio dei link
Supabase, fuori dal middleware), `robots`, `sitemap`, immagine OpenGraph.

### Area professionisti (`/area-professionisti`, `src/app/[locale]/area-professionisti/`)
Middleware: senza sessione → login; con sessione chiama `my_account_access`:
account `bloccato` → logout, `sospeso` → ogni pagina riscritta su `/sospeso`.

| Route | Cosa fa |
|---|---|
| `/` "Oggi" | avvisi del cron (`alerts`) uniti agli eventi dell'app (`alert_events`) |
| `/clienti` | elenco, "Nuovo cliente" (POST `/api/clienti`, stesso flusso dell'app) |
| `/clienti/[id]` | scheda con tab **Panoramica, Misurazioni, Prima e dopo, Monitoraggi, Analytics, Report, Note, Messaggi, Impostazioni**; sezione "Accesso all'app" (password temporanea, reset, registro accessi) |
| `/clienti/[id]/misurazione/[sessionId]` | dettaglio misurazione, **vista per tipo di sessione** (sotto) |
| `/clienti/[id]/confronto?a=&b=` | confronto fra due sessioni (5 score, FC, RMSSD, SDNN, pNN50, DFA α1, Baevsky; Poincaré affiancati sulla stessa scala) |
| `/analytics` | analytics di studio |
| `/monitoraggio`, `/monitoraggio/[id]` | monitoraggi 24h e notti Sonno (gating moduli `monitoring`/`sleep`) |
| `/sport`, `/sport/atleta/[id]`, `/sport/sessione/[id]`, `/sport/team-live` | Modulo Sport (gating modulo `sport`): dashboard, atleti, sessioni, Team Live |
| `/organizzazione` | team, membri, inviti |
| `/impostazioni` | profilo, notifiche (`?tab=notifiche`), account |
| `/sospeso` | pagina account sospeso |

Le pagine clienti, monitoraggio e sport accettano `?professionista=` per la
**modalità supporto** del superadmin.

### Super Admin (`/area-professionisti/professionisti`, solo `profiles.is_superadmin`)
Tab **Panoramica** (attivi, in prova, in scadenza, sospesi), **Utenti**
(stato account, abbonamenti, moduli per piano ed eccezioni, ruolo, password,
correzione email con anteprima e audit, cancellazione), **Clienti** (unione
doppioni), **Collegamenti** (link manuali), **Monitoraggi**, **Salute
collegamenti** (ripara, unisci, esclusioni); `/professionisti/health` report
di integrità. Tutte le azioni passano da `/api/admin/*` con `service_role` e
scrivono `admin_audit_log`.

### Viste per tipo di sessione
`src/lib/measurement-type.ts` normalizza `test_type`:
- **standard**: Poincaré, spettro, ritmogramma (`HrvCharts.tsx`), tabella
  parametri; misurazioni lunghe (≥ 12 min o con segmenti) in
  `LongMeasurementView.tsx`;
- **ortostatica** (`OrthostaticView.tsx`): indice di reattività, 14 parametri
  supino/in piedi con direzione attesa, grafici per fase;
- **coerenza** (`CoherenceView.tsx`): score, frequenza respiratoria e di
  risonanza, andamento nel tempo, spettro con linea di risonanza;
- **sport** (`/sport/sessione/[id]`): FC, RMSSD, DFA α1, TRIMP, RPE e, se
  `test_type = 'threshold_test'`, la vista del **test soglie**;
- **monitoraggio 24h** (`Monitoring24hDetail.tsx`) e **sonno**
  (`SleepDetail.tsx`), con PDF `monitoring-pdf.tsx` / `sleep-pdf.tsx`.

### Test soglie (VT1/VT2)
`src/lib/threshold-types.ts` legge `sport_sessions.threshold_test` (JSON
scritto dall'app, migrazione 031) e i campi `hr_vt1`, `hr_vt2`, `power_*`,
`speed_*`, `vt_mode`, `vt_test_date`, `hr_zones`, `hr_zones_manual`,
`threshold_session_id` di `clients` (032). **Nessun ricalcolo lato sito.**
Pagina sessione: soglie stimate con IC95 e intensità (affidabile se R² ≥ 0,6),
scatter α1-FC, step, HRR60 (≥ 25 buono, 13–24 medio, ≤ 12 da migliorare),
zone proposte, nota metodologica. Scheda atleta: sezione "Test soglie" con zone
in uso, avviso oltre 90 giorni, trend VT1/VT2 e storico.

### Prima e dopo
`src/lib/before-after.ts` è il porting 1:1 di `before_after_pairs.dart`
dell'app: stesso cliente, stesso giorno (Europe/Roma), `pre_session →
post_session` e `pre_workout → post_workout` mai incrociati, ogni post con il
pre precedente più vicino. Tab con variazione media dei cinque score e link al
confronto. Filtri per etichetta e tipo di test in `SessionFilterChips.tsx`
(AND).

### Scale fisse dei grafici
`src/lib/chart-scales.ts`, stessi valori dell'app: RR 400–1400 ms (estesa
300–1600), PSD asse Y log 10–1.000.000 ms²/Hz (estesa 1–10.000.000), asse X
0–0,5 Hz con bande VLF/LF/HF. `ScaleToggle.tsx` passa a "Zoom" (scala
adattiva). Default: scala fissa.

### Soglie avvisi
- `src/lib/alert-rules.ts` (puro) + `alert-rules-server.ts` (letture):
  9 regole HRV di `alert_rules` con **precedenza della regola per cliente**
  sulla generale, anche se disattivata (stessa logica dell'app). UI
  `AlertRulesSection.tsx` nel tab Impostazioni del cliente.
- `client_settings` (4 soglie) alimenta i job pg_cron del sito
  (`generate_threshold_alerts_hourly`, `generate_missed_alerts_6h`) che
  scrivono in `alerts`. I due sistemi coesistono.

## PDF (pagine di stampa + Chrome headless)

I PDF di misurazione, report periodico e monitoraggio sono la **stampa di una
pagina del sito** che riusa gli stessi componenti della dashboard (gauge,
Poincaré, ritmogramma, PSD, trend, tabelle) in modalità `print`:

| Route API | Pagina di stampa | Bottone |
|---|---|---|
| `GET /api/pdf/misurazione/[sessionId]?clientId=&locale=` | `/stampa/misurazione/[sessionId]` | `DownloadMeasurementPdfButton` |
| `GET /api/pdf/report-periodico?clientId=&from=&to=&locale=` | `/stampa/report-periodico` | tab Report |
| `GET /api/pdf/monitoraggio/[id]?variant=&locale=` | `/stampa/monitoraggio/[id]` | azioni del monitoraggio, email |

La route verifica i permessi (RLS, superadmin in sola lettura), apre la
pagina con `puppeteer-core` (Chrome locale in sviluppo, `@sparticuz/chromium`
su Vercel, `maxDuration` 60) inoltrando i cookie di sessione e un **token
firmato** a 60 secondi (`src/lib/print-token.ts`), attende
`window.__REPORT_READY__` (font e grafici pronti) e restituisce `page.pdf`
A4. Le pagine `/stampa/*` rispondono 404 senza sessione o token; il token è
monouso (una seconda verifica fallisce) e `PDF_TOKEN_SECRET` è obbligatorio
in produzione (senza, le route rispondono 500 `pdf_secret_missing`; solo in
sviluppo esiste un fallback derivato dalla service role). `?variant=client`
produce la versione per il cliente finale (score con tachimetri, lettura in
parole, ritmogramma, niente tabelle né sigle), usata anche dal link
nell'email del monitoraggio. Con
`PDF_LEGACY=true` le route inoltrano ai vecchi generatori react-pdf
(`/api/measurement-pdf`, `/api/client-report`, `/api/monitoring/[id]/pdf`),
da rimuovere dopo una settimana di esercizio.

Dati di simulazione per verificare i layout senza database (solo fuori
produzione o con `PDF_FIXTURES=true`): `?fixture=standard|orthostatic|coherence|long`
sulla pagina misurazione, `?fixture=report` sul report periodico;
`node scripts/pdf-esempi-fixture.mjs` genera i PDF in `docs/pdf-esempi/`
(ignorati da git), `node scripts/pdf-esempi.mjs` fa lo stesso con dati reali
del proprio account. `node scripts/test-pdf-permessi.mjs --base <url>
--superadmin <email>` crea due professionisti di prova e verifica permessi,
token (scaduti, riusati, contraffatti) e sola lettura del superadmin, poi
cancella tutto. Variabili: `PDF_TOKEN_SECRET` (facoltativa, altrimenti
derivata dalla service role), `CHROME_PATH` (facoltativa in locale).

## Route API (`src/app/api/`)
- `/api/admin/*` — `requireSuperadmin()` + `service_role`: utenti, account
  (stato, abbonamento, moduli), email, password, ruolo, sessioni, monitoraggi,
  clienti (merge, move), collegamenti, salute, piano.
- `/api/clienti` (POST) e `/api/clienti/[id]/accesso` — `requireProfessional`:
  cookie **o `Authorization: Bearer <token>`** (usato dall'app); account
  sospeso/bloccato → 403; rate limit e `professional_access_log`.
- `/api/client-report`, `/api/measurement-pdf`, `/api/monitoring/[id]/{pdf,
  rr-csv, windows-csv, email, events}`, `/api/organization*` — sessione
  cookie + RLS.
- `/api/guide-chat` — senza autenticazione, allowlist Origin + rate limit.

## Edge Function (`supabase/functions/`)
`create-client-access` (v2, flusso unico via `link_client_to_professional`),
`notify-measurement` (webhook INSERT su `sessions`, `monitoring_sessions`,
`night_metrics`), `notify-digest` (riepilogo orario da pg_cron), `_shared/`.
Deploy: `supabase functions deploy <nome> --project-ref ivwmjwukpeldbqkxgvvf
--no-verify-jwt` (le due di notifica). Dettagli in `docs/NOTIFICHE.md`.

## Data e ora delle misurazioni

Regola unica in `src/lib/measured-time.ts` (modulo senza dipendenze, coperto da
`src/lib/format.test.ts`); `src/lib/format.ts` la riesporta e aggiunge la
lingua. In sintesi:

- L'istante si legge SOLO dalle colonne `_utc`: `sessions.started_at_utc`,
  `sport_sessions.start_time_utc`, `measurement_analytics.measured_at_utc`.
  `started_at`, `start_time` e `measured_at` sono la forma legacy (orologio da
  parete italiano etichettato `+00`) e sono due ore avanti d'estate.
  `tz_offset_minutes` non distingue le due forme: non usarlo per decidere.
- Ordinamenti e filtri per periodo vanno sulle colonne `_utc` dentro Postgres;
  i confini di giornata si costruiscono con `inizioGiornoIta` / `fineGiornoIta`
  / `intervalloGiorniIta`, mai con la mezzanotte UTC.
- Quando una query unisce `sessions` e `measurement_analytics` si passa da
  `conIstanteSessione()`: `started_at_utc` è corretta su tutte le righe,
  `measured_at_utc` è stata riallineata dalla `sito-029` (applicata), ma la
  regola resta: l'istante si legge dalla sessione.
- `monitoring_sessions` e `night_metrics` sono fuori da questa regola: la prima
  ha `start_time` già in UTC vero (si mostra con `wallDate` di
  `monitoring-format.ts`), la seconda usa `date` e `time without time zone`.

## Migrazioni (`supabase-migrations/`, a mano nel SQL Editor, in ordine)

**Nome dei file: `sito-NNN_descrizione.sql`.** Due repo scrivono sullo stesso
database Supabase e le numerazioni si erano sovrapposte (esistevano due `029`,
una qui e una in `hrv_app`). Il prefisso dice da quale repo viene la migrazione;
il numero è rimasto quello di prima, quindi ogni riferimento storico ("la 022
del sito") continua a valere. L'app usa `app-NNN_`; i suoi file più vecchi hanno
un nome descrittivo senza numero e restano così. La regola completa è in
`CLAUDE.md`, sezione "Migrazioni: nomi fra i due repo".

Stato verificato sul catalogo di produzione il 04/10/2026 (tagliando
`hrv_app/docs/audit/2026-10-04.md` §3.1 e controllo diretto degli oggetti).

| File | Scopo | Stato |
|---|---|---|
| `supabase-migration.sql` (radice) | registrazione trial | applicata |
| sito-001 `dashboard_tables` | tabelle dashboard (`clients.id` TEXT) | applicata |
| sito-002 `pg_cron_alerts` | alert automatici da `client_settings` | applicata |
| sito-003 `rls_measurement_analytics` | RLS + indici | applicata |
| sito-004 `hrv_demographic_norms` | norme Nunan/Voss/Schumann | applicata |
| sito-005 `compute_proprietary_scores` | `calc_score_*` in SQL | applicata |
| sito-006 `backfill_measurement_analytics` | backfill da `sessions.hrv_data` | applicata |
| sito-007 `sync_sessions_to_measurement_analytics` | trigger di sync | applicata |
| sito-008 `organizations` | organizzazioni | applicata, policy con nomi diversi |
| sito-009 `client_peso_altezza` | peso/altezza | applicata |
| sito-010 `superadmin_read` | `is_superadmin()` + read | applicata, nomi diversi; mancano read su `client_settings`, `alerts`, `messages` |
| sito-011 `superadmin_sport_read` | read sport | applicata |
| sito-012 `sport_live_data` | Team Live | parziale (tabella nella forma dell'app) |
| sito-013 `superadmin_update_plan` | cambio piano | applicata |
| sito-014 `restore_demographic_trigger` | trigger non sovrascrittivo (attivo) | applicata |
| sito-015 `recalc_degraded_rows` | ricalcolo righe | applicata |
| sito-016 `linked_clients_last_remote_session` | ultima misura remota | applicata |
| sito-017 `client_user_id_admin_ops` | ponte + admin ops + audit | applicata (STEP 2 no) |
| sito-018 `monitoring_site` | monitoraggio sul sito | applicata |
| sito-019 `collegamenti_flusso_unico` | `link_client_to_professional` | applicata (13/09) |
| sito-020 `collegamenti_salute` | vista salute, cron settimanale | applicata |
| sito-021 `collegamenti_backup` | backup `_20260913` | applicata |
| sito-022 `collegamenti_riparazione` | riparazione blocchi A–I | applicata; l'indice `uq_client_professional_active` l'ha creato la `app-041` (04/10) |
| sito-023 `collegamenti_esclusioni` | "non unire" verificati | applicata (27/09) |
| sito-024 `commerciale_account` | stato, abbonamenti, moduli, `has_module_access` | applicata (27/09) |
| sito-024b `stato_attivo_e_sonno` | tutti attivi, `sleep` in pro e prova | applicata |
| sito-025 `notifiche_misurazioni` | preferenze, coda, log | applicata |
| sito-026 `notifiche_cron` | cron notifiche (segreto sostituito a mano) | applicata |
| sito-027 `accesso_cliente` | registro accessi, `must_change_password` | applicata |
| sito-028 `fix_cancellazione_utenti` | FK e registro compatibili con `deleteUser` | applicata |
| sito-029 `measured_at_utc_dalla_sessione` | `measurement_analytics.measured_at_utc` riallineata a `sessions.started_at_utc` + trigger corretto | applicata (in produzione c'è `set_measured_at_utc()`) |
| sito-030 `notifiche_lette` | `notification_reads`: data di lettura delle notifiche per singolo utente | applicata (in produzione c'è `notification_reads`) |
| sito-031 `collegamento_in_attesa` | RPC `request_client_link`: collegamento `pending` con `requested_by`, in attesa della conferma del cliente | applicata, dopo `app-035` (in produzione c'è `request_client_link`; il corpo che vale oggi è quello della `app-039`) |
| sito-032 `vista_superadmin_sessioni_remote` | `puo_vedere_come_professionista` + le tre `*_as_professional`: le misurazioni remote si leggono per conto del professionista proprietario | applicata (02/10) |
| sito-033 `stampa_sessioni_remote` | `puo_vedere_come_professionista` accetta anche la `service_role`, per la via "solo token" delle pagine di stampa | applicata (02/10) |
| sito-034 `guarded_non_per_anon` | EXECUTE su `link_client_to_professional_guarded` tolto a PUBLIC e ad `anon`; resta ad `authenticated` e `service_role`. Collaudo: `scripts/sql-test/test_sito-034.sql` | applicata (04/10): anon riceve `42501 permission denied`, e2e dell'app verde dopo |

**Ordine fra i due repo** (storico: entrambe sono applicate):
`app-035_conferma_collegamento_cliente.sql` (repo `hrv_app`) andava applicata
**prima** di `sito-031`. app-035 crea la colonna
`requested_by` che la 031 scrive, e fa un backfill
`requested_by = client_user_id` su tutte le righe dove è NULL: un link
`pending` creato da un professionista prima di app-035 verrebbe backfillato
come se l'avesse chiesto il cliente, e all'app non comparirebbe mai fra le
richieste da accettare — una richiesta persa in silenzio. La 031 si rifiuta di
applicarsi se la colonna non c'è. Nessun oggetto è creato dalle due
migrazioni: app-035 fa `requested_by`, `idx_cpl_requested_by`,
`client_respond_to_link`, `tg_cpl_client_cambia_solo_stato` e il suo trigger;
la 031 solo `request_client_link`.

La 022 non è nella tabella: è una riparazione rieseguibile, non una migrazione
di schema. La versione corretta (quella con `pg_constraint` e `_align_ko`)
**non è mai stata eseguita in produzione**: la tabella
`collegamenti_riparazione_c_dettaglio`, che quella versione crea, là non
esiste. In produzione il log ha tre run, l'ultimo del 13/09;
`uq_client_professional_active` è stato creato il 04/10 dalla `app-041`, dopo
la revoca dei link doppi. Il dettaglio
coppia-per-coppia del blocco C si legge con `sito-022_dettaglio_c.sql`, da
lanciare subito dopo l'anteprima.

Le migrazioni dell'app (`hrv_app/supabase/migrations/`) e il loro stato sono
nel contesto dell'app, `docs/STRESS_INDEX_CONTEXT_v4.md` §12.

## Documentazione
`CLAUDE.md` (regole per le sessioni), `CHANGELOG.md`, `docs/COMMERCIALE.md`
(024 e lavoro da fare nell'app), `docs/NOTIFICHE.md`,
`docs/COLLEGAMENTI_AUDIT.md`, `docs/MONITORAGGIO_SITO_ANALISI.md`,
`docs/reset-password.md`, `docs/debiti-tecnici.md` (cosa resta aperto, da
rileggere a ogni tagliando).

## Palette

| Colore | Hex | Uso |
|---|---|---|
| Teal | #4FA39A | primario, CTA |
| Teal Dark | #2E746C | hover, evidenze |
| Anthracite | #2F343A | testi |
| Background | #F6F7F8 | sfondo |
| White | #FFFFFF | card |
