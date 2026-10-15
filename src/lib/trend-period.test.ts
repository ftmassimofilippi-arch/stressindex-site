// Test del periodo dei grafici di andamento (src/lib/trend-period.ts): al
// cambio di preset cambia il numero di punti. Dati di Doretta Sabbatini
// (audit QA 14/10/2026): misurazioni del 12/05/2026 e del 07/10/2026.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estremiDeiPunti, filtraPerPeriodo, periodoDaPreset, type PresetKey } from './trend-period.ts'

const OGGI = new Date('2026-10-14T10:00:00Z') // 14/10/2026, ore 12 italiane
const DORETTA = [
  { date: '2026-05-12', score_energia: 14.1 },
  { date: '2026-10-07', score_energia: 12.6 },
]
const custom = { from: '2026-10-01', to: '2026-10-14' }

function punti(key: PresetKey) {
  return filtraPerPeriodo(DORETTA, periodoDaPreset(key, custom, OGGI)).length
}

test('Doretta: 7 giorni 0 punti, 90 giorni 1, Tutto 2', () => {
  assert.equal(punti('7'), 0)
  assert.equal(punti('30'), 1)
  assert.equal(punti('90'), 1)
  assert.equal(punti('180'), 2)
  assert.equal(punti('365'), 2)
  assert.equal(punti('all'), 2)
  assert.equal(punti('custom'), 1)
})

test('i preset coprono esattamente N giorni, oggi compreso, nel giorno italiano', () => {
  assert.deepEqual(periodoDaPreset('7', custom, OGGI), { from: '2026-10-08', to: '2026-10-14' })
  assert.deepEqual(periodoDaPreset('30', custom, OGGI), { from: '2026-09-15', to: '2026-10-14' })
  // alle 23:30 italiane del 14/10 (21:30 UTC) oggi è ancora il 14
  assert.deepEqual(periodoDaPreset('7', custom, new Date('2026-10-14T21:30:00Z')), { from: '2026-10-08', to: '2026-10-14' })
  // alle 00:30 italiane del 15/10 (22:30 UTC del 14) oggi è il 15
  assert.deepEqual(periodoDaPreset('7', custom, new Date('2026-10-14T22:30:00Z')), { from: '2026-10-09', to: '2026-10-15' })
  assert.equal(periodoDaPreset('all', custom, OGGI), null)
})

test('estremi dei punti per la didascalia', () => {
  assert.deepEqual(estremiDeiPunti(DORETTA), { from: '2026-05-12', to: '2026-10-07' })
  assert.equal(estremiDeiPunti([]), null)
})
