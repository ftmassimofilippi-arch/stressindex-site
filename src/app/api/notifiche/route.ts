import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser, listClients } from '@/lib/dashboard-data'
import { loadNotifications, markNotificationsRead, type NotificationSource } from '@/lib/notifications'
import { alertMessage, alertTypeLabel } from '@/lib/alert-rules'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { num } from '@/lib/format'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Notifiche dietro la campanella della TopBar: gli alert del cron del sito
// uniti agli eventi valutati dall'app. Tutto è filtrato dalla RLS sull'utente
// loggato; titoli e messaggi sono tradotti qui perché il pannello è un
// componente client e non ha il traduttore del namespace `alerts`.
//
// La lettura NON modifica `alerts` né `alert_events`: aggiunge una riga in
// `notification_reads`, per utente. Vedi src/lib/notifications.ts.

// GET /api/notifiche — elenco e conteggio delle non lette.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  const locale = await getRequestLocale(req)
  const [{ items, unread, readsAvailable }, clients, tAlerts] = await Promise.all([
    loadNotifications(),
    listClients(),
    getTranslator(locale, 'alerts'),
  ])

  const nameById = new Map(clients.map((c) => [c.id, `${c.nome ?? ''} ${c.cognome ?? ''}`.trim()]))
  const fmtNum = (v: number) => num(v, Number.isInteger(v) ? 0 : 1, locale)

  return NextResponse.json({
    unread,
    canMarkRead: readsAvailable,
    notifications: items.map((n) => ({
      id: n.id,
      source: n.source,
      clientId: n.client_id,
      clientName: nameById.get(n.client_id) || null,
      title: alertTypeLabel(n.type, tAlerts),
      detail: alertMessage(n, tAlerts, fmtNum),
      severity: n.severity,
      unread: n.unread,
      readAt: n.readAt,
      createdAt: n.created_at,
    })),
  })
}

type MarkBody = { ids?: Array<{ source?: unknown; id?: unknown }> }

// POST /api/notifiche — segna come lette. Corpo `{ ids: [{source, id}] }`
// oppure vuoto per tutte quelle attualmente non lette.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  let body: MarkBody = {}
  try {
    body = (await req.json()) as MarkBody
  } catch {
    // Corpo assente o non JSON: vale come "tutte".
  }

  let ids: Array<{ source: NotificationSource; id: string }> | undefined
  if (Array.isArray(body.ids)) {
    ids = body.ids
      .filter((x): x is { source: NotificationSource; id: string } =>
        typeof x?.id === 'string' && (x?.source === 'cron' || x?.source === 'app'))
      .map((x) => ({ source: x.source, id: x.id }))
    if (ids.length === 0) return apiError('no_notifications', 400)
  }

  const res = await markNotificationsRead(ids)
  if (!res.ok) return apiError(res.error, res.error === 'unauthorized' ? 401 : 503)
  return NextResponse.json({ marked: res.marked, unread: res.unread })
}
