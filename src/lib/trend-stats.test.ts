// Test delle statistiche di periodo dei grafici di andamento
// (src/lib/trend-stats.ts). Si esegue con `npm test`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  media,
  mediana,
  periodoPrecedente,
  piuAltoEMeglio,
  riepilogoMetrica,
  scostamentoPct,
  statistichePeriodo,
  verdettoScostamento,
} from './trend-stats.ts'

test('media e mediana: pari, dispari, vuoto', () => {
  assert.equal(media([]), null)
  assert.equal(mediana([]), null)
  assert.equal(media([10, 20, 60]), 30)
  assert.equal(mediana([60, 10, 20]), 20)
  assert.equal(mediana([1, 2, 3, 4]), 2.5)
})

test('i giorni vuoti non valgono zero e sotto 2 punti non si calcola nulla', () => {
  assert.equal(statistichePeriodo([null, undefined, 42]), null)
  assert.equal(statistichePeriodo([]), null)
  const s = statistichePeriodo([null, 50, undefined, 70, NaN])
  assert.ok(s)
  assert.equal(s.n, 2)
  assert.equal(s.media, 60)
  assert.equal(s.mediana, 60)
  assert.equal(s.ultimo, 70)
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
  assert.equal(piuAltoEMeglio('rmssd'), true)
  assert.equal(verdettoScostamento(-12, false), 'improved')
  assert.equal(verdettoScostamento(-12, true), 'declined')
  assert.equal(verdettoScostamento(2, true), 'stable')
  assert.equal(verdettoScostamento(null, true), 'unknown')
})

test('periodo precedente di pari lunghezza', () => {
  assert.deepEqual(periodoPrecedente('2026-10-08', '2026-10-14'), { from: '2026-10-01', to: '2026-10-07' })
  assert.deepEqual(periodoPrecedente('2026-03-01', '2026-03-01'), { from: '2026-02-28', to: '2026-02-28' })
  assert.deepEqual(periodoPrecedente('2026-01-01', '2026-01-31'), { from: '2025-12-01', to: '2025-12-31' })
})

test('riepilogo di una metrica: i due scostamenti con il segno giusto', () => {
  const r = riepilogoMetrica('score_stress', [80, 70, 60], [90, 90])
  assert.ok(r.stats)
  assert.equal(r.stats.media, 70)
  assert.equal(r.stats.ultimo, 60)
  assert.ok(r.ultimoVsMedia != null && Math.abs(r.ultimoVsMedia + 14.2857) < 0.01)
  assert.equal(r.verdettoUltimo, 'improved')
  assert.ok(r.mediaVsPrecedente != null && Math.abs(r.mediaVsPrecedente + 22.222) < 0.01)
  assert.equal(r.verdettoPeriodo, 'improved')
  assert.equal(r.precedenteN, 2)

  const vuoto = riepilogoMetrica('score_energia', [12.6], [])
  assert.equal(vuoto.stats, null)
  assert.equal(vuoto.ultimoVsMedia, null)
  assert.equal(vuoto.verdettoUltimo, 'unknown')
  assert.equal(vuoto.mediaVsPrecedente, null)
})
