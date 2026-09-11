import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// /api/admin/collegamenti — Salute collegamenti (migration 020).
//
// GET  → righe della view v_collegamenti_salute + conteggi per tipo + alert
//        aperto (badge). Se la migration non è applicata: migration_required.
// POST → azione di riparazione, con conferma lato UI:
//        { action: 'bridge', email }                                → ensure_client_bridge
//        { action: 'link', client_user_id, professional_id }        → link_client_to_professional
//        { action: 'revoke_link', link_id }                         → status='revoked'
//        { action: 'realign_analytics' }                            → client_id = sessione
//        { action: 'check' }                                        → collegamenti_salute_check (aggiorna il badge)
//        { action: 'resolve_alert', alert_id }                      → chiude l'alert
// Le unioni passano da /api/admin/clients/merge (admin_merge_clients).
// ============================================================================

export type SaluteRow = {
  tipo_problema: string
  gravita: 'alta' | 'media' | 'bassa'
  client_id: string | null
  client_user_id: string | null
  professional_id: string | null
  link_id: string | null
  email: string | null
  nome: string | null
  professionista: string | null
  dettaglio: string | null
  fix_proposto: string | null
  fix_auto: boolean
  fix_rpc: string | null
  fix_args: Record<string, unknown>
}

function isMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || (error.message ?? '').includes('does not exist')
}

export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const admin = createAdminClient()

  const [rowsRes, alertRes] = await Promise.all([
    admin.from('v_collegamenti_salute').select('*').order('gravita').order('tipo_problema'),
    admin.from('admin_alerts').select('id, kind, total, details, created_at').eq('kind', 'collegamenti_salute').is('resolved_at', null).order('created_at', { ascending: false }).limit(1),
  ])
  if (rowsRes.error) {
    if (isMissing(rowsRes.error)) return NextResponse.json({ migration_required: true })
    return NextResponse.json({ error: rowsRes.error.message }, { status: 500 })
  }
  const rows = (rowsRes.data ?? []) as SaluteRow[]
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.tipo_problema] = (counts[r.tipo_problema] ?? 0) + 1
  const alert = ((alertRes.data ?? []) as Array<{ id: number; total: number; details: Record<string, number>; created_at: string }>)[0] ?? null
  return NextResponse.json({ rows, counts, total: rows.length, alert })
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'bridge') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) return NextResponse.json({ error: 'missing_email' }, { status: 400 })
    const { data, error } = await admin.rpc('ensure_client_bridge', { p_email: email })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const res = data as { ok?: boolean; error?: string }
    if (!res?.ok) return NextResponse.json({ error: 'bridge_failed', message: res?.error ?? 'ponte non scritto' }, { status: 422 })
    await logAdminAction(admin, guard.user, { action: 'salute_bridge', target_type: 'client', target_id: email, details: res as Record<string, unknown> })
    return NextResponse.json({ ok: true, result: res })
  }

  if (action === 'link') {
    const clientUserId = typeof body.client_user_id === 'string' ? body.client_user_id : ''
    const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
    if (!clientUserId || !professionalId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    const { data, error } = await admin.rpc('link_client_to_professional', {
      p_client_user_id: clientUserId,
      p_professional_id: professionalId,
      p_source: 'admin:salute',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const res = data as { ok?: boolean; error?: string; link_id?: string }
    if (!res?.ok) return NextResponse.json({ error: 'link_failed', message: res?.error ?? 'collegamento non riuscito' }, { status: 422 })
    await logAdminAction(admin, guard.user, { action: 'salute_link', target_type: 'link', target_id: res.link_id ?? null, details: { client_user_id: clientUserId, professional_id: professionalId, result: res } })
    return NextResponse.json({ ok: true, result: res })
  }

  if (action === 'revoke_link') {
    const linkId = typeof body.link_id === 'string' ? body.link_id : ''
    if (!linkId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    const { error } = await admin.from('client_professional_links').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', linkId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAdminAction(admin, guard.user, { action: 'salute_revoke_link', target_type: 'link', target_id: linkId, details: {} })
    return NextResponse.json({ ok: true })
  }

  if (action === 'realign_analytics') {
    // Riallinea client_id di measurement_analytics alla sessione (tutte le righe).
    const { data: rows, error: selErr } = await admin.rpc('collegamenti_salute_counts')
    if (selErr && isMissing(selErr)) return NextResponse.json({ migration_required: true })
    void rows
    const { data: ma, error } = await admin.from('measurement_analytics').select('id, session_id, client_id').not('session_id', 'is', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const ids = Array.from(new Set((ma ?? []).map((m) => (m as { session_id: string }).session_id)))
    const sessionClient = new Map<string, string | null>()
    for (let i = 0; i < ids.length; i += 500) {
      const { data: ss } = await admin.from('sessions').select('id, client_id').in('id', ids.slice(i, i + 500))
      for (const s of (ss ?? []) as Array<{ id: string; client_id: string | null }>) sessionClient.set(s.id, s.client_id)
    }
    let fixed = 0
    for (const m of (ma ?? []) as Array<{ id: string; session_id: string; client_id: string | null }>) {
      if (!sessionClient.has(m.session_id)) continue
      const want = sessionClient.get(m.session_id) ?? null
      if ((m.client_id ?? null) === want) continue
      const { error: uErr } = await admin.from('measurement_analytics').update({ client_id: want }).eq('id', m.id)
      if (!uErr) fixed++
    }
    await logAdminAction(admin, guard.user, { action: 'salute_realign_analytics', target_type: 'analytics', target_id: null, details: { fixed } })
    return NextResponse.json({ ok: true, fixed })
  }

  if (action === 'check') {
    const { data, error } = await admin.rpc('collegamenti_salute_check')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, result: data })
  }

  if (action === 'resolve_alert') {
    const alertId = Number(body.alert_id)
    if (!alertId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    const { error } = await admin.from('admin_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', alertId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
