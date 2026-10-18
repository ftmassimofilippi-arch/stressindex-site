// Stessi valori di test/ln_rmssd_swc_test.dart nell'app
// ("deviazione standard campionaria"): la definizione deve coincidere.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeLnRmssdSwc, isRestingMeasurement } from './ln-rmssd-swc.ts'

const NOW = Date.UTC(2026, 9, 18, 12)
const DAY = 86_400_000
const serie = (vals: number[]) =>
  vals.map((rmssd, i) => ({ date: new Date(NOW - (vals.length - 1 - i) * DAY).toISOString(), rmssd }))

test('deviazione standard campionaria (n − 1) e banda sui sei valori di riferimento', () => {
  const r = computeLnRmssdSwc(serie([30, 36, 28, 41, 33, 38]), NOW)
  assert.ok(r.sd != null && Math.abs(r.sd - 0.14487) < 1e-5)
  assert.ok(r.band != null && Math.abs(r.band - 0.07243) < 1e-5)
  assert.ok(Math.abs(r.points[r.points.length - 1].baseline - 3.52743) < 1e-5)
})

test('sotto i 5 punti c\'è la baseline ma non la banda', () => {
  const r = computeLnRmssdSwc(serie([30, 36, 28, 41]), NOW)
  assert.equal(r.points.length, 4)
  assert.equal(r.sd, null)
  assert.equal(r.band, null)
})

test('fuori i punti più vecchi di 60 giorni e quelli non positivi', () => {
  const r = computeLnRmssdSwc(
    [
      { date: new Date(NOW - 61 * DAY).toISOString(), rmssd: 50 },
      { date: new Date(NOW - DAY).toISOString(), rmssd: 0 },
      { date: new Date(NOW).toISOString(), rmssd: 40 },
    ],
    NOW,
  )
  assert.equal(r.points.length, 1)
})

test('a riposo: solo standard, niente sessioni lunghe libere, RMSSD positivo', () => {
  assert.equal(isRestingMeasurement({ test_type: 'standard', rmssd: 40 }), true)
  assert.equal(isRestingMeasurement({ test_type: null, rmssd: 40 }), true)
  assert.equal(isRestingMeasurement({ test_type: 'coherence', rmssd: 80 }), false)
  assert.equal(isRestingMeasurement({ test_type: 'orthostatic', rmssd: 40 }), false)
  assert.equal(isRestingMeasurement({ duration_type: 'free', duration_seconds: 900, rmssd: 40 }), false)
  assert.equal(isRestingMeasurement({ duration_type: 'free', duration_seconds: 300, rmssd: 40 }), true)
  assert.equal(isRestingMeasurement({ test_type: 'standard', rmssd: 0 }), false)
})
