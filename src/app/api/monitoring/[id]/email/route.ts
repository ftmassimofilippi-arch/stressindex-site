import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { createClient } from '@/lib/supabase-server'
import { loadMonitoringForRoute } from '@/lib/monitoring-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/monitoring/[id]/email — "Invia al cliente".
// Riusa l'infrastruttura messaggi del sito (tabella `messages`, come
// MessageComposer): il messaggio viene archiviato in cronologia con il link
// al PDF cliente. La consegna email vera passa dalla Edge Function
// `send-message` (Resend) ancora da realizzare: finché non c'è, il cliente
// NON riceve una email e la riga resta delivered=false. Nessuna simulazione
// di invio. Oggetto e corpo arrivano dal form (già nella lingua della
// pagina); la riga aggiunta e il link al PDF seguono la lingua della richiesta.

const Body = z.object({ subject: z.string().min(1).max(200), content: z.string().min(1).max(5000) })

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const locale = await getRequestLocale(req)
  const t = await getTranslator(locale, 'monitoring')
  const access = await loadMonitoringForRoute(params.id)
  if (access.error) return access.error
  const { session, userId } = access
  if (!session.client_id) return apiError('monitoring_no_client', 400)

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('monitoring_email_fields_required', 400)

  const origin = new URL(req.url).origin
  const pdfLink = `${origin}/api/monitoring/${session.id}/pdf?variant=client&locale=${locale}`
  const content = `${parsed.data.content.trim()}\n\n${t('email.pdfLink')}: ${pdfLink}`

  const supabase = await createClient()
  const { error } = await supabase.from('messages').insert({
    professional_id: session.professionista_id ?? userId,
    client_id: session.client_id,
    subject: parsed.data.subject.trim(),
    content,
    channel: 'email',
    delivered: false,
  })
  if (error) return apiError('monitoring_save_failed', 500, { detail: error.message })
  return NextResponse.json({
    ok: true,
    code: 'monitoring_email_archived',
    message: t('email.routeArchived'),
  })
}
