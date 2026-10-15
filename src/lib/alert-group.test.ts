// Test del raggruppamento degli alert identici (src/lib/alert-group.ts).
// Si esegue con `npm test` (node --test, senza dipendenze aggiuntive).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chiaveAlert, raggruppaAlert } from './alert-group.ts'
import type { Alert } from './types'

const alert = (over: Partial<Alert>): Alert => ({
  id: over.id ?? 'id',
  professional_id: 'pro',
  client_id: 'doretta',
  type: 'high_stress',
  severity: 'high',
  message: null,
  triggering_value: 91,
  triggering_metric: 'score_stress',
  status: 'new',
  created_at: '2026-10-10T08:00:00Z',
  ...over,
})

test('tre alert uguali diventano uno, con il conteggio e la data dell\'ultimo', () => {
  const gruppi = raggruppaAlert([
    alert({ id: 'a', created_at: '2026-10-12T08:00:00Z' }),
    alert({ id: 'b', created_at: '2026-10-14T08:00:00Z' }),
    alert({ id: 'c', created_at: '2026-10-13T08:00:00Z' }),
  ])
  assert.equal(gruppi.length, 1)
  assert.equal(gruppi[0].count, 3)
  assert.equal(gruppi[0].alert.id, 'b')
  assert.deepEqual(gruppi[0].ids, ['a', 'b', 'c'])
})

test('il valore si confronta a due decimali', () => {
  assert.equal(chiaveAlert(alert({ triggering_value: 91.004 })), chiaveAlert(alert({ triggering_value: 91.001 })))
  assert.notEqual(chiaveAlert(alert({ triggering_value: 91.0 })), chiaveAlert(alert({ triggering_value: 91.2 })))
})

test('clienti, tipi o metriche diversi restano separati', () => {
  const gruppi = raggruppaAlert([
    alert({ id: 'a' }),
    alert({ id: 'b', client_id: 'altro' }),
    alert({ id: 'c', type: 'low_recovery', triggering_metric: 'score_recupero', triggering_value: 20 }),
    alert({ id: 'd', triggering_metric: 'score_energia' }),
  ])
  assert.equal(gruppi.length, 4)
  assert.ok(gruppi.every((g) => g.count === 1))
})

test('senza valore si confronta il messaggio', () => {
  const gruppi = raggruppaAlert([
    alert({ id: 'a', type: 'missed_measurement', triggering_value: null, triggering_metric: null, message: 'Ultima misurazione il 01/10/2026' }),
    alert({ id: 'b', type: 'missed_measurement', triggering_value: null, triggering_metric: null, message: 'Ultima misurazione il 01/10/2026 ' }),
    alert({ id: 'c', type: 'missed_measurement', triggering_value: null, triggering_metric: null, message: 'Ultima misurazione il 02/10/2026' }),
  ])
  assert.equal(gruppi.length, 2)
  assert.equal(gruppi[0].count, 2)
})

test('un evento dell\'app e un alert del cron dello stesso tipo non si fondono', () => {
  const gruppi = raggruppaAlert([
    alert({ id: 'cron', type: 'stress_critical', triggering_value: null, triggering_metric: null, message: 'x' }),
    alert({ id: 'app', type: 'stress_critical', triggering_value: null, triggering_metric: null, message: 'x', source: 'app' }),
  ])
  assert.equal(gruppi.length, 2)
})

test('l\'ordine della lista d\'ingresso si conserva', () => {
  const gruppi = raggruppaAlert([
    alert({ id: 'alto', severity: 'high' }),
    alert({ id: 'medio-1', severity: 'medium', type: 'low_recovery', triggering_value: 20, created_at: '2026-10-09T08:00:00Z' }),
    alert({ id: 'basso', severity: 'low', type: 'trend_negative', triggering_value: -5 }),
    alert({ id: 'medio-2', severity: 'medium', type: 'low_recovery', triggering_value: 20, created_at: '2026-10-08T08:00:00Z' }),
  ])
  assert.deepEqual(gruppi.map((g) => g.alert.id), ['alto', 'medio-1', 'basso'])
  assert.equal(gruppi[1].count, 2)
})
