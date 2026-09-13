import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { setPlanViaSubscription } from '@/lib/admin-commerciale'

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
  if (!userId) return NextResponse.json({ error: 'missing_user' }, { status: 400 })
  if (plan !== 'base' && plan !== 'pro') {
    return NextResponse.json({ error: 'invalid_plan' }, { status: 400 })
  }

  const res = await setPlanViaSubscription(createAdminClient(), guard.user, userId, plan)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ profile: { id: userId, plan } })
}
