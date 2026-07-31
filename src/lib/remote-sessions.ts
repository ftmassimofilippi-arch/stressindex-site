import { cache } from 'react'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient, hasServiceRole } from './supabase-admin'
import { selectWithMissingColumnFallback } from './safe-select'
import { measuredInstant, toStr } from './format'
import type { MeasurementAnalytics } from './types'

// =============================================================================
// SESSIONI REMOTE (auto-misurate dal cliente dal proprio account)
// =============================================================================
//
// Una misurazione fatta dal cliente sulla SUA app viene salvata con
//   sessions.professionista_id = uid del CLIENTE   (non del professionista)
//   sessions.client_id         = NULL              (nessuna anagrafica CRM)
// quindi la RLS su `sessions` e su `measurement_analytics` la rende invisibile
// al professionista, anche quando esiste un collegamento attivo.
//
// PERCHÉ NON LA RPC: il codice precedente chiamava
// get_linked_client_sessions_by_client_id, che NON esiste nel database (esiste
// invece get_linked_client_sessions_by_email, usata dall'app Flutter). La
// chiamata falliva sempre con PGRST202 e il catch restituiva [] → misurazioni
// remote invisibili ovunque. Qui il ponte è ricostruito lato server con la
// service_role, che ha due vantaggi:
//   • non dipende da migration da applicare a mano;
//   • legge ANCHE measurement_analytics delle sessioni remote, altrimenti
//     nascosta dalla RLS → gli score proprietari compaiono al posto di "—".
//
// SICUREZZA — la service_role bypassa la RLS, quindi ogni funzione pubblica di
// questo modulo accetta un `professionistaId` che il chiamante DEVE avere già
// autorizzato (l'utente loggato, oppure una riga `clients` letta con la RLS
// attiva: se torna la riga, il lettore è autorizzato a vederla). Tutte le query
// sono poi filtrate su quel professionista e sui suoi link `active`: nessun
// dato di un altro studio può essere raggiunto da qui.

export type SessionRow = {
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
  notes_professionista?: string | null
  indicazioni?: string | null
}

// ⚠️ Non tutte queste colonne esistono su ogni database: `coherence_data` oggi
// NON esiste su `sessions`, e `orthostatic_data` è stata aggiunta solo il
// 2026-07-28 — selezionarle senza rete di sicurezza fa fallire l'intera query
// con 42703 e azzera le misurazioni di tutti i clienti (già successo in
// produzione). La lettura passa da selectWithMissingColumnFallback.
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
  'orthostatic_data',
  'coherence_data',
  'tags',
  'notes_professionista',
  'indicazioni',
] as const

// Costruisce una MeasurementAnalytics minimale a partire da una riga `sessions`.
// Usato quando measurement_analytics non contiene la riga per quel session_id
// (es. fire-and-forget Flutter fallito, sync queue non drenata): i campi score_*
// restano null e la dashboard mostra "—" per le sole metriche calcolate.
export function sessionToMeasurementAnalytics(s: SessionRow): MeasurementAnalytics {
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

// ─────────────────────────────────────────────────────────────────────────────
// Ponte anagrafica CRM (clients.id) → utente app (profiles.id)
// ─────────────────────────────────────────────────────────────────────────────
// Tre vie, in ordine di affidabilità — coprono ENTRAMBI gli scenari:
//   1. clients.client_user_id       → ponte esplicito (migration 017, se applicata)
//   2. link.client_id / clients.id == profiles.id
//                                   → cliente nato dall'accettazione del link
//                                     (si è registrato da solo e poi collegato)
//   3. email uguale (case/space-insensitive)
//                                   → cliente pre-registrato dal professionista
//                                     che poi si è collegato con la stessa email

type ClientRow = { id: string; email: string | null; client_user_id?: string | null }

export type ClientUserPair = { clientId: string; userId: string }

async function buildBridge(
  professionistaId: string,
  clientIds?: string[],
): Promise<ClientUserPair[]> {
  const admin = createAdminClient()

  // client_user_id esiste solo dopo la migration 017: se manca, riprova senza.
  const selectClients = async (cols: string) => {
    let q = admin.from('clients').select(cols).eq('professionista_id', professionistaId)
    if (clientIds?.length) q = q.in('id', clientIds)
    return q
  }
  let clientsRes = await selectClients('id, email, client_user_id')
  if (clientsRes.error) {
    clientsRes = await selectClients('id, email')
  }
  const linksRes = await admin
    .from('client_professional_links')
    .select('client_id, client_user_id')
    .eq('professional_id', professionistaId)
    .eq('status', 'active')

  if (clientsRes.error) {
    console.error('[remote-sessions] lettura clients fallita', { professionistaId, error: clientsRes.error })
    return []
  }
  if (linksRes.error) {
    console.error('[remote-sessions] lettura client_professional_links fallita', { professionistaId, error: linksRes.error })
    return []
  }

  const clients = (clientsRes.data ?? []) as unknown as ClientRow[]
  const links = (linksRes.data ?? []) as Array<{ client_id: string | null; client_user_id: string | null }>
  const userIds = Array.from(new Set(links.map((l) => l.client_user_id).filter((v): v is string => !!v)))
  if (clients.length === 0 || userIds.length === 0) return []

  const { data: profileRows, error: pErr } = await admin
    .from('profiles')
    .select('id, email')
    .in('id', userIds)
  if (pErr) {
    console.error('[remote-sessions] lettura profiles fallita', { professionistaId, error: pErr })
    return []
  }
  const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase()
  const emailByUser = new Map<string, string>()
  for (const p of (profileRows ?? []) as Array<{ id: string; email: string | null }>) {
    emailByUser.set(p.id, norm(p.email))
  }

  const pairs: ClientUserPair[] = []
  for (const l of links) {
    const userId = l.client_user_id
    if (!userId) continue
    const explicit = clients.find((c) => c.client_user_id === userId)
    const byLink = l.client_id ? clients.find((c) => c.id === l.client_id) : undefined
    const byId = clients.find((c) => c.id === userId)
    const email = emailByUser.get(userId)
    const byEmail = email ? clients.find((c) => norm(c.email) === email) : undefined
    const match = explicit ?? byLink ?? byId ?? byEmail
    if (match) pairs.push({ clientId: match.id, userId })
  }
  return pairs
}

// ─────────────────────────────────────────────────────────────────────────────
// Caricamento misurazioni remote
// ─────────────────────────────────────────────────────────────────────────────

async function loadRemoteMeasurements(
  professionistaId: string,
  clientIds?: string[],
): Promise<MeasurementAnalytics[]> {
  if (!hasServiceRole()) {
    console.warn('[remote-sessions] SUPABASE_SERVICE_ROLE_KEY assente: le misurazioni remote non sono leggibili')
    return []
  }
  const pairs = await buildBridge(professionistaId, clientIds)
  if (pairs.length === 0) return []

  const clientIdByUser = new Map<string, string>()
  for (const p of pairs) if (!clientIdByUser.has(p.userId)) clientIdByUser.set(p.userId, p.clientId)
  const userIds = Array.from(clientIdByUser.keys())

  const admin = createAdminClient()
  const { data: sessionRows, error: sErr } = await selectWithMissingColumnFallback<SessionRow>(
    SESSION_COLUMNS,
    (cols) =>
      admin.from('sessions').select(cols).in('professionista_id', userIds).is('client_id', null) as unknown as PromiseLike<{
        data: SessionRow[] | null
        error: PostgrestError | null
      }>,
    { label: 'sessions (remote)', required: ['id', 'professionista_id'] },
  )
  if (sErr) {
    console.error('[remote-sessions] lettura sessions fallita', { professionistaId, error: sErr })
    return []
  }
  const sessions = (sessionRows ?? []) as unknown as SessionRow[]
  if (sessions.length === 0) return []

  const { data: maRows, error: maErr } = await admin
    .from('measurement_analytics')
    .select('*')
    .in(
      'session_id',
      sessions.map((s) => s.id),
    )
  if (maErr) {
    console.error('[remote-sessions] lettura measurement_analytics fallita', { professionistaId, error: maErr })
  }
  const maBySession = new Map<string, MeasurementAnalytics>()
  for (const row of (maRows ?? []) as MeasurementAnalytics[]) {
    if (row.session_id) maBySession.set(row.session_id, row)
  }

  const out = sessions.map((s) => {
    const clientId = clientIdByUser.get(s.professionista_id) as string
    const ma = maBySession.get(s.id)
    // client_id resta NULL sulla riga remota: lo valorizziamo con l'anagrafica
    // CRM così tutte le viste possono raggruppare per cliente come sempre.
    return ma
      ? ({ ...ma, client_id: clientId } as MeasurementAnalytics)
      : sessionToMeasurementAnalytics({ ...s, client_id: clientId })
  })
  console.log('[remote-sessions] caricate', {
    professionistaId,
    clienti: clientIds?.length ?? 'tutti',
    ponti: pairs.length,
    sessioni: sessions.length,
    conScore: maBySession.size,
  })
  return out
}

// Tutte le misurazioni remote dei clienti collegati del professionista.
// Memoizzata per richiesta (React cache): dashboard, lista clienti e analytics
// la chiamano nello stesso render senza moltiplicare le query.
export const remoteMeasurementsForProfessional = cache(
  async (professionistaId: string): Promise<MeasurementAnalytics[]> => loadRemoteMeasurements(professionistaId),
)

// Misurazioni remote di UN solo cliente (scheda cliente): query mirata, non
// carica l'intero studio.
export async function remoteMeasurementsForClient(
  professionistaId: string,
  clientId: string,
): Promise<MeasurementAnalytics[]> {
  return loadRemoteMeasurements(professionistaId, [clientId])
}

// UNA sola sessione remota, cercata per id. Usata dalle route PDF: prima di
// generare il documento devono poter dire "questa sessione appartiene davvero a
// questo cliente" anche quando la RLS non la mostra.
//
// SICUREZZA: la query admin è vincolata ai soli professionista_id ottenuti dal
// ponte per QUEL cliente di QUEL professionista, quindi un id di sessione
// indovinato non restituisce nulla se non è del cliente richiesto.
export async function findRemoteMeasurement(
  professionistaId: string,
  clientId: string,
  sessionId: string,
): Promise<{ session: SessionRow; analytics: MeasurementAnalytics | null } | null> {
  if (!hasServiceRole()) {
    console.warn('[remote-sessions] SUPABASE_SERVICE_ROLE_KEY assente: sessione remota non verificabile', { clientId, sessionId })
    return null
  }
  const pairs = await buildBridge(professionistaId, [clientId])
  const userIds = Array.from(new Set(pairs.map((p) => p.userId)))
  if (userIds.length === 0) return null

  const admin = createAdminClient()
  const { data: rows, error } = await selectWithMissingColumnFallback<SessionRow>(
    SESSION_COLUMNS,
    (cols) =>
      admin
        .from('sessions')
        .select(cols)
        .eq('id', sessionId)
        .in('professionista_id', userIds)
        .limit(1) as unknown as PromiseLike<{ data: SessionRow[] | null; error: PostgrestError | null }>,
    { label: 'sessions (remota singola)', required: ['id', 'professionista_id'] },
  )
  if (error) {
    console.error('[remote-sessions] lettura sessione remota fallita', { clientId, sessionId, error })
    return null
  }
  const session = (rows ?? [])[0]
  if (!session) return null

  const { data: ma } = await admin
    .from('measurement_analytics')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  return {
    session: { ...session, client_id: session.client_id ?? clientId },
    analytics: ma ? ({ ...(ma as MeasurementAnalytics), client_id: clientId }) : null,
  }
}

// Fallback senza service_role: RPC SECURITY DEFINER dell'app Flutter, che
// verifica internamente link `active` + email. Copre solo i clienti con email
// coincidente, ma non richiede la chiave service_role.
export async function remoteSessionsViaRpc(
  supabase: SupabaseClient,
  clientEmail: string | null | undefined,
  clientId: string,
): Promise<MeasurementAnalytics[]> {
  const email = (clientEmail ?? '').trim()
  if (!email) return []
  const { data, error } = await supabase.rpc('get_linked_client_sessions_by_email', { p_email: email })
  if (error) {
    console.error('[remote-sessions] fallback RPC get_linked_client_sessions_by_email fallita', { clientId, error })
    return []
  }
  return ((data ?? []) as SessionRow[]).map((s) =>
    sessionToMeasurementAnalytics({ ...s, client_id: s.client_id ?? clientId }),
  )
}

// Ultima misurazione remota per cliente (timestamp), per la colonna
// "ultima misurazione" della lista clienti e per i clienti da contattare.
export function lastRemoteAtByClient(remote: MeasurementAnalytics[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of remote) {
    if (!m.client_id || !m.measured_at) continue
    const prev = map.get(m.client_id)
    const i = measuredInstant(m)
    if (i && (!prev || i.getTime() > new Date(prev).getTime())) {
      map.set(m.client_id, i.toISOString())   // istante normalizzato, non il grezzo
    }
  }
  return map
}
