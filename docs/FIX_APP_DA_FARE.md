# Correzioni da fare nell'app Flutter (`hrv_app`)

Elenco nato dall'audit QA del 14/10/2026 sul sito. L'app **non è stata
toccata**: qui c'è cosa nasce dall'app, con riferimenti precisi, e la
mitigazione messa (o proposta) lato database. Si chiude voce per voce in una
sessione dedicata a `hrv_app`, aggiornando il suo changelog.

## G1. `sport_live_data` senza `professional_id` (81 × 400 in 24 ore)

**Errore nei log PostgREST**: `null value in column "professional_id" of
relation "sport_live_data" violates not-null constraint`, POST da `Dart/3.11`
su `sport_live_data?on_conflict=session_id`.

**Dove nasce**: `lib/services/sport_live_service.dart`. Il commento di testa
(:15-23) dice che un client senza link attivo ha lo streaming disabilitato e
`start()` (:50-68) esce se `_resolveTarget` torna `null`. Però l'upsert
periodico (`sport_live_screen.dart:1121`, ogni 5 s) e `_upsert` (:113)
mandano `'professional_id': _professionalId` anche quando è `null`: succede se
lo streaming è stato avviato con un destinatario e poi `_reset()` lo azzera
mentre un tick è ancora in volo, oppure se `_resolveTarget` restituisce un
target con `professionalId` nullo (caso professionista con `uid` non ancora
disponibile all'avvio). Da verificare nell'ordine:
1. in `_upsert`, se `_professionalId == null` non inviare nulla (return);
2. in `start()`, se `target.professionalId == null` trattare come "nessun
   destinatario";
3. mostrare all'atleta un messaggio chiaro ("Sessione live non condivisa:
   nessun professionista collegato") invece di fallire in silenzio.

**Mitigazione DB (proposta, `sito-042`)**: trigger `BEFORE INSERT OR UPDATE`
che risolve `professional_id` da `clients.professionista_id` (`athlete_id` è
l'id della scheda) o dal link attivo di chi scrive, e altrimenti scarta la riga
registrandola in `rls_write_skipped`. L'app smette di ricevere 400.

## G2. `measurement_analytics` prima di `sessions` (20 × 409 in 24 ore)

**Errore**: `insert or update on table "measurement_analytics" violates
foreign key constraint "measurement_analytics_session_id_fkey"`.

**Dove nasce**: in `lib/services/sync_service.dart` `syncSession()` fa le
cose nell'ordine giusto (`_upsertSession` :104, poi
`AnalyticsService.ensureForSessions` :113). L'ordine salta quando la
sessione resta in coda (`SyncQueue`, `sync_queue.dart:243-249`: "analytics
fallita o rimandata perché offline") e al retry la coda rilancia l'analytics
prima che la sessione sia arrivata, oppure quando `AnalyticsService` (:271,
`upsert` su `measurement_analytics`) viene chiamato da un percorso che non
passa da `syncSession` (ricalcolo, backfill locale). Correzione: nella coda
l'elemento "analytics" dipende dall'elemento "sessione" dello stesso id (si
invia solo dopo il 2xx della sessione) e un 409 con `23503` va trattato come
"riprova dopo la sessione", non come errore definitivo.

**Mitigazione DB**: rendere la FK `DEFERRABLE INITIALLY DEFERRED` **non
serve**: ogni chiamata PostgREST è una transazione a sé, quindi il vincolo
verrebbe comunque controllato al commit della chiamata dell'analytics. La
soluzione è solo nell'ordine di invio. In alternativa il trigger
`sync_session_to_measurement_analytics` (già in produzione) ricostruisce la
riga analytics all'arrivo della sessione: se l'app smettesse di inviare
l'analytics per le sessioni "semplici", il problema sparirebbe da solo. Da
decidere con chi segue l'app.

## G3. `Warp server error: Thread killed by timeout manager` (611 in 24 ore)

Messaggi di PostgREST quando una connessione HTTP resta aperta oltre il
timeout del server: tipicamente client (app o browser) che tengono la
connessione inattiva, non un errore applicativo. Conteggio per ora nei log
confrontato con le pagine lente del sito: vedi `FIX_REPORT_2026-10-14.md`,
sezione G3. Nessuna azione nell'app finché non emerge una correlazione.

## A8. Messaggi degli alert nella lingua del telefono

Gli `alert_events` arrivano con `message` composto dall'app
(`lib/services/alert_service.dart:479`, ARB `setAlertMsgSdnnLow` e simili) nella
lingua del dispositivo del **cliente**: nella scheda del professionista
italiano compare "Doretta Sabbatini has an SDNN of 21.5 ms…". Il sito ora
ricompone la frase dai numeri (`alertMessage`), ma la soluzione pulita è che
l'app salvi anche i parametri strutturati (`metric`, `value`, `threshold`,
`baseline`) in una colonna JSON di `alert_events`, e il messaggio testuale
resti solo una comodità. Così il sito e le email traducono senza fare parsing.

## C5. `clients.last_measurement_at`

La funzione del trigger è definita dall'app (`app-040`). La `sito-035` la
riscrive (inizio sessione invece di `created_at`, ricalcolo su DELETE e
UPDATE). Da annotare nel changelog dell'app e, se l'app mostra "ultima
misurazione" leggendo questa colonna, il valore cambia di qualche minuto
(prima era la fine, ora l'inizio).

## D1 e D3. Permessi e `search_path` sulle funzioni dell'app

- `sito-040` (applicata il 15/10) ha messo `SET search_path = public, pg_temp`
  su 49 funzioni, molte dell'app (`hrv_*`, `calc_*`, `night_*`, `set_*`). Se
  una migrazione dell'app le ricrea con `CREATE OR REPLACE` senza quella
  clausola, l'advisor torna a segnalarle: aggiungere `SET search_path` nei
  sorgenti dell'app.
- `sito-038` (in attesa di via libera) toglie l'EXECUTE a `anon` e a
  `PUBLIC`; a `authenticated` restano solo le RPC che l'app chiama. Elenco
  completo con il censimento nel file. `reset_client_baseline`,
  `reset_night_baseline`, `compute_night_baseline` non risultano chiamate
  dall'app: se servono, riaprirle.
- `get_client_night_status` e `get_monthly_comparison` non controllano
  `auth.uid()` in prima persona ma delegano a funzioni interne: va bene, ma
  è fragile. Da aggiungere un controllo esplicito nell'app o nelle funzioni.

## C9. Due sistemi per trial e abbonamenti

`professional_profiles.trial_expires_at` (12 attivi, 70 scaduti) convive con
`abbonamenti` (145 `pro` senza scadenza, 4 `base`, 1 `prova`). Decisione del
15/10: la verità è `abbonamenti` + `account_stato`, `trial_expires_at` diventa
derivato. L'app non deve più scrivere `trial_expires_at` né `profiles.plan`
(`docs/COMMERCIALE.md`, punti 6 e 10 della lista per l'app).

## Tabelle di backup create il 15/10 senza RLS

`backup_laura_20261015_sessions`, `backup_laura_20261015_ma`,
`backup_marco_morbin_20261015_client`, `_sessions`, `_ma`: create oggi da
un'altra sessione, in `public`, **senza RLS** (advisor: ERROR). Chi le ha
create le sposti in uno schema non esposto o attivi la RLS; il sito non le
tocca.

## G5. `clients.data_inizio_percorso`: l'app non la legge dal server

**Da dove nasce**: dal 17/10/2026 il sito salva la data di inizio percorso su
`clients.data_inizio_percorso` (pannello "Prepara la vista") e ci calcola la
partenza dei grafici. L'app la mostra nel form della scheda ma la tiene solo
nella cache cifrata del telefono: `_clientToRow` (`sync_service.dart:896`)
non la manda e il download delle schede non la legge. Risultato: due date
diverse per la stessa scheda senza che nessuno se ne accorga.

**Da fare nell'app**: leggere `data_inizio_percorso` dalla riga `clients`
quando si scaricano le schede e scriverla nell'upsert come `_dateOnly(...)`
(stessa convenzione di `data_nascita`). Nessuna migrazione: la colonna è
`date` ed esiste già.

## G6. Coppia "mattino + coerenza dello stesso giorno" (solo sito, da portare)

**Cosa c'è sul sito**: `src/lib/before-after.ts`, funzione
`pairMorningCoherence` (17/10/2026): la misurazione di riferimento del
mattino (standard, 04:00-11:59) accoppiata con la sessione di coerenza dello
stesso giorno che la segue. `pairBeforeAfter` è rimasta identica al Dart.

**Da fare nell'app**: se la scheda "Prima e dopo" dell'app vuole la stessa
vista, portare la funzione in `before_after_pairs.dart` con gli stessi test
(`before-after.test.ts`, casi "mattino + coerenza").
