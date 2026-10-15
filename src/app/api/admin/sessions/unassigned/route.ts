import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminUnassignedSessions } from '@/lib/admin-data'
import { reportDataError } from '@/lib/data-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_DAYS = 365

// GET /api/admin/sessions/unassigned?days=30 — misurazioni (`sessions`) con
// client_id nullo negli ultimi N giorni (default 30, massimo 365), con account
// che ha registrato, tipo, durata, client_nome e scheda deducibile per il link.
// Solo elenco, nessuna azione automatica. Nessun errore muto (500 con codice).
export async function GET(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const raw = new URL(req.url).searchParams.get('days')
  const days = raw === null ? 30 : Number(raw)
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return apiError('invalid_body', 400, { max: MAX_DAYS })
  try {
    const sessions = await getAdminUnassignedSessions(days)
    return NextResponse.json({ sessions, days, total: sessions.length })
  } catch (e) {
    const err = reportDataError('api/admin/sessions/unassigned', e instanceof Error ? e : { message: String(e) })
    return apiError('generic', 500, { detail: err.message })
  }
}
