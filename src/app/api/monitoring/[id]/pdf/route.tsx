import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { loadMonitoringForRoute, sanitizeFilename } from '@/lib/monitoring-access'
import { MonitoringPdfDocument } from '@/lib/monitoring-pdf'
import { SleepPdfDocument } from '@/lib/sleep-pdf'
import { isSleepSession } from '@/lib/monitoring-types'
import { dayNumeric } from '@/lib/monitoring-format'
import type { Lang } from '@/lib/monitoring-strings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/monitoring/[id]/pdf?variant=pro|client&lang=it|en|de
// Report PDF del monitoraggio (24h o Sonno) con la stessa struttura e le
// stesse stringhe dei PDF dell'app. `client` = solo nomi semplici ed
// etichette, senza sigle, referenze, Ritmo, Parametri e "Come si calcola".
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url)
  const client = url.searchParams.get('variant') === 'client'
  const langParam = url.searchParams.get('lang')
  const lang: Lang = langParam === 'en' || langParam === 'de' ? langParam : 'it'

  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session, professional } = access

  let pdf: Buffer
  try {
    pdf = await renderToBuffer(
      isSleepSession(session)
        ? <SleepPdfDocument session={session} professional={professional} client={client} lang={lang} />
        : <MonitoringPdfDocument session={session} professional={professional} client={client} lang={lang} />,
    )
  } catch (err) {
    console.error('[monitoring-pdf] render error', err)
    return NextResponse.json({ error: 'Il monitoraggio è stato letto ma il documento non è stato generato. Riprova; se persiste, segnalacelo.' }, { status: 500 })
  }

  const who = sanitizeFilename(session.client_name ?? 'cliente')
  const date = dayNumeric(session.start_time, session.tz_offset_minutes).split('/').reverse().join('-')
  const kind = isSleepSession(session) ? 'Sonno' : 'Monitoraggio'
  const filename = `StressIndex_${kind}_${who}_${date}${client ? '_cliente' : ''}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length.toString(),
      'Cache-Control': 'no-store',
    },
  })
}
