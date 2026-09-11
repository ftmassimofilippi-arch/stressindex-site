// =============================================================================
// Modulo Monitoraggio / Sonno — colori, etichette, soglie, formattazione
// =============================================================================
//
// Tutto quello che c'è qui è una TRADUZIONE di ciò che l'app mostra
// (AppColors, MonitoringVisuals, MonitoringIndexTexts.*Level, SleepVisuals,
// RecordingProfile.determine, MonitoringAnalysisService.dayPart). Nessun
// indice viene calcolato: solo etichette e colori derivati da numeri che
// l'app ha già salvato. Fonte: docs/MONITORAGGIO_SITO_ANALISI.md §3.8, §5.

import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import type {
  MonitoringEventType,
  MonitoringSession,
  MonitoringSource,
  MonitoringState,
  MonitoringType,
  Odi3Label,
  RecordingProfile,
  SignalQuality,
  SleepScoreLabel,
  SleepWindowState,
  T90Label,
} from './monitoring-types'
import { isSleepSession } from './monitoring-types'

// ── Palette (AppColors in lib/widgets/hrv_widgets.dart) ──────────────────────

export const MON = {
  accent: '#3D5A80',
  accentDark: '#2B4160',
  accentLight: '#E4EBF3',
  sleep: '#3A3A6B',
  sleepDark: '#26264A',
  sleepLight: '#E7E7F2',
  success: '#2F8F6B',
  warning: '#C78A2C',
  error: '#C44E4E',
  info: '#4F7FA3',
  textPrimary: '#1F2328',
  textSecondary: '#66707A',
  textMuted: '#98A2AA',
  borderLight: '#E2E6E8',
  borderMedium: '#CDD4D8',
  secondarySurface: '#EEF1F2',
} as const

export const STATE_COLOR: Record<MonitoringState, string> = {
  recovery: '#2F8F6B',
  stress: '#C44E4E',
  activity: '#4F86C6',
  neutral: '#B8C2CC',
  invalid: '#E6E9EC',
}

/** Etichette wellness degli stati (MonitoringState.label): mai "stress" nel testo. */
export const STATE_LABEL: Record<MonitoringState, string> = {
  recovery: 'Recupero',
  stress: 'Attivazione',
  activity: 'Attività',
  neutral: 'Neutro',
  invalid: 'Non valido',
}

export const STATE_ORDER: MonitoringState[] = ['recovery', 'stress', 'activity', 'neutral', 'invalid']

export function stateOf(v: unknown): MonitoringState {
  return v === 'stress' || v === 'recovery' || v === 'activity' || v === 'neutral' ? v : 'invalid'
}

// ── Livelli a tre gradini (IndexLevel) ───────────────────────────────────────

export type IndexLevel = 'good' | 'average' | 'improve'

export const LEVEL_LABEL: Record<IndexLevel, string> = {
  good: 'buono',
  average: 'nella media',
  improve: 'da migliorare',
}

export const LEVEL_COLOR: Record<IndexLevel, string> = {
  good: STATE_COLOR.recovery,
  average: MON.warning,
  improve: STATE_COLOR.stress,
}

// Soglie identiche a MonitoringIndexTexts.*Level (indicative, wellness).
export const level = {
  dc: (dc: number): IndexLevel => (dc > 4.5 ? 'good' : dc > 2.5 ? 'average' : 'improve'),
  ac: (ac: number): IndexLevel => level.dc(Math.abs(ac)),
  hrDip: (dip: number): IndexLevel => (dip >= 10 ? 'good' : dip >= 5 ? 'average' : 'improve'),
  returnTime: (medianMinutes: number): IndexLevel => (medianMinutes <= 15 ? 'good' : medianMinutes <= 45 ? 'average' : 'improve'),
  pauses: (count: number, totalMinutes: number): IndexLevel =>
    count >= 3 && totalMinutes >= 30 ? 'good' : count >= 1 ? 'average' : 'improve',
  stretch: (minutes: number): IndexLevel => (minutes < 180 ? 'good' : minutes <= 360 ? 'average' : 'improve'),
  fragmentation: (label: string): IndexLevel =>
    label === 'ordinato' ? 'good' : label === 'intermedio' ? 'average' : 'improve',
  clock: (amplitudeBpm: number): IndexLevel => (amplitudeBpm >= 8 ? 'good' : amplitudeBpm >= 4 ? 'average' : 'improve'),
  nightQuality: (q: number): IndexLevel => (q >= 75 ? 'good' : q >= 45 ? 'average' : 'improve'),
  balance: (b: number): IndexLevel => (b >= 55 ? 'good' : b >= 45 ? 'average' : 'improve'),
  waves: (present: boolean): IndexLevel => (present ? 'good' : 'average'),
  reserve: (delta: number): IndexLevel => (delta >= 0.5 ? 'good' : delta <= -0.5 ? 'improve' : 'average'),
}

/** Etichetta della Riserva (reserve_up / reserve_down / reserve_flat, IT). */
export function reserveLabel(delta: number): string {
  return delta >= 0.5 ? 'Ricaricata' : delta <= -0.5 ? 'Consumata' : 'In pari'
}

/** Etichetta dell'Ordine del battito dal PIP (FragmentationSummary.label). */
export function fragmentationLabel(pip: number): 'ordinato' | 'intermedio' | 'frammentato' {
  return pip < 55 ? 'ordinato' : pip < 65 ? 'intermedio' : 'frammentato'
}

export function clockStrength(amplitudeBpm: number): 'marcata' | 'moderata' | 'debole' {
  return amplitudeBpm >= 8 ? 'marcata' : amplitudeBpm >= 4 ? 'moderata' : 'debole'
}

// ── Gauge (MonitoringVisuals.balanceColor / qualityColor / qualityLabel) ─────

export function balanceColor(v: number): string {
  if (v < 30) return STATE_COLOR.stress
  if (v < 45) return '#D98C5F'
  if (v <= 55) return '#8FA3B0'
  if (v <= 70) return '#6FB39A'
  return STATE_COLOR.recovery
}

export function qualityColor(v: number): string {
  if (v < 40) return STATE_COLOR.stress
  if (v < 60) return MON.warning
  if (v < 75) return '#6FB39A'
  return STATE_COLOR.recovery
}

export function qualityLabel(v: number): string {
  if (v < 40) return 'Da migliorare'
  if (v < 60) return 'Discreto'
  if (v < 75) return 'Buono'
  return 'Ottimo'
}

/** Etichetta del bilancio (MonitoringSummary.labelForBalance), usata solo se la riga non la porta. */
export function balanceLabel(v: number): string {
  if (v < 30) return 'Attivazione prevalente'
  if (v < 45) return "Tendenza all'attivazione"
  if (v <= 55) return 'Equilibrio'
  if (v <= 70) return 'Tendenza al recupero'
  return 'Recupero prevalente'
}

// ── Qualità del segnale (24h) ────────────────────────────────────────────────

export function signalQualityLabel(q: string | null | undefined): string {
  switch (q) {
    case 'good': return 'Qualità buona'
    case 'fair': return 'Qualità media'
    case 'poor': return 'Qualità insufficiente'
    default: return 'Qualità n.d.'
  }
}

export function signalQualityColor(q: string | null | undefined): string {
  switch (q) {
    case 'good': return MON.success
    case 'fair': return MON.warning
    case 'poor': return MON.error
    default: return MON.textMuted
  }
}

export function coverageColor(cov: number): string {
  return cov >= 80 ? MON.success : cov >= 60 ? MON.warning : MON.error
}

export function artifactColor(pct: number): string {
  return pct < 5 ? MON.success : pct <= 15 ? MON.warning : MON.error
}

// ── Tipo, sorgente, profilo, eventi ──────────────────────────────────────────

export const TYPE_LABEL: Record<MonitoringType, string> = {
  '24h': 'Monitoraggio 24h',
  sleep: 'Sonno',
  custom: 'Personalizzato',
}

/** Chip corto del tipo nelle liste (24h / Sonno). */
export function typeChip(t: MonitoringType): string {
  return t === 'sleep' ? 'Sonno' : t === '24h' ? '24h' : TYPE_LABEL.custom
}

export const SOURCE_LABEL: Record<MonitoringSource, string> = {
  polar_h10_offline: 'Memoria Polar H10',
  polar_h10_live: 'Telefono vicino',
  external_device: 'Dispositivo esterno',
  import: 'Importazione',
}

export function sourceLabel(s: string | null | undefined): string {
  return (s && SOURCE_LABEL[s as MonitoringSource]) || SOURCE_LABEL.import
}

export const PROFILE_LABEL: Record<RecordingProfile, string> = {
  breve: 'Breve',
  giornata: 'Giornata',
  notte: 'Notte',
  giorno_notte: 'Giorno e notte',
  ciclo_completo: 'Ciclo completo',
}

export const PROFILE_ORDER: RecordingProfile[] = ['breve', 'giornata', 'notte', 'giorno_notte', 'ciclo_completo']

export const EVENT_TYPE_LABEL: Record<MonitoringEventType, string> = {
  coffee: 'Caffè',
  meal: 'Pasto',
  alcohol: 'Alcol',
  training: 'Allenamento',
  stress: 'Momento di attivazione',
  sleep_start: 'Vado a dormire',
  wake_up: 'Mi sono svegliato',
  supplement: 'Integratore',
  relax: 'Rilassamento',
  other: 'Altro',
}

export const EVENT_TYPES: MonitoringEventType[] = [
  'coffee', 'meal', 'alcohol', 'training', 'stress', 'sleep_start', 'wake_up', 'supplement', 'relax', 'other',
]

export function isSleepMarker(t: MonitoringEventType): boolean {
  return t === 'sleep_start' || t === 'wake_up'
}

export function eventResponseColor(label: string | null | undefined): string {
  switch (label) {
    case 'attivazione': return STATE_COLOR.stress
    case 'recupero': return STATE_COLOR.recovery
    case 'neutro': return MON.accent
    default: return MON.textMuted
  }
}

// ── Profilo della registrazione: fallback per le righe 1.0 ───────────────────
//
// Replica di RecordingProfile.determine + nominalNightMinutes (Dart). È la
// derivazione di un'etichetta dalla durata e dalla notte già salvate, non un
// ricalcolo di indici. Il risultato va mostrato come "profilo stimato *".

const BREVE_MAX = 4 * 60
const GIORNATA_MIN = 6 * 60
const WAKE_FOR_DAY_NIGHT = 4 * 60
const FULL_CYCLE = 18 * 60
const NIGHT_PRESENT = 3 * 60

export function determineProfile(durationMinutes: number, nightMinutes: number, nominalNightMinutes: number): RecordingProfile {
  if (durationMinutes < BREVE_MAX) return 'breve'
  const nightPresent = nightMinutes >= NIGHT_PRESENT || nominalNightMinutes >= NIGHT_PRESENT
  if (nightPresent) {
    if (durationMinutes >= FULL_CYCLE) return 'ciclo_completo'
    const effectiveNight = nightMinutes >= NIGHT_PRESENT ? nightMinutes : nominalNightMinutes
    if (durationMinutes - effectiveNight < WAKE_FOR_DAY_NIGHT) return 'notte'
    return 'giorno_notte'
  }
  if (durationMinutes >= GIORNATA_MIN) return 'giornata'
  return 'breve'
}

/** Minuti di [start, end) nelle ore nominali di notte 23:00-07:00 dell'orologio locale del dispositivo. */
export function nominalNightMinutes(startIso: string, endIso: string, tzOffsetMinutes: number): number {
  const start = wallDate(startIso, tzOffsetMinutes)
  const end = wallDate(endIso, tzOffsetMinutes)
  if (!start || !end) return 0
  let minutes = 0
  let t = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes())
  const endMs = end.getTime()
  // passo di 10 minuti: basta per una soglia di 3 ore (stesso passo del backfill SQL)
  while (t < endMs) {
    const h = new Date(t).getUTCHours()
    if (h >= 23 || h < 7) minutes += 10
    t += 10 * 60 * 1000
  }
  return minutes
}

export interface EffectiveProfile {
  profile: RecordingProfile
  /** true se derivato dal fallback (riga senza recording_profile). */
  estimated: boolean
}

export function effectiveProfile(s: MonitoringSession): EffectiveProfile {
  if (s.recording_profile) return { profile: s.recording_profile, estimated: false }
  const nightMinutes = !isSleepSession(s) && s.night ? s.night.duration_minutes ?? 0 : 0
  return {
    profile: determineProfile(
      s.duration_minutes ?? 0,
      nightMinutes,
      nominalNightMinutes(s.start_time, s.end_time, s.tz_offset_minutes ?? 0),
    ),
    estimated: true,
  }
}

export const profileFlags = (p: RecordingProfile) => ({
  hasNightPages: p === 'notte' || p === 'giorno_notte' || p === 'ciclo_completo',
  hasWakePages: p === 'giornata' || p === 'giorno_notte' || p === 'ciclo_completo',
  hasRhythmPage: p !== 'breve',
  computesInternalClock: p === 'ciclo_completo',
})

export type MonitoringPage = 'riepilogo' | 'notte' | 'andamento' | 'eventi' | 'mappa_ore' | 'ritmo' | 'parametri'

export const PAGE_LABEL: Record<MonitoringPage, string> = {
  riepilogo: 'Riepilogo',
  notte: 'Notte',
  andamento: 'Andamento',
  eventi: 'Eventi',
  mappa_ore: 'Mappa delle ore',
  ritmo: 'Ritmo e complessità',
  parametri: 'Parametri',
}

/** Pagine per profilo (MonitoringPage.pagesFor). Le pagine escluse NON esistono. */
export function pagesFor(p: RecordingProfile, pro: boolean): MonitoringPage[] {
  const f = profileFlags(p)
  const out: MonitoringPage[] = ['riepilogo']
  if (f.hasNightPages) out.push('notte')
  out.push('andamento', 'eventi')
  if (f.hasWakePages) out.push('mappa_ore')
  if (pro && f.hasRhythmPage) out.push('ritmo')
  if (pro) out.push('parametri')
  return out
}

// ── Orologio da parete del dispositivo ───────────────────────────────────────
//
// start_time / end_time e ogni ISO nei jsonb sono istanti UTC veri; il
// dispositivo aveva tz_offset_minutes. Per mostrare l'ora che l'utente vedeva
// si sommano i minuti di offset e si leggono i componenti UTC. Non si usa il
// fuso del browser né quello del server.

export function wallDate(iso: string | null | undefined, tzOffsetMinutes: number): Date | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t + (tzOffsetMinutes ?? 0) * 60_000)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "HH:mm" nell'orologio del dispositivo. */
export function hm(iso: string | null | undefined, tz: number): string {
  const d = wallDate(iso, tz)
  return d ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : '—'
}

/** "12 set" (MonitoringVisuals.dayShort). */
export function dayShort(iso: string | null | undefined, tz: number): string {
  const d = wallDate(iso, tz)
  if (!d) return '—'
  const m = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  return `${d.getUTCDate()} ${m[d.getUTCMonth()]}`
}

/** "12 settembre 2026" nell'orologio del dispositivo. */
export function dayLong(iso: string | null | undefined, tz: number): string {
  const d = wallDate(iso, tz)
  if (!d) return '—'
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), 'd MMMM yyyy', { locale: it })
}

/** "dd/MM/yyyy" nell'orologio del dispositivo. */
export function dayNumeric(iso: string | null | undefined, tz: number): string {
  const d = wallDate(iso, tz)
  return d ? `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` : '—'
}

/** "12 set 15:02 → 13 set 06:48" */
export function periodLabel(startIso: string, endIso: string, tz: number): string {
  return `${dayShort(startIso, tz)} ${hm(startIso, tz)} → ${dayShort(endIso, tz)} ${hm(endIso, tz)}`
}

/** Ora locale (0-23) del dispositivo. */
export function wallHour(iso: string, tz: number): number {
  const d = wallDate(iso, tz)
  return d ? d.getUTCHours() : 0
}

/** Ora decimale (es. 3,25) → "03:15" (MonitoringVisuals.hourFraction). */
export function hourFraction(h: number): string {
  const hh = ((Math.floor(h) % 24) + 24) % 24
  const mm = Math.round((h - Math.floor(h)) * 60)
  return `${pad(hh)}:${pad(mm)}`
}

/** "7 h 12 min" (MonitoringVisuals.duration). */
export function duration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  const m0 = Math.round(minutes)
  const h = Math.floor(m0 / 60)
  const m = m0 % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** "45 s" / "2 min 10 s" (SleepVisuals.seconds). */
export function seconds(sec: number): string {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}

/**
 * Parte della giornata (MonitoringAnalysisService.dayPart): testo di
 * contesto per i dettagli delle card, come fa l'app.
 */
export function dayPart(iso: string, tz: number, night?: { night_start: string; night_end: string } | null): string {
  const t = new Date(iso).getTime()
  if (night) {
    const ns = new Date(night.night_start).getTime()
    const ne = new Date(night.night_end).getTime()
    if (t >= ns && t < ne) {
      if (t < ns + 2 * 3_600_000) return 'nelle prime ore di sonno'
      if (t >= ne - 3_600_000) return 'verso il risveglio'
      return 'nel cuore della notte'
    }
  }
  const h = wallHour(iso, tz)
  if (h >= 5 && h < 9) return 'al mattino presto'
  if (h >= 9 && h < 12) return 'in mattinata'
  if (h >= 12 && h < 14) return 'a metà giornata'
  if (h >= 14 && h < 18) return 'nel pomeriggio'
  if (h >= 18 && h < 22) return 'in serata'
  return 'di notte'
}

// ── Formattazione numeri ─────────────────────────────────────────────────────

export function fx(v: number | null | undefined, dec = 1, unit = ''): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v.toFixed(dec)}${unit ? ` ${unit}` : ''}`
}

export function fr(v: number | null | undefined, unit = ''): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${Math.round(v)}${unit ? ` ${unit}` : ''}`
}

/** RMSSD (ms) da ln RMSSD, per la presentazione (EventResponse.rmssdFromLn). */
export function rmssdFromLn(ln: number | null | undefined): number | null {
  return ln == null ? null : Math.exp(ln)
}

// ── Sonno (SleepVisuals) ─────────────────────────────────────────────────────

export const SLEEP_STATE_COLOR: Record<SleepWindowState, string> = {
  nonValido: STATE_COLOR.invalid,
  desaturazione: STATE_COLOR.stress,
  sotto90: '#D98C5F',
  movimento: STATE_COLOR.activity,
  normale: MON.sleepLight,
}

export const SLEEP_STATE_LABEL: Record<SleepWindowState, string> = {
  normale: 'Normale',
  desaturazione: 'Desaturazione',
  sotto90: 'Sotto 90 %',
  movimento: 'Movimento',
  nonValido: 'Non valido',
}

export const SLEEP_STATE_ORDER: SleepWindowState[] = ['normale', 'desaturazione', 'sotto90', 'movimento', 'nonValido']

export function sleepStateOf(v: unknown): SleepWindowState {
  return v === 'normale' || v === 'desaturazione' || v === 'sotto90' || v === 'movimento' ? v : 'nonValido'
}

/** Testo obbligatorio ovunque compaia l'ODI (SleepVisuals.odiDisclaimer). */
export const SLEEP_ODI_DISCLAIMER =
  "Questo indice descrive quante volte l'ossigenazione e' scesa durante la notte. " +
  "Non e' una diagnosi di apnea del sonno, che richiede un esame specifico. " +
  'Un valore alterato va portato al proprio medico.'

export function sleepScoreColor(v: number): string {
  if (v < 40) return STATE_COLOR.stress
  if (v < 60) return MON.warning
  if (v < 75) return '#6FB39A'
  if (v < 90) return STATE_COLOR.recovery
  return MON.sleep
}

export function sleepScoreLabel(label: SleepScoreLabel | string | null | undefined): string {
  switch (label) {
    case 'poor': return 'Scarso'
    case 'sufficient': return 'Sufficiente'
    case 'good': return 'Buono'
    case 'very_good': return 'Molto buono'
    case 'excellent': return 'Ottimo'
    default: return '—'
  }
}

export function odi3Label(label: Odi3Label | string | null | undefined): string {
  switch (label) {
    case 'normal': return 'Nella norma'
    case 'mild': return 'Alterazione lieve'
    case 'moderate': return 'Alterazione moderata'
    case 'marked': return 'Alterazione marcata'
    default: return '—'
  }
}

export function odi3Color(label: Odi3Label | string | null | undefined): string {
  switch (label) {
    case 'normal': return MON.success
    case 'mild': return MON.warning
    case 'moderate': return '#D98C5F'
    case 'marked': return MON.error
    default: return MON.textMuted
  }
}

export function t90Label(label: T90Label | string | null | undefined): string {
  switch (label) {
    case 'normal': return 'Nella norma'
    case 'observe': return 'Da osservare'
    case 'relevant': return 'Rilevante'
    default: return '—'
  }
}

export function t90Color(label: T90Label | string | null | undefined): string {
  switch (label) {
    case 'normal': return MON.success
    case 'observe': return MON.warning
    case 'relevant': return MON.error
    default: return MON.textMuted
  }
}

export function sleepCoverageLabel(label: SignalQuality | string | null | undefined): string {
  switch (label) {
    case 'good': return 'Segnale ottimo'
    case 'fair': return 'Segnale discreto'
    case 'poor': return 'Segnale disturbato'
    default: return 'Qualità n.d.'
  }
}

export function sleepCoverageColor(label: SignalQuality | string | null | undefined): string {
  switch (label) {
    case 'good': return MON.success
    case 'fair': return MON.warning
    case 'poor': return MON.error
    default: return MON.textMuted
  }
}

/** Colore di una barra 0-100 di sotto-punteggio dello Sleep Score. */
export function sleepComponentColor(v: number): string {
  if (v >= 75) return STATE_COLOR.recovery
  if (v >= 50) return MON.warning
  return STATE_COLOR.stress
}

// Soglie del modulo Sonno usate solo per colorare (SleepParams).
export const SLEEP_PARAMS = {
  t90Threshold: 90,
  surgeThresholdBpm: 6,
  /** SpO₂ sotto cui il nadir è evidenziato (SleepParams.oxyNadirPenaltyBelow). */
  oxyNadirPenaltyBelow: 85,
  /** Calo del polso verso il basale considerato pieno (SleepParams.cardioDipFullPct). */
  cardioDipFullPct: 10,
  /** Delta index 12 s oltre cui il segnale è "instabile". */
  deltaIndexUnstable: 4,
} as const

// ── Numeri chiave per liste e card compatte ──────────────────────────────────

export interface KeyNumber {
  label: string
  value: string
  color?: string
}

/** I tre numeri chiave del profilo (24h) o del modulo Sonno, per liste e card. */
export function keyNumbers(s: MonitoringSession): KeyNumber[] {
  if (isSleepSession(s)) {
    const o = s.night?.sleep?.oxygenation ?? null
    const c = s.night?.sleep?.cardiac ?? null
    const score = s.summary?.sleep_score ?? null
    return [
      { label: 'SpO₂ media', value: o ? `${o.mean_spo2 == null ? '—' : o.mean_spo2.toFixed(1)} %` : '—', color: MON.sleepDark },
      { label: 'Polso medio', value: c ? `${Math.round(c.mean_pr)} bpm` : '—', color: MON.sleepDark },
      {
        label: 'Sleep Score',
        value: score ? `${score.total}` : '—',
        color: score ? sleepScoreColor(score.total) : MON.textMuted,
      },
    ]
  }
  const sum = s.summary
  const { profile } = effectiveProfile(s)
  const f = profileFlags(profile)
  const balance = sum ? `${Math.round(sum.stress_recovery_balance)}` : '—'
  const out: KeyNumber[] = [
    { label: 'Bilancio', value: balance, color: sum ? balanceColor(sum.stress_recovery_balance) : MON.textMuted },
  ]
  if (f.hasNightPages) {
    const q = sum?.night_recovery_quality
    out.push({ label: 'Recupero notturno', value: q == null ? '—' : `${Math.round(q)}`, color: q == null ? MON.textMuted : qualityColor(q) })
  }
  if (f.hasWakePages) {
    const p = sum?.advanced?.pauses
    out.push({ label: 'Pause di recupero', value: p ? `${p.count} · ${p.total_min} min` : '—', color: MON.accentDark })
  }
  if (out.length < 3) {
    out.push({ label: 'Tempo in recupero', value: sum ? `${Math.round(sum.percent_recovery)} %` : '—', color: STATE_COLOR.recovery })
  }
  return out.slice(0, 3)
}
