import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminMonitoringSessions } from '@/lib/admin-monitoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/monitoring — tutti i monitoraggi (24h e sonno) di tutti gli
// utenti, senza finestre. Solo superadmin.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const sessions = await getAdminMonitoringSessions()
    return NextResponse.json({ sessions })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'errore' }, { status: 500 })
  }
}
