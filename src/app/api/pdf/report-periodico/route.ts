import { createClient } from '@/lib/supabase-server'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { loadAuthorizedClient } from '@/lib/measurement-access'
import { loadPeriodicReportData } from '@/lib/report-data'
import { pdfFromPrintPage, proxyLegacy } from '@/lib/pdf-route'
import { pdfLegacyEnabled, sanitizeFilename } from '@/lib/pdf-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// GET /api/pdf/report-periodico?clientId=&from=yyyy-mm-dd&to=yyyy-mm-dd&locale=
// Report periodico: stampa di /stampa/report-periodico con Chrome headless.
// Con PDF_LEGACY=true inoltra al vecchio generatore (/api/client-report).
export async function GET(req: Request) {
  const locale = await getRequestLocale(req)
  const url = new URL(req.url)
  const clientId = url.searchParams.get('clientId')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (!clientId || !from || !to) return apiError('pdf_missing_params', 400)
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) return apiError('invalid_date_format', 400)
  if (from > to) return apiError('invalid_date_range', 400)

  if (pdfLegacyEnabled()) {
    return proxyLegacy(req, `/api/client-report?locale=${locale}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, dateFrom: from, dateTo: to }),
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('session_expired', 401)

  const access = await loadAuthorizedClient(supabase, clientId)
  if ('denied' in access) return apiError(access.denied.error, access.denied.status)

  // Conteggio per l'intestazione X-Measurement-Count (usata dalla tab Report).
  let count = 0
  try {
    count = (await loadPeriodicReportData(supabase, access.client, from, to)).measurements.length
  } catch {
    return apiError('report_read_failed', 500)
  }

  const t = await getTranslator(locale, 'print')
  const tPdf = await getTranslator(locale, 'pdf.common')
  const cognome = sanitizeFilename(access.client.cognome ?? tPdf('clientFallback'))
  const filename = `StressIndex_${cognome}_${sanitizeFilename(t('report.fileType'))}_${from}_${to}.pdf`

  return pdfFromPrintPage({
    req,
    locale,
    path: '/stampa/report-periodico',
    query: { clientId, from, to },
    token: { kind: 'report', id: `${clientId}:${from}:${to}`, userId: user.id },
    filename,
    extraHeaders: { 'X-Measurement-Count': String(count) },
  })
}
