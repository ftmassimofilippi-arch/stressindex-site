/**
 * Knowledge base testuale derivata dalle 10 sezioni di app/guide/GuideClient.tsx.
 * Iniettata nel system prompt dell'assistente /api/guide-chat.
 * Mantenere allineata al contenuto della pagina /guide.
 */
export const GUIDE_KNOWLEDGE_BASE = `
================================================================
SEZIONE 1 — CONNESSIONE SENSORI (#sensori)
================================================================
La guida più importante. I problemi di connessione BLE sono il
tema numero uno nel canale Telegram. Nel 90% dei casi seguendo
questi passaggi si risolve in due minuti.

Checklist pre-connessione:
- Bluetooth attivato sul telefono.
- GPS / Localizzazione attivata. Android richiede il permesso
  di localizzazione per scansionare dispositivi BLE, è una
  scelta del sistema operativo, l'app non usa la tua posizione.
- Fascia toracica bagnata nei punti di contatto. Acqua del
  rubinetto o saliva, non gel.
- Nessun'altra app è connessa al sensore. Polar Flow, Polar
  Beat, Garmin Connect, Strava, Wahoo, devono essere
  completamente chiuse, non solo in background.
- Il sensore NON è accoppiato nelle impostazioni Bluetooth del
  telefono. Deve connettersi solo tramite Stress Index, non dal
  sistema. Se è stato accoppiato manualmente, rimuoverlo dalle
  impostazioni BT.

Procedura passo passo:
1. Indossa la fascia, bagnala bene sui contatti.
2. Apri Stress Index.
3. Tappa "Seleziona sensore" nella home.
4. Attendi che il sensore appaia nella lista.
5. Tappa sul nome del sensore.
6. Attendi lo stato "Connesso" con il cuore che lampeggia.
7. Sei pronto per misurare.

Troubleshooting connessione.

"Il sensore non appare nella lista":
- Verifica che la fascia sia indossata, il sensore si attiva
  solo a contatto con la pelle.
- Chiudi e riapri l'app.
- Disattiva e riattiva il Bluetooth.
- Su Android, verifica che il GPS sia acceso.
- Verifica che nessun'altra app sia connessa al sensore.
- Rimuovi il sensore dalle impostazioni Bluetooth del telefono
  se è stato accoppiato manualmente.

"Si connette ma non arrivano dati":
- Riposiziona la fascia e bagna di nuovo i contatti.
- Prova ad avvicinare il telefono al sensore.
- Chiudi l'app completamente e riapri.
- Se persiste, riavvia il telefono.

"Si disconnette durante la misurazione":
- Non allontanarti troppo dal telefono, massimo 3 metri.
- Su Android, verifica che il risparmio energetico non chiuda
  l'app in background.
- Impostazioni, App, Stress Index, Batteria, Nessuna
  restrizione.

================================================================
SEZIONE 2 — SENSORI COMPATIBILI (#sensori-compatibili)
================================================================
Per fare HRV serve un sensore che trasmetta gli intervalli RR
beat-to-beat via Bluetooth. Non tutti i cardiofrequenzimetri lo
fanno.

Compatibili garantiti:
- Polar H10 (circa 90 euro): il nostro standard, ECG,
  precisione massima. Consigliato.
- Polar H9 (circa 50 euro): stessa qualità ECG del H10, ottimo
  rapporto qualità prezzo.
- Polar OH1 / Verity Sense: sensore ottico da braccio, funziona
  ma meno preciso di una fascia ECG.

Compatibili con limitazioni:
- Wahoo TICKR: funziona, buona stabilità BLE. Da testare con
  la propria unità.
- CooSpo H808S: funziona, economico (30 euro), qualità
  inferiore al Polar.

Non compatibili:
- Whoop 4.0: trasmette solo BPM, non gli intervalli RR
  necessari per l'analisi HRV.
- Fasce Garmin (HRM-Dual, HRM-Pro): non trasmettono RR
  intervals via BLE standard.
- Apple Watch: non trasmette dati ECG via BLE.
- Smartwatch e smartband generici: non adatti per analisi HRV
  professionale.

Perché servono gli intervalli RR? L'HRV misura la variazione
tra un battito e l'altro con precisione al millisecondo. Un
semplice dato BPM (battiti al minuto) è una media e perde tutta
l'informazione sulla variabilità. Per questo servono sensori
che trasmettono gli intervalli RR beat-to-beat.

================================================================
SEZIONE 3 — LA PRIMA MISURAZIONE (#prima-misurazione)
================================================================
Setup dell'ambiente: ambiente tranquillo, luce soffusa,
temperatura confortevole. Niente telefonate, notifiche
silenziose. Il cliente deve essere seduto o supino da almeno
2 minuti prima di iniziare, il tempo che il sistema nervoso si
assesti.

Posizione: seduto con schiena appoggiata, piedi a terra, mani
sulle cosce. Oppure supino. L'importante è standardizzare, usa
sempre la stessa posizione per lo stesso cliente, altrimenti i
confronti tra sessioni perdono significato.

Respirazione: naturale. Non dire al cliente di respirare
lentamente per rilassarsi, altrimenti invalidi lo spettro e
ottieni un quadro non rappresentativo. Spiegagli che deve
respirare come fa normalmente.

Durata:
- 5 minuti è lo standard scientifico (Task Force ESC/NASPE
  1996).
- 10 minuti per un'analisi più stabile e meno influenzata da
  fluttuazioni momentanee.
- Durata libera per sessioni durante trattamenti, dove vuoi
  monitorare la risposta nel tempo.

Cosa succede durante: l'app raccoglie gli intervalli RR dal
sensore, li filtra dagli artefatti in tempo reale, e alla fine
calcola tutti i parametri. Non toccare il telefono durante la
misurazione, lascia che l'app lavori indisturbata.

================================================================
SEZIONE 4 — I 3 TIPI DI TEST (#tipi-test)
================================================================

Misurazione standard (test tonico):
- Cos'è: fotografia dello stato attuale del sistema nervoso
  autonomo a riposo.
- Quando usarla: è il default, va bene nel 70% dei casi.
  Valutazioni periodiche, monitoraggio, prima visita.
- Durata: 5 o 10 minuti.
- Posizione: seduto o supino, sempre uguale per lo stesso
  cliente.

Test ortostatico (test fasico):
- Cos'è: misura la capacità del sistema nervoso di reagire a
  uno stimolo, il passaggio da supino a in piedi.
- Come funziona: 5 minuti supino, poi l'app ti avvisa con suono
  e vibrazione di alzarti, poi 5 minuti in piedi. L'app
  analizza entrambe le fasi e le confronta.
- Quando usarlo: disautonomie, sindromi post-infettive (long
  COVID), atleti sovrallenati, valutazione iniziale
  approfondita. Ogni 4-6 settimane come stress test del sistema
  nervoso.
- Il report mostra: Indice di Reattività Ortostatica (0-100) e
  confronto supino vs in piedi per ogni parametro.
- Attenzione: non confrontare mai un test ortostatico con una
  misurazione standard, sono cose diverse.

Respirazione di coerenza:
- Cos'è: il cliente respira seguendo un'animazione visiva a una
  frequenza impostata (di default 6 respiri al minuto).
- Come funziona: l'app mostra una sfera che si espande
  (inspira) e si contrae (espira). Il cliente segue il ritmo.
  Intanto l'app calcola lo Score di Coerenza in tempo reale.
- Quando usarla: training di coerenza cardiaca, valutazione del
  massimo potenziale vagale, ricerca della frequenza di
  risonanza personale. Utile per ansia, insonnia, dolore
  cronico, preparazione mentale.
- Frequenza di risonanza: varia da persona a persona, tra 4.5 e
  7.5 respiri/min. Si possono testare diverse frequenze in
  sessioni da 2-3 minuti e vedere quale produce il picco LF più
  alto nello spettro.
- Attenzione: non usare la coerenza come misurazione di
  valutazione. Per valutare il cliente usa sempre il test
  standard. La coerenza misura il potenziale, non lo stato
  attuale.

================================================================
SEZIONE 5 — LEGGERE I RISULTATI (#risultati)
================================================================
Ogni score va da 0 a 100. Sono calcolati combinando più
parametri HRV con pesi scientificamente validati. Sono il modo
più rapido per leggere lo stato del cliente senza doverti
immergere nei singoli parametri.

I 5 score proprietari:

Indice di Stress (0-100): quanto è sotto pressione il sistema
nervoso. Range: 0-30 basso, 30-50 in equilibrio, 50-70 medio,
70-85 alto, 85-100 esaurimento. Se è alto cronicamente indica
stress accumulato nel tempo, non solo il momento della
misurazione.

Recupero (0-100): capacità di recupero del sistema
parasimpatico. Range: 0-25 insufficiente, 25-45 scarso, 45-65
moderato, 65-85 buono, 85-100 ottimale.

Equilibrio (0-100): bilanciamento tra simpatico e
parasimpatico. Non è "più alto = meglio", il valore ottimale è
nella zona centrale. Troppo sbilanciato in entrambe le
direzioni è problematico.

Energia (0-100): risorse energetiche complessive del sistema
nervoso. Basato sulla potenza totale dello spettro HRV.

Modulazione Infiammatoria (0-100): capacità del sistema vagale
di modulare l'infiammazione. Basato sul riflesso
antinfiammatorio colinergico (Tracey 2002). Più è alto,
migliore è la capacità del corpo di tenere sotto controllo
l'infiammazione.

Stress Index Composito: valore unico 0-100 che sintetizza tutti
e 5 gli score. Si vede nel tachimetro in cima ai risultati. È
il numero da monitorare nel tempo, soprattutto se confronti più
sessioni dello stesso cliente.

I parametri avanzati: sotto gli score trovi i dettagli per
dominio (Time Domain, Frequency Domain, Non-linear, Geometric).
Ogni parametro ha un semaforo (verde, giallo, rosso) basato sui
range normativi per età e sesso del cliente. Non serve
conoscerli tutti per usare l'app, gli score sono sufficienti
nella pratica quotidiana. I parametri avanzati servono se vuoi
approfondire un caso specifico o confrontare con la
letteratura.

================================================================
SEZIONE 6 — CONFRONTO SESSIONI (#confronto)
================================================================
Come accedere: nella scheda cliente seleziona 2 o più
misurazioni e tappa "Confronta".

Cosa mostra: i parametri selezionati fianco a fianco con delta
e frecce di tendenza.

Organizzazione: i parametri sono raggruppati per dominio
(Score, Time, Frequency, Non-linear, Geometric).

Personalizzazione: puoi selezionare quali parametri
confrontare, di default vedi i 9 più importanti.

Consiglio: confronta sempre misurazioni dello stesso tipo
(standard con standard, ortostatico con ortostatico) fatte
nelle stesse condizioni. Altrimenti stai paragonando mele e
pere.

================================================================
SEZIONE 7 — GESTIONE CLIENTI (#clienti)
================================================================
Aggiungere un cliente: tappa + nella lista clienti, compila
l'anagrafica (nome, cognome, data di nascita, sesso, fumatore,
atleta, livello di attività).

Perché l'anagrafica è importante: età e sesso servono per la
normalizzazione dei parametri. Senza questi dati i semafori
verde/giallo/rosso non possono essere calcolati correttamente,
quindi compilala sempre, anche quando hai fretta.

Storico: ogni misurazione viene salvata e associata al cliente.
Puoi rivedere qualsiasi sessione passata in qualsiasi momento.

Note: puoi aggiungere note libere a ogni cliente. Usale per
annotare contesto clinico, eventi rilevanti, obiettivi.

================================================================
SEZIONE 8 — REPORT PDF (#report-pdf)
================================================================
Come generarlo: nei risultati della misurazione, tappa l'icona
PDF in alto a destra.

Cosa contiene: 4 pagine con score, parametri completi, grafici
(Poincaré, ritmogramma, spettro PSD) e disclaimer medico.

Per le sessioni lunghe: pagine extra con trend dei segmenti e
confronto pre/post trattamento.

Condivisione: puoi inviarlo via WhatsApp, email o salvarlo nel
rullino foto.

Personalizzazione: se compili il tuo profilo professionale
(titolo, studio, contatti), questi dati appariranno nel PDF,
dando un'aria più professionale al report consegnato al
cliente.

================================================================
SEZIONE 9 — TROUBLESHOOTING (#problemi)
================================================================

"L'app si è chiusa durante la misurazione":
Se la misurazione era in corso da meno di 1 minuto i dati sono
persi. Se era in corso da più di 1 minuto l'app potrebbe aver
salvato i dati automaticamente. Riapri l'app e controlla lo
storico del cliente. Su Android, vai in Impostazioni, App,
Stress Index, Batteria, Nessuna restrizione.

"I valori sembrano strani":
Verifica che la fascia fosse ben posizionata e bagnata.
Controlla l'artifact rate, se è sopra il 5% la misurazione
potrebbe non essere affidabile. Il cliente si è mosso o ha
parlato durante la misurazione? Il movimento crea artefatti.

"Non riesco a vedere i dati sulla dashboard web":
Verifica di essere loggato con lo stesso account su app e web
(stressindex.io/area-professionisti). I dati si sincronizzano
automaticamente, ma serve connessione internet. Se i dati non
appaiono, chiudi e riapri l'app con internet attivo per forzare
il sync.

"Il PDF non si genera":
Verifica che la misurazione sia completa, non interrotta. Prova
a chiudere e riaprire i risultati. Se persiste, contattaci a
support@stressindex.io.

"Come resetto la password?":
Nella schermata di login tappa "Password dimenticata",
inserisci la tua email e segui le istruzioni.

================================================================
SEZIONE 10 — CONTATTI E SUPPORTO (#supporto)
================================================================
- Email: support@stressindex.io
- Canale Telegram: t.me/stressindex (domande, aggiornamenti,
  community professionisti)
- Sito: stressindex.io
`.trim()
