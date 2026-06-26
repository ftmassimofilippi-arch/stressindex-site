import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/admin/links/[id]
// Body: { status }            → revoca/riattiva il collegamento
//       { professional_id }   → SPOSTA il cliente a un altro professionista
//                               (aggiorna sia il link sia clients.professionista_id)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const linkId = params.id
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  // Sposta a un altro professionista.
  if (typeof body.professional_id === 'string' && body.professional_id) {
    const { data: link } = await admin
      .from('client_professional_links')
      .select('client_id')
      .eq('id', linkId)
      .maybeSingle()
    if (!link) return NextResponse.json({ error: 'link_not_found' }, { status: 404 })
    const clientId = (link as { client_id: string }).client_id

    const { error: linkErr } = await admin
      .from('client_professional_links')
      .update({ professional_id: body.professional_id, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', linkId)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

    // Cambia anche il professionista proprietario del cliente.
    const { error: cErr } = await admin
      .from('clients')
      .update({ professionista_id: body.professional_id })
      .eq('id', clientId)
    if (cErr) return NextResponse.json({ error: `client: ${cErr.message}` }, { status: 500 })

    return NextResponse.json({ ok: true })
  }

  // Cambia stato (active / pending / revoked).
  if (body.status === 'active' || body.status === 'pending' || body.status === 'revoked') {
    const { error } = await admin
      .from('client_professional_links')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', linkId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
}

// DELETE /api/admin/links/[id] — rimuove definitivamente il collegamento.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const admin = createAdminClient()
  const { error } = await admin.from('client_professional_links').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
