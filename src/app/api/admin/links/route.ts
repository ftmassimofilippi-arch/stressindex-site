import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAdminLinks } from '@/lib/admin-data'
import { logAdminAction } from '@/lib/admin-audit'
import { linkViaRpc, resolveClientUserId } from '@/lib/collegamenti'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/links — tutti i collegamenti cliente↔professionista con stato.
export async function GET() {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  try {
    const links = await getAdminLinks()
    return NextResponse.json({ links })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'errore'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/admin/links — "Collega scheda": collega una scheda CRM esistente
// al suo professionista. Body: { client_id, professional_id, status? }
//
// Passa dall'unico punto di verità lato database, link_client_to_professional
// (migration 019): risolve l'account dal ponte clients.client_user_id o
// dall'email, aggancia la scheda (unendo eventuali doppioni), crea o riattiva
// il link. La versione precedente scriveva l'id TEXT della scheda (epoch) nella
// colonna uuid client_professional_links.client_id e falliva: quella colonna
// non viene più scritta da nessuna route.
// Senza un account registrato non si può creare un collegamento → 422.
export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  const clientId = typeof body.client_id === 'string' ? body.client_id : ''
  const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
  const status = body.status === 'pending' || body.status === 'revoked' ? body.status : 'active'
  if (!clientId || !professionalId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

  const { data: crm } = await admin.from('clients').select('id, email, client_user_id, professionista_id, merged_into_client_id').eq('id', clientId).maybeSingle()
  if (!crm) return NextResponse.json({ error: 'client_not_found' }, { status: 404 })
  const row = crm as { id: string; email: string | null; client_user_id: string | null; professionista_id: string | null; merged_into_client_id?: string | null }
  if (row.merged_into_client_id) {
    return NextResponse.json({ error: 'client_merged', message: `La scheda è stata unita nella scheda ${row.merged_into_client_id}: collega quella.` }, { status: 409 })
  }
  if (row.professionista_id && row.professionista_id !== professionalId) {
    return NextResponse.json({ error: 'professional_mismatch', message: 'La scheda appartiene a un altro professionista: usa "Sposta" prima di collegarla.' }, { status: 409 })
  }

  const clientUserId = await resolveClientUserId(admin, row)
  if (!clientUserId) {
    return NextResponse.json(
      { error: 'no_client_account', message: 'La scheda non è associata a nessun account cliente registrato (né per id né per email).' },
      { status: 422 },
    )
  }

  const rpc = await linkViaRpc(admin, clientUserId, professionalId, 'admin:collega_scheda')
  if (!rpc.ok) return NextResponse.json({ error: 'link_failed', message: rpc.error }, { status: rpc.status })
  const linkId = rpc.result.link_id

  // Stato diverso da active richiesto esplicitamente: applicato dopo (la RPC
  // crea sempre active; il trigger reagisce solo alla transizione → active).
  if (status !== 'active' && linkId) {
    const { error } = await admin.from('client_professional_links').update({ status, updated_at: new Date().toISOString() }).eq('id', linkId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction(admin, guard.user, {
    action: 'create_link',
    target_type: 'link',
    target_id: linkId ?? null,
    details: { status, client_id: rpc.result.client_id ?? clientId, client_user_id: clientUserId, professional_id: professionalId, rpc: rpc.result },
  })
  return NextResponse.json({ ok: true, id: linkId, reused: rpc.result.action !== 'created', result: rpc.result })
}
