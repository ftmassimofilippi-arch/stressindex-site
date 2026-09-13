# Gestione commerciale degli account (migration 024)

Stato dell'account, abbonamenti con scadenze, moduli per piano con eccezioni per singolo account. La decisione di accesso vive **solo nel database**; sito e app leggono il risultato.

## Modello

| Oggetto | Dove | Note |
|---|---|---|
| Stato | `account_stato` (`attivo` / `sospeso` / `bloccato`, motivo, chi, quando) | `prova` non si salva: è lo stato effettivo di chi ha il piano prova (`account_stato_effettivo`) |
| Abbonamento | `abbonamenti` (piano, data inizio, data scadenza inclusa, rinnovo automatico, note) | uno per account; `prova` richiede la scadenza |
| Storico | `abbonamenti_storico` | creazione, modifica, cambio piano, prolungamento, rinnovo automatico, scadenza |
| Catalogo | `moduli`, `piani`, `piano_moduli` | un modulo o un piano nuovo è una riga, niente migrazioni |
| Eccezioni | `moduli_eccezioni` (abilitato sì/no, motivo, scadenza facoltativa) | sovrascrivono il piano in positivo o in negativo |
| Copia legacy | `profiles.plan` | `pro` se il piano include lo sport ed è valido; mantenuta dalle funzioni, non va scritta |

Default: Base nessun modulo · Pro Sport + Monitoraggio · Prova come Pro · Sonno sempre a parte (solo per eccezione).

### Regola di accesso (`modulo_accesso_dettaglio`, usata da `has_module_access`)

1. modulo disattivato nel catalogo → no
2. superadmin → sì
3. account sospeso o bloccato → no
4. eccezione valida (non scaduta) → quello che dice l'eccezione
5. cliente → sì se almeno un professionista con collegamento attivo ha il modulo
6. professionista → sì se il piano lo include e l'abbonamento non è scaduto

`has_module_access(user_id, module)`: chi chiama può chiedere di sé, di un account collegato (link active) o, se superadmin, di chiunque.
`my_account_access()`: stato, piano, scadenza, giorni alla scadenza, rinnovo, mappa dei moduli dell'utente loggato. Il motivo della sospensione non viene esposto.

### Effetti dello stato

- **Sospeso**: login consentito. Sito: il middleware riscrive ogni pagina dell'area professionisti su `/area-professionisti/sospeso`. DB: policy RESTRICTIVE `account_attivo_insert/update` su `clients`, `sessions`, `monitoring_sessions`, `sport_sessions` (vale anche per app non aggiornate). Nessun dato viene toccato.
- **Bloccato**: come sospeso + ban in auth (`ban_duration 876000h`): login negato, refresh token rifiutati. Il middleware chiude la sessione del sito e mostra il messaggio sul login.
- **Riattivazione**: stato `attivo` + rimozione del ban. Se l'abbonamento è scaduto il job della notte lo sospende di nuovo: prolungare prima.

### Scadenze

`commerciale_scadenze_giornaliere()`, pg_cron `commerciale_scadenze_giornaliere` alle 03:05 UTC. Per ogni abbonamento con scadenza passata (data Europe/Rome) e account non già sospeso/bloccato:
- rinnovo automatico → nuova scadenza + durata del periodo corrente (almeno 1 mese), storico `rinnovo_automatico`
- altrimenti → stato `sospeso` con motivo "Abbonamento … scaduto il …", storico `scadenza`

Il prolungamento (+1 mese, +3 mesi, +1 anno) parte dalla scadenza o da oggi se già passata, e riattiva gli account sospesi **dal job** (non quelli sospesi a mano). Avvisi a 30, 7 e 1 giorno: badge nel pannello e sezione "In scadenza" nella Panoramica; nessuna email.

### Audit

Ogni funzione `admin_*` scrive `admin_audit_log` con `performed_by`, `performed_by_email`, `created_at`, `details.prima/dopo` e `details.motivo`. Azioni: `account_status_change`, `subscription_change`, `subscription_extend`, `subscription_auto_renew`, `module_exception_change`, `auth_ban`, `auth_unban`, `change_account_email`, `change_role`. Il job scrive con `performed_by_email = 'cron:scadenze'`.

### Semina della 024 (nessun comportamento cambia)

- `profiles.plan = 'pro'` → piano pro senza scadenza; gli altri professionisti → base senza scadenza. I 4 trial di registrazione ancora in corso (scadenze 29/10, 29/10, 02/11, 09/11) restano **base** con una nota: convertirli in prova dal pannello se si vuole la sospensione a fine trial.
- Moduli già usati e non inclusi nel piano → eccezione positiva "già in uso". Al 13/09: Monitoraggio per 4 professionisti Base con monitoraggi 24h (danieladotti.coach, anto60.nava, crepaldimanuela71, elisabetta.sacchi).
- Nuovi professionisti (`commerciale_abbonamento_iniziale`, trigger su `profiles.role` e `professional_profiles`): prova fino a `trial_expires_at` se la registrazione web lo imposta, altrimenti base.

## Sito

- `src/lib/account-access.ts`: `getMyAccountAccess()` (RPC, una volta per richiesta), `hasModule`, `filterMonitoringByModules`. Senza la 024: comportamento precedente.
- Middleware: controllo dello stato a ogni richiesta dell'area professionisti.
- Sport: `getSportAccess().isPro` = modulo sport. Monitoraggio: voce di menu, indice, dettaglio, home, scheda cliente, analytics e API (`rr-csv`, eventi) filtrati per `monitoring` (24h) e `sleep` (sonno).
- Pannello Super Admin: tab **Panoramica** (attivi, in prova, in scadenza entro 30 giorni, sospesi; sezione In scadenza con prolungamento rapido), tab **Utenti** rivista (stato, piano, scadenza con badge, moduli come icone piene = piano e tratteggiate = eccezione, ultimo accesso, misurazioni; filtri stato/piano/modulo/in scadenza; azioni rapide sulla riga; dettaglio in pannello laterale con storico e attività).
- Route: `GET/POST /api/admin/users/[id]/account` (azioni `status`, `subscription`, `extend`, `module`); `/api/admin/plan` e il campo `plan` di `PATCH /api/admin/users/[id]` passano da `admin_set_subscription`.

## Modifiche da fare nell'app Flutter (`hrv_app`, non toccata)

Riferimenti di riga alla mappatura del 13/09/2026.

1. **Servizio unico `AccountAccessService`** (nuovo): chiama `rpc('my_account_access')`, espone `stato`, `piano`, `dataScadenza`, `giorniAllaScadenza`, `hasModule(String)`. Cache in SharedPreferences con `verificato_il`; offline usa la cache; errore `PGRST202` (024 non applicata) → comportamento attuale. Nessuna logica di accesso nell'app oltre a leggere questo risultato.
2. **Avvio**: `lib/screens/gdpr_aware_home.dart` `_init()` (:53–88) aspetta anche il refresh di `AccountAccessService`; in `build()` subito dopo il ramo errore ruolo (:104–106): `bloccato` → `AuthService.signOut()` e `LoginScreen` con il messaggio "Account bloccato, scrivi a support@stressindex.io"; `sospeso` → nuova `AccountSospesoScreen` (messaggio, contatto supporto, "Verifica di nuovo", Esci), senza home, clienti né misurazioni.
3. **Ritorno in foreground**: `lib/main.dart` :223–229, ricontrollo con throttle (es. 60 s).
4. **Sincronizzazione**: in testa a `SyncQueue._retryPending()` (`lib/services/sync_queue.dart` :119) e `SyncService.syncAll()` (`lib/services/sync_service.dart` :31) refresh dello stato; se `sospeso`/`bloccato` non inviare nulla, **tenere la coda** e i dati locali, portare alla schermata del punto 2. Un errore RLS `42501` con `account_attivo_insert`/`account_attivo_update` va trattato come sospensione (refresh dello stato), non come errore generico né come scarto dell'elemento.
5. **Login**: `AuthException` con messaggio che contiene `banned` → "Account bloccato".
6. **Gating Sport**: sostituire `UserRoleService.isProPlan` con `hasModule('sport')` in `lib/screens/home_screen.dart` :3264–3269 e :3462–3470 e in `lib/screens/client_form_screen.dart` :59, :196–200, :719. Non leggere più `profiles.plan` per decidere (è una copia legacy scrivibile dall'utente) e non scriverla mai; `UserRoleService.setPlan` (:170) va rimosso.
7. **Gating Monitoraggio** (`hasModule('monitoring')`): `UserRoleService.canAccessMonitoring` (:91) e le entrate oggi senza controllo: `MonitoringEntryCard` `home_screen.dart` :3034, sezione cliente :4196–4221, `NightFollowUpCard` :3053, controllo registrazioni offline Polar :343 e :367–417, `MonitoringHubScreen` → `MonitoringStartScreen` (`monitoring_hub_screen.dart` :63), `client_nights_card.dart` :59, `client_nights_section.dart` :59 (usata da `client_detail_screen.dart` :401), tile risultati `client_detail_screen.dart` :983–995, pallini notti `clients_screen.dart` :79 e :369.
8. **Gating Sonno** (`hasModule('sleep')`): `UserRoleService.canAccessSleep` (:96), `SleepEntryCard` `home_screen.dart` :4220, hub `monitoring_hub_screen.dart` :162–175 e `NightListScreen` :207, `SleepDeviceScreen`/`SleepImportScreen` (`sleep_device_screen.dart` :254).
9. **Clienti**: per un utente `client`, `my_account_access().moduli` tiene già conto dei professionisti collegati (un professionista sospeso non copre più i suoi clienti): usare la stessa `hasModule`, anche per lo Sport live del cliente (`lib/services/sport_live_service.dart` :211).
10. **`SubscriptionService` / tabella `subscriptions`**: non usata per il gating e con un bug di cast (`lib/models/subscription.dart` :37 legge `user_id`, la query filtra `professionista_id`). Smettere di caricarla (`lib/main.dart` :108, :204) e rimuoverla; la fonte è `abbonamenti` tramite `my_account_access`.
