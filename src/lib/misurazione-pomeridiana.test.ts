// Caso del 20/10/2026: un cliente con UNA sola misurazione, standard e
// completa, fatta di pomeriggio (16:33 italiane del 14/10). In produzione
// `sessions` e `measurement_analytics` sono corrette (sessione 1791988434051;
// l'altra del caso è la 1791994058667, delle 18:07).
//
// La decisione del 17/10 è: le misurazioni fuori dalla fascia 04:00-11:59
// restano VISIBILI (elenco, puntini, report) ma fuori dai CONTI (media
// mobile, partenza, verdetto). Questo test fissa il confine fra le due cose
// sui moduli puri, e documenta la regola di ripiego proposta per testata e
// lancette della scheda (vedi analisi del 20/10): quando nessuna misurazione
// è di riferimento, si mostra comunque l'ultima in assoluto.
//
// Si esegue con `npm test` (o `node --test src/lib/misurazione-pomeridiana.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changeSummary, courseBaseline, dailyReferenceValues, isReferenceMeasurement, misurazioneDaMostrare, nonReferenceReason, type ReferenceRow } from './reference-trend.ts'
import { pointRows, pointsVisible } from './trend-panel.ts'
import { measuredDayKey, measuredHour } from './measured-time.ts'

type Riga = ReferenceRow & { id: string; score_stress: number; score_recupero: number; rmssd: number }

// Ora italiana (CEST, +2) → istante UTC, come nelle righe vere di `sessions.started_at_utc`.
function riga(id: string, giornoOra: string, stress: number, recupero: number, rmssd: number): Riga {
  const [g, o] = giornoOra.split(' ')
  const [h, m] = o.split(':').map(Number)
  const utc = new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10), h - 2, m))
  return { id, session_id: id, started_at_utc: utc.toISOString(), test_type: 'standard', coherence_data: null, orthostatic_data: null, score_stress: stress, score_recupero: recupero, rmssd }
}

// La scheda intera: una riga sola, del pomeriggio. L'ordine è quello di
// `listMeasurementsForClient` (dalla più recente).
const POMERIGGIO = riga('1791988434051', '2026-10-14 16:33', 61.2, 28.4, 22.1)
const SCHEDA: Riga[] = [POMERIGGIO]

// Testata e lancette: `misurazioneDaMostrare` (reference-trend.ts) sceglie la
// misurazione di riferimento più recente, altrimenti l'ultima in assoluto con
// il flag `nonDiRiferimento` acceso (nota ambra nella scheda).

test('la misurazione delle 16:33 è standard ma fuori fascia: resta fuori dai conti per l\'ora, non per il tipo', () => {
  assert.equal(measuredDayKey(POMERIGGIO), '2026-10-14')
  assert.equal(measuredHour(POMERIGGIO), 16)
  assert.equal(nonReferenceReason(POMERIGGIO), 'hour')
  assert.equal(isReferenceMeasurement(POMERIGGIO), false)
})

test('conti: nessun valore giornaliero, nessuna partenza, verdetto sconosciuto (come deciso il 17/10)', () => {
  for (const metrica of ['score_stress', 'score_recupero', 'rmssd']) {
    const daily = dailyReferenceValues(SCHEDA, metrica)
    assert.deepEqual(daily, [], `${metrica}: nessun giorno di riferimento`)
    const s = changeSummary(metrica, daily, courseBaseline(daily, null))
    assert.equal(s.start, null)
    assert.equal(s.now, null)
    assert.equal(s.verdict, 'unknown')
    assert.equal(s.regularity, null)
  }
})

test('visibilità: il grafico tiene il puntino (vuoto, motivo "ora") con il valore salvato', () => {
  const punti = pointRows(SCHEDA, 'score_stress')
  assert.equal(punti.length, 1)
  assert.equal(punti[0].id, '1791988434051')
  assert.equal(punti[0].day, '2026-10-14')
  assert.equal(punti[0].reason, 'hour')
  assert.equal(punti[0].value, 61.2)
  assert.equal(punti[0].typeKey, 'standard')
})

test('testata e lancette: con zero misurazioni di riferimento si mostra l\'ultima in assoluto, con il flag acceso', () => {
  // Prima del 20/10 la scheda faceva `find(isReferenceMeasurement) ?? null` e
  // la testata restava a "—": la misurazione sembrava sparita.
  assert.equal(SCHEDA.find((m) => isReferenceMeasurement(m)) ?? null, null)
  const scelta = misurazioneDaMostrare(SCHEDA)
  assert.ok(scelta)
  assert.equal(scelta.m.session_id, '1791988434051')
  assert.equal(scelta.m.score_stress, 61.2)
  assert.equal(scelta.nonDiRiferimento, true)
  assert.equal(scelta.reason, 'hour')
})

test('helper, solo pomeridiane: vince la più recente per istante, anche se la lista non è ordinata', () => {
  const prima = riga('p-1', '2026-10-12 15:10', 55.0, 30.0, 24.0)
  const dopo = riga('p-2', '2026-10-14 18:07', 58.0, 29.0, 23.0) // la 1791994058667 del caso
  const scelta = misurazioneDaMostrare([prima, dopo]) // dalla più vecchia
  assert.equal(scelta?.m.session_id, 'p-2')
  assert.equal(scelta?.nonDiRiferimento, true)
})

test('helper, scheda mista: la misurazione di riferimento vince anche se una pomeridiana è più recente', () => {
  const mattina = riga('m-1', '2026-10-13 07:40', 48.0, 35.0, 27.5)
  const coerenza = { ...riga('c-1', '2026-10-15 10:39', 40.0, 40.0, 30.0), test_type: 'coherence', coherence_data: { score: 1 } }
  const scheda = [POMERIGGIO, coerenza, mattina] // ordine volutamente non cronologico
  const scelta = misurazioneDaMostrare(scheda)
  assert.equal(scelta?.m.session_id, 'm-1')
  assert.equal(scelta?.nonDiRiferimento, false)
  assert.equal(scelta?.reason, null)
  // Una mattina esclusa dai conti dal professionista non è più di riferimento.
  const esclusa = misurazioneDaMostrare(scheda, new Set(['m-1']))
  assert.equal(esclusa?.m.session_id, 'c-1')
  assert.equal(esclusa?.nonDiRiferimento, true)
  assert.equal(esclusa?.reason, 'type')
})

test('helper, scheda vuota: null', () => {
  assert.equal(misurazioneDaMostrare([]), null)
})

test('grafico: con zero giorni di riferimento i puntini si accendono anche se spenti (modalità cliente, report cliente)', () => {
  assert.equal(pointsVisible(false, 0), true)
  assert.equal(pointsVisible(true, 0), true)
  // Con giorni di riferimento comanda il professionista.
  assert.equal(pointsVisible(false, 1), false)
  assert.equal(pointsVisible(true, 3), true)
  // E i puntini della scheda del caso esistono davvero, da disegnare.
  assert.equal(pointRows(SCHEDA, 'score_stress').length, 1)
})

test('controllo: se arriva una mattina, testata e conti tornano sulla misurazione di riferimento', () => {
  const mattina = riga('m-1', '2026-10-15 07:40', 48.0, 35.0, 27.5)
  const scheda = [mattina, POMERIGGIO] // dalla più recente
  assert.equal(nonReferenceReason(mattina), null)
  const scelta = misurazioneDaMostrare(scheda)
  assert.equal(scelta?.m.session_id, 'm-1')
  assert.equal(scelta?.nonDiRiferimento, false)
  const daily = dailyReferenceValues(scheda, 'score_stress')
  assert.equal(daily.length, 1)
  assert.equal(daily[0].day, '2026-10-15')
  // Il puntino del pomeriggio resta visibile accanto a quello del mattino.
  assert.deepEqual(pointRows(scheda, 'score_stress').map((p) => p.reason), ['hour', null])
})
