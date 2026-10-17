// Test della preparazione dei pannelli di andamento (src/lib/trend-panel.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayNoonMs, niceDomain, niceStep, pointRows, rollingSegments, xDomain, xTicks } from './trend-panel.ts'
import type { RollingPoint } from './reference-trend.ts'

test('pointRows: un puntino per misurazione con il motivo per cui è fuori dai conti', () => {
  const rows = pointRows([
    { session_id: 'a', started_at_utc: '2026-10-17T04:55:00.000Z', test_type: 'standard', score_stress: 29.7 },
    { session_id: 'b', started_at_utc: '2026-10-17T08:39:00.000Z', test_type: 'coherence', coherence_data: {}, score_stress: 26.2 },
    { session_id: 'c', started_at_utc: '2026-10-16T13:05:00.000Z', test_type: 'standard', score_stress: 16.6 },
    { session_id: 'd', started_at_utc: '2026-10-15T05:00:00.000Z', test_type: 'standard', score_stress: null },
    { session_id: 'e', started_at_utc: '2026-10-14T05:00:00.000Z', test_type: 'standard', score_stress: '40.5' },
  ], 'score_stress', new Set(['e']))
  assert.deepEqual(rows.map((r) => r.id), ['e', 'c', 'a', 'b'])
  assert.deepEqual(rows.map((r) => r.reason), ['excluded', 'hour', null, 'type'])
  assert.equal(rows[0].value, 40.5)
  assert.equal(rows[3].typeKey, 'coherence')
  assert.equal(rows[2].day, '2026-10-17')
})

const rp = (day: string, mean: number, n: number, gapBefore = false): RollingPoint => ({ day, mean, n, provisional: n < 3, gapBefore })

test('rollingSegments: nuovo segmento dopo un buco o al cambio di stile, con il giorno di confine in comune', () => {
  const { rows, segments } = rollingSegments([
    rp('2026-10-01', 50, 1), rp('2026-10-02', 51, 2), rp('2026-10-03', 50, 3), rp('2026-10-04', 49, 4),
    rp('2026-10-20', 45, 1, true), rp('2026-10-21', 44, 2),
  ], 'score_stress')
  assert.deepEqual(segments, [
    { key: 'r0', dashed: true },
    { key: 'r1', dashed: false },
    { key: 'r2', dashed: true },
  ])
  // Il giorno 2 (ultimo provvisorio) sta in r0 e anche in r1, così i tratti si toccano.
  assert.equal(rows[1].r0, 51)
  assert.equal(rows[1].r1, 51)
  assert.equal(rows[2].r0, undefined)
  assert.equal(rows[2].r1, 50)
  // Dopo il buco niente giorno in comune: la linea si interrompe.
  assert.equal(rows[3].r2, undefined)
  assert.equal(rows[4].r1, undefined)
  assert.equal(rows[4].r2, 45)
  assert.equal(rows[0].x, dayNoonMs('2026-10-01'))
})

test('rollingSegments: RMSSD torna in ms', () => {
  const { rows } = rollingSegments([rp('2026-10-01', Math.log(27), 3)], 'rmssd')
  assert.ok(Math.abs(rows[0].rolling - 27) < 1e-9)
  assert.ok(Math.abs(rows[0].r0! - 27) < 1e-9)
})

test('niceStep: 1, 2, 5 per decade', () => {
  assert.equal(niceStep(0.7), 1)
  assert.equal(niceStep(1.2), 2)
  assert.equal(niceStep(3), 5)
  assert.equal(niceStep(6), 10)
  assert.equal(niceStep(14), 20)
  assert.equal(niceStep(0.03), 0.05)
  assert.equal(niceStep(0), 1)
})

test('niceDomain: adattata ai dati con margine e tacche tonde, completa 0-100 per gli score', () => {
  // Stress di Sara: punti fra 29,7 e 52,8, fascia 47,9-50,7.
  const d = niceDomain([29.7, 52.8, 47.9, 50.7], { score: true })
  assert.ok(d[0] <= 29.7 - 2 && d[0] >= 20, `lo=${d[0]}`)
  assert.ok(d[1] >= 52.8 + 2 && d[1] <= 60, `hi=${d[1]}`)
  assert.equal(d[0] % 5, 0)
  assert.equal(d[1] % 5, 0)
  assert.deepEqual(niceDomain([29.7, 52.8], { score: true, full: true }), [0, 100])
  // Scala completa su una metrica non score: parte da 0.
  const full = niceDomain([24, 32], { full: true })
  assert.equal(full[0], 0)
  assert.ok(full[1] >= 32)
  // Mai sotto zero per valori non negativi, mai sopra 100 per gli score.
  assert.ok(niceDomain([1, 3], { score: true })[0] >= 0)
  assert.equal(niceDomain([0.2, 3], { score: true })[0], 0)
  assert.equal(niceDomain([96, 99], { score: true })[1], 100)
  // Serie piatta: un margine c'è comunque.
  const piatta = niceDomain([40, 40, 40])
  assert.ok(piatta[0] < 40 && piatta[1] > 40)
  // Nessun valore.
  assert.deepEqual(niceDomain([null, undefined], { score: true }), [0, 100])
  assert.deepEqual(niceDomain([]), [0, 1])
})

test('xDomain e xTicks: periodo scelto o dati, tacche a mezzogiorno', () => {
  const dom = xDomain({ from: '2026-10-11', to: '2026-10-17' }, [], '2026-10-17')
  assert.equal(new Date(dom[0]).toISOString(), '2026-10-10T22:00:00.000Z')
  assert.equal(new Date(dom[1]).toISOString(), '2026-10-17T21:59:59.999Z')
  const ticks = xTicks(dom)
  assert.equal(ticks.length, 7)
  assert.equal(ticks[0], dayNoonMs('2026-10-11'))
  assert.equal(ticks[6], dayNoonMs('2026-10-17'))
  // 30 giorni: una tacca ogni 7.
  const t30 = xTicks(xDomain({ from: '2026-09-18', to: '2026-10-17' }, [], '2026-10-17'))
  assert.equal(t30.length, 5)
  // "Tutto": dal primo punto a oggi.
  const tutto = xDomain(null, [{ x: dayNoonMs('2026-09-25') }, { x: dayNoonMs('2026-10-17') }], '2026-10-17')
  assert.equal(new Date(tutto[0]).toISOString(), '2026-09-24T22:00:00.000Z')
  assert.ok(xTicks(tutto).length >= 3)
})
