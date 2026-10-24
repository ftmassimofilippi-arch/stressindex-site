// Test del percorso di un cliente (src/lib/reference-trend.ts): misurazione di
// riferimento, un valore al giorno, media mobile a 7 giorni, partenza, fascia,
// variazione e verdetto. Si esegue con `npm test`.
//
// La fixture "Sara" riproduce in forma anonima la scheda 1788354294664 letta
// in produzione il 17/10/2026: 20 mattine dal 25/9 al 17/10 (due il 3/10), due
// sessioni di coerenza (16 e 17/10), una misurazione in studio del pomeriggio
// (2/9). I numeri attesi sono quelli decisi il 17/10: Stress 49,3 → 40,1
// (-19%, migliorato), Recupero 29,1 → 36,1 (+24%), RMSSD 27,0 → 27,8 ms
// (circa +3%, stabile).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  baselineComplete,
  baselineDays,
  changeSummary,
  courseBaseline,
  dailyReferenceValues,
  diffDays,
  hasLongHistory,
  isReferenceMeasurement,
  last60Reference,
  nonReferenceReason,
  periodStartReference,
  previousPeriodReference,
  referenceFromDaily,
  regularity,
  rollingBand60,
  rollingMean7,
  toDisplay,
  type ReferenceRow,
} from './reference-trend.ts'

type Riga = ReferenceRow & { score_stress: number; score_recupero: number; rmssd: number }

// Ora italiana (CEST, +2) → istante UTC.
function riga(giornoOra: string, stress: number, recupero: number, rmssd: number, extra: Partial<ReferenceRow> = {}): Riga {
  const [g, o] = giornoOra.split(' ')
  const [h, m] = o.split(':').map(Number)
  const utc = new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10), h - 2, m))
  return { session_id: `s-${giornoOra}`, started_at_utc: utc.toISOString(), test_type: 'standard', score_stress: stress, score_recupero: recupero, rmssd, ...extra }
}

const COERENZA = { test_type: 'coherence', coherence_data: { score: 1 } }

const SARA: Riga[] = [
  riga('2026-09-02 15:05', 16.6, 64.4, 49.9),
  riga('2026-09-25 07:12', 50.0, 33.0, 29.7),
  riga('2026-09-26 07:20', 44.9, 27.3, 26.6),
  riga('2026-09-27 07:26', 46.6, 31.6, 29.1),
  riga('2026-09-28 07:23', 50.3, 30.5, 29.3),
  riga('2026-09-29 07:27', 52.8, 28.9, 28.3),
  riga('2026-09-30 07:11', 48.8, 29.2, 26.6),
  riga('2026-10-01 06:35', 51.7, 23.3, 20.6),
  riga('2026-10-02 06:41', 52.1, 26.3, 23.9),
  riga('2026-10-03 07:09', 51.5, 27.1, 24.0),
  riga('2026-10-03 07:38', 47.3, 30.1, 26.6),
  riga('2026-10-04 07:23', 48.6, 34.8, 27.2),
  riga('2026-10-05 07:18', 39.7, 33.3, 24.8),
  riga('2026-10-06 07:33', 42.6, 33.2, 24.5),
  riga('2026-10-07 07:36', 43.1, 36.8, 29.4),
  riga('2026-10-08 08:00', 32.8, 35.9, 28.5),
  riga('2026-10-09 07:42', 38.9, 38.4, 30.3),
  riga('2026-10-10 07:38', 34.5, 38.5, 28.9),
  riga('2026-10-13 07:37', 47.8, 34.7, 25.7),
  riga('2026-10-15 07:32', 40.5, 37.8, 30.0),
  riga('2026-10-16 06:59', 42.3, 31.7, 23.9),
  riga('2026-10-16 07:25', 25.3, 56.0, 45.0, COERENZA),
  riga('2026-10-17 06:55', 29.7, 40.3, 32.3),
  riga('2026-10-17 10:39', 26.2, 50.7, 38.4, COERENZA),
]

const vicino = (a: number | null, b: number, tol = 0.06) => a != null && Math.abs(a - b) < tol

test('misurazione di riferimento: standard, senza dati di coerenza o ortostatici, dalle 4 alle 11:59 italiane', () => {
  assert.equal(isReferenceMeasurement(riga('2026-10-17 06:55', 1, 1, 1)), true)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 11:59', 1, 1, 1)), true)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 12:00', 1, 1, 1)), false)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 03:59', 1, 1, 1)), false)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 04:00', 1, 1, 1)), true)
  // Il tipo lo dice analytics; una riga vecchia etichettata standard con
  // coherence_data pieno è una coerenza.
  assert.equal(isReferenceMeasurement(riga('2026-10-17 07:00', 1, 1, 1, COERENZA)), false)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 07:00', 1, 1, 1, { coherence_data: { x: 1 } })), false)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 07:00', 1, 1, 1, { orthostatic_data: { x: 1 } })), false)
  assert.equal(isReferenceMeasurement(riga('2026-10-17 07:00', 1, 1, 1, { test_type: 'orthostatic' })), false)
  // I tag non contano.
  assert.equal(isReferenceMeasurement({ ...riga('2026-10-17 07:00', 1, 1, 1), tags: ['general'] } as ReferenceRow), true)
  assert.equal(nonReferenceReason(riga('2026-10-17 15:00', 1, 1, 1)), 'hour')
  assert.equal(nonReferenceReason(riga('2026-10-17 07:00', 1, 1, 1, COERENZA)), 'type')
  assert.equal(nonReferenceReason(riga('2026-10-17 07:00', 1, 1, 1), new Set(['s-2026-10-17 07:00'])), 'excluded')
  assert.equal(nonReferenceReason(riga('2026-10-17 07:00', 1, 1, 1)), null)
})

test('fuso: il giorno e l\'ora sono italiani, anche vicino alla mezzanotte e in inverno', () => {
  // 22:30 UTC del 16/10 = 00:30 del 17/10 italiane: giorno 17, non di riferimento.
  const notte: ReferenceRow = { started_at_utc: '2026-10-16T22:30:00.000Z', test_type: 'standard' }
  assert.equal(isReferenceMeasurement(notte), false)
  assert.deepEqual(dailyReferenceValues([{ ...notte, started_at_utc: '2026-10-17T04:00:00.000Z', v: 10 }], 'v').map((d) => d.day), ['2026-10-17'])
  // 09:59 UTC = 11:59 CEST: dentro. 10:00 UTC = 12:00: fuori.
  assert.equal(isReferenceMeasurement({ started_at_utc: '2026-10-17T09:59:00.000Z', test_type: 'standard' }), true)
  assert.equal(isReferenceMeasurement({ started_at_utc: '2026-10-17T10:00:00.000Z', test_type: 'standard' }), false)
  // Dicembre (CET, +1): 03:00 UTC = 04:00, dentro; 02:59 UTC = 03:59, fuori.
  assert.equal(isReferenceMeasurement({ started_at_utc: '2026-12-01T03:00:00.000Z', test_type: 'standard' }), true)
  assert.equal(isReferenceMeasurement({ started_at_utc: '2026-12-01T02:59:00.000Z', test_type: 'standard' }), false)
})

test('un valore al giorno: due mattine il 3/10 diventano la media del giorno, coerenze e pomeriggio fuori', () => {
  const d = dailyReferenceValues(SARA, 'score_stress')
  assert.equal(d.length, 20)
  assert.equal(d[0].day, '2026-09-25')
  const tre = d.find((x) => x.day === '2026-10-03')!
  assert.equal(tre.n, 2)
  assert.ok(vicino(tre.value, 49.4))
  const sedici = d.find((x) => x.day === '2026-10-16')!
  assert.equal(sedici.n, 1)
  assert.equal(sedici.value, 42.3)
  // Esclusione dai conti per session_id: il giorno resta con l'altra misurazione.
  const senza = dailyReferenceValues(SARA, 'score_stress', { excluded: new Set(['s-2026-10-03 07:09']) })
  assert.equal(senza.find((x) => x.day === '2026-10-03')!.value, 47.3)
  // RMSSD: la media del giorno è in logaritmo.
  const r = dailyReferenceValues(SARA, 'rmssd').find((x) => x.day === '2026-10-03')!
  assert.ok(vicino(r.value, (Math.log(24.0) + Math.log(26.6)) / 2, 1e-9))
  assert.ok(vicino(toDisplay('rmssd', r.value), Math.sqrt(24.0 * 26.6), 1e-6))
})

test('media mobile a 7 giorni: finestra di calendario, provvisoria sotto 3 valori, buco oltre 7 giorni', () => {
  const d = dailyReferenceValues(SARA, 'score_stress')
  const r = rollingMean7(d)
  assert.equal(r.length, d.length)
  assert.equal(r[0].n, 1)
  assert.equal(r[0].provisional, true)
  assert.equal(r[1].n, 2)
  assert.equal(r[1].provisional, true)
  assert.equal(r[2].n, 3)
  assert.equal(r[2].provisional, false)
  // Al 17/10 la finestra 11-17/10 contiene 13, 15, 16 e 17: media 40,1.
  const ultimo = r[r.length - 1]
  assert.equal(ultimo.day, '2026-10-17')
  assert.equal(ultimo.n, 4)
  assert.ok(vicino(ultimo.mean, 40.1))
  // 10/10 → 13/10 sono 3 giorni: nessuna interruzione.
  assert.equal(r.find((x) => x.day === '2026-10-13')!.gapBefore, false)
  assert.equal(r.every((x) => !x.gapBefore), true)
  // Con un buco di 8 giorni la linea si interrompe e la finestra riparte da 1.
  const buco = rollingMean7([
    { day: '2026-10-01', value: 50, n: 1 },
    { day: '2026-10-02', value: 52, n: 1 },
    { day: '2026-10-10', value: 40, n: 1 },
  ])
  assert.equal(buco[2].gapBefore, true)
  assert.equal(buco[2].n, 1)
  assert.equal(buco[2].mean, 40)
  assert.equal(diffDays('2026-10-02', '2026-10-10'), 8)
})

// Decisione 18 del 23/10/2026: partenza = le prime 7 misurazioni valide su
// almeno 4 giorni diversi (non più 7 giorni di calendario). Per Sara, una
// mattina al giorno, i primi 7 giorni restano la partenza.
test('partenza del percorso: media dei primi giorni con 7 misurazioni su almeno 4 giorni, fascia ± 0,5 DS campionaria', () => {
  const d = dailyReferenceValues(SARA, 'score_stress')
  const b = courseBaseline(d)!
  assert.ok(b)
  assert.equal(b.n, 7)
  assert.equal(b.measurements, 7)
  assert.equal(b.provisional, false)
  assert.equal(b.firstDay, '2026-09-25')
  assert.equal(b.lastDay, '2026-10-01')
  assert.ok(vicino(b.mean, 49.3))
  assert.ok(b.band)
  assert.ok(vicino(b.band!.high - b.band!.low, 2.78, 0.02))
  assert.equal(b.band!.provisional, false)
  // Con una data di inizio percorso la partenza riparte da lì.
  const da = courseBaseline(d, '2026-10-05')!
  assert.equal(da.firstDay, '2026-10-05')
  assert.equal(da.lastDay, '2026-10-13')
  assert.ok(vicino(da.mean, (39.7 + 42.6 + 43.1 + 32.8 + 38.9 + 34.5 + 47.8) / 7, 1e-9))
})

test('partenza: 7 misurazioni su 3 giorni restano provvisorie, su 4 giorni sono definitive; con più misurazioni al giorno bastano meno giorni', () => {
  const g = (day: string, n: number, value = 40) => ({ day, value, n })
  // 3 giorni con 3+3+1 = 7 misurazioni: manca il quarto giorno.
  const treGiorni = [g('2026-10-01', 3), g('2026-10-02', 3), g('2026-10-03', 1)]
  assert.equal(baselineComplete(treGiorni), false)
  assert.equal(courseBaseline(treGiorni)!.provisional, true)
  assert.equal(courseBaseline(treGiorni)!.measurements, 7)
  // Con il quarto giorno la partenza è definitiva e si ferma lì.
  const quattroGiorni = [...treGiorni, g('2026-10-04', 1), g('2026-10-05', 1), g('2026-10-06', 1)]
  assert.equal(baselineDays(quattroGiorni).length, 4)
  const b = courseBaseline(quattroGiorni)!
  assert.equal(b.n, 4)
  assert.equal(b.measurements, 8)
  assert.equal(b.provisional, false)
  assert.equal(b.lastDay, '2026-10-04')
  // 4 giorni con una misurazione ciascuno: 4 misurazioni, ancora provvisoria.
  const unaAlGiorno = ['01', '02', '03', '04'].map((d) => g(`2026-10-${d}`, 1))
  assert.equal(baselineComplete(unaAlGiorno), false)
  assert.equal(courseBaseline(unaAlGiorno)!.provisional, true)
  // Sara, una mattina al giorno (due il 3/10): da data di inizio 1/10 bastano 6 giorni (1, 2, 3 con due, 4, 5, 6 = 7 misurazioni).
  const d = dailyReferenceValues(SARA, 'score_stress')
  const da = courseBaseline(d, '2026-10-01')!
  assert.equal(da.firstDay, '2026-10-01')
  assert.equal(da.lastDay, '2026-10-06')
  assert.equal(da.n, 6)
  assert.equal(da.measurements, 7)
  assert.equal(da.provisional, false)
})

test('con 1 o 2 misurazioni: media mobile e partenza provvisorie, nessuna fascia; con 3-6 fascia provvisoria', () => {
  const una = dailyReferenceValues([riga('2026-10-17 07:00', 40, 30, 25)], 'score_stress')
  const r1 = rollingMean7(una)
  assert.equal(r1.length, 1)
  assert.equal(r1[0].provisional, true)
  const b1 = courseBaseline(una)!
  assert.equal(b1.n, 1)
  assert.equal(b1.provisional, true)
  assert.equal(b1.band, null)
  assert.equal(b1.sd, null)
  const s1 = changeSummary('score_stress', una, b1)
  assert.equal(s1.start, 40)
  assert.equal(s1.now, 40)
  assert.equal(s1.pct, 0)
  assert.equal(s1.verdict, 'stable')
  assert.equal(s1.provisional, true)

  const due = dailyReferenceValues([riga('2026-10-16 07:00', 44, 30, 25), riga('2026-10-17 07:00', 40, 30, 25)], 'score_stress')
  const b2 = courseBaseline(due)!
  assert.equal(b2.n, 2)
  assert.equal(b2.band, null)
  const s2 = changeSummary('score_stress', due, b2)
  assert.equal(s2.start, 42)
  assert.equal(s2.now, 42)
  assert.equal(s2.provisional, true)

  const quattro = referenceFromDaily([
    { day: '2026-10-01', value: 50, n: 1 }, { day: '2026-10-02', value: 52, n: 1 },
    { day: '2026-10-03', value: 48, n: 1 }, { day: '2026-10-04', value: 50, n: 1 },
  ])!
  assert.equal(quattro.n, 4)
  assert.equal(quattro.provisional, true)
  assert.ok(quattro.band)
  assert.equal(quattro.band!.provisional, true)

  // Nessuna misurazione di riferimento (solo pomeriggio): niente numeri, verdetto sconosciuto.
  const pomeriggio = dailyReferenceValues([riga('2026-10-17 15:00', 40, 30, 25), riga('2026-10-16 18:00', 40, 30, 25)], 'score_stress')
  assert.equal(pomeriggio.length, 0)
  assert.equal(courseBaseline(pomeriggio), null)
  const s0 = changeSummary('score_stress', pomeriggio, null)
  assert.equal(s0.start, null)
  assert.equal(s0.now, null)
  assert.equal(s0.verdict, 'unknown')
})

test('Sara, Stress: 49,3 → 40,1, -19%, migliorato e fuori fascia', () => {
  const d = dailyReferenceValues(SARA, 'score_stress')
  const s = changeSummary('score_stress', d, courseBaseline(d), { period: { from: '2026-09-25', to: '2026-10-17' } })
  assert.ok(vicino(s.start, 49.3))
  assert.ok(vicino(s.now, 40.1))
  assert.equal(Math.round(s.pct!), -19)
  assert.equal(s.verdict, 'improved')
  assert.equal(s.insideBand, false)
  assert.equal(s.provisional, false)
  assert.equal(s.higherIsBetter, false)
  assert.equal(s.nowDay, '2026-10-17')
  assert.deepEqual(s.regularity, { days: 20, total: 23 })
})

test('Sara, Recupero: 29,1 → 36,1, +24%, migliorato', () => {
  const d = dailyReferenceValues(SARA, 'score_recupero')
  const s = changeSummary('score_recupero', d, courseBaseline(d))
  assert.ok(vicino(s.start, 29.1))
  assert.ok(vicino(s.now, 36.1))
  assert.equal(Math.round(s.pct!), 24)
  assert.equal(s.verdict, 'improved')
})

test('Sara, RMSSD in logaritmo: 27,0 → 27,8 ms, circa +3%, stabile dentro la fascia', () => {
  const d = dailyReferenceValues(SARA, 'rmssd')
  const b = courseBaseline(d)!
  const s = changeSummary('rmssd', d, b)
  assert.ok(vicino(s.start, 27.0))
  assert.ok(vicino(s.now, 27.8))
  assert.equal(Math.round(s.pct!), 3)
  assert.equal(s.verdict, 'stable')
  assert.equal(s.insideBand, true)
  // La fascia torna in ms ed è asimmetrica (è simmetrica in log).
  assert.ok(s.band)
  assert.ok(vicino(s.band!.low, 25.3, 0.1))
  assert.ok(vicino(s.band!.high, 28.8, 0.1))
  assert.ok(s.band!.high - s.start! > s.start! - s.band!.low - 1e-9)
})

test('le coerenze non spostano nulla', () => {
  const senzaCoerenze = SARA.filter((m) => m.test_type !== 'coherence')
  for (const metric of ['score_stress', 'score_recupero', 'rmssd']) {
    const a = changeSummary(metric, dailyReferenceValues(SARA, metric), courseBaseline(dailyReferenceValues(SARA, metric)))
    const b = changeSummary(metric, dailyReferenceValues(senzaCoerenze, metric), courseBaseline(dailyReferenceValues(senzaCoerenze, metric)))
    assert.equal(a.start, b.start)
    assert.equal(a.now, b.now)
    assert.equal(a.pct, b.pct)
    assert.equal(a.verdict, b.verdict)
  }
})

test('verdetto: dentro la fascia è stabile, fuori decide il verso', () => {
  const daily = [
    { day: '2026-10-01', value: 50, n: 1 }, { day: '2026-10-02', value: 52, n: 1 }, { day: '2026-10-03', value: 48, n: 1 },
    { day: '2026-10-04', value: 50, n: 1 }, { day: '2026-10-05', value: 51, n: 1 }, { day: '2026-10-06', value: 49, n: 1 },
    { day: '2026-10-07', value: 50, n: 1 },
  ]
  const ref = referenceFromDaily(daily)!
  // Media mobile di oggi dentro la fascia (50 ± 0,65): stabile anche se il numero cambia.
  const dentro = changeSummary('score_stress', [...daily, { day: '2026-10-15', value: 50.4, n: 1 }], ref)
  assert.equal(dentro.verdict, 'stable')
  // Fuori: per lo Stress il calo è un miglioramento, per il Recupero un peggioramento.
  const giu = [...daily, { day: '2026-10-15', value: 45, n: 1 }]
  assert.equal(changeSummary('score_stress', giu, ref).verdict, 'improved')
  assert.equal(changeSummary('score_recupero', giu, ref).verdict, 'declined')
  const su = [...daily, { day: '2026-10-15', value: 55, n: 1 }]
  assert.equal(changeSummary('score_stress', su, ref).verdict, 'declined')
  assert.equal(changeSummary('score_recupero', su, ref).verdict, 'improved')
})

test('confronti alternativi: inizio del periodo, periodo precedente, ultimi 60 giorni', () => {
  const d = dailyReferenceValues(SARA, 'score_stress')
  const inizio = periodStartReference(d, '2026-10-05')!
  assert.equal(inizio.firstDay, '2026-10-05')
  assert.equal(inizio.n, 7)
  const prec = previousPeriodReference(d, '2026-10-05', '2026-10-17')!
  // Periodo precedente di 13 giorni: 22/9-4/10, con 10 giorni di riferimento.
  assert.equal(prec.firstDay, '2026-09-25')
  assert.equal(prec.lastDay, '2026-10-04')
  assert.equal(prec.n, 10)
  assert.equal(previousPeriodReference(d, '2026-09-01', '2026-09-10'), null)
  // Sara ha 22 giorni di storia di riferimento: niente fascia dinamica.
  assert.equal(hasLongHistory(d), false)
  assert.equal(last60Reference(d, '2026-10-17')!.n, 19)
  // Serie lunga: la fascia dei 60 giorni si muove e non include il giorno stesso.
  const lunga = Array.from({ length: 100 }, (_, i) => ({ day: addDaysIso('2026-06-01', i), value: 40 + (i % 5), n: 1 }))
  assert.equal(hasLongHistory(lunga), true)
  const bande = rollingBand60(lunga)
  assert.equal(bande.length, 100)
  assert.equal(bande[0].reference, null)
  assert.equal(bande[2].reference!.n, 2)
  assert.equal(bande[2].reference!.band, null)
  assert.equal(bande[3].reference!.n, 3)
  assert.ok(bande[3].reference!.band)
  assert.equal(bande[99].reference!.n, 60)
  assert.equal(bande[99].reference!.lastDay, addDaysIso('2026-06-01', 98))
})

test('regolarità: giorni con misurazione di riferimento sui giorni del periodo', () => {
  const d = dailyReferenceValues(SARA, 'score_stress')
  assert.deepEqual(regularity(d, '2026-09-25', '2026-10-17'), { days: 20, total: 23 })
  assert.deepEqual(regularity(d, '2026-10-11', '2026-10-17'), { days: 4, total: 7 })
  assert.deepEqual(regularity(d, '2026-11-01', '2026-11-07'), { days: 0, total: 7 })
})

function addDaysIso(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
