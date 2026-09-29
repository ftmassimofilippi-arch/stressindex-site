import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api-error'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'
import { getMonitoringSession, saveEventsFromWeb } from '@/lib/monitoring-data'
import { getCurrentUser, resolveViewingProfessional } from '@/lib/dashboard-data'
import { eventTypeLabel } from '@/lib/monitoring-format'
import { getMyAccountAccess, hasModule } from '@/lib/account-access'
import type { MonitoringEvent } from '@/lib/monitoring-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PUT /api/monitoring/[id]/events — sostituisce gli eventi di un monitoraggio
// 24h dal sito. Il sito NON ricalcola la reazione: gli eventi nuovi o spostati
// arrivano con response null e la riga viene marcata events_modified_on_web,
// così l'app sa che deve rielaborare. L'etichetta di default di un evento
// senza testo segue la lingua della richiesta.

const EventSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['coffee', 'meal', 'alcohol', 'training', 'stress', 'sleep_start', 'wake_up', 'supplement', 'relax', 'other']),
  timestamp: z.string().datetime({ offset: true }),
  label: z.string().max(120),
  note: z.string().max(500).nullable().optional(),
})

const BodySchema = z.object({ events: z.array(EventSchema).max(200) })

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return apiError('session_expired', 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('invalid_json', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return apiError('monitoring_invalid_events', 400)

  const { currentUserId } = await resolveViewingProfessional(undefined)
  const session = await getMonitoringSession(params.id, currentUserId)
  if (!session) return apiError('monitoring_not_found', 404)
  if (session.monitoring_type === 'sleep') return apiError('monitoring_sleep_events_readonly', 400)
  if (!hasModule(await getMyAccountAccess(), 'monitoring')) return apiError('monitoring_module_not_active', 403)

  const locale = await getRequestLocale(req)
  const t = await getTranslator(locale, 'monitoring')
  const startMs = new Date(session.start_time).getTime()
  const endMs = new Date(session.end_time).getTime()
  const existing = new Map(session.events.map((e) => [e.id, e]))
  const next: MonitoringEvent[] = []
  for (const e of parsed.data.events) {
    const at = new Date(e.timestamp).getTime()
    if (at < startMs || at > endMs) return apiError('monitoring_event_outside_period', 400)
    const prev = existing.get(e.id)
    const untouched = prev && prev.type === e.type && new Date(prev.timestamp).getTime() === at
    next.push({
      id: e.id,
      type: e.type,
      timestamp: new Date(at).toISOString(),
      label: e.label.trim() || eventTypeLabel(e.type, t),
      note: e.note?.trim() ? e.note.trim() : null,
      // La reazione resta solo se l'evento non è cambiato: mai calcolata qui.
      response: untouched ? prev.response : null,
    })
  }

  const res = await saveEventsFromWeb(session.id, next)
  if (!res.ok) return apiError('monitoring_save_failed', 500, { detail: res.error })
  return NextResponse.json({ ok: true, events: next })
}
