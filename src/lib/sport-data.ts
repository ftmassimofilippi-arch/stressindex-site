import { cache } from 'react'
import { createClient } from './supabase-server'
import { resolveViewingProfessional, type ViewingProfessional } from './dashboard-data'
import { SPORT_LIVE_COLUMNS, type AthleteMeta, type SportLiveRow } from './sport-live'

// ============================================================================
// MODULO SPORT — data layer
// ----------------------------------------------------------------------------
// Legge le tabelle sport_sessions / dfa_windows / training_load_daily da
// Supabase con il client autenticato. Le RLS esistenti filtrano già le righe
// per professional_id = auth.uid(); il superadmin (migration 011) può leggere
// anche le sessioni degli altri professionisti in sola lettura.
//
// Tutte le query di lista accettano un `professionalId` esplicito: le pagine lo
// risolvono via resolveViewingProfessional() così la stessa logica copre sia il
// professionista che guarda i propri dati sia il superadmin che ne guarda altri.
// ============================================================================

// ── Tipi ────────────────────────────────────────────────────────────────────

export type CompetitiveLevel = 'amateur' | 'semi_pro' | 'professional' | 'elite'

export interface SportTag {
  label: string
  // millisecondi dall'inizio della sessione (per posizionare il marker)
  t_ms: number | null
}

export interface SportQuestionnaire {
  rpe: number | null // Borg CR10, 1-10
  energy: number | null // 1-5
  mood: number | null // VAS 0-100
  soreness: Record<string, number> | null // zona → intensità 0-3
  notes: string | null
}

export interface SportSession {
  id: string
  athlete_id: string
  professional_id: string
  start_time: string
  end_time: string | null
  duration_s: number | null
  sport: string | null
  tags: SportTag[]
  hr_avg: number | null
  hr_max: number | null
  rmssd_avg: number | null
  dfa_alpha1_avg: number | null
  trimp: number | null
  notes: string | null
  questionnaire: SportQuestionnaire | null
  created_at: string | null
}

export interface SportSessionWithAthlete extends SportSession {
  athlete_name: string
}

export interface DfaWindow {
  id: string
  session_id: string
  window_start_ms: number
  alpha1: number | null
  hr_mean: number | null
  rmssd: number | null
  zone: number | null // 1=verde, 2=giallo, 3=arancio, 4=rosso
  artifact_rate: number | null
}

export interface TrainingLoadDaily {
  id: string
  athlete_id: string
  professional_id: string
  date: string
  trimp: number | null
  ctl: number | null
  atl: number | null
  tsb: number | null
  acwr: number | null
}

export interface SportAthleteProfile {
  id: string
  nome: string | null
  cognome: string | null
  sport: string | null
  competitive_level: CompetitiveLevel | null
  current_goal: string | null
  hr_max: number | null
  ftp_estimated: number | null
}

export type TrendDirection = 'up' | 'down' | 'stable'

export interface SportAthleteCard extends SportAthleteProfile {
  full_name: string
  sessions_30d: number
  last_session_at: string | null
  last_session_trimp: number | null
  trimp_7d: number | null
  ln_rmssd_trend: TrendDirection
}

export interface SportSessionFilters {
  athleteId?: string
  sport?: string
  // periodo in giorni; 'all' = nessun filtro temporale
  period?: 7 | 30 | 90 | 'all'
  limit?: number
  offset?: number
}

// ── Accesso / gating Pro ─────────────────────────────────────────────────────

export interface SportAccess {
  userId: string | null
  plan: string | null
  isPro: boolean // plan === 'pro' OPPURE superadmin
  isSuperadmin: boolean
}

// Legge plan + is_superadmin dal profilo dell'utente loggato. Memoizzato per
// richiesta (React cache): più chiamate nello stesso render condividono il
// risultato senza ripetere la query. Error-safe: se la colonna plan non esiste
// ancora, plan resta null e isPro=false (sezione Sport nascosta).
export const getSportAccess = cache(async (): Promise<SportAccess> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, plan: null, isPro: false, isSuperadmin: false }
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, is_superadmin')
    .eq('id', user.id)
    .maybeSingle()
  if (error) return { userId: user.id, plan: null, isPro: false, isSuperadmin: false }
  const row = data as { plan?: string | null; is_superadmin?: boolean } | null
  const plan = row?.plan ?? null
  const isSuperadmin = !!row?.is_superadmin
  return { userId: user.id, plan, isPro: plan === 'pro' || isSuperadmin, isSuperadmin }
})

// Helper booleano: l'utente loggato ha accesso al Modulo Sport?
export async function isProPlan(): Promise<boolean> {
  return (await getSportAccess()).isPro
}

// Risolve il professionista di cui mostrare i dati sport (proprio o, per il
// superadmin, quello indicato da ?professionista=UUID) e l'accesso Pro.
export interface SportViewContext {
  professionalId: string | null
  viewing: ViewingProfessional | null
  access: SportAccess
}

export async function resolveSportContext(professionistaId?: string | null): Promise<SportViewContext> {
  const access = await getSportAccess()
  const { viewing } = await resolveViewingProfessional(professionistaId)
  const professionalId = viewing?.user_id ?? access.userId
  return { professionalId, viewing, access }
}

// ── Parsing difensivo dei campi JSONB ────────────────────────────────────────

function parseTags(raw: unknown): SportTag[] {
  if (!Array.isArray(raw)) return []
  const out: SportTag[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      out.push({ label: item, t_ms: null })
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const label = (o.label ?? o.name ?? o.tag ?? o.text) as string | undefined
      const t = (o.t_ms ?? o.timestamp_ms ?? o.elapsed_ms ?? o.ms ?? o.offset_ms) as unknown
      const t_ms = typeof t === 'number' ? t : t != null && Number.isFinite(Number(t)) ? Number(t) : null
      if (label) out.push({ label: String(label), t_ms })
    }
  }
  return out
}

function parseQuestionnaire(raw: unknown): SportQuestionnaire | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const numOrNull = (v: unknown): number | null => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  let soreness: Record<string, number> | null = null
  if (o.soreness && typeof o.soreness === 'object') {
    soreness = {}
    for (const [k, v] of Object.entries(o.soreness as Record<string, unknown>)) {
      const n = numOrNull(v)
      if (n != null && n > 0) soreness[k] = n
    }
    if (Object.keys(soreness).length === 0) soreness = null
  }
  return {
    rpe: numOrNull(o.rpe),
    energy: numOrNull(o.energy),
    mood: numOrNull(o.mood),
    soreness,
    notes: typeof o.notes === 'string' && o.notes.trim() ? o.notes : null,
  }
}

type SportSessionRow = {
  id: string
  athlete_id: string
  professional_id: string
  start_time: string
  end_time: string | null
  duration_s: number | null
  sport: string | null
  tags: unknown
  hr_avg: number | null
  hr_max: number | null
  rmssd_avg: number | null
  dfa_alpha1_avg: number | null
  trimp: number | null
  notes: string | null
  questionnaire: unknown
  created_at: string | null
}

function mapSession(r: SportSessionRow): SportSession {
  return {
    id: r.id,
    athlete_id: r.athlete_id,
    professional_id: r.professional_id,
    start_time: r.start_time,
    end_time: r.end_time,
    duration_s: r.duration_s,
    sport: r.sport,
    tags: parseTags(r.tags),
    hr_avg: r.hr_avg,
    hr_max: r.hr_max,
    rmssd_avg: r.rmssd_avg,
    dfa_alpha1_avg: r.dfa_alpha1_avg,
    trimp: r.trimp,
    notes: r.notes,
    questionnaire: parseQuestionnaire(r.questionnaire),
    created_at: r.created_at,
  }
}

const SESSION_COLUMNS =
  'id, athlete_id, professional_id, start_time, end_time, duration_s, sport, tags, hr_avg, hr_max, rmssd_avg, dfa_alpha1_avg, trimp, notes, questionnaire, created_at'

function periodFrom(period?: SportSessionFilters['period']): string | null {
  if (!period || period === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - period)
  return d.toISOString()
}

// ── Query principali ─────────────────────────────────────────────────────────

// Mappa athlete_id → nome completo per un set di sessioni.
async function athleteNames(athleteIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (athleteIds.length === 0) return map
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, nome, cognome')
    .in('id', athleteIds)
  for (const c of (data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    map.set(c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Atleta')
  }
  return map
}

export async function listSportSessions(
  professionalId: string | null,
  filters?: SportSessionFilters,
): Promise<SportSessionWithAthlete[]> {
  if (!professionalId) return []
  const supabase = await createClient()
  let q = supabase
    .from('sport_sessions')
    .select(SESSION_COLUMNS)
    .eq('professional_id', professionalId)
    .order('start_time', { ascending: false })
  if (filters?.athleteId) q = q.eq('athlete_id', filters.athleteId)
  if (filters?.sport) q = q.eq('sport', filters.sport)
  const from = periodFrom(filters?.period)
  if (from) q = q.gte('start_time', from)
  if (filters?.limit != null) {
    const offset = filters.offset ?? 0
    q = q.range(offset, offset + filters.limit - 1)
  }
  const { data, error } = await q
  if (error) {
    console.error('[listSportSessions] error', { professionalId, error })
    return []
  }
  const rows = (data ?? []) as SportSessionRow[]
  const names = await athleteNames(Array.from(new Set(rows.map((r) => r.athlete_id))))
  return rows.map((r) => ({ ...mapSession(r), athlete_name: names.get(r.athlete_id) ?? 'Atleta' }))
}

export async function getSportSessionsCount(
  professionalId: string | null,
  period?: SportSessionFilters['period'],
): Promise<number> {
  if (!professionalId) return 0
  const supabase = await createClient()
  let q = supabase
    .from('sport_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', professionalId)
  const from = periodFrom(period)
  if (from) q = q.gte('start_time', from)
  const { count } = await q
  return count ?? 0
}

export async function getSportSession(sessionId: string): Promise<SportSessionWithAthlete | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sport_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .maybeSingle()
  if (!data) return null
  const session = mapSession(data as SportSessionRow)
  const names = await athleteNames([session.athlete_id])
  return { ...session, athlete_name: names.get(session.athlete_id) ?? 'Atleta' }
}

export async function getDfaWindows(sessionId: string): Promise<DfaWindow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dfa_windows')
    .select('id, session_id, window_start_ms, alpha1, hr_mean, rmssd, zone, artifact_rate')
    .eq('session_id', sessionId)
    .order('window_start_ms', { ascending: true })
  if (error) {
    console.error('[getDfaWindows] error', { sessionId, error })
    return []
  }
  return (data ?? []) as DfaWindow[]
}

export async function getSportAthleteProfile(athleteId: string): Promise<SportAthleteProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, nome, cognome, sport, competitive_level, current_goal, hr_max, ftp_estimated')
    .eq('id', athleteId)
    .maybeSingle()
  return (data as SportAthleteProfile) ?? null
}

export async function getTrainingLoad(athleteId: string, days = 90): Promise<TrainingLoadDaily[]> {
  const supabase = await createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromDate = from.toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('training_load_daily')
    .select('id, athlete_id, professional_id, date, trimp, ctl, atl, tsb, acwr')
    .eq('athlete_id', athleteId)
    .gte('date', fromDate)
    .order('date', { ascending: true })
  if (error) {
    console.error('[getTrainingLoad] error', { athleteId, error })
    return []
  }
  return (data ?? []) as TrainingLoadDaily[]
}

// ── Lista atleti con statistiche aggregate ───────────────────────────────────

export async function listSportAthletes(professionalId: string | null): Promise<SportAthleteCard[]> {
  if (!professionalId) return []
  const supabase = await createClient()

  // Tutte le sessioni del professionista (servono per stats per-atleta).
  const { data: sessRows } = await supabase
    .from('sport_sessions')
    .select('athlete_id, start_time, trimp, rmssd_avg')
    .eq('professional_id', professionalId)
    .order('start_time', { ascending: false })
  const sessions = (sessRows ?? []) as Array<{
    athlete_id: string
    start_time: string
    trimp: number | null
    rmssd_avg: number | null
  }>
  const athleteIds = Array.from(new Set(sessions.map((s) => s.athlete_id)))
  if (athleteIds.length === 0) return []

  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, nome, cognome, sport, competitive_level, current_goal, hr_max, ftp_estimated')
    .in('id', athleteIds)
  const clients = new Map<string, SportAthleteProfile>()
  for (const c of (clientRows ?? []) as SportAthleteProfile[]) clients.set(c.id, c)

  const now = Date.now()
  const DAY = 86_400_000
  const byAthlete = new Map<string, typeof sessions>()
  for (const s of sessions) {
    const arr = byAthlete.get(s.athlete_id) ?? []
    arr.push(s)
    byAthlete.set(s.athlete_id, arr)
  }

  const cards: SportAthleteCard[] = []
  for (const id of athleteIds) {
    const profile = clients.get(id)
    if (!profile) continue
    const list = byAthlete.get(id) ?? []
    // list è già ordinata desc per start_time
    const last = list[0] ?? null
    const sessions30d = list.filter((s) => now - new Date(s.start_time).getTime() <= 30 * DAY).length
    const trimp7d = list
      .filter((s) => now - new Date(s.start_time).getTime() <= 7 * DAY)
      .reduce((acc, s) => acc + (s.trimp ?? 0), 0)
    cards.push({
      ...profile,
      full_name: `${profile.nome ?? ''} ${profile.cognome ?? ''}`.trim() || 'Atleta',
      sessions_30d: sessions30d,
      last_session_at: last?.start_time ?? null,
      last_session_trimp: last?.trimp ?? null,
      trimp_7d: trimp7d > 0 ? trimp7d : list.some((s) => now - new Date(s.start_time).getTime() <= 7 * DAY) ? 0 : null,
      ln_rmssd_trend: lnRmssdTrend(list),
    })
  }
  // Ordina per ultima sessione (più recente prima)
  return cards.sort((a, b) => {
    const ta = a.last_session_at ? new Date(a.last_session_at).getTime() : 0
    const tb = b.last_session_at ? new Date(b.last_session_at).getTime() : 0
    return tb - ta
  })
}

// Confronta la media di ln(RMSSD) dell'ultima settimana con quella precedente.
function lnRmssdTrend(sessions: Array<{ start_time: string; rmssd_avg: number | null }>): TrendDirection {
  const now = Date.now()
  const DAY = 86_400_000
  const ln = (v: number | null): number | null => (v != null && v > 0 ? Math.log(v) : null)
  const week: number[] = []
  const prevWeek: number[] = []
  for (const s of sessions) {
    const age = now - new Date(s.start_time).getTime()
    const l = ln(s.rmssd_avg)
    if (l == null) continue
    if (age <= 7 * DAY) week.push(l)
    else if (age <= 14 * DAY) prevWeek.push(l)
  }
  if (week.length === 0 || prevWeek.length === 0) return 'stable'
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const delta = avg(week) - avg(prevWeek)
  // soglia ~0.03 su scala ln(RMSSD): variazioni minori = stabile
  if (delta > 0.03) return 'up'
  if (delta < -0.03) return 'down'
  return 'stable'
}

// ── Team Live — snapshot iniziale ────────────────────────────────────────────

export interface SportLiveSnapshot {
  // righe live (sessioni connesse o aggiornate negli ultimi 5 minuti)
  rows: SportLiveRow[]
  // anagrafica di TUTTI i clients del professionista: id → { nome, hr_max }.
  // Serve ad arricchire le righe che arrivano via Realtime (che non hanno il nome).
  athletes: Record<string, AthleteMeta>
}

// Legge lo stato live corrente per il professionista. Error-safe: se la tabella
// sport_live_data non esiste ancora (migration 012 non applicata) ritorna vuoto
// e la pagina mostra l'empty state.
export async function getSportLiveSnapshot(professionalId: string | null): Promise<SportLiveSnapshot> {
  if (!professionalId) return { rows: [], athletes: {} }
  const supabase = await createClient()

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('sport_live_data')
    .select(SPORT_LIVE_COLUMNS)
    .eq('professional_id', professionalId)
    .or(`is_connected.eq.true,updated_at.gte.${since}`)
    .order('updated_at', { ascending: false })
  if (error) console.error('[getSportLiveSnapshot] error', { professionalId, error: error.message })
  const rows = (error ? [] : (data ?? [])) as SportLiveRow[]

  // Anagrafica clients del professionista (per nome + hr_max anagrafico).
  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, nome, cognome, hr_max')
    .eq('professionista_id', professionalId)
  const athletes: Record<string, AthleteMeta> = {}
  for (const c of (clientRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; hr_max: number | null }>) {
    athletes[c.id] = {
      name: `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Atleta',
      hr_max: c.hr_max ?? null,
    }
  }
  return { rows, athletes }
}

// ── Statistiche per la TAB Dashboard ─────────────────────────────────────────

export interface SportDashboardStats {
  total_sessions: number
  sessions_this_week: number
  avg_trimp_week: number | null
  active_athletes: number
  weekly: Array<{ week: string; label: string; count: number }>
  recent: SportSessionWithAthlete[]
}

export async function getSportDashboardStats(professionalId: string | null): Promise<SportDashboardStats> {
  const empty: SportDashboardStats = {
    total_sessions: 0,
    sessions_this_week: 0,
    avg_trimp_week: null,
    active_athletes: 0,
    weekly: buildEmptyWeeks(12),
    recent: [],
  }
  if (!professionalId) return empty
  const supabase = await createClient()

  // Tutte le sessioni (servono count totale + grafico 12 settimane + atleti attivi).
  const { data: allRows } = await supabase
    .from('sport_sessions')
    .select('id, athlete_id, start_time, trimp')
    .eq('professional_id', professionalId)
  const all = (allRows ?? []) as Array<{ id: string; athlete_id: string; start_time: string; trimp: number | null }>

  const now = Date.now()
  const DAY = 86_400_000
  const weekAgo = now - 7 * DAY
  const monthAgo = now - 30 * DAY

  const thisWeek = all.filter((s) => new Date(s.start_time).getTime() >= weekAgo)
  const weekTrimps = thisWeek.map((s) => s.trimp).filter((t): t is number => t != null)
  const activeAthletes = new Set(
    all.filter((s) => new Date(s.start_time).getTime() >= monthAgo).map((s) => s.athlete_id),
  ).size

  // Grafico ultime 12 settimane (ISO week buckets).
  const weeks = buildEmptyWeeks(12)
  const weekIndex = new Map(weeks.map((w, i) => [w.week, i]))
  for (const s of all) {
    const key = isoWeekKey(new Date(s.start_time))
    const idx = weekIndex.get(key)
    if (idx != null) weeks[idx].count += 1
  }

  const recent = await listSportSessions(professionalId, { limit: 10 })

  return {
    total_sessions: all.length,
    sessions_this_week: thisWeek.length,
    avg_trimp_week: weekTrimps.length ? weekTrimps.reduce((a, b) => a + b, 0) / weekTrimps.length : null,
    active_athletes: activeAthletes,
    weekly: weeks,
    recent,
  }
}

// Chiave ISO settimana (lunedì) in formato YYYY-MM-DD del lunedì.
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (date.getUTCDay() + 6) % 7 // 0 = lunedì
  date.setUTCDate(date.getUTCDate() - day)
  return date.toISOString().slice(0, 10)
}

function buildEmptyWeeks(n: number): Array<{ week: string; label: string; count: number }> {
  const out: Array<{ week: string; label: string; count: number }> = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const key = isoWeekKey(d)
    const monday = new Date(key + 'T00:00:00Z')
    const label = `${String(monday.getUTCDate()).padStart(2, '0')}/${String(monday.getUTCMonth() + 1).padStart(2, '0')}`
    out.push({ week: key, label, count: 0 })
  }
  return out
}
