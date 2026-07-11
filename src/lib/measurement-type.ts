// Riconoscimento e presentazione dei tipi di misurazione.
// La colonna `test_type` (sessions / measurement_analytics) contiene un identificatore
// testuale salvato dall'app Flutter. Normalizziamo su un set noto e mappiamo su
// label, colori (stile Notion-like) e descrizione.

import type { MeasurementAnalytics } from './types'

export type MeasurementTypeKey =
  | 'standard'
  | 'orthostatic'
  | 'coherence'
  | 'incremental'
  | 'threshold'
  | 'unknown'

export interface MeasurementTypeMeta {
  key: MeasurementTypeKey
  label: string
  description: string
  // Classi Tailwind per il badge (sfondo tenue + testo + bordo), coerenti col tema.
  badgeClass: string
  // Colore "dot" pieno per liste compatte.
  dotColor: string
}

const META: Record<MeasurementTypeKey, MeasurementTypeMeta> = {
  standard: {
    key: 'standard',
    label: 'Standard',
    description: 'Misurazione HRV a riposo',
    badgeClass: 'bg-teal-light text-teal-dark border border-teal-200',
    dotColor: '#4FA39A',
  },
  orthostatic: {
    key: 'orthostatic',
    label: 'Ortostatica',
    description: 'Test supino / in piedi con indice di reattività',
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    dotColor: '#6366F1',
  },
  coherence: {
    key: 'coherence',
    label: 'Coerenza',
    description: 'Respirazione guidata e coerenza cardiaca',
    badgeClass: 'bg-violet-50 text-violet-700 border border-violet-200',
    dotColor: '#8B5CF6',
  },
  incremental: {
    key: 'incremental',
    label: 'Test incrementale',
    description: 'Test sport a intensità crescente',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    dotColor: '#F59E0B',
  },
  threshold: {
    key: 'threshold',
    label: 'Test soglia',
    description: 'Test sport per la stima della soglia',
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    dotColor: '#F97316',
  },
  unknown: {
    key: 'unknown',
    label: 'Misurazione',
    description: 'Tipo non specificato',
    badgeClass: 'bg-surface text-anthracite-lighter border border-surface-border',
    dotColor: '#9CA3AF',
  },
}

// Normalizza il valore grezzo di test_type sulle chiavi note. Tollera varianti
// (maiuscole, sinonimi italiani/inglesi) perché l'app può evolvere le stringhe.
export function normalizeTestType(raw: string | null | undefined): MeasurementTypeKey {
  if (!raw) return 'standard' // storicamente le misurazioni senza tipo sono standard
  const t = raw.trim().toLowerCase()
  if (t === 'standard' || t === 'default' || t === 'resting' || t === 'riposo') return 'standard'
  if (t.startsWith('orthostat') || t === 'ortostatica' || t === 'ortostatico') return 'orthostatic'
  if (t.startsWith('coheren') || t === 'coerenza' || t === 'breathing' || t === 'respirazione') return 'coherence'
  if (t.includes('increment')) return 'incremental'
  if (t.includes('threshold') || t.includes('soglia')) return 'threshold'
  return 'unknown'
}

export function measurementTypeMeta(raw: string | null | undefined): MeasurementTypeMeta {
  return META[normalizeTestType(raw)]
}

export const ALL_MEASUREMENT_TYPE_META: MeasurementTypeMeta[] = [
  META.standard,
  META.orthostatic,
  META.coherence,
  META.incremental,
  META.threshold,
]

// ── Rilevamento misurazioni lunghe ───────────────────────────────────────────
// Consideriamo "lunga" una misurazione con durata elevata o con dati di andamento
// nel tempo (segmenti / serie rolling) salvati.
const LONG_MEASUREMENT_SECONDS = 12 * 60 // 12 minuti

export function isLongMeasurement(m: Pick<MeasurementAnalytics, 'duration_seconds' | 'duration_type' | 'segments' | 'rolling_series'>): boolean {
  const hasSegments = Array.isArray(m.segments) && m.segments.length > 1
  const hasRolling = Array.isArray(m.rolling_series) && m.rolling_series.length > 0
  const longByTime = (m.duration_seconds ?? 0) >= LONG_MEASUREMENT_SECONDS
  const isFree = m.duration_type === 'free'
  return hasSegments || hasRolling || longByTime || isFree
}

// ── Formattazione tempo adattiva ─────────────────────────────────────────────
// mm:ss per sessioni brevi, hh:mm:ss quando si superano i 60 minuti.
export function formatClock(totalSeconds: number, forceHours = false): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0 || forceHours) return `${pad(h)}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

// Durata leggibile compatta: "10 min", "1h 05m", "45s".
export function formatDurationHuman(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || totalSeconds <= 0) return '—'
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m} min`
  return `${sec}s`
}
