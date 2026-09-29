import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'
import { setPlanViaSubscription } from '@/lib/admin-commerciale'
import { getRequestLocale, getTranslator } from '@/lib/i18n-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/admin/users/[id] — aggiorna anagrafica / ruolo / piano.
// Body (tutti opzionali): { nome, cognome, data_nascita, sesso, role, plan }
// (l'email ha la sua route: ./email)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const userId = params.id
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  // Campi del profilo aggiornabili.
  const profileUpdate: Record<string, unknown> = {}
  if (typeof body.nome === 'string') profileUpdate.nome = body.nome.trim() || null
  if (typeof body.cognome === 'string') profileUpdate.cognome = body.cognome.trim() || null
  if (typeof body.data_nascita === 'string') profileUpdate.data_nascita = body.data_nascita || null
  if (body.data_nascita === null) profileUpdate.data_nascita = null
  if (typeof body.sesso === 'string') profileUpdate.sesso = body.sesso || null
  if (body.role === 'professional' || body.role === 'client') profileUpdate.role = body.role

  // L'email dell'account NON si cambia da qui: passa da
  // /api/admin/users/[id]/email (anteprima, conferma digitata, motivo, schede
  // allineate, admin_audit_log).
  if (typeof body.email === 'string' && body.email.trim()) {
    const { data: authData } = await admin.auth.admin.getUserById(userId)
    if ((authData?.user?.email ?? '').toLowerCase() !== body.email.trim().toLowerCase()) {
      return apiError('use_email_route', 400)
    }
  }

  // Aggiorna nome/cognome anche su professional_profiles se esiste (per coerenza UI).
  if (profileUpdate.nome !== undefined || profileUpdate.cognome !== undefined) {
    const ppUpdate: Record<string, unknown> = {}
    if (profileUpdate.nome !== undefined) ppUpdate.nome = profileUpdate.nome
    if (profileUpdate.cognome !== undefined) ppUpdate.cognome = profileUpdate.cognome
    await admin.from('professional_profiles').update(ppUpdate).eq('id', userId)
  }

  // Piano: abbonamenti + storico + audit (024), non più profiles.plan diretto.
  if (body.plan === 'base' || body.plan === 'pro') {
    const t = await getTranslator(await getRequestLocale(req), 'admin.planToggle')
    const res = await setPlanViaSubscription(admin, guard.user, userId, body.plan, t('quickChangeReason'))
    if (!res.ok) return apiError(res.error, res.status)
  }

  if (profileUpdate.role !== undefined) {
    const { data: before } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
    await logAdminAction(admin, guard.user, {
      action: 'change_role',
      target_type: 'user',
      target_id: userId,
      details: { prima: (before as { role?: string } | null)?.role ?? null, dopo: profileUpdate.role },
    })
  }

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from('profiles').update(profileUpdate).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/users/[id] — cancella l'utente in modo pulito.
// Query/body: ?cascadeClients=true per cancellare anche i clienti del professionista
// (e tutti i loro dati a cascata). Senza, i clienti restano (ma orfani).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const userId = params.id

  // Non permettere l'auto-cancellazione del superadmin loggato.
  if (userId === guard.user.id) {
    return apiError('cannot_delete_self', 400)
  }

  const cascadeClients =
    req.nextUrl.searchParams.get('cascadeClients') === 'true'
  const admin = createAdminClient()

  // Ruolo dell'utente (per decidere la cascata).
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  const role = (profile as { role?: string } | null)?.role ?? null

  // Per un professionista: opzionalmente cancella i suoi clienti (cascata su
  // sessions/measurement_analytics/notes/settings/alerts/messages via FK).
  if (role === 'professional' && cascadeClients) {
    const { data: clientRows } = await admin.from('clients').select('id').eq('professionista_id', userId)
    const clientIds = (clientRows ?? []).map((c) => (c as { id: string }).id)
    if (clientIds.length > 0) {
      await admin.from('client_professional_links').delete().in('client_id', clientIds)
      await admin.from('clients').delete().in('id', clientIds)
    }
  }

  // Rimuovi i collegamenti in cui l'utente è il professionista o il cliente.
  await admin.from('client_professional_links').delete().eq('professional_id', userId)
  await admin.from('client_professional_links').delete().eq('client_user_id', userId)

  // Rimuovi i profili (in caso non ci sia ON DELETE CASCADE da auth.users).
  await admin.from('professional_profiles').delete().eq('id', userId)
  await admin.from('profiles').delete().eq('id', userId)

  // Infine cancella l'utente auth: rimuove ciò che ha FK ON DELETE CASCADE.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
