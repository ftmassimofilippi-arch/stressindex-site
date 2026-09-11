import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminMonitoringForUser } from '@/lib/admin-monitoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/[id]/monitoring — monitoraggi registrati dall'utente
// o con lui come professionista di riferimento. Solo superadmin.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const sessions = await getAdminMonitoringForUser(params.id)
    return NextResponse.json({ sessions })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'errore' }, { status: 500 })
  }
}
