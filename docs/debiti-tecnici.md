# Debiti tecnici del sito

Cosa è aperto e perché, in ordine di peso. Si aggiorna a ogni tagliando
(`hrv_app/docs/audit/`) e ogni volta che una sessione chiude o apre una voce.
I debiti dell'app e del database stanno in `hrv_app/docs/debiti-tecnici.md`:
qui solo ciò che vive in questo repo. Creato il 04/10/2026 dal tagliando
`hrv_app/docs/audit/2026-10-04.md`.

## Sicurezza

- **Cancellazione GDPR in attesa della `app-042`.** Le tre strade del sito
  (account, scheda, pannello) chiamano la Edge Function `delete-account` v2,
  che in produzione non è ancora deployata e la cui funzione SQL non esiste:
  finché non si applica la migrazione, le tre azioni falliscono con un errore
  visibile e non cancellano niente. Si sblocca con l'informativa nuova
  (`hrv_app/docs/audit/2026-10-04-cancellazione-account.md`).


- **`next` 14.2.35: advisory critical e high senza patch nella linea 14.x.**
  14.2.35 è l'ultima 14; le correzioni sono in 15.5.24+ e 16.3.3+.
  - `GHSA-2xp9-vwfh-vxw4` (RCE nell'Image Optimization, AVIF): **mitigata** con
    `images.unoptimized` in `next.config.js`. Il sito non usa `next/image`,
    l'endpoint `/_next/image` non serve. Da non togliere prima dell'aggiornamento.
  - `GHSA-p293-qw3h-jr36` (RCE su server Windows): non applicabile, il sito
    gira su Vercel (Linux).
  - Restano aperte le high e moderate (DoS su Server Components, cache
    poisoning RSC, SSRF e smuggling nei rewrite, bypass del middleware i18n del
    Pages Router): il sito non ha `rewrites`, non usa Server Actions né il
    Pages Router, quindi l'esposizione reale è soprattutto il DoS. Si chiudono
    solo con l'aggiornamento.
  - **Aggiornamento a 15: sessione dedicata.** Cosa si rompe:
    `params`/`searchParams` diventano Promise in ogni pagina, layout,
    `generateMetadata` e route handler (qui sono sincroni ovunque);
    `cookies()` e `headers()` diventano asincroni (`supabase-server.ts`,
    `i18n-server.ts`); `experimental.serverComponentsExternalPackages` e
    `outputFileTracingIncludes` escono da `experimental` (servono ai PDF con
    Chromium: da ricollaudare su Vercel, non solo in locale); le route GET non
    sono più in cache di default; React 19 (da verificare `@react-pdf/renderer`,
    `recharts`, `cmdk`, `react-hook-form`); `eslint-config-next` 15 e
    `next lint` deprecato; `instrumentationHook` non serve più.
- **`postcss`, `tailwindcss`, `eslint-config-next`, `glob`, `braces`** (high
  in `npm audit`): toolchain di build, non runtime. La copia di `postcss`
  dentro `next` si aggiorna solo con `next`.
- **`/api/guide-chat`** pubblica: allowlist `Origin`/`Referer` falsificabile e
  rate limit in memoria per istanza (si azzera a ogni cold start).

## Errori

Regola: nessun errore muto (`src/lib/data-error.ts`, e `docs/regole-progetto.md`
§2 nell'app). Sistemati il 04/10: i sette punti di lettura che scartavano
`error` (`aggregatedDailyAverages`, `getThresholdTest`, `listThresholdTests`,
`getAthleteThresholds`, `loadMeasurementForPrint` su analytics e su sessions,
`loadPreviousMeasurement`), `getMeasurementBySessionId` e le due RPC delle
sessioni remote. Restano:

- **Route che rispondono 200 con lista vuota su errore**:
  `api/organization/members/route.ts:36-42`,
  `api/organization/invites/route.ts:15-21`, `api/admin/users` (via
  `admin-data.ts`, dove nessun `.error` è controllato), `api/admin/monitoring`,
  `api/notifiche` GET. Devono rispondere 500 con un codice di `errors.api` e
  passare da `reportDataError`.
- **`dashboard-data.ts`**: molte letture destrutturano solo `{ data }`
  (`getClient`, `listClients`, note, messaggi, alert). Un errore diventa
  "nessun cliente" o `notFound()`. Da fare a blocchi, come i `catch` dell'app.
- **`print-token.ts:102` e `i18n-server.ts:38`** tornano `null` senza traccia.
- **`errors.api.generic`** è il messaggio di circa 25 componenti per ogni
  codice non mappato: l'utente non sa cosa è successo.
- **Edge Function** (`notify-measurement`, `notify-digest`,
  `create-client-access`): solo `console.error`, niente Sentry; il fallimento
  della scrittura in `notification_log` è a sua volta solo un log.
- **Source map non caricate su Sentry** finché su Vercel mancano
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`: gli stack del browser
  arrivano minificati. Quelli del server sono leggibili.
- **Middleware**: l'utente non è identificato sugli errori del runtime edge
  (l'uuid viene impostato nelle letture lato Node).

## Dati e pipeline

- **Due copie della logica delle sessioni remote**:
  `fetchRemoteSessionsForClient` (`dashboard-data.ts`) e `remoteSessions`
  (`report-data.ts`). Da unificare in una funzione esportata.
- **`remote-sessions.ts`**: quattro export morti e un commento errato (dice che
  `get_linked_client_sessions_by_client_id` non esiste: esiste ed è usata).
- **Conteggi di organizzazione e superadmin** (`dashboard-data.ts`, filtri
  `user_id in (...)`): escludono le misurazioni remote. Totali sottostimati,
  non una perdita.
- **`getMeasurementBySessionId` per owner/admin di organizzazione**: corretto
  il 04/10 passando il professionista al ripiego remoto, ma **non verificato su
  dati reali**: in produzione quel giorno non esisteva nessuna organizzazione
  con un owner e un membro attivo. Da provare alla prima che nasce.
- **`measurement_analytics.measured_at_utc`**: il 04/10 nove righe differivano
  ancora da `sessions.started_at_utc` nonostante la `sito-029`. Il sito legge
  l'istante dalla sessione (`conIstanteSessione`), quindi non si vede; da capire
  da dove arrivano.

## Contenuti

- **`/privacy`** creata il 04/10 riprendendo i testi dell'informativa
  dell'app, con la sezione su Sentry. Il testo è da far rivedere a chi ne
  risponde: manca l'elenco completo dei fornitori (Vercel ospita il sito),
  l'app usa ancora `support@stress-index.it` mentre il sito
  `support@stressindex.io`, la conservazione a 90 giorni delle segnalazioni va
  allineata all'impostazione reale del progetto Sentry.
- **`/funzionalita`, sezione privacy**: dice "niente terze parti". Con Sentry
  (e già prima con Supabase e Vercel) la frase va riformulata.
- **`/termini`**: linkata dal footer, non esiste (404).
- **L'informativa dentro l'app** (ARB `setPrivacy*`, IT ed EN) non nomina
  ancora Sentry.
- **Linguaggio**: "desaturazione" in `messages/it.json` e
  `src/lib/sleep-strings.ts`, "il PDF da mostrare al medico" in
  `messages/it.json` (tagliando §6).

## Release

- `package.json` `version` ferma a `0.1.0`.
- `PDF_LEGACY` e i generatori react-pdf: da togliere dopo il 07/10/2026.
