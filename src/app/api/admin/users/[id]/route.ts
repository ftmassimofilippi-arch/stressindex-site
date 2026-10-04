import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import * as Sentry from '@sentry/nextjs'
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

// DELETE /api/admin/users/[id] — cancellazione GDPR di un utente (app-042).
// Passa dalla Edge Function `delete-account` con la sessione del superadmin:
// una transazione lato database (trasferimenti secondo la regola "le
// misurazioni seguono la persona misurata", cancellazione, pseudonimizzazione,
// verifica dei residui) e poi i file nei bucket. Niente passi a mano qui: se
// fallisce, niente e' stato toccato e il motivo arriva come `code`.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const userId = params.id

  if (userId === guard.user.id) {
    return apiError('cannot_delete_self', 400)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { user_id: userId } })
  if (error || !(data as { ok?: boolean } | null)?.ok) {
    let payload: Record<string, unknown> | null = (data as Record<string, unknown> | null) ?? null
    if (!payload && error && 'context' in error) {
      try { payload = await (error as { context: Response }).context.json() } catch { payload = null }
    }
    const code = typeof payload?.code === 'string' ? payload.code : 'db_failed'
    const message = typeof payload?.message === 'string' ? payload.message : error?.message ?? ''
    Sentry.captureMessage(`delete-account via pannello fallita: ${code}`, { level: 'error', extra: { userId } })
    return apiError(code, 500, { message })
  }

  return NextResponse.json({ ok: true, esito: (data as { esito?: unknown }).esito ?? null })
}
