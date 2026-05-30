// Helper di formattazione e costanti del Modulo Sport (zone DFA, livelli, dolore).
import type { CompetitiveLevel } from './sport-data'

// ── Durata ───────────────────────────────────────────────────────────────────

// Durata in formato compatto: 1h 05m / 42m 10s / 38m
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
// 1=verde (bassa intensità, aerobico), 2=giallo (soglia aerobica),
// 3=arancio (soglia anaerobica), 4=rosso (alta intensità).

export interface DfaZone {
  id: number
  label: string
  short: string
  color: string
  bg: string
  // intervallo alpha1 [min, max) usato per le bande di sfondo del grafico
  min: number
  max: number
}

export const DFA_ZONES: DfaZone[] = [
  { id: 4, label: 'Alta intensità', short: 'Z4', color: '#EF4444', bg: '#FEE2E2', min: 0.0, max: 0.25 },
  { id: 3, label: 'Soglia anaerobica', short: 'Z3', color: '#F97316', bg: '#FFEDD5', min: 0.25, max: 0.5 },
  { id: 2, label: 'Soglia aerobica', short: 'Z2', color: '#F59E0B', bg: '#FEF3C7', min: 0.5, max: 0.75 },
  { id: 1, label: 'Bassa intensità', short: 'Z1', color: '#10B981', bg: '#D1FAE5', min: 0.75, max: 1.5 },
]

export function zoneById(id: number | null | undefined): DfaZone | null {
  if (id == null) return null
  return DFA_ZONES.find((z) => z.id === id) ?? null
}

// Deriva la zona da un valore alpha1 quando il campo `zone` non è valorizzato.
export function zoneForAlpha1(alpha1: number | null | undefined): DfaZone | null {
  if (alpha1 == null || !Number.isFinite(alpha1)) return null
  for (const z of DFA_ZONES) {
    if (alpha1 >= z.min && alpha1 < z.max) return z
  }
  return alpha1 >= 0.75 ? DFA_ZONES[DFA_ZONES.length - 1] : null
}

// ── Livello competitivo ──────────────────────────────────────────────────────

export const COMPETITIVE_LEVEL_LABEL: Record<CompetitiveLevel, string> = {
  amateur: 'Amatoriale',
  semi_pro: 'Semi-professionista',
  professional: 'Professionista',
  elite: 'Elite',
}

export function competitiveLevelLabel(level: string | null | undefined): string | null {
  if (!level) return null
  return COMPETITIVE_LEVEL_LABEL[level as CompetitiveLevel] ?? level
}

// ── Mappa dolore (13 zone, ID da pain_map.dart) ──────────────────────────────

export const SORENESS_ZONE_LABEL: Record<string, string> = {
  collo: 'Collo',
  spalla_dx: 'Spalla dx',
  spalla_sx: 'Spalla sx',
  petto: 'Petto',
  addome: 'Addome',
  quadricipite_dx: 'Quadricipite dx',
  quadricipite_sx: 'Quadricipite sx',
  trapezio: 'Trapezio',
  dorsale: 'Dorsale',
  lombare: 'Lombare',
  gluteo: 'Gluteo',
  hamstring_dx: 'Hamstring dx',
  hamstring_sx: 'Hamstring sx',
}

export function sorenessZoneLabel(id: string): string {
  return SORENESS_ZONE_LABEL[id] ?? id.replace(/_/g, ' ')
}

// ── Energia (1-5) → emoji ────────────────────────────────────────────────────

export function energyEmoji(energy: number | null | undefined): string {
  if (energy == null) return '—'
  const map: Record<number, string> = { 1: '😴', 2: '🥱', 3: '😐', 4: '🙂', 5: '⚡' }
  return map[Math.round(energy)] ?? '😐'
}

export const ENERGY_LABEL: Record<number, string> = {
  1: 'Esausto',
  2: 'Stanco',
  3: 'Nella media',
  4: 'Energico',
  5: 'Pieno di energia',
}

// Colore RPE Borg CR10 (1-10): verde → rosso
export function rpeColor(rpe: number): string {
  if (rpe <= 3) return '#10B981'
  if (rpe <= 5) return '#F59E0B'
  if (rpe <= 7) return '#F97316'
  return '#EF4444'
}
