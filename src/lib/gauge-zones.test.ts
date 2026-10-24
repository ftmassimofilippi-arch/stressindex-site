// Test delle fasce degli score (src/lib/gauge-zones.ts): confini, etichette e
// colori dell'Appendice A del manuale (decisioni 2, 15, 16 del 23/10/2026).
// Il test "fitness" in fondo controlla che i componenti che colorano uno score
// importino da gauge-zones, come fa score_zones_test nell'app.
// Si esegue con `npm test` (node --test, senza dipendenze aggiuntive).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ZONES,
  COMPOSITE_SCHEME,
  SCORE_STABLE_DELTA,
  POSITIVE_SCORE_COLORS,
  STRESS_SCORE_COLORS,
  GREEN, DARK_GREEN, YELLOW, ORANGE, RED, DARK_RED,
  gaugeZoneKey,
  scoreZoneLabel,
  scoreZoneColor,
  scoreDeltaTone,
  zoneBounds,
  higherIsBetter,
  type GaugeColorScheme,
} from './gauge-zones.ts'

test('confini: Stress 30/50/70/85, gli altri score 25/45/65/85 (Appendice A, decisione 2)', () => {
  assert.deepEqual(zoneBounds('stress'), [30, 50, 70, 85])
  for (const s of ['recovery', 'balance', 'energy', 'adaptation'] as GaugeColorScheme[]) {
    assert.deepEqual(zoneBounds(s), [25, 45, 65, 85], s)
  }
})

test('etichette dello Stress: Basso, Equilibrio, Medio, Alto, Esaurimento (decisione 15)', () => {
  assert.equal(gaugeZoneKey('stress', 0), 'low')
  assert.equal(gaugeZoneKey('stress', 29.9), 'low')
  assert.equal(gaugeZoneKey('stress', 30), 'balance')
  assert.equal(gaugeZoneKey('stress', 49.9), 'balance')
  assert.equal(gaugeZoneKey('stress', 50), 'medium')
  assert.equal(gaugeZoneKey('stress', 69.9), 'medium')
  assert.equal(gaugeZoneKey('stress', 70), 'high')
  assert.equal(gaugeZoneKey('stress', 84.9), 'high')
  assert.equal(gaugeZoneKey('stress', 85), 'fatigue')
  assert.equal(gaugeZoneKey('stress', 100), 'fatigue')
})

test('etichette di Adattamento: Fragile, Da migliorare, Ridotta, Buona, Eccellente sui confini nuovi (decisione 2)', () => {
  assert.equal(scoreZoneLabel('adaptation', 24.9), 'fragile')
  assert.equal(scoreZoneLabel('adaptation', 25), 'toImprove')
  assert.equal(scoreZoneLabel('adaptation', 44.9), 'toImprove')
  assert.equal(scoreZoneLabel('adaptation', 45), 'reduced')
  assert.equal(scoreZoneLabel('adaptation', 64.9), 'reduced')
  assert.equal(scoreZoneLabel('adaptation', 65), 'good')
  assert.equal(scoreZoneLabel('adaptation', 84.9), 'good')
  assert.equal(scoreZoneLabel('adaptation', 85), 'excellent')
})

test('etichette di Recupero, Equilibrio, Energia', () => {
  assert.deepEqual(ZONES.recovery.map((z) => z.labelKey), ['insufficient', 'poor', 'moderate', 'good', 'optimal'])
  assert.deepEqual(ZONES.balance.map((z) => z.labelKey), ['strongImbalance', 'moderateImbalance', 'sufficient', 'good', 'optimal'])
  assert.deepEqual(ZONES.energy.map((z) => z.labelKey), ['depleted', 'low', 'moderate', 'good', 'full'])
})

test('cinque colori: Stress verde, giallo, arancio, rosso, rosso scuro; gli altri rosso, arancio, giallo, verde, verde scuro (decisione 15)', () => {
  assert.deepEqual([...STRESS_SCORE_COLORS], [GREEN, YELLOW, ORANGE, RED, DARK_RED])
  assert.deepEqual([...POSITIVE_SCORE_COLORS], [RED, ORANGE, YELLOW, GREEN, DARK_GREEN])
  assert.deepEqual(ZONES.stress.map((z) => z.color), [...STRESS_SCORE_COLORS])
  for (const s of ['recovery', 'balance', 'energy', 'adaptation'] as GaugeColorScheme[]) {
    assert.deepEqual(ZONES[s].map((z) => z.color), [...POSITIVE_SCORE_COLORS], s)
  }
})

test('scoreZoneColor: colore della fascia, con valori fuori 0-100 riportati ai bordi', () => {
  assert.equal(scoreZoneColor('stress', 10), GREEN)
  assert.equal(scoreZoneColor('stress', 40), YELLOW)
  assert.equal(scoreZoneColor('stress', 60), ORANGE)
  assert.equal(scoreZoneColor('stress', 75), RED)
  assert.equal(scoreZoneColor('stress', 90), DARK_RED)
  assert.equal(scoreZoneColor('stress', 120), DARK_RED)
  assert.equal(scoreZoneColor('recovery', 10), RED)
  assert.equal(scoreZoneColor('recovery', 48), YELLOW)
  assert.equal(scoreZoneColor('recovery', 70), GREEN)
  assert.equal(scoreZoneColor('recovery', 90), DARK_GREEN)
  assert.equal(scoreZoneColor('recovery', -5), RED)
})

test('score composito: scala positiva 25/45/65/85 (decisione 16)', () => {
  assert.deepEqual(zoneBounds(COMPOSITE_SCHEME), [25, 45, 65, 85])
  assert.equal(higherIsBetter(COMPOSITE_SCHEME), true)
})

test('verso del meglio e delta stabile a 10 punti (decisione 9)', () => {
  assert.equal(SCORE_STABLE_DELTA, 10)
  assert.equal(higherIsBetter('stress'), false)
  assert.equal(higherIsBetter('recovery'), true)
  assert.equal(scoreDeltaTone('stress', -12), 'better')
  assert.equal(scoreDeltaTone('stress', 12), 'worse')
  assert.equal(scoreDeltaTone('stress', 9), 'stable')
  assert.equal(scoreDeltaTone('recovery', 12), 'better')
  assert.equal(scoreDeltaTone('recovery', -12), 'worse')
  assert.equal(scoreDeltaTone('recovery', -9), 'stable')
  assert.equal(scoreDeltaTone('recovery', 10), 'better')
})

// Fitness: chi colora uno score importa da gauge-zones (nessuna scala locale).
test('ScoreBar, GaugeScore, heatmap e PDF leggono le fasce da gauge-zones', () => {
  const root = join(import.meta.dirname, '..')
  const files = [
    'components/dashboard/ScoreBar.tsx',
    'components/dashboard/GaugeScore.tsx',
    'app/[locale]/area-professionisti/clienti/[id]/tabs/AdvancedAnalyticsTab.tsx',
    'lib/measurement-pdf.tsx',
    'lib/monitoring-pdf.tsx',
  ]
  for (const f of files) {
    const src = readFileSync(join(root, f), 'utf8')
    assert.match(src, /from '(@\/lib\/|\.\/)gauge-zones'/, `${f} deve importare da gauge-zones`)
  }
})
