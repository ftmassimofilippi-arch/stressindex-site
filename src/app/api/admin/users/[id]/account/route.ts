import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'
import { getAccountHistory } from '@/lib/admin-commerciale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// /api/admin/users/[id]/account — stato, abbonamento e moduli (migration 024).
//
// GET  → storico dell'abbonamento + audit commerciale dell'account
// POST → una delle azioni, sempre con motivo dove richiesto:
//   { action: 'status', stato: 'attivo'|'sospeso'|'bloccato', motivo }
//        admin_set_account_status; 'bloccato' banna l'utente in auth (login
//        negato, refresh token rifiutati), 'attivo'/'sospeso' tolgono il ban
//   { action: 'subscription', piano, data_inizio, data_scadenza, rinnovo_automatico, note, motivo }
//   { action: 'extend', mesi: 1|3|12, motivo }
//   { action: 'module', modulo, abilitato: true|false|null, motivo, scade_il }
//        null = rimuove l'eccezione, torna a valere il piano
// Ogni funzione DB scrive admin_audit_log (chi, cosa, prima/dopo, perché).
// ============================================================================

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883'
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function dateOrNull(v: unknown): string | null | undefined {
  if (v === null || v === '' || v === undefined) return null
  return typeof v === 'string' && DATE_RE.test(v) ? v : undefined
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const history = await getAccountHistory(createAdminClient(), params.id)
  return NextResponse.json(history)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const by = { p_by: guard.user.id, p_by_email: guard.user.email ?? null }
  const userId = params.id
  const motivo = typeof body.motivo === 'string' ? body.motivo : null

  let rpc: string
  let args: Record<string, unknown>
  switch (body.action) {
    case 'status': {
      if (!['attivo', 'sospeso', 'bloccato'].includes(body.stato)) return apiError('stato_non_valido', 400)
      if (userId === guard.user.id && body.stato !== 'attivo') return apiError('cannot_suspend_self', 400)
      rpc = 'admin_set_account_status'
      args = { p_user_id: userId, p_stato: body.stato, p_motivo: motivo, ...by }
      break
    }
    case 'subscription': {
      const inizio = dateOrNull(body.data_inizio)
      const scadenza = dateOrNull(body.data_scadenza)
      if (inizio === undefined || scadenza === undefined) return apiError('data_non_valida', 400)
      rpc = 'admin_set_subscription'
      args = {
        p_user_id: userId,
        p_piano: body.piano,
        p_data_inizio: inizio,
        p_data_scadenza: scadenza,
        p_rinnovo: !!body.rinnovo_automatico,
        p_note: typeof body.note === 'string' ? body.note : null,
        p_motivo: motivo,
        ...by,
      }
      break
    }
    case 'extend': {
      const mesi = Number(body.mesi)
      if (![1, 3, 12].includes(mesi)) return apiError('mesi_non_validi', 400)
      rpc = 'admin_extend_subscription'
      args = { p_user_id: userId, p_mesi: mesi, p_motivo: motivo, ...by }
      break
    }
    case 'module': {
      const scade = dateOrNull(body.scade_il)
      if (scade === undefined) return apiError('data_non_valida', 400)
      if (typeof body.modulo !== 'string') return apiError('modulo_non_valido', 400)
      rpc = 'admin_set_module_exception'
      args = {
        p_user_id: userId,
        p_modulo: body.modulo,
        p_abilitato: body.abilitato === true ? true : body.abilitato === false ? false : null,
        p_motivo: motivo,
        p_scade_il: scade,
        ...by,
      }
      break
    }
    default:
      return apiError('invalid_action', 400)
  }

  const { data, error } = await admin.rpc(rpc, args)
  if (error) {
    if (isMissing(error)) return apiError('migration_required', 409, { migration: '024' })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const res = data as { ok?: boolean; error?: string } & Record<string, unknown>
  if (!res?.ok) {
    // Codice della funzione DB (es. prova_senza_scadenza): tradotto dal client.
    return apiError(res?.error ?? 'generic', 422)
  }

  // Blocco = login negato anche lato auth. Il ban si toglie con ogni altro stato.
  if (body.action === 'status' && (body.stato === 'bloccato' || res.prima === 'bloccato')) {
    const ban = body.stato === 'bloccato'
    const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: ban ? '876000h' : 'none' })
    await logAdminAction(admin, guard.user, {
      action: ban ? 'auth_ban' : 'auth_unban',
      target_type: 'user',
      target_id: userId,
      details: { stato: body.stato, motivo, esito: banErr ? banErr.message : 'ok' },
    })
    if (banErr) {
      // Avviso come codice: il client lo traduce con errors.api.auth_(un)ban_failed.
      return NextResponse.json({ ok: true, result: res, warning: ban ? 'auth_ban_failed' : 'auth_unban_failed', warning_detail: banErr.message })
    }
  }
  return NextResponse.json({ ok: true, result: res })
}
