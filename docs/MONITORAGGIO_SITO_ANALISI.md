# Monitoraggio 24h e Sonno sul sito — analisi (FASE 0)

> Scritto l'11 settembre 2026 prima di toccare codice, leggendo il repo
> dell'app (`~/progetti/hrv_app`) e lo stato reale del database. Regola
> assoluta: il sito **legge e disegna**, non ricalcola mai. Quando il
> documento dell'app e il codice Dart divergono, vince il codice Dart e la
> divergenza è annotata qui (§6).

Aggiornato in FASE 6 con: migrazioni aggiunte al repo del sito (§8), cosa
non si è potuto verificare (§9).

---

## 1. Fonti lette

| Fonte | Cosa dice |
|---|---|
| `docs/MONITORAGGIO_ANALISI.md` | Sezione "Per il sito": schema tabella, riga di esempio, bucket `monitoring-rr`, RPC. Scritta per la 1.0: **manca tutto ciò che la 1.1 ha aggiunto** (§6). Il §5 dice "Modulo Sonno: nessun codice esistente" — superato. |
| `docs/MONITORAGGIO_ALGORITMO.md` | Versione 1.1.0: preparazione serie, finestre, classificazione, notte, **profili**, ogni indice con formula/requisito/etichette/referenza, frase di sintesi. |
| `supabase/migrations/monitoring_sessions.sql` | Tabella, RLS `monitoring_can_access`, bucket `monitoring-rr`, RPC `get_monitoring_sessions_for_professional` e `get_linked_client_monitoring_sessions_by_client_id`. |
| `supabase/migrations/monitoring_recording_profile.sql` | Colonna `recording_profile` + backfill. |
| `supabase/migrations/monitoring_sleep.sql` | Colonne `sleep_score`, `spo2_storage_path`, `device_serial`, `sample_interval_seconds`; bucket `monitoring-spo2`. |
| `lib/models/monitoring/*.dart` | `MonitoringSession`, `MonitoringWindow`, `MonitoringEvent`/`EventResponse`, `MonitoringNight`, `MonitoringSummary`/`SeriesHrv`, `MonitoringAdvanced` (tutti gli indici 1.1), `RecordingProfile`, `MonitoringPage`. |
| `lib/models/sleep/sleep_night.dart`, `sleep_recording.dart` | `SleepNight` e la serializzazione verso `night`/`summary`/`windows`. |
| `lib/l10n/pdf_strings.dart` (mappa `monitoring` + `indexTexts` EN/DE), `lib/l10n/monitoring_index_texts.dart` (IT, fonte di verità), `lib/l10n/sleep_pdf_strings.dart` | Testi esatti IT/EN/DE. |
| `lib/widgets/hrv_widgets.dart` (`AppColors`) | Palette: non esiste `app_colors.dart`. |
| `lib/widgets/monitoring/*`, `lib/widgets/sleep/*`, `lib/screens/monitoring/monitoring_result_screen.dart`, `lib/screens/sleep/sleep_result_screen.dart` | Come l'app disegna: timeline, riserva, gauge, card indici, mappa ore, notte, ritmo, tabelle, striscia sonno, curve SpO₂/polso. |
| `lib/services/monitoring_pdf_service.dart`, `sleep_pdf_service.dart` | Struttura pagine dei PDF. |
| `lib/services/monitoring_store.dart` | Formato del file RR nel bucket. |
| `lib/services/monitoring_sync_service.dart`, `monitoring_service.dart` | Upsert, RPC chiamate dall'app, `reanalyze`/`saveEvents`. |
| Database Supabase (lettura con service_role, solo select) | Stato reale delle migrazioni e una riga vera (§7). |

---

## 2. Tabella `public.monitoring_sessions` — schema reale

Colonne della migrazione base (verificate presenti sul DB):

| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid pk | generato dall'app |
| `user_id` | uuid | chi ha registrato (`auth.uid()`) |
| `professionista_id` | uuid null | pro di riferimento; per un cliente collegato è il pro del link |
| `client_id` | text null | riga `clients` (epoch-millis) |
| `monitoring_type` | text | `'24h'` \| `'sleep'` \| `'custom'` (check) |
| `source` | text | `'polar_h10_offline'` (Memoria Polar H10) \| `'polar_h10_live'` (Telefono vicino, qualsiasi fascia RR) \| `'external_device'` (Sonno) \| `'import'` |
| `device_name` | text | es. `Polar H10 1841EB36`, `Checkme O2 Max` |
| `start_time`, `end_time` | timestamptz | istanti UTC veri (`toUtc()`), sempre insieme a `tz_offset_minutes` |
| `tz_offset_minutes` | int | offset del dispositivo all'avvio: l'orologio da parete da mostrare |
| `duration_minutes`, `rr_count` | int | `rr_count` NULL per le righe sleep |
| `artifact_percentage` numeric, `signal_quality` text (`good`/`fair`/`poor`), `ectopic_count` int | | NULL per sleep (artefatti) |
| `valid_coverage_percentage` | numeric | % finestre valide (24h) |
| `events` | jsonb | array `MonitoringEvent` |
| `windows` | jsonb | array: `MonitoringWindow` (24h) **oppure** `SleepWindow` (sleep) |
| `night` | jsonb null | `MonitoringNight` (24h) oppure compat + blocco `sleep` (sleep) |
| `summary` | jsonb null | `MonitoringSummary` (24h) oppure summary Sonno |
| `scores_night`, `scores_morning` | jsonb null | 5 score + `composite` + `demo_normalized` (solo 24h) |
| `baseline_snapshot` | jsonb null | solo 24h |
| `algorithm_version` | text | `'1.0.0-monitoring'` (righe vecchie), `'1.1.0-monitoring'` (Dart attuale), `'1.0.0-sleep'` |
| `rr_storage_path` | text | `<user_id>/<session_id>.rr.json.gz` nel bucket `monitoring-rr`; NULL per sleep |
| `notes` text, `tags` text[] | | |
| `created_at`, `updated_at` | timestamptz | trigger `updated_at` |

Colonne delle migrazioni successive (**non ancora applicate sul DB**, vedi §7):

| Colonna | Migrazione | Note |
|---|---|---|
| `recording_profile` | `monitoring_recording_profile.sql` | `breve` \| `giornata` \| `notte` \| `giorno_notte` \| `ciclo_completo`, NULL sulle righe 1.0 |
| `sleep_score` numeric | `monitoring_sleep.sql` | copia di `summary.sleep_score.total` |
| `spo2_storage_path` text | idem | `<user_id>/<session_id>.spo2.json.gz` nel bucket `monitoring-spo2` |
| `device_serial` text, `sample_interval_seconds` int | idem | |

Colonna aggiunta dal sito (§8): `events_modified_on_web` boolean + `events_modified_on_web_at`.

RLS: `select/insert/update/delete` con `monitoring_can_access(user_id, professionista_id)` =
`auth.uid() = user_id OR auth.uid() = professionista_id OR hrv_puo_accedere(user_id)`.
`hrv_puo_accedere` (client_baselines.sql:351) = interessato **o `hrv_e_amministrativo()`
(= `is_superadmin()`) o professionista con link attivo**. Quindi il **superadmin
legge già tutte le righe** senza policy aggiuntive.

### 2.1 Convenzione oraria

Diversa dalle misurazioni brevi: qui `start_time`/`end_time` e tutti gli ISO
dentro i jsonb sono **istanti UTC veri** e `tz_offset_minutes` è l'offset del
dispositivo. Il sito mostra l'orologio da parete del dispositivo:
`wall = instant + tz_offset_minutes`, formattato con i componenti UTC. Non si
usa `measuredInstant()` (ramo legacy delle misurazioni brevi).

---

## 3. Struttura dei jsonb — 24h (fonte: Dart `toJson`)

### 3.1 `windows[]` (`MonitoringWindow.toJson`, chiavi brevi, ~1440 per 24 h)

```
s, e            ISO UTC inizio/fine finestra (5 min, passo 1 min)
valid           bool
state           'stress' | 'recovery' | 'activity' | 'neutral' | 'invalid'
art             % artefatti (1 dec)
cov             copertura 0-1 (3 dec)              ← manca nella doc "Per il sito"
hr, hr_min, hr_max, rmssd, ln_rmssd, sdnn, pnn50, lf_hf, hf_nu, si (Baevsky)
dfa             DFA α1, solo una finestra ogni 5
br              respiro stimato atti/min (1.1)     ← manca nella doc "Per il sito"
```

### 3.2 `events[]` (`MonitoringEvent.toJson`)

```
id, type, timestamp (ISO UTC), label, note
type ∈ coffee | meal | alcohol | training | stress | sleep_start | wake_up | supplement | relax | other
response: null | {
  label: 'attivazione' | 'neutro' | 'recupero' | 'dati insufficienti',
  hr_before, hr_after, hr_late, ln_rmssd_before, ln_rmssd_after, ln_rmssd_late,
  delta_hr, delta_hr_pct, delta_ln_rmssd, delta_ln_rmssd_pct, delta_hr_late, delta_ln_rmssd_late,
  n_before, n_after, n_late }
```
`sleep_start` / `wake_up` sono marcatori della notte e non hanno `response`.

### 3.3 `night` (`MonitoringNight.toJson`)

```
night_start, night_end (ISO), detected (bool: true = rilevata dall'HR, false = dagli eventi),
duration_minutes, mean_hr_night, min_hr_night, min_hr_time, rmssd_mean_night, ln_rmssd_night,
sdnn_night, hr_dip_percentage,
hourly: [{hour_start, mean_hr, rmssd, state}],
recovery_first_3h, recovery_last_3h, recovery_trend, recovery_percentage_night,
awakenings_estimate   ← "episodi di attivazione stimati", MAI "risvegli"
```

### 3.4 `summary` (`MonitoringSummary.toJson`)

```
percent_stress, percent_recovery, percent_activity, percent_neutral, percent_invalid,
recovery_minutes_day, stress_minutes_day,
longest_stress_bout, longest_recovery_bout: {start, end, minutes},
peak_stress_time, mean_hr_24h, rmssd_mean_24h, hr_rest, hr_max_used,
stress_recovery_balance (0-100), stress_recovery_label, night_recovery_quality, summary_phrase,
ln_rmssd_reference, ln_rmssd_mad, hr_median, activity_threshold_hr,      ← non nella doc
series: { full, night, day: SeriesHrv | null },                             ← non nella doc
gap_minutes, clock_shortfall_minutes,                                       ← non nella doc
advanced: MonitoringAdvanced | assente (righe 1.0)                          ← 1.1
```

`SeriesHrv`: `rr_count, minutes, mean_hr, rmssd, sdnn, pnn50, lf_hf, lf_nu, hf_nu,
total_power, si, dfa_alpha1, sd1, sd2, dfa_alpha2, ulf, vlf, lf, hf, tracts, tract_minutes`.

### 3.5 `summary.advanced` (`MonitoringAdvanced.toJson`, chiavi brevi)

```
tracts:           {count, longest_min, total_min}
reserve:          {pts: [[ISO, v], …] ogni 5 min, start, end, min, min_t, max, max_t}
pauses:           {count, total_min, items: [{start, end, minutes}]}
longest_stretch:  {start, end, minutes}
return_times:     {median, worst, worst_at, items: [{s, e, min, ok}]}
prsa:             {dc, ac, n_dec, n_acc, beats, curve_dec[], curve_acc[]}
fragmentation:    {pip, ials, pss, pas, beats}   (etichetta: pip<55 ordinato, <65 intermedio, else frammentato)
respiration:      {day, night, all, sd, n}
time_to_min:      {min, at, hr, descent: [[minuti, hr], …]}
ultradian:        {present, period, cycles, strength}
cosinor_hr, cosinor_ln_rmssd: {mesor, amp, acro, bathy, r2, hours, indicative}
mse:              {e: [SampEn scala 1..20 | null], ci, beats, chunks}
dfa_alpha2:       number | null
hourly:           [{h, hr, ln, lfhf, state, n}]  (mappa delle ore + cosinor)
unavailable:      {indexId: motivo}   — motivi in linguaggio wellness scritti dall'app
unreliable:       [indexId]           — copertura < 60 %: "da leggere con cautela"
```

Id degli indici (`MonitoringIndexId`): `balance, reserve, recovery_pauses, longest_stretch,
peak, return_time, event_response, night_recovery, hr_dip, time_to_min, rest_waves,
internal_clock, dc, ac, fragmentation, respiration, hour_map, mse, dfa_alpha2, ulf_vlf`.

### 3.6 `scores_night` / `scores_morning`

`{stress, recovery, balance, energy, inflammation, composite, demo_normalized}`.

### 3.7 `baseline_snapshot`

`{metric:'ln_rmssd', mean, sd, swc, rolling_7d, n, source:'db'|'local', applied, reason}`.

### 3.8 Profilo della registrazione e fallback

`recording_profile` è scritto dalla 1.1. Per le righe senza (1.0), l'app usa
`RecordingProfile.determine(durationMinutes, nightMinutes, nominalNightMinutes)`:

1. durata < 240 min → `breve`;
2. notte presente (`night.duration_minutes ≥ 180` oppure ≥ 180 minuti della
   registrazione nelle ore locali 23:00-07:00): ≥ 1080 min → `ciclo_completo`;
   fuori dalla notte < 240 min → `notte`; altrimenti `giorno_notte`;
3. senza notte: ≥ 360 min → `giornata`, altrimenti `breve`.

Il sito replica **questa sola regola** (è la derivazione di un'etichetta, non
un ricalcolo di indici) e marca il risultato "profilo stimato *".

Pagine per profilo (`MonitoringPage.pagesFor`): Riepilogo sempre; Notte se
`notte|giorno_notte|ciclo_completo`; Andamento ed Eventi sempre; Mappa delle
ore se `giornata|giorno_notte|ciclo_completo`; Ritmo e complessità (pro) se
≠ `breve`; Parametri (pro) sempre. Le pagine escluse **non esistono**.

---

## 4. Modulo Sonno — struttura reale (punto 5 della FASE 0)

Il modulo esiste (`lib/models/sleep/`, `lib/services/sleep_*`, `lib/screens/sleep/`,
`lib/widgets/sleep/`, `supabase/migrations/monitoring_sleep.sql`). Non è una
tabella separata: è una riga di `monitoring_sessions` con
`monitoring_type = 'sleep'`, `source = 'external_device'`,
`device_name = 'Checkme O2 Max'`, `algorithm_version = '1.0.0-sleep'`,
`rr_count`/`artifact_percentage` NULL, `rr_storage_path` NULL, e le quattro
colonne di `monitoring_sleep.sql`. Le altre colonne base (`signal_quality`,
`valid_coverage_percentage`, `ectopic_count`) non sono valorizzate dal ramo
sleep di `toRow()` (restano quelle di `_baseRow`, cioè quello che
`SleepService` ha messo nella `MonitoringSession`; da leggere come opzionali).

**Serializzazione (`SleepNight.nightJson/summaryJson/windowsJson`) — vince il Dart:**

### 4.1 `night` (riga sleep)

```
night_start, night_end, detected: false (sempre), duration_minutes,
mean_hr_night   = polso medio (cardiac.mean_pr)      ← compat con il 24h
min_hr_night    = polso minimo (cardiac.min_pr), min_hr_time
awakenings_estimate = movement.estimated_awakenings se il movimento è disponibile
sleep: {
  algorithm_version, analyzable (bool), not_analyzable_reason,
  signal: {sample_interval_sec, sample_count, valid_sample_count, coverage_pct,
           coverage_label 'good'|'fair'|'poor', invalid_segments: [{start,end}],
           valid_recording_minutes, valid_time_minutes},
  oxygenation: {spo2_basal, mean_spo2, nadir, nadir_time, spo2_sd, delta_index_12s,
                odi3, odi4, odi3_label 'normal'|'mild'|'moderate'|'marked',
                event_count, event_count_4, t90_minutes, t90_pct, t88_minutes, t88_pct,
                t85_minutes, t85_pct, t90_label 'normal'|'observe'|'relevant',
                cyclic_runs, cyclic_minutes} | null,
  events: [{start, duration_sec, baseline, nadir, drop, nadir_time, surge_bpm}],
  cardiac: {mean_pr, min_pr, min_pr_time, max_pr, pr_basal, first_hour_median_pr, dip_pct,
            first_3h_mean_pr, last_3h_mean_pr, trend_bpm, surge_event_pct} | null,
  movement: {available, moved_minutes, moved_pct, estimated_awakenings, normalization_p95} | null,
  hourly: [{hour_start, spo2, pr, events}],
  device: {o2_score, avg_spo2, min_spo2, drops_3, drops_4, duration_below_90_sec, asleep_time_sec, steps} | null
}
```

### 4.2 `summary` (riga sleep)

```
summary_phrase, analyzable, coverage_pct, odi3, odi3_label, t90_pct, t90_label,
sleep_score: {total, label 'poor'|'sufficient'|'good'|'very_good'|'excellent',
              oxygenation, respiratory_stability, cardiac_recovery, continuity | null,
              weights: {oxygenation, respiratory_stability, cardiac_recovery, continuity}} | null
```
**Non contiene** `percent_*`, `stress_recovery_balance` ecc.: una riga sleep
non va mai letta come `MonitoringSummary`.

### 4.3 `windows[]` (riga sleep, 1 minuto ciascuna)

```
s, e, state ∈ 'normale' | 'desaturazione' | 'sotto90' | 'movimento' | 'nonValido'
spo2 (media), spo2_min, pr (media), mov (0-1), ev (eventi iniziati nel minuto)
```
Gli id degli stati sono **italiani in camelCase**, diversi dagli id inglesi del 24h.

### 4.4 File grezzo (bucket `monitoring-spo2`, non ancora creato sul DB)

`<user_id>/<session_id>.spo2.json.gz` = `SleepRecording.toJson()`:
`file_name, start_time, tz_offset_minutes, recording_time_sec, sample_interval_sec_hint,
device_name, device_serial, device{…}, spo2[], pr[], vector[]`. Passo di campionamento
ricavato (atteso 4 s). Non serve al sito in Fase 1 (nessun export previsto).

### 4.5 Testi e soglie usati dall'app (copiati, non riformulati)

- Copertura: `good` "Segnale ottimo" (> 95 %), `fair` "Segnale discreto" (85-95), `poor` "Segnale disturbato" (< 85). Non analizzabile sotto 120 min o 70 %.
- ODI3: `normal` "Nella norma" (< 5), `mild` "Alterazione lieve" (5-14,9), `moderate` "Alterazione moderata" (15-29,9), `marked` "Alterazione marcata" (≥ 30).
- T90: `normal` "Nella norma" (< 1 %), `observe` "Da osservare" (1-5), `relevant` "Rilevante" (> 5).
- Sleep Score: `poor` "Scarso" (< 40), `sufficient` "Sufficiente" (40-60), `good` "Buono" (60-75), `very_good` "Molto buono" (75-90), `excellent` "Ottimo" (≥ 90). Componenti: Ossigenazione 35 %, Stabilità respiratoria 30 %, Recupero cardiaco 20 %, Continuità 15 % (senza movimento 41/35/24).
- Banda "sotto il 90 %" nel grafico SpO₂ (`Spo2NightChart._below = 90`), polso basale = 10° percentile.
- Disclaimer ODI obbligatorio (`SleepVisuals.odiDisclaimer`), frase "Indicatori di benessere basati su ossigenazione e frequenza del polso…", nota "Il surge … è un proxy di microrisveglio: senza EEG non si contano i risvegli veri.", nota pattern ciclico.
- Colori: accento Sonno `#3A3A6B` (dark `#26264A`, light `#E7E7F2`); stati: normale = sleepLight, desaturazione = `#C44E4E`, sotto90 = `#D98C5F`, movimento = `#4F86C6`, non valido = `#E6E9EC`.

Pagine dell'app: Riepilogo, Ossigenazione, Cuore, Eventi. PDF: Riepilogo,
Ossigenazione, Cuore + eventi, Nota metodologica.

⚠️ **Conflitto di linguaggio da segnalare**: i testi dell'app usano
"Eventi di desaturazione", "Desaturazione" (stato/legenda), "Risvegli stimati",
"microrisvegli" e, nel disclaimer obbligatorio, "Non è una diagnosi di apnea
del sonno" (negazione). Il vincolo del prompt ("mai apnea… copia i testi
dall'app senza riformularli") è internamente contraddittorio: si è scelto di
copiare i testi dell'app **alla lettera**, perché è l'unico modo per avere gli
stessi testi su app e sito. Se si vuole cambiarli, vanno cambiati prima in
`sleep_pdf_strings.dart` / `sleep_visuals.dart` e poi ricopiati.

---

## 5. Palette e testi

- `AppColors.monitoring #3D5A80`, `monitoringDark #2B4160`, `monitoringLight #E4EBF3`.
- Stati: `stateRecovery #2F8F6B`, `stateStress #C44E4E`, `stateActivity #4F86C6`, `stateNeutral #B8C2CC`, `stateInvalid #E6E9EC`. Bordo notte sulla timeline: `monitoringDark`.
- Livelli: buono = stateRecovery, nella media = warning `#C78A2C`, da migliorare = stateStress.
- Gauge bilancio (`MonitoringVisuals.balanceColor`): < 30 stress, < 45 `#D98C5F`, ≤ 55 `#8FA3B0`, ≤ 70 `#6FB39A`, else recovery. Gauge recupero notturno (`qualityColor`/`qualityLabel`): < 40 "Da migliorare", < 60 "Discreto", < 75 "Buono", ≥ 75 "Ottimo".
- Mappa ore: caldo = lerp(`#DCEFE6` → stateStress), verde = lerp(`#E6E9EC` → stateRecovery).
- Testi IT degli indici: `MonitoringIndexTexts.all` (nome, frase, nome tecnico, metodo, requisito, referenza, proOnly). EN/DE: `PdfStrings.indexTexts`. Stringhe di pagina: `PdfStrings.monitoring` (IT/EN/DE). Sonno: `SleepPdfStrings.strings`. Tutte copiate in `src/lib/monitoring-strings.ts` e `src/lib/sleep-strings.ts` con uno script, senza riformulazioni.
- Etichette dei tre livelli: `buono` / `nella media` / `da migliorare` (`IndexLevel.label`). Soglie (`MonitoringIndexTexts.*Level`): DC/|AC| > 4,5 buono, > 2,5 media; calo HR ≥ 10 / ≥ 5; rientro ≤ 15 / ≤ 45 min; pause ≥ 3 e ≥ 30 min / ≥ 1; tratto < 180 / ≤ 360 min; ritmo ampiezza ≥ 8 / ≥ 4 bpm ("marcata/moderata/debole"); recupero notturno ≥ 75 / ≥ 45; bilancio ≥ 55 / ≥ 45; onde presenti = buono, poco evidenti = media; riserva Δ ≥ +0,5 "Ricaricata" / ≤ −0,5 "Consumata" / "In pari".
- `dayPart(t, night)`: "nelle prime ore di sonno" / "verso il risveglio" / "nel cuore della notte" dentro la notte; altrimenti per ora locale 5-9 "al mattino presto", 9-12 "in mattinata", 12-14 "a metà giornata", 14-18 "nel pomeriggio", 18-22 "in serata", altrimenti "di notte". È testo, non un indice: replicato nel sito per i dettagli delle card, come fa l'app.

---

## 6. Divergenze fra documenti e codice (vince il codice)

1. **`MONITORAGGIO_ANALISI.md` "Per il sito" è fermo alla 1.0**: la riga di esempio non ha `recording_profile`, `summary.advanced`, `summary.series`, `ln_rmssd_reference/mad`, `hr_median`, `activity_threshold_hr`, `gap_minutes`, `clock_shortfall_minutes`; le finestre non hanno `cov` e `br`; `algorithm_version` d'esempio è `1.0.0-monitoring` mentre il Dart scrive `1.1.0-monitoring`; gli score non mostrano `demo_normalized`; il baseline snapshot non mostra `applied`/`reason`.
2. **§5 "Modulo Sonno: nessun codice esistente"** è superato: il modulo esiste con tabella condivisa e struttura propria (§4).
3. `night.awakenings_estimate`: nel 24h sono "episodi di attivazione stimati" (sequenze HR > mediana × 1,15); nel Sonno la stessa chiave contiene i "risvegli stimati" dal movimento. Stessa chiave, due semantiche: il sito le distingue dal tipo.
4. `night.mean_hr_night` / `min_hr_night` nelle righe sleep contengono il **polso** (PR), non HR da RR.
5. `MonitoringSummary.fromJson` in Dart, applicata a una riga sleep, produce percentuali a zero e `stress_recovery_balance = 0`: il sito non deve mai passare da lì (tipo discriminato).
6. `MONITORAGGIO_ALGORITMO.md` §4 dice notte `detected: false` quando dagli eventi: coerente col Dart (`detected` = true solo se rilevata dall'HR). Nelle righe sleep è sempre `false` pur non venendo da eventi.
7. La RPC `get_linked_client_monitoring_sessions_by_client_id` dell'app fa il ponte con `lower(p.email) = lower(c.email) OR c.id = p.id::text` e **non usa `clients.client_user_id`** (migrazione 017 del sito): i clienti collegati a mano dal pannello, senza email coincidente, resterebbero invisibili. Il sito la sostituisce (§8) con la stessa firma aggiungendo la via `client_user_id`, come 017 fece per `get_linked_client_sessions_by_client_id`.
8. La doc dice che i `windows` sono "una finestra = un minuto" sulla timeline (`MonitoringTimelinePainter` disegna ogni finestra larga 1 minuto dal suo `s`): il sito fa lo stesso, non usa `e`.
9. Il file RR nel bucket ha, oltre a `rr_ms`, l'array opzionale `t_ms` (istanti di fine in ms dall'inizio, solo modalità Telefono vicino) non citato nella doc.
10. `events_modified_on_web` **non esiste né nell'app né nel DB**: l'app ricalcola la risposta agli eventi solo da `MonitoringService.reanalyze`/`saveEvents` avviati dalla UI. Il sito aggiunge la colonna e scrive `response: null` sugli eventi toccati; **l'app va aggiornata** perché, all'apertura di una sessione con il flag alto, rilanci `reanalyze` e azzeri il flag (nota nel report finale).

---

## 7. Stato reale del database (lettura sola, 11 settembre 2026)

| Verifica | Esito |
|---|---|
| `monitoring_sessions` esiste | sì, **1 riga** (24h, `polar_h10_live`, 417 min, 413 finestre, `1.0.0-monitoring`, `night = null`, copertura 51,6 %, nessun `advanced`, nessun evento, `client_id` valorizzato) |
| `recording_profile` | **colonna assente** (42703): `monitoring_recording_profile.sql` non applicata |
| `sleep_score`, `spo2_storage_path`, `device_serial`, `sample_interval_seconds` | **assenti**: `monitoring_sleep.sql` non applicata |
| bucket `monitoring-rr` | presente |
| bucket `monitoring-spo2` | **assente** |
| RPC `get_monitoring_sessions_for_professional` | presente (200) |
| RPC `get_linked_client_monitoring_sessions_by_client_id` | presente |
| `public.is_superadmin()` | presente |
| `events_modified_on_web` | assente (la aggiunge la 018 del sito) |

Conseguenza: il sito legge le colonne "nuove" con `selectWithMissingColumnFallback`
(stesso hardening delle misurazioni brevi) così la lista non si svuota se
una migrazione dell'app non è ancora applicata; la riga reale è di tipo 1.0 e
attiva il fallback "profilo stimato" (§3.8): 417 min, notte nulla, ≥ 180 min
nelle ore 23-07 locali → `notte`, con gli indici notturni "non disponibili".

---

## 8. Cosa fa il sito (decisioni)

- **Accesso** (`src/lib/monitoring-data.ts`): stessa architettura di `remote-sessions.ts`. Con `SUPABASE_SERVICE_ROLE_KEY` il ponte è ricostruito lato server (`buildBridge`, ora esportato): righe con `professionista_id = pro` ∪ righe con `user_id ∈ account collegati`, `client_id` risolto quando è NULL. Senza service role: lettura con la sessione utente (RLS) + RPC dell'app. Le viste passano **solo** da qui. Le liste non caricano `windows` (250 KB a riga).
- **Tipi** (`src/lib/monitoring-types.ts`): riga base + `Monitoring24hSession` / `SleepSession` discriminate su `monitoring_type`, con i jsonb tipizzati 1:1 sul Dart.
- **RR grezzi**: URL firmata a 120 s generata lato server con la service role dopo aver verificato l'accesso alla riga; il file gzip viene decompresso lato server e servito come CSV. Mai usato per calcolare.
- **Eventi dal sito**: PUT su `/api/monitoring/[id]/events` → aggiorna `events` (gli eventi nuovi/modificati hanno `response: null`), imposta `events_modified_on_web = true`. Il sito mostra "in attesa di ricalcolo" finché l'app non riscrive la riga.
- **Migrazione del sito `supabase-migrations/018_monitoring_site.sql`** (da applicare a mano): colonna `events_modified_on_web` (+ `_at`), RPC bridge riscritta con `client_user_id`, policy superadmin esplicita (ridondante ma allineata a 010/011), `notify pgrst, 'reload schema'`, blocchi `EXCEPTION WHEN OTHERS`.
- **Email**: il sito **non ha** un canale email reale (MessageComposer archivia in `messages` con `delivered: false` e un TODO sulla Edge Function). "Invia al cliente" crea la stessa riga in `messages` con oggetto/testo e il link al PDF cliente; l'allegato vero arriverà con la Edge Function.
- **PDF**: `@react-pdf/renderer` (già in uso), grafici disegnati in SVG nel documento, stesse pagine e stringhe dell'app; variante cliente senza sigle, referenze, Ritmo, Parametri e "Come si calcola".

## 9. Non verificabile senza sessioni reali

- Nessuna riga `sleep` nel DB e migrazione `monitoring_sleep.sql` non applicata: il dettaglio Sonno e il suo PDF sono stati costruiti sui modelli Dart e provati con una riga sintetica generata dalla loro serializzazione, non con un file Checkme reale.
- Nessuna riga `1.1.0-monitoring`: `summary.advanced`, `recording_profile`, `br` e gli indici sono stati provati con una riga sintetica costruita da `toJson` dei modelli Dart.
- Il flusso "evento modificato sul sito → app ricalcola" richiede l'aggiornamento dell'app (§6.10).
- L'invio email reale (Edge Function) non esiste ancora nel sito.
