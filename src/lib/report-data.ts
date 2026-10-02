import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { selectWithMissingColumnFallback } from '@/lib/safe-select'
import { conIstanteSessione, intervalloGiorniIta, measuredInstant, toStr } from '@/lib/format'
import type { Client, MeasurementAnalytics, ProfessionalProfile } from '@/lib/types'

// =============================================================================
// Caricamento dati per PDF e pagine di stampa (misurazione e report periodico).
// =============================================================================
//
// Le funzioni ricevono il client Supabase dal chiamante: quello dell'utente
// (RLS: proprietario, team, superadmin in sola lettura) nella via normale, la
// service_role nella via "solo token" delle pagine di stampa, dove il diritto
// di lettura è già stato verificato (print-access.ts).

export type SessionRow = {
  id: string
  client_id: string
  professionista_id: string
  /** Istante reale: l'unica colonna da cui leggere data e ora. */
  started_at_utc?: string | null
  /** Forma legacy (ora italiana etichettata UTC): non usare direttamente. */
  started_at: string | null
  created_at: string | null
  duration_seconds: number | null
  hrv_data: Record<string, unknown> | null
  test_type: string | null
  tags: string[] | null
  notes_professionista?: string | null
  indicazioni?: string | null
}

export type MeasurementWithNotes = MeasurementAnalytics & {
  notes_professionista?: string | null
  indicazioni?: string | null
}

const SESSION_COLUMNS = ['id', 'client_id', 'professionista_id', 'started_at_utc', 'started_at', 'created_at', 'duration_seconds', 'hrv_data', 'test_type', 'tags', 'notes_professionista', 'indicazioni']

// Stessa logica di sessions → MeasurementAnalytics usata in dashboard-data.ts:
// la riga di `sessions` è la fonte autoritativa, `measurement_analytics` è un
// arricchimento scritto in fire-and-forget dall'app e può mancare.
export function sessionToMeasurement(s: SessionRow): MeasurementAnalytics {
  const h = (s.hrv_data ?? {}) as Record<string, unknown>
  const n = (k: string): number | null => {
    const v = h[k]
    if (v === null || v === undefined) return null
    const x = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(x) ? x : null
  }
  const meanBpm = n('meanBpm')
  return {
    id: s.id,
    session_id: s.id,
    user_id: s.professionista_id,
    client_id: s.client_id,
    measured_at: (s.started_at ?? s.created_at ?? new Date().toISOString()) as string,
    // L'istante vero viaggia con la riga: senza questo, data e ora del report
    // venivano ricavate dalla forma legacy di `started_at`.
    started_at_utc: s.started_at_utc ?? null,
    duration_seconds: s.duration_seconds ?? 0,
    sensor_type: null,
    sensor_name: null,
    age: null,
    sex: null,
    is_smoker: null,
    is_athlete: null,
    activity_level: null,
    rr_intervals: null,
    rr_count: n('sampleCount'),
    artifact_percentage: null,
    mean_rr: meanBpm && meanBpm > 0 ? 60000 / meanBpm : null,
    sdnn: n('sdnn'),
    rmssd: n('rmssd'),
    pnn50: n('pnn50'),
    pnn20: n('pnn20'),
    mean_hr: meanBpm,
    sdnn_index: null,
    cv: n('cv'),
    rmssd_sdnn_ratio: n('rmssdSdnnRatio'),
    vlf_power: n('vlfPower'),
    lf_power: n('lfPower'),
    hf_power: n('hfPower'),
    total_power: n('totalPower'),
    lf_hf_ratio: n('lfHfRatio'),
    lf_nu: n('lfNorm'),
    hf_nu: n('hfNorm'),
    lf_nu_ls: n('lfNormLs'),
    hf_nu_ls: n('hfNormLs'),
    ectopic_count: n('ectopicCount'),
    // signal_quality è un'etichetta testuale ('good'|'fair'|'poor'), non un numero.
    signal_quality: toStr(h['signalQuality']),
    lf_vlf_ratio: null,
    vlf_power_ls: n('vlfPowerLs'),
    lf_power_ls: n('lfPowerLs'),
    hf_power_ls: n('hfPowerLs'),
    total_power_ls: n('totalPowerLs'),
    lf_hf_ratio_ls: n('lfHfRatioLs'),
    sd1: n('sd1'),
    sd2: n('sd2'),
    sd1_sd2_ratio: n('sd1Sd2Ratio'),
    dfa_alpha1: n('dfaAlpha1'),
    dfa_alpha2: n('dfaAlpha2'),
    sample_entropy: n('sampEn'),
    approximate_entropy: n('apEn'),
    triangular_index: n('hrvTriangularIndex'),
    tinn: n('tinn'),
    stress_index_baevsky: n('stressIndex'),
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
    duration_type: null,
    live_tags: null,
    tag_comparison: null,
    orthostatic_data: null,
    coherence_data: null,
    segments: null,
    rolling_series: null,
  }
}

/** Istante reale della sessione, in ms. Passa da `measuredInstant`, quindi
 *  `started_at_utc` quando c'è e la forma legacy normalizzata altrimenti: senza
 *  questo le sessioni remote venivano confrontate con un orologio diverso da
 *  quello dei filtri, con due ore di scarto. */
function startedMs(s: SessionRow): number {
  return measuredInstant(s)?.getTime() ?? new Date((s.created_at ?? '') as string).getTime()
}

async function selectSessions(
  supabase: SupabaseClient,
  build: (q: ReturnType<SupabaseClient['from']>, cols: string) => PromiseLike<{ data: SessionRow[] | null; error: PostgrestError | null }>,
  label: string,
) {
  return selectWithMissingColumnFallback<SessionRow>(
    SESSION_COLUMNS,
    (cols) => build(supabase.from('sessions'), cols),
    { label, required: ['id'] },
  )
}

/**
 * Sessioni remote del cliente (auto-misurate dall'app: client_id NULL), via
 * RPC SECURITY DEFINER.
 *
 * `professionistaId` è il TITOLARE della scheda, e si passa sempre: la RPC
 * della 019 parte da `auth.uid()`, che qui è quello giusto solo quando stampa
 * il proprietario. Un superadmin che stampa la scheda di un altro
 * professionista non ha alcun collegamento con quel cliente, e nella via "solo
 * token" il client è la service_role, dove `auth.uid()` è NULL: in entrambi i
 * casi la RPC restituiva 0 righe e il report periodico usciva senza le
 * misurazioni remote. La variante `_as_professional` (sito-032, estesa alla
 * service_role dalla sito-033) prende il professionista come parametro.
 *
 * Il titolare è il riferimento corretto anche per chi stampa: il report resta
 * intestato al suo studio (vedi `loadOwnerProfile`), quindi le misurazioni che
 * contiene sono quelle che lui vede.
 */
async function remoteSessions(supabase: SupabaseClient, clientId: string, professionistaId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase.rpc('get_linked_client_sessions_as_professional', {
    p_professional_id: professionistaId,
    p_client_id: clientId,
  })
  if (error) {
    console.error('[report-data] remote sessions rpc error', { clientId, professionistaId, error })
    return []
  }
  return ((data ?? []) as SessionRow[]).map((s) => ({ ...s, client_id: s.client_id ?? clientId }))
}

/** Cliente leggibile dal client dato (RLS o service_role). */
export async function loadClient(supabase: SupabaseClient, clientId: string): Promise<Client | null> {
  const { data } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle<Client>()
  return data ?? null
}

/** Profilo del professionista TITOLARE del cliente (il report resta intestato al suo studio). */
export async function loadOwnerProfile(supabase: SupabaseClient, ownerId: string): Promise<ProfessionalProfile | null> {
  const { data } = await supabase.from('professional_profiles').select('*').eq('id', ownerId).maybeSingle<ProfessionalProfile>()
  return data ?? null
}

/** Misurazione per sessionId: measurement_analytics se c'è, altrimenti la riga di sessions (anche remota). */
export async function loadMeasurementForPrint(supabase: SupabaseClient, sessionId: string, clientId?: string | null): Promise<MeasurementWithNotes | null> {
  const { data: ma } = await supabase.from('measurement_analytics').select('*').eq('session_id', sessionId).maybeSingle<MeasurementAnalytics>()
  const { data: rows } = await selectSessions(supabase, (q, cols) => q.select(cols).eq('id', sessionId).limit(1) as never, 'sessions (stampa misurazione)')
  let s: SessionRow | null = rows?.[0] ?? null
  if (!ma && !s && clientId) {
    // Ripiego raro: chi arriva qui (titolare, superadmin, service_role) legge
    // già la riga direttamente — il titolare per
    // `professional_reads_linked_client_sessions`, il superadmin per
    // `superadmin_read_sessions`, la service_role scavalcando la RLS — quindi
    // di norma `s` è stato trovato sopra. Il titolare della scheda serve alla
    // RPC e lo si chiede qui, dove costa una query sola e solo in questo ramo.
    const { data: owner } = await supabase
      .from('clients')
      .select('professionista_id')
      .eq('id', clientId)
      .maybeSingle<{ professionista_id: string }>()
    s = owner?.professionista_id
      ? (await remoteSessions(supabase, clientId, owner.professionista_id)).find((r) => r.id === sessionId) ?? null
      : null
  }
  if (!ma && !s) return null
  // Se ci sono entrambe le righe vince l'istante della sessione.
  const base = ma ? conIstanteSessione(ma, s) : sessionToMeasurement(s as SessionRow)
  return {
    ...base,
    client_id: base.client_id ?? s?.client_id ?? clientId ?? null,
    notes_professionista: s?.notes_professionista ?? null,
    indicazioni: s?.indicazioni ?? null,
  } as MeasurementWithNotes
}

/**
 * Misurazione immediatamente precedente (per i delta degli score).
 *
 * `beforeIso` è un ISTANTE (da `measuredInstant`), non la colonna grezza. Il
 * confronto avviene sulle sessioni, che portano l'unica colonna corretta su
 * tutto lo storico; `measurement_analytics` serve solo per gli score.
 */
export async function loadPreviousMeasurement(supabase: SupabaseClient, clientId: string, beforeIso: string, excludeSessionId: string): Promise<MeasurementAnalytics | null> {
  const { data: prevSessions } = await supabase
    .from('sessions')
    .select('id, started_at_utc')
    .eq('client_id', clientId)
    .lt('started_at_utc', beforeIso)
    .neq('id', excludeSessionId)
    .order('started_at_utc', { ascending: false, nullsFirst: false })
    .limit(1)
  const prev = (prevSessions as Array<{ id: string; started_at_utc: string | null }> | null)?.[0]
  if (!prev) return null

  const { data } = await supabase
    .from('measurement_analytics')
    .select('session_id, client_id, measured_at, measured_at_utc, tz_offset_minutes, score_stress, score_recupero, score_equilibrio, score_energia, score_modulazione_infiammatoria, score_composito, rmssd, sdnn, mean_hr')
    .eq('session_id', prev.id)
    .limit(1)
  const row = (data as MeasurementAnalytics[] | null)?.[0]
  return row ? conIstanteSessione(row, prev) : null
}

export type PeriodicReportData = {
  client: Client
  professional: ProfessionalProfile | null
  measurements: MeasurementAnalytics[]
}

/** Misurazioni del periodo [dateFrom, dateTo] (yyyy-mm-dd), dirette e remote, con gli score se presenti. */
export async function loadPeriodicReportData(supabase: SupabaseClient, client: Client, dateFrom: string, dateTo: string): Promise<PeriodicReportData> {
  // Il periodo si taglia a mezzanotte ITALIANA: con i confini UTC una
  // misurazione fatta dopo le 22:00 cadeva nel giorno dopo e una fatta prima
  // delle 02:00 nel giorno prima, spostando le righe fuori dal report.
  const { fromIso, toIso } = intervalloGiorniIta(dateFrom, dateTo)

  const [{ data: sessions, error: sErr }, remote] = await Promise.all([
    selectSessions(
      supabase,
      (q, cols) =>
        q
          .select(cols)
          .eq('client_id', client.id)
          .gte('started_at_utc', fromIso)
          .lte('started_at_utc', toIso)
          .order('started_at_utc', { ascending: false, nullsFirst: false }) as never,
      'sessions (report periodico)',
    ),
    remoteSessions(supabase, client.id, client.professionista_id),
  ])
  if (sErr) {
    console.error('[report-data] sessions query error', sErr)
    throw new Error('report_read_failed')
  }
  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toIso).getTime()
  const seen = new Set((sessions ?? []).map((s) => s.id))
  const all: SessionRow[] = [
    ...((sessions ?? []) as SessionRow[]),
    ...remote.filter((s) => !seen.has(s.id) && Number.isFinite(startedMs(s)) && startedMs(s) >= fromMs && startedMs(s) <= toMs),
  ].sort((a, b) => startedMs(b) - startedMs(a))

  let measurements: MeasurementAnalytics[] = []
  if (all.length > 0) {
    const ids = all.map((s) => s.id)
    const { data: ma } = await supabase.from('measurement_analytics').select('*').in('session_id', ids)
    const bySession = new Map<string, MeasurementAnalytics>()
    for (const row of (ma ?? []) as MeasurementAnalytics[]) if (row.session_id) bySession.set(row.session_id, row)
    measurements = all.map((s) => {
      const row = bySession.get(s.id)
      return row ? conIstanteSessione(row, s) : sessionToMeasurement(s)
    })
  }

  const professional = await loadOwnerProfile(supabase, client.professionista_id)
  return { client, professional, measurements }
}

/** Misurazioni del periodo precedente di pari durata (confronto nel report). */
export function previousPeriod(dateFrom: string, dateTo: string): { from: string; to: string } {
  const from = new Date(`${dateFrom}T00:00:00.000Z`)
  const to = new Date(`${dateTo}T00:00:00.000Z`)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
  const prevTo = new Date(from.getTime() - 86400000)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86400000)
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) }
}
