// Helper di formattazione e costanti del Modulo Sport (zone DFA, livelli, dolore).
//
// Le etichette visibili NON stanno qui: ogni struttura porta una chiave neutra
// e la traduzione avviene in visualizzazione con `t = useTranslations('sport')`
// (o `getTranslations('sport')`), passata alle funzioni `*Label`.
import type { Tr } from '@/i18n/types'
import type { CompetitiveLevel } from './sport-data'

// ── Durata ───────────────────────────────────────────────────────────────────

// Durata in formato compatto: 1h 05m / 42m 10s / 38m (sigle uguali in it/en/de)
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return sec > 0 ? `${m}m ${String(sec).padStart(2, '0')}s` : `${m}m`
  return `${sec}s`
}

// mm:ss per l'asse temporale dei grafici (da millisecondi)
export function formatClock(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Zone DFA Alpha1 ──────────────────────────────────────────────────────────
// 5 zone identiche all'app (fonte di verità: dfa_zones.dart).
// Z1=blu Recupero (α1 > 1.0) · Z2=verde Aerobica (0.75-1.0) · Z3=giallo
// Transizione (0.50-0.75) · Z4=arancio Anaerobica (0.30-0.50) · Z5=rosso
// Massimale (< 0.30). Gli `id` coincidono con il numero di zona dell'app.
// Il nome della zona si legge da `sport.dfaZones.<key>` con `dfaZoneLabel`.

export type DfaZoneKey = 'recovery' | 'aerobic' | 'transition' | 'anaerobic' | 'maximal'

export interface DfaZone {
  id: number
  key: DfaZoneKey
  short: string
  color: string
  bg: string
  // intervallo alpha1 [min, max) usato per le bande di sfondo del grafico
  // (max = Infinity per la zona Recupero, senza limite superiore)
  min: number
  max: number
}

export const DFA_ZONES: DfaZone[] = [
  { id: 1, key: 'recovery', short: 'Z1', color: '#4F86C6', bg: '#E4EDF7', min: 1.0, max: Infinity },
  { id: 2, key: 'aerobic', short: 'Z2', color: '#2F8F6B', bg: '#DCEFE6', min: 0.75, max: 1.0 },
  { id: 3, key: 'transition', short: 'Z3', color: '#D6B23A', bg: '#F8EFD3', min: 0.5, max: 0.75 },
  { id: 4, key: 'anaerobic', short: 'Z4', color: '#E67E22', bg: '#FBE7D5', min: 0.3, max: 0.5 },
  { id: 5, key: 'maximal', short: 'Z5', color: '#C44E4E', bg: '#F6E0E0', min: 0.0, max: 0.3 },
]

/** Nome della zona nella lingua della pagina (`t` sul namespace `sport`). */
export function dfaZoneLabel(zone: Pick<DfaZone, 'key'>, t: Tr): string {
  return t(`dfaZones.${zone.key}`)
}

export function zoneById(id: number | null | undefined): DfaZone | null {
  if (id == null) return null
  return DFA_ZONES.find((z) => z.id === id) ?? null
}

// Deriva la zona dal valore alpha1 (stesse soglie dell'app). Le 5 zone coprono
// l'intero dominio [0, +∞), quindi qualsiasi alpha1 finito ricade in una zona.
export function zoneForAlpha1(alpha1: number | null | undefined): DfaZone | null {
  if (alpha1 == null || !Number.isFinite(alpha1)) return null
  for (const z of DFA_ZONES) {
    if (alpha1 >= z.min && alpha1 < z.max) return z
  }
  return null
}

// ── Livello competitivo ──────────────────────────────────────────────────────

const COMPETITIVE_LEVELS: readonly CompetitiveLevel[] = ['amateur', 'semi_pro', 'professional', 'elite']

/** Etichetta del livello competitivo (`sport.competitiveLevel.*`); valori sconosciuti passano invariati. */
export function competitiveLevelLabel(level: string | null | undefined, t: Tr): string | null {
  if (!level) return null
  return (COMPETITIVE_LEVELS as readonly string[]).includes(level) ? t(`competitiveLevel.${level}`) : level
}

// ── Mappa dolore (13 zone, ID da pain_map.dart) ──────────────────────────────

const SORENESS_ZONE_IDS = new Set([
  'collo', 'spalla_dx', 'spalla_sx', 'petto', 'addome', 'quadricipite_dx', 'quadricipite_sx',
  'trapezio', 'dorsale', 'lombare', 'gluteo', 'hamstring_dx', 'hamstring_sx',
])

/** Nome della zona del dolore (`sport.soreness.<id>`); ID sconosciuti si mostrano come arrivano. */
export function sorenessZoneLabel(id: string, t: Tr): string {
  return SORENESS_ZONE_IDS.has(id) ? t(`soreness.${id}`) : id.replace(/_/g, ' ')
}

// ── Energia (1-5) → emoji ────────────────────────────────────────────────────

export function energyEmoji(energy: number | null | undefined): string {
  if (energy == null) return '—'
  const map: Record<number, string> = { 1: '😴', 2: '🥱', 3: '😐', 4: '🙂', 5: '⚡' }
  return map[Math.round(energy)] ?? '😐'
}

const ENERGY_KEY: Record<number, string> = {
  1: 'drained',
  2: 'tired',
  3: 'average',
  4: 'energetic',
  5: 'full',
}

/** Etichetta del livello di energia 1-5 (`sport.energyLevel.*`); null fuori scala. */
export function energyLabel(energy: number, t: Tr): string | null {
  const key = ENERGY_KEY[Math.round(energy)]
  return key ? t(`energyLevel.${key}`) : null
}

// Colore RPE Borg CR10 (1-10): verde → rosso
export function rpeColor(rpe: number): string {
  if (rpe <= 3) return '#10B981'
  if (rpe <= 5) return '#F59E0B'
  if (rpe <= 7) return '#F97316'
  return '#EF4444'
}
