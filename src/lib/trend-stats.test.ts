// Test delle statistiche di base dei grafici di andamento
// (src/lib/trend-stats.ts). Si esegue con `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { media, periodoPrecedente, piuAltoEMeglio, scostamentoPct, valoriValidi } from './trend-stats.ts'

test('media e valori validi: i giorni vuoti non valgono zero', () => {
  assert.equal(media([]), null)
  assert.equal(media([10, 20, 60]), 30)
  assert.deepEqual(valoriValidi([null, 50, undefined, 70, NaN]), [50, 70])
})

test('scostamento percentuale, con riferimento nullo o zero', () => {
  assert.equal(scostamentoPct(66, 60), 10)
  assert.equal(scostamentoPct(54, 60), -10)
  assert.equal(scostamentoPct(10, 0), null)
  assert.equal(scostamentoPct(null, 60), null)
})

test('per lo stress un calo è un miglioramento, per gli altri score una salita', () => {
  assert.equal(piuAltoEMeglio('score_stress'), false)
  assert.equal(piuAltoEMeglio('score_recupero'), true)
  assert.equal(piuAltoEMeglio('score_modulazione_infiammatoria'), true)
  assert.equal(piuAltoEMeglio('mean_hr'), false)
  assert.equal(piuAltoEMeglio('lf_hf_ratio'), false)
  assert.equal(piuAltoEMeglio('rmssd'), true)
})

test('periodo precedente di pari lunghezza', () => {
  assert.deepEqual(periodoPrecedente('2026-10-08', '2026-10-14'), { from: '2026-10-01', to: '2026-10-07' })
  assert.deepEqual(periodoPrecedente('2026-03-01', '2026-03-01'), { from: '2026-02-28', to: '2026-02-28' })
  assert.deepEqual(periodoPrecedente('2026-01-01', '2026-01-31'), { from: '2025-12-01', to: '2025-12-31' })
})
