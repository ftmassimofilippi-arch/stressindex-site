import { measuredInstant, num } from '@/lib/format'
import type { Tr } from '@/i18n/types'
import type { MeasurementAnalytics } from '@/lib/types'

// =============================================================================
// Aggregati del report periodico (medie, min/max, giorno migliore/peggiore) e
// commento automatico basato su regole. Modulo puro, condiviso da pagina di
// stampa e generatore legacy.
// =============================================================================

export const SCORE_KEYS = ['score_stress', 'score_recupero', 'score_equilibrio', 'score_energia', 'score_modulazione_infiammatoria'] as const
export type ScoreKey = (typeof SCORE_KEYS)[number]

/** Chiave in `scores.names` per ogni colonna. */
export const SCORE_NAME_KEYS: Record<ScoreKey, string> = {
  score_stress: 'stress',
  score_recupero: 'recovery',
  score_equilibrio: 'balance',
  score_energia: 'energy',
  score_modulazione_infiammatoria: 'adaptation',
}

/** Colori degli score come nella dashboard. */
export const SCORE_COLORS: Record<ScoreKey, string> = {
  score_stress: '#E74C3C',
  score_recupero: '#2ECC71',
  score_equilibrio: '#3498DB',
  score_energia: '#F39C12',
  score_modulazione_infiammatoria: '#9B59B6',
}

export type ScoreStats = {
  count: number
  mean: number | null
  min: number | null
  max: number | null
  first: number | null
  last: number | null
  deltaPct: number | null
}

function sortedAsc(measurements: MeasurementAnalytics[]): MeasurementAnalytics[] {
  return [...measurements].sort((a, b) => (measuredInstant(a)?.getTime() ?? 0) - (measuredInstant(b)?.getTime() ?? 0))
}

export function computeScoreStats(measurements: MeasurementAnalytics[], key: ScoreKey): ScoreStats {
  const series = sortedAsc(measurements).map((m) => m[key]).filter((v): v is number => v != null && Number.isFinite(v))
  if (series.length === 0) return { count: 0, mean: null, min: null, max: null, first: null, last: null, deltaPct: null }
  const mean = series.reduce((a, b) => a + b, 0) / series.length
  const first = series[0]
  const last = series[series.length - 1]
  const deltaPct = first !== 0 ? ((last - first) / first) * 100 : null
  return { count: series.length, mean, min: Math.min(...series), max: Math.max(...series), first, last, deltaPct }
}

export type NotableDay = { measurement: MeasurementAnalytics; score: number }

export type ReportAggregates = {
  count: number
  stats: Record<ScoreKey, ScoreStats>
  bestDay: NotableDay | null // stress più basso
  worstDay: NotableDay | null // stress più alto
}

export function computeReportAggregates(measurements: MeasurementAnalytics[]): ReportAggregates {
  const stats = SCORE_KEYS.reduce((acc, k) => {
    acc[k] = computeScoreStats(measurements, k)
    return acc
  }, {} as Record<ScoreKey, ScoreStats>)
  let best: NotableDay | null = null
  let worst: NotableDay | null = null
  for (const m of measurements) {
    const s = m.score_stress
    if (s == null) continue
    if (best == null || s < best.score) best = { measurement: m, score: s }
    if (worst == null || s > worst.score) worst = { measurement: m, score: s }
  }
  return { count: measurements.length, stats, bestDay: best, worstDay: worst }
}

export type Comment = { text: string; tone: 'positive' | 'warning' | 'neutral' }

function fmtDelta(deltaPct: number, locale: string): string {
  return `${deltaPct > 0 ? '+' : ''}${num(deltaPct, 1, locale)}%`
}

/**
 * Commento automatico per uno score: stress in calo è positivo; gli altri
 * score in aumento sono positivi. Frasi ICU in `pdf.report.comments` (t con
 * namespace `pdf`), nomi degli score da `scores.names` (tScores).
 */
export function commentFor(key: ScoreKey, deltaPct: number | null, t: Tr, tScores: Tr, locale: string): Comment | null {
  if (deltaPct == null || Number.isNaN(deltaPct)) return null
  if (Math.abs(deltaPct) <= 10) {
    return { text: t('report.comments.stable', { delta: fmtDelta(deltaPct, locale) }), tone: 'neutral' }
  }
  const pct = num(Math.abs(deltaPct), 1, locale)
  if (key === 'score_stress') {
    if (deltaPct < -10) return { text: t('report.comments.stressDown', { pct }), tone: 'positive' }
    return { text: t('report.comments.stressUp', { pct }), tone: 'warning' }
  }
  const name = tScores(SCORE_NAME_KEYS[key])
  const score = locale === 'de' ? name : name.toLowerCase()
  if (deltaPct > 10) return { text: t('report.comments.scoreUp', { score, pct }), tone: 'positive' }
  return { text: t('report.comments.scoreDown', { score, pct }), tone: 'warning' }
}

/** Media di uno score su un insieme di misurazioni (null se nessun valore). */
export function meanOf(measurements: MeasurementAnalytics[], key: ScoreKey): number | null {
  const v = measurements.map((m) => m[key]).filter((x): x is number => x != null && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
