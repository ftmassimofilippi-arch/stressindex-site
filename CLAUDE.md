# CLAUDE.md — Stress Index, sito e dashboard (Next.js)

Istruzioni per le sessioni Claude Code in questo repo. Aggiornate al
18 ottobre 2026. Le regole comuni ad app e sito sono le stesse del
`CLAUDE.md` di `../hrv_app` (e del suo `docs/00_REGOLE_SVILUPPO_STRESS_INDEX.md`);
se cambiano, si cambiano in tutti e due.

## Da leggere per primi

1. `README.md` — stack, pagine, API, Edge Function, migrazioni con stato.
2. `../hrv_app/docs/STRESS_INDEX_CONTEXT_v4.md` — contesto unico del
   prodotto (algoritmi, scale, regole del database, stato di tutte le
   migrazioni). Il sito **legge** ciò che l'app scrive.
3. `docs/COMMERCIALE.md` (stato account, abbonamenti, moduli),
   `docs/NOTIFICHE.md`, `docs/COLLEGAMENTI_AUDIT.md`,
   `docs/MONITORAGGIO_SITO_ANALISI.md`.
4. `CHANGELOG.md`.
5. `../hrv_app/docs/PIANO_SOLIDITA.md` se il lavoro tocca calcoli, dati
   condivisi o un blocco del piano.

## Processo

- **Prima analisi, poi codice.** Se il lavoro tocca un bug o codice
  esistente, la prima sessione è SOLO ANALISI e si ferma con un riepilogo.
- **Un ramo per funzione**, da `main` aggiornato; mai lavoro diretto su
  `main`, mai funzioni diverse sullo stesso ramo, mai due sessioni sullo
  stesso repo nello stesso momento.
- **Commit piccoli**, messaggi in italiano, test verdi dopo ognuno.
- **Bug trovati per caso** non si correggono al volo: si scrivono in
  `docs/BUG_CONGELATI.md` (crearlo se manca) e si decidono a parte.
- A fine sessione: push del ramo e riepilogo breve (massimo 15 righe) da
  incollare in chat.

## Regole fisse

- **Segreti mai nei file committati, nei documenti o nei prompt**: `.env*`
  (solo `.env.example` con segnaposto), service key, `ANTHROPIC_API_KEY`,
  `SMTP_*`, `NOTIFY_SECRET`. Stanno nel password manager o nelle variabili
  d'ambiente di Vercel e Supabase.
  Nei documenti si scrive "nel password manager". Nella 026 il segreto si
  sostituisce a mano al momento di applicarla.
- **`service_role` solo lato server** (`createAdminClient()` nelle route
  `/api/admin/*`, `/api/clienti*`, ponte monitoraggi); mai in un componente
  client, mai con prefisso `NEXT_PUBLIC_`.
- **Un'unica implementazione per ogni calcolo HRV e score, in Dart
  nell'app.** Mai duplicarla nel sito né in SQL: il database salva il
  risultato e il sito lo legge. Fasce degli score solo da
  `score_zones.dart` dell'app, SWC solo da `ln_rmssd_swc.dart` (il sito si
  allinea con `../hrv_app/docs/SWC_SITO_TODO.md`). Debito esistente da non
  allargare: `calc_score_*` (`sito-005`, `sito-014`) e le statistiche sport
  calcolate in `SportCharts.tsx`, `sport-data.ts`, `AdvancedAnalyticsTab.tsx`.
- **Il sito non ricalcola**: score, soglie VT1/VT2, coppie prima/dopo e
  alert vengono dall'app o dal database. I porting in `src/lib`
  (`alert-rules.ts`, `before-after.ts`, `chart-scales.ts`,
  `threshold-types.ts`) devono restare identici al Dart; se cambia uno,
  cambia l'altro.
- **Perimetro esplicito**: nell'area professionisti ogni lista filtra sul
  professionista loggato e sui suoi clienti con link `active`
  (`src/lib/perimetro.ts`, `perimetro-server.ts`). La RLS dice che cosa si può
  leggere, non che cosa una pagina mostra: le policy `superadmin_read_*`
  aprono tutto. Nessuna eccezione per il superadmin finché
  `SUPERADMIN_VEDE_DATI_CLIENTI` (`src/lib/superadmin-scope.ts`) è `false`.
- **`clients.id` è TEXT**; `client_professional_links.client_id` è l'uid.
  Colonne assenti in produzione si leggono con
  `selectWithMissingColumnFallback`.
- **Accesso ai moduli** da `my_account_access()` / `has_module_access`
  (`src/lib/account-access.ts`); `profiles.plan` è una copia legacy da non
  scrivere.
- **Collegamenti**: ogni scrittura passa da `link_client_to_professional`
  (route admin comprese).
- **Migrazioni** in `supabase-migrations/`, nome `sito-NNN_descrizione.sql`,
  numerate, idempotenti, **in transazione** (`begin; ... commit;`),
  **collaudate su Postgres locale** prima, a mano nel SQL Editor e **mai
  applicate in produzione senza conferma esplicita di Massi**. Vedi "Migrazioni: nomi fra i due repo"
  qui sotto. Lettura del DB di produzione con `supabase db query --linked`
  (solo SELECT senza via libera), senza dati personali nell'output; quando
  bastano, le viste pseudonimizzate `debug.*` (`app-043`). Lo stato reale è
  nel README, sezione Migrazioni.
- **RLS**: ogni tabella nuova nasce con RLS attiva e le sue policy nella
  stessa migrazione.
- **Tabelle di backup e di log**: si creano con RLS attiva e senza grant ad
  `anon` e `authenticated`, **nella stessa transazione** del `create table`:
  ```sql
  begin;
  create table public.backup_xxx_AAAAMMGG as select ...;
  alter table public.backup_xxx_AAAAMMGG enable row level security;
  revoke all on public.backup_xxx_AAAAMMGG from anon, authenticated;
  commit;
  ```
  In `public` un `create table` (anche `as select`) nasce senza RLS e con i
  grant di default di Supabase: è leggibile da chiunque via `/rest/v1` finché
  non lo si chiude. Successo il 15/10/2026 con sei tabelle di copie di dati
  personali (chiuse da `sito-045` e `sito-046`). Vale anche per gli script da
  incollare nel SQL Editor.
- `src/lib/supabase-server.ts` usa `next/headers`: i moduli "puri" importati
  dai client component non devono importarlo (per questo esistono
  `alert-rules.ts` e `alert-rules-server.ts` separati).
- Linguaggio wellness: mai diagnosi, paziente, clinico, medico, terapia,
  referto, cartella clinica, biomarcatore; "Adattamento" in UI per
  `score_modulazione_infiammatoria`, **colonna che non si rinomina mai**.
- **Il rapporto LF/HF non si usa** in testi, grafici o PDF nuovi. Le pagine
  che lo mostrano oggi sono debito: non si allarga.
- **i18n**: **ogni testo nuovo nasce in IT, EN e DE dall'inizio**. Sito IT/EN/DE con next-intl, pagine in `src/app/[locale]/`,
  slug italiani in tutte le lingue. Nessuna stringa visibile hardcoded: le
  stringhe vanno nei frammenti `messages/_parts/<lingua>/<ns>.<pacchetto>.json`
  e si rigenerano i file finali con `node scripts/i18n-merge.mjs`; prima di
  chiudere `node scripts/i18n-check.mjs` deve passare. Link e router solo da
  `@/i18n/navigation`; date e numeri con la `locale` (`src/lib/format.ts`).
  Convenzioni in `docs/i18n-convenzioni.md`, glossario in `docs/i18n-glossario.md`.
- Mai fare push forzato su `main`; `supabase/.temp/` è locale e ignorato.

## Migrazioni: nomi fra i due repo

`hrv_app` e `stressindex-site` applicano migrazioni **allo stesso database
Supabase**, ognuno dalla propria cartella. Le due numerazioni si erano
sovrapposte: esistevano due `029` diverse, una per repo.

**Regola.** Il nome porta il prefisso del repo che possiede la migrazione, e il
numero resta quello del repo:

| Repo | Cartella | Nome |
|---|---|---|
| `stressindex-site` | `supabase-migrations/` | `sito-NNN_descrizione.sql` |
| `hrv_app` | `supabase/migrations/` | `app-NNN_descrizione.sql` |

- Il numero **non** si condivide fra i repo e non deve essere unico fra i due:
  a distinguerle è il prefisso. `sito-029` e `app-029` sono due migrazioni
  diverse e va bene così.
- Un numero nuovo si prende guardando **solo** la propria cartella, l'ultimo più
  uno. Non serve coordinarsi con l'altro repo.
- I numeri esistenti non sono stati cambiati, solo prefissati: i riferimenti
  storici ("la 022 del sito", "la 028 dell'app") restano validi.
- I file più vecchi di `hrv_app` hanno un nome descrittivo senza numero
  (`alerts.sql`, `tz_offset_minutes.sql`): si lasciano come sono, non
  collidono con niente. Ogni file NUOVO segue la regola.
- Nel parlato e nei documenti si dice sempre di chi è la migrazione: "la
  `sito-030`", "la `app-033`". Mai il numero nudo.

## Prima di chiudere una sessione

- `npm run build`, `npm run lint`, `npm test`, `node scripts/i18n-check.mjs` puliti.
- Aggiornare `CHANGELOG.md` e, se cambiano pagine/API/migrazioni, `README.md`.
- `git push`; a fine blocco di lavoro un tag `site-AAAA-MM-GG`.

## Comandi

```bash
npm run dev | npm run build | npm run lint | npm test
supabase db query --linked "select ..."
supabase functions deploy notify-measurement --project-ref ivwmjwukpeldbqkxgvvf --no-verify-jwt
supabase functions deploy notify-digest      --project-ref ivwmjwukpeldbqkxgvvf --no-verify-jwt
supabase functions deploy create-client-access --project-ref ivwmjwukpeldbqkxgvvf
node scripts/e2e-accesso-cliente.js   # lascia righe nel registro accessi di produzione: leggere la coda dell'output
```
