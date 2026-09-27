// =============================================================================
// Test incrementale con stima delle soglie — tipi del JSON scritto dall'app
// =============================================================================
//
// Rispecchia sport_sessions.threshold_test, schema documentato nella migrazione
// 031_sport_sessions_threshold_test.sql dell'app. Il sito LEGGE e mostra: tutti
// i calcoli (regressione, soglie, zone) sono già nel JSON. Le intensità sono
// nell'unità della modalità: bike → watt, treadmill → km/h, field → secondi al
// km (390 = 6:30 min/km).

export type ThresholdMode = 'bike' | 'treadmill' | 'field'

export interface ThresholdConfig {
  mode: ThresholdMode
  warmup_s: number
  warmup_intensity: number | null
  start_intensity: number
  increment: number
  step_s: number
  max_steps: number
  treadmill_grade_pct: number
  preset: string | null
  estimate_enabled: boolean
}

export interface ThresholdStep {
  index: number // 0 = riscaldamento
  start_s: number
  end_s: number
  target_intensity: number | null
  actual_intensity: number | null
  hr_avg: number | null
  alpha1_avg: number | null
  completed_fraction: number
}

export interface ThresholdRecovery {
  start_s: number
  duration_s: number
  hr_at_stop: number | null
  hr_at_60: number | null
  hrr60: number | null
  rmssd_5min: number | null
}

export interface ThresholdRegression {
  slope: number
  intercept: number
  r2: number
  n: number
  hr_min: number
  hr_max: number
}

export interface ThresholdEstimate {
  hr: number
  ci95: number
  intensity: number | null
}

export interface HrZone {
  zone: number // 1..5
  lo: number | null
  hi: number | null
  merged_with: number | null
}

export type ThresholdReason =
  | 'notEnoughData'
  | 'tooManyArtifacts'
  | 'sensorNoRr'
  | 'noDescendingTract'
  | 'lowR2'
  | 'vt1NotReached'
  | 'vt2NotReached'
  | 'vt1Extrapolated'
  | 'vt2Extrapolated'
  | 'inconsistent'

export interface ThresholdAnalysis {
  reasons: ThresholdReason[]
  valid_windows: number
  valid_seconds: number
  discarded_for_artifacts: number
  regression: ThresholdRegression | null
  vt1: ThresholdEstimate | null
  vt2: ThresholdEstimate | null
  hr_max_observed: number | null
  alpha1_min_observed: number | null
  max_step_completed: number | null
  hrr60: number | null
  recovery_rmssd_5min: number | null
  zones: HrZone[]
  used_windows: number[]
  reliable: boolean
  can_save: boolean
}

export interface ThresholdTestRecord {
  v: number
  config: ThresholdConfig
  steps: ThresholdStep[]
  stop_at_s: number
  step_reached: number
  step_fraction: number
  sensor_rr_capable: boolean
  sensor_name: string | null
  recovery: ThresholdRecovery | null
  analysis: ThresholdAnalysis | null
}

// ── Parsing difensivo ────────────────────────────────────────────────────────

function n(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const x = Number(v)
    return Number.isFinite(x) ? x : null
  }
  return null
}
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** Legge il JSONB della sessione; null se assente o non riconoscibile. */
export function parseThresholdTest(raw: unknown): ThresholdTestRecord | null {
  const o = obj(raw)
  if (!o) return null
  const c = obj(o.config)
  if (!c) return null
  const mode = c.mode === 'treadmill' || c.mode === 'field' ? c.mode : 'bike'
  const config: ThresholdConfig = {
    mode,
    warmup_s: n(c.warmup_s) ?? 600,
    warmup_intensity: n(c.warmup_intensity),
    start_intensity: n(c.start_intensity) ?? 0,
    increment: n(c.increment) ?? 0,
    step_s: n(c.step_s) ?? 180,
    max_steps: n(c.max_steps) ?? 25,
    treadmill_grade_pct: n(c.treadmill_grade_pct) ?? 1,
    preset: typeof c.preset === 'string' ? c.preset : null,
    estimate_enabled: c.estimate_enabled !== false,
  }
  const steps: ThresholdStep[] = arr(o.steps)
    .map(obj)
    .filter((s): s is Record<string, unknown> => !!s)
    .map((s) => ({
      index: n(s.index) ?? 0,
      start_s: n(s.start_s) ?? 0,
      end_s: n(s.end_s) ?? 0,
      target_intensity: n(s.target_intensity),
      actual_intensity: n(s.actual_intensity),
      hr_avg: n(s.hr_avg),
      alpha1_avg: n(s.alpha1_avg),
      completed_fraction: n(s.completed_fraction) ?? 1,
    }))
  const r = obj(o.recovery)
  const recovery: ThresholdRecovery | null = r
    ? {
        start_s: n(r.start_s) ?? 0,
        duration_s: n(r.duration_s) ?? 0,
        hr_at_stop: n(r.hr_at_stop),
        hr_at_60: n(r.hr_at_60),
        hrr60: n(r.hrr60),
        rmssd_5min: n(r.rmssd_5min),
      }
    : null
  const a = obj(o.analysis)
  let analysis: ThresholdAnalysis | null = null
  if (a) {
    const reg = obj(a.regression)
    const est = (v: unknown): ThresholdEstimate | null => {
      const e = obj(v)
      const hr = e ? n(e.hr) : null
      return e && hr != null ? { hr, ci95: n(e.ci95) ?? 0, intensity: n(e.intensity) } : null
    }
    analysis = {
      reasons: arr(a.reasons).filter((x): x is ThresholdReason => typeof x === 'string'),
      valid_windows: n(a.valid_windows) ?? 0,
      valid_seconds: n(a.valid_seconds) ?? 0,
      discarded_for_artifacts: n(a.discarded_for_artifacts) ?? 0,
      regression:
        reg && n(reg.slope) != null
          ? {
              slope: n(reg.slope) ?? 0,
              intercept: n(reg.intercept) ?? 0,
              r2: n(reg.r2) ?? 0,
              n: n(reg.n) ?? 0,
              hr_min: n(reg.hr_min) ?? 0,
              hr_max: n(reg.hr_max) ?? 0,
            }
          : null,
      vt1: est(a.vt1),
      vt2: est(a.vt2),
      hr_max_observed: n(a.hr_max_observed),
      alpha1_min_observed: n(a.alpha1_min_observed),
      max_step_completed: n(a.max_step_completed),
      hrr60: n(a.hrr60),
      recovery_rmssd_5min: n(a.recovery_rmssd_5min),
      zones: parseHrZones(a.zones),
      used_windows: arr(a.used_windows).map(n).filter((x): x is number => x != null),
      reliable: a.reliable === true,
      can_save: a.can_save === true,
    }
  }
  return {
    v: n(o.v) ?? 1,
    config,
    steps,
    stop_at_s: n(o.stop_at_s) ?? 0,
    step_reached: n(o.step_reached) ?? 0,
    step_fraction: n(o.step_fraction) ?? 0,
    sensor_rr_capable: o.sensor_rr_capable !== false,
    sensor_name: typeof o.sensor_name === 'string' ? o.sensor_name : null,
    recovery,
    analysis,
  }
}

/** Le zone FC salvate sul profilo (clients.hr_zones) o nell'analisi. */
export function parseHrZones(raw: unknown): HrZone[] {
  return arr(raw)
    .map(obj)
    .filter((z): z is Record<string, unknown> => !!z && n(z.zone) != null)
    .map((z) => ({ zone: n(z.zone) as number, lo: n(z.lo), hi: n(z.hi), merged_with: n(z.merged_with) }))
}

// ── Formattazione ────────────────────────────────────────────────────────────

export const THRESHOLD_MODE_LABEL: Record<ThresholdMode, string> = {
  bike: 'Bici',
  treadmill: 'Corsa su tapis roulant',
  field: 'Corsa su campo',
}

export const THRESHOLD_MODE_UNIT: Record<ThresholdMode, string> = {
  bike: 'W',
  treadmill: 'km/h',
  field: 'min/km',
}

/** Intensità nella sua unità; il ritmo esce come m:ss min/km. */
export function formatIntensity(mode: ThresholdMode, v: number | null | undefined, withUnit = true): string {
  if (v == null || !Number.isFinite(v)) return '—'
  switch (mode) {
    case 'bike':
      return `${Math.round(v)}${withUnit ? ' W' : ''}`
    case 'treadmill':
      return `${v.toFixed(1).replace('.', ',')}${withUnit ? ' km/h' : ''}`
    case 'field': {
      const total = Math.round(v)
      const m = Math.floor(total / 60)
      const s = String(total % 60).padStart(2, '0')
      return `${m}:${s}${withUnit ? ' min/km' : ''}`
    }
  }
}

export const THRESHOLD_REASON_TEXT: Record<ThresholdReason, string> = {
  notEnoughData: 'Meno di 10 minuti di dati validi dopo il riscaldamento.',
  tooManyArtifacts: 'Troppe finestre scartate per artefatti: fascia poco aderente o asciutta.',
  sensorNoRr: 'Il sensore non trasmetteva intervalli RR.',
  noDescendingTract: 'Alpha1 non mostra una discesa stabile con l’aumento della FC.',
  lowR2: 'La retta descrive male i dati (R² sotto 0,6).',
  vt1NotReached: 'Intensità raggiunta insufficiente: alpha1 non è mai sceso sotto 0,75.',
  vt2NotReached: 'Il test non ha raggiunto la seconda soglia: alpha1 non è mai sceso sotto 0,50.',
  vt1Extrapolated: 'La FC stimata cadrebbe oltre 5 bpm dai dati osservati: non si estrapola.',
  vt2Extrapolated: 'La FC stimata cadrebbe oltre 5 bpm dai dati osservati: non si estrapola.',
  inconsistent: 'VT2 non è sopra VT1: stima incoerente, non salvata.',
}

/** Lettura del recupero a 60 s (stesse soglie dell'app: Cole 1999 e norme
 *  sportive): ≥ 25 buono, 13–24 nella media, ≤ 12 da migliorare. */
export function hrr60Band(hrr60: number): { label: string; tone: string } {
  if (hrr60 >= 25) return { label: 'buono', tone: 'text-emerald-700' }
  if (hrr60 >= 13) return { label: 'nella media', tone: 'text-blue-700' }
  return { label: 'da migliorare', tone: 'text-amber-700' }
}

/** Nota metodologica, identica all'app. */
export const THRESHOLD_METHOD_NOTE =
  'Stima delle soglie basata sul DFA alpha1 (Rogers et al. 2021). Il DFA alpha1 da solo tende a collocare la prima soglia qualche battito più in alto rispetto al test da laboratorio. Per la massima precisione il riferimento resta il test cardiopolmonare.'

export const THRESHOLD_TEST_TYPE = 'threshold_test'

/** Profilo atleta: soglie e zone salvate (clients, migrazione 032). */
export interface AthleteThresholds {
  hr_vt1: number | null
  hr_vt2: number | null
  vt_test_date: string | null
  vt_mode: ThresholdMode | null
  power_vt1: number | null
  power_vt2: number | null
  speed_vt1: number | null
  speed_vt2: number | null
  hr_zones: HrZone[]
  hr_zones_manual: boolean
  threshold_session_id: string | null
}
