# Sito, cose da sistemare

Elenco delle modifiche decise ma non ancora fatte. Una voce per problema:
cosa succede, causa, soluzione scelta, file, come si verifica. Quando una voce
è chiusa si toglie da qui e va nel changelog.

## 1. Il filtro delle misurazioni si perde uscendo dalla scheda "Misurazioni"

- **Origine:** bug-report di Edi, voce #1, richiesta di Marco Supplizi
  (10/10/2026), priorità media. Deciso il 12/10/2026, da fare in una sessione
  dedicata su questo repo.
- **Cosa succede:** nella scheda cliente il professionista sceglie un filtro
  in "Misurazioni" (per esempio mattino, oppure post allenamento). Tornando
  alla panoramica il filtro non c'è più e il grafico Andamento mostra tutte le
  misurazioni. Vorrebbe vedere, per esempio, solo il Total Power del mattino.

### Causa

Tutto in `src/app/[locale]/area-professionisti/clienti/[id]/`.

1. `tabs/MeasurementsTab.tsx` tiene i filtri in stato locale: `typeFilter`
   (riga 38) e `tagFilter` (riga 41), con `range` e `duration` (righe 36-37).
2. `ClientProfile.tsx` monta una scheda alla volta (righe 184-193) e tiene la
   scheda attiva in `useState`, con `panoramica` come partenza (riga 67).
   Cambiando scheda `MeasurementsTab` si smonta e il suo stato sparisce.
   Aprendo una misurazione e tornando indietro si perde anche la scheda
   attiva: si riparte dalla panoramica.
3. `tabs/OverviewTab.tsx` costruisce `trendData` (riga 26) da tutte le
   misurazioni e lo passa ad `AdvancedTrendChart`: non sa che un filtro esiste.

### Soluzione scelta: filtro nell'URL

Il filtro per tipo e per etichetta, e la scheda attiva, vivono nei parametri
dell'URL della scheda cliente:

```
/area-professionisti/clienti/<id>?tab=misurazioni&tipo=<MeasurementTypeKey>&tag=<chiave etichetta>
```

1. `ClientProfile.tsx` legge `tab`, `tipo` e `tag` con `useSearchParams` e li
   scrive con `router.replace` (senza scroll, senza nuova voce nella
   cronologia a ogni clic). Un valore che non è fra quelli ammessi vale come
   assente. `tab` assente = `panoramica`, come oggi.
2. `MeasurementsTab` riceve `typeFilter`, `tagFilter` e i due setter come
   props al posto dei suoi `useState`. `range` e `duration` restano locali.
3. `OverviewTab` riceve gli stessi due valori e filtra le misurazioni prima di
   costruire `trendData`, con le stesse funzioni usate dalla tabella:
   `normalizeTestType` (`src/lib/measurement-type.ts`) e `rowHasTag`
   (`src/lib/before-after.ts`). La regola del filtro va in una funzione sola,
   usata da tutte e due le schede, non copiata.
4. Sopra il grafico Andamento, quando un filtro è attivo, un'etichetta
   "Filtro: Mattino ×" (con `measurementTypeLabel` / `tagLabel`): dice che il
   grafico è filtrato e lo toglie con un clic. Senza questa il grafico
   filtrato sembrerebbe un grafico con dati mancanti.
5. Se il filtro non lascia nessun punto, il grafico mostra il vuoto con il
   testo del filtro (come `emptyFiltered` nella tabella), non il vuoto di
   "nessuna misurazione".
6. Il link "Apri" della tabella (riga 138) e il ritorno dal dettaglio della
   misurazione conservano i parametri, così tornando indietro si ritrovano
   scheda e filtro.

### Cosa resta fuori, per scelta

- Le quattro lancette in cima alla panoramica e l'elenco "ultime misurazioni"
  restano sull'ultima misurazione in assoluto, non su quella filtrata.
- Periodo e durata non entrano nell'URL: il grafico Andamento ha già il suo
  selettore di periodo.
- Nessun calcolo nuovo: si filtra quali righe disegnare, i valori restano
  quelli letti da `measurement_analytics`.

### Alternativa scartata

Alzare lo stato in `ClientProfile` senza toccare l'URL. Regge il cambio di
scheda ma si perde aprendo una misurazione e tornando indietro, che è proprio
il giro descritto nella richiesta.

### Verifica

- Filtro "mattino" in Misurazioni, poi Panoramica: il grafico Andamento mostra
  solo quelle, con l'etichetta del filtro; clic sulla × e tornano tutte.
- Con il filtro attivo: apri una misurazione, torna indietro. Scheda e filtro
  sono quelli di prima. Lo stesso ricaricando la pagina.
- URL con `tipo` o `tag` inventati: la pagina si apre senza filtro e senza
  errori.
- Vista in sola lettura (`readOnly`): stesso comportamento.
- Testi nuovi in italiano e in inglese (`docs/i18n-convenzioni.md`).

### Stima

Mezza giornata. Tre file toccati più i messaggi; nessuna migrazione.
