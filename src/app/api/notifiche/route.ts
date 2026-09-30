import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser, listAlerts, listClients } from '@/lib/dashboard-data'
import { listAlertEvents } from '@/lib/alert-rules-server'
import { alertMessage, alertTypeLabel, mergeAlerts } from '@/lib/alert-rules'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { num } from '@/lib/format'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/notifiche — elenco delle notifiche dietro la campanella della
// TopBar: gli alert del cron del sito uniti agli eventi valutati dall'app
// (alert_events), nella stessa fusione usata dalla home. Fino a qui la
// campanella mostrava solo il contatore e non si poteva aprire.
//
// Tutto è già filtrato dalla RLS sull'utente loggato; titoli e messaggi sono
// tradotti qui perché il pannello è un componente client e non ha il traduttore
// del namespace `alerts`.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  const locale = await getRequestLocale(req)
  const [cronAlerts, appEvents, clients, tAlerts] = await Promise.all([
    listAlerts({ status: ['new', 'seen'], limit: 30 }),
    listAlertEvents({ days: 30, limit: 30 }),
    listClients(),
    getTranslator(locale, 'alerts'),
  ])

  const merged = mergeAlerts(cronAlerts, appEvents, 30)
  const nameById = new Map(clients.map((c) => [c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim()]))
  const fmtNum = (v: number) => num(v, Number.isInteger(v) ? 0 : 1, locale)

  return NextResponse.json({
    unread: merged.filter((a) => a.status === 'new').length,
    notifications: merged.map((a) => ({
      id: a.id,
      clientId: a.client_id,
      clientName: nameById.get(a.client_id) || null,
      title: alertTypeLabel(a.type, tAlerts),
      detail: alertMessage(a, tAlerts, fmtNum),
      severity: a.severity,
      unread: a.status === 'new',
      createdAt: a.created_at,
    })),
  })
}
