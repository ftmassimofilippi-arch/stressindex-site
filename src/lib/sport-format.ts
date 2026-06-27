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
// 5 zone identiche all'app (fonte di verità: dfa_zones.dart).
// Z1=blu Recupero (α1 > 1.0) · Z2=verde Aerobica (0.75-1.0) · Z3=giallo
// Transizione (0.50-0.75) · Z4=arancio Anaerobica (0.30-0.50) · Z5=rosso
// Massimale (< 0.30). Gli `id` coincidono con il numero di zona dell'app.

export interface DfaZone {
  id: number
  label: string
  short: string
  color: string
  bg: string
  // intervallo alpha1 [min, max) usato per le bande di sfondo del grafico
  // (max = Infinity per la zona Recupero, senza limite superiore)
  min: number
  max: number
}

export const DFA_ZONES: DfaZone[] = [
  { id: 1, label: 'Recupero', short: 'Z1', color: '#4F86C6', bg: '#E4EDF7', min: 1.0, max: Infinity },
  { id: 2, label: 'Aerobica', short: 'Z2', color: '#2F8F6B', bg: '#DCEFE6', min: 0.75, max: 1.0 },
  { id: 3, label: 'Transizione', short: 'Z3', color: '#D6B23A', bg: '#F8EFD3', min: 0.5, max: 0.75 },
  { id: 4, label: 'Anaerobica', short: 'Z4', color: '#E67E22', bg: '#FBE7D5', min: 0.3, max: 0.5 },
  { id: 5, label: 'Massimale', short: 'Z5', color: '#C44E4E', bg: '#F6E0E0', min: 0.0, max: 0.3 },
]

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
