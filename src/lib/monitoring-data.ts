import { cache } from 'react'
import { gunzipSync } from 'zlib'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createClient } from './supabase-server'
import { createAdminClient, hasServiceRole } from './supabase-admin'
import { selectWithMissingColumnFallback } from './safe-select'
import { buildBridge } from './remote-sessions'
import { toNum, toStr } from './format'
import { stateOf, sleepStateOf } from './monitoring-format'
import type {
  MonitoringEvent,
  MonitoringRrFile,
  MonitoringSession,
  MonitoringType,
  MonitoringWindow,
  SleepWindow,
} from './monitoring-types'

// =============================================================================
// MONITORAGGIO 24h / SONNO — data layer
// -----------------------------------------------------------------------------
// Ogni vista che mostra monitoraggi passa DA QUI, mai da query dirette.
//
// Due sorgenti, come per le misurazioni brevi (remote-sessions.ts):
//   • righe scritte con professionista_id = pro (in studio, o cliente collegato
//     con pro di riferimento);
//   • righe scritte dal cliente sul SUO account (user_id = account cliente,
//     professionista_id spesso NULL o diverso) che la RLS mostra al pro solo
//     se esiste un link attivo. Con la service_role il ponte è ricostruito lato
//     server (buildBridge: client_user_id → id → email) così vale anche per i
//     collegamenti fatti a mano dal pannello e per la vista superadmin.
//   Senza service_role si ricade sulla sessione utente (RLS) + RPC dell'app.
//
// SICUREZZA: le funzioni con service_role accettano un `professionistaId` che
// il chiamante DEVE avere già autorizzato (utente loggato, oppure il
// professionista risolto da resolveViewingProfessional). Le query sono sempre
// filtrate su di lui e sui suoi link attivi.
//
// Le liste NON caricano `windows` (≈ 250 KB a riga): solo il dettaglio.
// Le colonne delle migrazioni non ancora applicate (recording_profile,
// sleep_*, events_modified_on_web) sono lette con fallback resiliente.
// =============================================================================

const BASE_COLUMNS = [
  'id',
  'user_id',
  'professionista_id',
  'client_id',
  'monitoring_type',
  'source',
  'device_name',
  'start_time',
  'end_time',
  'tz_offset_minutes',
  'duration_minutes',
  'rr_count',
  'artifact_percentage',
  'signal_quality',
  'ectopic_count',
  'valid_coverage_percentage',
  'events',
  'night',
  'summary',
  'scores_night',
  'scores_morning',
  'baseline_snapshot',
  'algorithm_version',
  'rr_storage_path',
  'notes',
  'tags',
  'created_at',
  'updated_at',
  // Migrazioni successive (possono mancare → escluse al volo dal fallback)
  'recording_profile',
  'sleep_score',
  'spo2_storage_path',
  'device_serial',
  'sample_interval_seconds',
  'events_modified_on_web',
] as const

const LIST_COLUMNS = BASE_COLUMNS
const DETAIL_COLUMNS = [...BASE_COLUMNS, 'windows'] as const

type RawRow = Record<string, unknown>

type ServerClient = Awaited<ReturnType<typeof createClient>>

// ── Parsing difensivo ─────────────────────────────────────────────────────────

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

function asObject<T>(v: unknown): T | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null
}

function parseWindows24h(v: unknown): MonitoringWindow[] {
  return asArray<Record<string, unknown>>(v)
    .filter((w) => w && typeof w.s === 'string')
    .map((w) => ({
      s: w.s as string,
      e: (w.e as string) ?? (w.s as string),
      valid: w.valid === true,
      state: stateOf(w.state),
      art: toNum(w.art),
      cov: toNum(w.cov),
      hr: toNum(w.hr),
      hr_min: toNum(w.hr_min),
      hr_max: toNum(w.hr_max),
      rmssd: toNum(w.rmssd),
      ln_rmssd: toNum(w.ln_rmssd),
      sdnn: toNum(w.sdnn),
      pnn50: toNum(w.pnn50),
      lf_hf: toNum(w.lf_hf),
      hf_nu: toNum(w.hf_nu),
      si: toNum(w.si),
      dfa: toNum(w.dfa),
      br: toNum(w.br),
    }))
}

function parseWindowsSleep(v: unknown): SleepWindow[] {
  return asArray<Record<string, unknown>>(v)
    .filter((w) => w && typeof w.s === 'string')
    .map((w) => ({
      s: w.s as string,
      e: (w.e as string) ?? (w.s as string),
      state: sleepStateOf(w.state),
      spo2: toNum(w.spo2),
      spo2_min: toNum(w.spo2_min),
      pr: toNum(w.pr),
      mov: toNum(w.mov),
      ev: toNum(w.ev) ?? 0,
    }))
}

function parseEvents(v: unknown): MonitoringEvent[] {
  return asArray<Record<string, unknown>>(v)
    .filter((e) => e && typeof e.id === 'string' && typeof e.timestamp === 'string')
    .map((e) => ({
      id: e.id as string,
      type: (typeof e.type === 'string' ? e.type : 'other') as MonitoringEvent['type'],
      timestamp: e.timestamp as string,
      label: typeof e.label === 'string' ? e.label : '',
      note: toStr(e.note),
      response: asObject<MonitoringEvent['response']>(e.response),
    }))
}

/** Riga PostgREST → tipo discriminato. `windows` è parsato solo se presente. */
export function parseMonitoringRow(r: RawRow): MonitoringSession {
  const type = (r.monitoring_type === 'sleep' || r.monitoring_type === 'custom' ? r.monitoring_type : '24h') as MonitoringType
  const base = {
    id: String(r.id),
    user_id: String(r.user_id),
    professionista_id: toStr(r.professionista_id),
    client_id: toStr(r.client_id),
    source: (toStr(r.source) ?? 'import') as MonitoringSession['source'],
    device_name: toStr(r.device_name),
    start_time: String(r.start_time),
    end_time: String(r.end_time ?? r.start_time),
    tz_offset_minutes: toNum(r.tz_offset_minutes) ?? 0,
    duration_minutes: toNum(r.duration_minutes) ?? 0,
    rr_count: toNum(r.rr_count),
    artifact_percentage: toNum(r.artifact_percentage),
    signal_quality: (toStr(r.signal_quality) as MonitoringSession['signal_quality']) ?? null,
    ectopic_count: toNum(r.ectopic_count),
    valid_coverage_percentage: toNum(r.valid_coverage_percentage),
    algorithm_version: toStr(r.algorithm_version) ?? '',
    rr_storage_path: toStr(r.rr_storage_path),
    notes: toStr(r.notes),
    tags: asArray<string>(r.tags).map(String),
    created_at: toStr(r.created_at),
    updated_at: toStr(r.updated_at),
    recording_profile: (toStr(r.recording_profile) as MonitoringSession['recording_profile']) ?? null,
    events_modified_on_web: r.events_modified_on_web === true,
    client_name: toStr(r.client_name),
    professional_name: toStr(r.professional_name),
    events: parseEvents(r.events),
  }
  if (type === 'sleep') {
    return {
      ...base,
      monitoring_type: 'sleep',
      windows: parseWindowsSleep(r.windows),
      night: asObject(r.night),
      summary: asObject(r.summary),
      sleep_score: toNum(r.sleep_score),
      spo2_storage_path: toStr(r.spo2_storage_path),
      device_serial: toStr(r.device_serial),
      sample_interval_seconds: toNum(r.sample_interval_seconds),
    }
  }
  return {
    ...base,
    monitoring_type: type,
    windows: parseWindows24h(r.windows),
    night: asObject(r.night),
    summary: asObject(r.summary),
    scores_night: asObject(r.scores_night),
    scores_morning: asObject(r.scores_morning),
    baseline_snapshot: asObject(r.baseline_snapshot),
  }
}

// ── Nomi dei clienti ─────────────────────────────────────────────────────────

async function clientNames(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return map
  const { data } = await db.from('clients').select('id, nome, cognome').in('id', unique)
  for (const c of (data ?? []) as Array<{ id: string; nome: string | null; cognome: string | null }>) {
    map.set(c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim() || 'Cliente')
  }
  return map
}

function sortDesc(rows: MonitoringSession[]): MonitoringSession[] {
  return rows.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
}

type Selectable = {
  select: (cols: string) => unknown
}

async function resilientSelect(
  label: string,
  columns: readonly string[],
  build: (cols: string) => PromiseLike<{ data: RawRow[] | null; error: PostgrestError | null }>,
): Promise<RawRow[]> {
  const { data, error } = await selectWithMissingColumnFallback<RawRow>(columns, build, {
    label,
    required: ['id', 'user_id', 'start_time', 'monitoring_type'],
  })
  if (error) {
    console.error(`[monitoring-data] ${label} fallita`, error)
    return []
  }
  return (data ?? []) as RawRow[]
}

// ── Caricamento con service_role (ponte ricostruito) ─────────────────────────

interface LoadOpts {
  clientIds?: string[]
  limit?: number
  withWindows?: boolean
}

async function loadWithServiceRole(professionistaId: string, opts: LoadOpts): Promise<MonitoringSession[]> {
  const admin = createAdminClient()
  const pairs = await buildBridge(professionistaId, opts.clientIds)
  const clientIdByUser = new Map<string, string>()
  for (const p of pairs) if (!clientIdByUser.has(p.userId)) clientIdByUser.set(p.userId, p.clientId)
  const userIds = Array.from(clientIdByUser.keys())
  const cols = opts.withWindows ? DETAIL_COLUMNS : LIST_COLUMNS

  // Righe con il pro come riferimento ∪ righe scritte dagli account collegati.
  const orParts = [`professionista_id.eq.${professionistaId}`]
  if (userIds.length > 0) orParts.push(`user_id.in.(${userIds.join(',')})`)

  const rows = await resilientSelect(
    'monitoring_sessions (service role)',
    cols,
    (c) => {
      let q = admin.from('monitoring_sessions').select(c).or(orParts.join(',')).order('start_time', { ascending: false })
      if (opts.limit) q = q.limit(opts.limit)
      return q as unknown as PromiseLike<{ data: RawRow[] | null; error: PostgrestError | null }>
    },
  )

  // Anagrafica: client_id della riga, altrimenti quello del ponte.
  const sessions = rows.map((r) => {
    const s = parseMonitoringRow(r)
    if (!s.client_id) s.client_id = clientIdByUser.get(s.user_id) ?? null
    return s
  })
  // Filtro per cliente (dopo la risoluzione del client_id).
  const filtered = opts.clientIds?.length
    ? sessions.filter((s) => s.client_id && opts.clientIds!.includes(s.client_id))
    : sessions
  const names = await clientNames(admin, filtered.map((s) => s.client_id ?? '').filter(Boolean))
  for (const s of filtered) s.client_name = s.client_id ? names.get(s.client_id) ?? null : null
  return sortDesc(filtered)
}

// ── Caricamento senza service_role (RLS + RPC dell'app) ──────────────────────

async function loadWithUserSession(
  supabase: ServerClient,
  professionistaId: string,
  currentUserId: string | null,
  opts: LoadOpts,
): Promise<MonitoringSession[]> {
  const cols = opts.withWindows ? DETAIL_COLUMNS : LIST_COLUMNS
  const own = currentUserId === professionistaId

  // 1. Lettura diretta sotto RLS (proprie, di riferimento, collegate, superadmin).
  const direct = await resilientSelect('monitoring_sessions (RLS)', cols, (c) => {
    let q = supabase.from('monitoring_sessions').select(c).order('start_time', { ascending: false })
    if (!own) q = q.eq('professionista_id', professionistaId)
    if (opts.clientIds?.length) q = q.in('client_id', opts.clientIds)
    if (opts.limit) q = q.limit(opts.limit)
    return q as unknown as PromiseLike<{ data: RawRow[] | null; error: PostgrestError | null }>
  })
  const byId = new Map<string, MonitoringSession>()
  for (const r of direct) {
    const s = parseMonitoringRow(r)
    byId.set(s.id, s)
  }

  // 2. Per la scheda cliente: RPC bridge dell'app (valorizza il client_id).
  if (own && opts.clientIds?.length) {
    for (const clientId of opts.clientIds) {
      const { data, error } = await supabase.rpc('get_linked_client_monitoring_sessions_by_client_id', { p_client_id: clientId })
      if (error) {
        console.error('[monitoring-data] rpc get_linked_client_monitoring_sessions_by_client_id fallita', { clientId, error })
        continue
      }
      for (const r of (data ?? []) as RawRow[]) {
        const s = parseMonitoringRow(opts.withWindows ? r : { ...r, windows: undefined })
        if (!s.client_id) s.client_id = clientId
        if (!byId.has(s.id)) byId.set(s.id, s)
      }
    }
  }

  const sessions = Array.from(byId.values())
  const names = await clientNames(supabase as unknown as SupabaseClient, sessions.map((s) => s.client_id ?? '').filter(Boolean))
  for (const s of sessions) s.client_name = s.client_id ? names.get(s.client_id) ?? null : null
  return sortDesc(sessions)
}

async function load(professionistaId: string, opts: LoadOpts): Promise<MonitoringSession[]> {
  if (hasServiceRole()) return loadWithServiceRole(professionistaId, opts)
  console.warn('[monitoring-data] SUPABASE_SERVICE_ROLE_KEY assente: i monitoraggi dei clienti collegati senza ponte RLS non sono leggibili')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return loadWithUserSession(supabase, professionistaId, user?.id ?? null, opts)
}

// ── API pubblica ─────────────────────────────────────────────────────────────

/** Tutti i monitoraggi (24h + sonno) visibili al professionista, senza `windows`. Memoizzata per richiesta. */
export const listMonitoringSessionsForProfessional = cache(
  async (professionistaId: string, limit?: number): Promise<MonitoringSession[]> => load(professionistaId, { limit }),
)

/** Monitoraggi di UN cliente (scheda cliente), senza `windows`. */
export async function listMonitoringSessionsForClient(professionistaId: string, clientId: string): Promise<MonitoringSession[]> {
  return load(professionistaId, { clientIds: [clientId] })
}

/** Conteggio per cliente, per contatori e analytics. */
export function countByClient(sessions: MonitoringSession[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) if (s.client_id) m.set(s.client_id, (m.get(s.client_id) ?? 0) + 1)
  return m
}

/**
 * Una sessione completa (con `windows`). Autorizzazione in due passi, come
 * per il PDF delle misurazioni brevi:
 *   1. lettura con la sessione utente: se la RLS restituisce la riga il
 *      lettore è autorizzato (proprietario, riferimento, link attivo, superadmin);
 *   2. altrimenti, con la service_role, la riga è accettata solo se appartiene
 *      al professionista indicato o a un suo account collegato.
 */
export async function getMonitoringSession(sessionId: string, professionistaId: string | null): Promise<MonitoringSession | null> {
  const supabase = await createClient()
  const direct = await resilientSelect('monitoring_sessions (dettaglio RLS)', DETAIL_COLUMNS, (c) =>
    supabase.from('monitoring_sessions').select(c).eq('id', sessionId).limit(1) as unknown as PromiseLike<{
      data: RawRow[] | null
      error: PostgrestError | null
    }>,
  )
  let session: MonitoringSession | null = direct[0] ? parseMonitoringRow(direct[0]) : null

  if (!session && professionistaId && hasServiceRole()) {
    const rows = await loadWithServiceRole(professionistaId, { withWindows: true })
    session = rows.find((s) => s.id === sessionId) ?? null
    if (session) return session
  }
  if (!session) return null

  // Anagrafica e client_id mancante (riga scritta dal cliente).
  if (!session.client_id && professionistaId && hasServiceRole()) {
    const pairs = await buildBridge(professionistaId)
    session.client_id = pairs.find((p) => p.userId === session!.user_id)?.clientId ?? null
  }
  if (session.client_id) {
    const db = hasServiceRole() ? createAdminClient() : (supabase as unknown as SupabaseClient)
    session.client_name = (await clientNames(db, [session.client_id])).get(session.client_id) ?? null
  }
  return session
}

/** Ricava il professionista "titolare" della riga per l'intestazione dei PDF. */
export function ownerProfessionalId(s: MonitoringSession, fallback: string | null): string | null {
  return s.professionista_id ?? fallback
}

// ── File RR grezzo (bucket monitoring-rr) ────────────────────────────────────

const RR_BUCKET = 'monitoring-rr'
const SIGNED_URL_SECONDS = 120

/**
 * Legge il file RR della sessione tramite URL firmata a breve scadenza
 * generata lato server (service_role, dopo che la riga è stata autorizzata)
 * o, senza service_role, con la sessione utente (policy del bucket).
 * Serve SOLO all'export CSV: il sito non ricalcola nulla da questi dati.
 */
export async function readRrFile(session: MonitoringSession): Promise<MonitoringRrFile | null> {
  const path = session.rr_storage_path
  if (!path) return null
  const db: SupabaseClient = hasServiceRole() ? createAdminClient() : ((await createClient()) as unknown as SupabaseClient)
  const { data, error } = await db.storage.from(RR_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) {
    console.error('[monitoring-data] URL firmata RR non generata', { path, error })
    return null
  }
  const res = await fetch(data.signedUrl, { cache: 'no-store' })
  if (!res.ok) {
    console.error('[monitoring-data] download RR fallito', { path, status: res.status })
    return null
  }
  const buf = Buffer.from(await res.arrayBuffer())
  let text: string
  try {
    text = gunzipSync(buf).toString('utf8')
  } catch {
    // Il bucket accetta anche application/json non compresso.
    text = buf.toString('utf8')
  }
  try {
    const j = JSON.parse(text) as Record<string, unknown>
    return {
      version: toNum(j.version) ?? 1,
      session_id: toStr(j.session_id) ?? session.id,
      start_time: toStr(j.start_time) ?? session.start_time,
      tz_offset_minutes: toNum(j.tz_offset_minutes) ?? session.tz_offset_minutes,
      rr_ms: asArray<number>(j.rr_ms).map((v) => Number(v)),
      t_ms: Array.isArray(j.t_ms) ? (j.t_ms as unknown[]).map((v) => Number(v)) : undefined,
      raw_count: toNum(j.raw_count) ?? asArray(j.rr_ms).length,
    }
  } catch (e) {
    console.error('[monitoring-data] file RR non leggibile', { path, e })
    return null
  }
}

// ── Scrittura eventi dal sito ────────────────────────────────────────────────

/**
 * Sostituisce `events` e alza `events_modified_on_web`. La reazione agli
 * eventi NON viene calcolata qui: gli eventi nuovi/modificati arrivano con
 * `response: null` e restano "in attesa di ricalcolo" finché l'app non
 * riscrive la riga. Scrive con la sessione utente (la RLS decide chi può).
 */
export async function saveEventsFromWeb(sessionId: string, events: MonitoringEvent[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const payload: Record<string, unknown> = {
    events,
    events_modified_on_web: true,
    events_modified_on_web_at: new Date().toISOString(),
  }
  let { error } = await supabase.from('monitoring_sessions').update(payload).eq('id', sessionId)
  if (error && error.code === '42703') {
    // Migration 018 non applicata: salva comunque gli eventi, senza flag.
    console.warn('[monitoring-data] events_modified_on_web assente (018 non applicata): salvo solo events')
    ;({ error } = await supabase.from('monitoring_sessions').update({ events }).eq('id', sessionId))
  }
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Tipi esportati per i chiamanti che compongono query custom (admin).
export type { Selectable }
