# CLAUDE.md — Stress Index, sito e dashboard (Next.js)

Istruzioni per le sessioni Claude Code in questo repo. Aggiornate al
30 settembre 2026 (tag `site-2026-09-30`).

## Da leggere per primi

1. `README.md` — stack, pagine, API, Edge Function, migrazioni con stato.
2. `../hrv_app/docs/STRESS_INDEX_CONTEXT_v4.md` — contesto unico del
   prodotto (algoritmi, scale, regole del database, stato di tutte le
   migrazioni). Il sito **legge** ciò che l'app scrive.
3. `docs/COMMERCIALE.md` (stato account, abbonamenti, moduli),
   `docs/NOTIFICHE.md`, `docs/COLLEGAMENTI_AUDIT.md`,
   `docs/MONITORAGGIO_SITO_ANALISI.md`.
4. `CHANGELOG.md`.

## Regole fisse

- **Segreti mai nei file committati**: `.env*` (solo `.env.example` con
  segnaposto), service key, `ANTHROPIC_API_KEY`, `SMTP_*`, `NOTIFY_SECRET`.
  Nei documenti si scrive "nel password manager". Nella 026 il segreto si
  sostituisce a mano al momento di applicarla.
- **`service_role` solo lato server** (`createAdminClient()` nelle route
  `/api/admin/*`, `/api/clienti*`, ponte monitoraggi); mai in un componente
  client, mai con prefisso `NEXT_PUBLIC_`.
- **Il sito non ricalcola**: score, soglie VT1/VT2, coppie prima/dopo e
  alert vengono dall'app o dal database. I porting in `src/lib`
  (`alert-rules.ts`, `before-after.ts`, `chart-scales.ts`,
  `threshold-types.ts`) devono restare identici al Dart; se cambia uno,
  cambia l'altro.
- **`clients.id` è TEXT**; `client_professional_links.client_id` è l'uid.
  Colonne assenti in produzione si leggono con
  `selectWithMissingColumnFallback`.
- **Accesso ai moduli** da `my_account_access()` / `has_module_access`
  (`src/lib/account-access.ts`); `profiles.plan` è una copia legacy da non
  scrivere.
- **Collegamenti**: ogni scrittura passa da `link_client_to_professional`
  (route admin comprese).
- **Migrazioni** in `supabase-migrations/`, nome `sito-NNN_descrizione.sql`,
  idempotenti, a mano nel SQL Editor. Vedi "Migrazioni: nomi fra i due repo"
  qui sotto. Lettura del DB di produzione con `supabase db query --linked`
  (solo SELECT senza via libera). Lo stato reale è nel README, sezione
  Migrazioni.
- `src/lib/supabase-server.ts` usa `next/headers`: i moduli "puri" importati
  dai client component non devono importarlo (per questo esistono
  `alert-rules.ts` e `alert-rules-server.ts` separati).
- Linguaggio wellness: mai diagnosi, paziente, clinico, medico, terapia,
  biomarcatore; "Adattamento" in UI per `score_modulazione_infiammatoria`.
- **i18n**: sito IT/EN/DE con next-intl, pagine in `src/app/[locale]/`,
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
