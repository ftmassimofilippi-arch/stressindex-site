import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'
import { planEmailChange } from '@/lib/admin-account-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// /api/admin/users/[id]/email — correzione dell'email dell'account auth.
//
// GET  ?email=nuova  → anteprima: vecchia/nuova email, eventuale account che
//                     usa già la nuova email (correzione impossibile), schede
//                     che verranno allineate e schede lasciate come sono.
// POST { email, confirm, motivo } → esegue. `confirm` deve essere uguale alla
//      nuova email (conferma esplicita digitata), `motivo` obbligatorio.
//      Ordine: auth.users (email confermata, nessuna mail di verifica) →
//      profiles.email → schede. Una riga in admin_audit_log con prima/dopo.
// ============================================================================

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const email = req.nextUrl.searchParams.get('email') ?? ''
  const plan = await planEmailChange(createAdminClient(), params.id, email)
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: plan.status })
  return NextResponse.json({ plan })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email : ''
  const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : ''
  const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''
  if (!motivo) return NextResponse.json({ error: 'missing_reason', message: 'Indica il motivo della correzione' }, { status: 400 })

  const admin = createAdminClient()
  const plan = await planEmailChange(admin, params.id, email)
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: plan.status })
  if (confirm !== plan.new_email) {
    return NextResponse.json({ error: 'confirmation_mismatch', message: 'Digita la nuova email per confermare' }, { status: 400 })
  }
  if (plan.conflict) {
    return NextResponse.json(
      { error: 'email_in_use', message: `L'email ${plan.new_email} è già usata dall'account ${plan.conflict.full_name} (${plan.conflict.user_id})`, plan },
      { status: 409 },
    )
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(params.id, { email: plan.new_email, email_confirm: true })
  if (authErr) return NextResponse.json({ error: 'auth_update_failed', message: authErr.message }, { status: 500 })

  const steps: Record<string, unknown> = { auth: 'ok' }
  const { error: profErr } = await admin.from('profiles').update({ email: plan.new_email }).eq('id', params.id)
  steps.profiles = profErr ? profErr.message : 'ok'

  const cardIds = plan.cards_to_update.map((c) => c.id)
  if (cardIds.length > 0) {
    const { error: cardErr } = await admin.from('clients').update({ email: plan.new_email }).in('id', cardIds)
    steps.clients = cardErr ? cardErr.message : `ok (${cardIds.length})`
  } else {
    steps.clients = 'nessuna scheda'
  }

  await logAdminAction(admin, guard.user, {
    action: 'change_account_email',
    target_type: 'user',
    target_id: params.id,
    details: {
      prima: plan.old_email,
      dopo: plan.new_email,
      motivo,
      schede_aggiornate: plan.cards_to_update.map((c) => ({ id: c.id, professionista_id: c.professionista_id, motivo: c.reason })),
      schede_non_toccate: plan.cards_not_touched.map((c) => ({ id: c.id, professionista_id: c.professionista_id })),
      esito: steps,
    },
  })

  const partial = profErr || (typeof steps.clients === 'string' && !String(steps.clients).startsWith('ok') && steps.clients !== 'nessuna scheda')
  return NextResponse.json({ ok: !partial, partial: !!partial, steps, plan }, { status: partial ? 207 : 200 })
}
