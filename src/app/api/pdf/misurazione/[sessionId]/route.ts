import { createClient } from '@/lib/supabase-server'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { loadAuthorizedClient } from '@/lib/measurement-access'
import { loadMeasurementForPrint } from '@/lib/report-data'
import { measuredInstant } from '@/lib/format'
import { dateStamp, pdfFromPrintPage, proxyLegacy } from '@/lib/pdf-route'
import { pdfLegacyEnabled, sanitizeFilename } from '@/lib/pdf-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/pdf/misurazione/[sessionId]?clientId=&locale=
// PDF della misurazione: stampa della pagina /stampa/misurazione/[sessionId]
// con Chrome headless (stessi componenti della dashboard). Con PDF_LEGACY=true
// inoltra al vecchio generatore react-pdf (/api/measurement-pdf).
export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  const locale = await getRequestLocale(req)
  const url = new URL(req.url)
  const clientId = url.searchParams.get('clientId')
  if (!clientId) return apiError('pdf_missing_params', 400)

  if (pdfLegacyEnabled()) {
    return proxyLegacy(req, `/api/measurement-pdf?locale=${locale}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: params.sessionId, clientId }),
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('session_expired', 401)

  // Permessi: la RLS su clients decide (proprietario, team, superadmin in sola lettura).
  const access = await loadAuthorizedClient(supabase, clientId)
  if ('denied' in access) return apiError(access.denied.error, access.denied.status)
  const measurement = await loadMeasurementForPrint(supabase, params.sessionId, clientId)
  if (!measurement) return apiError('measurement_not_found', 404)

  const t = await getTranslator(locale, 'print')
  const tPdf = await getTranslator(locale, 'pdf.common')
  const cognome = sanitizeFilename(access.client.cognome ?? tPdf('clientFallback'))
  const filename = `StressIndex_${cognome}_${sanitizeFilename(t('measurement.fileType'))}_${dateStamp(measuredInstant(measurement))}.pdf`

  return pdfFromPrintPage({
    req,
    locale,
    path: `/stampa/misurazione/${params.sessionId}`,
    query: { clientId },
    token: { kind: 'measurement', id: params.sessionId, userId: user.id },
    filename,
  })
}
