# Grafici e analisi del cambiamento: report finale

Lavoro del 17/10/2026 sul piano `docs/PROMPT_GRAFICI_ANALISI_2026-10-17.md`.
Analisi di fase 0 in `docs/ANALISI_GRAFICI_2026-10-17.md`. Un commit per fase
su `main`, tutti in produzione su Vercel tranne dove indicato.

| Fase | Commit | Cosa |
|---|---|---|
| 0 | `7252515` | analisi, mappa dei grafici, conflitti, proposta della migrazione |
| 1 | `01ed694` | `src/lib/reference-trend.ts` + test (fixture di Sara) |
| 2 | `13b1dc6` | `AdvancedTrendChart` a pannelli, `trend-panel.ts`, mediana e zoom tolti, testata sull'ultima di riferimento, home sulle sole mattine |
| 3 | `21c82e2` | frase di sintesi, quattro numeri, selettore "Confronta con" |
| 3b | `a45cbd9` | "Prepara la vista", "Mostra al cliente", vista salvata, annotazioni, esclusioni; `sito-049` scritta, **non applicata** |
| 4 | `d1af7d4` | "Prima e dopo": "Inizio e adesso" e "Effetto della seduta" con le coppie mattino → coerenza |
| 5 | questo blocco | report PDF con la storia intera, versione cliente e professionista |

## Cosa è cambiato, in breve

- **Misurazione di riferimento** = standard (né coerenza né ortostatica,
  anche se l'etichetta dice "standard" ma i dati di coerenza ci sono), fra le
  04:00 e le 11:59 italiane. I tag non contano. Le altre misurazioni restano
  visibili come punti vuoti e nell'elenco, ma non entrano nei conti.
- **Un valore al giorno**, media mobile a 7 giorni di calendario (tratteggiata
  sotto 3 valori, interrotta dopo più di 7 giorni senza dati), **partenza** =
  media dei primi 7 giorni di riferimento (da `data_inizio_percorso` se c'è),
  **fascia** = partenza ± 0,5 DS campionaria, **verdetto** stabile dentro la
  fascia e per verso fuori. RMSSD in logaritmo, letta in ms. Tutto in
  `reference-trend.ts`, 13 test.
- **Un pannello per indice** (Stress, Recupero, RMSSD di default; in Analytics
  avanzati la scelta resta libera), puntini pieni/vuoti/barrati, asse Y
  adattato ai dati con "Scala completa", etichetta finale con valore e
  variazione, tooltip con data, ora, tipo e motivo per cui una misurazione è
  fuori dai conti. Il periodo cambia davvero (il Brush non c'è più).
- **Sopra ogni pannello** la frase generata dai numeri nelle tre lingue e
  Partenza, Adesso, Variazione (freccia nel verso del numero, colore nel
  significato), Regolarità. "Confronta con": partenza del percorso (default),
  inizio del periodo, periodo precedente, ultimi 60 giorni (solo con 60 giorni
  di storia).
- **Testata e lancette** della scheda seguono l'ultima misurazione di
  riferimento, con la data; una riga dice l'ultima di altro tipo con il link.
- **Home**: media del giorno delle sole misurazioni del mattino dei clienti e
  media mobile; niente partenza né fascia (sono clienti diversi).
- **Prima e dopo**: "Inizio e adesso" (6 indici con partenza, adesso,
  variazione, verdetto, mini linea) e "Effetto della seduta" (coppie pre/post
  invariate + mattino → coerenza).
- **Report PDF**: stessi blocchi, partenza dalla storia intera.

## Verificato su Sara (scheda 1788354294664), build di produzione in locale

- Stress 49,3 → 40,1, -19%, "migliorato", fuori fascia; Recupero 29,1 → 36,1,
  +24%; RMSSD 27,0 → 27,8 ms, +3%, "stabile": in Panoramica, Analytics,
  "Inizio e adesso", pagina di stampa e PDF (entrambe le versioni, 23
  misurazioni nel periodo 18/9-17/10).
- Testata e lancette: 17/10 06:55; riga "Ultima misurazione: coerenza, 17 ott
  2026, 10:39" con link.
- "Effetto della seduta": 2 coppie mattino → coerenza (16/10 RMSSD +21,0 ms,
  17/10 +6,0 ms), nessuna pre/post, con la spiegazione.
- "Mostra al cliente": un indice alla volta, frase, grafico senza puntini,
  "All'inizio" e "Adesso", Esc. A 390 px nessuno scroll orizzontale in nessuna
  pagina. Nessun errore di idratazione in console (resta il 404 di
  `favicon.ico`, preesistente).
- Periodo: 7, 30, 90 giorni, Tutto e personalizzato; con "Tutto" la regolarità
  si conta dal primo giorno di riferimento (20 su 23).
- Casi limite coperti dai test: 1 e 2 misurazioni (media mobile e partenza
  provvisorie, nessuna fascia), due misurazioni nello stesso giorno, buco di 8
  giorni, cliente solo pomeridiano (messaggio, nessun grafico vuoto), fuso
  vicino a mezzanotte e alle 12:00, anche in inverno.

Script riusabile: `scripts/check-grafici.mjs` (login locale con un magic link
generato con la service key, nessuna email; screenshot e testi dei pannelli).
Comandi:

```bash
cd ~/progetti/stressindex-site && npm run build && PDF_TOKEN_SECRET=solo-test npx next start -p 3778 &
EMAIL=info@massimofilippi.it OUT=/tmp/shots node scripts/check-grafici.mjs
```

**Non verificato in produzione dopo il deploy**: la prova di "Prepara la
vista" con una data di inizio percorso, un'annotazione e un'esclusione vere
richiede la `sito-049` (vedi sotto); la data di inizio percorso da sola si
può già salvare (colonna esistente) ma non l'ho scritta sulla scheda di Sara
senza il tuo ok, perché cambia i numeri che vedi.

## Scelte fatte dove le regole lasciavano spazio

1. **Tipo "coerenza"**: `sessions.test_type` non lo conosce (solo standard e
   ortostatico), lo dice `measurement_analytics.test_type`; e 195 righe vecchie
   sono "standard" con `coherence_data` pieno. La forma dei dati vince
   sull'etichetta. Nella home (`aggregatedDailyAverages`) il blob non si legge:
   lì le 195 vecchie restano dentro, sono di maggio-settembre e su una media
   fra decine di clienti non si vedono.
2. **DS campionaria (n-1)** per la fascia: con 7 valori è la scelta standard.
   Su Sara il verdetto non cambia con n.
3. **`pairBeforeAfter` intatto** (porting del Dart): il nuovo tipo di coppia è
   `pairMorningCoherence`, funzione a parte con i suoi test, da portare
   nell'app (`docs/FIX_APP_DA_FARE.md`, G6).
4. **`data_inizio_percorso`** si scrive dal sito anche se l'app non la
   sincronizza: l'upsert dell'app non manda la colonna e quindi non la azzera;
   l'app però mostra la sua copia locale (G5 in FIX_APP).
5. **Scritture di 3b** con il client del browser sotto RLS (come impostazioni e
   note), niente route nuove. La vista si salva solo con il pulsante, non a
   ogni clic.
6. **Report**: tolte "medie del periodo" e "giorno migliore/peggiore"
   (contraddicevano i nuovi numeri); il commento automatico usa la variazione
   partenza → adesso invece di prima → ultima misurazione. Il generatore legacy
   react-pdf (`PDF_LEGACY=true`) non è stato toccato.
7. **Home senza puntini**: le singole misurazioni sono di clienti diversi e in
   365 giorni sarebbero migliaia.
8. **"Scala completa"** riporta 0-100 per gli score e parte da 0 per il resto.
9. **Modalità cliente** senza la didascalia dei conteggi e senza
   "Regolarità" (metriche tecniche); restano frase, grafico, "All'inizio",
   "Adesso", freccia.

## Da fare tu

1. **Via libera alla `sito-049`** (`supabase-migrations/sito-049_annotazioni_esclusioni_vista.sql`):
   colonna `client_settings.chart_view`, tabelle `client_chart_annotations` e
   `measurement_exclusions`, RLS sul perimetro, scrittura solo con account
   attivo, nessun grant ad `anon`, nessun `delete`, tutto in un `begin …
   commit`. Finché manca, "Prepara la vista" mostra l'avviso e quella parte è
   spenta; il resto funziona. Si applica con:
   ```bash
   cd ~/progetti/stressindex-site && supabase db query --linked -f supabase-migrations/sito-049_annotazioni_esclusioni_vista.sql
   ```
   e si verifica con le query in fondo al file. Il numero 048 era già della
   migrazione dei consensi (altra sessione del 17/10).
2. Dopo la 049, sulla scheda di Sara: una data di inizio percorso,
   un'annotazione, un'esclusione; la partenza si ricalcola e il PDF riporta
   nota e linee; togliendo l'esclusione tutto torna come prima.
3. `PDF_TOKEN_SECRET` su Vercel c'è già (in locale manca, per questo lo script
   lo passa a mano).

## Cosa resta aperto

- **Fuso del cliente**: "ora locale" è l'ora italiana, come tutto il sito
  (`measured-time.ts`); `tz_offset_minutes` non è affidabile. Un cliente che
  misura dall'estero verrebbe classificato con l'ora italiana.
- **Vista "come un altro professionista"** (`?professionista=`): annotazioni
  ed esclusioni non si vedono (le policy della 049 sono sulla proprietà della
  scheda); si può aprire con `puo_vedere_come_professionista`.
- **Home**: la 195 righe vecchie con `coherence_data` restano nella media
  (vedi scelta 1).
- **`pairMorningCoherence`** e **`data_inizio_percorso`** nell'app: G5 e G6 in
  `docs/FIX_APP_DA_FARE.md`.
- **Regolarità nel piano**: l'esempio diceva "21 su 23"; su Sara sono 20 su 23
  (25/9-17/10) e 20 su 30 con il preset di 30 giorni. Il conto è giorni con
  misurazione di riferimento sui giorni del periodo.
- **Pannelli in Analytics avanzati**: con più di 6 metriche selezionate la
  pagina si allunga; c'è l'avviso, non un limite.
- Il CLI Supabase (`supabase db query --linked`) si è bloccato quattro volte di
  fila; le letture del 17/10 sono passate dal connettore Supabase in sola
  lettura.
