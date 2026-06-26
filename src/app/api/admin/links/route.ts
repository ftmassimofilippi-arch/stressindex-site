import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { getAdminLinks } from '@/lib/admin-data'

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

// POST /api/admin/links — crea o ricollega un cliente a un professionista.
// Body: { client_id, professional_id, status? }
// Se esiste già un collegamento per la coppia, ne aggiorna lo stato (riattiva).
export async function POST(req: NextRequest) {
  const guard = await requireSuperadmin()
  if (guard.error) return guard.error
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  const clientId = typeof body.client_id === 'string' ? body.client_id : ''
  const professionalId = typeof body.professional_id === 'string' ? body.professional_id : ''
  const status = body.status === 'pending' || body.status === 'revoked' ? body.status : 'active'
  if (!clientId || !professionalId) return NextResponse.json({ error: 'missing_params' }, { status: 400 })

  const { data: existing } = await admin
    .from('client_professional_links')
    .select('id')
    .eq('client_id', clientId)
    .eq('professional_id', professionalId)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('client_professional_links')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', (existing as { id: string }).id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: (existing as { id: string }).id })
  }

  const { data, error } = await admin
    .from('client_professional_links')
    .insert({ client_id: clientId, professional_id: professionalId, status })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: (data as { id: string }).id })
}
