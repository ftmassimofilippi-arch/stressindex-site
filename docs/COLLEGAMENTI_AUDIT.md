# Collegamenti cliente ↔ professionista — audit completo

> Stato al 11 settembre 2026. Repo: sito (`stressindex-site`, questo), app (`hrv_app`, sola lettura), database Supabase `ivwmjwukpeldbqkxgvvf`. Sezioni: 1 mappa del modello (in corso di scrittura, vedi commit successivi), 2 stato dei dati, 3 script di riparazione, 4 flusso unico, 5 controllo permanente.

## Stato dei dati (FASE 2)

Fotografia del **11 settembre 2026, 13:40 UTC**, letta con la service role via PostgREST (tutte le righe di `profiles`, `clients`, `client_professional_links`, `sessions`, `measurement_analytics`, `monitoring_sessions`, `professional_profiles`, `client_email_aliases`, `client_notes`, `admin_audit_log`, più `auth.users` via Auth Admin API) e rielaborata in locale. Le verifiche che richiedono il catalogo (2.6 indice, 2.9 RPC eseguita come professionista) sono emulate dal testo delle migrazioni e vanno confermate con la connessione SQL: vedi §Verifiche SQL da eseguire.

### Numeri di base

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

I 2 link con profilo inesistente vanno revocati, non riparati. Gli altri 2 (Davide Caltran con email `.con`, Andrea Oprandi ↔ Gabriele Giuli) sono da riparare con 3.3. Link active agganciati solo per fallback email/id senza ponte: 0.

### 2.5 Link pending da più di 30 giorni

**0**. L'unico pending (Alessandra Redaelli ↔ Giuseppe Piacenza) è recente.

### 2.6 Coppie duplicate non revocate

**4 coppie** cliente↔professionista hanno più di un link vivo: l'indice parziale `uq_client_professional_active` (file `hrv_app/supabase/migrations/client_professional_links_unique.sql`) **non è applicato nel DB**, altrimenti questi INSERT sarebbero falliti (l'ultimo doppione è del 9 settembre 2026).

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

## Verifiche SQL da eseguire (catalogo: servono per chiudere 1.2, 1.3, 1.4, 2.6, 2.9)

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
