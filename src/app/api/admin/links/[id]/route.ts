import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'
import { moveClientToProfessional } from '@/lib/admin-links'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/admin/links/[id]
// Body: { status }            → attiva / revoca / riattiva il collegamento
//       { professional_id }   → SPOSTA il cliente a un altro professionista
//                               (link + scheda CRM, vedi lib/admin-links.ts)
//
// Nota sulla transizione → 'active': scatta il trigger DB
// tg_create_client_on_active_link che aggancia (o crea) la scheda CRM del
// professionista in base a client_user_id / email. Per questo riattivare un
// link revocato o accettare un invito pending basta a far comparire il cliente
// nella dashboard del professionista.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const linkId = params.id
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  // Sposta a un altro professionista.
  if (typeof body.professional_id === 'string' && body.professional_id) {
    const result = await moveClientToProfessional(admin, guard.user, { linkId, targetProfessionalId: body.professional_id })
    if (!result.ok) return NextResponse.json({ error: result.error, message: result.message }, { status: result.status })
    return NextResponse.json(result)
  }

  // Cambia stato (active / pending / revoked).
  if (body.status === 'active' || body.status === 'pending' || body.status === 'revoked') {
    const { data: before } = await admin
      .from('client_professional_links')
      .select('id, status, client_user_id, professional_id')
      .eq('id', linkId)
      .maybeSingle()
    if (!before) return NextResponse.json({ error: 'link_not_found' }, { status: 404 })
    const prev = before as { status: string; client_user_id: string | null; professional_id: string }

    const { error } = await admin
      .from('client_professional_links')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', linkId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAdminAction(admin, guard.user, {
      action: 'set_link_status',
      target_type: 'link',
      target_id: linkId,
      details: { from: prev.status, to: body.status, client_user_id: prev.client_user_id, professional_id: prev.professional_id },
    })
    return NextResponse.json({ ok: true, from: prev.status, to: body.status })
  }

  return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
}

// DELETE /api/admin/links/[id] — rimuove definitivamente il collegamento.
// La scheda CRM del professionista NON viene toccata.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const admin = createAdminClient()
  const { data: before } = await admin
    .from('client_professional_links')
    .select('id, status, client_id, client_user_id, professional_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: 'link_not_found' }, { status: 404 })

  const { error } = await admin.from('client_professional_links').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction(admin, guard.user, {
    action: 'delete_link',
    target_type: 'link',
    target_id: params.id,
    details: before as Record<string, unknown>,
  })
  return NextResponse.json({ ok: true })
}
