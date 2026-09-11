import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getMonitoringSession, saveEventsFromWeb } from '@/lib/monitoring-data'
import { getCurrentUser, resolveViewingProfessional } from '@/lib/dashboard-data'
import { EVENT_TYPE_LABEL } from '@/lib/monitoring-format'
import type { MonitoringEvent } from '@/lib/monitoring-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PUT /api/monitoring/[id]/events — sostituisce gli eventi di un monitoraggio
// 24h dal sito. Il sito NON ricalcola la reazione: gli eventi nuovi o spostati
// arrivano con response null e la riga viene marcata events_modified_on_web,
// così l'app sa che deve rielaborare.

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
  if (!user) return NextResponse.json({ error: 'Sessione scaduta: ricarica la pagina e accedi di nuovo.' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Eventi non validi' }, { status: 400 })

  const { currentUserId } = await resolveViewingProfessional(undefined)
  const session = await getMonitoringSession(params.id, currentUserId)
  if (!session) return NextResponse.json({ error: 'Monitoraggio non trovato o non accessibile.' }, { status: 404 })
  if (session.monitoring_type === 'sleep') return NextResponse.json({ error: 'Le notti del modulo Sonno non hanno eventi modificabili.' }, { status: 400 })

  const startMs = new Date(session.start_time).getTime()
  const endMs = new Date(session.end_time).getTime()
  const existing = new Map(session.events.map((e) => [e.id, e]))
  const next: MonitoringEvent[] = []
  for (const e of parsed.data.events) {
    const t = new Date(e.timestamp).getTime()
    if (t < startMs || t > endMs) return NextResponse.json({ error: 'Un evento cade fuori dal periodo della registrazione.' }, { status: 400 })
    const prev = existing.get(e.id)
    const untouched = prev && prev.type === e.type && new Date(prev.timestamp).getTime() === t
    next.push({
      id: e.id,
      type: e.type,
      timestamp: new Date(t).toISOString(),
      label: e.label.trim() || EVENT_TYPE_LABEL[e.type],
      note: e.note?.trim() ? e.note.trim() : null,
      // La reazione resta solo se l'evento non è cambiato: mai calcolata qui.
      response: untouched ? prev.response : null,
    })
  }

  const res = await saveEventsFromWeb(session.id, next)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true, events: next })
}
