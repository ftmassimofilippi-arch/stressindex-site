import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'
import { linkViaRpc } from '@/lib/collegamenti'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/links/manual — aggancio manuale cliente↔professionista.
// Body: { client_email: string, professional_id: string }
//
// Risolve l'utente dall'email e delega a link_client_to_professional
// (migration 019): scheda trovata/creata con il ponte, doppioni per email
// uniti, link creato o riattivato, altri link vivi della coppia revocati.
//
// Risposte (campo `status`, dal campo `action` della RPC):
//  • 'created'        → nuovo link attivo
//  • 'reactivated'    → link esistente pending/revoked portato ad active
//  • 'already_active' → esisteva già un link attivo: nessuna modifica
export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const email = typeof body.client_email === 'string' ? body.client_email.trim().toLowerCase() : ''
  const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
  if (!email || !professionalId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  const admin = createAdminClient()

  // 1. Utente cliente dall'email (match case-insensitive esatto).
  const { data: profRows } = await admin.from('profiles').select('id, nome, cognome, email, role').ilike('email', email).limit(5)
  const candidates = (profRows ?? []) as Array<{ id: string; nome: string | null; cognome: string | null; email: string | null; role: string | null }>
  const clientUser = candidates.find((c) => c.role === 'client') ?? (candidates.length === 1 ? candidates[0] : undefined)
  if (!clientUser) {
    if (candidates.length > 1) {
      return NextResponse.json({ error: 'ambiguous_email', message: `Più profili con email ${email}: risolvere a mano.` }, { status: 409 })
    }
    return NextResponse.json({ error: 'user_not_found', message: `Nessun utente registrato con email ${email}` }, { status: 404 })
  }

  // 2. Professionista.
  const { data: pro } = await admin.from('profiles').select('id, role').eq('id', professionalId).maybeSingle()
  if (!pro) return NextResponse.json({ error: 'professional_not_found' }, { status: 404 })

  // 3. Punto di verità.
  const rpc = await linkViaRpc(admin, clientUser.id, professionalId, 'admin:manual')
  if (!rpc.ok) return NextResponse.json({ error: 'link_failed', message: rpc.error, rpc: rpc.result }, { status: rpc.status })
  const status: 'created' | 'reactivated' | 'already_active' =
    rpc.result.action === 'created' ? 'created' : rpc.result.action === 'reactivated' ? 'reactivated' : 'already_active'
  const linkId = rpc.result.link_id ?? null

  // 4. Scheda CRM risultante.
  type CrmRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  let crm: CrmRow | null = null
  if (rpc.result.client_id) {
    const { data } = await admin.from('clients').select('id, nome, cognome, email').eq('id', rpc.result.client_id).maybeSingle()
    crm = (data as CrmRow | null) ?? null
  }

  if (status !== 'already_active' || (rpc.result.merged ?? []).length > 0 || rpc.result.card_action !== 'found') {
    await logAdminAction(admin, guard.user, {
      action: 'create_link',
      target_type: 'link',
      target_id: linkId,
      details: { status, client_email: email, client_user_id: clientUser.id, professional_id: professionalId, crm_client_id: crm?.id ?? null, rpc: rpc.result },
    })
  }

  return NextResponse.json({
    ok: true,
    status,
    link_id: linkId,
    client_role: clientUser.role,
    client_user_id: clientUser.id,
    crm_client: crm,
    merged: rpc.result.merged ?? [],
  })
}
