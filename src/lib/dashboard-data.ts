import { createClient } from './supabase-server'
import type {
  Alert,
  Client,
  ClientNote,
  ClientSettings,
  MeasurementAnalytics,
  MeasurementWithSession,
  Message,
  NotificationPreferences,
  ProfessionalProfile,
} from './types'

// Wrapper di accesso dati lato server con sessione utente Supabase.
// Tutte le query sono filtrate via RLS dal claim auth.uid().
// Score proprietari e parametri HRV sono letti da `measurement_analytics`
// (vedi schema reale: legacy app Flutter).

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfessionalProfile(): Promise<ProfessionalProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('professional_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  return data
}

export async function listClients(): Promise<Client[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .order('cognome', { ascending: true })
  return data ?? []
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data
}

// ============================================================================
// MEASUREMENT ANALYTICS — fonte autoritativa per score / HRV calcolati
// ============================================================================

export async function listMeasurementsForClient(clientId: string, opts?: { limit?: number; from?: string; to?: string }): Promise<MeasurementAnalytics[]> {
  const supabase = await createClient()
  let q = supabase
    .from('measurement_analytics')
    .select('*')
    .eq('client_id', clientId)
    .order('measured_at', { ascending: false })
  if (opts?.from) q = q.gte('measured_at', opts.from)
  if (opts?.to) q = q.lte('measured_at', opts.to)
  if (opts?.limit) q = q.limit(opts.limit)
  const { data } = await q
  return (data ?? []) as MeasurementAnalytics[]
}

// Carica la singola misurazione e fa join con la session raw per recuperare
// notes_professionista e indicazioni (colonne testuali presenti solo in sessions).
export async function getMeasurementBySessionId(sessionId: string): Promise<MeasurementWithSession | null> {
  const supabase = await createClient()
  const { data: ma } = await supabase
    .from('measurement_analytics')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!ma) return null
  const { data: s } = await supabase
    .from('sessions')
    .select('notes_professionista, indicazioni')
    .eq('id', sessionId)
    .maybeSingle()
  return {
    ...(ma as MeasurementAnalytics),
    notes_professionista: (s?.notes_professionista as string | null) ?? null,
    indicazioni: (s?.indicazioni as string | null) ?? null,
  }
}

export async function todaysMeasurements(): Promise<MeasurementAnalytics[]> {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('measurement_analytics')
    .select('*')
    .gte('measured_at', today.toISOString())
    .order('measured_at', { ascending: false })
  return (data ?? []) as MeasurementAnalytics[]
}

// ============================================================================
// ALERTS / NOTES / SETTINGS / MESSAGES / PREFERENCES
// ============================================================================

export async function listAlerts(opts?: { status?: Alert['status'][]; limit?: number; clientId?: string }): Promise<Alert[]> {
  const supabase = await createClient()
  let q = supabase
    .from('alerts')
    .select('*')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
  if (opts?.status?.length) q = q.in('status', opts.status)
  if (opts?.clientId) q = q.eq('client_id', opts.clientId)
  if (opts?.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}

export async function listRecentNotes(limit = 3): Promise<ClientNote[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_notes')
    .select('*')
    .order('data_creazione', { ascending: false })
    .limit(limit)
  return (data ?? []) as ClientNote[]
}

export async function listNotesForClient(clientId: string): Promise<ClientNote[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('data_creazione', { ascending: false })
  return (data ?? []) as ClientNote[]
}

export async function getClientSettings(clientId: string): Promise<ClientSettings | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_settings')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  return data
}

export async function listMessagesForClient(clientId: string): Promise<Message[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('client_id', clientId)
    .order('sent_at', { ascending: false })
  return data ?? []
}

export async function getNotificationPreferences(): Promise<NotificationPreferences | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  return data
}

// ============================================================================
// VISTE AGGREGATE PER LA DASHBOARD
// ============================================================================

export type ClientWithLastMeasurement = Client & {
  lastMeasurement?: MeasurementAnalytics | null
  activeAlerts?: number
  settings?: ClientSettings | null
}

export async function listClientsEnriched(): Promise<ClientWithLastMeasurement[]> {
  const supabase = await createClient()
  const [clientsRes, measurementsRes, alertsRes, settingsRes] = await Promise.all([
    supabase.from('clients').select('*').order('cognome', { ascending: true }),
    supabase.from('measurement_analytics').select('*').order('measured_at', { ascending: false }),
    supabase.from('alerts').select('client_id,status').in('status', ['new', 'seen']),
    supabase.from('client_settings').select('*'),
  ])
  const clients = (clientsRes.data ?? []) as Client[]
  const measurements = (measurementsRes.data ?? []) as MeasurementAnalytics[]
  const alerts = alertsRes.data ?? []
  const settings = (settingsRes.data ?? []) as ClientSettings[]

  const lastByClient = new Map<string, MeasurementAnalytics>()
  for (const m of measurements) {
    if (!lastByClient.has(m.client_id)) lastByClient.set(m.client_id, m)
  }
  const alertCountBy = new Map<string, number>()
  for (const a of alerts) alertCountBy.set(a.client_id, (alertCountBy.get(a.client_id) ?? 0) + 1)
  const settingsBy = new Map<string, ClientSettings>()
  for (const cs of settings) settingsBy.set(cs.client_id, cs)

  return clients.map((c) => ({
    ...c,
    lastMeasurement: lastByClient.get(c.id) ?? null,
    activeAlerts: alertCountBy.get(c.id) ?? 0,
    settings: settingsBy.get(c.id) ?? null,
  }))
}

// Tutte le colonne aggregabili per il trend chart professionale.
// Lista esaustiva — l'AdvancedTrendChart sceglie quali metriche mostrare.
const TREND_COLUMNS = [
  'score_stress', 'score_recupero', 'score_equilibrio', 'score_energia',
  'score_modulazione_infiammatoria', 'score_composito',
  'sdnn', 'rmssd', 'pnn50', 'pnn20', 'mean_hr', 'cv', 'rmssd_sdnn_ratio',
  'vlf_power', 'lf_power', 'hf_power', 'total_power', 'lf_hf_ratio', 'lf_nu', 'hf_nu',
  'vlf_power_ls', 'lf_power_ls', 'hf_power_ls', 'total_power_ls', 'lf_hf_ratio_ls',
  'sd1', 'sd2', 'sd1_sd2_ratio', 'dfa_alpha1', 'dfa_alpha2', 'sample_entropy', 'approximate_entropy',
  'triangular_index', 'tinn', 'stress_index_baevsky',
] as const

export type TrendColumn = typeof TREND_COLUMNS[number]
export type DailyAveragePoint = { date: string } & { [K in TrendColumn]: number | null }

export async function aggregatedDailyAverages(daysBack = 30): Promise<DailyAveragePoint[]> {
  const supabase = await createClient()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)
  from.setHours(0, 0, 0, 0)

  const select = ['measured_at', ...TREND_COLUMNS].join(',')
  const { data } = await supabase
    .from('measurement_analytics')
    .select(select)
    .gte('measured_at', from.toISOString())
    .order('measured_at', { ascending: true })

  type Row = { measured_at: string } & { [K in TrendColumn]: number | null }
  const buckets = new Map<string, Map<TrendColumn, number[]>>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const day = row.measured_at.slice(0, 10)
    let bucket = buckets.get(day)
    if (!bucket) {
      bucket = new Map()
      buckets.set(day, bucket)
    }
    for (const col of TREND_COLUMNS) {
      const v = row[col]
      if (v != null && !Number.isNaN(v)) {
        const arr = bucket.get(col) ?? []
        arr.push(v)
        bucket.set(col, arr)
      }
    }
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

  const out: DailyAveragePoint[] = []
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const day = d.toISOString().slice(0, 10)
    const b = buckets.get(day)
    const point = { date: day } as unknown as Record<string, number | string | null>
    for (const col of TREND_COLUMNS) {
      const arr = b?.get(col)
      point[col] = arr ? avg(arr) : null
    }
    out.push(point as unknown as DailyAveragePoint)
  }
  return out
}

export async function clientsToContact(): Promise<Array<{ client: Client; settings: ClientSettings | null; daysSinceLast: number }>> {
  const supabase = await createClient()
  const [{ data: clients }, { data: settings }] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('client_settings').select('*'),
  ])
  const settingsMap = new Map<string, ClientSettings>()
  for (const s of (settings ?? []) as ClientSettings[]) settingsMap.set(s.client_id, s)

  const now = Date.now()
  const out: Array<{ client: Client; settings: ClientSettings | null; daysSinceLast: number }> = []
  for (const c of (clients ?? []) as Client[]) {
    if (!c.last_measurement_at) continue
    const days = Math.floor((now - new Date(c.last_measurement_at).getTime()) / (1000 * 60 * 60 * 24))
    const cs = settingsMap.get(c.id)
    const expected = cs?.expected_frequency_per_week ?? 0
    if (expected > 0) {
      const tolerance = (7 / expected) * 1.5
      if (days >= tolerance) out.push({ client: c, settings: cs ?? null, daysSinceLast: days })
    } else if (days >= 14) {
      out.push({ client: c, settings: cs ?? null, daysSinceLast: days })
    }
  }
  return out.sort((a, b) => b.daysSinceLast - a.daysSinceLast).slice(0, 10)
}

// Carica TUTTE le misurazioni dello studio (per pagina analytics)
export async function listAllMeasurements(opts?: { from?: string; to?: string }): Promise<MeasurementAnalytics[]> {
  const supabase = await createClient()
  let q = supabase
    .from('measurement_analytics')
    .select('*')
    .order('measured_at', { ascending: true })
  if (opts?.from) q = q.gte('measured_at', opts.from)
  if (opts?.to) q = q.lte('measured_at', opts.to)
  const { data } = await q
  return (data ?? []) as MeasurementAnalytics[]
}
