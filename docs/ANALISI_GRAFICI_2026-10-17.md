# Grafici e analisi del cambiamento: analisi di fase 0

Scritta il 17/10/2026 prima di toccare il codice. Il piano è in
`docs/PROMPT_GRAFICI_ANALISI_2026-10-17.md`; qui ci sono la mappa del codice,
i punti in cui le decisioni prese si scontrano con quello che c'è, le scelte
fatte dove le regole lasciano spazio e la proposta della migrazione `sito-048`
(fase 3b, da approvare prima di applicarla).

Dati letti in produzione in sola lettura (connettore Supabase, il CLI si è
bloccato quattro volte di fila e l'ho chiuso).

## 1. Da dove arrivano i punti di ogni grafico

| Grafico | Dati | Righe | Istante e giorno | Cosa manca per le nuove regole |
|---|---|---|---|---|
| Scheda cliente, Panoramica (`tabs/OverviewTab.tsx`) | `listMeasurementsForClient` (`dashboard-data.ts:168`): `sessions` dirette + RPC remote, poi `measurement_analytics` per `session_id`; se la riga analytics manca si sintetizza da `sessions.hrv_data` | tutta la storia del cliente, una riga per misurazione, `select('*')` su analytics | `started_at_utc` della sessione (`conIstanteSessione`), giorno con `measuredDayKey` | niente: ha tipo, tag, `coherence_data`, `orthostatic_data`, ora |
| Scheda cliente, Analytics avanzati (`tabs/AdvancedAnalyticsTab.tsx`) | stesse righe della Panoramica (`measurements` della pagina) | idem | idem | idem |
| Home (`area-professionisti/page.tsx:361`) | `aggregatedDailyAverages(365)` (`dashboard-data.ts:793`): medie **per giorno e per tutti i clienti del perimetro**, calcolate lato server | 365 punti fissi, uno per giorno, `null` dove non c'è nulla | `measured_at_utc` con `conIstantiDiSessione`, giorno italiano | il tipo di misurazione, l'ora, le singole misurazioni: tutto perso nella media |
| Report periodico (`stampa/report-periodico/page.tsx`, PDF via `api/pdf/report-periodico`) | `loadPeriodicReportData` (`report-data.ts:302`): solo le misurazioni **dentro il periodo** più quelle del periodo precedente | una riga per misurazione | `started_at_utc` | la storia prima del periodo: la partenza del percorso non si può calcolare |
| `api/client-report` (react-pdf) | stesso loader | idem | idem | è il generatore **legacy**, raggiungibile solo con `PDF_LEGACY=true` (`pdf-render.ts:108`); non lo tocco |

Tutti i grafici passano da `AdvancedTrendChart` (`src/components/dashboard/AdvancedTrendChart.tsx`,
938 righe): riceve punti `{ date, <metrica>: valore }` con una riga per
misurazione (scheda) o per giorno (home), filtra per periodo con
`trend-period.ts`, calcola media, mediana e i due scostamenti con
`trend-stats.ts`, disegna tutto su un solo `LineChart` con due assi Y (score
0-100 a sinistra, resto a destra), senza puntini (`dot={false}` a schermo).

Il "-39,1%" di Sara nasce qui: `riepilogoMetrica` confronta `ultimo` (la
coerenza delle 10:39, Stress 26,2) con la media del periodo (che mescola
mattine e coerenze). Non è un bug di calcolo, è la definizione sbagliata.

## 2. Dove serve l'ora locale del cliente

La regola oraria del sito è una sola e sta in `measured-time.ts`: l'istante si
legge dalle colonne `_utc`, il giorno e l'ora sono quelli di `Europe/Rome`
(`parteFuso`, `measuredDayKey`, `measuredHour`). "Ora locale del cliente"
nella decisione 1 vuol dire questo: l'ora italiana dell'istante reale.

Serve in tre punti:

1. **riconoscere la misurazione di riferimento** (`measuredHour` fra 4 e 11):
   nella scheda le righe hanno `started_at_utc`, quindi funziona; nella home
   oggi l'ora non esiste più (vedi §3);
2. **raggruppare per giorno** (un valore al giorno, finestra di 7 giorni di
   calendario): `measuredDayKey`, già usato ovunque;
3. **i confini del periodo**: `periodoDaPreset` usa `oggiIta`, i filtri delle
   query `intervalloGiorniIta`. Già a posto dal 14/10.

Limite da sapere: `tz_offset_minutes` non è affidabile (memoria del repo:
"non distingue nulla") e il sito non ha un fuso per cliente. Sulle 24
misurazioni di Sara `tz` vale 120 su tutte tranne quella del 2/9 fatta in
studio (-420, ed è il tipico valore sbagliato). Un cliente che misura
dall'estero verrebbe classificato con l'ora italiana. Non lo risolvo qui: lo
segno nel report finale come limite noto.

## 3. Cosa cambia per la home

La home oggi disegna la **media del giorno di tutti i clienti**, misurazioni
di ogni tipo e ora comprese. Partenza, fascia e verdetto non hanno senso su un
aggregato di clienti diversi: non c'è "il percorso" di nessuno.

Scelta per la home:

- il server (`aggregatedDailyAverages`) legge anche `test_type` e l'istante
  della sessione e tiene **solo le misurazioni di riferimento** (standard,
  04:00-11:59) prima di fare la media del giorno;
- il grafico usa i nuovi pannelli impilati (Stress, Recupero, RMSSD) con media
  del giorno e media mobile a 7 giorni, **senza** partenza, fascia, verdetto e
  senza i puntini delle singole misurazioni (sono di clienti diversi, e in
  365 giorni sarebbero migliaia);
- didascalia che dice cosa si sta guardando ("media delle misurazioni del
  mattino dei tuoi clienti").

Il `coherence_data` non si può leggere dalla home senza trasferire il blob:
lì la coerenza si riconosce solo da `test_type = 'coherence'`. Per le 195
righe vecchie etichettate `standard` con `coherence_data` pieno (§4.A) la home
sbaglierebbe: sono di maggio-settembre, l'effetto sulla media di un giorno
fra decine di clienti è trascurabile, e lo scrivo nel report.

## 4. Dove le decisioni si scontrano con il codice o con i dati

### A. Il tipo "coerenza" vive solo in `measurement_analytics`

Sul database: `sessions.test_type` ha solo `standard` (4434) e `orthostatic`
(123); `measurement_analytics.test_type` ha `standard` (4321), `orthostatic`
(136) e `coherence` (100). Le due coerenze di Sara del 16 e 17/10 sono
`standard` in `sessions` e `coherence` in analytics. In più **195 righe
`standard` hanno `coherence_data` valorizzato** (maggio-ottobre 2026, metà con
il tag `guided_breathing`): coerenze salvate da build dell'app precedenti al
tipo.

Conseguenze:

- `normalizeTestType(m.test_type)` sulla riga unita funziona (vince il campo
  di analytics), ma sulle righe sintetizzate da `sessions` (analytics assente)
  una coerenza risulterebbe `standard`;
- il solo `test_type` non basta per le 195 righe vecchie.

**Scelta**: `isReferenceMeasurement` chiede tutte e tre le cose:
`normalizeTestType(test_type) === 'standard'`, `coherence_data` nullo,
`orthostatic_data` nullo, più l'ora 04:00-11:59. La forma dei dati vince
sull'etichetta. I tag non contano, come deciso.

### B. `before-after.ts` deve restare identico al Dart

`CLAUDE.md`: i porting (`before-after.ts` compreso) restano uguali a
`lib/utils/before_after_pairs.dart`. La fase 4 chiede un nuovo tipo di coppia
(riferimento del mattino + coerenza dello stesso giorno) che nell'app non
esiste.

**Scelta**: `pairBeforeAfter` non cambia di una riga. Il nuovo accoppiamento è
una funzione a parte nello stesso file (`pairMorningCoherence`), con i suoi
test, e la riga da portare nell'app finisce in `docs/FIX_APP_DA_FARE.md`.

### C. `clients.data_inizio_percorso`: esiste, l'app non la sincronizza

La colonna c'è in produzione (`date`, nulla per Sara). `client-form.ts:159`
dice di non scriverla dal sito perché l'app la tiene solo nella cache cifrata
del telefono. Ho controllato `sync_service.dart:896` (`_clientToRow`): l'upsert
dell'app **non manda** la colonna, quindi un salvataggio dal telefono non la
azzera. Il valore scritto dal sito resta; l'app però continua a mostrare la
sua copia locale, che può essere diversa.

**Scelta**: applico la decisione 13, salvo su `clients.data_inizio_percorso`
da una route del sito (`PATCH /api/clienti/[id]/percorso`, RLS `clients_update`
+ `account_attivo_update` già in vigore). Niente migrazione per questo. Il
disallineamento con la copia locale dell'app va in `FIX_APP_DA_FARE.md`
("leggere `data_inizio_percorso` dal server").

### D. Il report periodico non ha la storia

`loadPeriodicReportData` carica solo il periodo. La partenza del percorso vuole
i primi 7 giorni di riferimento dalla data di inizio (o dall'inizio della
storia). Serve un secondo caricamento, `loadReferenceHistory(client, from?)`,
che legge tutta la storia (o da `data_inizio_percorso`) con le sole colonne che
servono ai conti. Stessa cosa per `api/pdf/report-periodico`, che passa dalla
stessa pagina di stampa.

### E. Mediana: dove sta

`trend-stats.ts` (`mediana`, `StatistichePeriodo.mediana`), `AdvancedTrendChart`
(ReferenceLine e cella), `AdvancedAnalyticsTab` (`stats()` con `median`,
`STAT_KEYS`), chiavi `charts.trend.medianLabel`, `charts.trend.statsMedian`,
`charts.trend.showStats` ("Mostra media/mediana"), `clients.analytics.median`
in IT, EN e DE. Nel report periodico non c'è. Nel generatore legacy react-pdf
non c'è.

### F. Il verdetto a soglia fissa del 3%

`verdettoScostamento(pct, higher, stableBelow = 3)` in `trend-stats.ts` serve
solo al grafico: sparisce con la fascia. `deltaVerdict` in `before-after.ts` è
porting dell'app e resta per le coppie pre/post (lì il confronto è fra due
misurazioni singole, la fascia non c'entra).

### G. Asse Y fisso e doppio asse

`AdvancedTrendChart` ha `domain={[0, 100]}` sull'asse sinistro e un unico
`LineChart`. Un pannello per indice è una riscrittura del componente, non un
ritocco: lo tengo come contenitore (toolbar, periodo, selezione metriche,
localStorage) e dentro ci metto un `MetricPanel` per metrica con il suo asse.
In Analytics avanzati il professionista può selezionarne 35: i pannelli si
impilano tutti; sopra i 6 compare un avviso, non un blocco.

### H. Interruzione della linea dopo 7 giorni senza dati

Recharts con `connectNulls` unisce tutto. La media mobile va passata come
serie con `null` nei buchi e `connectNulls={false}`, con un punto nullo
inserito fra due giorni distanti più di 7 giorni.

### I. Periodo e partenza fuori dal periodo

Il filtro per periodo (`filtraPerPeriodo`) taglia i punti **prima** dei conti.
Con le nuove regole partenza e fascia si calcolano sulla storia intera e solo
il disegno segue il periodo: la fascia si disegna comunque e una nota dice "la
partenza (25 set) è fuori dal periodo mostrato". Il bug del 14/10 (periodo che
non cambiava) era nel Brush: resta la chiave `brushKey` che rimonta il grafico.

### J. Testata della scheda e lancette della Panoramica

`ClientProfile.tsx:114` e `OverviewTab.tsx:43` usano `measurements[0]`, cioè
l'ultima in assoluto (per Sara la coerenza delle 10:39). Vanno sull'ultima di
riferimento (17/10 06:55) con la data, e una riga piccola per l'ultima di
altro tipo.

### K. Deviazione standard: campionaria

Le regole non dicono se la DS dei primi 7 valori è su n o n-1. Uso **n-1**
(campionaria, è quello che si usa con 7 valori) e lo scrivo nel tooltip della
fascia. Su Sara il verdetto non cambia in nessuno dei due casi.

## 5. Verifica delle regole sui dati veri di Sara

24 misurazioni dal 2/9 al 17/10. Il 2/9 è una misurazione in studio delle
15:05: fuori dai conti (pomeriggio). Di riferimento: 20 giorni dal 25/9 al
17/10, con **due** la mattina del 3/10 (07:09 e 07:38, media del giorno),
buco 10/10 → 13/10 (3 giorni, la linea non si interrompe), nessun tag
affidabile (dal 26/9 al 3/10 solo `general`).

Primi 7 giorni di riferimento: 25, 26, 27, 28, 29, 30/9 e 1/10.

| Indice | Partenza (media 7 gg) | Adesso (media mobile al 17/10: 13, 15, 16, 17/10) | Variazione | Fascia ± 0,5 DS | Verdetto |
|---|---|---|---|---|---|
| Stress | 49,3 | 40,1 | -18,7% | ±1,4 | migliorato, fuori fascia |
| Recupero | 29,1 | 36,1 | +24,1% | ±1,6 | migliorato |
| RMSSD (media in log) | 27,0 ms | 27,8 ms | +2,9% | ±0,06 in log (≈ 25,4-28,7 ms) | stabile |

Le due coerenze (16/10 07:25 e 17/10 10:39) restano fuori e non spostano nulla.
Tornano tutti i numeri attesi dal piano. Questi valori diventano la fixture
anonima dei test (`reference-trend.test.ts`).

Regolarità sul periodo 25/9-17/10: 20 giorni su 23 (il piano porta "21 su 23"
come esempio; il conto vero su Sara è 20).

Coppie "mattino + coerenza" (fase 4): 16/10 (06:59 → 07:25, RMSSD 23,9 → 45,0)
e 17/10 (06:55 → 10:39, RMSSD 32,3 → 38,4). Due coppie, come atteso.

## 6. Scelta del modulo

Nuovo `src/lib/reference-trend.ts`, puro, importato con l'estensione `.ts`
come gli altri. `trend-stats.ts` resta per `scostamentoPct`, `piuAltoEMeglio`,
`periodoPrecedente` (li riuso) e perde mediana e `riepilogoMetrica`. Motivo:
`trend-stats` descrive "un periodo", il nuovo modulo descrive "il percorso di
un cliente" (riferimento, media mobile, partenza, fascia, verdetto); tenerli
separati evita un file da 400 righe e lascia leggibili i test.

Firma prevista (fase 1): `isReferenceMeasurement`, `dailyReferenceValues`,
`rollingMean7`, `courseBaseline`, `rollingBand60`, `changeSummary`,
`regularity`, con i conti RMSSD in `ln` e il ritorno in ms.

## 7. Proposta `sito-048` (fase 3b, da approvare prima)

Nessuna tabella esistente copre annotazioni ed esclusioni. Per la vista salvata
`client_settings` (una riga per cliente, RLS `client_settings_own_data` sulla
proprietà della scheda) è adatta: una colonna jsonb.

```sql
begin;

-- vista preparata dal professionista, una per cliente
alter table public.client_settings add column if not exists chart_view jsonb;

-- annotazioni: linee verticali con una parola su una data
create table if not exists public.client_chart_annotations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id),
  professionista_id uuid not null,
  giorno date not null,
  testo text not null check (char_length(testo) between 1 and 60),
  created_at timestamptz not null default now(),
  rimossa_at timestamptz
);

-- esclusioni dai conti: mai un delete, mai un update su measurement_analytics
create table if not exists public.measurement_exclusions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  client_id text not null references public.clients(id),
  professionista_id uuid not null,
  motivo text not null check (motivo in ('artefatti','condizioni_anomale','malattia','altro')),
  nota text check (nota is null or char_length(nota) <= 200),
  created_at timestamptz not null default now(),
  revocata_at timestamptz
);
create unique index if not exists measurement_exclusions_attiva_unica
  on public.measurement_exclusions (session_id) where revocata_at is null;
create index if not exists client_chart_annotations_client_idx on public.client_chart_annotations (client_id);
create index if not exists measurement_exclusions_client_idx on public.measurement_exclusions (client_id);

alter table public.client_chart_annotations enable row level security;
alter table public.measurement_exclusions enable row level security;
revoke all on public.client_chart_annotations from anon, authenticated;
revoke all on public.measurement_exclusions from anon, authenticated;
grant select, insert, update on public.client_chart_annotations to authenticated;
grant select, insert, update on public.measurement_exclusions to authenticated;

-- perimetro: la scheda è mia (stessa regola di client_settings_own_data),
-- scrittura solo con account attivo (come clients)
create policy annotations_owner on public.client_chart_annotations for all
  using (exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid()))
  with check (professionista_id = auth.uid() and account_puo_scrivere(auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid()));
create policy annotations_superadmin_read on public.client_chart_annotations for select using (is_superadmin());
create policy exclusions_owner on public.measurement_exclusions for all
  using (exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid()))
  with check (professionista_id = auth.uid() and account_puo_scrivere(auth.uid())
    and exists (select 1 from public.clients c where c.id = client_id and c.professionista_id = auth.uid()));
create policy exclusions_superadmin_read on public.measurement_exclusions for select using (is_superadmin());

commit;
```

Note:

- nessun `delete` concesso: togliere un'annotazione o un'esclusione scrive
  `rimossa_at` / `revocata_at`;
- `session_id` è `text` come `measurement_analytics.session_id`; niente FK
  verso `sessions` perché le sessioni remote del cliente non sono leggibili
  dal professionista via RLS e la FK fallirebbe il controllo;
- il superadmin legge e basta, coerente con `superadmin_read_*`;
- i membri di organizzazione che vedono la scheda in sola lettura
  (`?professionista=`) non vedono annotazioni ed esclusioni: si può aprire dopo
  con `puo_vedere_come_professionista`, lo segno fra le cose aperte;
- `data_inizio_percorso` non entra nella migrazione: la colonna c'è già.

## 8. Ordine dei lavori e cosa non tocco

Fasi 0 → 1 → 2 → 3 → 3b (dopo il tuo ok sulla 048) → 4 → 5, un commit per
fase su `main`, deploy dopo 2, 3, 3b e 5. Non tocco: l'app Flutter,
`pairBeforeAfter`, il generatore legacy react-pdf, `measurement_analytics`.

`docs/PROMPT_GRAFICI_ANALISI_2026-10-17.md` è tuo e resta fuori dai miei
commit (non è tracciato).
