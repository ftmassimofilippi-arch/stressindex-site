import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from './supabase-server'
import { selectWithMissingColumnFallback } from './safe-select'
import { measuredDayKey, measuredInstant, toStr } from './format'
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

// Colonne di `sessions` lette per ricostruire una misurazione. Le ultime della
// lista sono opzionali di fatto: arrivano da migration più recenti e possono
// mancare su database non ancora allineati (vedi selectWithMissingColumnFallback).
const SESSION_COLUMNS = [
  'id',
  'client_id',
  'professionista_id',
  'started_at',
  'created_at',
  'duration_seconds',
  'hrv_data',
  'test_type',
  'duration_type',
  'segments',
  'rolling_series',
  'tags',
] as const

// Sessioni remote (auto-misurate dal cliente dal proprio account): hanno
// professionista_id = uid del CLIENTE e client_id null, quindi la RLS su
// `sessions` le nasconde al professionista. La RPC SECURITY DEFINER
// get_linked_client_sessions_by_client_id (stessa usata dall'app Flutter)
// le restituisce solo se esiste un link `active` in client_professional_links.
// Error-safe: se la RPC non è esposta o fallisce, ritorna [] senza rompere
// la scheda cliente (restano visibili le sole misurazioni dirette).
async function fetchRemoteSessionsForClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
): Promise<SessionRow[]> {
  const { data, error } = await supabase.rpc('get_linked_client_sessions_by_client_id', {
    p_client_id: clientId,
  })
  if (error) {
    console.error('[fetchRemoteSessionsForClient] rpc error', { clientId, error })
    return []
  }
  // La RPC ritorna righe `sessions` complete; client_id è null per definizione:
  // lo valorizziamo col clientId richiesto così la UI resta coerente.
  return ((data ?? []) as SessionRow[]).map((s) => ({ ...s, client_id: s.client_id ?? clientId }))
}

export async function listMeasurementsForClient(clientId: string, opts?: { limit?: number; from?: string; to?: string }): Promise<MeasurementAnalytics[]> {
  const supabase = await createClient()

  // 1. Source of truth: sessions (sempre popolato dall'app Flutter via sync_service).
  //    measurement_analytics è scritta in fire-and-forget e può mancare di righe.
  //    Due sorgenti in parallelo (stesso pattern dell'app):
  //    - dirette: client_id = clientId (misurazioni "in studio", via RLS)
  //    - remote:  RPC get_linked_client_sessions_by_client_id (client_id null)
  // Colonne richieste una per una (non select('*')) per non trasferire i BLOB
  // inutili. Lettura resiliente: se una colonna non esiste ancora nel database
  // viene esclusa e la query riprova, invece di restituire ZERO misurazioni per
  // tutti i clienti (è successo con sessions.orthostatic_data).
  const [{ data: direct, error: sessErr }, remote] = await Promise.all([
    selectWithMissingColumnFallback<SessionRow>(
      SESSION_COLUMNS,
      (cols) =>
        supabase
          .from('sessions')
          .select(cols)
          .eq('client_id', clientId)
          .order('started_at_utc', { ascending: false, nullsFirst: false }) as unknown as PromiseLike<{
          data: SessionRow[] | null
          error: PostgrestError | null
        }>,
      { label: 'sessions (scheda cliente)', required: ['id'] },
    ),
    fetchRemoteSessionsForClient(supabase, clientId),
  ])
  if (sessErr) {
    console.error('[listMeasurementsForClient] sessions query error', { clientId, error: sessErr })
  }

  // Merge + dedup per id (le dirette vincono), poi filtri from/to/limit sul
  // set unito — i filtri vanno applicati DOPO il merge perché la RPC non li supporta.
  const byId = new Map<string, SessionRow>()
  for (const s of (direct ?? []) as SessionRow[]) byId.set(s.id, s)
  for (const s of remote) if (!byId.has(s.id)) byId.set(s.id, s)

  // Istante normalizzato: `started_at` grezzo e `created_at` (scritto dal
  // server, gia' corretto) seguono convenzioni diverse e non sono
  // confrontabili direttamente.
  const ts = (s: SessionRow) => measuredInstant(s)?.getTime() ?? new Date(s.created_at ?? 0).getTime()
  let sessions = Array.from(byId.values()).sort((a, b) => ts(b) - ts(a))
  if (opts?.from) {
    const from = new Date(opts.from).getTime()
    sessions = sessions.filter((s) => ts(s) >= from)
  }
  if (opts?.to) {
    const to = new Date(opts.to).getTime()
    sessions = sessions.filter((s) => ts(s) <= to)
  }
  if (opts?.limit) sessions = sessions.slice(0, opts.limit)

  console.log('[listMeasurementsForClient] sessions found', { clientId, direct: direct?.length ?? 0, remote: remote.length, merged: sessions.length })
  if (sessions.length === 0) return []

  // 2. Enrichment: measurement_analytics (score proprietari calcolati dal trigger SQL).
  const sessionIds = sessions.map((s) => s.id as string)
  const { data: maRows, error: maErr } = await supabase
    .from('measurement_analytics')
    .select('*')
    .in('session_id', sessionIds)
  if (maErr) {
    console.error('[listMeasurementsForClient] measurement_analytics query error', { clientId, error: maErr })
  }
  const maBySession = new Map<string, MeasurementAnalytics>()
  for (const row of (maRows ?? []) as MeasurementAnalytics[]) {
    if (row.session_id) maBySession.set(row.session_id, row)
  }
  console.log('[listMeasurementsForClient] measurement_analytics rows', { clientId, total: maRows?.length ?? 0, missing: sessionIds.length - (maRows?.length ?? 0) })

  // 3. Merge: preferisci la riga measurement_analytics (con score); altrimenti
  //    sintetizza da sessions.hrv_data così la misurazione appare comunque.
  return sessions.map((s) => maBySession.get(s.id as string) ?? sessionToMeasurementAnalytics(s))
}

// Costruisce una MeasurementAnalytics minimale a partire da una riga `sessions`.
// Usato come fallback quando measurement_analytics non contiene la riga per quel
// session_id (es. fire-and-forget Flutter fallito, sync queue non drenata).
// I campi score_* restano null: la dashboard mostra "—" per le metriche calcolate.
type SessionRow = {
  id: string
  client_id: string
  professionista_id: string
  started_at: string | null
  created_at: string | null
  duration_seconds: number | null
  hrv_data: Record<string, unknown> | null
  test_type: string | null
  duration_type?: string | null
  segments?: MeasurementAnalytics['segments']
  rolling_series?: MeasurementAnalytics['rolling_series']
  orthostatic_data?: MeasurementAnalytics['orthostatic_data']
  coherence_data?: MeasurementAnalytics['coherence_data']
  tags: string[] | null
}

function sessionToMeasurementAnalytics(s: SessionRow): MeasurementAnalytics {
  const h = (s.hrv_data ?? {}) as Record<string, unknown>
  const num = (k: string): number | null => {
    const v = h[k]
    if (v === null || v === undefined) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const meanBpm = num('meanBpm')
  return {
    id: s.id,
    session_id: s.id,
    user_id: s.professionista_id,
    client_id: s.client_id,
    measured_at: (s.started_at ?? s.created_at ?? new Date().toISOString()) as string,
    duration_seconds: s.duration_seconds ?? 0,
    sensor_type: null,
    sensor_name: null,
    age: null,
    sex: null,
    is_smoker: null,
    is_athlete: null,
    activity_level: null,
    rr_intervals: null,
    rr_count: num('sampleCount'),
    artifact_percentage: null,
    mean_rr: meanBpm && meanBpm > 0 ? 60000 / meanBpm : null,
    sdnn: num('sdnn'),
    rmssd: num('rmssd'),
    pnn50: num('pnn50'),
    pnn20: num('pnn20'),
    mean_hr: meanBpm,
    sdnn_index: null,
    cv: num('cv'),
    rmssd_sdnn_ratio: num('rmssdSdnnRatio'),
    vlf_power: num('vlfPower'),
    lf_power: num('lfPower'),
    hf_power: num('hfPower'),
    total_power: num('totalPower'),
    lf_hf_ratio: num('lfHfRatio'),
    lf_nu: num('lfNorm'),
    hf_nu: num('hfNorm'),
    lf_nu_ls: num('lfNormLs'),
    hf_nu_ls: num('hfNormLs'),
    ectopic_count: num('ectopicCount'),
    // signal_quality è un'etichetta testuale ('good'|'fair'|'poor'), non un numero.
    signal_quality: toStr(h['signalQuality']),
    lf_vlf_ratio: null,
    vlf_power_ls: num('vlfPowerLs'),
    lf_power_ls: num('lfPowerLs'),
    hf_power_ls: num('hfPowerLs'),
    total_power_ls: num('totalPowerLs'),
    lf_hf_ratio_ls: num('lfHfRatioLs'),
    sd1: num('sd1'),
    sd2: num('sd2'),
    sd1_sd2_ratio: num('sd1Sd2Ratio'),
    dfa_alpha1: num('dfaAlpha1'),
    dfa_alpha2: num('dfaAlpha2'),
    sample_entropy: num('sampEn'),
    approximate_entropy: num('apEn'),
    triangular_index: num('hrvTriangularIndex'),
    tinn: num('tinn'),
    stress_index_baevsky: num('stressIndex'),
    score_stress: null,
    score_recupero: null,
    score_equilibrio: null,
    score_energia: null,
    score_modulazione_infiammatoria: null,
    score_composito: null,
    algorithm_version: null,
    score_weights: null,
    tags: s.tags ?? null,
    created_at: (s.created_at ?? s.started_at ?? new Date().toISOString()) as string,
    test_type: s.test_type,
    duration_type: s.duration_type ?? null,
    live_tags: null,
    tag_comparison: null,
    orthostatic_data: s.orthostatic_data ?? null,
    coherence_data: s.coherence_data ?? null,
    segments: s.segments ?? null,
    rolling_series: s.rolling_series ?? null,
  }
}

// Carica la singola misurazione. Preferisce measurement_analytics (con score),
// altrimenti sintetizza da sessions.hrv_data come fallback. In entrambi i casi
// fa join con sessions per notes_professionista / indicazioni.
export async function getMeasurementBySessionId(sessionId: string, clientId?: string): Promise<MeasurementWithSession | null> {
  const supabase = await createClient()
  const { data: ma } = await supabase
    .from('measurement_analytics')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  let { data: s } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  // Fallback sessioni remote: la RLS nasconde al professionista le sessioni
  // auto-misurate dal cliente (client_id null). Se la lettura diretta non trova
  // nulla e conosciamo il cliente, recuperiamo la riga via RPC SECURITY DEFINER.
  if (!ma && !s && clientId) {
    const remote = await fetchRemoteSessionsForClient(supabase, clientId)
    s = remote.find((r) => r.id === sessionId) ?? null
  }
  if (!ma && !s) return null
  const base = ma
    ? (ma as MeasurementAnalytics)
    : sessionToMeasurementAnalytics(s as SessionRow)
  return {
    ...base,
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
    .gte('measured_at_utc', today.toISOString())
    .order('measured_at_utc', { ascending: false })
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

// Mappa client_id → ultima sessione remota (auto-misurata dal cliente).
// Fonte: RPC get_linked_clients_last_remote_session (migration 016) — un solo
// round-trip per tutti i clienti collegati del pro loggato, niente N+1.
// Error-safe: se la migration non è ancora applicata la RPC non esiste (42883)
// e si ritorna una mappa vuota senza rompere lista clienti / dashboard.
async function getLastRemoteSessionMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data, error } = await supabase.rpc('get_linked_clients_last_remote_session')
  if (error) {
    console.error('[getLastRemoteSessionMap] rpc error', error)
    return map
  }
  for (const r of (data ?? []) as Array<{ client_id: string; last_remote_at: string | null }>) {
    if (r.client_id && r.last_remote_at) map.set(r.client_id, r.last_remote_at)
  }
  return map
}

// Ultima misurazione remota CON gli score (measurement_analytics della sessione
// remota), per cliente collegato: RPC get_linked_clients_last_remote_analytics
// (migration 019). Senza questa la colonna "Stress" della lista clienti
// restava "—" per i clienti che misurano solo dall'app, perché la RLS su
// measurement_analytics nasconde le righe con user_id = uid del cliente.
async function getLastRemoteAnalyticsMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, MeasurementAnalytics>> {
  const map = new Map<string, MeasurementAnalytics>()
  const { data, error } = await supabase.rpc('get_linked_clients_last_remote_analytics')
  if (error) {
    // RPC assente finché la 019 non è applicata: la lista resta quella di prima.
    if (error.code !== 'PGRST202' && error.code !== '42883') console.error('[getLastRemoteAnalyticsMap] rpc error', error)
    return map
  }
  for (const r of (data ?? []) as Array<{ client_id: string; analytics: MeasurementAnalytics | null }>) {
    if (r.client_id && r.analytics) map.set(r.client_id, { ...r.analytics, client_id: r.analytics.client_id ?? r.client_id })
  }
  return map
}

// Ultima misurazione "effettiva": max tra la colonna clients.last_measurement_at
// (aggiornata solo dalle misurazioni in studio) e l'ultima sessione remota.
function effectiveLastMeasurementAt(direct: string | null | undefined, remote: string | undefined): string | null {
  // `direct` viene da clients.last_measurement_at, che il trigger
  // update_client_last_measurement scrive da sessions.created_at: timestamp del
  // SERVER, gia' corretto. `remote` e' un istante normalizzato da chi lo calcola.
  // Prima della normalizzazione le due grandezze seguivano convenzioni diverse e
  // il massimo sbagliava di ~2h su 355 clienti su 388.
  if (!remote) return direct ?? null
  if (!direct) return remote
  return new Date(remote).getTime() > new Date(direct).getTime() ? remote : direct
}

export async function listClientsEnriched(opts?: { professionistaId?: string }): Promise<ClientWithLastMeasurement[]> {
  const supabase = await createClient()
  const clientsQ = opts?.professionistaId
    ? supabase.from('clients').select('*').eq('professionista_id', opts.professionistaId).order('cognome', { ascending: true })
    : supabase.from('clients').select('*').order('cognome', { ascending: true })
  const measurementsQ = opts?.professionistaId
    ? supabase.from('measurement_analytics').select('*').eq('user_id', opts.professionistaId).order('measured_at_utc', { ascending: false })
    : supabase.from('measurement_analytics').select('*').order('measured_at_utc', { ascending: false })
  // Sessioni remote: solo per la vista "propria" (senza professionistaId).
  // Nella vista superadmin/org la RPC gira come utente loggato e restituirebbe
  // i SUOI clienti collegati, non quelli del professionista visualizzato.
  const remoteMapQ = opts?.professionistaId
    ? Promise.resolve(new Map<string, string>())
    : getLastRemoteSessionMap(supabase)
  const remoteAnalyticsQ = opts?.professionistaId
    ? Promise.resolve(new Map<string, MeasurementAnalytics>())
    : getLastRemoteAnalyticsMap(supabase)
  const [clientsRes, measurementsRes, alertsRes, settingsRes, remoteMap, remoteAnalytics] = await Promise.all([
    clientsQ,
    measurementsQ,
    supabase.from('alerts').select('client_id,status').in('status', ['new', 'seen']),
    supabase.from('client_settings').select('*'),
    remoteMapQ,
    remoteAnalyticsQ,
  ])
  const clients = (clientsRes.data ?? []) as Client[]
  const measurements = (measurementsRes.data ?? []) as MeasurementAnalytics[]
  const alerts = alertsRes.data ?? []
  const settings = (settingsRes.data ?? []) as ClientSettings[]

  const lastByClient = new Map<string, MeasurementAnalytics>()
  for (const m of measurements) {
    if (!lastByClient.has(m.client_id)) lastByClient.set(m.client_id, m)
  }
  // La misurazione remota vince se è più recente di quella in studio.
  const measuredMs = (m: MeasurementAnalytics) => new Date(measuredInstant(m) ?? m.measured_at ?? 0).getTime() || 0
  for (const [clientId, remote] of remoteAnalytics) {
    const studio = lastByClient.get(clientId)
    if (!studio || measuredMs(remote) > measuredMs(studio)) lastByClient.set(clientId, remote)
  }
  const alertCountBy = new Map<string, number>()
  for (const a of alerts) alertCountBy.set(a.client_id, (alertCountBy.get(a.client_id) ?? 0) + 1)
  const settingsBy = new Map<string, ClientSettings>()
  for (const cs of settings) settingsBy.set(cs.client_id, cs)

  return clients.map((c) => ({
    ...c,
    // "Ultima misurazione" considera anche le sessioni remote del cliente,
    // che non aggiornano clients.last_measurement_at.
    last_measurement_at: effectiveLastMeasurementAt(c.last_measurement_at, remoteMap.get(c.id)),
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

  type Row = { measured_at: string } & { [K in TrendColumn]: number | null }

  // Resiliente alle colonne mancanti: già successo con lf_nu_ls/hf_nu_ls, che
  // facevano fallire tutto il grafico di andamento invece di una sola metrica.
  const { data } = await selectWithMissingColumnFallback<Row>(
    ['measured_at', ...TREND_COLUMNS],
    (cols) =>
      supabase
        .from('measurement_analytics')
        .select(cols)
        .gte('measured_at_utc', from.toISOString())
        .order('measured_at_utc', { ascending: true }) as unknown as PromiseLike<{
        data: Row[] | null
        error: PostgrestError | null
      }>,
    { label: 'measurement_analytics (trend)', required: ['measured_at'] },
  )
  const buckets = new Map<string, Map<TrendColumn, number[]>>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const day = measuredDayKey(row) ?? ''
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
  const [{ data: clients }, { data: settings }, remoteMap] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('client_settings').select('*'),
    getLastRemoteSessionMap(supabase),
  ])
  const settingsMap = new Map<string, ClientSettings>()
  for (const s of (settings ?? []) as ClientSettings[]) settingsMap.set(s.client_id, s)

  const now = Date.now()
  const out: Array<{ client: Client; settings: ClientSettings | null; daysSinceLast: number }> = []
  for (const c of (clients ?? []) as Client[]) {
    // Considera anche le sessioni remote: un cliente che si auto-misura ogni
    // giorno non deve finire tra i "da contattare" solo perché
    // clients.last_measurement_at non viene aggiornata dalle remote.
    const lastAt = effectiveLastMeasurementAt(c.last_measurement_at, remoteMap.get(c.id))
    if (!lastAt) continue
    const days = Math.floor((now - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24))
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

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export interface Organization {
  id: string
  name: string
  owner_id: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string | null
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active' | 'revoked'
  invited_at: string
  accepted_at: string | null
  invited_by: string
}

export interface OrganizationContext {
  organization: Organization | null
  members: OrganizationMember[]
  role: OrganizationMember['role'] | null
}

export async function getOrganizationContext(): Promise<OrganizationContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { organization: null, members: [], role: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.organization_id) return { organization: null, members: [], role: null }

  const [{ data: organization }, { data: members }] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', profile.organization_id).maybeSingle(),
    supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('invited_at', { ascending: true }),
  ])
  const myMember = (members ?? []).find((m) => m.user_id === user.id) ?? null
  return {
    organization: (organization as Organization) ?? null,
    members: (members ?? []) as OrganizationMember[],
    role: (myMember?.role as OrganizationMember['role']) ?? null,
  }
}

export interface PendingInvite {
  id: string
  organization_id: string
  organization_name: string | null
  email: string
  role: OrganizationMember['role']
  invited_at: string
}

export async function listPendingInvitesForCurrentUser(): Promise<PendingInvite[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return []
  const { data: invites } = await supabase
    .from('organization_members')
    .select('id, organization_id, email, role, invited_at, status')
    .eq('email', user.email.toLowerCase())
    .eq('status', 'pending')
  if (!invites || invites.length === 0) return []
  const orgIds = invites.map((i) => i.organization_id as string)
  const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds)
  const orgMap = new Map<string, string>((orgs ?? []).map((o) => [o.id as string, o.name as string]))
  return invites.map((i) => ({
    id: i.id as string,
    organization_id: i.organization_id as string,
    organization_name: orgMap.get(i.organization_id as string) ?? null,
    email: i.email as string,
    role: i.role as OrganizationMember['role'],
    invited_at: i.invited_at as string,
  }))
}

export interface OrgMemberStats {
  user_id: string
  full_name: string
  email: string | null
  clients_count: number
  measurements_count: number
  last_activity: string | null
}

export async function getOrgMembersStats(): Promise<OrgMemberStats[]> {
  const ctx = await getOrganizationContext()
  if (!ctx.organization || (ctx.role !== 'owner' && ctx.role !== 'admin')) return []
  const supabase = await createClient()

  const userIds = ctx.members
    .filter((m) => m.status === 'active' && m.user_id)
    .map((m) => m.user_id as string)
  if (userIds.length === 0) return []

  const [{ data: profilesRows }, { data: profProfilesRows }, { data: clientsRows }, { data: measurementsRows }] = await Promise.all([
    supabase.from('profiles').select('id, nome, cognome, email').in('id', userIds),
    supabase.from('professional_profiles').select('id, nome, cognome').in('id', userIds),
    supabase.from('clients').select('id, professionista_id').in('professionista_id', userIds),
    supabase.from('measurement_analytics').select('user_id, measured_at, measured_at_utc, tz_offset_minutes').in('user_id', userIds),
  ])

  const profileMap = new Map<string, { nome: string | null; cognome: string | null; email: string | null }>()
  for (const p of (profilesRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null }>) {
    profileMap.set(p.id, { nome: p.nome, cognome: p.cognome, email: p.email })
  }
  const profProfMap = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (profProfilesRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profProfMap.set(p.id, { nome: p.nome, cognome: p.cognome })
  }

  const clientsByUser = new Map<string, number>()
  for (const c of (clientsRows ?? []) as Array<{ professionista_id: string }>) {
    clientsByUser.set(c.professionista_id, (clientsByUser.get(c.professionista_id) ?? 0) + 1)
  }
  const measurementsByUser = new Map<string, number>()
  const lastByUser = new Map<string, string>()
  for (const m of (measurementsRows ?? []) as Array<{ user_id: string; measured_at: string }>) {
    measurementsByUser.set(m.user_id, (measurementsByUser.get(m.user_id) ?? 0) + 1)
    const prev = lastByUser.get(m.user_id)
    // Istante normalizzato: `prev` conserva gia' un ISO normalizzato, quindi il
    // confronto e' fra grandezze omogenee anche con le due convenzioni miste.
    const i = measuredInstant(m)
    if (i && (!prev || i.getTime() > new Date(prev).getTime())) {
      lastByUser.set(m.user_id, i.toISOString())
    }
  }

  return userIds.map((uid) => {
    const p = profileMap.get(uid)
    const pp = profProfMap.get(uid)
    const nome = pp?.nome ?? p?.nome ?? ''
    const cognome = pp?.cognome ?? p?.cognome ?? ''
    const member = ctx.members.find((m) => m.user_id === uid)
    const full = `${nome} ${cognome}`.trim() || member?.email || 'Professionista'
    return {
      user_id: uid,
      full_name: full,
      email: p?.email ?? member?.email ?? null,
      clients_count: clientsByUser.get(uid) ?? 0,
      measurements_count: measurementsByUser.get(uid) ?? 0,
      last_activity: lastByUser.get(uid) ?? null,
    }
  })
}

export interface OrgOverview {
  total_professionals: number
  total_clients: number
  total_measurements: number
  measurements_this_week: number
  recent: Array<{
    session_id: string
    client_id: string
    client_name: string
    professional_id: string
    professional_name: string
    measured_at: string
    score_stress: number | null
  }>
}

export async function getOrgOverview(): Promise<OrgOverview | null> {
  const ctx = await getOrganizationContext()
  if (!ctx.organization || (ctx.role !== 'owner' && ctx.role !== 'admin')) return null
  const supabase = await createClient()

  const activeUserIds = ctx.members
    .filter((m) => m.status === 'active' && m.user_id)
    .map((m) => m.user_id as string)

  const { count: clientsCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .in('professionista_id', activeUserIds.length ? activeUserIds : ['00000000-0000-0000-0000-000000000000'])

  const { count: measurementsCount } = await supabase
    .from('measurement_analytics')
    .select('*', { count: 'exact', head: true })
    .in('user_id', activeUserIds.length ? activeUserIds : ['00000000-0000-0000-0000-000000000000'])

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const { count: weeklyCount } = await supabase
    .from('measurement_analytics')
    .select('*', { count: 'exact', head: true })
    .in('user_id', activeUserIds.length ? activeUserIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('measured_at_utc', weekAgo.toISOString())

  const { data: recentRows } = await supabase
    .from('measurement_analytics')
    .select('session_id, client_id, user_id, measured_at, measured_at_utc, tz_offset_minutes, score_stress')
    .in('user_id', activeUserIds.length ? activeUserIds : ['00000000-0000-0000-0000-000000000000'])
    .order('measured_at_utc', { ascending: false })
    .limit(20)

  const recent = (recentRows ?? []) as Array<{
    session_id: string
    client_id: string
    user_id: string
    measured_at: string
    score_stress: number | null
  }>
  const clientIds = Array.from(new Set(recent.map((r) => r.client_id)))
  const profIds = Array.from(new Set(recent.map((r) => r.user_id)))
  const [{ data: clientRows }, { data: profileRows }, { data: profProfileRows }] = await Promise.all([
    clientIds.length
      ? supabase.from('clients').select('id, nome, cognome').in('id', clientIds)
      : Promise.resolve({ data: [] }),
    profIds.length
      ? supabase.from('profiles').select('id, nome, cognome').in('id', profIds)
      : Promise.resolve({ data: [] }),
    profIds.length
      ? supabase.from('professional_profiles').select('id, nome, cognome').in('id', profIds)
      : Promise.resolve({ data: [] }),
  ])
  const clientMap = new Map<string, string>()
  for (const c of (clientRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    clientMap.set(c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Cliente')
  }
  const profMap = new Map<string, string>()
  for (const p of (profileRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    profMap.set(p.id, `${p.nome ?? ''} ${p.cognome ?? ''}`.trim())
  }
  for (const p of (profProfileRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    const full = `${p.nome ?? ''} ${p.cognome ?? ''}`.trim()
    if (full && !profMap.get(p.id)) profMap.set(p.id, full)
  }

  return {
    total_professionals: activeUserIds.length,
    total_clients: clientsCount ?? 0,
    total_measurements: measurementsCount ?? 0,
    measurements_this_week: weeklyCount ?? 0,
    recent: recent.map((r) => ({
      session_id: r.session_id,
      client_id: r.client_id,
      client_name: clientMap.get(r.client_id) ?? 'Cliente',
      professional_id: r.user_id,
      professional_name: profMap.get(r.user_id) || 'Professionista',
      measured_at: r.measured_at,
      score_stress: r.score_stress,
    })),
  }
}

// ============================================================================
// SUPERADMIN — accesso read-only ai dati di tutti i professionisti
// ============================================================================

// Flag del profilo corrente. Error-safe: se la colonna is_superadmin non esiste
// ancora (migration 010 non applicata) il flag resta false e la feature è inattiva,
// senza rompere le pagine che chiamano questa funzione (es. DashboardLayout).
export async function getCurrentProfileFlags(): Promise<{ userId: string | null; isSuperadmin: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, isSuperadmin: false }
  const { data, error } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle()
  if (error) return { userId: user.id, isSuperadmin: false }
  return { userId: user.id, isSuperadmin: !!(data as { is_superadmin?: boolean } | null)?.is_superadmin }
}

async function getProfessionalDisplayName(userId: string): Promise<string> {
  const supabase = await createClient()
  const [{ data: pp }, { data: p }] = await Promise.all([
    supabase.from('professional_profiles').select('nome, cognome').eq('id', userId).maybeSingle(),
    supabase.from('profiles').select('nome, cognome, email').eq('id', userId).maybeSingle(),
  ])
  const ppr = pp as { nome: string | null; cognome: string | null } | null
  const pr = p as { nome: string | null; cognome: string | null; email: string | null } | null
  const nome = ppr?.nome ?? pr?.nome ?? ''
  const cognome = ppr?.cognome ?? pr?.cognome ?? ''
  const full = `${nome} ${cognome}`.trim()
  return full || pr?.email || 'Professionista'
}

export type ViewingAccess = 'org' | 'superadmin'
export interface ViewingProfessional {
  user_id: string
  full_name: string
  access: ViewingAccess
}

// Risolve, in modo autorizzato, il professionista di cui si stanno visualizzando
// i dati tramite ?professionista=UUID. Supporta due percorsi:
//  - superadmin → può vedere QUALSIASI professionista (sola lettura)
//  - org owner/admin → solo i membri attivi del proprio team (comportamento esistente)
// Ritorna null se non autorizzato o se professionistaId è assente.
export async function resolveViewingProfessional(professionistaId?: string | null): Promise<{
  viewing: ViewingProfessional | null
  currentUserId: string | null
  isSuperadmin: boolean
}> {
  const { userId, isSuperadmin } = await getCurrentProfileFlags()
  if (!professionistaId || !userId) return { viewing: null, currentUserId: userId, isSuperadmin }

  if (isSuperadmin) {
    const full_name = await getProfessionalDisplayName(professionistaId)
    return { viewing: { user_id: professionistaId, full_name, access: 'superadmin' }, currentUserId: userId, isSuperadmin }
  }

  const ctx = await getOrganizationContext()
  if (ctx.role === 'owner' || ctx.role === 'admin') {
    const stats = await getOrgMembersStats()
    const m = stats.find((s) => s.user_id === professionistaId)
    if (m) return { viewing: { user_id: m.user_id, full_name: m.full_name, access: 'org' }, currentUserId: userId, isSuperadmin }
  }
  return { viewing: null, currentUserId: userId, isSuperadmin }
}

export interface ProfessionalStats {
  user_id: string
  full_name: string
  email: string | null
  clients_count: number
  measurements_count: number
  last_activity: string | null
  plan: string
  created_at: string | null
}

// Legge plan + created_at dei profili in modo error-safe: se la colonna plan
// o created_at non esiste ancora (migration 013 non applicata) la query fallisce
// e si ricade su valori di default senza rompere l'elenco professionisti.
async function getPlansAndCreatedAt(
  ids: string[],
): Promise<Map<string, { plan: string; created_at: string | null }>> {
  const map = new Map<string, { plan: string; created_at: string | null }>()
  if (ids.length === 0) return map
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, plan, created_at')
    .in('id', ids)
  if (error) return map
  for (const r of (data ?? []) as Array<{ id: string; plan: string | null; created_at: string | null }>) {
    map.set(r.id, { plan: r.plan ?? 'base', created_at: r.created_at ?? null })
  }
  return map
}

// Piano corrente di un singolo professionista (per la vista dettaglio superadmin).
// Error-safe: ritorna 'base' se la colonna plan non esiste ancora.
export async function getProfessionalPlan(userId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()
  if (error) return 'base'
  return (data as { plan?: string | null } | null)?.plan ?? 'base'
}

// Elenco di tutti i professionisti con statistiche aggregate. Solo superadmin.
// (Dipende dalle policy RLS della migration 010 per leggere dati altrui.)
export async function listAllProfessionalsStats(): Promise<ProfessionalStats[]> {
  const { isSuperadmin } = await getCurrentProfileFlags()
  if (!isSuperadmin) return []
  const supabase = await createClient()

  const { data: profilesRows } = await supabase
    .from('profiles')
    .select('id, nome, cognome, email')
    .eq('role', 'professional')
  const profs = (profilesRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null }>
  if (profs.length === 0) return []
  const ids = profs.map((p) => p.id)

  const [{ data: ppRows }, { data: clientsRows }, { data: maRows }, planMap] = await Promise.all([
    supabase.from('professional_profiles').select('id, nome, cognome').in('id', ids),
    supabase.from('clients').select('professionista_id').in('professionista_id', ids),
    supabase.from('measurement_analytics').select('user_id, measured_at, measured_at_utc, tz_offset_minutes').in('user_id', ids),
    getPlansAndCreatedAt(ids),
  ])

  const ppMap = new Map<string, { nome: string | null; cognome: string | null }>()
  for (const p of (ppRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    ppMap.set(p.id, { nome: p.nome, cognome: p.cognome })
  }
  const clientsByUser = new Map<string, number>()
  for (const c of (clientsRows ?? []) as Array<{ professionista_id: string }>) {
    clientsByUser.set(c.professionista_id, (clientsByUser.get(c.professionista_id) ?? 0) + 1)
  }
  const measurementsByUser = new Map<string, number>()
  const lastByUser = new Map<string, string>()
  for (const m of (maRows ?? []) as Array<{ user_id: string; measured_at: string }>) {
    measurementsByUser.set(m.user_id, (measurementsByUser.get(m.user_id) ?? 0) + 1)
    const prev = lastByUser.get(m.user_id)
    // Istante normalizzato: `prev` conserva gia' un ISO normalizzato, quindi il
    // confronto e' fra grandezze omogenee anche con le due convenzioni miste.
    const i = measuredInstant(m)
    if (i && (!prev || i.getTime() > new Date(prev).getTime())) {
      lastByUser.set(m.user_id, i.toISOString())
    }
  }

  return profs
    .map((p) => {
      const pp = ppMap.get(p.id)
      const nome = pp?.nome ?? p.nome ?? ''
      const cognome = pp?.cognome ?? p.cognome ?? ''
      const full = `${nome} ${cognome}`.trim() || p.email || 'Professionista'
      const planInfo = planMap.get(p.id)
      return {
        user_id: p.id,
        full_name: full,
        email: p.email ?? null,
        clients_count: clientsByUser.get(p.id) ?? 0,
        measurements_count: measurementsByUser.get(p.id) ?? 0,
        last_activity: lastByUser.get(p.id) ?? null,
        plan: planInfo?.plan ?? 'base',
        created_at: planInfo?.created_at ?? null,
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

// Carica TUTTE le misurazioni dello studio (per pagina analytics)
export async function listAllMeasurements(opts?: { from?: string; to?: string }): Promise<MeasurementAnalytics[]> {
  const supabase = await createClient()
  let q = supabase
    .from('measurement_analytics')
    .select('*')
    .order('measured_at_utc', { ascending: true })
  if (opts?.from) q = q.gte('measured_at_utc', opts.from)
  if (opts?.to) q = q.lte('measured_at_utc', opts.to)
  const { data } = await q
  return (data ?? []) as MeasurementAnalytics[]
}
