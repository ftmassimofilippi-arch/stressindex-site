import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { logAdminAction } from '@/lib/admin-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/links/manual — aggancio manuale cliente↔professionista.
// Body: { client_email: string, professional_id: string }
//
// Crea (o riattiva) il link in client_professional_links valorizzando
// client_user_id — MAI client_id: la riga CRM `clients` viene creata/agganciata
// dal trigger tg_create_client_on_active_link nella stessa transazione che
// porta il link ad 'active' (nessuna duplicazione di quella logica qui).
//
// Risposte (campo `status`):
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

  // 1. Risolvi l'utente cliente dall'email (match case-insensitive esatto).
  const { data: userProfile } = await admin
    .from('profiles')
    .select('id, nome, cognome, email, role')
    .ilike('email', email)
    .maybeSingle()
  if (!userProfile) {
    return NextResponse.json({ error: 'user_not_found', message: `Nessun utente registrato con email ${email}` }, { status: 404 })
  }
  const clientUser = userProfile as { id: string; nome: string | null; cognome: string | null; email: string | null; role: string | null }

  // 2. Verifica che il professionista esista.
  const { data: pro } = await admin.from('profiles').select('id, role').eq('id', professionalId).maybeSingle()
  if (!pro) return NextResponse.json({ error: 'professional_not_found' }, { status: 404 })

  // 3. Link esistente per la coppia? (active batte pending batte revoked)
  const { data: existingRows } = await admin
    .from('client_professional_links')
    .select('id, status, created_at, updated_at')
    .eq('professional_id', professionalId)
    .eq('client_user_id', clientUser.id)
    .order('created_at', { ascending: false })
  const existing = (existingRows ?? []) as Array<{ id: string; status: string; created_at: string | null; updated_at: string | null }>
  const active = existing.find((l) => l.status === 'active')
  const revivable = existing.find((l) => l.status === 'pending') ?? existing.find((l) => l.status === 'revoked')

  let status: 'created' | 'reactivated' | 'already_active'
  let linkId: string

  if (active) {
    status = 'already_active'
    linkId = active.id
  } else if (revivable) {
    // La transizione → active fa scattare il trigger che aggancia/crea la riga CRM.
    const { error } = await admin
      .from('client_professional_links')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', revivable.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    status = 'reactivated'
    linkId = revivable.id
  } else {
    const { data, error } = await admin
      .from('client_professional_links')
      .insert({ professional_id: professionalId, client_user_id: clientUser.id, status: 'active' })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    status = 'created'
    linkId = (data as { id: string }).id
  }

  // 4. Riga CRM risultante (creata/agganciata dal trigger). Match per ponte
  //    esplicito, con fallback email finché la migration 017 non è applicata.
  type CrmRow = { id: string; nome: string | null; cognome: string | null; email: string | null }
  let crm: CrmRow | null = null
  {
    const { data } = await admin
      .from('clients')
      .select('id, nome, cognome, email')
      .eq('professionista_id', professionalId)
      .eq('client_user_id', clientUser.id)
      .limit(1)
    crm = ((data ?? []) as CrmRow[])[0] ?? null
  }
  if (!crm) {
    const { data } = await admin
      .from('clients')
      .select('id, nome, cognome, email')
      .eq('professionista_id', professionalId)
      .ilike('email', email)
      .limit(1)
    crm = ((data ?? []) as CrmRow[])[0] ?? null
  }

  if (status !== 'already_active') {
    await logAdminAction(admin, guard.user, {
      action: 'create_link',
      target_type: 'link',
      target_id: linkId,
      details: { status, client_email: email, client_user_id: clientUser.id, professional_id: professionalId, crm_client_id: crm?.id ?? null },
    })
  }

  return NextResponse.json({
    ok: true,
    status,
    link_id: linkId,
    client_role: clientUser.role,
    client_user_id: clientUser.id,
    crm_client: crm,
  })
}
