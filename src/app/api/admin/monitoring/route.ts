import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminMonitoringSessions } from '@/lib/admin-monitoring'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/monitoring — tutti i monitoraggi (24h e sonno) di tutti gli
// utenti, senza finestre. Solo superadmin.
export async function GET(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const t = await getTranslator(await getRequestLocale(req), 'admin.sessionsApi')
    const sessions = await getAdminMonitoringSessions(t('client'))
    return NextResponse.json({ sessions })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'generic' }, { status: 500 })
  }
}
