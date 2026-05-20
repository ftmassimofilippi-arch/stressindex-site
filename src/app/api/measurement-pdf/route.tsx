import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase-server'
import { MeasurementPdfDocument } from '@/lib/measurement-pdf'
import type { Client, MeasurementAnalytics, MeasurementWithSession, ProfessionalProfile } from '@/lib/types'

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
  notes_professionista: string | null
  indicazioni: string | null
}

// Costruisce una MeasurementAnalytics minimale partendo da sessions.hrv_data,
// come fallback quando la riga measurement_analytics manca (fire-and-forget Flutter).
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
    orthostatic_data: null,
    coherence_data: null,
  }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export async function POST(req: Request) {
  let body: { sessionId?: string; clientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { sessionId, clientId } = body
  if (!sessionId || !clientId) {
    return NextResponse.json({ error: 'sessionId e clientId obbligatori' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // 1. Carica sessione + verifica proprietà professionista.
  //    RLS filtra già su professionista_id = auth.uid(), quindi una riga = ownership ok.
  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('id, client_id, professionista_id, started_at, created_at, duration_seconds, hrv_data, test_type, tags, notes_professionista, indicazioni')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>()

  if (sessErr) {
    console.error('[measurement-pdf] sessions query error', sessErr)
    return NextResponse.json({ error: 'Errore lettura sessione' }, { status: 500 })
  }
  if (!session) {
    return NextResponse.json({ error: 'Sessione non trovata' }, { status: 404 })
  }
  if (session.professionista_id !== user.id) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }
  if (session.client_id !== clientId) {
    return NextResponse.json({ error: 'clientId non corrispondente alla sessione' }, { status: 400 })
  }

  // 2. Carica measurement_analytics (preferito, contiene gli score proprietari).
  const { data: ma } = await supabase
    .from('measurement_analytics')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  const base: MeasurementAnalytics = ma
    ? (ma as MeasurementAnalytics)
    : sessionToMeasurement(session)

  const measurement: MeasurementWithSession = {
    ...base,
    notes_professionista: session.notes_professionista ?? null,
    indicazioni: session.indicazioni ?? null,
  }

  // 3. Cliente e profilo professionista.
  const [{ data: client }, { data: professional }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle<Client>(),
    supabase.from('professional_profiles').select('*').eq('id', user.id).maybeSingle<ProfessionalProfile>(),
  ])

  if (!client) {
    return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
  }

  // 4. Renderizza PDF.
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <MeasurementPdfDocument
        measurement={measurement}
        client={client}
        professional={professional ?? null}
      />,
    )
  } catch (err) {
    console.error('[measurement-pdf] render error', err)
    return NextResponse.json({ error: 'Errore generazione PDF' }, { status: 500 })
  }

  const dateStr = (() => {
    try {
      return format(parseISO(measurement.measured_at), 'yyyy-MM-dd')
    } catch {
      return format(new Date(), 'yyyy-MM-dd')
    }
  })()
  const cognome = sanitizeFilename(client.cognome ?? 'cliente')
  const nome = sanitizeFilename(client.nome ?? '')
  const filename = `StressIndex_${cognome}${nome ? `_${nome}` : ''}_${dateStr}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
      'Cache-Control': 'no-store',
    },
  })
}
