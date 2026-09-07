import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAdminLinks } from '@/lib/admin-data'
import { logAdminAction } from '@/lib/admin-audit'

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

// POST /api/admin/links — collega una scheda CRM esistente a un professionista.
// Body: { client_id, professional_id, status? }
//
// Il collegamento "vero" è per account (client_user_id): viene risolto dalla
// scheda (clients.client_user_id) o dalla sua email. Senza un account non si
// può creare un collegamento utile → 422. Per collegare via email di un
// utente registrato usa /api/admin/links/manual.
// Se esiste già un collegamento per la coppia, ne aggiorna lo stato.
export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  const clientId = typeof body.client_id === 'string' ? body.client_id : ''
  const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
  const status = body.status === 'pending' || body.status === 'revoked' ? body.status : 'active'
  if (!clientId || !professionalId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

  const { data: crm } = await admin.from('clients').select('id, email, client_user_id').eq('id', clientId).maybeSingle()
  if (!crm) return NextResponse.json({ error: 'client_not_found' }, { status: 404 })
  const row = crm as { id: string; email: string | null; client_user_id: string | null }

  let clientUserId = row.client_user_id
  if (!clientUserId && row.email) {
    const { data } = await admin.from('profiles').select('id').ilike('email', row.email.trim().toLowerCase()).limit(1)
    clientUserId = ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null
  }
  if (!clientUserId) {
    return NextResponse.json(
      { error: 'no_client_account', message: 'La scheda non è associata a nessun account cliente registrato (né per id né per email).' },
      { status: 422 },
    )
  }
  if (!row.client_user_id) await admin.from('clients').update({ client_user_id: clientUserId }).eq('id', row.id)

  const { data: existing } = await admin
    .from('client_professional_links')
    .select('id, status')
    .eq('professional_id', professionalId)
    .or(`client_id.eq.${clientId},client_user_id.eq.${clientUserId}`)
    .limit(1)
  const ex = ((existing ?? []) as Array<{ id: string; status: string }>)[0]

  let linkId: string
  if (ex) {
    const { error } = await admin
      .from('client_professional_links')
      .update({ status, client_id: clientId, client_user_id: clientUserId, updated_at: new Date().toISOString() })
      .eq('id', ex.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    linkId = ex.id
  } else {
    const { data, error } = await admin
      .from('client_professional_links')
      .insert({ client_id: clientId, professional_id: professionalId, client_user_id: clientUserId, status })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    linkId = (data as { id: string }).id
  }

  await logAdminAction(admin, guard.user, {
    action: 'create_link',
    target_type: 'link',
    target_id: linkId,
    details: { status, client_id: clientId, client_user_id: clientUserId, professional_id: professionalId, reused: !!ex },
  })
  return NextResponse.json({ ok: true, id: linkId, reused: !!ex })
}
