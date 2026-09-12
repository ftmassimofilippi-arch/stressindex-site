# Collegamenti cliente ↔ professionista — audit completo

> Stato al 11 settembre 2026, aggiornato il **12 settembre** con il catalogo reale (§1.2–1.4, §2.6), la riproduzione del caso Sara (§2.12) e la riesecuzione della 022 sui dati del 12 settembre (§3, §7). Repo: sito (`stressindex-site`, questo), app (`hrv_app`, sola lettura), database Supabase `ivwmjwukpeldbqkxgvvf`. Sezioni: 1 mappa del modello, 2 stato dei dati, 3 script di riparazione con anteprima dei conteggi, 4 flusso unico, 5 controllo permanente, 6 ordine di applicazione. **Nessuna scrittura è stata eseguita sul database.**

## 1. Mappa del modello (FASE 1)

> Le sezioni 1.2, 1.3 e 1.4 sono allineate al **catalogo reale** riferito il 12 settembre (trigger in produzione, le due colonne dei link e l'unico indice univoco, le policy che leggono `cpl.client_id`, la RPC del monitoraggio). L'output grezzo delle quattro query non è stato incollato nel documento: `cmd` e `roles` delle policy `professional_reads_linked_client_*` non sono noti e la 019 le ricrea come `for select to authenticated` (assunzione, vedi §1.4). Il corpo del trigger è quello recuperato dalla storia git dell'app (`git show 474b0e3:supabase/migrations/client_crm_autocreate_on_link.sql`), che corrisponde passo per passo alla descrizione del catalogo.

### 1.1 Tabelle e colonne

| Tabella | Colonne che contano per il collegamento | Note |
|---|---|---|
| `profiles` | `id` (uuid = auth.users), `email`, `nome`, `cognome`, `role` (`client` / `professional`) | il ruolo è quello confermato al primo accesso; 18 profili `client` non hanno né link né scheda |
| `clients` | `id` **TEXT** (epoch ms dall'app e dal trigger; uuid dalle vecchie route del sito), `professionista_id` uuid → profiles, `email`, `nome`, `cognome`, `client_user_id` uuid → profiles (ponte, migration 017), `created_at`, **`merged_into_client_id`** (nuova, 019) | una scheda per professionista; `uq_clients_prof_client_user (professionista_id, client_user_id)`; nessuna colonna `fonte_dato` |
| `client_professional_links` | `id`, `client_user_id` uuid → profiles, `professional_id` uuid → profiles, `status` (`pending` / `active` / `revoked`), **`client_id` uuid (legacy: è l'uid dell'utente, non la scheda)**, `created_at`, `updated_at` | **Due colonne per lo stesso dato.** `client_id` è la colonna storica: nelle 3 righe dove è valorizzata coincide con `client_user_id` (verificato sui dati). L'**unico indice univoco** in produzione è `(client_id, professional_id)` (non parziale: con `client_id` NULL non vincola nulla); `uq_client_professional_active` **non esiste** (4 coppie con più link vivi). Dalla 019 `link_client_to_professional` scrive **sempre** `client_id = client_user_id`; la 022 (A2) allinea le righe esistenti e crea l'indice parziale dopo la dedup |
| `sessions` | `id`, `professionista_id` uuid → profiles, `client_id` TEXT → clients, `client_nome`, `started_at`, `started_at_utc` | **convenzione remota**: misurazione fatta dal cliente sulla sua app = `professionista_id` **uid del cliente** e `client_id` NULL |
| `measurement_analytics` | `session_id` (unique), `user_id` (= sessions.professionista_id), `client_id` (= sessions.client_id, copiato dal trigger e riscritto dall'app) | RLS `auth.uid() = user_id`: le righe remote sono invisibili al professionista |
| `monitoring_sessions` | `user_id`, `client_id` | stessa convenzione; nessuna incoerenza trovata |
| `client_email_aliases` | | esiste, vuota, non usata da nessun codice |

### 1.2 Trigger

- **`tg_create_client_on_active_link`** (trigger `trg_create_client_on_active_link`, `after insert or update of status` su `client_professional_links`, `security definer`). Testo reale in produzione (= `git show 474b0e3:supabase/migrations/client_crm_autocreate_on_link.sql` nel repo app; il file è stato svuotato con il commit 2453baf del 12 settembre e rimanda alla 019):
  - esce se `new.status <> 'active'` o se è un UPDATE da `active` ad `active`;
  - legge nome, cognome, email dal profilo;
  - **passo 0**: se esiste già una scheda con `client_user_id = new.client_user_id` sotto quel professionista, backfill di nome/cognome/email e fine (giusto);
  - **passo 1**: se esiste una scheda con la stessa email, **`UPDATE clients SET client_user_id = coalesce(client_user_id, new.client_user_id) … WHERE professionista_id = … AND lower(trim(email)) = …` senza limite**: con due schede le aggancia entrambe allo stesso utente e viola `uq_clients_prof_client_user`;
  - **passo 2**: profilo senza email → dedup per nome+cognome sulle schede senza email e senza ponte (giusto);
  - **passo 3**: insert della scheda con id epoch-millis, `created_at = now()`;
  - **nessun blocco `EXCEPTION`**: l'errore del passo 1 risale all'INSERT/UPDATE del link, che viene annullato.

  **Confermato come causa del caso Sara** riproducendolo su una copia locale dei dati di produzione con questo stesso trigger: con le due schede `saraspadoni@yahoo.it` sotto `1f8a818b` l'INSERT del link `active` fallisce con `duplicate key value violates unique constraint "uq_clients_prof_client_user"` (contesto: l'UPDATE del passo 1, riga 52 della funzione); con una sola scheda l'INSERT riesce e la scheda riceve il ponte. Sui dati del 12 settembre le coppie (professionista, email) con più di una scheda sono **21**, e per **13** di queste esiste un link active con quell'utente: ogni nuovo `active` su quelle email sarebbe fallito allo stesso modo. La 019 lo sostituisce (§4.3): passi 0 e 2 conservati, passo 1 con scelta deterministica di una sola scheda, tutto in `EXCEPTION WHEN OTHERS` con log.
- **`update_client_last_measurement`** (after insert su `sessions`, sito `001`): aggiorna `clients.last_measurement_at` solo per le sessioni con `client_id`.
- **`sync_session_to_measurement_analytics`** (sito `007`): copia `professionista_id` → `user_id` e `client_id` → `client_id`.
- Nuovi con la 019: **`tg_profiles_ensure_client_bridge`** (after insert/update di `email, role` su `profiles`) e la riscrittura di `tg_create_client_on_active_link` (§4.3).

### 1.3 RPC

| Funzione | Chi la usa | Cosa fa |
|---|---|---|
| `get_linked_client_sessions_by_client_id(text)` | app (dettaglio cliente lato pro), sito (scheda cliente, report periodico da oggi) | sessioni remote della scheda, solo con link active; ponte esplicito `c.client_user_id = p.id`, poi fallback storico email / `c.id = p.id::text`; dalla 019 esclude le schede archiviate |
| `get_linked_client_monitoring_sessions_by_client_id(text)` | sito (monitoraggio 24h / sonno del cliente) | **in produzione** risolve l'utente **solo** per `lower(email)` e `c.id = p.id::text` (nessun ponte): una scheda agganciata via `client_user_id` con email diversa dal profilo non vede i monitoraggi. La **019 §7** la riscrive con la stessa logica della RPC delle sessioni (ponte esplicito, poi fallback), schede archiviate escluse; la 018 §2 rimanda lì |
| `hrv_puo_accedere(uuid)` / `hrv_e_amministrativo()` | funzioni baseline dell'app (`client_baselines.sql`) | uid = utente, oppure sessione amministrativa, oppure link **active** con `client_user_id = utente`: legge `client_professional_links`, non `clients`. Non toccata da 019/022 (§7) |
| `get_linked_client_sessions_by_email(text)` | app (fallback) | idem per email |
| `get_linked_clients_last_remote_session()` | sito (lista clienti, "ultima misurazione") | data dell'ultima remota per scheda |
| `get_linked_clients_last_remote_analytics()` | sito (lista clienti, colonna Stress) — **nuova 019** | ultima riga `measurement_analytics` remota per scheda |
| `find_linked_client_user_id_by_email`, `get_pending_link_requests`, `get_linked_client_profile`, `lookup_professional` | app | ricerca professionista, richieste pendenti, profilo del cliente collegato |
| `client_can_assign_session(uuid, uuid)` / **`client_can_assign_session_text(uuid, text)`** (019) | policy RLS su `sessions` | il cliente può scrivere una sessione su una scheda: prima solo per `c.id = uid` o email del JWT, ora prima per `client_user_id` |
| `is_superadmin`, `admin_data_health`, `admin_merge_clients`, `admin_client_fk_refs` | sito, pannello Super Admin | 010 / 017 |
| **`link_client_to_professional(uuid, uuid, text)`**, **`link_client_to_professional_guarded`**, **`ensure_client_bridge(text)`**, **`collegamenti_merge_card`** | Edge Function, route admin, script di riparazione, app (proposta) | punto di verità, §4 |
| **`collegamenti_salute_counts()`**, **`collegamenti_salute_check()`** | pannello, pg_cron | §5 |

### 1.4 RLS

- `clients`: `clients_owner_all` (il professionista vede e scrive solo le proprie schede) + lettura superadmin/organizzazione (010). Da oggi anche la policy **restrictive `clients_hide_merged`** (le schede archiviate spariscono da app e sito; la service role le vede).
- `client_professional_links`: il cliente vede e scrive le righe con `client_user_id = uid`, il professionista quelle con `professional_id = uid`; il DELETE del pending è fisico.
- `sessions`: proprietario per `professionista_id`; insert/update del cliente su una scheda tramite `client_can_assign_session` (ora variante `_text`); **`professional_reads_linked_client_sessions`** (reale, non presente in nessuna migrazione dei due repo): il professionista legge le sessioni remote dei clienti collegati, ma la condizione è su **`cpl.client_id`** (la colonna legacy, valorizzata in 3 righe su 121): per quasi tutti i link non concede nulla, e le sessioni remote arrivano al professionista solo tramite le RPC `security definer`.
- `measurement_analytics`: `auth.uid() = user_id`; **`professional_reads_linked_client_analytics`** (reale), stessa condizione su `cpl.client_id`.
- La 019 (§6b) **riscrive le due policy** `professional_reads_linked_client_*` con `coalesce(cpl.client_user_id, cpl.client_id) = <utente della riga>` e `cpl.status = 'active'`: con l'allineamento A2 della 022 le due colonne coincidono e la policy funziona per tutti i link. `cmd` e `roles` originali non sono nell'output disponibile: la 019 le ricrea `for select to authenticated` (se in produzione erano diverse, adattare il blocco §6b prima di applicare).
- Con la RLS di `clients`, la `SELECT clients WHERE email ILIKE …` fatta dall'app al login del cliente (`autoLinkOnClientLogin`) ritorna sempre vuoto: quel percorso non ha mai potuto funzionare.

#### 1.4.1 Policy ridondanti (pulizia futura, NON toccate da 019/020/022)

Sul catalogo reale le tabelle `clients`, `profiles` e `sessions` hanno **due policy permissive `ALL` con la stessa condizione** (`auth.uid() = professionista_id` / `= id`), una con nome italiano e una con nome tecnico: `"Clienti personali"` + `clients_owner_all` su `clients`, `"Sessioni personali"` + `sessions_owner_all` su `sessions`, la coppia analoga su `profiles`. Sono in OR, quindi non cambiano il comportamento, ma raddoppiano il lavoro del planner e confondono chi legge. Pulizia proposta, in una migrazione a parte e dopo aver ricontrollato con `select tablename, policyname, cmd, roles, qual, with_check from pg_policies where tablename in ('clients','profiles','sessions') order by 1,2` che la condizione sia davvero identica: tenere `*_owner_all` e fare `drop policy "Clienti personali" on public.clients` (idem per le altre). Nessuna delle migrazioni di questo lavoro le tocca.

### 1.5 Edge Function `create-client-access`

Versione in produzione (repo app): invito via `inviteUserByEmail` → upsert `profiles` (role client) → **INSERT diretto** del link `active` → il trigger prova ad agganciare la scheda. Se l'insert fallisce il rollback cancella profilo e utente **ignorando gli errori** e risponde con un messaggio generico; se l'email esiste già risponde `ok:false, code:email_exists` (200) e non collega nulla. Nuova versione: §4.4.

### 1.6 Flussi dell'app (sola lettura, `hrv_app`)

1. **Scheda CRM**: `client_form_screen.dart` crea l'id `DateTime.now().millisecondsSinceEpoch` e `dataCreazione = DateTime.now()`; `SyncService._clientToRow` fa `upsert clients` con `professionista_id = uid`. La versione **rilasciata** scrive `created_at` in ora locale senza fuso (509 schede con +2h); nel repo il fix (`toUtc()`, commit 968a039 del 31 luglio) è committato ma non rilasciato.
2. **Invito**: switch "Invita il cliente ad accedere" → salvataggio + sync → `functions.invoke('create-client-access')`. Dopo l'invito l'app non riscarica le schede.
3. **Richiesta dal cliente**: `lookup_professional` → `requestLink` INSERT `pending` (check-then-act non atomico); `cancelPendingRequest` DELETE fisico.
4. **Accettazione lato pro**: `acceptRequest` UPDATE `active` (scatta il trigger) + `downloadClients`; `rejectRequest`/`disconnect` UPDATE `revoked`.
5. **Auto-link al login del cliente**: `autoLinkOnClientLogin` SELECT clients per email (vuoto per RLS) → INSERT link active: percorso morto.
6. **Sessioni del cliente**: target risolto una sola volta al login (`resolveClientSessionTarget`) per `c.id = uid` (mai vero) o per email; **mai per `client_user_id`**. Se risolto: `professionista_id = pro`, `client_id = scheda`; altrimenti convenzione remota.
7. **Lista clienti**: solo cache locale; `downloadClients` (`select clients where professionista_id = uid`) → `replaceAll`.
8. **Dettaglio cliente lato pro**: sessioni locali + RPC `get_linked_client_sessions_by_client_id`, fallback per email.

### 1.7 Flussi del sito

- Lettura schede via RLS (`listClients`, `listClientsEnriched`), Super Admin via service role (`admin-data.ts`).
- Sessioni remote: RPC per client id nella scheda cliente; `get_linked_clients_last_remote_session` per l'"ultima misurazione"; ponte ricostruito con la service role in `remote-sessions.ts` per PDF singolo e monitoraggio.
- Scritture dei link, prima di oggi: `POST /api/admin/clients` (scheda **uuid** + `createUser` + link con `client_id` uuid), `POST /api/admin/links` ("Collega scheda": scriveva `client_user_id` poi inseriva il link con `client_id = id epoch` in colonna uuid → errore 22P02), `POST /api/admin/links/manual` (insert diretto, trigger), `PATCH/DELETE /api/admin/links/[id]`. Da oggi tutte passano da `link_client_to_professional` (§4.4).

### 1.8 I sei scenari

| # | Scenario | Prima | Dopo la 019 |
|---|---|---|---|
| S1 | Il pro crea la scheda e invita: cliente nuovo | scheda app + EF: link insert → trigger `UPDATE … WHERE email` (ok se una sola scheda) | EF → `link_client_to_professional`: trova la scheda per email, scrive il ponte, crea il link; doppioni uniti |
| S2 | Il pro invita un'email già registrata | EF risponde `email_exists`, nessun link | EF risolve l'utente esistente e collega comunque |
| S3 | Il cliente si registra da solo e chiede il collegamento | pending → accept → trigger: ok solo se una scheda con quella email | pending → accept → trigger delega alla funzione (stesse regole, errore esplicito) |
| S4 | Due schede con la stessa email sotto lo stesso pro (Sara) | il trigger colpisce entrambe, il link non nasce, la EF cancella l'utente | la funzione tiene la scheda con più sessioni (poi la più vecchia), archivia l'altra con `merged_into_client_id`, logga in `clients_merge_log` |
| S5 | Il pro cancella e ricrea la scheda | vecchia scheda sparisce, link resta, trigger crea una scheda nuova al prossimo `active` | la funzione riaggancia per `client_user_id` → email → nome, altrimenti crea |
| S6 | Lo stesso cliente con due professionisti | due link, due schede (una per pro) | invariato, ogni pro ha la sua scheda con il ponte; `uq_clients_prof_client_user` rispettato (test T9) |

## 2. Stato dei dati (FASE 2)

Fotografia del **11 settembre 2026, 13:40 UTC**, letta con la service role via PostgREST (tutte le righe di `profiles`, `clients`, `client_professional_links`, `sessions`, `measurement_analytics`, `monitoring_sessions`, `professional_profiles`, `client_email_aliases`, `client_notes`, `admin_audit_log`, più `auth.users` via Auth Admin API) e rielaborata in locale. Le verifiche che richiedono il catalogo (2.6 indice, 2.9 RPC eseguita come professionista) sono emulate dal testo delle migrazioni e vanno confermate con la connessione SQL: vedi §Verifiche SQL da eseguire.

### Numeri di base

Aggiornamento **12 settembre 2026, 05:20 UTC** (stessa procedura, ricaricato in locale): 249 profili, 571 schede, 121 link (3 con `client_id` valorizzato = `client_user_id`), 3044 sessioni di cui 670 remote, 3652 `measurement_analytics`, 9 `monitoring_sessions`, 51 `client_baselines` (38 utenti). Rispetto all'11 settembre: **Sara Spadoni ha il link** (creato dal pannello l'11 settembre alle 13:46 UTC da info@massimofilippi.it, `admin_audit_log` action `create_link`), un nuovo link active senza scheda (mariateresa_alaia@yahoo.com ↔ Andrea Ponghetti), un profilo client orfano in più (Matteo Speltri), Bart Sileghem a 14 sessioni remote. I numeri qui sotto restano quelli dell'11 settembre dove non indicato diversamente.

| Cosa | Valore |
|---|---|
| Profili | 228 (client 118, professional 110) |
| Utenti auth | 228 (tutti con profilo) |
| Schede clients | 562: 532 con id epoch-millis (app o trigger), 30 con id uuid (sito) |
| Schede con ponte client_user_id | 98 |
| Colonna fonte_dato | NON esiste nel DB (citata nel brief, mai scritta da app o sito) |
| Collegamenti | 116: {'revoked': 6, 'active': 109, 'pending': 1}; 3 con client_id (uuid) valorizzato, nessuno corrisponde a una scheda (clients.id è text epoch) |
| Sessioni | 3027, di cui 665 remote (client_id NULL): 578 di utenti client, 87 di professionisti (auto-misure proprie) |
| measurement_analytics | 3635 |
| monitoring_sessions | 1 |

Altro riscontro: **509 schede create dall'app hanno `created_at` = ora locale scritta come UTC (+2 h rispetto all'epoch dell'id)**. Nell'ordinamento "scheda più vecchia" lo script usa l'epoch dell'id, non `created_at`.

### 2.1 Schede duplicate per email

**41 email** compaiono su più righe; di queste **21 coppie sono sotto lo stesso professionista** (i doppioni veri, da unire). Le altre sono la stessa persona sotto professionisti diversi (legittimo, es. un professionista che è anche cliente di un collega, o i 10 clienti demo `bifrost-demo.local` duplicati fra PROVA Professionista e Matteo Mazzocchi).

**Stesso professionista (21):**

| Email | Professionista | Righe (id · nome · ponte · creata) |
|---|---|---|
| alessandro.mazzocchi@hotmail.it |  <info@massimofilippi.it> | `1776875556855` · Alessandro Mazzocchi · ponte 30ff0c92 · 2026-04-22<br>`1783872783145` · Alessandro Mazzocchi · senza ponte · 2026-07-12 |
| massimo.milanesekc@gmail.com | Massimo Milanese <massimo.milanesekc@gmail.com> | `1778839106151` · Massimo Milanese · senza ponte · 2026-05-15<br>`1784442665027` · Massimo Milanese · senza ponte · 2026-07-19 |
| ligabriviba@gmail.com | Liga Briviba <ligabriviba@gmail.com> | `1778854627818` · Liga Briviba · senza ponte · 2026-05-15<br>`1779102200806` · Armando Benini · senza ponte · 2026-05-18<br>`1779296566435` · Angelo Magrì · senza ponte · 2026-05-20<br>`1779635515733` · Ciro Pennacchia · senza ponte · 2026-05-24<br>`1779727304558` · Jenny Spinella · senza ponte · 2026-05-25 |
| mondoeventi11@gmail.com | DRAGOLJUB VUJANOVIC <ecospirito@gmail.com> | `1778959095174` · Jelena Vujanovic · senza ponte · 2026-05-16<br>`1778961284515` · Jelena Vujanovic · senza ponte · 2026-05-16 |
| gianandreapazzini@gmail.com |  <info@massimofilippi.it> | `1779535113786` · Gianandrea Pazzini · ponte a8bb2469 · 2026-05-23<br>`1782895788075` · Gian Andrea Pazzini · senza ponte · 2026-07-01 |
| eleonora.menin95@gmail.com |  <info@massimofilippi.it> | `1779551610050` · Eleonora Menin · senza ponte · 2026-05-23<br>`1779628653721` · Eleonora Menin · senza ponte · 2026-05-24 |
| martinazanchini@gmail.com |  <info@massimofilippi.it> | `1782304040156` · Martina Zanchini · ponte f278e86f · 2026-06-24<br>`1784205492563` · Martina Zanchini · senza ponte · 2026-07-16 |
| davide.calse@gmail.com | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | `1782392763574` · Davide Caltran · ponte 9b64d641 · 2026-06-25<br>`1783084859522` · Davide Caltran · senza ponte · 2026-07-03 |
| sassabert00@gmail.com | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | `1782403707747` · Sara Bertoldo · ponte c8e73570 · 2026-06-25<br>`1784377042569` · Sara Bertoldo · senza ponte · 2026-07-18 |
| planetex@virgilio.it | Salvatore Tesauro <planetex@virgilio.it> | `1783694845578` · Salvatore Tesauro · senza ponte · 2026-07-10<br>`1784615870112` · Sabrina Danieli · senza ponte · 2026-07-21 |
| barbiegrosso69@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `1783969578721` · Barbara Grosso · ponte a8b84f20 · 2026-07-13<br>`1783969800720` · Barbara Grosso · senza ponte · 2026-07-13 |
| camilla3297sarbia@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `1783970945749` · Camilla Sarbia · ponte d355db24 · 2026-07-13<br>`1783971084856` · Camilla Sarbia · senza ponte · 2026-07-13 |
| alex.spirandelli7@gmail.com | Alex Spirandelli <alex.spirandelli7@gmail.com> | `1783974033108` · Alex Spirandelli · senza ponte · 2026-07-13<br>`1784220589177` · Nicola Spirandelli · senza ponte · 2026-07-16 |
| gluca.dettori@gmail.com | Gian Luca Dettori <gluca.dettori@gmail.com> | `1784063548747` · Gian Luca Dettori · senza ponte · 2026-07-14<br>`1786810446358` · Mamma Mamma · senza ponte · 2026-08-15 |
| antonella.sanguineti60@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `1784101296413` · Antonella Sanguineti · ponte 05c9f5cd · 2026-07-15<br>`1784101455689` · Antonella Sanguineti · senza ponte · 2026-07-15 |
| breil69@hotmail.com | Gian Luca Dettori <gluca.dettori@gmail.com> | `1784318534609` · Antonella Paddeu · senza ponte · 2026-07-17<br>`1784319603599` · Manuela concas · senza ponte · 2026-07-17 |
| martinawaddell@icloud.com | Massimo Milanese <massimo.milanesekc@gmail.com> | `1784492796734` · Martina Waddell · senza ponte · 2026-07-19<br>`1788677380749` · Martina Waddell · senza ponte · 2026-09-06 |
| nicolo.maragni@gmail.com | Nicolò Maragni <nicolo.maragni@gmail.com> | `1786945443322` · Nicolo Maragni · senza ponte · 2026-08-17<br>`1787248314292` · Ginevra Maragni · senza ponte · 2026-08-20 |
| igig24@alice.it | Massimo Milanese <massimo.milanesekc@gmail.com> | `1787294882170` · Irene Gigante · senza ponte · 2026-08-21<br>`1788159842222` · Irene Gigante · senza ponte · 2026-08-31 |
| saraspadoni@yahoo.it |  <info@massimofilippi.it> | `1788354294664` · Sara Spadoni · ponte 14b75d60 · 2026-09-02<br>`e0892ecb-080e-43a8-b804-8059a391ac74` · Sara Spadoni · senza ponte · 2026-09-02 |
| mercedes.cristina62@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `1788948932379` · Cristina Migone · senza ponte · 2026-09-09<br>`1788948933917` · Cristina Migone · ponte 0e218ab7 · 2026-09-09 |

Schema ricorrente: **una riga vecchia con ponte + una riga nuova senza ponte** (Mazzocchi, Pazzini, Zanchini, Caltran, Bertoldo, Grosso, Sarbia, Sanguineti, Migone, Spadoni): il cliente è stato creato di nuovo dal form dell'app (o dal sito) dopo che il trigger o l'invito avevano già creato/agganciato la scheda, perché l'app controlla i doppioni solo nella cache locale. Casi diversi: `ligabriviba@gmail.com` (7 schede con la stessa email: il professionista ha messo la propria email a clienti diversi), `planetex`, `alex.spirandelli7`, `gluca.dettori`, `breil69`, `nicolo.maragni` (persone diverse con la stessa email: NON da unire, sono da separare o da lasciare).

**Stessa email sotto professionisti diversi (20, non da unire):** franco.testa.demo@bifrost-demo.local (2), menconi.nico@gmail.com (2), albertomfiscella@gmail.com (2), elisa.moro23@hotmail.it (2), warnerfisio@gmail.com (2), paola.mondino@libero.it (2), test@test.it (2), marco.baldacci62@gmail.com (2), marcolatorta@gmail.com (2), maryventura66@gmail.com (2), mularonimarco77@gmail.com (2), giulia.neri.demo@bifrost-demo.local (2), paolo.sala.demo@bifrost-demo.local (2), omar.bassi.demo@bifrost-demo.local (2), nadia.ricci.demo@bifrost-demo.local (2), marta.villa.demo@bifrost-demo.local (2), serena.valli.demo@bifrost-demo.local (2), luca.ferri.demo@bifrost-demo.local (2), elena.bruni.demo@bifrost-demo.local (2), marco.conti.demo@bifrost-demo.local (2)

### 2.2 Ponte mancante ma costruibile

**17 schede** con `client_user_id` NULL hanno un profilo `client` con la stessa email (17 su 562). In 10 casi esiste già un link `active` con quel professionista: lì il trigger avrebbe dovuto agganciare la scheda ma ne ha agganciata un'altra (il doppione con ponte del 2.1). Riparabile con lo script 3.1.

| Scheda | Nome | Email | Professionista | Profilo | Link con il pro |
|---|---|---|---|---|---|
| `1778850227402` | Osvaldo Lautieri | olautieri@gmail.com | Osvaldo Lautieri <olautieri@gmail.com> | `40164cd1` | nessuno |
| `1779556889678` | Andrea Oprandi | andreaoprandipc@gmail.com |  <info@massimofilippi.it> | `ef09feb2` | nessuno |
| `1781963548004` | GIULIA DE SANCTIS | veneziagiulia97@gmail.com | Alfredo Donatini <alfdonatini@gmail.com> | `8e3974ec` | nessuno |
| `1782895788075` | Gian Andrea Pazzini | gianandreapazzini@gmail.com |  <info@massimofilippi.it> | `a8bb2469` | active |
| `1783084859522` | Davide Caltran | davide.calse@gmail.com | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | `9b64d641` | active |
| `1783091621238` | Alessandra Redaelli | alessandra6.redaelli@gmail.com | Giuseppe Piacenza <info@motionpiacenza.it> | `76d2ff5f` | pending |
| `1783692220045` | Warner D'anniballe | warnerfisio@gmail.com | Francesco Di Donato <didonatofrancesco69@gmail.com> | `c4a5ede3` | nessuno |
| `1783872783145` | Alessandro Mazzocchi | alessandro.mazzocchi@hotmail.it |  <info@massimofilippi.it> | `30ff0c92` | active |
| `1783969800720` | Barbara Grosso | barbiegrosso69@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `a8b84f20` | active |
| `1783971084856` | Camilla Sarbia | camilla3297sarbia@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `d355db24` | active |
| `1784101455689` | Antonella Sanguineti | antonella.sanguineti60@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `05c9f5cd` | active |
| `1784103544616` | Warner D'Anniballe | warnerfisio@gmail.com | Warner D'Anniballe <warnerfisiovisite@gmail.com> | `c4a5ede3` | nessuno |
| `1784205492563` | Martina Zanchini | martinazanchini@gmail.com |  <info@massimofilippi.it> | `f278e86f` | active |
| `1784377042569` | Sara Bertoldo | sassabert00@gmail.com | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | `c8e73570` | active, active, active, active |
| `1784552955137` | Marco Baldacci | marco.baldacci62@gmail.com | Gabriele Giuli <gabriele_06@hotmail.it> | `e6742e6d` | nessuno |
| `1788948932379` | Cristina Migone | mercedes.cristina62@gmail.com | Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | `0e218ab7` | active |
| `e0892ecb-080e-43a8-b804-8059a391ac74` | Sara Spadoni | saraspadoni@yahoo.it |  <info@massimofilippi.it> | `14b75d60` | nessuno |

### 2.3 Ponte verso un profilo inesistente o non client

**1 caso**: scheda `1783692357597` (Paola Mondino) → profilo `0c52c2f5` con ruolo professional (osteopatia.mondino@gmail.com). È Paola Mondino che ha due account (libero = professional che segue clienti, osteopatia.mondino = professional); la scheda sotto l'account libero punta all'account osteopatia. Nessun profilo inesistente (la FK regge).

### 2.4 Link active senza scheda

**4 link active** non agganciano nessuna scheda del professionista (né per ponte, né per email, né per id):

| Link | Cliente | Professionista | Creato | Note |
|---|---|---|---|---|
| `a1984e34` | ?455cca2a-695a-469a-8be4-4123bd631431 |  <info@massimofilippi.it> | 2026-06-25 | profilo INESISTENTE (utente cancellato, link orfano) |
| `29159753` | Davide Caltran <davide.calse@gmail.con> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | 2026-06-25 | profilo esiste, scheda mai creata: il trigger non ha scattato o è fallito |
| `0e786321` | ?a740ec91-8475-4b3f-95cf-38383c52646b | Alessandro Verraz <alessandroverraz@gmail.com> | 2026-07-08 | profilo INESISTENTE (utente cancellato, link orfano) |
| `9002d3de` | Andrea Oprandi <andreaoprandipc@gmail.com> | Gabriele Giuli <gabriele_06@hotmail.it> | 2026-07-20 | profilo esiste, scheda mai creata: il trigger non ha scattato o è fallito |

I 2 link con profilo inesistente vanno revocati, non riparati. Gli altri 2 (Davide Caltran con email `.con`, Andrea Oprandi ↔ Gabriele Giuli) sono da riparare con 3.3. Link active agganciati solo per fallback email/id senza ponte: 0. **12 settembre**: un terzo link active senza scheda, `4f935031` Maria Teresa Alaia <mariateresa_alaia@yahoo.com> ↔ Andrea Ponghetti <a.ponghetti@gmail.com>: stesso schema (il trigger non ha creato la scheda).

### 2.5 Link pending da più di 30 giorni

**0**. L'unico pending (Alessandra Redaelli ↔ Giuseppe Piacenza) è recente.

### 2.6 Coppie duplicate non revocate

**4 coppie** cliente↔professionista hanno più di un link vivo. **Confermato dal catalogo**: `uq_client_professional_active` non esiste (il file `hrv_app/supabase/migrations/client_professional_links_unique.sql` non è mai stato applicato ed è stato svuotato il 12 settembre); l'unico indice univoco è `(client_id, professional_id)`, che con `client_id` NULL non vincola nulla. L'ultimo doppione è del 9 settembre 2026.

| Cliente | Professionista | Link vivi |
|---|---|---|
| Sara Bertoldo <sassabert00@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | 4: `c231dbca` active 2026-06-25, `1ecdce13` active 2026-07-02, `b3ac2681` active 2026-07-04, `c791c71b` active 2026-07-18 |
| Andrea Porrini <andrea.porrinimoda@gmail.com> | Viviana anessi <viviana.anessi40@gmail.com> | 2: `c9bfdcbc` active 2026-07-10, `1574b8ad` active 2026-07-10 |
| Mirko Sartori <mirko1sartori@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | 4: `b228b552` active 2026-07-18, `c9a6c049` active 2026-07-19, `3c71fe0a` active 2026-08-02, `dcabe72c` active 2026-08-20 |
| Nicola Caleo <timer-02@hotmail.it> | Jessica Possamai <dott.jessicapossamai@gmail.com> | 2: `8d41412f` active 2026-09-09, `95fd9a24` active 2026-09-09 |

Sara Bertoldo e Mirko Sartori hanno 4 link active ciascuno con lo stesso professionista: sono richieste ripetute dall'app (`requestLink` controlla solo lato client) o auto-link al login ripetuti.

### 2.7 Sessioni con client_id che non esiste in clients

**0**. Nessuna: la FK/il flusso tengono.

### 2.8 Sessioni remote di utenti senza collegamento

**8 profili client** hanno **61 sessioni remote** che nessun professionista può vedere, perché non hanno alcun link active:

| Utente | Sessioni | Ultima | Scheda con la stessa email? |
|---|---|---|---|
| Osvaldo Lautieri <olautieri@gmail.com> | 4 | 2026-05-21 | sì |
| Daniela Raus <raus.dana@yahoo.com> | 2 | 2026-06-15 | no |
| Beppino Simeon <simeonbeppino@yahoo.it> | 31 | 2026-08-10 | no |
| Giulia De Sanctis <veneziagiulia97@gmail.com> | 3 | 2026-08-03 | sì |
| Federico Casadei <f.casadey@gmail.com> | 4 | 2026-07-05 | no |
| Roberto Bocca <boush1967@gmail.com> | 2 | 2026-08-17 | no |
| Paolo Terenziani <terenzio@ngi.it> | 2 | 2026-08-19 | no |
| Bart Sileghem <bartsileghem@gmail.com> | 13 | 2026-09-11 | no |

Nessuna sessione remota appartiene a un utente senza profilo. Le 87 sessioni remote di utenti professional sono le loro auto-misurazioni: normali.

### 2.9 Sessioni remote invisibili alla RPC

**0 clienti, 0 sessioni**, emulando la RPC `get_linked_client_sessions_by_client_id` nella versione della migrazione 017 (ponte esplicito, fallback email/id). Anche con la versione precedente (solo email/id) il risultato è 0: tutte le schede agganciate hanno l'email uguale al profilo. **Il problema delle misurazioni invisibili oggi non è nella RPC ma a monte**: i 61 casi del 2.8 (nessun link) e i 4 del 2.4 (link senza scheda). Da confermare con l'esecuzione reale della RPC come professionista (vedi §Verifiche SQL).

### 2.10 Profili client orfani

**18 su 118** profili client non hanno né link né scheda che li agganci:

| Utente | Registrato | Sessioni remote | Scheda con la stessa email presso qualche pro |
|---|---|---|---|
| Federico Casadei <f.casadey@gmail.com> | 2026-06-17 | 4 | no |
| Beppino Simeon <simeonbeppino@yahoo.it> | 2026-06-19 | 31 | no |
| Alessandro ponzetto <alessandrobiohackingcoach@gmail.com> | 2026-08-12 | 0 | no |
| Osvaldo Lautieri <olautieri@gmail.com> | 2026-05-15 | 4 | sì (basta il ponte + il link) |
| Roberto Bocca <boush1967@gmail.com> | 2026-06-18 | 2 | no |
| Paolo Terenziani <terenzio@ngi.it> | 2026-08-17 | 2 | no |
| Daniela Raus <raus.dana@yahoo.com> | 2026-05-20 | 2 | no |
| Paola Gorgaini <paola.gorgaini@gmail.com> | 2026-08-11 | 0 | no |
| Giulia De Sanctis <veneziagiulia97@gmail.com> | 2026-06-19 | 3 | sì (basta il ponte + il link) |
| Gianni Cortelli <giannicortelli62@gmail.com> | 2026-07-17 | 0 | no |
| alberto Milanta <alberto.milanta@live.it> | 2026-06-18 | 0 | no |
| Edoardo Scolaro <edoscolaro07@gmail.com> | 2026-07-04 | 0 | no |
| Marco Mantellassi <marco.mante.04@gmail.com> | 2026-08-11 | 0 | no |
| Bart Sileghem <bartsileghem@gmail.com> | 2026-09-04 | 13 | no |
| Warner D"Anniballe <warnerfisio@gmail.com> | 2026-07-10 | 0 | sì (basta il ponte + il link) |
| Daniele Imperia <fv.imperiad@libero.it> | 2026-07-23 | 0 | no |
| Claudio Buresta <stormraidadriatic@gmail.com> | 2026-08-24 | 0 | no |
| Riccardo Battaglia <rickybatta.2000@gmail.com> | 2026-07-04 | 0 | no |

### 2.11 Professional senza professional_profiles

**38 su 110** (di cui `info@massimofilippi.it` con 155 schede). Non rompe nulla: `lookup_professional` usa LEFT JOIN. Elenco: dott.jessicapossamai@gmail.com (1 clienti), cristina.ruggeri87@gmail.com (0 clienti), guglielmi.barbara@gmail.com (0 clienti), osteopatia.mondino@gmail.com (1 clienti), lunaelmaspmt@gmail.com (0 clienti), sirenapaola@gmail.com (4 clienti), bruzchiara@gmail.com (1 clienti), lory_parodi@man.com (0 clienti), pasquale.girone@gmail.com (2 clienti), info@massimofilippi.it (155 clienti), diego.reale@hotmail.it (0 clienti), elisabetta.sacchi@gmail.com (32 clienti), gabriele_06@hotmail.it (4 clienti), prova.professionista@codicemassimo.com (10 clienti), valentinabiscaccia@gmail.com (2 clienti), arinialessandro23@gmail.com (1 clienti), zuccherovic85@gmail.com (0 clienti), maroussia.tod@gmail.com (2 clienti), col.massy@gmail.com (1 clienti), miozziemanuela@gmail.com (1 clienti), maxi.filippi@gmail.com (0 clienti), cmassaggistudio@gmail.com (2 clienti), rosadamato634@gmail.com (0 clienti), testadebora.fisio@gmail.com (0 clienti), munaretto.enrica@gmail.com (2 clienti), colla.marco@gmail.com (0 clienti), marcolatorta@gmail.com (1 clienti), M.baldacci@awn.it (1 clienti), paola.mondino@libero.it (2 clienti), didonatofrancesco69@gmail.com (5 clienti), clorjsmanca@gmail.com (0 clienti), danieladotti.coach@gmail.com (2 clienti), ftmassimofilippi@gmail.com (0 clienti), warnerfisiovisite@gmail.com (6 clienti), espositoluigi271@gmail.com (1 clienti), anto60.nava@gmail.com (2 clienti), dsnsfn@gmail.com (0 clienti), matteomazzocchimarketing2.0@gmail.com (11 clienti).

### 2.13 measurement_analytics non allineato alla sessione

**58 righe** hanno `client_id` diverso da quello della sessione corrispondente, in 4 gruppi: 38 + 2 sessioni dell'utente `52e9df1e` (pro `5aff0086`) dove la sessione è stata riassegnata a un'altra scheda ma `measurement_analytics` è rimasto sulla vecchia; 17 + 1 sessioni dove la sessione ha `client_id` e l'analytics è NULL (assegnazione fatta dopo, senza `AnalyticsService.updateClientId`). Inoltre **608 righe di measurement_analytics non hanno più la sessione** (587 di professional, 21 di client, dal 18 maggio al 10 settembre): sessioni cancellate dall'app senza cancellare l'analytics. 51 righe hanno `user_id` diverso dal `professionista_id` della sessione.

### 2.14 monitoring_sessions

**0 incoerenze su 1** righe (l'unica riga è coerente).

### 2.12 Il caso saraspadoni@yahoo.it, riga per riga

Tutti gli orari in UTC (ora italiana = +2 h). Professionista: `1f8a818b` = info@massimofilippi.it.

| Ora (UTC) | Tabella | Riga | Fatto certo | Chi l'ha scritta |
|---|---|---|---|---|
| 12:42:14.574 | clients | `e0892ecb-080e-43a8-b804-8059a391ac74` | Scheda "Sara Spadoni", email saraspadoni@yahoo.it, `client_user_id` NULL | **Sito**: id uuid = `POST /api/admin/clients` (pannello Super Admin, `randomUUID()`), senza "createAccess". Nessuna riga in `admin_audit_log` con action `create_client`: la route logga, ma nel log ci sono solo azioni `baseline_*` e `migration_applicata`, quindi il log admin non ha mai scritto (da verificare: `console.error('[admin-audit] insert fallito')` nei log Vercel). |
| 13:04:54.664 | clients | `1788354294664` | Seconda scheda "Sara Spadoni", stessa email, sotto lo stesso professionista | **App** (id epoch = 13:04:54.664; `created_at` salvato come 15:04:54 = ora locale etichettata UTC, bug dell'app). Form CRM con lo switch "Invita il cliente ad accedere": l'app controlla i doppioni solo nella cache locale, la scheda del sito non c'era mai stata scaricata (`downloadClients` gira solo al login e dopo un accept). |
| 13:04:55.26 | auth.users | `14b75d60-7a60-4b8b-96e2-e8edb8cd0ceb` | Utente creato con `invited_at` (mail di invito spedita da Supabase Auth) | **Edge Function** `create-client-access`, passo 3 (`inviteUserByEmail`) |
| 13:04:55.733 | profiles | `14b75d60` | Profilo `role=client`, nome/cognome/email | Edge Function, passo 4 |
| 13:04:55.7… | client_professional_links | — | **Nessuna riga esiste oggi** per Sara (né active, né pending, né revoked) | Edge Function, passo 5: `INSERT … status='active'`. Vedi sotto. |
| 13:08:48.15 | auth.users | `14b75d60` | `updated_at` cambia; `confirmed_at` e `last_sign_in_at` restano NULL | Operazione amministrativa sull'utente ~4 minuti dopo (reinvio invito dalla dashboard Supabase o tentativo di cancellazione dalla Edge Function): non è un login di Sara. |
| 13:10:46.89 | sessions | `1788354346555` | Misurazione standard in studio assegnata alla scheda `1788354294664` | App del professionista |
| 13:10:46.89 | measurement_analytics | 1 riga | `user_id` = pro, `client_id` = `1788354294664` | trigger `sync_session_to_measurement_analytics` |
| oggi | clients | `1788354294664` | Ha `client_user_id = 14b75d60` (ponte corretto) | vedi sotto |
| oggi | clients | `e0892ecb` | `client_user_id` NULL | — |

**Cosa NON torna e come si spiega (ricostruzione, da confermare con i log della Edge Function del 2 settembre 13:04:55 UTC).**

1. L'INSERT del link (passo 5 della Edge Function) fa scattare `tg_create_client_on_active_link`. Il ramo "dedup per email" del trigger esegue `UPDATE clients SET client_user_id = … WHERE professionista_id = pro AND lower(email) = 'saraspadoni@yahoo.it'`: a quell'ora le righe con quella email sono **due** (`e0892ecb` del sito e `1788354294664` dell'app, sincronizzata 600 ms prima). L'UPDATE assegna lo stesso `client_user_id` a entrambe e viola l'indice univoco `uq_clients_prof_client_user (professionista_id, client_user_id)` della migrazione 017. L'eccezione annulla l'UPDATE e l'INSERT del link: **il link non nasce**. È coerente con lo stato attuale: nessun link, `e0892ecb` senza ponte.
2. La Edge Function, a quel punto, tenta il rollback (delete del profilo e dell'utente auth). Profilo e utente esistono ancora: o i due `delete` sono falliti in silenzio (`.catch(() => {})` non intercetta gli errori restituiti come `{ error }` da supabase-js), o la versione deployata è precedente al rollback. L'app ha ricevuto `link_failed`/500 e mostrato l'errore; **l'email di invito era comunque già partita**.
3. Il ponte su `1788354294664` non lo ha scritto l'app (l'app non scrive mai `clients.client_user_id`) né il trigger (nessun link è mai diventato active). Il solo codice che scrive quel campo su una scheda esistente è la route `POST /api/admin/links` del pannello Super Admin ("Collega scheda"): risolve l'utente per email, **aggiorna `clients.client_user_id`** e poi fa `INSERT INTO client_professional_links (client_id = '1788354294664', …)`. `client_id` è `uuid`: l'INSERT fallisce con `invalid input syntax for type uuid`, la route risponde 500 **dopo** aver già scritto il ponte, e non logga. Risultato: ponte sì, link no. Un tentativo manuale di sistemare dal pannello, andato a metà.
4. Sara non ha mai accettato l'invito (`confirmed_at` NULL): se accedesse oggi, `autoLinkOnClientLogin` dell'app cercherebbe `clients` per email e creerebbe un link active; ma la lettura di `clients` da parte di un client è bloccata dalla RLS, quindi probabilmente non succederebbe nulla e le sue misurazioni resterebbero invisibili al professionista.

**Cause radice esposte dal caso** (tutte trattate nella FASE 4): (a) il trigger aggiorna *tutte* le schede con la stessa email invece di sceglierne una, e quando sono due fa fallire il collegamento; (b) app e sito creano schede senza vedersi a vicenda (cache locale vs uuid); (c) la Edge Function scrive direttamente sul link invece di passare da una funzione idempotente che sa trovare o riusare la scheda; (d) la route admin "Collega" inserisce `client_id` text in una colonna uuid; (e) il rollback della Edge Function ignora gli errori.

**Riparazione proposta per Sara** (nello script 3.x): unire `e0892ecb` in `1788354294664` (tiene quella con il ponte e la misurazione) e creare il link `active` fra `14b75d60` e `1f8a818b` via `link_client_to_professional`; l'invito va rispedito (o Sara usa "password dimenticata") perché l'account non è confermato.

**Conferma del 12 settembre.** Il punto 1 non è più una ricostruzione: installando il trigger di produzione su una copia locale dei dati e rifacendo l'INSERT del link di Sara (due schede con la stessa email, ponte tolto), l'INSERT fallisce con `23505 duplicate key value violates unique constraint "uq_clients_prof_client_user"` dentro l'UPDATE del passo 1; con una scheda sola riesce. Con il trigger della 019 lo stesso INSERT riesce: la scheda `1788354294664` riceve il ponte, `e0892ecb` viene archiviata in essa (`merged_into_client_id`), il link nasce con `client_id = client_user_id`. Nel frattempo il link di Sara è stato creato dal pannello l'11 settembre (13:46 UTC): nella 022 Sara resta solo nel blocco C (unione delle due schede).

## 3. Script di riparazione (FASE 3): anteprima dei conteggi

File: `supabase-migrations/021_collegamenti_backup.sql` (backup) e `supabase-migrations/022_collegamenti_riparazione.sql` (riparazione). Entrambi rieseguiti il **12 settembre** su un Postgres 16 locale caricato con i dati di produzione del 12 settembre, con il ciclo completo 019 → 020 → 021 → 022 anteprima → 022 applicazione → 022 anteprima di nuovo: la seconda anteprima riporta **solo i blocchi di report** (C da decidere a mano, D scheda di sé stesso, G, I), quindi lo script è idempotente. Prerequisito: `019_collegamenti_flusso_unico.sql`. Modalità: eseguito così com'è fa solo l'**anteprima** e lascia i conteggi in `collegamenti_riparazione_log`; per applicare, nella stessa sessione del SQL Editor eseguire prima `select set_config('collegamenti.apply', 'on', false);`.

Cosa è cambiato nella 022 rispetto alla prima stesura (richieste A–F del 12 settembre):

- **A2** (nuovo): allinea `client_id = client_user_id` sulle righe dove `client_id` è NULL, una riga per coppia (l'indice univoco reale è su `(client_id, professional_id)`), e riporta le righe dove `client_id` è valorizzato ma diverso (0).
- **C usa `admin_merge_clients`** (017, già in produzione) al posto della unione morbida: in anteprima gira con `p_dry_run = true` e i conteggi per tabella finiscono nei dettagli del log; in applicazione sposta prima `monitoring_sessions.client_id` (riferimento soft che `admin_merge_clients` non conosce), poi chiama la funzione, che **cancella** le schede unite. Differenze rispetto alla unione morbida (`collegamenti_merge_card`, che resta per il pannello e per i doppioni trovati durante un collegamento): la morbida tiene la riga con `merged_into_client_id` (nascosta dalla RLS, ripristinabile), scrive `clients_merge_log` con lo snapshot completo e arricchisce la scheda tenuta con data di nascita, sesso, note e `last_measurement_at`; `admin_merge_clients` cancella la riga, arricchisce solo email, telefono e `client_user_id`, non conosce `monitoring_sessions.client_id` e tratta `client_professional_links.client_id` come riferimento alla scheda (innocuo: quella colonna contiene uid utente, mai id scheda), e salta il proprio audit dei conflitti quando `performed_by` è NULL: per questo la 022 scrive **una riga propria in `admin_audit_log`** per ogni riparazione (`performed_by_email = 'migration:022'`, `action = 'repair_<blocco>'`, con il risultato della funzione nei `details`). Il ripristino delle schede cancellate passa da `clients_backup_20260912` (021).
- **Criterio "stessa persona" più stretto** per C: prima bastava lo stesso cognome (avrebbe unito "Nicolo Maragni" con "Ginevra Maragni" e "Alex Spirandelli" con "Nicola Spirandelli", contraddicendo il §2.1); ora serve **un solo nome distinto** nel gruppo, confrontato senza spazi e maiuscole (`collegamenti_nome_norm`: "Gian Andrea Pazzini" = "Gianandrea Pazzini"); le schede senza nome non contano. Lo stesso criterio vale nella 019 per i doppioni uniti durante un collegamento. Risultato: 15 unioni automatiche, 6 gruppi a mano (erano 17 / 4).
- **D** esclude e riporta a parte la scheda che un utente ha creato per sé stesso (`professionista_id` = il suo uid, 70 casi: i professionisti che si misurano da soli), che `ensure_client_bridge` già saltava: senza questo restava nel conteggio a ogni esecuzione.
- **E**: le schede create in serie collidevano sull'id epoch-millis (`clients_pkey`, un errore su 3 nel primo giro): `link_client_to_professional` ora avanza l'id di 1 ms finché è libero.
- **F** non collega mai le schede agganciate dal blocco D, nemmeno in una riesecuzione successiva (controllo su `admin_audit_log` `repair_D_ponte_costruito`): un ponte costruito per email non è un consenso del cliente; restano nella vista salute come `scheda_con_ponte_senza_link` e si collegano dal pannello.
- Ogni blocco applicato logga in `admin_audit_log` (A, A2, B, C per gruppo, D per email, E/F/G per link, H).

| Blocco | Cosa fa | Anteprima 12/09 | Applicazione (locale) |
|---|---|---|---|
| A_link_duplicati_revocati | link vivi doppi per la stessa coppia: revoca i più vecchi, poi crea `uq_client_professional_active` | **8** | 8 |
| A2_client_id_allineato | `client_id` legacy NULL → `= client_user_id`, una riga per coppia | **104** | 104 |
| A2_report_client_id_legacy_diverso | `client_id` valorizzato e diverso da `client_user_id`: solo report | **0** | 0 |
| B_link_profilo_inesistente_revocati | link active il cui profilo cliente è stato cancellato: revocati | **2** | 2 |
| C_schede_duplicate_unite | schede duplicate stessa persona (stessa email, stesso nome, stesso professionista): unite con `admin_merge_clients` nella scheda col ponte o con più sessioni | **15** | 15 (0 conflitti, 0 monitoraggi da spostare) |
| C_schede_duplicate_da_decidere_a_mano | stessa email ma nomi diversi: NON toccate (pulsante Unisci nel pannello) | **6** | 6 |
| D_ponte_costruito | email con scheda senza ponte e un solo profilo client: ponte scritto (una scheda per professionista) | **15** | **5** (10 sono i doppioni che C unisce nella scheda col ponte) |
| D_report_scheda_di_se_stesso | scheda con l'email del professionista stesso: solo report | 70 | 69 |
| D_ponte_ambiguo_piu_profili | email con più profili client: saltate | **0** | 0 |
| E_link_senza_scheda_riparati | link active senza scheda: scheda creata (id epoch, ponte) | **3** | 3 |
| F_ponte_senza_link_collegati | schede che avevano già il ponte ma nessun link mai esistito: collegate | **0** (Sara collegata l'11/09) | 0 |
| G_sessioni_remote_invisibili_report | sessioni remote di utenti senza link: solo report, con il professionista candidato | **63** (8 utenti) | 63 |
| G_link_confermati_a_mano | coppie inserite in `collegamenti_riparazione_link_ok`: collegate | **0** | 0 |
| H_analytics_riallineati | measurement_analytics.client_id riallineato alla sessione | **58** | 58 |
| I_report_analytics_senza_sessione | righe di measurement_analytics senza sessione: solo report | **608** | 608 |
| I_report_ponte_ruolo_non_client | ponte verso un profilo non client: solo report | **1** | 1 |
| I_report_pending_vecchi | pending oltre 30 giorni: solo report | **0** | 0 |

Vista salute prima della 022 (dati 12/09): scheda_duplicata 21, profilo_client_orfano 19, sessioni_remote_senza_link 8, ponte_mancante 6, link_duplicato 4, analytics_disallineato 4, link_senza_scheda 3, link_profilo_inesistente 2, ponte_ruolo_errato 1. **Dopo l'applicazione**: profilo_client_orfano 17, sessioni_remote_senza_link 8 (G, da confermare), scheda_duplicata 6 (i gruppi a mano), scheda_con_ponte_senza_link 5 (le schede agganciate da D, link da confermare dal pannello: Giulia De Sanctis ↔ Alfredo Donatini, Andrea Oprandi ↔ info@massimofilippi.it, Warner D'Anniballe ↔ Warner D'Anniballe e ↔ Francesco Di Donato, Marco Baldacci ↔ Gabriele Giuli), ponte_ruolo_errato 1. Tutto il resto a zero.

### C. Unioni automatiche (stessa persona) — 15

`admin_merge_clients(keep, [merge], dry_run)`: in anteprima 0 righe in conflitto e 0 righe da spostare in tutte le tabelle FK (alerts, client_notes, client_settings, messages, sessions) e soft (measurement_analytics, links, monitoring_sessions): le schede unite sono vuote, doppioni creati dal form dell'app.

| Professionista | Email | Tiene | Unisce (cancellata) |
|---|---|---|---|
| Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | davide.calse@gmail.com | `1782392763574` Davide Caltran | `1783084859522` Davide Caltran |
| Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | sassabert00@gmail.com | `1782403707747` Sara Bertoldo | `1784377042569` Sara Bertoldo |
| info@massimofilippi.it | alessandro.mazzocchi@hotmail.it | `1776875556855` Alessandro Mazzocchi | `1783872783145` Alessandro Mazzocchi |
| info@massimofilippi.it | eleonora.menin95@gmail.com | `1779551610050` Eleonora Menin | `1779628653721` Eleonora Menin |
| info@massimofilippi.it | gianandreapazzini@gmail.com | `1779535113786` Gianandrea Pazzini | `1782895788075` Gian Andrea Pazzini |
| info@massimofilippi.it | martinazanchini@gmail.com | `1782304040156` Martina Zanchini | `1784205492563` Martina Zanchini |
| info@massimofilippi.it | saraspadoni@yahoo.it | `1788354294664` Sara Spadoni | `e0892ecb-080e-43a8-b804-8059a391ac74` Sara Spadoni |
| Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | antonella.sanguineti60@gmail.com | `1784101296413` Antonella Sanguineti | `1784101455689` Antonella Sanguineti |
| Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | barbiegrosso69@gmail.com | `1783969578721` Barbara Grosso | `1783969800720` Barbara Grosso |
| Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | camilla3297sarbia@gmail.com | `1783970945749` Camilla Sarbia | `1783971084856` Camilla Sarbia |
| Elisabetta Sacchi <elisabetta.sacchi@gmail.com> | mercedes.cristina62@gmail.com | `1788948933917` Cristina Migone | `1788948932379` Cristina Migone |
| Massimo Milanese <massimo.milanesekc@gmail.com> | igig24@alice.it | `1787294882170` Irene Gigante | `1788159842222` Irene Gigante |
| Massimo Milanese <massimo.milanesekc@gmail.com> | martinawaddell@icloud.com | `1784492796734` Martina Waddell | `1788677380749` Martina Waddell |
| Massimo Milanese <massimo.milanesekc@gmail.com> | massimo.milanesekc@gmail.com | `1778839106151` Massimo Milanese | `1784442665027` Massimo Milanese |
| DRAGOLJUB VUJANOVIC <ecospirito@gmail.com> | mondoeventi11@gmail.com | `1778961284515` Jelena Vujanovic | `1778959095174` Jelena Vujanovic |

### C. Da decidere a mano (stessa email, persone diverse) — 6

| Professionista | Email | Schede |
|---|---|---|
| Liga Briviba <ligabriviba@gmail.com> | ligabriviba@gmail.com | `1778854627818` Liga Briviba; `1779102200806` Armando Benini; `1779296566435` Angelo Magrì; `1779635515733` Ciro Pennacchia; `1779727304558` Jenny Spinella |
| Salvatore Tesauro <planetex@virgilio.it> | planetex@virgilio.it | `1783694845578` Salvatore Tesauro; `1784615870112` Sabrina Danieli |
| Gian Luca Dettori <gluca.dettori@gmail.com> | breil69@hotmail.com | `1784318534609` Antonella Paddeu; `1784319603599` Manuela concas |
| Gian Luca Dettori <gluca.dettori@gmail.com> | gluca.dettori@gmail.com | `1784063548747` Gian Luca Dettori; `1786810446358` Mamma Mamma |
| Nicolò Maragni <nicolo.maragni@gmail.com> | nicolo.maragni@gmail.com | `1786945443322` Nicolo Maragni; `1787248314292` Ginevra Maragni |
| Alex Spirandelli <alex.spirandelli7@gmail.com> | alex.spirandelli7@gmail.com | `1783974033108` Alex Spirandelli; `1784220589177` Nicola Spirandelli |

### D. Ponti da costruire — 15 in anteprima, 5 in applicazione

Le 10 email segnate con * sono doppioni che C unisce nella scheda col ponte: in applicazione non serve più costruire il ponte.

| Email | Scheda (professionista) |
|---|---|
| alessandra6.redaelli@gmail.com | `1783091621238` Alessandra Redaelli (info@motionpiacenza.it) — link pending |
| alessandro.mazzocchi@hotmail.it * | `1783872783145` (info@massimofilippi.it) |
| andreaoprandipc@gmail.com | `1779556889678` Andrea Oprandi (info@massimofilippi.it) |
| antonella.sanguineti60@gmail.com * | `1784101455689` (elisabetta.sacchi@gmail.com) |
| barbiegrosso69@gmail.com * | `1783969800720` (elisabetta.sacchi@gmail.com) |
| camilla3297sarbia@gmail.com * | `1783971084856` (elisabetta.sacchi@gmail.com) |
| davide.calse@gmail.com * | `1783084859522` (mastrotto.riccardo@gmail.com) |
| gianandreapazzini@gmail.com * | `1782895788075` (info@massimofilippi.it) |
| marco.baldacci62@gmail.com | `1784552955137` Marco Baldacci (gabriele_06@hotmail.it) |
| martinazanchini@gmail.com * | `1784205492563` (info@massimofilippi.it) |
| mercedes.cristina62@gmail.com * | `1788948932379` (elisabetta.sacchi@gmail.com) |
| saraspadoni@yahoo.it * | `e0892ecb-…` (info@massimofilippi.it) |
| sassabert00@gmail.com * | `1784377042569` (mastrotto.riccardo@gmail.com) |
| veneziagiulia97@gmail.com | `1781963548004` GIULIA DE SANCTIS (alfdonatini@gmail.com) |
| warnerfisio@gmail.com | `1783692220045` Warner D'anniballe (didonatofrancesco69@gmail.com); `1784103544616` Warner D'Anniballe (warnerfisiovisite@gmail.com) |

Osvaldo Lautieri (`1778850227402`, professionista_id = il suo stesso uid) non è più in D: è una scheda di sé stesso, riportata in `D_report_scheda_di_se_stesso` e già esclusa dalla vista salute.

### E. Link active senza scheda (scheda da creare) — 3

In applicazione locale le tre schede nascono con id epoch consecutivi (`1789191999503`, `…505`, `…506`), ponte e `client_id = client_user_id` sul link (`action: already_active`, `card_action: created`).

| Cliente | Professionista | Link |
|---|---|---|
| Davide Caltran <davide.calse@gmail.con> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | `29159753` |
| Andrea Oprandi <andreaoprandipc@gmail.com> | Gabriele Giuli <gabriele_06@hotmail.it> | `9002d3de` |
| Maria Teresa Alaia <mariateresa_alaia@yahoo.com> | Andrea Ponghetti <a.ponghetti@gmail.com> | `4f935031` (nuovo, 12/09) |

### B. Link con profilo cancellato (da revocare)

| Link | client_user_id | Professionista |
|---|---|---|
| `a1984e34` | `455cca2a-695a-469a-8be4-4123bd631431` | info@massimofilippi.it |
| `0e786321` | `a740ec91-8475-4b3f-95cf-38383c52646b` | Alessandro Verraz <alessandroverraz@gmail.com> |

### F. Scheda con ponte e nessun link (collegamento da creare) — 0

L'unico caso dell'11 settembre (`1788354294664` Sara Spadoni ↔ info@massimofilippi.it) è stato collegato dal pannello l'11 settembre alle 13:46 UTC. Le 5 schede che ricevono il ponte dal blocco D **non** vengono collegate da F (né ora né in una riesecuzione): compaiono nella vista salute come `scheda_con_ponte_senza_link` e il collegamento si conferma dal pannello.

### A. Link doppi da revocare (resta l'active più recente)

| Link | Cliente | Professionista | Stato | Creato |
|---|---|---|---|---|
| `8d41412f` | Nicola Caleo <timer-02@hotmail.it> | Jessica Possamai <dott.jessicapossamai@gmail.com> | active | 2026-09-09 |
| `c9bfdcbc` | Andrea Porrini <andrea.porrinimoda@gmail.com> | Viviana anessi <viviana.anessi40@gmail.com> | active | 2026-07-10 |
| `b3ac2681` | Sara Bertoldo <sassabert00@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | active | 2026-07-04 |
| `1ecdce13` | Sara Bertoldo <sassabert00@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | active | 2026-07-02 |
| `c231dbca` | Sara Bertoldo <sassabert00@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | active | 2026-06-25 |
| `3c71fe0a` | Mirko Sartori <mirko1sartori@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | active | 2026-08-02 |
| `c9a6c049` | Mirko Sartori <mirko1sartori@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | active | 2026-07-19 |
| `b228b552` | Mirko Sartori <mirko1sartori@gmail.com> | Riccardo Mastrotto <mastrotto.riccardo@gmail.com> | active | 2026-07-18 |

### G. Le 63 sessioni remote invisibili, una per una (61 l'11/09: +1 Bart Sileghem 12/09, +1 Paolo Terenziani 11/09)

Nessuna modifica automatica: sono misurazioni fatte dal cliente sulla sua app (`sessions.professionista_id` = suo uid, `client_id` NULL) e l'utente non ha nessun link active, quindi nessun professionista le vede. Per ogni utente: il professionista a cui **verrebbero attribuite** è quello con una scheda con la stessa email (colonna *Candidato*); dove non c'è nessuna scheda con quell'email non esiste un candidato certo e la riga resta ferma finché non decidi tu (gli *Indizi* elencano link revocati/pending, schede con lo stesso nome, il `client_nome` scritto nelle sessioni). Per attribuire, inserisci la coppia in `collegamenti_riparazione_link_ok` e riesegui la 022 in applicazione, oppure usa il pulsante nella tab Salute collegamenti:

```sql
insert into public.collegamenti_riparazione_link_ok (client_user_id, professional_id, note)
values ('<client_user_id>', '<professional_id>', 'confermato a mano');
```

| # | Utente | Ruolo / registrato | Sessioni | Candidato (scheda con la stessa email) | Indizi |
|---|---|---|---|---|---|
| 1 | Beppino Simeon <simeonbeppino@yahoo.it> `1479bc2f-0477-4cc4-b268-3dda5bcd7184` | client / 2026-06-19 | 31 | **nessuno** | — |
| 2 | Bart Sileghem <bartsileghem@gmail.com> `b87ee9c6-dec9-46b5-a954-7cce30c1beb7` | client / 2026-09-04 | 14 (ultima 12/09) | **nessuno** | — |
| 3 | Osvaldo Lautieri <olautieri@gmail.com> `40164cd1-450c-41a0-b5b8-cf043b526cac` | client / 2026-05-15 | 4 | **nessuno** | ha 2 schede proprie (ha usato l'app come professionista) |
| 4 | Federico Casadei <f.casadey@gmail.com> `13d9baae-d3b0-4694-a467-f4dd5541e52a` | client / 2026-06-17 | 4 | **nessuno** | — |
| 5 | Giulia De Sanctis <veneziagiulia97@gmail.com> `8e3974ec-628b-44d1-ba24-ccc75759c2ad` | client / 2026-06-19 | 3 | scheda `1781963548004` stessa email presso Alfredo Donatini <alfdonatini@gmail.com> | — |
| 6 | Daniela Raus <raus.dana@yahoo.com> `6c204ae8-e463-4d71-b652-f6197ece346c` | client / 2026-05-20 | 2 | **nessuno** | — |
| 7 | Roberto Bocca <boush1967@gmail.com> `54d6bc24-d790-4a65-a013-2e3d2b238c4f` | client / 2026-06-18 | 2 | **nessuno** | — |
| 8 | Paolo Terenziani <terenzio@ngi.it> `59baf234-4791-432d-82d8-c1bca4a61ded` | client / 2026-08-17 | 3 (ultima 11/09) | **nessuno** | scheda `1784286930004` stesso nome (email terenziani@ngi.it) presso info@massimofilippi.it |

Elenco delle singole sessioni (data, durata, tipo):

| Utente | Sessione | Data | Durata | Tipo |
|---|---|---|---|---|
| Beppino Simeon | `17821966` | 2026-06-23 08:37 | — | standard |
| Beppino Simeon | `17822816` | 2026-06-24 08:13 | — | standard |
| Beppino Simeon | `17822829` | 2026-06-24 08:35 | — | standard |
| Beppino Simeon | `17822840` | 2026-06-24 08:53 | — | standard |
| Beppino Simeon | `17823716` | 2026-06-25 09:14 | — | standard |
| Beppino Simeon | `17824550` | 2026-06-26 08:24 | — | standard |
| Beppino Simeon | `17825441` | 2026-06-27 09:09 | — | standard |
| Beppino Simeon | `17826310` | 2026-06-28 09:17 | — | standard |
| Beppino Simeon | `17827157` | 2026-06-29 08:49 | — | standard |
| Beppino Simeon | `17828055` | 2026-06-30 09:45 | — | standard |
| Beppino Simeon | `17828891` | 2026-07-01 08:58 | — | standard |
| Beppino Simeon | `17828896` | 2026-07-01 09:07 | — | standard |
| Beppino Simeon | `17829738` | 2026-07-02 08:31 | — | standard |
| Beppino Simeon | `17832286` | 2026-07-05 07:16 | — | standard |
| Beppino Simeon | `17840115` | 2026-07-14 08:45 | — | standard |
| Beppino Simeon | `17840974` | 2026-07-15 08:38 | — | standard |
| Beppino Simeon | `17841831` | 2026-07-16 08:25 | — | standard |
| Beppino Simeon | `17842717` | 2026-07-17 09:02 | — | standard |
| Beppino Simeon | `17843571` | 2026-07-18 08:46 | — | standard |
| Beppino Simeon | `17845259` | 2026-07-20 07:38 | — | standard |
| Beppino Simeon | `17846175` | 2026-07-21 09:05 | — | standard |
| Beppino Simeon | `17847869` | 2026-07-23 08:08 | — | standard |
| Beppino Simeon | `17850518` | 2026-07-26 09:43 | — | standard |
| Beppino Simeon | `17851343` | 2026-07-27 08:39 | — | standard |
| Beppino Simeon | `17852221` | 2026-07-28 09:02 | — | standard |
| Beppino Simeon | `17853080` | 2026-07-29 08:54 | — | standard |
| Beppino Simeon | `17853952` | 2026-07-30 09:06 | — | standard |
| Beppino Simeon | `17854845` | 2026-07-31 09:56 | — | standard |
| Beppino Simeon | `17855665` | 2026-08-01 08:42 | — | standard |
| Beppino Simeon | `17860841` | 2026-08-07 08:29 | — | standard |
| Beppino Simeon | `17863423` | 2026-08-10 08:12 | — | standard |
| Bart Sileghem | `17885044` | 2026-09-04 08:47 | — | standard |
| Bart Sileghem | `17885370` | 2026-09-04 17:50 | — | standard |
| Bart Sileghem | `17885854` | 2026-09-05 07:17 | — | standard |
| Bart Sileghem | `17885859` | 2026-09-05 07:25 | — | standard |
| Bart Sileghem | `17886276` | 2026-09-05 19:00 | — | standard |
| Bart Sileghem | `17886840` | 2026-09-06 10:40 | — | standard |
| Bart Sileghem | `17887088` | 2026-09-06 17:34 | — | standard |
| Bart Sileghem | `17887147` | 2026-09-06 19:13 | — | standard |
| Bart Sileghem | `17887548` | 2026-09-07 06:21 | — | standard |
| Bart Sileghem | `17888405` | 2026-09-08 06:08 | — | standard |
| Bart Sileghem | `17889315` | 2026-09-09 07:26 | — | standard |
| Bart Sileghem | `17891042` | 2026-09-11 07:24 | — | standard |
| Bart Sileghem | `17891065` | 2026-09-11 08:02 | — | standard |
| Osvaldo Lautieri | `17788388` | 2026-05-15 11:54 | — | standard |
| Osvaldo Lautieri | `17789144` | 2026-05-16 08:54 | — | standard |
| Osvaldo Lautieri | `17789282` | 2026-05-16 12:43 | — | standard |
| Osvaldo Lautieri | `17793812` | 2026-05-21 18:33 | — | standard |
| Federico Casadei | `17827530` | 2026-06-29 19:10 | — | standard |
| Federico Casadei | `17831789` | 2026-07-04 17:29 | — | standard |
| Federico Casadei | `17832413` | 2026-07-05 10:48 | — | standard |
| Federico Casadei | `17832434` | 2026-07-05 11:24 | — | standard |
| Giulia De Sanctis | `17827506` | 2026-06-29 18:30 | — | standard |
| Giulia De Sanctis | `17827511` | 2026-06-29 18:39 | — | standard |
| Giulia De Sanctis | `17857884` | 2026-08-03 22:21 | — | standard |
| Daniela Raus | `17803178` | 2026-06-01 14:44 | — | standard |
| Daniela Raus | `17815128` | 2026-06-15 10:41 | — | standard |
| Roberto Bocca | `17868593` | 2026-08-16 07:49 | — | standard |
| Roberto Bocca | `17869436` | 2026-08-17 07:14 | — | standard |
| Paolo Terenziani | `17869522` | 2026-08-17 09:37 | — | standard |
| Paolo Terenziani | `17871288` | 2026-08-19 10:40 | — | standard |

### H. measurement_analytics da riallineare: 58 righe

Gruppi: 1778435728417→1778869925505: 38, 1781353689443→1781200000000: 2, None→1783917628964: 17, None→1786945842116: 1.

## 4. Flusso unico (FASE 4): `supabase-migrations/019_collegamenti_flusso_unico.sql`

Testata su Postgres 16 locale con i dati dell'11 settembre (scenari T1–T9: Sara, doppioni con sessioni, riattivazione, trigger su pending→active, ponte da profilo nuovo, profilo inesistente, RLS scheda archiviata, due professionisti). Idempotente.

### 4.1 `link_client_to_professional(p_client_user_id uuid, p_professional_id uuid, p_source text) returns jsonb` — SECURITY DEFINER

1. Valida: profili esistenti, cliente ≠ professionista.
2. **Scheda, in quest'ordine** (= passi 0, 1, 2, 3 del trigger reale, con il passo 1 corretto): (a) `clients.client_user_id = utente` già valorizzato sotto quel professionista (passo 0); le altre schede non ponteggiate con la stessa email **e lo stesso nome** vengono unite in essa; (b) per **email** (passo 1): se le schede sono più di una ne tiene **una sola**, scelta in modo deterministico: prima quella con il nome del profilo, poi quella con **più sessioni**, a parità la più vecchia (id epoch, poi `created_at`); le altre con lo stesso nome (o senza nome) vengono archiviate con `merged_into_client_id` e loggate in `clients_merge_log`, quelle con un nome diverso restano dove sono (vista salute: `scheda_duplicata`); (c) per nome+cognome se il profilo non ha email (passo 2); (d) altrimenti crea la scheda con id epoch-millis e `created_at = now()` (passo 3), avanzando l'id di 1 ms se è già occupato. Il confronto dei nomi usa `collegamenti_nome_norm(nome, cognome)` (minuscolo, solo lettere e cifre).
3. Scrive il ponte sulla scheda tenuta. Se la scrittura viola `uq_clients_prof_client_user` o qualunque altra cosa fallisce: **nessun link viene creato**, la funzione risponde `{ok:false, error, sqlstate}`.
4. **Link**: `active` esistente → `already_active`; `pending`/`revoked` → riattivato; altrimenti insert. Gli altri link vivi della stessa coppia vengono revocati (mai più due vivi).
5. Il trigger è disattivato durante la funzione (`collegamenti.skip_trigger`), così non si rientra.
6. Risposta: `{ok, client_id, card_action, link_id, link_status, action, merged[], warnings[], source}`.

`link_client_to_professional_guarded(uuid, uuid, text)`: stessa cosa ma `auth.uid()` deve essere uno dei due: è quella che l'app può chiamare direttamente (§4.6).

`collegamenti_merge_card(p_keep_id, p_merge_id, p_reason, p_performed_by)`: unione "morbida" di una scheda nell'altra. Sposta tutte le FK verso `clients` (scoperte da `pg_constraint`) più i riferimenti soft `measurement_analytics.client_id` e `monitoring_sessions.client_id` (non `client_professional_links.client_id`, che contiene uid utente); in caso di conflitto di unicità la riga doppia viene cancellata con snapshot nel log; la scheda unita resta in tabella con `merged_into_client_id` e `client_user_id = null` (così non viola l'indice), la scheda tenuta viene arricchita con i campi mancanti. Usata dalla funzione e dal modale "Unisci" del pannello. **La 022 non la usa**: il blocco C passa da `admin_merge_clients` (017), vedi §3 per le differenze.

### 4.2 `ensure_client_bridge(p_email text)` + trigger su `profiles`

Per ogni professionista che ha schede con quell'email e nessuna col ponte: unisce gli eventuali doppioni non ponteggiati e scrive `client_user_id`. Richiede **esattamente un** profilo `client` con quell'email (con due profili non fa nulla e lo dice). Salta la scheda "di sé stesso" (`professionista_id = utente`). Il trigger `tg_profiles_ensure_client_bridge` la chiama dopo insert/update di `email, role` su `profiles` (errore → solo `warning`, mai blocca la registrazione).

### 4.3 `tg_create_client_on_active_link` riscritto

Reagisce solo alla **transizione** a `active` (insert o update da altro stato, come l'originale), salta se `collegamenti.skip_trigger = on`, delega tutto a `link_client_to_professional(..., 'trigger')`. Se questa risponde `ok:false`, o se `client_user_id` è NULL, o se scatta qualunque eccezione (`EXCEPTION WHEN OTHERS` esterno): **`raise warning`** + riga in `admin_audit_log` (`performed_by_email = 'trigger:tg_create_client_on_active_link'`, `action = 'link_trigger_failed'`, `target_id` = id del link, `details` con l'errore) e `return new`: il link **resta**, e la vista salute lo mostra come `link_senza_scheda` con il pulsante Ripara. Prima della 019 lo stesso errore annullava il link in silenzio (Sara). Il vecchio `UPDATE … WHERE lower(email) = …` che colpiva più schede non esiste più. La copia nel repo dell'app (`supabase/migrations/client_crm_autocreate_on_link.sql`) è stata svuotata il 12 settembre (commit 2453baf) e rimanda a questa migrazione.

### 4.4 Edge Function e route admin

- **`supabase/functions/create-client-access/index.ts`** (nuova versione, in questo repo): invito → profilo → `link_client_to_professional(userId, pro, 'edge:invite')`. Se l'email esiste già (`email_exists`) risolve l'utente (profilo per email, poi elenco auth) e collega lo stesso (`'edge:existing'`). Se la RPC risponde `ok:false` la funzione risponde **500 `{ok:false, code:'link_failed', message, rpc, rollback}`**: il messaggio è quello del database e il campo `rollback` dice se profilo e utente creati in quella chiamata sono stati davvero eliminati (`rollback INCOMPLETO: …` altrimenti). Deploy, quando decidi tu: `supabase functions deploy create-client-access --project-ref ivwmjwukpeldbqkxgvvf`. La copia in `hrv_app/supabase/functions/create-client-access` va rimossa.
- **`POST /api/admin/links` "Collega scheda"**: risolve l'account dal ponte o dall'email (solo profili `client`), rifiuta schede archiviate o di un altro professionista, chiama la RPC; non scrive più `client_professional_links.client_id`.
- **`POST /api/admin/clients`**: la scheda nasce con **id epoch** (`String(Date.now())`, come l'app: i vecchi id uuid non erano mai caricati dall'app) e ponte; il link passa dalla RPC.
- **`POST /api/admin/links/manual`**: RPC. **`POST /api/admin/clients/merge`**: anteprima con `admin_merge_clients` (dry run), esecuzione con `collegamenti_merge_card` (unione morbida e log; ricade sulla 017 se la 019 non è applicata).
- Helper condiviso `src/lib/collegamenti.ts` (`linkViaRpc`, `resolveClientUserId`, `nextClientCardId`).

### 4.5 Viste del sito e sessioni remote

| Vista | Prima | Ora |
|---|---|---|
| Scheda cliente (panoramica, misurazioni, analytics, export, PDF singolo) | remote incluse | invariato (RPC 019 esclude le schede archiviate) |
| **Report PDF periodico** `/api/client-report` | solo `sessions.client_id = scheda`: cliente "solo app" → report vuoto | + RPC `get_linked_client_sessions_by_client_id`, filtrate sul periodo, dedup per id |
| **Lista clienti, colonna Stress** | solo `measurement_analytics` dello studio | + `get_linked_clients_last_remote_analytics()`; vince la più recente |
| Lista clienti, ultima misurazione | remote incluse | invariato |
| **Super Admin "Vedi sessioni"** di un cliente | passava da `links.client_id` (sempre null) → `[]` | schede per ponte + sessioni remote (`remote: true`, attribuite ai professionisti collegati o "invisibile") |
| Analytics studio, home "oggi", trend 365 gg | solo studio | invariato: sono aggregati **dello studio**, per scelta; documentato qui |

### 4.6 Modifiche da fare nell'app (`hrv_app`, non toccato)

1. **Controllo doppioni** in `client_form_screen.dart` / `ClientService.saveClient`: oggi **non c'è nessun controllo per email**, né sulla cache locale né sul database (verificato: nessun confronto sull'email prima di `saveClient`). Prima di salvare una scheda nuova con email: cercare nella cache locale (`loadAllClients`) **e** su `clients` (`professionista_id = uid and lower(email) = …`, la RLS lo permette); se esiste, proporre di aprire quella scheda invece di crearne un'altra.
2. **`created_at` in ora locale**: la versione rilasciata scrive `dataCreazione.toIso8601String()` senza fuso (509 schede con +2h). Il fix `toUtc()` (`sync_service.dart`, commit 968a039) è nel repo ma non rilasciato: va rilasciato; per le 509 righe esistenti serve un `update clients set created_at = created_at - interval '2 hours' where id ~ '^[0-9]+$' and created_at > to_timestamp(id::bigint/1000) + interval '1 hour'` (da valutare a parte, non incluso nella 022).
3. **`downloadClients`** (`sync_service.dart` 330-363): filtrare `merged_into_client_id is null` (la policy restrictive lo fa già lato server, ma il filtro esplicito evita sorprese se la policy cambia) e non usare `replaceAll` mentre una sync di scrittura è in coda (race: la scheda appena creata sparisce fino al prossimo download).
4. **`resolveClientSessionTarget`** (`professional_link_service.dart` 163-249): risolvere la scheda prima per `clients.client_user_id = uid` (via RPC `get_linked_client_profile` o una select con la nuova policy), poi per email; ricalcolare quando cambia un link, non solo al login.
5. **`requestLink` / `acceptRequest` / `autoLinkOnClientLogin`**: `autoLinkOnClientLogin` va rimosso (non può funzionare per RLS, e crea link active senza consenso). `acceptRequest` può restare (UPDATE active → trigger → funzione) oppure chiamare `link_client_to_professional_guarded(uid_cliente, uid_pro, 'app:accept')` e gestire `ok:false` mostrando `error`. Dopo l'invito via Edge Function, fare `downloadClients` (la scheda può essere stata unita/agganciata).
6. **Edge Function**: rimuovere `hrv_app/supabase/functions/create-client-access` (la versione buona vive nel repo del sito); `client_access_service.dart` deve trattare `code: 'link_failed'` e mostrare `message`; `emailExists` non è più un esito (la EF collega comunque).
7. **Migrazioni nel repo app**: ~~`client_crm_autocreate_on_link.sql` (vecchio trigger) e `client_professional_links_unique.sql` (mai applicata) vanno tolte o marcate "sostituite da stressindex-site 019/022"; `sessions_client_assignment.sql` è sostituita dalla variante `_text` della 019.~~ **Fatto** il 12 settembre (commit 2453baf dell'app: i tre file sono svuotati e rimandano alla 019/022).
8. `client_email_aliases`: non usata da nessuno; può essere eliminata.

## 5. Controllo permanente (FASE 5): `supabase-migrations/020_collegamenti_salute.sql`

### 5.1 View `v_collegamenti_salute`

Una riga per problema, colonne `tipo_problema, gravita, client_id, client_user_id, professional_id, link_id, email, nome, professionista, dettaglio, fix_proposto, fix_auto, fix_rpc, fix_args`. Tipi: `scheda_duplicata` (2.1), `ponte_mancante` (2.2, esclusa la scheda di sé stesso), `ponte_ruolo_errato` (2.3), `link_senza_scheda` / `link_profilo_inesistente` (2.4), `pending_vecchio` (2.5), `link_duplicato` (2.6), `sessioni_remote_senza_link` (2.8, con i professionisti candidati in `fix_args.candidati`), `profilo_client_orfano` (2.10), `scheda_con_ponte_senza_link` (scheda agganciata a un utente che non ha mai avuto un link con quel pro: il caso Sara), `analytics_disallineato` (2.13), `monitoraggio_incoerente` (2.14). Grant solo alla service role. `collegamenti_salute_counts()` restituisce i conteggi per tipo.

Sui dati del 12 settembre, prima della riparazione: scheda_duplicata 21, profilo_client_orfano 19, sessioni_remote_senza_link 8, ponte_mancante 6, link_duplicato 4, analytics_disallineato 4 (sessioni), link_senza_scheda 3, link_profilo_inesistente 2, ponte_ruolo_errato 1. Dopo la 022 in locale: profilo_client_orfano 17, sessioni_remote_senza_link 8, scheda_con_ponte_senza_link 5 (le schede ponteggiate dal blocco D, il cui link va confermato a mano), scheda_duplicata 6 (nomi diversi, da decidere), ponte_ruolo_errato 1; tutto il resto a zero.

### 5.2 Tab "Salute collegamenti" nel pannello Super Admin

`src/app/area-professionisti/professionisti/SaluteTab.tsx`, route `GET/POST /api/admin/collegamenti`. Conteggi per tipo (cliccabili come filtro), lista con cliente, professionista, dettaglio e fix proposto. Azioni, tutte con `ConfirmDialog` e riga in `admin_audit_log`: **Ripara** (`ensure_client_bridge`, `link_client_to_professional`, revoca link con profilo cancellato, riallineamento analytics), **Unisci** (apre `MergeClientsModal` sulle sole schede del doppione: anteprima, poi unione morbida), **Collega a <professionista>** per le sessioni remote invisibili con una scheda candidata, **Esegui controllo ora**. Il badge sulla tab è rosso quando c'è un alert aperto.

### 5.3 Job settimanale

`admin_alerts (kind, total, details, created_at, resolved_at)` + `collegamenti_salute_check()`: un solo alert aperto per tipo, aggiornato se cambiano i numeri, chiuso quando torna a zero. `pg_cron` `collegamenti_salute_weekly`, lunedì 07:00 UTC (se l'estensione non è attiva la migrazione lo segnala con un `notice` e il controllo resta manuale dal pannello).

## 6. Ordine di applicazione (niente è stato eseguito sul database)

1. `supabase-migrations/019_collegamenti_flusso_unico.sql` (funzioni, trigger, policy, RPC).
2. `supabase-migrations/020_collegamenti_salute.sql` (view, alert, cron).
3. `supabase-migrations/021_collegamenti_backup.sql` (tabelle `*_backup_YYYYMMDD`).
4. `supabase-migrations/022_collegamenti_riparazione.sql` **in anteprima** (così com'è): leggere `collegamenti_riparazione_log` e confrontare con §3.
5. Eventuali coppie confermate in `collegamenti_riparazione_link_ok` (§3.G).
6. Stessa sessione SQL: `select set_config('collegamenti.apply','on',false);` poi di nuovo la 022. Rieseguibile.
7. `notify pgrst, 'reload schema';` poi deploy del sito e della Edge Function.
8. App: modifiche di §4.6 e rilascio.

Ripristino: le tabelle di backup della 021 (le schede unite dal blocco C sono **cancellate** da `admin_merge_clients`: si ripristinano da `clients_backup_20260912`) e `clients_merge_log` (snapshot delle unioni morbide) bastano a tornare indietro; esempi nell'intestazione della 021. Ogni riparazione applicata è in `admin_audit_log` con `performed_by_email = 'migration:022'`.

## 7. Baseline e accessi: cosa NON cambia (verifica E)

`hrv_puo_accedere(p_user_id)` (app, `client_baselines.sql`) concede l'accesso se `auth.uid() = p_user_id`, oppure `hrv_e_amministrativo()` (superadmin o sessione SQL senza JWT), oppure esiste un link `client_professional_links` con `professional_id = auth.uid()`, `client_user_id = p_user_id`, `status = 'active'`. Legge **solo** i link per `client_user_id`: non tocca `clients`, né `client_id` dei link. `client_baselines.user_id` referenzia `auth.users`, non `clients`: l'unione o la cancellazione di una scheda non può lasciare baseline orfane per costruzione.

Verifica sulla copia locale (funzioni dell'app installate tali e quali): per tutte le coppie (professionista con almeno un link, utente con baseline o con sessioni remote) — 2871 coppie — il valore di `hrv_puo_accedere` è **identico prima e dopo** 019 + 022 (22 coppie a `true` in entrambi i casi). `client_baselines`: 51 righe, 38 utenti, stesso hash di `(id, user_id, attiva, creata_il)` prima e dopo; 0 righe con `user_id` senza profilo. La dedup del blocco A tiene per ogni coppia l'`active` più recente e revoca gli altri, quindi nessuna coppia perde l'accesso; il blocco B revoca solo link il cui utente non esiste più (nessuna baseline possibile). 019 e 022 non ridefiniscono `hrv_puo_accedere`, `hrv_e_amministrativo` né le funzioni baseline.

## Verifiche SQL da eseguire (catalogo: 1.2, 1.3, 1.4, 2.6 chiuse il 12/09; 2.9 aperta)

> Le risposte alle prime quattro sono state riferite il 12 settembre e sono recepite in §1.2–1.4 e §2.6 (l'output grezzo non è nel documento: restano da confermare `cmd` e `roles` delle policy `professional_reads_linked_client_*`). La 2.9 (RPC eseguita come professionista) non è ancora stata fatta.

La service role permette solo tabelle e RPC via PostgREST: i testi reali di trigger, funzioni, policy e indici non sono leggibili da lì. Eseguire nel SQL Editor (o via `psql` con la connection string) e incollare l'output nel documento:

```sql
-- 1.2 trigger reali sulle tabelle del collegamento
select c.relname as tabella, t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal
  and c.relname in ('profiles','clients','client_professional_links','sessions','measurement_analytics','monitoring_sessions')
order by 1,2;

-- 1.2/1.3 testo reale delle funzioni
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('tg_create_client_on_active_link','get_linked_client_sessions_by_client_id',
    'get_linked_client_sessions_by_email','get_linked_clients_last_remote_session',
    'get_linked_client_monitoring_sessions_by_client_id','find_linked_client_user_id_by_email',
    'get_pending_link_requests','get_linked_client_profile','lookup_professional',
    'client_can_assign_session','is_superadmin','hrv_puo_accedere','monitoring_can_access',
    'sync_session_to_measurement_analytics','update_client_last_measurement',
    'admin_merge_clients','admin_data_health');

-- 1.4 policy reali
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename in ('profiles','clients','client_professional_links','sessions','measurement_analytics','monitoring_sessions')
order by 1,2;

-- 2.6 indici reali (atteso: uq_client_professional_active ASSENTE, uq_clients_prof_client_user presente)
select tablename, indexname, indexdef from pg_indexes
where tablename in ('clients','client_professional_links') order by 1,2;

-- 2.9 la RPC come la vede un professionista (sostituire l'uuid del pro e l'id della scheda)
-- set role authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid-pro>","role":"authenticated"}', true);
-- select count(*) from get_linked_client_sessions_by_client_id('<id-scheda>');
```
