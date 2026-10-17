// Test della vista salvata dei grafici (src/lib/chart-view.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CHART_VIEW, exclusionReasonCounts, moveMetric, parseChartView, sameChartView } from './chart-view.ts'

const KNOWN = new Set(['score_stress', 'score_recupero', 'rmssd', 'sdnn'])

test('parseChartView: campi validi passano, il resto torna al default', () => {
  assert.deepEqual(parseChartView(null, KNOWN), DEFAULT_CHART_VIEW)
  assert.deepEqual(parseChartView('x', KNOWN), DEFAULT_CHART_VIEW)
  const v = parseChartView({ metrics: ['sdnn', 'bogus', 'score_stress', 'sdnn'], preset: '90', compare: 'last60', points: false, scale: 'full' }, KNOWN)
  assert.deepEqual(v.metrics, ['sdnn', 'score_stress'])
  assert.equal(v.preset, '90')
  assert.equal(v.compare, 'last60')
  assert.equal(v.points, false)
  assert.equal(v.scale, 'full')
  // Personalizzato senza date non sta in piedi: torna a 30 giorni.
  assert.equal(parseChartView({ preset: 'custom' }, KNOWN).preset, '30')
  const c = parseChartView({ preset: 'custom', customFrom: '2026-09-01', customTo: '2026-09-30' }, KNOWN)
  assert.equal(c.preset, 'custom')
  assert.equal(c.customFrom, '2026-09-01')
  assert.equal(parseChartView({ metrics: ['bogus'] }, KNOWN).metrics.length, 3)
})

test('moveMetric e sameChartView', () => {
  assert.deepEqual(moveMetric(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c'])
  assert.deepEqual(moveMetric(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c'])
  assert.deepEqual(moveMetric(['a', 'b', 'c'], 'z', 1), ['a', 'b', 'c'])
  assert.equal(sameChartView(DEFAULT_CHART_VIEW, { ...DEFAULT_CHART_VIEW }), true)
  assert.equal(sameChartView(DEFAULT_CHART_VIEW, { ...DEFAULT_CHART_VIEW, points: false }), false)
})

test('exclusionReasonCounts nell\'ordine dei motivi', () => {
  assert.deepEqual(
    exclusionReasonCounts([{ motivo: 'malattia' }, { motivo: 'artefatti' }, { motivo: 'malattia' }]),
    [{ motivo: 'artefatti', n: 1 }, { motivo: 'malattia', n: 2 }],
  )
})
