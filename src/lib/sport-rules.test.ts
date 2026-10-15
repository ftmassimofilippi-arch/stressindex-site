// Test di src/lib/sport-rules.ts (npm test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSportSessionValida, SPORT_MIN_DURATION_S } from './sport-rules.ts'

test('soglia a 5 minuti', () => {
  assert.equal(SPORT_MIN_DURATION_S, 300)
  assert.equal(isSportSessionValida({ duration_s: 299 }), false)
  assert.equal(isSportSessionValida({ duration_s: 300 }), true)
})

test('i casi dell audit: 29 s e 1 min 21 s fuori dalle statistiche', () => {
  assert.equal(isSportSessionValida({ duration_s: 29 }), false)
  assert.equal(isSportSessionValida({ duration_s: 81 }), false)
  assert.equal(isSportSessionValida({ duration_s: 3600 }), true)
})

test('durata assente: la sessione si tiene', () => {
  assert.equal(isSportSessionValida({ duration_s: null }), true)
  assert.equal(isSportSessionValida({}), true)
  assert.equal(isSportSessionValida({ duration_s: Number.NaN }), true)
})
