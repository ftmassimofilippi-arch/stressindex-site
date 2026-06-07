// Helper e tipi del Team Live (monitoraggio real-time multi-atleta).
// File "client-safe": nessun import server (solo `import type` da sport-format).
import { DFA_ZONES } from './sport-format'

// ── Riga della tabella sport_live_data (snake_case, come arriva da Supabase) ──

export interface SportLiveRow {
  id: string
  professional_id: string
  athlete_id: string
  session_id: string | null
  sport: string | null
  is_connected: boolean | null
  elapsed_s: number | null
  hr: number | null
  hr_max: number | null
  zone: number | null
  dfa_alpha1: number | null
  rmssd: number | null
  trimp: number | null
  artifact_rate: number | null
  tags: unknown
  updated_at: string
  created_at?: string | null
}

// Anagrafica atleta (per arricchire le righe live coi dati del cliente).
export interface AthleteMeta {
  name: string
  hr_max: number | null
}

// Colonne selezionate sia lato server sia lato browser (poll fallback/reconcile).
export const SPORT_LIVE_COLUMNS =
  'id, professional_id, athlete_id, session_id, sport, is_connected, elapsed_s, hr, hr_max, zone, dfa_alpha1, rmssd, trimp, artifact_rate, tags, updated_at, created_at'

// ── Soglie temporali (in ms) ─────────────────────────────────────────────────

const SEC = 1000
export const CONNECTED_MAX_MS = 15 * SEC // 🟢 dato fresco
export const STALE_MAX_MS = 60 * SEC // 🟡 dato vecchio
export const IN_SESSION_MAX_MS = 30 * SEC // conteggio "in sessione"
export const VISIBLE_MAX_MS = 5 * 60 * SEC // card visibile entro 5 minuti

export type ConnStatus = 'connected' | 'stale' | 'disconnected'

export function rowAgeMs(row: SportLiveRow, nowMs: number): number {
  const t = Date.parse(row.updated_at)
  return Number.isFinite(t) ? Math.max(0, nowMs - t) : Infinity
}

// 🟢 connesso (≤15s) · 🟡 vecchio (15-60s) · 🔴 disconnesso (>60s o is_connected=false)
export function connStatus(row: SportLiveRow, nowMs: number): ConnStatus {
  if (row.is_connected === false) return 'disconnected'
  const age = rowAgeMs(row, nowMs)
  if (age <= CONNECTED_MAX_MS) return 'connected'
  if (age <= STALE_MAX_MS) return 'stale'
  return 'disconnected'
}

export const CONN_COLOR: Record<ConnStatus, string> = {
  connected: '#10B981',
  stale: '#F59E0B',
  disconnected: '#9CA3AF',
}

export const CONN_LABEL: Record<ConnStatus, string> = {
  connected: 'Connesso',
  stale: 'Dato in ritardo',
  disconnected: 'Disconnesso',
}

// Atleta "in sessione": connesso e aggiornato negli ultimi 30 secondi.
export function isInSession(row: SportLiveRow, nowMs: number): boolean {
  return row.is_connected === true && rowAgeMs(row, nowMs) <= IN_SESSION_MAX_MS
}

// Card visibile: connesso oppure aggiornato negli ultimi 5 minuti.
export function isVisible(row: SportLiveRow, nowMs: number): boolean {
  return row.is_connected === true || rowAgeMs(row, nowMs) <= VISIBLE_MAX_MS
}

// ── Zone DFA (etichette "live" + colori vividi riusati da DFA_ZONES) ─────────
// 1=verde Aerobica · 2=giallo Transizione · 3=arancio Anaerobica · 4=rosso Massimale.

const LIVE_ZONE_LABEL: Record<number, string> = {
  1: 'Aerobica',
  2: 'Transizione',
  3: 'Anaerobica',
  4: 'Massimale',
}

export interface LiveZone {
  id: number
  label: string
  color: string
  bg: string
}

export function liveZone(id: number | null | undefined): LiveZone | null {
  if (id == null) return null
  const z = DFA_ZONES.find((zone) => zone.id === id)
  if (!z) return null
  return { id: z.id, label: LIVE_ZONE_LABEL[z.id] ?? z.label, color: z.color, bg: z.bg }
}

// Bande orizzontali (per valore alpha1) per i grafici live.
export const DFA_BANDS = DFA_ZONES.map((z) => ({
  id: z.id,
  min: z.min,
  max: z.max,
  color: z.color,
  bg: z.bg,
}))

// ── HR → colore zona (se hr_max dell'atleta è noto) ──────────────────────────

export function hrZoneColor(hr: number | null | undefined, hrMax: number | null | undefined): string | null {
  if (hr == null || hrMax == null || hrMax <= 0) return null
  const p = hr / hrMax
  if (p < 0.6) return '#10B981'
  if (p < 0.7) return '#84CC16'
  if (p < 0.8) return '#F59E0B'
  if (p < 0.9) return '#F97316'
  return '#EF4444'
}

// ── Formattazioni ────────────────────────────────────────────────────────────

// Timer sessione: mm:ss (h:mm:ss oltre l'ora).
export function formatElapsed(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '00:00'
  const t = Math.floor(seconds)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Orario (HH:MM) dell'ultimo aggiornamento ricevuto.
export function formatUpdatedClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Artifact rate → percentuale (gestisce sia frazione 0..1 sia valore già in %).
export function artifactPct(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate)) return null
  return rate <= 1 ? rate * 100 : rate
}

// Parsing difensivo dei tag (array di stringhe o di oggetti {label}).
export function parseLiveTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) out.push(item.trim())
    else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const label = (o.label ?? o.name ?? o.tag ?? o.text) as unknown
      if (typeof label === 'string' && label.trim()) out.push(label.trim())
    }
  }
  return out
}

// Nome completo dell'atleta a partire da una riga + mappa anagrafica.
export function athleteName(row: SportLiveRow, meta: Record<string, AthleteMeta>): string {
  return meta[row.athlete_id]?.name ?? 'Atleta'
}

// HR max anagrafico dell'atleta (per le zone HR); fallback all'hr_max sessione.
export function athleteHrMax(row: SportLiveRow, meta: Record<string, AthleteMeta>): number | null {
  return meta[row.athlete_id]?.hr_max ?? row.hr_max ?? null
}
