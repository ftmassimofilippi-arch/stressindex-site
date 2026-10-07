# Changelog — Stress Index, sito e dashboard

Voci ricavate dalla storia git. Le migrazioni si applicano a mano; lo stato in
produzione è nel `README.md`.

## 2026-10-07 — perimetro del professionista (ramo `fix/perimetro-home`)

Non in produzione: sul ramo, in attesa di verifica sulla preview. Riferimento:
`hrv_app/docs/DIAGNOSI_ASSEGNAZIONE.md`.

Le pagine dell'area professionisti si affidavano alla sola RLS. Per un
superadmin le policy `superadmin_read_*` aprono `clients`, `sessions`,
`measurement_analytics`, `client_notes`, `monitoring_sessions` e le tabelle
sport di tutti: la home mostrava le misurazioni di ogni utente (43 il 07/10,
di cui 5 nel perimetro dell'account).

- **Perimetro** (`src/lib/perimetro.ts`, `perimetro-server.ts`, con test): le
  sessioni del professionista loggato più quelle degli account collegati con
  link `active`. Filtro nella query e ripetuto sulle righe; se i link non si
  leggono il perimetro si restringe, non si allarga.
- **Home**: misurazioni di oggi, contatori, schede, da contattare, ultime note,
  trend aggregato e alert nel perimetro.
- **Etichette**: "Non assegnata" solo per le sessioni del professionista senza
  cliente; le automisurazioni mostrano il nome del cliente e il badge "Da
  remoto" (`dashboard.home.remoteBadge`, tre lingue).
- **Lista clienti, Analytics, Monitoraggio, Sport, ricerca globale, scheda
  cliente, misurazione, confronto**: stesso filtro; le pagine aperte per id
  rispondono 404 se la scheda o la sessione non è del titolare.
- **Report periodici e PDF**: stampa solo il titolare della scheda, anche con
  la sessione (prima il controllo valeva solo nella via a token).
- **Superadmin** (`src/lib/superadmin-scope.ts`): `?professionista=` non apre
  più al superadmin i dati di un altro professionista; resta il percorso
  owner/admin di organizzazione. Nel pannello admin la sezione "Attività della
  piattaforma" dà solo conteggi aggregati.
- `scripts/test-pdf-permessi.mjs` aggiornato alla nuova regola (non eseguito).

Resta aperto, in `docs/debiti-tecnici.md`: le policy `superadmin_read_*` nel
database e le tab del pannello admin che elencano clienti.

## 2026-10-04 sera — cancellazione GDPR via `delete-account`

In produzione dalle 20:25 UTC (`0c713d2`, Vercel `dpl_G8fGN2Un…`), dopo la
`app-042` e la Edge Function `delete-account` v2 del repo dell'app, con
l'interruttore dei trasferimenti spento. Provata con un professionista usa e
getta: residui zero.

- **Impostazioni → Account → Elimina account**: chiama la Edge Function (prima
  mostrava un avviso e faceva solo il logout). Errore tradotto per codice
  (`errors.api.*`), si resta loggati se fallisce.
- **Scheda cliente → Elimina**: chiama la Edge Function con `{ scheda }` al posto
  del `delete` diretto su `clients`: ponte → le misurazioni in studio passano al
  cliente e il link va a `revoked`; senza account → tutto cancellato, file
  compresi. Testo del dialogo aggiornato nelle tre lingue.
- **`DELETE /api/admin/users/[id]`**: passa dalla Edge Function con la sessione
  del superadmin; via l'opzione `cascadeClients` (prometteva schede "orfane"
  che la FK cancellava comunque) e la casella nel pannello.
- Nuove chiavi `errors.api` per i codici della cancellazione (`errors.k.json`).

## 2026-10-04 — Sicurezza e affidabilità (tagliando del 04/10)

Riferimento: `hrv_app/docs/audit/2026-10-04.md`, voci #7, #8, #13, #14, #18.

- **`next` 14.2.35, advisory critical.** La linea 14.x non ha patch (14.2.35 è
  l'ultima). `next/image` non è usato da nessuna pagina: `images.unoptimized`
  in `next.config.js` spegne `/_next/image`, che è l'endpoint della RCE
  `GHSA-2xp9-vwfh-vxw4`. L'aggiornamento a 15 è una sessione a parte; cosa
  rompe è in `docs/debiti-tecnici.md`.
- **Sentry** (`@sentry/nextjs`) su browser, server e middleware. Release =
  commit, environment = `VERCEL_ENV`, utente = solo uuid; `beforeSend` toglie
  email, query string e ogni dato dell'utente diverso dall'id. La DSN è la
  variabile `NEXT_PUBLIC_SENTRY_DSN` su Vercel: senza, l'SDK resta spento.
- **`getMeasurementBySessionId`** riceve il professionista per cui si sta
  guardando e lo passa al ripiego sulle sessioni remote. Prima un owner/admin
  di organizzazione che apriva (o confrontava) la misurazione remota di un
  membro otteneva "non trovata": la RPC legata a `auth.uid()` non vede il
  collegamento del membro.
- **Nessun errore muto** (`src/lib/data-error.ts`). I sette punti che
  scartavano `error` ora lo mandano a Sentry e lo dicono: grafico di andamento
  della home, soglie e test soglie di atleta e sessione sport mostrano
  `DataLoadNotice` invece di un riquadro vuoto; la stampa della misurazione si
  ferma (`measurement_read_failed`) invece di uscire senza note o senza delta.
  Le due RPC delle sessioni remote, che ripiegavano su `[]` con un
  `console.error`, ora passano da `reportDataError`.
- **`sito-034`**: EXECUTE su `link_client_to_professional_guarded` tolto a
  PUBLIC e ad `anon`. Collaudata in locale (`scripts/sql-test/test_sito-034.sql`)
  e **applicata in produzione il 04/10**: una chiamata con la sola anon key, che
  prima tornava 200 con `ok:false`, ora riceve 401 `permission denied for
  function`. Corpo della funzione, link e schede invariati; e2e dell'app verde
  dopo l'applicazione. Il sito non chiama la guarded.
- **`/privacy`** in IT, EN e DE: prima era un 404 linkato dal footer e dal
  consenso della registrazione. Riprende l'informativa dell'app e aggiunge la
  rilevazione degli errori tecnici con Sentry (dati trattati, finalità, base
  giuridica, sede UE).
- README: `sito-029`, `sito-030`, `sito-031` risultano applicate; stato
  riverificato sul catalogo il 04/10. Nuovo `docs/debiti-tecnici.md`.

## 2026-10-02 — Team Live leggeva colonne che non esistono

La pagina `/area-professionisti/sport/team-live` mostrava sempre l'elenco
vuoto. Nei log runtime, a ogni apertura:

```
[getSportLiveSnapshot] error { error: 'column sport_live_data.hr does not exist' }
```

- **Causa.** `SportLiveRow` e `SPORT_LIVE_COLUMNS` in `src/lib/sport-live.ts`
  descrivevano colonne inventate: `hr`, `zone`, `rmssd`, `trimp`, `tags`,
  `created_at`. La tabella (definita in `supabase/migrations/sport_live_data.sql`
  nel repo dell'app, che ne è anche l'unico scrittore) ha
  `hr_current`, `dfa_zone`, `rmssd_rolling`, `trimp_current`, più
  `athlete_name` e `timestamp_ms`; `tags` e `created_at` non ci sono e non ci
  sono mai stati. PostgREST si fermava alla prima colonna sconosciuta, quindi il
  log ne nominava una sola e le altre cinque restavano invisibili.
- **Fix.** I nomi del tipo diventano quelli della tabella, non alias nel
  `select`: le righe arrivano anche via Realtime, che consegna la riga grezza
  del database, quindi un alias avrebbe sistemato una via e lasciato rotta
  l'altra. Aggiornati i consumatori in `TeamLiveBoard.tsx`.
- Il blocco "Tag sessione" del drawer era guardato da `tags.length > 0` e non ha
  mai mostrato niente: rimosso insieme a `parseLiveTags`. La chiave
  `teamLive.drawer.tags` resta nei messaggi.
- `athleteName` ora ricade su `athlete_name` della riga quando l'atleta non è
  (ancora) fra i clients letti all'apertura: prima la card mostrava un trattino
  al posto di una persona.

## 2026-10-02 — `/api` servito anche sull'apice: l'header `Authorization` non muore più in un redirect

### «Sessione scaduta» che nessun logout poteva risolvere
Segnalazione di un professionista: nella scheda cliente dell'**app**, la card
"Accesso all'app" diceva *«Sessione scaduta: esci e rientra, poi riprova»* — e
lo diceva anche dopo essere uscito e rientrato. Nello stesso secondo, sulla
stessa scheda, la card Percorso mostrava dati freschi e tutte le chiamate a
Supabase rispondevano 200.

```
10:14:10  POST /rest/v1/rpc/client_rolling_state                 200   (Supabase)
10:14:10  POST /rest/v1/rpc/get_linked_client_sessions_by_client_id  200   (Supabase)
10:14:10  GET  /api/clienti/1785573923090/accesso                401   (sito)
```

- **Causa.** Il redirect era a livello di **dominio Vercel**
  (`stressindex.io` → `www.stressindex.io`), e un redirect di dominio non sa
  escludere un percorso: rispondeva 307 anche a `/api`. L'app Flutter chiama
  `https://stressindex.io/api/clienti/<id>/accesso` (apice, senza `www`) con
  `Authorization: Bearer <access token>`, e **`package:http` di Dart non
  riporta l'header `Authorization` su un redirect verso un host diverso**
  (verificato con due server locali: l'origine lo riceve, la destinazione lo
  vede `null`). Su `www` la richiesta arrivava quindi senza header:
  `requireProfessional` non trovava né Bearer né cookie, `getUser()` tornava
  `null` **senza nemmeno interpellare Supabase** — nei log di Supabase, in
  quell'istante, non esiste alcuna `GET /auth/v1/user` — e la route rispondeva
  `401 {"error":"unauthorized"}`. L'app traduce quel codice in «Sessione
  scaduta», che è l'unica cosa che non era: il token era valido e PostgREST lo
  accettava nove volte nello stesso secondo.
- **Da quando.** La card è nell'app dal 27/09 (2.9.0+52): dall'app non ha mai
  funzionato, dal sito sempre, perché lì il cookie c'è. Nessuna relazione con
  le migrazioni del 02/10 — `sito-032` e `sito-033` sono state applicate due e
  tre ore *dopo* la segnalazione.
- **Fix.** Il redirect scende dal dominio al codice (`next.config.js`,
  `redirects()` con `has: host = stressindex.io`) e salta `/api`: le pagine
  restano canoniche su `www` (cookie di sessione, SEO), `/api` sull'apice viene
  servito e basta. Il redirect del dominio Vercel sull'apice è stato rimosso:
  **non va ripristinato**, o il difetto torna identico e silenzioso.
- Lato app, nella 2.10.0: `siteBaseUrl` passa a `https://www.stressindex.io`,
  i redirect non vengono più seguiti su quella chiamata, e «sessione scaduta»
  non viene più scritto quando il problema non è il login.

## 2026-10-02 — le misurazioni remote nella vista "come un altro professionista"

### La scheda vuota che al proprietario era piena
Caso reale: da `info@massimofilippi.it` (superadmin) la scheda `1789282977721`
di Andrea Ponghetti mostrava **0** misurazioni; la stessa scheda, aperta da
Andrea, ne mostrava **14**. I log di produzione dello stesso giorno dicono
entrambe le cose, a un'ora e mezza di distanza:

```
09:09:01 GET /area-professionisti/clienti/1789282977721   direct: 0, remote: 14
07:26:55 GET /en/area-professionisti/clienti/1789282977721  direct: 0, remote: 0
```

- **Causa, e cosa NON era in causa.** Dati, collegamenti e policy erano sani.
  Una misurazione fatta dal cliente sulla sua app si salva per progetto con
  `sessions.professionista_id` = uid del CLIENTE e `client_id` NULL; il
  professionista collegato le legge dalla RPC
  `get_linked_client_sessions_by_client_id`, che parte da `auth.uid()`.
  Provate tutte le 43 coppie con collegamento `active` (760 sessioni)
  impersonando ciascun professionista, la RPC restituisce il conteggio esatto
  **43 volte su 43**. Il difetto era solo nella vista "come un altro
  professionista": `auth.uid()` è il superadmin, che con quel cliente non ha
  alcun collegamento, quindi la query diretta trovava 0 righe (il `client_id` è
  NULL) e la RPC altre 0. Nessuna policy RLS e nessun backfill necessari.
- **`sito-032`**: `puo_vedere_come_professionista` riproduce in SQL le due
  condizioni di `resolveViewingProfessional` (superadmin; owner/admin di
  organizzazione su un membro attivo), più sé stesso; le tre funzioni
  `get_linked_client_sessions_as_professional`,
  `get_linked_clients_last_remote_session_as_professional` e
  `get_linked_clients_last_remote_analytics_as_professional` hanno il corpo
  della 019 col professionista come parametro. Chi non è autorizzato riceve
  **42501, non una lista vuota**: è proprio una lista vuota che ha tenuto
  nascosto questo difetto, perché una scheda senza misurazioni e una scheda
  non autorizzata si assomigliano troppo.
- **`src/lib/dashboard-data.ts`**: `fetchRemoteSessionsForClient`,
  `getLastRemoteSessionMap` e `getLastRemoteAnalyticsMap` accettano il
  professionista visualizzato e passano dalle nuove funzioni solo quando c'è;
  la vista propria continua a usare le RPC di sempre, invariate.
  `listClientsEnriched` non rinuncia più alle sessioni remote nella vista
  superadmin/org: lì la lista clienti mostrava "—" su ultima misurazione e
  Stress per tutti i clienti che misurano solo dalla propria app.
- **`clienti/[id]/page.tsx`**: passa `professionistaId` quando c'è un
  `viewing`.
- **Verificato in produzione** dopo l'applicazione: da `info@massimofilippi.it`
  le schede di Andrea danno 14 e 12, la propria scheda di Sara Spadoni 6;
  Andrea su sé stesso 14; un professionista estraneo riceve 42501.
- **Non toccati, di proposito**: nessun `UPDATE` su `sessions` (riempire
  `sessions.client_id` romperebbe la RPC della 019, che filtra
  `client_id is null`, e con essa le 43 coppie che funzionano);
  `measurement_analytics.client_id` resta NULL e ricostruito a runtime da
  `conClientIdDalPonte`; nessuna modifica all'app Flutter.
- ~~Resta aperto: le pagine di stampa…~~ chiuso lo stesso giorno, sotto.

### E anche nei report stampati (`sito-033`)
Seguito immediato del punto sopra: `loadPeriodicReportData` chiamava ancora la
RPC legata a `auth.uid()`, e il report periodico usciva senza le misurazioni
remote. Due ragioni diverse per lo stesso 0:
- con la sessione del superadmin (ramo a cookie di `resolvePrintAccess`) la RPC
  della 019 non trova il collegamento, che non è suo;
- nella via "solo token" il client è la **service_role**, dove `auth.uid()` è
  NULL: lì non solo la RPC della 019 dà 0 righe, ma anche la variante della 032
  avrebbe negato con 42501.

- **`sito-033`** aggiunge un solo caso a `puo_vedere_come_professionista`: la
  chiave `service_role`. Non concede niente di nuovo — la service_role scavalca
  già la RLS e potrebbe leggere `sessions` a mano — e il diritto di lettura di
  chi stampa è verificato prima, in `print-access.ts` (`verifyPrintToken` e poi
  `assertOwnerOrSuperadmin`).
- **`src/lib/report-data.ts`**: `remoteSessions` prende il titolare della
  scheda e passa dalla `get_linked_client_sessions_as_professional`. Il titolare
  è il riferimento giusto per chiunque stampi, perché il report resta intestato
  al suo studio (`loadOwnerProfile`).
- La stampa della **singola misurazione** non aveva il problema: un superadmin
  legge qualsiasi riga per `superadmin_read_sessions`, quindi la query diretta
  la trova e il ripiego remoto non serve. Il report periodico sì, perché la sua
  query diretta filtra `client_id = scheda` e sulle remote quel campo è NULL.
- **Verificato in produzione** sulla scheda `1789282977721`: 14 misurazioni
  come superadmin, 14 come titolare, 14 come `service_role`, 42501 come `anon`.
- ~~Resta aperto: `loadPreviousMeasurement`…~~ chiuso lo stesso giorno, sotto.

### La misurazione precedente non guarda più la fonte
`loadPreviousMeasurement` cercava la precedente solo fra le sessioni dirette
(`.eq('client_id', clientId)`): per un cliente che misura dalla propria app quel
campo è NULL per progetto, quindi **non trovava mai niente e i delta della
stampa restavano vuoti** — per chiunque stampasse, titolare compreso. Ora la
precedente è la più recente prima dell'istante stampato, qualunque sia la fonte.

Due dettagli che non si potevano saltare:
- **l'ordinamento passa da `startedMs`**, non dalla colonna grezza: le dirette
  arrivano ordinate per `started_at_utc`, le remote — dalla RPC — per
  `started_at`, che è la forma legacy (due ore avanti). Confrontarle come
  arrivavano avrebbe pescato la sessione sbagliata ogni volta che le due fonti
  si alternano a meno di due ore;
- **se `measurement_analytics` manca si ripiega su `sessions`**, come in tutto
  il resto del file: prima si restituiva `null` e una precedente che esisteva
  spariva comunque.

**Verificato** sulla scheda `1789282977721`: per la misurazione del 28/09
(`1790573141682`, istante 05:25Z) la precedente è `1790496597669` del **27/09**
(08:09Z) — una sessione remota, con la riga degli score — e i delta sono
visibili: stress 31,4 → 40,9, recupero 46,3 → 38,8, equilibrio 88,8 → 33,8,
RMSSD 43,8 → 38,8. Prima la stampa non mostrava nessuna precedente.

**Cercata altrove, nel sito**: `loadPreviousMeasurement` ha un solo chiamante
(la pagina di stampa della misurazione). Dettaglio misurazione e confronto
usano `getMeasurementBySessionId` su sessioni scelte a mano, senza ricerca
della precedente; i loro delta (ortostatico, misurazione lunga) stanno dentro
una sola sessione. Il report periodico confronta due periodi interi, già uniti.

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
- **Contratto**, identico nell'app e nel sito, **sei valori**: `invited`,
  `link_pending`, `already_linked_to_you`, `already_linked_other`,
  `is_professional`, `error`. L'account esistente si cerca PRIMA di invitare,
  unico modo di distinguere un professionista da un cliente.
- **Allineamento con `app-035`** (repo `hrv_app`), che porta la colonna
  `requested_by`, la RPC `client_respond_to_link` per l'Accetta/Rifiuta del
  cliente e il trigger che blocca le altre modifiche dal lato cliente.
  Nessun oggetto è creato dalle due migrazioni. **app-035 va applicata prima
  di sito-031**: la 031 scrive `requested_by`, e il backfill di app-035
  (`requested_by = client_user_id` dove è NULL) marcherebbe come "chiesto dal
  cliente" un pending creato dal professionista, che all'app non comparirebbe
  mai fra le richieste — una richiesta persa in silenzio. La 031 si rifiuta di
  applicarsi se la colonna non c'è, e la Edge Function controlla che
  `requested_by` sia davvero uguale al professionista, altrimenti risponde
  `error` invece di lasciare il cliente ad aspettare.
  `requested_by` lo scrive la RPC, non il codice applicativo: i collegamenti
  si scrivono da una sola strada. Un `pending` chiesto dal cliente non viene
  riscritto come se l'avesse chiesto il professionista.
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
