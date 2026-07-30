import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import type { PostgrestError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { MeasurementPdfDocument } from '@/lib/measurement-pdf'
import { loadAuthorizedClient, sameId } from '@/lib/measurement-access'
import { findRemoteMeasurement } from '@/lib/remote-sessions'
import { selectWithMissingColumnFallback } from '@/lib/safe-select'
import { toStr } from '@/lib/format'
import type { MeasurementAnalytics, MeasurementWithSession, ProfessionalProfile } from '@/lib/types'

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
    return NextResponse.json({ error: 'Sessione scaduta: ricarica la pagina e accedi di nuovo.' }, { status: 401 })
  }

  // 1. Cliente: la RLS decide chi può vederlo (proprietario, team, superadmin
  //    in sola lettura). Riga restituita = lettore autorizzato su questi dati.
  const access = await loadAuthorizedClient(supabase, clientId)
  if ('denied' in access) {
    return NextResponse.json({ error: access.denied.error }, { status: access.denied.status })
  }
  const { client } = access

  // 2. Sessione. Lettura resiliente alle colonne mancanti: una colonna assente
  //    nel database non deve impedire la generazione del PDF.
  const { data: sessionRows, error: sessErr } = await selectWithMissingColumnFallback<SessionRow>(
    ['id', 'client_id', 'professionista_id', 'started_at', 'created_at', 'duration_seconds', 'hrv_data', 'test_type', 'tags', 'notes_professionista', 'indicazioni'],
    (cols) =>
      supabase.from('sessions').select(cols).eq('id', sessionId).limit(1) as unknown as PromiseLike<{
        data: SessionRow[] | null
        error: PostgrestError | null
      }>,
    { label: 'sessions (PDF misurazione)', required: ['id'] },
  )
  if (sessErr) {
    console.error('[measurement-pdf] sessions query error', sessErr)
    return NextResponse.json({ error: 'Non è stato possibile leggere la misurazione. Riprova tra qualche istante.' }, { status: 500 })
  }

  const visible: SessionRow | null = sessionRows?.[0] ?? null
  let session: SessionRow | null = null
  let remoteAnalytics: MeasurementAnalytics | null = null

  if (visible && sameId(visible.client_id, client.id)) {
    // Misurazione fatta in studio: la sessione porta già l'id anagrafica.
    session = visible
  } else {
    // Due casi finiscono qui:
    //  • misurazione remota (client_id NULL, professionista_id = uid del
    //    CLIENTE): la RLS la nasconde, oppure la mostra al superadmin ma senza
    //    alcun aggancio all'anagrafica;
    //  • sessione di un ALTRO cliente: il ponte non la restituisce, quindi
    //    l'accesso resta negato.
    const remote = await findRemoteMeasurement(client.professionista_id, client.id, sessionId)
    if (remote) {
      // Le note sono opzionali sulla riga remota (colonne assenti su alcuni DB).
      session = {
        ...remote.session,
        notes_professionista: remote.session.notes_professionista ?? null,
        indicazioni: remote.session.indicazioni ?? null,
      }
      remoteAnalytics = remote.analytics
    }
  }

  if (!session) {
    if (visible) {
      console.warn('[measurement-pdf] sessione non appartenente al cliente richiesto', {
        sessionId,
        clientId,
        sessionClientId: visible.client_id,
      })
      return NextResponse.json(
        { error: 'Questa misurazione non risulta collegata al cliente selezionato: non è possibile generare un PDF a suo nome.' },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: 'Misurazione non trovata. Se è stata registrata dal cliente dalla sua app, verifica che il collegamento con lo studio sia ancora attivo.' },
      { status: 404 },
    )
  }

  // 3. measurement_analytics (preferito: contiene gli score proprietari).
  //    Per le sessioni remote la RLS la nasconde come la sessione, quindi
  //    riusiamo la riga già letta dal ponte.
  const { data: ma } = await supabase
    .from('measurement_analytics')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  const base: MeasurementAnalytics =
    (ma as MeasurementAnalytics | null) ?? remoteAnalytics ?? sessionToMeasurement(session)

  const measurement: MeasurementWithSession = {
    ...base,
    notes_professionista: session.notes_professionista ?? null,
    indicazioni: session.indicazioni ?? null,
  }

  // 4. Intestazione del PDF: lo studio è quello del cliente, non l'utente
  //    loggato — altrimenti nella vista superadmin il documento uscirebbe
  //    firmato dall'osservatore invece che dal professionista titolare.
  const { data: professional } = await supabase
    .from('professional_profiles')
    .select('*')
    .eq('id', client.professionista_id)
    .maybeSingle<ProfessionalProfile>()

  // 5. Renderizza PDF.
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
    return NextResponse.json({ error: 'La misurazione è stata trovata ma il documento non è stato generato. Riprova; se persiste, segnalacelo.' }, { status: 500 })
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
