# CLAUDE.md — Stress Index, sito e dashboard (Next.js)

Istruzioni per le sessioni Claude Code in questo repo. Aggiornate al
27 settembre 2026 (tag `site-2026-09-27`).

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
- **Migrazioni** in `supabase-migrations/`, numerate, idempotenti, a mano nel
  SQL Editor. Lettura del DB di produzione con `supabase db query --linked`
  (solo SELECT senza via libera). Lo stato reale è nel README, sezione
  Migrazioni.
- `src/lib/supabase-server.ts` usa `next/headers`: i moduli "puri" importati
  dai client component non devono importarlo (per questo esistono
  `alert-rules.ts` e `alert-rules-server.ts` separati).
- Linguaggio wellness: mai diagnosi, paziente, clinico, medico, terapia,
  biomarcatore; "Adattamento" in UI per `score_modulazione_infiammatoria`.
- Mai fare push forzato su `main`; `supabase/.temp/` è locale e ignorato.

## Prima di chiudere una sessione

- `npm run build`, `npm run lint`, `npm test` puliti.
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
