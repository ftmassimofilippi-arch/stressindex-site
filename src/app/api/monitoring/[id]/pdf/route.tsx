import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { isLocale } from '@/i18n/routing'
import { loadMonitoringForRoute, sanitizeFilename } from '@/lib/monitoring-access'
import { MonitoringPdfDocument } from '@/lib/monitoring-pdf'
import { SleepPdfDocument } from '@/lib/sleep-pdf'
import { isSleepSession } from '@/lib/monitoring-types'
import { dayNumeric } from '@/lib/monitoring-format'
import { monT, type Lang } from '@/lib/monitoring-strings'
import { sleepT } from '@/lib/sleep-strings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/monitoring/[id]/pdf?variant=pro|client&lang=it|en|de
// Report PDF del monitoraggio (24h o Sonno) con la stessa struttura e le
// stesse stringhe dei PDF dell'app. `client` = solo nomi semplici ed
// etichette, senza sigle, referenze, Ritmo, Parametri e "Come si calcola".
// Senza `lang` vale la lingua della richiesta (`?locale=`, cookie, Referer).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url)
  const client = url.searchParams.get('variant') === 'client'
  const langParam = url.searchParams.get('lang')
  const lang: Lang = isLocale(langParam) ? langParam : await getRequestLocale(req)
  const tf = await getTranslator(lang, 'monitoring')

  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session, professional } = access

  let pdf: Buffer
  try {
    pdf = await renderToBuffer(
      isSleepSession(session)
        ? <SleepPdfDocument session={session} professional={professional} client={client} lang={lang} tf={tf} />
        : <MonitoringPdfDocument session={session} professional={professional} client={client} lang={lang} tf={tf} />,
    )
  } catch (err) {
    console.error('[monitoring-pdf] render error', err)
    return apiError('monitoring_pdf_not_generated', 500)
  }

  const who = sanitizeFilename(session.client_name ?? tf('client'))
  const date = dayNumeric(session.start_time, session.tz_offset_minutes).split('/').reverse().join('-')
  const kind = sanitizeFilename(isSleepSession(session) ? sleepT('module', lang) : monT('module', lang))
  const filename = `StressIndex_${kind}_${who}_${date}${client ? `_${sanitizeFilename(tf('files.clientSuffix'))}` : ''}.pdf`
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
