import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { ClientReportPdfDocument } from '@/lib/client-report-pdf'
import { loadAuthorizedClient } from '@/lib/measurement-access'
import { selectWithMissingColumnFallback } from '@/lib/safe-select'
import { toStr } from '@/lib/format'
import type { MeasurementAnalytics, ProfessionalProfile } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SessionRow = {
  id: string
  client_id: string
  professionista_id: string
  started_at: string | null
  created_at: string | null
  duration_seconds: number | null
  hrv_data: Record<string, unknown> | null
  test_type: string | null
  tags: string[] | null
}

// Stessa logica di sessions → MeasurementAnalytics usata in dashboard-data.ts.
// Replica qui per evitare di importare dipendenze server di altre rotte.
function sessionToMeasurement(s: SessionRow): MeasurementAnalytics {
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

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: Request) {
  let body: { clientId?: string; dateFrom?: string; dateTo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clientId, dateFrom, dateTo } = body
  if (!clientId || !dateFrom || !dateTo) {
    return NextResponse.json({ error: 'clientId, dateFrom e dateTo obbligatori' }, { status: 400 })
  }
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) {
    return NextResponse.json({ error: 'Date in formato YYYY-MM-DD' }, { status: 400 })
  }
  if (dateFrom > dateTo) {
    return NextResponse.json({ error: 'dateFrom deve precedere dateTo' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sessione scaduta: ricarica la pagina e accedi di nuovo.' }, { status: 401 })
  }

  // Autorizzazione: la RLS di `clients` è l'unico giudice. Il confronto
  // applicativo `client.professionista_id !== user.id` che stava qui negava il
  // report a superadmin e owner/admin di organizzazione, che la RLS autorizza
  // esplicitamente a leggere in sola lettura. Vedi lib/measurement-access.ts.
  const access = await loadAuthorizedClient(supabase, clientId)
  if ('denied' in access) {
    return NextResponse.json({ error: access.denied.error }, { status: access.denied.status })
  }
  const { client } = access

  // Intervallo: dateFrom 00:00 → dateTo 23:59:59.999
  const fromIso = `${dateFrom}T00:00:00.000Z`
  const toIso = `${dateTo}T23:59:59.999Z`

  // 1. Sessioni nel periodo (fonte autoritativa).
  //    Resiliente alle colonne mancanti: una colonna non ancora presente nel
  //    database non deve svuotare l'intero report.
  const { data: sessions, error: sErr } = await selectWithMissingColumnFallback<SessionRow>(
    ['id', 'client_id', 'professionista_id', 'started_at', 'created_at', 'duration_seconds', 'hrv_data', 'test_type', 'tags'],
    (cols) =>
      supabase
        .from('sessions')
        .select(cols)
        .eq('client_id', clientId)
        .gte('started_at_utc', fromIso)
        .lte('started_at_utc', toIso)
        .order('started_at_utc', { ascending: false, nullsFirst: false }) as unknown as PromiseLike<{
        data: SessionRow[] | null
        error: PostgrestError | null
      }>,
    { label: 'sessions (report periodico)', required: ['id'] },
  )
  if (sErr) {
    console.error('[client-report] sessions query error', sErr)
    return NextResponse.json({ error: 'Non è stato possibile leggere le misurazioni del periodo. Riprova tra qualche istante.' }, { status: 500 })
  }

  let measurements: MeasurementAnalytics[] = []
  if (sessions && sessions.length > 0) {
    const ids = sessions.map((s) => s.id as string)
    // 2. measurement_analytics (arricchimento con score proprietari).
    const { data: ma } = await supabase
      .from('measurement_analytics')
      .select('*')
      .in('session_id', ids)
    const maBySession = new Map<string, MeasurementAnalytics>()
    for (const row of (ma ?? []) as MeasurementAnalytics[]) {
      if (row.session_id) maBySession.set(row.session_id, row)
    }
    measurements = (sessions as SessionRow[]).map(
      (s) => maBySession.get(s.id) ?? sessionToMeasurement(s),
    )
  }

  // 3. Profilo professionista: quello TITOLARE del cliente, non l'utente
  //    loggato — nella vista in sola lettura il report deve restare intestato
  //    allo studio del cliente.
  const { data: professional } = await supabase
    .from('professional_profiles')
    .select('*')
    .eq('id', client.professionista_id)
    .maybeSingle<ProfessionalProfile>()

  // 4. Renderizza PDF.
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <ClientReportPdfDocument
        client={client}
        professional={professional ?? null}
        measurements={measurements}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />,
    )
  } catch (err) {
    console.error('[client-report] render error', err)
    return NextResponse.json({ error: 'I dati sono stati letti ma il documento non è stato generato. Riprova; se persiste, segnalacelo.' }, { status: 500 })
  }

  const cognome = sanitizeFilename(client.cognome ?? 'cliente')
  const nome = sanitizeFilename(client.nome ?? '')
  const filename = `StressIndex_Report_${cognome}${nome ? `_${nome}` : ''}_${dateFrom}_${dateTo}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'no-store',
      'X-Measurement-Count': measurements.length.toString(),
    },
  })
}
