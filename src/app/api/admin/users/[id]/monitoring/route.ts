import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { getAdminMonitoringForUser } from '@/lib/admin-monitoring'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/users/[id]/monitoring — monitoraggi registrati dall'utente
// o con lui come professionista di riferimento. Solo superadmin.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const t = await getTranslator(await getRequestLocale(req), 'admin.sessionsApi')
    const sessions = await getAdminMonitoringForUser(params.id, t('client'))
    return NextResponse.json({ sessions })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'generic' }, { status: 500 })
  }
}
