import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase-server'
import { ClientReportPdfDocument } from '@/lib/client-report-pdf'
import { loadAuthorizedClient } from '@/lib/measurement-access'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { loadPeriodicReportData } from '@/lib/report-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Gli errori escono come CODICE (`errors.api.<codice>` nei messaggi): il
// componente li traduce con `apiErrorMessage`. Vedi src/lib/api-error.ts.
export async function POST(req: Request) {
  // Lingua: `?locale=` in query, poi cookie / Referer / Accept-Language.
  const locale = await getRequestLocale(req)

  let body: { clientId?: string; dateFrom?: string; dateTo?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('invalid_json', 400)
  }

  const { clientId, dateFrom, dateTo } = body
  if (!clientId || !dateFrom || !dateTo) {
    return apiError('pdf_missing_params', 400)
  }
  if (!ISO_DATE.test(dateFrom) || !ISO_DATE.test(dateTo)) {
    return apiError('invalid_date_format', 400)
  }
  if (dateFrom > dateTo) {
    return apiError('invalid_date_range', 400)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return apiError('session_expired', 401)
  }

  // Autorizzazione: la RLS di `clients` è l'unico giudice. Il confronto
  // applicativo `client.professionista_id !== user.id` che stava qui negava il
  // report a superadmin e owner/admin di organizzazione, che la RLS autorizza
  // esplicitamente a leggere in sola lettura. Vedi lib/measurement-access.ts.
  const access = await loadAuthorizedClient(supabase, clientId)
  if ('denied' in access) {
    return apiError(access.denied.error, access.denied.status)
  }
  const { client } = access

  let measurements
  let professional
  try {
    ;({ measurements, professional } = await loadPeriodicReportData(supabase, client, dateFrom, dateTo))
  } catch {
    return apiError('report_read_failed', 500)
  }

  // 4. Renderizza PDF nella lingua della richiesta. I componenti react-pdf
  //    non stanno nell'albero next-intl: ricevono i traduttori come prop.
  const t = await getTranslator(locale, 'pdf')
  const tScores = await getTranslator(locale, 'scores')
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <ClientReportPdfDocument
        client={client}
        professional={professional ?? null}
        measurements={measurements}
        dateFrom={dateFrom}
        dateTo={dateTo}
        t={t}
        tScores={tScores}
        locale={locale}
      />,
    )
  } catch (err) {
    console.error('[client-report] render error', err)
    return apiError('report_render_failed', 500)
  }

  // Nome file: prefisso "StressIndex_" invariato in tutte le lingue.
  const cognome = sanitizeFilename(client.cognome ?? t('common.clientFallback'))
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
