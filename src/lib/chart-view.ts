// =============================================================================
// La vista dei grafici preparata dal professionista, annotazioni ed esclusioni
// =============================================================================
//
// Modulo puro: i tipi e la lettura tollerante del jsonb `client_settings.chart_view`
// (sito-049). Il professionista regola la VISTA, non i dati: qui non c'è un
// valore di misurazione, solo cosa e come mostrare.

import { PRESET_KEYS, type PresetKey } from './trend-period.ts'

/** Con che cosa si confronta la media mobile di oggi. */
export type CompareKind = 'course' | 'periodStart' | 'previous' | 'last60'
export const COMPARE_KINDS: readonly CompareKind[] = ['course', 'periodStart', 'previous', 'last60']

export type ChartView = {
  /** Indici mostrati, nell'ordine. */
  metrics: string[]
  preset: PresetKey
  customFrom: string | null
  customTo: string | null
  compare: CompareKind
  /** Puntini delle singole misurazioni. */
  points: boolean
  scale: 'fit' | 'full'
}

export const DEFAULT_CHART_VIEW: ChartView = {
  metrics: ['score_stress', 'score_recupero', 'rmssd'],
  preset: '30',
  customFrom: null,
  customTo: null,
  compare: 'course',
  points: true,
  scale: 'fit',
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Legge il jsonb salvato; ogni campo non valido torna al default. */
export function parseChartView(raw: unknown, knownMetrics: ReadonlySet<string>): ChartView {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const metrics = Array.isArray(o.metrics) ? o.metrics.filter((k): k is string => typeof k === 'string' && knownMetrics.has(k)) : []
  const preset = typeof o.preset === 'string' && PRESET_KEYS.has(o.preset) ? (o.preset as PresetKey) : DEFAULT_CHART_VIEW.preset
  const customFrom = typeof o.customFrom === 'string' && DAY.test(o.customFrom) ? o.customFrom : null
  const customTo = typeof o.customTo === 'string' && DAY.test(o.customTo) ? o.customTo : null
  return {
    metrics: metrics.length ? Array.from(new Set(metrics)) : [...DEFAULT_CHART_VIEW.metrics],
    preset: preset === 'custom' && !(customFrom && customTo) ? DEFAULT_CHART_VIEW.preset : preset,
    customFrom,
    customTo,
    compare: typeof o.compare === 'string' && (COMPARE_KINDS as string[]).includes(o.compare) ? (o.compare as CompareKind) : 'course',
    points: typeof o.points === 'boolean' ? o.points : true,
    scale: o.scale === 'full' ? 'full' : 'fit',
  }
}

export function sameChartView(a: ChartView | null | undefined, b: ChartView | null | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** Sposta un indice su (-1) o giù (+1) nell'ordine; fuori dai bordi non cambia nulla. */
export function moveMetric(list: string[], key: string, dir: -1 | 1): string[] {
  const i = list.indexOf(key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

// ── Annotazioni ed esclusioni ────────────────────────────────────────────────

export type ChartAnnotation = { id: string; day: string; text: string }

export const EXCLUSION_REASONS = ['artefatti', 'condizioni_anomale', 'malattia', 'altro'] as const
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number]

export type MeasurementExclusion = { id: string; session_id: string; motivo: ExclusionReason; nota: string | null }

/** Vista salvata, annotazioni ed esclusioni di una scheda, come arrivano dal server. */
export type ChartPrefs = {
  view: ChartView | null
  annotations: ChartAnnotation[]
  exclusions: MeasurementExclusion[]
  /** La sito-049 è applicata: tabelle e colonna esistono. */
  ready: boolean
}

export const EMPTY_CHART_PREFS: ChartPrefs = { view: null, annotations: [], exclusions: [], ready: false }

export function isExclusionReason(v: unknown): v is ExclusionReason {
  return typeof v === 'string' && (EXCLUSION_REASONS as readonly string[]).includes(v)
}

/** Conteggio per motivo, per la nota del report ("2 escluse: artefatti, malattia"). */
export function exclusionReasonCounts(list: Array<{ motivo: ExclusionReason }>): Array<{ motivo: ExclusionReason; n: number }> {
  const out: Array<{ motivo: ExclusionReason; n: number }> = []
  for (const r of EXCLUSION_REASONS) {
    const n = list.filter((e) => e.motivo === r).length
    if (n > 0) out.push({ motivo: r, n })
  }
  return out
}
