import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient, hasServiceRole } from '@/lib/supabase-admin'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { loadMonitoringForRoute } from '@/lib/monitoring-access'
import { isSleepSession, type MonitoringSession } from '@/lib/monitoring-types'
import { dayNumeric } from '@/lib/monitoring-format'
import { pdfFromPrintPage, proxyLegacy } from '@/lib/pdf-route'
import { pdfLegacyEnabled, sanitizeFilename } from '@/lib/pdf-render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET /api/pdf/monitoraggio/[id]?variant=pro|client&locale=
// PDF del monitoraggio (24h o Sonno): stampa della pagina
// /stampa/monitoraggio/[id] con Chrome headless (stessi componenti della
// dashboard). Con PDF_LEGACY=true inoltra al vecchio generatore react-pdf
// (/api/monitoring/[id]/pdf). La variante `client` per ora omette solo le
// sezioni riservate al professionista (Ritmo, Parametri, "Come si calcola").
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const locale = await getRequestLocale(req)
  const url = new URL(req.url)
  const variant = url.searchParams.get('variant') === 'client' ? 'client' : 'pro'

  if (pdfLegacyEnabled()) {
    return proxyLegacy(req, `/api/monitoring/${params.id}/pdf?variant=${variant}&lang=${locale}`, { method: 'GET' })
  }

  // Permessi: utente loggato + riga leggibile (RLS o ponte service_role) + modulo attivo.
  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session, userId } = access

  const t = await getTranslator(locale, 'print')
  const tMon = await getTranslator(locale, 'monitoring')
  const tPdf = await getTranslator(locale, 'pdf.common')
  const cognome = sanitizeFilename((await clientSurname(session)) ?? tPdf('clientFallback'))
  const kind = sanitizeFilename(isSleepSession(session) ? t('monitoring.fileTypeSleep') : t('monitoring.fileType24h'))
  const date = dayNumeric(session.start_time, session.tz_offset_minutes).split('/').reverse().join('-')
  const suffix = variant === 'client' ? `_${sanitizeFilename(tMon('files.clientSuffix'))}` : ''
  const filename = `StressIndex_${cognome}_${kind}_${date}${suffix}.pdf`

  return pdfFromPrintPage({
    req,
    locale,
    path: `/stampa/monitoraggio/${params.id}`,
    query: { variant },
    token: { kind: 'monitoring', id: params.id, userId },
    filename,
  })
}

/** Cognome del cliente per il nome del file: dalla riga clients (già autorizzata), altrimenti dall'ultima parola del nome. */
async function clientSurname(session: MonitoringSession): Promise<string | null> {
  if (session.client_id) {
    const db: SupabaseClient = hasServiceRole() ? createAdminClient() : ((await createClient()) as unknown as SupabaseClient)
    const { data } = await db.from('clients').select('cognome').eq('id', session.client_id).maybeSingle<{ cognome: string | null }>()
    if (data?.cognome?.trim()) return data.cognome.trim()
  }
  const parts = (session.client_name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : null
}
