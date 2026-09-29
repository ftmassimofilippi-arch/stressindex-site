import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { setPlanViaSubscription } from '@/lib/admin-commerciale'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/admin/plan — cambia il piano ('base' | 'pro') di un professionista.
// Riservato al superadmin. Dalla migration 024 passa da admin_set_subscription
// (abbonamenti + storico + admin_audit_log; profiles.plan è la copia legacy).
export async function PATCH(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const userId = typeof body?.userId === 'string' ? body.userId : null
  const plan = body?.plan
  if (!userId) return apiError('missing_user', 400)
  if (plan !== 'base' && plan !== 'pro') {
    return apiError('invalid_plan', 400)
  }

  const t = await getTranslator(await getRequestLocale(req), 'admin.planToggle')
  const res = await setPlanViaSubscription(createAdminClient(), guard.user, userId, plan, t('quickChangeReason'))
  if (!res.ok) return apiError(res.error, res.status)
  return NextResponse.json({ profile: { id: userId, plan } })
}
