// =============================================================================
// Tipi del modulo Monitoraggio (24h) e Sonno — tabella `monitoring_sessions`
// =============================================================================
//
// Rispecchiano 1:1 la serializzazione Dart dell'app (lib/models/monitoring/*,
// lib/models/sleep/sleep_night.dart): le chiavi jsonb sono il contratto con
// l'app e NON vanno rinominate. Il sito legge e disegna, non ricalcola mai:
// ogni numero mostrato viene da questi campi. Vedi docs/MONITORAGGIO_SITO_ANALISI.md.

export type MonitoringType = '24h' | 'sleep' | 'custom'
export type MonitoringSource = 'polar_h10_offline' | 'polar_h10_live' | 'external_device' | 'import'
export type SignalQuality = 'good' | 'fair' | 'poor'
export type RecordingProfile = 'breve' | 'giornata' | 'notte' | 'giorno_notte' | 'ciclo_completo'

/** Stato di una finestra della timeline 24h (id = contratto col DB). */
export type MonitoringState = 'stress' | 'recovery' | 'activity' | 'neutral' | 'invalid'

export type MonitoringEventType =
  | 'coffee' | 'meal' | 'alcohol' | 'training' | 'stress'
  | 'sleep_start' | 'wake_up' | 'supplement' | 'relax' | 'other'

export type EventResponseLabel = 'attivazione' | 'neutro' | 'recupero' | 'dati insufficienti'

// ── 24h: finestre ─────────────────────────────────────────────────────────────

/** Finestra mobile di 5 min, passo 1 min (MonitoringWindow.toJson, chiavi brevi). */
export interface MonitoringWindow {
  s: string // ISO UTC inizio
  e: string // ISO UTC fine
  valid: boolean
  state: MonitoringState
  art: number | null // % artefatti
  cov?: number | null // copertura 0-1
  hr: number | null
  hr_min: number | null
  hr_max: number | null
  rmssd: number | null
  ln_rmssd: number | null
  sdnn: number | null
  pnn50: number | null
  lf_hf: number | null
  hf_nu: number | null
  si: number | null // Baevsky
  dfa: number | null // DFA α1, una finestra ogni 5
  br?: number | null // respiro stimato (1.1)
}

// ── 24h: eventi ───────────────────────────────────────────────────────────────

export interface EventResponse {
  label: EventResponseLabel
  hr_before: number | null
  hr_after: number | null
  hr_late: number | null
  ln_rmssd_before: number | null
  ln_rmssd_after: number | null
  ln_rmssd_late: number | null
  delta_hr: number | null
  delta_hr_pct: number | null
  delta_ln_rmssd: number | null
  delta_ln_rmssd_pct: number | null
  delta_hr_late: number | null
  delta_ln_rmssd_late: number | null
  n_before: number
  n_after: number
  n_late: number
}

export interface MonitoringEvent {
  id: string
  type: MonitoringEventType
  timestamp: string // ISO UTC
  label: string
  note: string | null
  /** null = mai calcolata (evento nuovo/modificato dal sito, in attesa dell'app). */
  response: EventResponse | null
}

// ── 24h: notte ────────────────────────────────────────────────────────────────

export interface MonitoringNightHour {
  hour_start: string
  mean_hr: number | null
  rmssd: number | null
  state: MonitoringState
}

export interface MonitoringNight {
  night_start: string
  night_end: string
  /** true = rilevata dalla frequenza cardiaca; false = dagli eventi sonno/risveglio. */
  detected: boolean
  duration_minutes: number
  mean_hr_night: number | null
  min_hr_night: number | null
  min_hr_time: string | null
  rmssd_mean_night: number | null
  ln_rmssd_night: number | null
  sdnn_night: number | null
  hr_dip_percentage: number | null
  hourly: MonitoringNightHour[]
  recovery_first_3h: number | null
  recovery_last_3h: number | null
  recovery_trend: number | null
  recovery_percentage_night: number | null
  /** Episodi di attivazione stimati (MAI "risvegli"). */
  awakenings_estimate: number | null
}

// ── 24h: summary ──────────────────────────────────────────────────────────────

export interface MonitoringBout {
  start: string
  end: string
  minutes: number
}

/** Parametri HRV di una serie (intera / notte / giorno), calcolati dall'app nei tratti continui. */
export interface SeriesHrv {
  rr_count: number
  minutes: number
  mean_hr: number | null
  rmssd: number | null
  sdnn: number | null
  pnn50: number | null
  lf_hf: number | null
  lf_nu: number | null
  hf_nu: number | null
  total_power: number | null
  si: number | null
  dfa_alpha1: number | null
  sd1: number | null
  sd2: number | null
  dfa_alpha2?: number | null
  ulf?: number | null
  vlf?: number | null
  lf?: number | null
  hf?: number | null
  tracts?: number | null
  tract_minutes?: number | null
}

export interface TractStats { count: number; longest_min: number; total_min: number }

export interface ReserveCurve {
  /** [ISO, valore] ogni 5 min */
  pts: Array<[string, number | null]>
  start: number | null
  end: number | null
  min: number | null
  min_t: string | null
  max: number | null
  max_t: string | null
}

export interface RecoveryPauses { count: number; total_min: number; items: MonitoringBout[] }

export interface ReturnTimeItem { s: string; e: string; min: number; ok: boolean }
export interface ReturnTimes { median: number | null; worst: number | null; worst_at: string | null; items: ReturnTimeItem[] }

export interface PrsaSummary {
  dc: number | null
  ac: number | null
  n_dec: number
  n_acc: number
  beats: number
  curve_dec: Array<number | null>
  curve_acc: Array<number | null>
}

export interface FragmentationSummary { pip: number | null; ials: number | null; pss: number | null; pas: number | null; beats: number }

export interface RespirationSummary { day: number | null; night: number | null; all: number | null; sd: number | null; n: number }

export interface TimeToMinHr {
  min: number
  at: string
  hr: number | null
  /** [minuti dall'inizio notte, HR] ogni 10 min */
  descent: Array<[number, number | null]>
}

export interface UltradianCycles { present: boolean; period: number | null; cycles: number | null; strength: number | null }

export interface CosinorSummary {
  mesor: number | null
  amp: number | null
  acro: number | null
  bathy: number | null
  r2: number | null
  hours: number
  indicative: boolean
}

export interface MseSummary { e: Array<number | null>; ci: number | null; beats: number; chunks: number }

export interface HourPattern {
  h: string
  hr: number | null
  ln: number | null
  lfhf: number | null
  state: MonitoringState
  n: number
}

/** `summary.advanced` (dalla 1.1). Ogni indice è null/assente se il requisito non è soddisfatto. */
export interface MonitoringAdvanced {
  tracts?: TractStats | null
  reserve?: ReserveCurve | null
  pauses?: RecoveryPauses | null
  longest_stretch?: MonitoringBout | null
  return_times?: ReturnTimes | null
  prsa?: PrsaSummary | null
  fragmentation?: FragmentationSummary | null
  respiration?: RespirationSummary | null
  time_to_min?: TimeToMinHr | null
  ultradian?: UltradianCycles | null
  cosinor_hr?: CosinorSummary | null
  cosinor_ln_rmssd?: CosinorSummary | null
  mse?: MseSummary | null
  dfa_alpha2?: number | null
  hourly?: HourPattern[]
  /** indexId → motivo (testo dell'app). */
  unavailable?: Record<string, string>
  /** indexId calcolati ma da leggere con cautela (copertura < 60 %). */
  unreliable?: string[]
}

export interface MonitoringSummary {
  percent_stress: number
  percent_recovery: number
  percent_activity: number
  percent_neutral: number
  percent_invalid: number
  recovery_minutes_day: number
  stress_minutes_day: number
  longest_stress_bout: MonitoringBout | null
  longest_recovery_bout: MonitoringBout | null
  peak_stress_time: string | null
  mean_hr_24h: number | null
  rmssd_mean_24h: number | null
  hr_rest: number | null
  hr_max_used: number | null
  stress_recovery_balance: number
  stress_recovery_label: string
  night_recovery_quality: number | null
  summary_phrase: string
  ln_rmssd_reference?: number | null
  ln_rmssd_mad?: number | null
  hr_median?: number | null
  activity_threshold_hr?: number | null
  series?: { full: SeriesHrv | null; night: SeriesHrv | null; day: SeriesHrv | null }
  gap_minutes?: number | null
  clock_shortfall_minutes?: number | null
  advanced?: MonitoringAdvanced | null
}

export interface MonitoringScores {
  stress: number
  recovery: number
  balance: number
  energy: number
  inflammation: number
  composite: number
  demo_normalized?: boolean
}

export interface BaselineSnapshot {
  metric: string
  mean: number
  sd: number
  swc: number
  rolling_7d: number | null
  n: number
  source: 'db' | 'local' | string
  applied: boolean
  reason: string | null
}

// ── Sonno ─────────────────────────────────────────────────────────────────────

/** Stato di un minuto della notte (id italiani in camelCase, contratto col DB). */
export type SleepWindowState = 'nonValido' | 'desaturazione' | 'sotto90' | 'movimento' | 'normale'

export interface SleepWindow {
  s: string
  e: string
  state: SleepWindowState
  spo2: number | null
  spo2_min: number | null
  pr: number | null
  mov: number | null
  ev: number
}

export interface SleepDesaturationEvent {
  start: string
  duration_sec: number
  baseline: number | null
  nadir: number
  drop: number | null
  nadir_time: string
  surge_bpm: number | null
}

export interface SleepInvalidSegment { start: string; end: string }

export interface SleepSignal {
  sample_interval_sec: number
  sample_count: number
  valid_sample_count: number
  coverage_pct: number
  coverage_label: SignalQuality
  invalid_segments: SleepInvalidSegment[]
  valid_recording_minutes: number
  valid_time_minutes: number
}

export type Odi3Label = 'normal' | 'mild' | 'moderate' | 'marked'
export type T90Label = 'normal' | 'observe' | 'relevant'
export type SleepScoreLabel = 'poor' | 'sufficient' | 'good' | 'very_good' | 'excellent'

export interface SleepOxygenation {
  spo2_basal: number | null
  mean_spo2: number | null
  nadir: number
  nadir_time: string | null
  spo2_sd: number | null
  delta_index_12s: number | null
  odi3: number
  odi4: number
  odi3_label: Odi3Label
  event_count: number
  event_count_4: number
  t90_minutes: number
  t90_pct: number
  t88_minutes: number
  t88_pct: number
  t85_minutes: number
  t85_pct: number
  t90_label: T90Label
  cyclic_runs: number
  cyclic_minutes: number
}

export interface SleepCardiac {
  mean_pr: number
  min_pr: number
  min_pr_time: string | null
  max_pr: number
  pr_basal: number
  first_hour_median_pr: number
  dip_pct: number
  first_3h_mean_pr: number | null
  last_3h_mean_pr: number | null
  trend_bpm: number | null
  surge_event_pct: number
}

export interface SleepMovement {
  available: boolean
  moved_minutes: number
  moved_pct: number
  estimated_awakenings: number
  normalization_p95: number | null
}

export interface SleepHour { hour_start: string; spo2: number | null; pr: number | null; events: number }

export interface SleepDeviceSummary {
  o2_score: number | null
  avg_spo2: number | null
  min_spo2: number | null
  drops_3: number | null
  drops_4: number | null
  duration_below_90_sec: number | null
  asleep_time_sec: number | null
  steps: number | null
}

export interface SleepScore {
  total: number
  label: SleepScoreLabel
  oxygenation: number
  respiratory_stability: number
  cardiac_recovery: number
  continuity: number | null
  weights: { oxygenation: number; respiratory_stability: number; cardiac_recovery: number; continuity: number }
}

/** Blocco `night.sleep` di una riga sleep (SleepNight.nightJson). */
export interface SleepBlock {
  algorithm_version: string
  analyzable: boolean
  not_analyzable_reason: string | null
  signal: SleepSignal
  oxygenation: SleepOxygenation | null
  events: SleepDesaturationEvent[]
  cardiac: SleepCardiac | null
  movement: SleepMovement | null
  hourly: SleepHour[]
  device: SleepDeviceSummary | null
}

/** Colonna `night` di una riga sleep: campi di compatibilità + blocco sleep. */
export interface SleepNightJson {
  night_start: string
  night_end: string
  detected: false
  duration_minutes: number
  /** polso medio (cardiac.mean_pr) */
  mean_hr_night: number | null
  /** polso minimo (cardiac.min_pr) */
  min_hr_night: number | null
  min_hr_time: string | null
  /** risvegli stimati dal movimento (solo se disponibile) */
  awakenings_estimate: number | null
  sleep: SleepBlock
}

/** Colonna `summary` di una riga sleep (SleepNight.summaryJson). */
export interface SleepSummaryJson {
  summary_phrase: string
  sleep_score: SleepScore | null
  odi3: number | null
  odi3_label: Odi3Label | null
  t90_pct: number | null
  t90_label: T90Label | null
  coverage_pct: number | null
  analyzable: boolean
}

// ── Riga della tabella ────────────────────────────────────────────────────────

interface MonitoringRowBase {
  id: string
  user_id: string
  professionista_id: string | null
  client_id: string | null
  source: MonitoringSource
  device_name: string | null
  start_time: string
  end_time: string
  tz_offset_minutes: number
  duration_minutes: number
  rr_count: number | null
  artifact_percentage: number | null
  signal_quality: SignalQuality | null
  ectopic_count: number | null
  valid_coverage_percentage: number | null
  algorithm_version: string
  rr_storage_path: string | null
  notes: string | null
  tags: string[]
  created_at: string | null
  updated_at: string | null
  /** Colonna della migrazione 1.1 (può mancare: null). */
  recording_profile: RecordingProfile | null
  /** Colonna aggiunta dal sito (018): eventi modificati dal web, in attesa del ricalcolo dell'app. */
  events_modified_on_web: boolean
  /** Solo lato sito: nome del cliente risolto dall'anagrafica CRM. */
  client_name: string | null
  /** Solo lato sito: professionista titolare (per la vista superadmin). */
  professional_name?: string | null
}

export interface Monitoring24hSession extends MonitoringRowBase {
  monitoring_type: '24h' | 'custom'
  events: MonitoringEvent[]
  /** Vuoto nelle liste (non caricato). */
  windows: MonitoringWindow[]
  night: MonitoringNight | null
  summary: MonitoringSummary | null
  scores_night: MonitoringScores | null
  scores_morning: MonitoringScores | null
  baseline_snapshot: BaselineSnapshot | null
}

export interface SleepSession extends MonitoringRowBase {
  monitoring_type: 'sleep'
  events: MonitoringEvent[]
  /** Vuoto nelle liste (non caricato). */
  windows: SleepWindow[]
  night: SleepNightJson | null
  summary: SleepSummaryJson | null
  sleep_score: number | null
  spo2_storage_path: string | null
  device_serial: string | null
  sample_interval_seconds: number | null
}

export type MonitoringSession = Monitoring24hSession | SleepSession

export function isSleepSession(s: MonitoringSession): s is SleepSession {
  return s.monitoring_type === 'sleep'
}

export function is24hSession(s: MonitoringSession): s is Monitoring24hSession {
  return s.monitoring_type !== 'sleep'
}

/** File RR grezzo nel bucket monitoring-rr (MonitoringRrFile.toJson). */
export interface MonitoringRrFile {
  version: number
  session_id: string
  start_time: string
  tz_offset_minutes: number
  rr_ms: number[]
  /** Istanti di fine in ms dall'inizio, solo modalità Telefono vicino. */
  t_ms?: number[]
  raw_count: number
}
