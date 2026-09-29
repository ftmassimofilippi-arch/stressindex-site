# Glossario i18n IT / EN / DE di Stress Index

Punto di partenza per la traduzione del sito web. Aggiornato al 29 settembre 2026.

## Fonti e convenzioni

I termini vengono dai file di localizzazione dell'app Flutter in
`../hrv_app/lib/l10n/`:

| Sigla nella colonna Fonte | File | Lingue |
|---|---|---|
| `ARB chiave` | `app_it.arb` + `app_en.arb` (UI dell'app) | IT, EN |
| `PDF chiave` | `pdf_strings.dart` (report misurazioni e monitoraggio 24h) | IT, EN, DE |
| `SleepPDF chiave` | `sleep_pdf_strings.dart` (report Sonno) | IT, EN, DE |
| `Glossario chiave` | `parameter_glossary.dart` (schede dei parametri) | IT, EN, DE |
| `Sito file` | codice del sito (`src/`) quando il termine non esiste nell'app | IT |
| `Contesto` | `../hrv_app/docs/STRESS_INDEX_CONTEXT_v4.md` | IT |

Regole applicate:

- **Se un termine esiste nell'app si usa quello.** Non se ne inventano altri.
- **Il tedesco dell'interfaccia è proposto.** L'app ha la UI solo in italiano e
  inglese (`kSupportedLocales = [it, en]`); il tedesco esiste solo nelle stringhe
  dei PDF e nel glossario dei parametri. Ogni cella DE (o EN) seguita da `*` è
  una proposta mia, coerente con il tedesco già presente nei PDF, in forma di
  cortesia "Sie" e registro professionale B2B. Le celle senza `*` sono prese
  dall'app alla lettera.
- Attenzione: i testi tedeschi dei PDF e del glossario rivolti al cliente usano
  il "du" ("dein Nervensystem", "DEIN RHYTHMOGRAMM"). Per il sito, rivolto al
  professionista, si usa il "Sie"; le frasi descrittive del glossario riportate
  qui restano come sono nell'app e vanno adattate al "Sie" se finiscono in UI.
- Le sigle dei parametri (RMSSD, SDNN, DFA α1, VT1, ODI3, SpO₂) restano
  invariate in tutte le lingue.
- Nomi propri invariati: Stress Index, Team Live, Readiness (nel modulo Sport),
  Sleep Score (nel report Sonno), TRIMP, ACWR, TSB, CTL, ATL, Polar H10,
  Checkme O2 Max.
- Il tedesco dei PDF non è del tutto uniforme (vedi "Incoerenze rilevate"):
  per il sito si fissano **Klient** (cliente), **Fachkraft** (professionista),
  **Praxis** (studio), **Sitzung** (sessione), **Bericht** (report).

---

## 1. I cinque score (più il composito)

Il nome in UI è quello di `appScore*`; nei PDF e nelle schede lo Stress si
chiama "Indice di Stress". La colonna DB `score_modulazione_infiammatoria` si
mostra sempre come "Adattamento": mai "modulazione infiammatoria" come claim.

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Score stress (etichetta breve) | Stress | Stress | Stress | ARB `appScoreStress`, `spoScoreStress` |
| Score stress (nome esteso) | Indice di Stress | Stress Index | Stressindex | PDF `stress_score`; Glossario `stressScore`; ARB `resPdfIdxStress` |
| Score recupero | Recupero | Recovery | Erholung | ARB `appScoreRecovery`; PDF `recovery_score`; Glossario `recoveryScore` |
| Score equilibrio (bilancio ANS) | Equilibrio | Balance | Gleichgewicht | ARB `appScoreBalance`; PDF `balance_score`; Glossario `balanceScore` |
| Score energia | Energia | Energy | Energie | ARB `appScoreEnergy`; PDF `energy_score`; Glossario `energyScore` |
| Score adattamento (`score_modulazione_infiammatoria`) | Adattamento | Adaptation | Anpassung | PDF `inflammatory_score`; Glossario `inflammationScore`; ARB `setAlertInflammationDropTitle` ("Low adaptation"). NB: ARB `appScoreAdaptation` in EN dice ancora "Inflammatory Modulation", da non usare sul sito |
| Sottotitolo adattamento | La tua capacità di recupero e adattamento | Your capacity to recover and adapt | Ihre Erholungs- und Anpassungsfähigkeit* | ARB `appScoreAdaptationSubtitle`; DE dal PDF `inflammatory_disclaimer` ("Erholungs- und Anpassungsfähigkeit") |
| Sezione adattamento (maiuscolo) | ADATTAMENTO | ADAPTATION | ANPASSUNG | PDF `inflammatory_section` |
| Score composito (semaforo) | Composito | Composite | Gesamtwert | PDF `composite` |
| Etichetta gruppo | SCORE PROPRIETARI | PROPRIETARY SCORES | PROPRIETARY SCORES | PDF `proprietary_scores` (il DE non è tradotto nell'app; proposta: EIGENE SCORES*) |
| "n su 100" | {n} su 100 | {n} out of 100 | {n} von 100* | ARB `appScoreOutOf100` |
| Disclaimer score | Indicatori di benessere generale. Non sostituiscono il parere di un medico. | General wellness indicators. They do not replace a doctor's advice. | Allgemeine Wellness-Indikatoren. Sie ersetzen nicht den Rat eines Arztes.* | ARB `appScoreDisclaimer`; DE modellato su PDF `disclaimer` |
| Score normalizzato per fascia demografica | Score normalizzato per fascia demografica (età, sesso, livello fitness) | Score normalised for your demographic group (age, sex, fitness level) | Score normalisiert nach demografischer Gruppe (Alter, Geschlecht, Fitnessniveau)* | ARB `appScoreDemoNormalized` |

Descrizione breve dei cinque score (riga "COS'È" del glossario, rivolta al cliente, in DE col "du"):

| Chiave | IT | EN | DE | Fonte |
|---|---|---|---|---|
| `stressScore` | Un punteggio da 0 a 100 che riassume quanta tensione di fondo porta il tuo sistema nervoso: più è alto, più il corpo resta in attivazione. | A score from 0 to 100 summarising how much background tension your nervous system is carrying: the higher it is, the more your body stays switched on. | Ein Wert von 0 bis 100, der zusammenfasst, wie viel Grundanspannung dein Nervensystem trägt: Je höher er ist, desto mehr bleibt dein Körper im Aktivierungsmodus. | Glossario `stressScore` |
| `recoveryScore` | Un punteggio da 0 a 100 che dice quanta capacità ha oggi il tuo corpo di rilassarsi, ripararsi e ricaricarsi. | A score from 0 to 100 showing how much capacity your body has today to relax, repair and recharge. | Ein Wert von 0 bis 100, der zeigt, wie gut dein Körper sich heute entspannen, regenerieren und neu aufladen kann. | Glossario `recoveryScore` |
| `balanceScore` | Un punteggio da 0 a 100 che dice quanto sono proporzionati il sistema che ti attiva e quello che ti calma, cioè quanto sai accelerare e rallentare quando serve. | A score from 0 to 100 showing how well the system that activates you and the one that calms you are in proportion, that is, how well you speed up and slow down when needed. | Ein Wert von 0 bis 100, der zeigt, wie ausgewogen das aktivierende und das beruhigende System zueinander stehen, also wie gut du bei Bedarf hoch- und herunterfährst. | Glossario `balanceScore` |
| `energyScore` | Un punteggio da 0 a 100 che stima quanta riserva ha oggi il tuo corpo per affrontare fatica, allenamento e nuove sfide: la benzina nel serbatoio. | A score from 0 to 100 estimating how much reserve your body has today for effort, training and new challenges: the fuel in the tank. | Ein Wert von 0 bis 100, der schätzt, wie viel Reserve dein Körper heute für Anstrengung, Training und neue Herausforderungen hat: der Treibstoff im Tank. | Glossario `energyScore` |
| `inflammationScore` | Un punteggio da 0 a 100 che stima quanto bene il tuo corpo si adatta ai carichi e torna in equilibrio, grazie al lavoro del nervo che ti fa recuperare. | A score from 0 to 100 estimating how well your body adapts to loads and returns to balance, thanks to the work of the nerve that helps you recover. | Ein Wert von 0 bis 100, der schätzt, wie gut sich dein Körper an Belastungen anpasst und ins Gleichgewicht zurückfindet, dank des Nervs, der dich erholen lässt. | Glossario `inflammationScore` |

---

## 2. Fasce degli score e delle scale

### 2.1 Stress (0-100, alto = più stress)

Nell'app la fascia 85-100 si chiama **Affaticamento**, non "Esaurimento":
"Esaurimento" compare solo nei commenti Dart (`proprietary_scores.dart`) e nel
sito (`GaugeScore.tsx`, `GuideClient.tsx`). Da allineare ad "Affaticamento".

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Fascia 0-25 | Basso | Low | Niedrig | ARB `appStressZoneLow`, `resZoneStressLow`; DE da PDF `low` |
| Fascia 25-50 | Equilibrio | Balance / Balanced | Ausgeglichen* | ARB `appStressZoneBalance` ("Balance"), `resZoneStressBalanced` ("Balanced") |
| Fascia 50-70 | Medio | Medium | Mittel* | ARB `appStressZoneMedium`, `resZoneStressMedium`; DE come PDF `signal_fair` ("mittel") |
| Fascia 70-85 | Alto | High | Hoch* | ARB `appStressZoneHigh`, `resZoneStressHigh` |
| Fascia 85-100 | Affaticamento | Fatigue / Exhaustion | Erschöpfung* | ARB `appStressZoneFatigue` ("Fatigue"), `resZoneStressExhaustion` ("Exhaustion") |
| Badge "alto stress" | Alto stress | High stress | Hoher Stress* | ARB `appStressZoneHighStress` |
| Badge "basso stress" | Basso stress | Low stress | Niedriger Stress* | ARB `appStressZoneLowStress` |
| Descrizione basso | Livello di stress basso, buon equilibrio | Low stress level, good balance | Niedriges Stressniveau, gutes Gleichgewicht* | ARB `resZoneStressLowDesc` |
| Descrizione equilibrio | Stress fisiologico, ben gestito | Physiological stress, well managed | Physiologischer Stress, gut bewältigt* | ARB `resZoneStressBalancedDesc` |
| Descrizione medio | Attivazione moderata o segni di carico accumulato | Moderate activation or signs of accumulated load | Mäßige Aktivierung oder Anzeichen angesammelter Belastung* | ARB `resZoneStressMediumDesc` |
| Descrizione alto | Stress elevato e/o ridotta capacità di adattamento | High stress and/or reduced ability to adapt | Hoher Stress und/oder verminderte Anpassungsfähigkeit* | ARB `resZoneStressHighDesc` |
| Descrizione affaticamento | Sotto forte pressione, riserve di energia molto ridotte | Under strong pressure, energy reserves very low | Unter starkem Druck, Energiereserven stark reduziert* | ARB `resZoneStressExhaustionDesc` |

### 2.2 Recupero

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Fascia 1 | Insufficiente | Insufficient | Unzureichend | ARB `resZoneRecoveryInsufficient`; DE da PDF `quality_insufficient` |
| Fascia 2 | Scarso | Poor | Schwach | ARB `resZoneRecoveryPoor`; DE da SleepPDF `score_poor` |
| Fascia 3 | Moderato | Moderate | Mäßig* | ARB `resZoneRecoveryModerate`; DE come SleepPDF `odi_moderate` |
| Fascia 4 | Buono | Good | Gut | ARB `resZoneRecoveryGood`; DE da PDF `good` |
| Fascia 5 | Ottimale | Optimal | Optimal | ARB `resZoneRecoveryOptimal`; DE da PDF `optimal` |
| Sport: recupero buono / basso | Buono / Basso | Good / Low | Gut / Niedrig | ARB `spoRecoveryGood`, `spoRecoveryLow`; DE da PDF |

### 2.3 Equilibrio

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Fascia 1 | Sbilanciamento forte | Strong imbalance | Starkes Ungleichgewicht* | ARB `resZoneBalanceStrongImbalance` |
| Fascia 2 | Sbilanciamento moderato | Moderate imbalance | Mäßiges Ungleichgewicht* | ARB `resZoneBalanceModerateImbalance` |
| Fascia 3 | Sufficiente | Sufficient | Ausreichend | ARB `resZoneBalanceSufficient`; DE da PDF `sufficient` |
| Fascia 4 | Buono | Good | Gut | ARB `resZoneBalanceGood` |
| Fascia 5 | Ottimale | Optimal | Optimal | ARB `resZoneBalanceOptimal` |
| Descrizione (carica/recupero) | Buon equilibrio tra carica e recupero | Good balance between drive and recovery | Gutes Gleichgewicht zwischen Antrieb und Erholung* | ARB `resZoneBalanceGoodDesc` |

### 2.4 Energia

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Fascia 1 | Esaurita | Depleted | Erschöpft* | ARB `resZoneEnergyDepleted` |
| Fascia 2 | Bassa | Low | Niedrig | ARB `resZoneEnergyLow` |
| Fascia 3 | Moderata | Moderate | Mäßig* | ARB `resZoneEnergyModerate` |
| Fascia 4 | Buona | Good | Gut | ARB `resZoneEnergyGood` |
| Fascia 5 | Piena | Full | Voll* | ARB `resZoneEnergyFull` |
| Descrizione piena | Energia piena: ottima disponibilità di risorse | Full energy: excellent resources available | Volle Energie: ausgezeichnete Ressourcen verfügbar* | ARB `resZoneEnergyFullDesc` |

### 2.5 Adattamento

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Fascia 1 | Fragile | Fragile | Fragil* | ARB `resZoneInflammFragile` |
| Fascia 2 | Da migliorare | To improve | Zu verbessern | ARB `resZoneInflammToImprove`; DE da PDF `level_improve` |
| Fascia 3 | Ridotta | Reduced | Reduziert* | ARB `resZoneInflammReduced` |
| Fascia 4 | Buona | Good | Gut | ARB `resZoneInflammGood` |
| Fascia 5 | Eccellente | Excellent | Ausgezeichnet | ARB `resZoneInflammExcellent`; DE da PDF `quality_excellent` |
| Descrizione | Capacità di recupero ridotta, attenzione | Reduced recovery capacity, worth watching | Verminderte Erholungsfähigkeit, beachten* | ARB `resZoneInflammReducedDesc` |

### 2.6 Composito (semaforo dello Stress Index)

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Fascia 1 | Molto basso | Very low | Sehr niedrig* | ARB `resZoneSisVeryLow` |
| Fascia 2 | Sbilanciamento forte | Strong imbalance | Starkes Ungleichgewicht* | ARB `resZoneSisStrongImbalance` |
| Fascia 3 | Sotto pressione | Under pressure | Unter Druck* | ARB `resZoneSisUnderPressure` |
| Fascia 4 | Buono | Good | Gut | ARB `resZoneSisGood` |
| Fascia 5 | Ottimo | Very good | Sehr gut | ARB `resZoneSisVeryGood`; DE da SleepPDF `score_very_good` |
| Fascia 6 | Eccellente | Excellent | Ausgezeichnet | ARB `resZoneSisExcellent` |
| Semaforo: carica | CARICA | DRIVE | ANTRIEB* | ARB `resTrafficLoad` |
| Semaforo: recupero | RECUPERO | RECOVERY | ERHOLUNG | ARB `resTrafficRecovery` |
| Semaforo: equilibrio | EQUILIBRIO | BALANCE | GLEICHGEWICHT | ARB `resTrafficBalance` |

### 2.7 Scale generiche (parametri, qualità, livelli)

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Range parametro: basso | Basso | Low | Niedrig | ARB `appRangeLow`; PDF `low` |
| Range: sotto media | Sotto media | Below average | Unter dem Durchschnitt* | ARB `appRangeBelowAverage` |
| Range: nella norma | Nella norma | In range | Im Normbereich | ARB `appRangeNormal`; DE da SleepPDF `band_normal` |
| Range: buono | Buono | Good | Gut | ARB `appRangeGood` |
| Range: eccellente | Eccellente | Excellent | Ausgezeichnet | ARB `appRangeExcellent` |
| Legenda: fuori norma | Fuori norma / fuori range | Out of range | Außerhalb des Normbereichs* | ARB `appTrendLegendOutOfRange`, `resLegendOutOfRange` |
| "{n} nella norma" | {n} nella norma | {n} in range | {n} im Normbereich* | ARB `resParamsInRange` |
| Range di riferimento | Range di riferimento | Reference range | Referenzbereich | PDF `range_col` |
| Qualità dati (titolo) | Qualità dati | Data quality | Datenqualität | PDF `data_quality` |
| Qualità dati: ottima | Ottima | Excellent | Ausgezeichnet | PDF `quality_excellent`; ARB `resQualityExcellent` |
| Qualità dati: buona | Buona | Good | Gut | PDF `quality_good` |
| Qualità dati: minima | Minima | Minimal | Minimal | PDF `quality_minimal` |
| Qualità dati: insufficiente | Insufficiente | Insufficient | Unzureichend | PDF `quality_insufficient` |
| Qualità segnale (monitoraggio): buona / media / insufficiente | buona / media / insufficiente | good / medium / insufficient | gut / mittel / unzureichend | PDF `signal_good`, `signal_fair`, `signal_poor` |
| Qualità segnale (sonno): ottimo / discreto / disturbato | Segnale ottimo / discreto / disturbato | Excellent / Fair / Poor signal | sehr gut / ausreichend / gestört | ARB `slpSignalGood/Fair/Poor`; SleepPDF `signal_good/fair/poor` |
| Qualità segnale (sport): buona / media / bassa | buona / media / bassa | good / fair / low | gut / mittel / niedrig* | ARB `spoSignalQualityGood/Fair/Poor` |
| Livello indice (monitoraggio) | buono / nella media / da migliorare | good / average / to improve | gut / durchschnittlich / zu verbessern | PDF `level_good`, `level_average`, `level_improve`; ARB `msvLevel*` |
| Qualità notte (wearable) | Da migliorare / Discreto / Buono / Ottimo | To improve / Fair / Good / Excellent | Zu verbessern / Mittel* / Gut / Ausgezeichnet | ARB `ngtQualityToImprove`, `ngtQualityFair`, `ngtQualityGood`, `ngtQualityExcellent` |
| Sleep Score: fasce | scarso / sufficiente / buono / molto buono / ottimo | poor / sufficient / good / very good / excellent | schwach / ausreichend / gut / sehr gut / ausgezeichnet | SleepPDF `score_poor` … `score_excellent`; ARB `slpScore*` |
| Fascia ODI/T90 | nella norma / da osservare / rilevante | within range / to watch / relevant | im Normbereich / zu beobachten / relevant | SleepPDF `band_normal`, `band_observe`, `band_relevant` |
| Alterazione ODI | nella norma / lieve / moderata / marcata | within range / mild / moderate / marked | im Normbereich / leicht / mäßig / ausgeprägt | SleepPDF `odi_normal` … `odi_marked` |
| Reattività ortostatica | Reattività nella norma / ridotta / Risposta eccessiva | Reactivity within range / Reduced reactivity / Excessive response | Reaktivität im Normbereich / Verminderte Reaktivität / Übermäßige Reaktion | PDF `ortho_reactivity_normal/reduced/excessive` |
| Coerenza: livelli | Coerenza elevata / moderata / bassa | High / Moderate / Low coherence | Hohe / Mittlere / Niedrige Kohärenz | PDF `coh_level_high/moderate/low` |
| Readiness (sport) | Pronto / Moderato / Recupero necessario | Ready / Moderate / Recovery needed | Bereit* / Mäßig* / Erholung nötig* | ARB `spoReadinessReady`, `spoReadinessModerate`, `spoReadinessRecoveryNeeded` |
| Check-in mattutino: scala sonno | Pessimo … Ottimo | Very poor … Excellent | Sehr schlecht* … Ausgezeichnet | ARB `spoScaleVeryBad`, `spoScaleExcellent` |
| Check-in: scala energia | Esausto … Pieno | Drained … Full | Erschöpft* … Voll* | ARB `spoScaleExhausted`, `spoScaleFull` |
| Contesto: qualità sonno | Ottima / Buona / Scarsa / Pessima | Excellent / Good / Poor / Very poor | Ausgezeichnet / Gut / Schlecht* / Sehr schlecht* | ARB `homeOptionExcellent/Good/Poor/VeryPoor` |
| Contesto: attività | Nessuna / Leggera / Moderata / Intensa | None / Light / Moderate / Intense | Keine* / Leicht* / Mäßig* / Intensiv* | ARB `homeOptionNone/Light/Moderate/Intense` |
| Contesto: stress percepito | Basso / Medio / Alto / Molto alto | Low / Medium / High / Very high | Niedrig / Mittel* / Hoch* / Sehr hoch* | ARB `homeOptionLow/Medium/High/VeryHigh` |
| Contesto: stato emotivo | Sereno / Neutro / Teso / Molto teso | Calm / Neutral / Tense / Very tense | Ruhig* / Neutral / Angespannt* / Sehr angespannt* | ARB `homeOptionCalm/Neutral/Tense/VeryTense` |

---

## 3. Tipi di test e misurazione

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Tipo di test (titolo) | Tipo di test | Test type | Testtyp* | ARB `appTestTypeTitle` |
| Misurazione standard | Misurazione standard | Standard measurement | Standardmessung* | ARB `appTestStandardTitle` (home: "Misurazione Standard", `homeTestStandardTitle`) |
| Test ortostatico | Test ortostatico | Orthostatic test | Orthostatischer Test* | ARB `appTestOrthoTitle` (home: "Test Ortostatico"); PDF `ortho_page_title` "Analisi ortostatica / Orthostatic analysis / Orthostatische Analyse" |
| Respirazione di coerenza | Respirazione di coerenza | Coherence breathing | Kohärenzatmung* | ARB `appCoherenceSheetTitle`; PDF `coh_page_title` "Analisi di coerenza / Coherence analysis / Kohärenzanalyse" |
| Misurazioni lunghe (sezione home) | Misurazioni lunghe | Long measurements | Langzeitmessungen* | ARB `homeLongMeasurements` |
| Hint misurazioni lunghe | Fascia o saturimetro indossati per molte ore, notte inclusa | Strap or pulse oximeter worn for many hours, overnight included | Brustgurt oder Pulsoximeter über viele Stunden getragen, auch nachts* | ARB `homeLongMeasurementsHint` |
| Monitoraggio 24h | Monitoraggio 24h | 24h monitoring | 24h-Monitoring | ARB `mon24hTitle`, `msvTypeH24`; PDF `title` "24h-Monitoring-Bericht" |
| Modulo Monitoraggio | Monitoraggio | Monitoring | Monitoring | ARB `monModuleName`; PDF `module` |
| Notte | Notte | Night | Nacht | ARB `monTileNight`, `ngtNight`; PDF `series_night` |
| Sonno (modulo Checkme O2 Max) | Sonno | Sleep | Schlaf | ARB `slpModuleTitle`, `msvTypeSleep`; SleepPDF `module` |
| Sottotitolo Sonno | Ossigenazione e polso di tutta la notte | Oxygen level and pulse rate through the night | Sauerstoffsättigung und Puls über die ganze Nacht* | ARB `slpModuleSubtitle` |
| Notte dal wearable | Wearable | Wearable | Wearable | ARB `ngtSourceWearable` |
| Sport (sessione) | Sport | Sport | Sport | ARB `appKindSport` |
| Sessione Live (sport) | Sessione Live | Live session | Live-Sitzung* | ARB `spoTabLive` |
| Test incrementale (tipo) | Test incrementale | Incremental test | Stufentest* | ARB `appKindThresholdTest` |
| Tipo (filtro storico): standard | Standard | Standard | Standard | ARB `appKindStandard` |
| Tipo: ortostatico | Ortostatico | Orthostatic | Orthostatisch* | ARB `appKindOrthostatic` |
| Tipo: coerenza | Coerenza | Coherence | Kohärenz | ARB `appKindCoherence`; PDF `coh_*` |
| Tipo: monitoraggio | Monitoraggio | Monitoring | Monitoring | ARB `appKindMonitoring` |
| Tipo: sonno | Sonno | Sleep | Schlaf | ARB `appKindSleep` |
| Filtro: tutti i test | Tutti i test | All tests | Alle Tests* | ARB `appFilterAllKinds` |
| Misurazione (attività generica) | Misurazione | Measurement | Messung | ARB `cliActivityKindSession`; PDF `breathing_footnote` ("Messung") |
| Durata: libera | Libera | Free | Frei* | ARB `homeDurationFree` |
| Durata: manuale | Manuale | Manual | Manuell* | ARB `homeDurationManual` |
| Durata: {n} minuti | {n} minuti | {n} minutes | {n} Minuten | ARB `homeDurationMinutes`; PDF `minutes_col` |
| Durata: approfondito | Approfondito · prima valutazione | In depth · first assessment | Ausführlich · erste Bewertung* | ARB `homeDurationDeep` |
| Profilo monitoraggio: breve | Breve | Short | Kurz | PDF `profile_breve`; ARB `msvProfileShort` |
| Profilo: giornata | Giornata | Daytime / Day | Tag | PDF `profile_giornata`; ARB `msvProfileDay` |
| Profilo: notte | Notte | Night | Nacht | PDF `profile_notte` |
| Profilo: giorno e notte | Giorno e notte | Day and night | Tag und Nacht | PDF `profile_giorno_notte` |
| Profilo: ciclo completo | Ciclo completo | Full cycle | Voller Zyklus | PDF `profile_ciclo_completo` |
| Supino / In piedi | Supino / In piedi | Lying down / Standing | Liegend / Stehend | PDF `ortho_supine`, `ortho_standing` |
| Confronto supino-in piedi | Confronto supino ↔ in piedi | Lying down ↔ standing comparison | Vergleich Liegen ↔ Stehen | PDF `ortho_comparison` |
| Indice di reattività ortostatica | Indice di reattività ortostatica | Orthostatic reactivity index | Index der orthostatischen Reaktivität | PDF `ortho_reactivity_title` |
| Score di coerenza | Score di coerenza | Coherence score | Kohärenz-Score | PDF `coh_score_title` |
| Frequenza target (coerenza) | Frequenza target | Target rate | Zielfrequenz | PDF `coh_target_rate` |
| resp/min | resp/min | breaths/min | Atemzüge/min | PDF `coh_rate_unit` |
| Frequenza di risonanza | Frequenza di risonanza | Resonance rate | Resonanzfrequenz | PDF `coh_resonance` |
| Respirazione guidata (nota) | Misurazione con respirazione guidata | Guided-breathing measurement | Messung mit geführter Atmung | PDF `breathing_footnote` |
| Evoluzione nel tempo (lunga) | Evoluzione nel tempo | Change over time | Verlauf über die Zeit | PDF `long_evolution` |
| Sessione {min} min · {n} segmenti | Sessione {min} min · {n} segmenti da 2 minuti | Session {min} min · {n} segments of 2 minutes | Sitzung {min} min · {n} Abschnitte à 2 Minuten | PDF `long_session_sub` |
| Effetto sessione | Effetto sessione | Session effect | Wirkung der Sitzung | PDF `effect_title` |

---

## 4. Sistema nervoso autonomo

L'interfaccia dell'app evita quasi sempre il gergo: "il nervo che ti fa
recuperare", "il sistema che ti attiva e quello che ti calma". I termini
tecnici vivono nel manuale del glossario (solo IT) e nelle referenze. Per il
sito, rivolto al professionista, si usano i termini sotto; EN e DE proposti
seguono il glossario ("vagus nerve" / "Vagusnerv", "Nervensystem").

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Sistema nervoso autonomo | sistema nervoso autonomo | autonomic nervous system | autonomes Nervensystem* | Glossario manuale ("Master HRV, capitolo 2 · Il sistema nervoso autonomo"); DE "Nervensystem" in Glossario `stressScore` |
| Sistema autonomo (forma breve) | sistema autonomo | autonomic system | autonomes System* | Glossario manuale `stressScore` |
| Simpatico | simpatico | sympathetic | Sympathikus* | Glossario manuale `balanceScore` ("simpatico e parasimpatico") |
| Parasimpatico | parasimpatico | parasympathetic | Parasympathikus* | Glossario manuale `balanceScore` |
| Nervo vago | nervo vago | vagus nerve | Vagusnerv | Glossario `sd1`, `hfPower` (IT/EN/DE) |
| Vagale | vagale | vagal | vagal* | Glossario manuale `rmssd` ("marker vagale") |
| Tono vagale | tono vagale | vagal tone | Vagotonus* | Glossario manuale `sdnn` |
| Riserva vagale / parasimpatica | riserva parasimpatica vagale | vagal parasympathetic reserve | vagale parasympathische Reserve* | Glossario manuale `recoveryScore` |
| Riserva autonomica | riserve autonomiche | autonomic reserves | autonome Reserven* | ARB `resZoneEnergyDepletedDesc` |
| Attivazione (stato) | Attivazione | Activation | Aktivierung | PDF `legend_stress`, `resp_activation` |
| Recupero (stato) | Recupero | Recovery | Erholung | PDF `legend_recovery`, `resp_recovery` |
| Attività (stato) | Attività | Activity | Aktivität | PDF `legend_activity` |
| Neutro (stato) | Neutro | Neutral | Neutral | PDF `legend_neutral` |
| Carica (vs recupero) | carica | drive | Antrieb* | ARB `resTrafficLoad`, `resZoneBalanceGoodDesc` |
| Bilancio della giornata | Bilancio della giornata | Balance of the day | Bilanz des Tages | PDF `balance`; Glossario `monitoring_balance`; ARB `monResultDayBalance` |
| Equilibrio (bilancio ANS in UI) | Equilibrio | Balance | Gleichgewicht | ARB `appScoreBalance` (il sito non usa "Bilancio ANS": l'app dice "Equilibrio") |
| Reattività autonomica | reattività autonomica | autonomic reactivity | autonome Reaktivität* | Glossario manuale `monitoring_event_response`; PDF `ortho_reactivity_*` |
| Variabilità del battito (HRV) | variabilità del battito | heart rate variability | Herzfrequenzvariabilität | PDF `disclaimer` (IT "variabilità del battito", EN "heart rate variability", DE "Herzfrequenzvariabilität") |
| HRV (sigla) | HRV | HRV | HRV | PDF `hrv_monitor`, `all_indices` |
| Intervalli RR | intervalli RR / campioni RR | RR intervals / RR samples | RR-Intervalle / RR-Proben | Glossario `cv`; PDF `samples` |
| Battito | Battito | Heartbeat | Herzschlag | ARB `homeHeartbeat`; Glossario DE `monitoring_fragmentation` ("Ordnung des Herzschlags") |
| Frequenza cardiaca | Frequenza cardiaca (bpm) | Heart rate (bpm) | Herzfrequenz (bpm) | PDF `trend_hr` |
| Polso (saturimetro) | Polso | Pulse | Puls | SleepPDF `pr` |

---

## 5. Parametri HRV

### 5.1 Nomi (sigla invariata)

| Chiave | IT | EN | DE | Unità | Fonte |
|---|---|---|---|---|---|
| `rmssd` | RMSSD | RMSSD | RMSSD | ms | Glossario `rmssd` |
| `sdnn` | SDNN | SDNN | SDNN | ms | Glossario `sdnn` |
| `pnn50` | pNN50 | pNN50 | pNN50 | % | Glossario `pnn50` |
| `pnn20` | pNN20 | pNN20 | pNN20 | % | Glossario `pnn20` |
| `cv` | CV degli intervalli RR | CV of RR intervals | VK der RR-Intervalle | % | Glossario `cv` |
| `meanBpm` | Frequenza cardiaca media | Average heart rate | Durchschnittliche Herzfrequenz | bpm | Glossario `meanBpm` |
| HR media (abbreviato) | HR media | Mean HR | Mittlere HF | bpm | PDF `ortho_row_hr`, `hr_mean_night`; ARB `monParamMeanHr` |
| BPM medio | BPM medio | Mean BPM | Mittlere BPM | bpm | PDF `mean_bpm` |
| `rmssdSdnnRatio` | RMSSD/SDNN | RMSSD/SDNN | RMSSD/SDNN | | Glossario `rmssdSdnnRatio` |
| `dfaAlpha1` | DFA α1 | DFA α1 | DFA α1 | | Glossario `dfaAlpha1` |
| `dfaAlpha2` | DFA α2 | DFA α2 | DFA α2 | | Glossario `dfaAlpha2` |
| `stressIndex` (Baevsky) | Stress Index di Baevsky | Baevsky Stress Index | Baevsky-Stressindex | | Glossario `stressIndex` (da non confondere con lo score "Indice di Stress") |
| `sd1` | SD1 (Poincaré) | SD1 (Poincaré) | SD1 (Poincaré) | ms | Glossario `sd1` |
| `sd2` | SD2 (Poincaré) | SD2 (Poincaré) | SD2 (Poincaré) | ms | Glossario `sd2` |
| `sd1Sd2Ratio` | SD1/SD2 | SD1/SD2 | SD1/SD2 | | Glossario `sd1Sd2Ratio` |
| `sampEn` | Entropia campionaria (SampEn) | Sample entropy (SampEn) | Stichprobenentropie (SampEn) | | Glossario `sampEn` |
| `apEn` | Entropia approssimata (ApEn) | Approximate entropy (ApEn) | Approximative Entropie (ApEn) | | Glossario `apEn` |
| `vlfPower` | Potenza VLF | VLF power | VLF-Leistung | ms² | Glossario `vlfPower` |
| `lfPower` | Potenza LF | LF power | LF-Leistung | ms² | Glossario `lfPower` |
| `hfPower` | Potenza HF | HF power | HF-Leistung | ms² | Glossario `hfPower` |
| `totalPower` | Potenza totale | Total power | Gesamtleistung | ms² | Glossario `totalPower`; ARB `monParamTotalPower` |
| `lfHfRatio` | Rapporto LF/HF | LF/HF ratio | LF/HF-Verhältnis | | Glossario `lfHfRatio` (nei testi nuovi il Contesto §13 chiede di non citare LF/HF) |
| `lfNorm` | LF normalizzata | Normalised LF | Normalisierte LF | n.u. | Glossario `lfNorm` |
| `hfNorm` | HF normalizzata | Normalised HF | Normalisierte HF | n.u. | Glossario `hfNorm` |
| `lfVlfRatio` | Rapporto LF/VLF | LF/VLF ratio | LF/VLF-Verhältnis | | Glossario `lfVlfRatio` |
| `tinn` | TINN | TINN | TINN | ms | Glossario `tinn` |
| `hrvTriangularIndex` | Indice triangolare HRV | HRV triangular index | HRV-Dreiecksindex | | Glossario `hrvTriangularIndex` |
| Frequenza respiratoria | Frequenza respiratoria | Breathing rate | Atemfrequenz* | resp/min | ARB `appCoherenceRateSection`; DE da Glossario `resp_rate` ("Nächtliche Atemfrequenz") |
| Respiro stimato | Respiro stimato | Estimated breathing | Geschätzte Atmung | atti/min | Glossario `monitoring_respiration`; ARB `ngtPointRespTitle` |
| Respiro (abbreviato) | Respiro | Breathing | Atmung | | ARB `monNightRespLabel`, `ngtMetricResp` |
| Bande lente (ULF, VLF) | Bande lente (ULF, VLF) | Slow bands (ULF, VLF) | Langsame Bänder (ULF, VLF) | ms² | Glossario `monitoring_ulf_vlf` |
| Gruppi PDF | TIME DOMAIN / FREQUENCY DOMAIN / STRESS & NON-LINEAR / GEOMETRIC | idem | ZEITBEREICH / FREQUENZBEREICH / STRESS & NICHTLINEAR / GEOMETRISCH | | PDF `time_domain`, `freq_domain`, `stress_nonlinear`, `geometric` |
| Ritmogramma | Ritmogramma RR | Rhythmogram | Rhythmogramm | | PDF `rhythmogram` ("IL TUO RITMOGRAMMA / YOUR RHYTHMOGRAM / DEIN RHYTHMOGRAMM"), `night_rhythm` |
| Diagramma di Poincaré | Diagramma di Poincaré | Poincaré diagram | Poincaré-Diagramm | | PDF `poincare_histogram` |
| Istogramma RR | Istogramma RR | RR histogram | RR-Histogramm | | PDF `poincare_histogram` |
| Spettro di potenza (PSD) | Spettro di potenza HRV (PSD) | HRV power spectral density (PSD) | HRV-Leistungsdichtespektrum (PSD) | | PDF `psd` |
| Colonne tabella | Parametro / Valore / Unità | Parameter / Value / Unit | Parameter / Wert / Einheit | | PDF `param_col`, `value_col`, `unit_col` |
| Interpretazione e note | Interpretazione e Note | Interpretation & Notes | Interpretation & Notizen | | PDF `interpretation` |
| Baseline | Baseline | Baseline | Baseline* | | ARB `monKvBaseline`, `ngtColBaseline`; PDF `rhythm_rest_none` ("Baseline") |
| Riferimento a riposo | Riferimento a riposo usato | Resting reference used | Verwendete Ruhereferenz | | PDF `rhythm_rest` |

### 5.2 Descrizione breve (riga "COS'È" del glossario, rivolta al cliente)

| Chiave | IT | EN | DE |
|---|---|---|---|
| `rmssd` | Misura quanto cambia la distanza fra un battito e il successivo: è il segno più diretto del nervo che rallenta il cuore e ti fa recuperare. | It measures how much the gap between one heartbeat and the next changes: it is the most direct sign of the nerve that slows your heart and helps you recover. | Er misst, wie stark sich der Abstand zwischen einem Herzschlag und dem nächsten verändert: das direkteste Zeichen des Nervs, der dein Herz verlangsamt und dich erholen lässt. |
| `sdnn` | Misura quanto varia in tutto la distanza fra i battiti durante la misurazione: è la riserva complessiva di adattamento del tuo sistema nervoso. | It measures how much the gap between heartbeats varies overall during the measurement: it is the total adaptation reserve of your nervous system. | Er misst, wie stark der Abstand zwischen den Herzschlägen während der Messung insgesamt schwankt: die gesamte Anpassungsreserve deines Nervensystems. |
| `pnn50` | La percentuale di battiti consecutivi la cui distanza cambia di più di 50 millisecondi: dice quanto spesso entra in azione il nervo che ti fa recuperare. | The percentage of consecutive heartbeats whose gap changes by more than 50 milliseconds: it shows how often the nerve that helps you recover steps in. | Der Anteil aufeinanderfolgender Herzschläge, deren Abstand sich um mehr als 50 Millisekunden ändert: Er zeigt, wie oft der Nerv eingreift, der dich erholen lässt. |
| `meanBpm` | Quante volte al minuto batte il tuo cuore, in media, durante la misurazione a riposo. | How many times per minute your heart beats, on average, during the resting measurement. | Wie oft dein Herz während der Messung in Ruhe durchschnittlich pro Minute schlägt. |
| `sd1` | Misura quanto cambia ogni battito rispetto al precedente, come larghezza della nuvola di punti dei battiti: rispecchia il lavoro del nervo vago che rallenta il cuore. | It measures how much each beat changes from the previous one, as the width of the cloud of beat points: it mirrors the vagus nerve slowing the heart. | Er misst, wie stark sich jeder Schlag vom vorherigen unterscheidet, als Breite der Punktwolke der Schläge: Er spiegelt die Arbeit des Vagusnervs, der das Herz bremst. |
| `sd2` | Misura le variazioni più lente del battito, come lunghezza della nuvola di punti dei battiti: riflette la ricchezza complessiva della regolazione del cuore. | It measures the slower changes in your heartbeat, as the length of the cloud of beat points: it reflects the overall richness of heart regulation. | Er misst die langsameren Schwankungen des Herzschlags, als Länge der Punktwolke der Schläge: Er spiegelt den Reichtum der gesamten Herzregulation. |
| `sd1Sd2Ratio` | Confronta la larghezza e la lunghezza della nuvola di punti dei battiti: dice quanto pesano le variazioni rapide rispetto a quelle lente. | It compares the width and the length of the cloud of beat points: it tells how much the fast changes weigh against the slow ones. | Er vergleicht Breite und Länge der Punktwolke der Schläge: Er zeigt, wie stark die schnellen Schwankungen gegenüber den langsamen ins Gewicht fallen. |
| `dfaAlpha1` | Misura quanto è ordinata la sequenza dei battiti: a riposo un valore vicino a 1 indica un sistema flessibile e ben regolato. | It measures how orderly the sequence of heartbeats is: at rest a value close to 1 points to a flexible, well-regulated system. | Er misst, wie geordnet die Abfolge der Herzschläge ist: In Ruhe deutet ein Wert nahe 1 auf ein flexibles, gut reguliertes System hin. |
| `dfaAlpha2` | Descrive quanto è ordinato il ritmo del cuore su tratti più lunghi, di qualche decina di battiti: quanto le variazioni di adesso somigliano a quelle appena passate. | It describes how orderly your heart rhythm is over longer stretches of a few dozen beats: how much the current changes resemble the ones just before. | Er beschreibt, wie geordnet dein Herzrhythmus über längere Abschnitte von einigen Dutzend Schlägen ist: wie sehr die aktuellen Schwankungen den vorherigen ähneln. |
| `stressIndex` | Indica quanto è rigido il ritmo del cuore: più i battiti durano tutti uguali, più il numero sale, segno di un organismo in tensione. | It shows how rigid your heart rhythm is: the more your beats all last the same, the higher the number, a sign of a body under tension. | Er zeigt, wie starr dein Herzrhythmus ist: Je gleichförmiger die Schläge dauern, desto höher die Zahl, ein Zeichen für einen Körper unter Anspannung. |
| `vlfPower` | Misura la forza delle oscillazioni più lente del battito, quelle legate alla temperatura del corpo, agli ormoni e al metabolismo. | It measures the strength of the slowest oscillations in your heartbeat, the ones linked to body temperature, hormones and metabolism. | Sie misst die Stärke der langsamsten Schwankungen des Herzschlags, die mit Körpertemperatur, Hormonen und Stoffwechsel zusammenhängen. |
| `lfPower` | Misura la forza delle oscillazioni medie del battito, di alcuni secondi, legate al controllo della pressione e al lavoro combinato di ciò che accelera e rallenta il cuore. | It measures the strength of the mid-speed oscillations in your heartbeat, lasting a few seconds, linked to blood pressure control and to the combined work of what speeds up and slows down the heart. | Sie misst die Stärke der mittleren Schwankungen des Herzschlags von einigen Sekunden, die mit der Blutdruckregelung und dem Zusammenspiel von Beschleunigung und Bremsung des Herzens zusammenhängen. |
| `hfPower` | Misura la forza delle oscillazioni del battito che seguono il respiro, più veloce quando inspiri e più lento quando espiri: è il nervo vago al lavoro. | It measures the strength of the heartbeat oscillations that follow your breathing, faster as you breathe in and slower as you breathe out: it is the vagus nerve at work. | Sie misst die Stärke der Herzschlagschwankungen, die dem Atem folgen, schneller beim Einatmen und langsamer beim Ausatmen: Das ist der Vagusnerv bei der Arbeit. |
| `totalPower` | Somma la forza di tutte le oscillazioni del battito, lente, medie e veloci: è la riserva complessiva di variabilità del tuo organismo. | It adds up the strength of all your heartbeat oscillations, slow, medium and fast: it is your body's overall reserve of variability. | Sie addiert die Stärke aller Schwankungen des Herzschlags, langsam, mittel und schnell: Sie ist die gesamte Variabilitätsreserve deines Körpers. |
| `lfHfRatio` | Confronta le oscillazioni medie del battito con quelle legate al respiro: un tempo letto come equilibrio fra attivazione e recupero, oggi è solo un indicatore da seguire nel tempo. | It compares the mid-speed heartbeat oscillations with those linked to breathing: once read as a balance between arousal and recovery, today it is only an indicator to follow over time. | Es vergleicht die mittleren Schwankungen des Herzschlags mit denen, die an die Atmung gebunden sind: Früher als Gleichgewicht zwischen Aktivierung und Erholung gelesen, heute nur ein Verlaufsindikator. |
| `monitoring_respiration` | Quanti respiri al minuto fai, stimati dal tuo battito e non misurati direttamente: di notte dovrebbe scendere. | How many breaths per minute you take, estimated from your heartbeat rather than measured directly: at night it should go down. | Wie viele Atemzüge pro Minute du machst, geschätzt aus deinem Herzschlag und nicht direkt gemessen: Nachts sollte sie sinken. |

---

## 6. Etichette (tag) e contesto delle misurazioni

I tag sono salvati con chiave neutra in `sessions.tags` (`morning`,
`guided_breathing`, `pre_session`, `post_session`, `pre_workout`,
`post_workout`, `general` + liberi) e tradotti in visualizzazione (Contesto §11).

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Etichetta misurazione (titolo) | Etichetta misurazione | Measurement label | Etikett der Messung* | ARB `appTagPickerTitle`; PDF `label` ("Etichetta / Label / Etikett") |
| `morning` | Misurazione mattutina | Morning measurement | Morgenmessung* | ARB `appMeasTagMorning` |
| `guided_breathing` | Respirazione guidata | Guided breathing | Geführte Atmung* | ARB `appMeasTagGuidedBreathing`; DE da PDF `breathing_footnote` |
| `pre_session` | Pre sessione | Before session | Vor der Sitzung* | ARB `appMeasTagPreSession` |
| `post_session` | Post sessione | After session | Nach der Sitzung* | ARB `appMeasTagPostSession` |
| `pre_workout` | Pre allenamento | Before workout | Vor dem Training* | ARB `appMeasTagPreWorkout` |
| `post_workout` | Post allenamento | After workout | Nach dem Training* | ARB `appMeasTagPostWorkout` |
| `general` | Monitoraggio generico | General check-in | Allgemeiner Check-in* | ARB `appMeasTagGeneral` |
| Tag personalizzato | Tag personalizzato / Altro... (tag personalizzato) | Custom tag / Other... (custom tag) | Eigenes Etikett* | ARB `setTagsCustomCta`, `appTagPickerCustomHint` |
| Tag sessione (impostazioni, live) | Tag Sessione | Session Tags | Sitzungs-Etiketten* | ARB `setTagsTitle`, `setTagsSectionHeader` |
| Categoria tag: professionale / sport / personalizzato | Professionale / Sport / Personalizzato | Professional / Sport / Custom | Fachlich* / Sport / Benutzerdefiniert* | ARB `setTagsCatProfessional`, `setTagsCatSport`, `setTagsCatCustom` |
| Inizio / fine sessione (tag live) | Inizio sessione / Fine sessione | Session start / Session end | Sitzungsbeginn* / Sitzungsende* | ARB `appTagSessionStart`, `appTagSessionEnd` |
| Contesto della misurazione (titolo) | CONTESTO DELLA MISURAZIONE | MEASUREMENT CONTEXT | KONTEXT DER MESSUNG* | ARB `resContextTitle` |
| Contesto: sonno | Sonno | Sleep | Schlaf | ARB `resContextSleep` |
| Contesto: attività fisica | Attività fisica | Physical activity | Körperliche Aktivität* | ARB `resContextActivity` |
| Contesto: stress percepito | Stress percepito | Perceived stress | Empfundener Stress* | ARB `resContextStress` |
| Contesto: caffeina | Caffeina | Caffeine | Koffein* | ARB `resContextCaffeine` |
| Contesto: stato emotivo | Stato emotivo | Mood | Stimmung* | ARB `resContextMood` |
| Prima / Dopo | Prima / Dopo | Before / After | Vorher / Nachher | PDF `cmp_before`, `cmp_after`, `ev_before`, `ev_after`; ARB `resCmpBeforeShort`, `resCmpAfterShort` |
| Prima e dopo (sezione) | Prima e dopo | Before and after | Vorher und Nachher* | ARB `resBeforeAfterTitle` |
| Coppia: trattamento (pre/post sessione) | Trattamento | Session | Sitzung | ARB `resBeforeAfterKindTreatment` (EN evita "treatment"); DE da PDF `effect_title` |
| Coppia: allenamento (pre/post allenamento) | Allenamento | Workout | Training | ARB `resBeforeAfterKindWorkout`; DE da PDF `sleep_efficiency`/Glossario ("Training"); ARB `msvEventTraining` "Allenamento / Training" |
| Origine: in studio | In studio | In studio | In der Praxis* | ARB `cliSourceInStudio`; DE da PDF `studio` ("Praxis") |
| Origine: da remoto | Da remoto | Remote | Remote* | ARB `cliSourceRemote` |
| Eventi (monitoraggio): allenamento / altro / mi sono svegliato | Allenamento / Altro / Mi sono svegliato | Training / Other / I woke up | Training / Sonstiges* / Ich bin aufgewacht* | ARB `msvEventTraining`, `msvEventOther`, `msvEventWakeUp` |

---

## 7. Modulo Sport

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Modulo Sport | Modulo Sport | Sport module* | Sport-Modul* | Sito `sport/page.tsx` ("Modulo Sport · Piano Pro"); ARB `setTagsCatSport` "Sport" |
| Atleta | Atleta | Athlete | Sportler | ARB `spoAthlete`, `cliFieldAthlete`; PDF `athlete` |
| Nessun atleta selezionato | Nessun atleta selezionato | No athlete selected | Kein Sportler ausgewählt* | ARB `spoNoAthleteSelected` |
| Seleziona atleta | Seleziona atleta | Select athlete | Sportler auswählen* | ARB `spoSelectAthlete` |
| Sessione sport | Sessione sport | Sport session | Sport-Sitzung* | ARB `spoNoSessionsTitle`, `spoStartSportSession` ("Avvia Sessione Sport / Start sport session") |
| Sessione Live (tab) | Sessione Live | Live session | Live-Sitzung* | ARB `spoTabLive` |
| Team (tab) | Team | Team | Team | ARB `spoTabTeam` |
| Team Live (sito) | Team Live | Team Live | Team Live | Sito `Sidebar.tsx`, `sport/team-live/page.tsx`; nell'app solo nei commenti del codice (`sport_live_screen.dart`) |
| Sessione completata | Sessione completata | Session completed | Sitzung abgeschlossen* | ARB `spoSessionCompleted` |
| Riepilogo sessione | Riepilogo Sessione | Session summary | Zusammenfassung der Sitzung* | ARB `spoPdfSummarySection` |
| Readiness | Readiness | Readiness | Readiness | ARB `spoReadinessUpper`, `spoReadinessScoreLabel` ("READINESS SCORE"); l'IT tiene l'inglese |
| Calcola Readiness | Calcola Readiness | Calculate readiness | Readiness berechnen* | ARB `spoComputeReadiness` |
| Check-in mattutino | Check-in mattutino | Morning check-in | Morgen-Check-in* | ARB `spoReadinessSectionTitle` |
| Trend Readiness 30 giorni | Trend Readiness, ultimi 30 giorni | Readiness trend, last 30 days | Readiness-Verlauf, letzte 30 Tage* | ARB `spoReadinessTrend30` |
| Prontezza di recupero (monitoraggio, DC) | Prontezza di recupero | Recovery readiness | Erholungsbereitschaft | Glossario `monitoring_dc` |
| Prontezza di reazione (monitoraggio, AC) | Prontezza di reazione | Reaction readiness | Reaktionsbereitschaft | Glossario `monitoring_ac` |
| Scale check-in: sonno / energia / motivazione / dolore muscolare | Sonno / Energia / Motivazione / Dolore muscolare | Sleep / Energy / Motivation / Muscle soreness | Schlaf / Energie / Motivation* / Muskelschmerzen* | ARB `spoScaleSleepTitle`, `spoScaleEnergyTitle`, `spoScaleMotivationTitle`, `spoScaleSorenessTitle` |
| Test incrementale con stima delle soglie | Test incrementale con stima delle soglie | Incremental test with threshold estimate | Stufentest mit Schwellenschätzung* | ARB `spoThrTestTitle` |
| Test incrementale a step (preset) | Test incrementale a step | Step incremental test / Incremental step test | Stufentest* | ARB `appPresetIncrementalName`, `spoTestIncrementalTitle` |
| Test soglia da campo (preset) | Test soglia da campo | Field threshold test | Feld-Schwellentest* | ARB `appPresetThresholdName`, `spoTestThresholdTitle` |
| Riscaldamento | Riscaldamento | Warm-up | Aufwärmen* | ARB `appPresetWarmup` |
| Blocco soglia | Blocco soglia | Threshold block | Schwellenblock* | ARB `appPresetThresholdBlock` |
| Step {n} | Step {n} | Step {n} | Stufe {n}* | ARB `appPresetStepLabel` |
| Preset soglie: Standard / Allenato / Principiante | Standard / Allenato / Principiante | Standard / Trained / Beginner | Standard / Trainiert* / Anfänger* | ARB `spoThrPresetDefault`, `spoThrPresetTrained`, `spoThrPresetBeginner` |
| VT1 stimata | VT1 stimata | Estimated VT1 | Geschätzte VT1* | ARB `spoThrVt1Label` |
| VT2 stimata | VT2 stimata | Estimated VT2 | Geschätzte VT2* | ARB `spoThrVt2Label` |
| Soglia / Soglie | Soglia | Threshold | Schwelle | PDF `threshold`; SleepPDF `threshold` |
| Salva come soglie dell'atleta | Salva come soglie dell'atleta | Save as the athlete's thresholds | Als Schwellen des Sportlers speichern* | ARB `spoThrSaveAsAthlete` |
| Soglie e zone salvate sul profilo dell'atleta | Soglie e zone salvate sul profilo dell'atleta. | Thresholds and zones saved to the athlete's profile. | Schwellen und Zonen im Profil des Sportlers gespeichert.* | ARB `spoThrSavedToAthlete` |
| Andamento di VT1 e VT2 | Andamento di VT1 e VT2 (bpm) | VT1 and VT2 over time (bpm) | Verlauf von VT1 und VT2 (bpm)* | ARB `spoThrTrendTitle` |
| Alpha1 contro FC | Alpha1 contro FC | Alpha1 versus HR | Alpha1 gegen HF* | ARB `spoThrScatterTitle` |
| Zone DFA α1 (titolo) | Zone di intensità DFA α1 | DFA α1 intensity zones | DFA-α1-Intensitätszonen | Glossario `dfaZone` |
| Tempo per zona DFA α1 | Tempo per Zona DFA α1 | Time in each DFA α1 zone | Zeit je DFA-α1-Zone* | ARB `spoPdfTimeInZones`, `spoTimeInDfaZones` |
| DFA α1 nel tempo | DFA α1 nel tempo | DFA α1 over time | DFA α1 im Zeitverlauf* | ARB `spoPdfDfaOverTime` |
| DFA α1 medio | DFA α1 medio | Average DFA α1 | Mittlere DFA α1* | ARB `spoDfaAvg` |
| Zona Z1 | Recupero | Recovery | Erholung | ARB `appDfaZoneRecovery` |
| Zona Z2 | Aerobica | Aerobic | Aerob* | ARB `appDfaZoneAerobic` |
| Zona Z3 | Transizione | Transition | Übergang* | ARB `appDfaZoneTransition` |
| Zona Z4 | Anaerobica | Anaerobic | Anaerob* | ARB `appDfaZoneAnaerobic` |
| Zona Z5 | Massimale | Maximal | Maximal | ARB `appDfaZoneMaximal`; Glossario DE `dfaZone` ("Z5 maximal") |
| Zona (colonna) | Zona | Zone | Zone* | ARB `spoPdfColZone`, `spoThrColZone` |
| Zone di FC proposte | Zone di FC proposte | Proposed HR zones | Vorgeschlagene HF-Zonen* | ARB `spoThrZonesProposedTitle` |
| Zona FC Z{z} | Zona FC Z{z} | HR zone Z{z} | HF-Zone Z{z}* | ARB `spoThrHrZoneLabel` |
| Zone salvate / dal test del {date} / modificate a mano | Zone salvate / zone dal test del {date} / zone modificate a mano | Saved zones / zones from the test of {date} / zones edited by hand | Gespeicherte Zonen* / Zonen aus dem Test vom {date}* / manuell bearbeitete Zonen* | ARB `spoThrZonesSaved`, `spoThrZonesFromTest`, `spoThrZonesManualNote` |
| Carico (TRIMP) | TRIMP sessione / TRIMP 7g | Session TRIMP / TRIMP 7d | Sitzungs-TRIMP* / TRIMP 7 T* | ARB `spoAxisSessionTrimp`, `spoTrimp7d` |
| ACWR / TSB (titoli grafici) | ACWR, ultimi {days} giorni / TSB, ultimi {days} giorni | ACWR, last {days} days / TSB, last {days} days | ACWR, letzte {days} Tage* / TSB, letzte {days} Tage* | ARB `spoAcwrChartTitle`, `spoTsbChartTitle` |
| CTL / ATL / TSB | CTL (Fitness) / ATL (Fatica) / TSB (Forma) | CTL (fitness) / ATL (fatigue) / TSB (form) | CTL (Fitness)* / ATL (Ermüdung)* / TSB (Form)* | ARB `spoLegendCtl`, `spoLegendAtl`, `spoLegendTsb` |
| TSB: stati | Possibile perdita forma / Zona gara ottimale / Carico equilibrato / Fase di carico / Sovraccarico | Possible detraining / Peak race zone / Balanced load / Building phase / Overload | Möglicher Formverlust* / Optimale Wettkampfzone* / Ausgeglichene Belastung* / Aufbauphase* / Überlastung* | ARB `spoTsbDetraining`, `spoTsbRaceReady`, `spoTsbBalanced`, `spoTsbBuilding`, `spoTsbOverload` |
| ACWR: legenda | Carico basso / Zona sicura / Attenzione / Rischio elevato | Low load / Safe zone / Caution / High risk | Geringe Belastung* / Sichere Zone* / Vorsicht* / Hohes Risiko* | ARB `spoLegendLowLoad`, `spoLegendSafeZone`, `spoLegendCaution`, `spoLegendHighRisk` |
| Media mobile 7 giorni | Media mobile 7gg | 7-day moving average | Gleitender 7-Tage-Durchschnitt* | ARB `spoLegendMovingAverage7` |
| Sensore | Sensore | Sensor | Sensor* | ARB `spoThrSensorTitle`, `homeSensorGeneric` |
| Fascia (cardio) | Fascia | Strap | Brustgurt | Glossario DE `night_point_qualita` ("Brustgurt"); PDF `gaps` ("Gurt abgelegt") |
| Dati sport (scheda cliente) | Dati sport | Sport data | Sportdaten* | ARB `cliFormSectionSport` |
| Sport praticato / Livello competitivo / Obiettivo corrente | Sport praticato / Livello competitivo / Obiettivo corrente | Sport / Competitive level / Current goal | Sportart* / Leistungsniveau* / Aktuelles Ziel* | ARB `cliFieldSport`, `cliFieldCompetitiveLevel`, `cliFieldCurrentGoal` |
| Livello competitivo: valori | Amatoriale / Semi-professionista / Professionista / Elite | Amateur / Semi-pro / Professional / Elite | Amateur* / Semiprofessionell* / Profi* / Elite | ARB `cliCompetitiveAmateur`, `cliCompetitiveSemiPro`, `cliCompetitiveProfessional`, `cliCompetitiveElite` |
| HR Max / FTP stimato | HR Max (BPM) / FTP stimato (watt) | Max HR (bpm) / Estimated FTP (watt) | Max. HF (bpm)* / Geschätzte FTP (Watt)* | ARB `cliFieldHrMax`, `cliFieldFtp` |

---

## 8. Monitoraggio 24h, Notte e Sonno

L'app **non stima le fasi del sonno** (PDF `method_text`: "Nessuna stima
delle fasi del sonno"; SleepPDF `method_not`: "Non misura le fasi del sonno").
"Fase" nel modulo indica solo la fase del ciclo mestruale
(`monNightCyclePhase`) o le fasi dell'analisi (`msvPhaseWindows`). Sul sito
non si parla quindi di sonno profondo/leggero/REM.

### 8.1 Monitoraggio 24h

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Report Monitoraggio 24h | Report Monitoraggio 24h | 24h Monitoring Report | 24h-Monitoring-Bericht | PDF `title` |
| Registrazione | Registrazione | Recording | Aufzeichnung | PDF `meta` |
| Periodo | Periodo | Period | Zeitraum | PDF `period` |
| Dispositivo | Dispositivo | Device | Gerät | PDF `device`; ARB `slpDevice` |
| Profilo | Profilo | Profile | Profil | PDF `profile`; ARB `monKvProfile` |
| Durata | Durata | Duration | Dauer | PDF `duration`; ARB `slpDuration` |
| Timeline delle 24 ore | TIMELINE DELLE 24 ORE | 24-HOUR TIMELINE | 24-STUNDEN-ZEITLEISTE | PDF `timeline` |
| Timeline e riserva | TIMELINE E RISERVA | TIMELINE AND RESERVE | ZEITLEISTE UND RESERVE | PDF `timeline_reserve` |
| Riserva | Riserva | Reserve | Reserve | Glossario `monitoring_reserve` |
| Riserva: ricaricata / consumata / in pari | Ricaricata / Consumata / In pari | Recharged / Depleted / Even | Aufgeladen / Verbraucht / Ausgeglichen | PDF `reserve_up`, `reserve_down`, `reserve_flat` |
| Bilancio della giornata | Bilancio della giornata | Balance of the day | Bilanz des Tages | PDF `balance` |
| Pause di recupero | Pause di recupero | Recovery pauses | Erholungspausen | PDF `kpi_pauses`; Glossario `monitoring_recovery_pauses` |
| Tratto senza pause | Tratto senza pause | Stretch without pauses | Abschnitt ohne Pausen | Glossario `monitoring_longest_stretch` |
| Picco della giornata | Picco della giornata | Peak of the day | Spitze des Tages | PDF `kpi_peak` |
| Tempo di rientro (mediana) | Tempo di rientro (mediana) | Return time (median) | Rückkehrzeit (Median) | PDF `kpi_return` |
| Reazione agli eventi | Reazione agli eventi | Reaction to events | Reaktion auf Ereignisse | Glossario `monitoring_event_response` |
| Tempo in recupero | Tempo in recupero | Time in recovery | Zeit in Erholung | PDF `kpi_recovery`; ARB `monKpiTimeInRecovery` |
| Recupero diurno | Recupero diurno | Daytime recovery | Erholung am Tag | Glossario `monitoring_daytime_recovery` |
| Stimolo / Rientro | Stimolo / Rientro | Stimulus / Return | Reiz / Rückkehr | PDF `stimulus`, `return` |
| Eventi e risposta | EVENTI E RISPOSTA | EVENTS AND RESPONSE | EREIGNISSE UND REAKTION | PDF `events` |
| Evento | Evento | Event | Ereignis | PDF `ev_event` |
| Eventi | Eventi | Events | Ereignisse | ARB `msvPageEvents`, `slpEvents`; PDF `no_events` |
| Aggiungi evento | Aggiungi evento | Add event | Ereignis hinzufügen* | ARB `monEventAddTitle`, `ngtAddEvent` |
| Ora dell'evento | Ora dell'evento | Time of the event | Uhrzeit des Ereignisses* | ARB `monEventTime` |
| Nessun evento registrato | Nessun evento registrato. | No events recorded. | Keine Ereignisse erfasst. | PDF `no_events` |
| Risposta (colonna) | Risposta | Response | Reaktion | PDF `ev_response` |
| Finestre valide | Finestre valide | Valid windows | Gültige Fenster | PDF `valid_windows` |
| Finestra di 5 minuti | finestre di 5 minuti | 5-minute windows | 5-Minuten-Fenster | ARB `monTrendChartCaption`; PDF `rhythm_hint`, `method_text` |
| Nessuna finestra valida | nessuna finestra valida | no valid window | kein gültiges Fenster* | ARB `msvNaNoValidWindow` |
| Tratti continui | Tratti continui | Continuous stretches | Kontinuierliche Abschnitte | PDF `tracts` |
| Qualità del segnale | Qualità del segnale | Signal quality | Signalqualität | Glossario `night_point_qualita`; ARB `monKvSignalQuality`; PDF `signal` ("Qualità segnale") |
| Dati validi | Dati validi | Valid data | Gültige Daten | PDF `valid_data` |
| Copertura | Copertura sotto il 60%: valore da leggere con cautela | Coverage below 60%: read this value with care | Abdeckung unter 60%: Wert mit Vorsicht lesen* | ARB `ngtLowCoverageWarning`; DE "Abdeckung" da PDF `unreliable` |
| Artefatti | Artefatti | Artefacts | Artefakte | PDF `artifacts_pct`; ARB `monChipArtifacts` |
| Artefatti (grezzo) | Artefatti (grezzo) | Artefacts (raw) | Artefakte (roh) | PDF `artifacts`; ARB `monKvArtifacts` |
| Battiti irregolari | Battiti irregolari (pattern) | Irregular beats (pattern) | Unregelmäßige Schläge (Muster) | PDF `irregular` |
| Buchi (fascia staccata) | Buchi (fascia staccata) | Gaps (strap off) | Lücken (Gurt abgelegt) | PDF `gaps` |
| Dato non valido | dato non valido (fascia staccata o segnale disturbato) | invalid reading (strap off or disturbed signal) | ungültiger Wert (Gurt abgelegt oder gestörtes Signal)* | ARB `ngtInvalidDataDetail` |
| Non valido (stato) | Non valido | Invalid | Ungültig | PDF `legend_invalid` |
| Da leggere con cautela | Da leggere con cautela: {list}. | Read with care: {list}. | Mit Vorsicht zu lesen: {list}.* | ARB `monNoticeReadWithCare`; PDF `unreliable` ("mit Vorsicht lesen") |
| Non calcolabile | Non calcolabile | Not computable / Cannot be computed | Nicht berechenbar | PDF `night_na_short`; ARB `monNotComputable` |
| Mappa delle ore | Mappa delle ore | Hour map | Stundenkarte | PDF `hour_map`; Glossario `monitoring_hour_map` |
| Orologio interno | Orologio interno | Internal clock | Innere Uhr | Glossario `monitoring_internal_clock`; PDF `clock_na` |
| Forza del ritmo / Ora del minimo / Ora del picco | Forza del ritmo / Ora del minimo / Ora del picco | Rhythm strength / Time of the minimum / Time of the peak | Stärke des Rhythmus / Zeit des Minimums / Zeit des Maximums | PDF `clock_strength`, `clock_min`, `clock_peak` |
| Onde del riposo | Onde del riposo | Waves of rest | Wellen der Ruhe | Glossario `monitoring_rest_waves` |
| Ordine del battito | Ordine del battito | Order of the heartbeat | Ordnung des Herzschlags | Glossario `monitoring_fragmentation` |
| Ordinato / intermedio / frammentato | ordinato / intermedio / frammentato | ordered / intermediate / fragmented | geordnet / mittel / fragmentiert | PDF `frag_ordinato`, `frag_intermedio`, `frag_frammentato` |
| Ricchezza di regolazione (MSE) | Ricchezza di regolazione | Richness of regulation | Reichtum der Regulation | Glossario `monitoring_mse` |
| Coerenza a lungo termine (DFA α2) | Coerenza a lungo termine | Long-term coherence | Langfristige Kohärenz | Glossario `monitoring_dfa_alpha2` |
| Ritmo e complessità | RITMO E COMPLESSITÀ | RHYTHM AND COMPLEXITY | RHYTHMUS UND KOMPLEXITÄT | PDF `rhythm` |
| Come si calcola | COME SI CALCOLA | HOW IT IS COMPUTED | WIE ES BERECHNET WIRD | PDF `how`; ARB `monHowComputed` |
| Indice / Nome tecnico / Metodo / Requisito minimo / Referenza | Indice / Nome tecnico / Metodo / Requisito minimo / Referenza | Index / Technical name / Method / Minimum requirement / Reference | Index / Technischer Name / Methode / Mindestanforderung / Referenz | PDF `how_name`, `how_tech`, `how_method`, `how_req`, `how_ref` |
| In sintesi | IN SINTESI | IN SHORT | KURZ GESAGT | PDF `summary` |
| Serie: intera / notte / giorno | Intera / Notte / Giorno | Full / Night / Day | Gesamt / Nacht / Tag | PDF `series_full`, `series_night`, `series_day` |
| Storico monitoraggi | Storico monitoraggi | Monitoring history | Monitoring-Verlauf* | ARB `monHubHistoryTitle` |
| Monitoraggio pronto (notifica) | Monitoraggio pronto | Recording ready | Aufzeichnung bereit* | ARB `setNotifMonitoringReadyTitle` |

### 8.2 Notte (dal monitoraggio o dal wearable)

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| La notte | LA NOTTE | THE NIGHT | DIE NACHT | PDF `night` |
| Notte (data del risveglio) | Notte (data del risveglio) | Night (wake-up date) | Nacht (Datum des Aufwachens)* | ARB `monNightDateLabel` |
| Notte non disponibile | Notte non disponibile | Night not available | Nacht nicht verfügbar | PDF `night_na` |
| Recupero notturno (indice) | Recupero notturno | Night recovery | Nächtliche Erholung | Glossario `monitoring_night_recovery`; PDF `night_quality`; ARB `monResultNightRecovery` |
| Descrizione recupero notturno | Quanto bene la notte ha ricaricato le tue riserve, su una scala da 0 a 100. | How well the night recharged your reserves, on a scale from 0 to 100. | Wie gut die Nacht deine Reserven aufgeladen hat, auf einer Skala von 0 bis 100. | Glossario `monitoring_night_recovery` |
| Score della notte | SCORE DELLA NOTTE | NIGHT SCORES | NACHT-SCORES | PDF `night_scores` |
| Score del risveglio | Score del risveglio (primi 10 minuti) | Wake-up scores (first 10 minutes) | Scores nach dem Aufwachen (erste 10 Minuten) | PDF `morning_scores`; ARB `monMorningScores` |
| La notte in dieci punti | LA NOTTE IN DIECI PUNTI | THE NIGHT IN TEN POINTS | DIE NACHT IN ZEHN PUNKTEN | PDF `night_checklist` |
| Punto: qualità del segnale | Qualità del segnale | Signal quality | Signalqualität | Glossario `night_point_qualita` |
| Punto: orari e tempo per addormentarsi | Orari e tempo per addormentarsi | Sleep times and time to fall asleep | Schlafzeiten und Einschlafdauer | Glossario `night_point_orari` |
| Punto: durata ed efficienza | Durata ed efficienza | Duration and efficiency | Dauer und Effizienz | Glossario `night_point_durata_efficienza`; ARB `ngtPointDurationTitle` |
| Punto: calo notturno del battito | Calo notturno del battito | Night-time heart rate dip | Nächtlicher Abfall der Herzfrequenz | Glossario `night_point_dip`; abbreviato PDF `kpi_hr_dip` "Calo HR notturno / Night HR dip / Nächtlicher HF-Abfall" |
| Punto: nadir | Nadir, l'ora del battito più basso | Nadir, the time of your lowest heart rate | Nadir, der Zeitpunkt des niedrigsten Pulses | Glossario `night_point_nadir` |
| Punto: RMSSD delle prime 3 ore | RMSSD delle prime 3 ore | RMSSD in the first 3 hours | RMSSD der ersten 3 Stunden | Glossario `night_point_rmssd_prime_3h` |
| Punto: curva di recupero | Curva di recupero | Recovery curve | Erholungskurve | Glossario `night_point_curva_recupero` |
| Punto: episodi di attivazione | Episodi di attivazione | Activation episodes | Aktivierungsepisoden | Glossario `night_point_episodi_attivazione`; PDF `awakenings` "Episodi di attivazione stimati" |
| Punto: respiro stimato della notte | Respiro stimato della notte | Estimated night-time breathing rate | Geschätzte nächtliche Atemfrequenz | Glossario `night_point_respiro` |
| Punto: eventi serali | Eventi serali | Evening events | Abendliche Ereignisse | Glossario `night_point_eventi_serali` |
| Andamento del recupero | Andamento del recupero | Recovery trend | Verlauf der Erholung | PDF `recovery_trend` |
| Prime 3 ore / Ultime 3 ore | Prime 3 ore / Ultime 3 ore | First 3 hours / Last 3 hours | Erste 3 Stunden / Letzte 3 Stunden | PDF `first_3h`, `last_3h` |
| HR minima notte | HR minima notte | Night minimum HR | Minimale HF nachts | PDF `kpi_hr_min`; ARB `monKpiMinHrNightPlain` |
| HR media notte | HR media notte | Night mean HR | Mittlere HF nachts | PDF `hr_mean_night` |
| RMSSD notte | RMSSD notte | RMSSD at night | RMSSD nachts* | ARB `monKpiRmssdNight` |
| Galleria dei pattern (solo professionista) | GALLERIA DEI PATTERN (SOLO PROFESSIONISTA) | PATTERN GALLERY (PROFESSIONAL ONLY) | MUSTERGALERIE (NUR FACHPERSON) | PDF `patterns` (DE "Fachperson": per il sito usare "Fachkraft") |
| Da dire al cliente | Da dire al cliente | To tell the client | Dem Klienten sagen | PDF `say_to_client` |
| Orientamento dell'orologio | Orientamento dell'orologio | Clock orientation | Ausrichtung der inneren Uhr | PDF `clock` |
| Centro del sonno | centro del sonno / Centro del sonno (midpoint) | sleep centre / Sleep midpoint | Schlafmitte | PDF `clock_center`; Glossario `sleep_midpoint` |
| Durata del sonno | Durata del sonno | Sleep duration | Schlafdauer | Glossario `sleep_duration_min`; ARB `monNightGuideSleepDuration` |
| Efficienza del sonno | Efficienza del sonno | Sleep efficiency | Schlafeffizienz | Glossario `sleep_efficiency` |
| Latenza di addormentamento | Latenza di addormentamento | Time to fall asleep | Einschlafdauer | Glossario `sleep_latency_min`; ARB `ngtPointTimesLatency` ("latenza {minutes} min / latency {minutes} min") |
| Regolarità degli orari (SRI) | Regolarità degli orari (SRI) | Sleep timing regularity (SRI) | Regelmäßigkeit der Schlafzeiten (SRI) | Glossario `sri` |
| Social jetlag | Social jetlag | Social jetlag | Sozialer Jetlag | Glossario `social_jetlag_min` |
| Variabilità notturna (RMSSD, media 7 notti) | Variabilità notturna (RMSSD, media 7 notti) | Night-time variability (RMSSD, 7-night average) | Nächtliche Variabilität (RMSSD, Mittel aus 7 Nächten) | Glossario `rmssd_night` |
| Polso notturno a riposo | Polso notturno a riposo | Night-time resting pulse | Nächtlicher Ruhepuls | Glossario `rhr_night` |
| Regolarità della variabilità (CV settimanale) | Regolarità della variabilità (CV settimanale di ln rMSSD) | Steadiness of variability (weekly CV of ln rMSSD) | Gleichmäßigkeit der Variabilität (wöchentlicher CV von ln rMSSD) | Glossario `cv_weekly` |
| Temperatura cutanea notturna | Temperatura cutanea notturna (scostamento) | Night-time skin temperature (deviation) | Nächtliche Hauttemperatur (Abweichung) | Glossario `skin_temp_delta` |
| Sveglia | Sveglia alle | Awake at | Aufgewacht um* | ARB `monNightWakeTime` |
| Fase del ciclo (opzionale) | Fase del ciclo (opzionale) | Cycle phase (optional) | Zyklusphase (optional)* | ARB `monNightCyclePhase` |
| Giornata di test | GIORNATA DI TEST | TEST DAY | TESTTAG | PDF `test_day` |

### 8.3 Sonno (Checkme O2 Max: ossigenazione e polso)

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Report Sonno | Report Sonno | Sleep Report | Schlafbericht | SleepPDF `title` |
| Sleep Score | Sleep Score | Sleep Score | Sleep Score | SleepPDF `sleep_score`; Glossario `sleep_score` dice invece "Punteggio del sonno / Sleep score / Schlaf-Score" |
| Le quattro componenti | Le quattro componenti | The four components | Die vier Komponenten | SleepPDF `components` |
| Ossigenazione | Ossigenazione | Oxygenation | Sauerstoffsättigung | SleepPDF `comp_oxygenation` |
| Stabilità respiratoria | Stabilità respiratoria | Respiratory stability | Atmungsstabilität | SleepPDF `comp_respiratory` |
| Recupero cardiaco | Recupero cardiaco | Cardiac recovery | Kardiale Erholung | SleepPDF `comp_cardiac` |
| Continuità | Continuità | Continuity | Kontinuität | SleepPDF `comp_continuity` |
| I numeri chiave | I numeri chiave | Key numbers | Die wichtigsten Zahlen | SleepPDF `key_numbers` |
| Eventi di desaturazione | Eventi di desaturazione | Oxygen level drops (UI) / Desaturation events (PDF) | Entsättigungsereignisse | ARB `slpDesatEvents`; SleepPDF `events` (l'EN della UI evita "desaturation") |
| Cali di ossigenazione per ora | Cali di ossigenazione per ora (cali di almeno 3 punti) | Oxygenation dips per hour (dips of at least 3 points) | Abfälle der Sauerstoffsättigung pro Stunde (um mindestens 3 Punkte) | Glossario `spo2_drops_per_hour` |
| ODI3 / ODI4 | ODI3 (cali di almeno 3 punti / ora valida) | ODI3 (drops of at least 3 points / valid hour) | ODI3 (Abfälle von mindestens 3 Punkten / gültige Stunde) | SleepPDF `odi3`, `odi4` |
| Tempo sotto il 90 % (T90) | Tempo sotto 90 % | Time below 90 % | Zeit unter 90 % | SleepPDF `t90`; Glossario `spo2_t90` |
| Nadir SpO₂ | Nadir SpO₂ | SpO₂ nadir | SpO₂-Nadir | SleepPDF `nadir` |
| SpO₂ media / basale | SpO₂ media / SpO₂ basale (mediana) | Mean SpO₂ / Basal SpO₂ (median) | Mittlere SpO₂ / Basale SpO₂ (Median) | SleepPDF `spo2_mean`, `spo2_basal` |
| Ossigenazione media notturna / minima | Ossigenazione media notturna / Ossigenazione minima | Average night-time oxygenation / Minimum oxygenation | Mittlere nächtliche Sauerstoffsättigung / Minimale Sauerstoffsättigung | Glossario `spo2_mean`, `spo2_min` |
| Polso medio / minimo / massimo | Polso medio / Polso minimo / Polso massimo | Mean / Minimum / Maximum pulse rate | Mittlerer / Minimaler / Maximaler Puls | SleepPDF `pr_mean`, `pr_min`, `pr_max` |
| Calo notturno del polso | Calo notturno del polso | Night-time pulse dip | Nächtlicher Pulsabfall | SleepPDF `dip` |
| Eventi con surge ≥ 6 bpm | Eventi con surge di almeno 6 bpm | Events with surge of at least 6 bpm | Ereignisse mit Anstieg von mindestens 6 bpm | SleepPDF `surge_pct`; ARB `slpSurgeEvents` |
| Minuti mossi | Minuti mossi | Restless minutes | Unruhige Minuten | SleepPDF `moved_pct` |
| Risvegli stimati | Risvegli stimati | Estimated awakenings | Geschätzte Aufwachphasen | SleepPDF `awakenings`; ARB `slpEstimatedAwakenings` |
| Movimento e risvegli stimati | Movimento e risvegli stimati | Movement and estimated awakenings | Bewegung und geschätzte Aufwachphasen | Glossario `sleep_movement` |
| Calo notturno e microrisvegli | Calo notturno e microrisvegli | Night-time dip and micro-awakenings | Nächtlicher Abfall und Mikro-Aufwachphasen* | ARB `slpDipAndMicroAwakenings` |
| Sonda staccata | Sonda staccata | Probe off | Sensor gelöst | SleepPDF `probe_off` |
| Stati: normale / desaturazione / sotto 90 % / movimento / non valido | Normale / Desaturazione / Sotto 90 % / Movimento / Non valido | Normal / Oxygen drop / Below 90 % / Movement / Not valid | Normal / Sauerstoffabfall / Unter 90 % / Bewegung / Nicht gültig | SleepPDF `state_*` |
| Notte non analizzabile | Notte non analizzabile | Night not analysable | Nacht nicht auswertbar | SleepPDF `not_analyzable` |
| Profilo orario | Profilo orario | Hourly profile | Stundenprofil | SleepPDF `hourly` |
| Finestre e movimento (fase analisi) | Finestre e movimento | Windows and movement | Fenster und Bewegung* | ARB `slpPhaseWindows` |
| Stabilità del segnale | Stabilità del segnale | Signal stability | Signalstabilität* | ARB `slpSignalStability` |
| Cosa non misura questo esame | Cosa non misura questo esame | What this test does not measure | Was diese Untersuchung nicht misst | SleepPDF `method_not_title` |
| Cuore | Cuore | Heart | Herz | SleepPDF `heart` |
| Seriale | Seriale | Serial | Seriennummer | SleepPDF `serial` |

---

## 9. Piani, abbonamento e account

L'app non ha stringhe UI per i piani: `profiles.plan` (`base`/`pro`) e
`SubscriptionStatus { active, trialing, pastDue, canceled, none }` vivono solo
nel codice (`models/subscription.dart`). I nomi commerciali esistono nel sito
(`PlanToggle.tsx`, `sport/page.tsx`, `admin-commerciale.ts`) e nel catalogo DB
(`piani` = `prova`, `base`, `pro`; `moduli` = `sport`, `monitoring`, `sleep`).
EN e DE di questa sezione sono quindi tutti proposti.

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Piano (generico) | Piano | Plan* | Tarif* | Sito; DB `piani` |
| `base` | Piano Base | Basic plan* | Basis-Tarif* | Sito `PlanToggle.tsx`, `sport/page.tsx` |
| `pro` | Piano Pro | Pro plan* | Pro-Tarif* | Sito `PlanToggle.tsx`; "Attiva il Piano Pro" / "Scopri il Piano Pro" |
| `prova` | Piano prova / prova | Trial* | Testphase* | Sito `admin-commerciale.ts` ("Il piano prova richiede una data di scadenza"); DB `piani.prova`; app `trialing` |
| Attiva il Piano Pro (CTA) | Attiva il Piano Pro | Activate the Pro plan* | Pro-Tarif aktivieren* | Sito `sport/page.tsx` |
| Riporta al Piano Base | Riporta al Piano Base | Back to the Basic plan* | Zurück zum Basis-Tarif* | Sito `PlanToggle.tsx` |
| Abbonamento | Abbonamento | Subscription* | Abonnement* | Sito `docs/COMMERCIALE.md`, tabella `abbonamenti` |
| Scadenza | scadenza | expiry date* | Ablaufdatum* | `docs/COMMERCIALE.md` ("data scadenza inclusa") |
| Rinnovo automatico | rinnovo automatico | auto-renewal* | Automatische Verlängerung* | `docs/COMMERCIALE.md` |
| Prolungamento | prolungamento | extension* | Verlängerung* | Sito `UsersTab.tsx` ("Prolungamento rapido") |
| Modulo / Moduli | Modulo / Moduli | Module / Modules* | Modul / Module* | Contesto §3.2; DB `moduli` |
| Modulo Sport | Modulo Sport | Sport module* | Sport-Modul* | Sito `sport/page.tsx` |
| Modulo Monitoraggio | Monitoraggio | Monitoring | Monitoring | ARB `monModuleName`; PDF `module` |
| Modulo Sonno | Sonno | Sleep | Schlaf | ARB `slpModuleTitle`; SleepPDF `module` |
| Stato account: attivo | attivo | active* | aktiv* | `docs/COMMERCIALE.md`, `account_stato` |
| Stato account: prova | prova | trial* | Testphase* | `account_stato_effettivo` |
| Stato account: sospeso | sospeso | suspended* | ausgesetzt* | `docs/COMMERCIALE.md`; pagina `/area-professionisti/sospeso` |
| Stato account: bloccato | bloccato | blocked* | gesperrt* | `docs/COMMERCIALE.md` |
| Riattivazione | Riattivazione | Reactivation* | Reaktivierung* | `docs/COMMERCIALE.md` |
| Superadmin | Superadmin | Superadmin | Superadmin | Sito `is_superadmin()` |
| Account (impostazioni) | Account | Account | Konto* | ARB `setGroupAccount` |
| Accedi / Esci | Accedi / Esci | Sign in / Sign out | Anmelden* / Abmelden* | ARB `setLoginSignIn`, `homeLogout` |
| Registrati (web) | Registrati | Sign up* | Registrieren* | Sito (registrazione web con `trial_expires_at`) |

---

## 10. CRM clienti

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Cliente | Cliente | Client | Klient* | ARB `cliFallbackName`, `setAlertRulesClientLabel`; PDF `say_to_client` usa "Klienten", `client_guidance` usa "Kunden": per il sito **Klient** |
| Clienti (menu) | Clienti | Clients | Klienten* | ARB `cliListTitle`, `homeNavClients` |
| Nuovo cliente | Nuovo cliente | New client | Neuer Klient* | ARB `cliNewClient`, `cliFormNewTitle` |
| Modifica cliente | Modifica cliente | Edit client | Klient bearbeiten* | ARB `cliFormEditTitle` |
| Elimina cliente | Elimina cliente | Delete client | Klient löschen* | ARB `cliDeleteTitle` |
| Nessun cliente | Nessun cliente | No clients | Keine Klienten* | ARB `cliListNoClients` |
| Aggiungi il tuo primo cliente | Aggiungi il tuo primo cliente | Add your first client | Fügen Sie Ihren ersten Klienten hinzu* | ARB `cliEmptyTitle` |
| Cerca per nome o email | Cerca per nome o email… | Search by name or email… | Nach Name oder E-Mail suchen…* | ARB `cliSearchHint` |
| Scheda cliente (sito) / schede archiviate | Scheda cliente / Mostra schede archiviate | Client record* / Show archived records | Klientenprofil* / Archivierte Profile anzeigen* | Sito `clienti/[id]`; ARB `cliArchivedShow` ("records") |
| Cliente dal | Cliente dal | Client since | Klient seit* | ARB `cliRowClientSince` |
| Professionista | Professionista | Professional | Fachkraft | ARB `appProLinkProfessional`, `homeNavProfessional`; PDF `professional`. NB: le chiavi `set*` in EN usano "practitioner" |
| Profilo professionista | Profilo professionista | Practitioner profile | Profil der Fachkraft* | ARB `setProfileTitle` |
| Il mio professionista | Il mio professionista | My professional | Meine Fachkraft* | ARB `appProLinkTitle` |
| Specializzazione | Specializzazione | Specialization / Specialisation | Fachgebiet | PDF `specialization`; ARB `setProfileFieldSpecialization` |
| Studio | Studio | Practice | Praxis | PDF `studio`; ARB `spoPdfStudio` |
| Indirizzo / Telefono / Sito / Email | Indirizzo / Telefono / Sito / Email | Address / Phone / Website / Email | Adresse / Telefon / Website / E-Mail | PDF `address`, `phone`, `website`, `email` |
| Anagrafica / Dati anagrafici | Anagrafica | Personal details | Persönliche Daten* | ARB `cliDetailSectionPersonal`, `cliFormSectionPersonal` |
| Nome / Cognome / Data di nascita / Sesso | Nome / Cognome / Data di nascita / Sesso | First name / Last name / Date of birth / Sex | Vorname* / Nachname* / Geburtsdatum* / Geschlecht* | ARB `cliRowFirstName`, `cliRowLastName`, `cliFieldBirthDate`, `cliFieldSex` |
| Età / anni | Età / anni | Age / years | Alter / Jahre | PDF `age`, `years` |
| Maschio / Femmina | Maschio / Femmina | Male / Female | Männlich / Weiblich | PDF `gender_m`, `gender_f`; ARB `cliSexMale`, `cliSexFemale` |
| Peso (kg) / Altezza (cm) | Peso (kg) / Altezza (cm) | Weight (kg) / Height (cm) | Gewicht (kg)* / Größe (cm)* | ARB `cliFieldWeight`, `cliFieldHeight` |
| Stile di vita | Stile di vita | Lifestyle | Lebensstil* | ARB `cliFormSectionLifestyle` |
| Fumatore / Atleta / Attività | Fumatore / Atleta / Attività | Smoker / Athlete / Activity | Raucher / Sportler / Aktivität | PDF `smoker`, `athlete`, `activity` |
| Livello attività fisica | Livello attività fisica | Physical activity level | Aktivitätsniveau* | ARB `cliFieldActivityLevel` |
| Livello attività: valori | Sedentario / Moderato / Attivo / Atleta | Sedentary / Moderate / Active / Athlete | Sitzend* / Mäßig aktiv* / Aktiv* / Sportler | ARB `cliActivityLevelSedentary/Moderate/Active/Athlete` |
| Contatti | Contatti | Contacts | Kontakte* | ARB `cliFormSectionContacts` |
| Percorso e note | Percorso e note | Journey and notes | Betreuungsverlauf und Notizen* | ARB `cliFormSectionJourney`, `cliJourneyTitle` ("PERCORSO / JOURNEY") |
| Data inizio percorso | Data inizio percorso | Journey start date | Startdatum der Betreuung* | ARB `cliFieldJourneyStart` |
| Obiettivi | Obiettivi | Goals | Ziele* | ARB `cliFieldGoals` |
| Note | Note | Notes | Notizen | ARB `cliFieldNotes`, `spoNotes`; PDF `interpretation` ("Notizen") |
| Nota / Reminder / Indicazione / Obiettivo (categorie) | Nota / Reminder / Indicazione / Obiettivo | Note / Reminder / Tip / Goal | Notiz* / Erinnerung* / Hinweis* / Ziel* | ARB `cliNoteCategoryNote/Reminder/Indication/Goal` |
| Note e reminder | Note e reminder | Notes and reminders | Notizen und Erinnerungen* | ARB `cliNotesTitle` |
| Note del professionista | NOTE DEL PROFESSIONISTA | PROFESSIONAL NOTES / PROFESSIONAL'S NOTES | ANMERKUNGEN DER FACHKRAFT* | PDF `pro_notes` (DE "DES FACHMANNS"); ARB `resNotesTitle` |
| Indicazioni al cliente | Indicazioni al cliente | Client guidance / Guidance for the client | Empfehlungen für den Klienten* | PDF `client_guidance` (DE "für den Kunden"); ARB `resNotesForClient` |
| Note sullo stato generale | Note sullo stato generale | Notes on general condition | Notizen zum Allgemeinzustand* | ARB `cliFieldGeneralState` |
| Integratori e abitudini | Integratori e abitudini | Supplements and habits | Nahrungsergänzung und Gewohnheiten* | ARB `cliFieldSupplements` |
| Report | Report | Report | Bericht | PDF `report_title` ("Report HRV Professionale / Professional HRV Report / Professioneller HRV-Bericht") |
| Report PDF | Report PDF | PDF report | PDF-Bericht* | ARB `monResultPdfTooltip`, `slpPdfReport` |
| Esporta PDF | Esporta PDF | Export PDF | PDF exportieren* | ARB `resExportPdf`, `spoExportPdf` |
| Generato da Stress Index App | Generato da Stress Index App | Generated by Stress Index App | Erstellt von Stress Index App | PDF `generated_by` |
| Misurazioni HRV (sezione) | MISURAZIONI HRV | HRV MEASUREMENTS | HRV-MESSUNGEN* | ARB `cliDetailMeasurementsSectionTitle` |
| Ultima misurazione | Ultima misurazione | Last measurement | Letzte Messung* | ARB `cliJourneyLastMeasurement` |
| Ha nuove misurazioni | Ha nuove misurazioni | Has new measurements | Hat neue Messungen* | ARB `cliHasNewMeasurements` |
| Nessuna misurazione per questo cliente | Nessuna misurazione per questo cliente | No measurements for this client | Keine Messungen für diesen Klienten* | ARB `cliDetailEmptyTitle` |
| Inizia / Avvia misurazione | Inizia misurazione / Avvia misurazione | Start measurement | Messung starten* | ARB `cliDetailStartMeasurement`, `cliDetailStartMeasurementAction` |
| Misurazione da remoto | Da remoto | Remote | Fernmessung* / Remote* | ARB `cliSourceRemote`; sito "misurazione da remoto" |
| Misurazione in studio | In studio | In studio | In der Praxis* | ARB `cliSourceInStudio` |
| Storico | Storico | History | Verlauf* | ARB `resHistoryTitle`, `cliNavHistory` |
| Trend | Trend | Trend | Trend* | ARB `cliDetailTrendButton`, `resCmpPageTrend` |
| Andamento | Andamento | Trend | Verlauf | ARB `msvPageTrend`; PDF `trend24` ("ANDAMENTO / TREND / VERLAUF") |
| Confronta / Confronto | Confronta | Compare | Vergleichen* | ARB `cliDetailCompare`; PDF `ortho_comparison` ("Vergleich") |
| Seleziona per confronto | Seleziona per confronto | Select to compare | Zum Vergleich auswählen* | ARB `cliDetailSelectForCompare` |
| Sessioni (confronto) | SESSIONI | SESSIONS | SITZUNGEN* | ARB `resCmpSessions` |
| Test consigliato / in scadenza | Test consigliato / Test in scadenza | Test recommended / Test due soon | Empfohlener Test* / Test bald fällig* | ARB `cliDetailTestSuggested`, `cliTestDueSoon` |
| Prossimo test consigliato | PROSSIMO TEST CONSIGLIATO | NEXT TEST RECOMMENDED | NÄCHSTER EMPFOHLENER TEST | PDF `next_test` |
| Data suggerita | Data suggerita | Suggested date | Empfohlenes Datum | PDF `suggested_date` |
| Pianifica prossimo test | Pianifica prossimo test | Schedule next test | Nächsten Test planen* | ARB `resNextTestPlan` |
| Alert (impostazioni) | Alert | Alerts | Warnungen* | ARB `setAlertsTitle`, `setAlertsHeader` ("ALERT HRV / HRV ALERTS") |
| Soglie avvisi (scheda cliente) | SOGLIE AVVISI | ALERT THRESHOLDS | WARNSCHWELLEN* | ARB `cliThresholdsSectionTitle` |
| Regole alert | Regole alert | Alert rules | Warnregeln* | ARB `setAlertRulesTitle` |
| Alert personalizzati | ALERT PERSONALIZZATI | CUSTOM ALERTS | BENUTZERDEFINIERTE WARNUNGEN* | ARB `setAlertRulesCustomHeader` |
| Usa soglie generali | Usa soglie generali | Use general thresholds | Allgemeine Schwellen verwenden* | ARB `cliThresholdsUseGlobal` |
| Nessun alert | Nessun alert | No alerts | Keine Warnungen* | ARB `setAlertsEmptyTitle` |
| Notifiche sui tuoi clienti | Notifiche sui tuoi clienti | Notifications about your clients | Benachrichtigungen zu Ihren Klienten* | ARB `setAlertsSubtitle` |
| Alert: calo significativo RMSSD | Calo significativo RMSSD | Noticeable RMSSD drop | Deutlicher RMSSD-Abfall* | ARB `setAlertRmssdDrop20Title` |
| Alert: calo importante RMSSD | Calo importante RMSSD | Large RMSSD drop | Starker RMSSD-Abfall* | ARB `setAlertRmssdDrop40Title` |
| Alert: stress elevato persistente | Stress elevato persistente | Persistent high stress | Anhaltend hoher Stress* | ARB `setAlertStressChronicTitle` |
| Alert: stress critico | Stress critico | Critical stress | Kritischer Stress* | ARB `setAlertStressCriticalTitle` |
| Alert: recupero insufficiente | Recupero insufficiente | Insufficient recovery | Unzureichende Erholung* | ARB `setAlertRecoveryLowTitle` |
| Alert: SDNN molto basso | SDNN molto basso | Very low SDNN | Sehr niedrige SDNN* | ARB `setAlertSdnnLowTitle` |
| Alert: variabilità in calo (DFA) | Variabilità del battito in calo | Heartbeat variability going down | Herzschlag-Variabilität sinkt* | ARB `setAlertDfaAbnormalTitle` |
| Alert: battito a riposo elevato | Battito a riposo elevato | High resting heart rate | Erhöhter Ruhepuls* | ARB `setAlertHrRestHighTitle` |
| Alert: adattamento basso | Adattamento basso | Low adaptation | Niedrige Anpassung* | ARB `setAlertInflammationDropTitle` |
| Calo rispetto alla baseline | Calo rispetto alla baseline | Drop from baseline | Abfall gegenüber der Baseline* | ARB `setAlertThrDropFromBaseline` |
| Accesso app (sezione) | Accesso app / ACCESSO ALL'APP | App access / APP ACCESS | App-Zugang* | ARB `cliFormSectionAccess`, `cliAppAccessTitle` |
| Invita il cliente ad accedere | Invita il cliente ad accedere | Invite the client to sign in | Klienten zur Anmeldung einladen* | ARB `cliAccessInviteToggle` |
| Crea account cliente | Crea account cliente | Create client account | Klientenkonto erstellen* | ARB `cliAccessCreateButton` |
| Invito inviato | Invito inviato | Invitation sent | Einladung gesendet* | ARB `cliAccessInviteSentTitle` |
| Cliente collegato | Cliente collegato | Client linked | Klient verknüpft* | ARB `cliAccessLinkedTitle` |
| Accesso non creato | Accesso non creato | Access not created | Zugang nicht erstellt* | ARB `cliAccessNotCreatedTitle` |
| Stato accesso: mai usato / in uso | Mai usato / In uso | Never used / In use | Nie verwendet* / In Verwendung* | ARB `cliAppAccessStateNeverUsed`, `cliAppAccessStateActive` |
| Ultimo accesso | Ultimo accesso | Last sign-in | Letzte Anmeldung* | ARB `cliAppAccessRowLastSignIn` |
| Password temporanea / link di reset | Imposta password temporanea / Copia link di reset | Set a temporary password / Copy the reset link | Temporäres Passwort festlegen* / Reset-Link kopieren* | ARB `cliAppAccessSetTempPassword`, `cliAppAccessCopyResetLink` |
| Collegamento (cliente-professionista) | Collegamento | Link | Verknüpfung* | ARB `setMyProTileTitle` ("Collegamento al professionista"), `cliLinkFailed` |
| Collegamento attivo | Collegamento attivo | Link active | Verknüpfung aktiv* | ARB `appProLinkActive` |
| Collegato / Non collegato | Collegato / Non collegato | Linked / Not linked | Verknüpft* / Nicht verknüpft* | ARB `appProLinkBadgeLinked`, `appProLinkNotLinked` |
| Richiesta collegamento | Richiesta collegamento | Link request | Verknüpfungsanfrage* | ARB `appProLinkFormTitle` |
| Richiesta in attesa / In attesa | Richiesta in attesa / In attesa | Request pending / Pending | Anfrage ausstehend* / Ausstehend* | ARB `appProLinkPending`, `appProLinkBadgePending` |
| Invia richiesta / Annulla richiesta | Invia richiesta / Annulla richiesta | Send request / Cancel request | Anfrage senden* / Anfrage abbrechen* | ARB `appProLinkSend`, `appProLinkCancelAction` |
| Disconnetti | Disconnetti | Disconnect | Trennen* | ARB `appProLinkDisconnect` |
| Email del professionista | Email del professionista | Professional's email | E-Mail der Fachkraft* | ARB `appProLinkEmailLabel` |
| Nessun professionista trovato con questa email | Nessun professionista trovato con questa email. | No professional found with this email. | Keine Fachkraft mit dieser E-Mail gefunden.* | ARB `appProLinkNotFound` |
| Registro accessi (sito) | Registro accessi | Access log* | Zugriffsprotokoll* | Sito `scripts/e2e-accesso-cliente.js`; ARB privacy "Log di accesso / Access logs" |
| Percorso: qualità dei dati | Qualità dei dati | Data quality | Datenqualität | ARB `cliJourneyDataQuality`; PDF `data_quality` |

---

## 11. Termini comuni

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| Salva | Salva | Save | Speichern* | ARB `commonSave` |
| Annulla | Annulla | Cancel | Abbrechen* | ARB `commonCancel` |
| Elimina | Elimina | Delete | Löschen* | ARB `commonDelete` |
| Modifica | Modifica | Edit | Bearbeiten* | ARB `commonEdit` |
| Chiudi | Chiudi | Close | Schließen* | ARB `commonClose` |
| Conferma | Conferma | Confirm | Bestätigen* | ARB `commonConfirm` |
| Indietro | Indietro | Back | Zurück* | ARB `commonBack` |
| Avanti | Avanti | Next | Weiter* | ARB `commonNext` |
| Continua | Continua | Continue | Fortfahren* | ARB `commonContinue` |
| Fatto / Fine | Fatto / Fine | Done | Fertig* | ARB `ngtDone` ("Fatto"), `spoDone` ("Fine") |
| Cerca | Cerca | Search | Suchen* | ARB `commonSearch` |
| Seleziona | Seleziona | Select | Auswählen* | ARB `commonSelect` |
| Condividi | Condividi | Share | Teilen* | ARB `commonShare` |
| Aggiorna | Aggiorna | Refresh | Aktualisieren* | ARB `cliAppAccessRefresh`, `slpRefresh` |
| Aggiungi / Rimuovi | Aggiungi evento / Rimuovi | Add event / Remove | Hinzufügen* / Entfernen* | ARB `monEventAddTitle`, `monResultRemove` |
| Apri | Apri | Open | Öffnen* | ARB `monOpen` |
| Riprova | Riprova | Retry | Erneut versuchen* | ARB `commonRetry` |
| OK | OK | OK | OK | ARB `commonOk` |
| Sì / No | Sì / No | Yes / No | Ja / Nein | PDF `yes`, `no`; ARB `commonYes`, `commonNo` |
| Tutti / Tutte | Tutti / Tutte | All | Alle* | ARB `commonAll`, `resCmpTagAll` |
| Nessuno / Nessuna | Nessuno / Nessuna | None | Keine* | ARB `commonNone`, `homeOptionNone` |
| Altro | Altro | Other | Sonstiges* | ARB `msvEventOther` |
| Caricamento... | Caricamento... | Loading... | Wird geladen…* | ARB `commonLoading` |
| Invio in corso… | Invio in corso… | Sending… | Wird gesendet…* | ARB `cliAccessSending` |
| Attendi… | Attendi… | Please wait… | Bitte warten…* | ARB `cliAppAccessWorking` |
| Errore | Errore | Error | Fehler* | ARB `commonError` |
| Errore generico | Si è verificato un errore. Riprova. | Something went wrong. Please try again. | Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.* | ARB `commonGenericError` |
| Errore non specificato | Errore non specificato. | Unspecified error. | Unbekannter Fehler.* | ARB `cliAccessUnspecifiedError` |
| Campo obbligatorio | Campo obbligatorio | Required field | Pflichtfeld* | ARB `commonRequiredField` |
| Obbligatorio | Obbligatorio | Required | Erforderlich* | ARB `setAuthRequired`, `spoRequiredBadge` |
| Il nome è obbligatorio | Il nome è obbligatorio | First name is required | Vorname ist erforderlich* | ARB `cliValidatorFirstNameRequired` |
| Email non valida | Email non valida | Invalid email | Ungültige E-Mail* | ARB `cliValidatorEmailInvalid` |
| Nessun dato | Nessun dato | No data | Keine Daten* | ARB `ngtNoData` |
| Nessun dato disponibile | Nessun dato disponibile | No data available | Keine Daten verfügbar* | ARB `resStatsNoData` |
| Nessuna misurazione | Nessuna misurazione | No measurements | Keine Messungen* | ARB `cliNoMeasurements`, `resHistoryEmptyTitle` |
| Nessun risultato per "{query}" | Nessun risultato per "{query}" | No results for "{query}" | Keine Ergebnisse für "{query}"* | ARB `cliNoSearchResults` |
| Dati insufficienti | Dati insufficienti | Not enough data | Nicht genügend Daten | PDF `ortho_insufficient`; ARB `spoInsufficientData` |
| Non disponibile | Non disponibile | Not available | Nicht verfügbar | ARB `commonUnknown`, `slpNotAvailable`; SleepPDF `na` |
| n.d. | n.d. | n.a. | k.A. | PDF `nd` |
| Non calcolabile | Non calcolabile | Cannot be computed | Nicht berechenbar | ARB `monNotComputable`; PDF `night_na_short` |
| Non valutabile | non valutabile | not assessable | nicht bewertbar | PDF `trend_na` |
| Attenzione | Attenzione | Warning / Caution | Achtung* | ARB `cliAccessRollbackWarning`, `spoLegendCaution` |
| Impostazioni | Impostazioni | Settings | Einstellungen* | ARB `setTitle` |
| Profilo | Profilo | Profile | Profil | ARB `setGroupProfile`; PDF `profile` |
| Aiuto | Aiuto | Help | Hilfe* | ARB `appBleHelpAction`, `setSupportHeader` |
| Guida | Guida | Guide | Anleitung* | ARB `setSupportGuideTitle` |
| Sincronizza | Sincronizza | Sync | Synchronisieren* | ARB `homeTooltipSync` |
| Da sincronizzare | da sincronizzare | to sync | zu synchronisieren* | ARB `monTileToSync` |
| Email / Password | Email / Password | Email / Password | E-Mail / Passwort* | ARB `setAuthEmailLabel`, `setAuthPasswordLabel` |
| Data | Data | Date | Datum* | ARB `spoDateLabel`, `resPdfColDate` |
| Ora (orario) | Ora | Time | Uhrzeit* | ARB `setCsvTime`; PDF `ev_time` ("Zeit") |
| Ora (adesso) | Ora | Now | Jetzt* | ARB `setAlertsTimeNow` |
| Ora (unità) | Ora | Hour | Stunde | SleepPDF `hour`; ARB `monColHour` |
| Oggi / Ieri | Oggi / Ieri | Today / Yesterday | Heute* / Gestern* | ARB `spoToday`, `spoYesterday` |
| {n} min fa / {n} h fa / {n} g fa | {n} min fa / {n} h fa / {n} g fa | {n} min ago / {n} h ago / {n} d ago | vor {n} min* / vor {n} h* / vor {n} T* | ARB `setAlertsTimeMinutesAgo`, `setAlertsTimeHoursAgo`, `setAlertsTimeDaysAgo` |
| Stato | Stato | Status / State | Status | PDF `status`; ARB `cliAppAccessRowState` |
| Pagina / di | Pagina / di | Page / of | Seite / von | PDF `page`, `of` |
| Powered by Stress Index | Powered by Stress Index | Powered by Stress Index | Powered by Stress Index | PDF `powered_by` |
| Copia / Copiato | Copia password / Password copiata. | Copy password / Password copied. | Passwort kopieren* / Passwort kopiert.* | ARB `cliAppAccessCopyPassword`, `cliAppAccessPasswordCopied` |
| Crea | Crea | Create | Erstellen* | ARB `setTagsCreateCta` |
| Colore | Colore | Colour | Farbe* | ARB `setTagsColorLabel` |
| Etichetta | Etichetta | Label | Etikett | PDF `label` |
| Vedi tutte | Vedi tutte | See all | Alle anzeigen* | ARB `cliDetailSeeAll` |
| Wearable | Wearable | Wearable | Wearable | ARB `ngtSourceWearable` |

---

## 12. Preset periodo

L'app ha solo "Ultimi 7 giorni" e "Ultimi 30 giorni" (Sport) e "Ultimi 30
giorni" (home). 90 giorni, 6 mesi e 1 anno esistono solo nel sito
(`DateRangePicker.tsx`, `AdvancedTrendChart.tsx`).

| Chiave/uso | IT | EN | DE | Fonte |
|---|---|---|---|---|
| 7 giorni | Ultimi 7 giorni | Last 7 days | Letzte 7 Tage* | ARB `spoPeriodLast7Days`; sito `ClientsTable.tsx` |
| 30 giorni | Ultimi 30 giorni | Last 30 days | Letzte 30 Tage* | ARB `spoPeriodLast30Days`, `homeTrendLast30Days` |
| 90 giorni | 90 giorni | 90 days* | 90 Tage* | Sito `DateRangePicker.tsx` |
| 6 mesi | 6 mesi | 6 months* | 6 Monate* | Sito `DateRangePicker.tsx` |
| 1 anno | 1 anno | 1 year* | 1 Jahr* | Sito `DateRangePicker.tsx`, `UsersTab.tsx` |
| Personalizzato | Personalizzato | Custom | Benutzerdefiniert* | ARB `msvTypeCustom`, `setTagsCatCustom`; sito `monitoring-format.ts` |
| Tutto | Tutto | All | Alle* | ARB `ngtZoomAll` |
| Settimana / Mese | Settimana / Mese | Week / Month | Woche* / Monat* | ARB `homeStatWeek`, `homeStatMonth` |
| Periodo | Periodo | Period | Zeitraum | PDF `period` |
| Periodo: {n} giorni | Periodo: {n} giorni | Period: {n} days | Zeitraum: {n} Tage* | ARB `resCmpPeriodDays` |
| Forma breve giorni | 7g / 30g / {days}gg | 7d / 30d / {days}d | 7 T / 30 T / {days} T* | ARB `spoTrimp7d`, `spoPeriodDaysShort`, `resCmpDaysDelta` |
| {n} giorni fa | {n} giorni fa | {n} days ago | vor {n} Tagen* | ARB `spoDaysAgo` |
| Nessun dato nel periodo | Nessun dato nel periodo. | No data in this period. | Keine Daten im Zeitraum.* | ARB `spoNoDataInPeriod` |
| Ultimi {days} giorni (titolo grafico) | ultimi {days} giorni | last {days} days | letzte {days} Tage* | ARB `spoAcwrChartTitle` |
| Obiettivo a 90 giorni | OBIETTIVO A 90 GIORNI | 90-DAY GOAL | 90-TAGE-ZIEL* | ARB `resNinetyDayGoal` |

---

## 13. Incoerenze rilevate nell'app

Da conoscere prima di tradurre il sito; dove possibile il glossario sopra
sceglie già una forma.

1. **Adattamento / Inflammatory Modulation.** Le chiavi UI `appScoreAdaptation`,
   `ngtScoreAdaptation`, `resPdfIdxAdaptation`, `spoScoreAdaptation` hanno IT
   "Adattamento" ma EN "Inflammatory Modulation"; i PDF (`inflammatory_score`),
   il glossario (`inflammationScore`) e gli alert (`setAlertInflammationDrop*`)
   dicono "Adaptation" / "Anpassung". Il Contesto §13 elenca ancora "Inflammatory
   Modulation" fra i nomi EN. Per il sito: **Adaptation / Anpassung**.
2. **Affaticamento / Esaurimento.** La fascia 85-100 dello stress è
   "Affaticamento" nelle ARB (`appStressZoneFatigue` → "Fatigue",
   `resZoneStressExhaustion` → "Exhaustion": due EN per lo stesso IT).
   "Esaurimento" vive solo nei commenti Dart e nel sito (`GaugeScore.tsx`,
   `GuideClient.tsx`, `guide-knowledge-base.ts`). Da allineare.
3. **Ottimo / Ottimale / Eccellente.** "Ottimo" è "Excellent" in
   `ngtQualityExcellent`, `slpScoreExcellent`, `spoScaleExcellent`, "Optimal" in
   PDF `optimal`, "Very good" in `resZoneSisVeryGood`; "Eccellente" è sempre
   "Excellent"; "Ottimale" è "Optimal". In DE il PDF usa "Optimal",
   "Ausgezeichnet", "Sehr gut".
4. **Professional / Practitioner.** Le chiavi `set*` (profilo, privacy, GDPR)
   usano "practitioner" (18 occorrenze), il resto "professional" (22). In DE i
   PDF usano "Fachkraft", "Fachmann" (`pro_notes`) e "Fachperson"
   (`patterns`). Per il sito: **professional / Fachkraft**.
5. **Klient / Kunde.** PDF `say_to_client` = "Dem Klienten sagen",
   `client_guidance` = "EMPFEHLUNGEN FÜR DEN KUNDEN". Per il sito: **Klient**.
6. **Trattamento / Session.** `resBeforeAfterKindTreatment` è "Trattamento" in
   IT e "Session" in EN (scelta voluta: "treatment" è vietato). In EN "session"
   copre sia "sessione" sia "trattamento".
7. **Qualità del segnale a livelli diversi per modulo.** Monitoraggio
   buona/media/insufficiente; Sonno ottimo/discreto/disturbato; Sport
   buona/media/bassa; home eccellente/buona/discreta/scarsa; risultato
   Ottima/Buona/Minima/Insufficiente. In DE: gut/mittel/unzureichend e
   sehr gut/ausreichend/gestört.
8. **Alert / Avvisi.** Le impostazioni dicono "Alert" (`setAlertsTitle`), la
   scheda cliente "SOGLIE AVVISI" (`cliThresholdsSectionTitle`).
9. **Maiuscole nei nomi dei test.** "Misurazione Standard" e "Test Ortostatico"
   in home (`homeTest*`), "Misurazione standard" e "Test ortostatico" altrove
   (`appTest*`). "Indice di Stress" (PDF) e "Indice di stress"
   (`ngtScoreStress`).
10. **Fatto / Fine → Done**; **Trend / Andamento → Trend** (in DE il PDF
    distingue: "Verlauf" per Andamento).
11. **Sleep Score.** Il report Sonno lo lascia in inglese in tutte le lingue;
    il glossario lo traduce ("Punteggio del sonno / Schlaf-Score").
12. **Desaturazione.** IT e PDF EN usano "desaturazione / desaturation"; la UI
    EN dice "Oxygen level drops" (`slpDesatEvents`). Il Contesto §13 vieta
    "desaturazione" nel glossario Sonno, non nei report.
13. **Readiness / Prontezza.** Il modulo Sport tiene "Readiness" anche in IT;
    il glossario del monitoraggio usa "Prontezza" (di recupero, di reazione).
14. **Team Live** non esiste come stringa UI nell'app (tab "Team" e "Sessione
    Live"); è un nome del sito.
15. **"du" nei PDF tedeschi.** Le frasi DE del glossario e dei PDF rivolte al
    cliente danno del tu; il sito, rivolto al professionista, usa il "Sie".
16. **Piani senza stringhe nell'app.** "Piano Base", "Piano Pro", "prova",
    stati account: solo nel sito e nel DB. EN e DE sono proposte.

---

## 14. Termini vietati

Linguaggio wellness (compliance Apple 1.4.1 e MDR): Stress Index fa
ottimizzazione e benessere, non screening né diagnosi (Contesto §13, verificato
da `test/i18n_test.dart` e `test/parameter_glossary_test.dart`). Eccezioni solo
nei disclaimer, con allowlist esplicita.

| Vietato IT | Vietato EN | Vietato DE | Usare invece IT | EN | DE |
|---|---|---|---|---|---|
| diagnosi, diagnostico | diagnosis, diagnostic | Diagnose, diagnostisch | valutazione, lettura, indicazione | assessment, reading, indication | Bewertung, Auswertung, Hinweis |
| paziente | patient | Patient, Patientin | cliente, persona, atleta | client, person, athlete | Klient, Person, Sportler |
| clinico, clinica | clinical, clinic | klinisch, Klinik | professionale, del benessere | professional, wellness | fachlich, Wellness- |
| medico (come qualifica del prodotto), medicale | medical (as product qualifier) | medizinisch (als Produktmerkmal) | per professionisti del benessere, professionale | for wellness professionals, professional | für Wellness-Fachkräfte, professionell |
| biomarcatore, biomarcatore clinico | biomarker, clinical biomarker | Biomarker | indice, indicatore, parametro | index, indicator, parameter | Index, Indikator, Parameter |
| cartella clinica | medical record, patient record, chart | Krankenakte, Patientenakte | scheda cliente, profilo cliente | client record, client profile | Klientenprofil |
| referto, referto medico | medical report, findings | Befund, ärztlicher Bericht | report | report | Bericht |
| terapia, terapeutico | therapy, treatment, therapeutic | Therapie, Behandlung, therapeutisch | sessione, percorso; trattamento solo nel senso di seduta pre/post | session, journey | Sitzung, Betreuungsverlauf |
| screening | screening | Screening | monitoraggio, osservazione | monitoring, observation | Monitoring, Beobachtung |
| sintomo, patologia, malattia | symptom, disease, pathology | Symptom, Krankheit, Pathologie | segnale, stato, condizione generale | signal, state, general condition | Signal, Zustand, Allgemeinzustand |
| cura, guarigione | cure, healing | Heilung, heilen | benessere, recupero | wellness, recovery | Wohlbefinden, Erholung |
| apnea, desaturazione (nel glossario Sonno) | apnoea, desaturation (in the Sleep glossary) | Apnoe, Entsättigung (im Schlaf-Glossar) | calo dell'ossigenazione, indice descrittivo | oxygen level drop, descriptive index | Sauerstoffabfall, beschreibender Index |
| modulazione infiammatoria (come claim in UI) | inflammatory modulation (as a UI claim) | Entzündungsmodulation | Adattamento | Adaptation | Anpassung |
| LF/HF nei testi nuovi | LF/HF in new copy | LF/HF in neuen Texten | "oscillazioni medie e legate al respiro" | "mid-speed and breathing-linked oscillations" | "mittlere und atemgebundene Schwankungen" |

Formule ammesse nei disclaimer (già nell'app): "Non costituiscono diagnosi
medica e non sostituiscono il parere di un professionista sanitario" / "They
are not a medical diagnosis and do not replace the advice of a healthcare
professional" / "Sie stellen keine medizinische Diagnose dar und ersetzen nicht
den Rat einer medizinischen Fachkraft" (PDF `disclaimer`).
