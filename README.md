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

## Migrazioni (`supabase-migrations/`, a mano nel SQL Editor, in ordine)

Stato verificato sul catalogo di produzione il 27/09/2026.

| File | Scopo | Stato |
|---|---|---|
| `supabase-migration.sql` (radice) | registrazione trial | applicata |
| 001 `dashboard_tables` | tabelle dashboard (`clients.id` TEXT) | applicata |
| 002 `pg_cron_alerts` | alert automatici da `client_settings` | applicata |
| 003 `rls_measurement_analytics` | RLS + indici | applicata |
| 004 `hrv_demographic_norms` | norme Nunan/Voss/Schumann | applicata |
| 005 `compute_proprietary_scores` | `calc_score_*` in SQL | applicata |
| 006 `backfill_measurement_analytics` | backfill da `sessions.hrv_data` | applicata |
| 007 `sync_sessions_to_measurement_analytics` | trigger di sync | applicata |
| 008 `organizations` | organizzazioni | applicata, policy con nomi diversi |
| 009 `client_peso_altezza` | peso/altezza | applicata |
| 010 `superadmin_read` | `is_superadmin()` + read | applicata, nomi diversi; mancano read su `client_settings`, `alerts`, `messages` |
| 011 `superadmin_sport_read` | read sport | applicata |
| 012 `sport_live_data` | Team Live | parziale (tabella nella forma dell'app) |
| 013 `superadmin_update_plan` | cambio piano | applicata |
| 014 `restore_demographic_trigger` | trigger non sovrascrittivo (attivo) | applicata |
| 015 `recalc_degraded_rows` | ricalcolo righe | applicata |
| 016 `linked_clients_last_remote_session` | ultima misura remota | applicata |
| 017 `client_user_id_admin_ops` | ponte + admin ops + audit | applicata (STEP 2 no) |
| 018 `monitoring_site` | monitoraggio sul sito | applicata |
| 019 `collegamenti_flusso_unico` | `link_client_to_professional` | applicata (13/09) |
| 020 `collegamenti_salute` | vista salute, cron settimanale | applicata |
| 021 `collegamenti_backup` | backup `_20260913` | applicata |
| 022 `collegamenti_riparazione` | riparazione blocchi A–I | applicata; **indice `uq_client_professional_active` mancante** |
| 023 `collegamenti_esclusioni` | "non unire" verificati | applicata (27/09) |
| 024 `commerciale_account` | stato, abbonamenti, moduli, `has_module_access` | applicata (27/09) |
| 024b `stato_attivo_e_sonno` | tutti attivi, `sleep` in pro e prova | applicata |
| 025 `notifiche_misurazioni` | preferenze, coda, log | applicata |
| 026 `notifiche_cron` | cron notifiche (segreto sostituito a mano) | applicata |
| 027 `accesso_cliente` | registro accessi, `must_change_password` | applicata |
| 028 `fix_cancellazione_utenti` | FK e registro compatibili con `deleteUser` | applicata |

Le migrazioni dell'app (`hrv_app/supabase/migrations/`) e il loro stato sono
nel contesto dell'app, `docs/STRESS_INDEX_CONTEXT_v4.md` §12.

## Documentazione
`CLAUDE.md` (regole per le sessioni), `CHANGELOG.md`, `docs/COMMERCIALE.md`
(024 e lavoro da fare nell'app), `docs/NOTIFICHE.md`,
`docs/COLLEGAMENTI_AUDIT.md`, `docs/MONITORAGGIO_SITO_ANALISI.md`,
`docs/reset-password.md`.

## Palette

| Colore | Hex | Uso |
|---|---|---|
| Teal | #4FA39A | primario, CTA |
| Teal Dark | #2E746C | hover, evidenze |
| Anthracite | #2F343A | testi |
| Background | #F6F7F8 | sfondo |
| White | #FFFFFF | card |
