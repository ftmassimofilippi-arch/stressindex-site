# Changelog — Stress Index, sito e dashboard

Voci ricavate dalla storia git. Le migrazioni si applicano a mano; lo stato in
produzione è nel `README.md`.

## 2026-10-01 — nomi delle misurazioni remote, esiti di "crea accesso", 022

### Il cliente di una misurazione remota ha un nome
Caso reale: nella home di `anto60.nava@gmail.com` due misurazioni di oggi
(sessioni `1790833464267` e `1790833825144`) mostravano `—` nella colonna
Cliente.

- **Causa.** Una misurazione fatta dal cliente sulla sua app ha
  `client_id` NULL e il solo `user_id`: il professionista la vede per la
  policy RLS della 019, che confronta `user_id`, mai `client_id`. Tutte le
  viste che indicizzano le schede su `clients.id` su quelle righe non
  trovavano niente. Schede, ponte `client_user_id` e link `active` erano già
  sani: il difetto era solo nella query.
- **`src/lib/client-bridge.ts`**: il ponte si risolve una volta per richiesta
  (riusa `buildBridge`, che esisteva e non era usato da nessuno) e risponde a
  due domande separate — `conClientIdDalPonte` riempie `client_id` dove è
  NULL, `identificaCliente` dà il nome con tre ripieghi: scheda → profilo
  (col badge "senza scheda") → "Non assegnata".
- **Viste corrette**: Analytics (il caso più grave: `buildSegments` scartava
  con `continue` ogni riga auto-misurata, quindi i segmenti contavano in
  silenzio solo le misurazioni scritte dal professionista), home
  "Misurazioni di oggi" (nome e link, che puntava a `/clienti/null/…`),
  contatore della card, Organizzazione (su una riga remota il nome del
  cliente finiva nella colonna del professionista), pannello admin delle
  sessioni (al posto dell'etichetta "misurazione remota" c'è il nome).
- Non toccate perché già corrette: alert, "da contattare", lista clienti con
  ultima misurazione, monitoraggi recenti, campanella notifiche.

### `create-client-access`: esito esplicito, e nessun professionista collegato
Caso reale: `lauragiacinti75@gmail.com` ha un account `professional`. Un altro
professionista l'ha inserita come cliente e ha premuto "Crea account cliente":
nessuna email, nessun errore.

- **Cosa succedeva davvero**, peggio dell'esito muto: `inviteUserByEmail`
  tornava `email_exists`, la function risolveva l'uid e chiamava
  `link_client_to_professional`, che sul ruolo non-`client` si limita a un
  warning → il suo account veniva collegato come cliente, con i suoi dati
  esposti, e la risposta era `ok:true`.
- **Contratto**, identico nell'app e nel sito: `result` vale sempre uno di
  `invited`, `link_pending`, `already_linked_other`, `is_professional`,
  `error`. Più `already_linked_self` (già collegato a chi chiama), **fuori
  contratto e da confermare**: nessuno dei cinque lo dice senza mentire.
  L'account esistente si cerca PRIMA di invitare, unico modo di distinguere un
  professionista da un cliente.
- **`pending` e non `active`**: con un invito il consenso è il click sul link,
  con un account che esiste già non c'è nessun giro di posta, quindi chi
  conosce un indirizzo si tirerebbe in dashboard lo storico HRV di quella
  persona. Le policy della 019 sono tutte su `status = 'active'`: un pending
  non fa passare un solo dato. La conferma la dà il cliente dall'app, il
  superadmin è la via di riserva.
- **`sito-031`**, RPC `request_client_link`: chiama
  `link_client_to_professional` e riporta il link a `pending` nella stessa
  transazione, così la regola "una sola strada di scrittura" resta e non
  esiste un istante in cui il link è `active` e visibile. Un link già `active`
  non viene mai abbassato. Se la 031 non è applicata la function risponde
  `error` e **non** ripiega su un link `active`.
- **Email al cliente** ("X vuole seguire le tue misurazioni", IT/EN/DE)
  riusando solo `inviaEmail` di `_shared/notify-core.ts`: nessuna dipendenza
  nuova, e non passa dal layout con la disiscrizione delle preferenze, perché
  una richiesta di consenso non è una notifica da cui disiscriversi.
- Ogni esito va in `professional_access_log` come `action='create_access'` con
  `result` in `details`: il check constraint della 027 ammette quattro azioni
  e non serve toccarlo.
- **Sito**: la sezione "Accesso all'app" mostrava solo un testo quando
  l'account non c'era. Ora ha il pulsante e gli stessi sei messaggi in
  IT/EN/DE. L'albero delle decisioni è in `src/lib/client-link-request.ts`,
  porting da tenere in pari con la Edge Function (Deno non importa da `src/`).

### 022: chiusura dei difetti residui
- **Le date, verificate.** Il commit che corregge A2 è del 13/09 18:55. In
  produzione il log ha tre soli run, l'ultimo del 13/09 04:51, ed è quello con
  la violazione della FK: dodici ore prima della correzione. Del run di fine
  settembre non c'è traccia perché il log vive nella stessa transazione, e un
  ROLLBACK non lascia niente. Conferma indipendente: la tabella
  `collegamenti_riparazione_c_dettaglio`, creata da quel commit, in produzione
  **non esiste**. La versione corretta non è mai stata eseguita là.
- **`VERSIONE_FILE`**, prima riga del log: dopo ogni run si legge dal report
  quale versione lo ha prodotto, senza doverlo dedurre.
- **A2 non elegge più righe revocate.** L'indice univoco esistente
  `(client_id, professional_id)` non è parziale: per ogni coppia una sola riga
  può portare `client_id`, e darlo a una revocata lo toglierebbe al link vivo.
  In produzione le revocate sono anche le uniche che violavano la FK
  (`client_id` → `auth.users`): 5 righe, di 2 utenti che non esistono né in
  `auth.users` né in `profiles`. Finiscono nel nuovo report
  `A2_report_revocati_esclusi`.
- **Temp table ricreate a ogni run**: `create temp table if not exists … as`
  non esegue la query quando la tabella esiste già, quindi un secondo giro
  nella stessa sessione lavorava sulle righe del primo.
- **I sotto-blocchi di solo report dicono sempre `anteprima`**, prima
  ereditavano `applicazione` dal blocco pur non scrivendo niente.
- **`sito-022_dettaglio_c.sql`**: query attiva, pronta da lanciare dopo
  l'anteprima, con la scheda che TIENE e quella che ARCHIVIA per ogni coppia.
- **I due report chiesti**: `D_report_scheda_di_se_stesso` (71 al 13/09, oggi
  86) sono le schede che un professionista ha creato per sé stesso, per
  misurarsi: solo report, nessun ramo `if v_apply`.
  `I_report_analytics_senza_sessione` (610 al 13/09, **oggi 0**) sono analytics
  orfane: il blocco I forza `v_apply := false` e `'I'` è perfino rifiutato dal
  validatore dei blocchi; le orfane sono state archiviate nel frattempo in
  `measurement_analytics_orfane_20260914` e `…_20260929`.

## 2026-09-30 — orari e campanella delle notifiche

### Orario delle misurazioni avanti di due ore
Segnalazione di un professionista: una misurazione delle 17:16 usciva come
19:16. Il database era corretto, sbagliava il sito.

- **Causa.** Il trigger `set_started_at_compat` tiene `sessions.started_at`
  nella forma legacy (ora italiana etichettata UTC) su TUTTE le righe, anche
  quelle nuove, e l'istante reale in `started_at_utc`. Il sito leggeva la
  colonna grezza e la riconvertiva nel fuso italiano, sommando altre due ore.
- **Regola unica** in `src/lib/measured-time.ts`, modulo senza dipendenze
  riesportato da `format.ts` e coperto da `src/lib/format.test.ts`
  (8 test): l'istante si prende solo dalle colonne `_utc`, e
  `tz_offset_minutes` non distingue più le due convenzioni.
- **Ordinamenti, filtri e raggruppamenti** portati sulle colonne `_utc` e sui
  confini di giornata ITALIANA (`inizioGiornoIta`, `fineGiornoIta`,
  `intervalloGiorniIta`, `giornoItaFa`): dashboard, scheda cliente, analytics,
  trend giornaliero, prima/dopo, report periodico, PDF, sport, pannello Super
  Admin, pagina Organizzazione. Prima una misurazione dopo le 22:00 cadeva nel
  giorno successivo e falsava trend, riepiloghi e confronti.
- **`conIstanteSessione()`**: quando una query unisce `sessions` e
  `measurement_analytics`, l'istante mostrato è quello della sessione.
- **Sport**: `sport_sessions` passa a `start_time_utc` / `end_time_utc` in
  query, filtri, serie e bucket per settimana ISO.

### Migrazione 029 (da applicare a mano)
`measurement_analytics.measured_at_utc` è sbagliata su 986 righe su 3736: il
trigger di sincronizzazione della 007 copia in `measured_at` la forma legacy di
`sessions.started_at` portandosi dietro `tz_offset_minutes`, e
`set_measured_at_utc` conclude che il valore è già UTC. Su quelle righe la
misurazione risulta avvenuta dopo il proprio `created_at`. La 029 riallinea la
colonna a `sessions.started_at_utc`, corregge il trigger e lascia un backup
`measurement_analytics_utc_backup_20260930`. Il sito mostra l'ora giusta anche
prima di applicarla; restano approssimati ordinamenti e filtri che Postgres
esegue su `measured_at_utc`.

### Campanella delle notifiche
Mostrava il contatore ma il clic non apriva nulla. Ora apre un pannello con
l'elenco (alert del cron uniti agli eventi dell'app), ognuno collegato alla
scheda del cliente, con chiusura da clic fuori o Esc. Nuova route
`/api/notifiche` e componente `NotificationsBell`; stringhe IT/EN/DE in
`dashboard.topbar`.

- **Marcatura come letto, per singolo utente.** Aprire una notifica la segna
  letta; in testa al pannello c'è "Segna come lette". `alerts` e `alert_events`
  non vengono toccate: si aggiunge solo una riga in `notification_reads`
  (migration `sito-030`, da applicare a mano) con la data della prima lettura.
  Lo storico resta intero e la lettura di un osservatore non azzera il
  contatore del professionista titolare.
- **Il contatore lo calcola il layout**, non più ogni pagina: prima chi passava
  gli alert totali, chi i nuovi, chi zero, e il badge cambiava valore navigando.
  Tolte le letture di `alerts` diventate inutili in otto pagine.
- Senza la `sito-030` applicata tutto continua a funzionare: il conteggio ricade
  sullo stato delle sorgenti e i comandi di lettura restano nascosti.

### Nomi delle migrazioni fra i due repo
`hrv_app` e `stressindex-site` applicano migrazioni allo stesso database e le
numerazioni si erano sovrapposte: esistevano due `029` diverse. Da ora il nome
porta il prefisso del repo, `sito-NNN_` qui e `app-NNN_` nell'app; i numeri non
cambiano, quindi i riferimenti storici ("la 022 del sito") restano validi.
Rinominati i 30 file di questo repo e aggiornati README e documenti; la regola è
nel `CLAUDE.md` dei due repo, sezione "Migrazioni: nomi fra i due repo".

## 2026-09-30 — tag `site-2026-09-30`

### PDF rifatti con i componenti della dashboard
- **Pagine di stampa** `/stampa/misurazione/[sessionId]`, `/stampa/report-periodico`
  e `/stampa/monitoraggio/[id]` (A4, moodboard Stress Index, header e footer
  su ogni pagina, disclaimer wellness) che riusano gauge, Poincaré,
  ritmogramma, PSD, torta VLF/LF/HF, tabella parametri con semaforo e range
  di riferimento, viste ortostatico/coerenza/lunga, `AdvancedTrendChart`
  statico. Prop `print` sui componenti (dimensioni fisse, niente animazioni
  né controlli).
- **Generazione con Chrome headless** (`puppeteer-core` + `@sparticuz/chromium`
  su Vercel): route `GET /api/pdf/misurazione/[sessionId]`,
  `/api/pdf/report-periodico`, `/api/pdf/monitoraggio/[id]`; token firmato a
  60 s, cookie di sessione inoltrati, attesa di `window.__REPORT_READY__`,
  nome file `StressIndex_[Cognome]_[tipo]_[data].pdf`. Vecchi generatori
  react-pdf dietro `PDF_LEGACY=true`.
- **Report periodico**: trend dei 5 score, medie con confronto col periodo
  precedente, giorno migliore/peggiore, commento automatico, elenco
  misurazioni, sezione Sport (Piano Pro).
- Dashboard: nuova torta VLF/LF/HF sotto lo spettro, semaforo e card
  "parametri nella norma / al limite / fuori range" nella tabella parametri,
  delta rispetto alla misurazione precedente sui gauge (in stampa).
- Dati di simulazione (`?fixture=`) fuori produzione e script
  `scripts/pdf-esempi*.mjs` per generare PDF di prova.
- Rifiniture: `PDF_TOKEN_SECRET` obbligatorio in produzione (500 senza),
  token monouso; variante cliente (`?variant=client`) per misurazione, report
  periodico e monitoraggio con le formulazioni del PDF legacy, bottone "PDF
  cliente" e opzione nella tab Report; PDF 24h senza salti pagina fissi;
  fixture sonno e 24h dal simulatore dell'app; `scripts/test-pdf-permessi.mjs`
  (19 controlli su permessi, token e sola lettura superadmin).

### Sito trilingue (i18n)
- **Italiano, inglese e tedesco** con `next-intl`: pagine spostate in
  `src/app/[locale]/`, italiano senza prefisso (URL invariate), `/en/...` e
  `/de/...` con gli stessi slug italiani. Middleware unico: routing per lingua
  (prefisso, poi cookie `NEXT_LOCALE`, poi `Accept-Language`) composto con la
  protezione Supabase di `/area-professionisti`, redirect che conservano la
  lingua. Switcher IT / EN / DE in navbar, footer, login, top bar della
  dashboard. 404 ed errore localizzati.
- **Tutte le stringhe visibili estratte** (~2.900 chiavi per lingua) in
  `messages/{it,en,de}.json`, generati dai frammenti
  `messages/_parts/<lingua>/<namespace>.<pacchetto>.json` con
  `scripts/i18n-merge.mjs`; `scripts/i18n-check.mjs` verifica chiavi allineate,
  termini vietati e trattini lunghi; `scripts/i18n-residui.mjs` cerca stringhe
  italiane residue. La guida è contenuto data-driven nel JSON con un renderer.
- **Glossario dall'app** (`docs/i18n-glossario.md`, ~600 voci) e convenzioni
  (`docs/i18n-convenzioni.md`). Terminologia allineata all'app: fascia stress
  85-100 "Affaticamento", score `score_modulazione_infiammatoria` mostrato come
  Adattamento / Adaptation / Anpassung.
- **Date, numeri e prezzi** per lingua con `Intl` (it-IT, en-US, de-DE) in
  `src/lib/format.ts` (parametro `locale` finale), anche su assi e tooltip
  Recharts e nei date picker; `formatEur` per i prezzi.
- **SEO**: `generateMetadata` per pagina e lingua (`src/lib/seo.ts`), hreflang
  it/en/de + x-default, sitemap con le tre lingue, `<html lang>` corretto,
  immagine OpenGraph tradotta.
- **Registrazione e auth**: lingua salvata in `user_metadata.locale`; errori
  Supabase Auth mappati su chiavi (`errors.supabase.*`); reset password verso
  `/imposta-password` nella lingua dell'utente. Template email Supabase IT/EN/DE
  con blocchi condizionali Go su `{{ .Data.locale }}` in `docs/email-templates/`
  (da incollare a mano nella dashboard).
- **Route API**: errori come codici stabili (`apiError`) tradotti lato client
  (`apiErrorMessage`); PDF, CSV ed email nella lingua della richiesta
  (`getRequestLocale`: `?locale=`, cookie, Referer, Accept-Language).
- **Linguaggio wellness** corretto anche in italiano (niente "clinico",
  "diagnosi", "paziente" fuori dai disclaimer legali); "Rischio infortunio" →
  "Rischio sovraccarico"; LF/HF sempre come "rapporto LF/HF".
- `.eslintrc.json` (`next/core-web-vitals`) per rendere `npm run lint` non
  interattivo.
- **Navigazione a un solo click**: righe di clienti, misurazioni, monitoraggi,
  sessioni sport, test soglie e coppie prima/dopo interamente cliccabili con
  veri `Link` (`LinkCell`, `DataTable.rowHref`; Cmd+click apre in nuova
  scheda), risultati della ricerca globale come link, card score e liste
  "da contattare"/"ultime misurazioni" cliccabili per intero; hover attivi
  solo con puntatore (`hoverOnlyWhenSupported`), feedback `:active` su touch,
  ancora "#" delle guide visibile anche senza hover.
- **Selettore lingua con bandierine SVG** (IT / EN / DE) a un click, sempre
  visibile: navbar accanto alla CTA anche su mobile, top bar della dashboard,
  pagine di autenticazione, versione testuale nel footer. Conserva path, query
  e ancora.

## 2026-09-27 — tag `site-2026-09-27`

Allineato all'app 2.9.0+52.

### Scheda cliente e misurazioni
- **Viste ortostatica e coerenza** allineate alla pagina risultati dell'app:
  indice di reattività, 14 parametri supino/in piedi con direzione attesa,
  score di coerenza, frequenza di risonanza, andamento nel tempo (b7d9a8e).
- **Scale fisse dei grafici** identiche all'app (RR 400–1400 ms, PSD
  10–1.000.000 ms²/Hz) con toggle "Zoom" per la scala adattiva (b7e19f5).
- **Filtri per etichetta e tipo di test**, tab **"Prima e dopo"** con coppie
  pre/post e confronto fra due sessioni `/clienti/[id]/confronto?a=&b=`
  (d813ebe).
- **Soglie avvisi per cliente** da `alert_rules` con la precedenza dell'app;
  letture separate dalla parte pura per i client component (6029d2f, aeaf05b).

### Sport
- **Dettaglio del test incrementale** con soglie VT1/VT2 stimate, IC95,
  scatter α1-FC, step, HRR60, zone proposte; sezione "Test soglie" nella
  scheda atleta con trend e storico (24d5248). Legge `threshold_test` (031) e
  i campi soglia di `clients` (032) senza ricalcolare.

### Accesso e sicurezza
- La route `/api/clienti/[id]/accesso` accetta anche un **Bearer token**, per
  l'app (3b85e02).
- Un account **sospeso o bloccato** non passa più da nessuna route
  `/api/clienti*` (978088e).
- **GDPR**: cancellare un utente non fallisce più per colpa del registro
  accessi; migrazione 028 (340745e).

### Migrazioni
- 023 esclusioni "da non unire", 024 commerciale (stato account, abbonamenti,
  moduli, `has_module_access`), 024b tutti attivi e Sonno nel piano Pro:
  robustezza verificata prima di applicarle (71957ab); applicate in produzione
  il 27/09.

### Documentazione (chiusura)
- `README.md` riscritto (pagine, API, migrazioni con stato), `CLAUDE.md` e
  questo changelog creati; `supabase/.temp/` tolto dal tracciamento e
  `.gitignore` esteso a `.env*`.

## 2026-09-25
- Sezione **"Accesso all'app"** nella scheda cliente: password temporanea,
  reset via email, registro accessi (9c8d2f9; migrazione 027).
- Il bottone **"Nuovo cliente"** crea davvero un cliente con lo stesso flusso
  dell'app (85778d9).

## 2026-09-16
- **Notifiche email al professionista** per le misurazioni da remoto: subito,
  riepilogo giornaliero o mai; Edge Function `notify-measurement` e
  `notify-digest`; migrazioni 025 e 026 (d978d7f).

## 2026-09-13
- **Gestione commerciale**: stato account, abbonamenti con scadenze, moduli
  per piano ed eccezioni, pannello Super Admin rivisto (07216c1; migrazione
  024).
- **Correzione dell'email** dell'account auth con anteprima, conferma e log
  (a7b7c7c).
- Collegamenti: 022 applicabile per singolo blocco, esclusioni 023 (1913ec4,
  4de1a97).

## 2026-09-11 / 12
- **Collegamenti cliente-professionista, flusso unico**: migrazioni 019–022,
  tab Salute collegamenti con Ripara e Unisci, Edge Function
  `create-client-access` v2, audit completo (`docs/COLLEGAMENTI_AUDIT.md`).
- Sessioni remote nel report periodico, nella colonna Stress e in "Vedi
  sessioni" (9aeabd8).

## Prima dell'11 settembre 2026
Monitoraggio 24h sul sito (018), organizzazioni (008), Super Admin (010–013,
017), Team Live (012), trigger demografico non sovrascrittivo (014), dashboard
con tachimetri, pagine legali e SEO, guide con assistente. Vedi la storia git.
