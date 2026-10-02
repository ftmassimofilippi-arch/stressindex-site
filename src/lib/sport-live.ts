// Helper e tipi del Team Live (monitoraggio real-time multi-atleta).
// File "client-safe": nessun import server. Le etichette visibili si leggono
// dal namespace `sport` in visualizzazione (`connLabel`, `dfaZoneLabel`).
import type { Tr } from '@/i18n/types'
import { intlTag } from './format'
import { DFA_ZONES, type DfaZoneKey } from './sport-format'

// ── Riga della tabella sport_live_data (snake_case, come arriva da Supabase) ──

// ⚠️ I NOMI SONO QUELLI DELLA TABELLA, NON NOMI NOSTRI. Questa interfaccia
// descriveva colonne che non esistono (`hr`, `zone`, `rmssd`, `trimp`, `tags`,
// `created_at`): il `select` si fermava alla prima e la pagina Team Live
// rispondeva sempre con l'elenco vuoto, loggando solo
// «column sport_live_data.hr does not exist». Le righe arrivano anche via
// Realtime, che consegna la riga grezza del database: rinominarle in un alias
// del `select` avrebbe sistemato una via e lasciato rotta l'altra. La
// definizione autoritativa è `supabase/migrations/sport_live_data.sql` nel repo
// dell'app, che è anche l'unico scrittore (`SportLiveService`).
export interface SportLiveRow {
  id: string
  professional_id: string
  athlete_id: string
  athlete_name: string | null
  session_id: string | null
  sport: string | null
  is_connected: boolean | null
  timestamp_ms: number | null
  elapsed_s: number | null
  hr_current: number | null
  hr_max: number | null
  dfa_zone: number | null
  dfa_alpha1: number | null
  rmssd_rolling: number | null
  trimp_current: number | null
  artifact_rate: number | null
  updated_at: string
}

// Anagrafica atleta (per arricchire le righe live coi dati del cliente).
export interface AthleteMeta {
  name: string
  hr_max: number | null
}

// Colonne selezionate sia lato server sia lato browser (poll fallback/reconcile).
export const SPORT_LIVE_COLUMNS =
  'id, professional_id, athlete_id, athlete_name, session_id, sport, is_connected, ' +
  'timestamp_ms, elapsed_s, hr_current, hr_max, dfa_zone, dfa_alpha1, rmssd_rolling, ' +
  'trimp_current, artifact_rate, updated_at'

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

/** Etichetta dello stato di connessione (`sport.teamLive.conn.*`). */
export function connLabel(status: ConnStatus, t: Tr): string {
  return t(`teamLive.conn.${status}`)
}

// Atleta "in sessione": connesso e aggiornato negli ultimi 30 secondi.
export function isInSession(row: SportLiveRow, nowMs: number): boolean {
  return row.is_connected === true && rowAgeMs(row, nowMs) <= IN_SESSION_MAX_MS
}

// Card visibile: connesso oppure aggiornato negli ultimi 5 minuti.
export function isVisible(row: SportLiveRow, nowMs: number): boolean {
  return row.is_connected === true || rowAgeMs(row, nowMs) <= VISIBLE_MAX_MS
}

// ── Zone DFA (chiavi + colori vividi riusati da DFA_ZONES) ───────────────────
// 5 zone allineate all'app: 1=blu Recupero · 2=verde Aerobica · 3=giallo
// Transizione · 4=arancio Anaerobica · 5=rosso Massimale.

export interface LiveZone {
  id: number
  key: DfaZoneKey
  color: string
  bg: string
}

export function liveZone(id: number | null | undefined): LiveZone | null {
  if (id == null) return null
  const z = DFA_ZONES.find((zone) => zone.id === id)
  if (!z) return null
  return { id: z.id, key: z.key, color: z.color, bg: z.bg }
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

// Orario dell'ultimo aggiornamento ricevuto, nel formato della lingua
// (ora locale del browser: è un "adesso", non un timestamp di misurazione).
export function formatUpdatedClock(iso: string, locale?: string, withSeconds = false): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return new Intl.DateTimeFormat(intlTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  }).format(d)
}

// Artifact rate → percentuale (gestisce sia frazione 0..1 sia valore già in %).
export function artifactPct(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate)) return null
  return rate <= 1 ? rate * 100 : rate
}

// Parsing difensivo dei tag (array di stringhe o di oggetti {label}).
// Nome completo dell'atleta a partire da una riga + mappa anagrafica;
// `fallback` è il testo tradotto da mostrare se non lo sappiamo.
//
// L'anagrafica vince, perché è il dato aggiornato; poi `athlete_name`, che la
// riga porta con sé e che prima veniva ignorato. Serve per l'atleta che arriva
// via Realtime e non è (ancora) fra i clients letti all'apertura: con il solo
// fallback la card mostrava un trattino al posto di una persona.
export function athleteName(row: SportLiveRow, meta: Record<string, AthleteMeta>, fallback: string): string {
  const dallAnagrafica = meta[row.athlete_id]?.name?.trim()
  if (dallAnagrafica) return dallAnagrafica
  const dallaRiga = row.athlete_name?.trim()
  if (dallaRiga) return dallaRiga
  return fallback
}

// HR max anagrafico dell'atleta (per le zone HR); fallback all'hr_max sessione.
export function athleteHrMax(row: SportLiveRow, meta: Record<string, AthleteMeta>): number | null {
  return meta[row.athlete_id]?.hr_max ?? row.hr_max ?? null
}
