import { createClient } from './supabase-server'
import type { Alert, Client, ClientNote, ClientSettings, Message, NotificationPreferences, ProfessionalProfile, Session } from './types'

// Wrapper di accesso dati lato server con sessione utente Supabase.
// Tutte le query sono filtrate via RLS dal claim auth.uid().

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
    .order('created_at', { ascending: false })
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

export async function listSessionsForClient(clientId: string, opts?: { limit?: number; from?: string; to?: string }): Promise<Session[]> {
  const supabase = await createClient()
  let q = supabase
    .from('sessions')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (opts?.from) q = q.gte('created_at', opts.from)
  if (opts?.to) q = q.lte('created_at', opts.to)
  if (opts?.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}

export async function getSession(id: string): Promise<Session | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data
}

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

export async function todaysSessions(): Promise<Session[]> {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function listRecentNotes(limit = 3): Promise<ClientNote[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_notes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function listNotesForClient(clientId: string): Promise<ClientNote[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('client_notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data ?? []
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

export type ClientWithLastSession = Client & { lastSession?: Session | null; activeAlerts?: number; settings?: ClientSettings | null }

export async function listClientsEnriched(): Promise<ClientWithLastSession[]> {
  const supabase = await createClient()
  const [clientsRes, sessionsRes, alertsRes, settingsRes] = await Promise.all([
    supabase.from('clients').select('*').order('cognome', { ascending: true }),
    supabase.from('sessions').select('*').order('created_at', { ascending: false }),
    supabase.from('alerts').select('client_id,status').in('status', ['new', 'seen']),
    supabase.from('client_settings').select('*'),
  ])
  const clients = (clientsRes.data ?? []) as Client[]
  const sessions = (sessionsRes.data ?? []) as Session[]
  const alerts = alertsRes.data ?? []
  const settings = (settingsRes.data ?? []) as ClientSettings[]

  const lastByClient = new Map<string, Session>()
  for (const s of sessions) {
    if (!lastByClient.has(s.client_id)) lastByClient.set(s.client_id, s)
  }
  const alertCountBy = new Map<string, number>()
  for (const a of alerts) alertCountBy.set(a.client_id, (alertCountBy.get(a.client_id) ?? 0) + 1)
  const settingsBy = new Map<string, ClientSettings>()
  for (const cs of settings) settingsBy.set(cs.client_id, cs)

  return clients.map((c) => ({
    ...c,
    lastSession: lastByClient.get(c.id) ?? null,
    activeAlerts: alertCountBy.get(c.id) ?? 0,
    settings: settingsBy.get(c.id) ?? null,
  }))
}

export type SessionPoint = {
  date: string
  stress_score: number | null
  recovery_score: number | null
  balance_score: number | null
  energy_score: number | null
}

export async function aggregatedDailyAverages(daysBack = 30): Promise<SessionPoint[]> {
  const supabase = await createClient()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)
  from.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('sessions')
    .select('created_at,stress_score,recovery_score,balance_score,energy_score')
    .gte('created_at', from.toISOString())
    .order('created_at', { ascending: true })

  const buckets = new Map<string, { s: number[]; r: number[]; b: number[]; e: number[] }>()
  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10)
    const bucket = buckets.get(day) ?? { s: [], r: [], b: [], e: [] }
    if (row.stress_score != null) bucket.s.push(row.stress_score)
    if (row.recovery_score != null) bucket.r.push(row.recovery_score)
    if (row.balance_score != null) bucket.b.push(row.balance_score)
    if (row.energy_score != null) bucket.e.push(row.energy_score)
    buckets.set(day, bucket)
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

  // genera serie completa (anche giorni senza dati = null)
  const out: SessionPoint[] = []
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const day = d.toISOString().slice(0, 10)
    const b = buckets.get(day)
    out.push({
      date: day,
      stress_score: b ? avg(b.s) : null,
      recovery_score: b ? avg(b.r) : null,
      balance_score: b ? avg(b.b) : null,
      energy_score: b ? avg(b.e) : null,
    })
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
